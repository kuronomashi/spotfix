package spotfix.gradle;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * Mezcla la carpeta .spotfix bajada del dispositivo con la del proyecto. Nunca borra nada.
 *
 * <ul>
 *   <li>Notas nuevas del dispositivo (y sus capturas) se copian a la carpeta de notas del proyecto.</li>
 *   <li>Si una nota está en los dos lados, gana {@code hecha}: lo que marcó la IA no se pierde.</li>
 *   <li>config.json: gana el más reciente; LEEME-IA.md solo se copia si el proyecto no tiene.</li>
 * </ul>
 */
final class Sincronizar {
    private Sincronizar() {}

    static final String CARPETA_DEFECTO = ".spotfix/notas";

    /** Archivo que hay que subir al dispositivo: ruta local y ruta relativa a files/ de la app. */
    record Subida(Path local, String remota) {}

    static final class Resultado {
        final List<String> nuevas = new ArrayList<>();
        final List<String> hechasEnProyecto = new ArrayList<>();
        final List<Subida> subidas = new ArrayList<>();
        int hechasEnDispositivo;
        boolean configBajada;
    }

    private static final Pattern ESTADO = Pattern.compile("(?m)^estado:[ \\t]*\"([^\"]*)\"[ \\t]*$");
    private static final Pattern PLATAFORMA = Pattern.compile("(?m)^plataforma:[ \\t]*\"([^\"]*)\"");
    private static final Pattern FUENTE = Pattern.compile("(?m)^fuente:[ \\t]*\"([^\"]+):(\\d+)\"[ \\t]*$");
    private static final Pattern CARPETA = Pattern.compile("\"carpeta\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"");
    private static final List<String> NO_BUSCAR = List.of("build", ".gradle", ".git", ".idea", ".spotfix", "node_modules", ".kotlin");

    /**
     * @param dispositivo la carpeta .spotfix tal como se bajó del dispositivo
     * @param raiz la raíz del proyecto (donde vive .spotfix/config.json)
     */
    static Resultado mezclar(Path dispositivo, Path raiz) throws IOException {
        Resultado r = new Resultado();
        Path spotfix = raiz.resolve(".spotfix");
        Files.createDirectories(spotfix);

        // config.json: gana el más reciente y luego queda igual en los dos lados.
        Path cfgDisp = dispositivo.resolve("config.json");
        Path cfgPc = spotfix.resolve("config.json");
        if (Files.exists(cfgDisp)) {
            boolean distintos = !Files.exists(cfgPc) || !Files.readString(cfgPc).equals(Files.readString(cfgDisp));
            if (distintos) {
                if (!Files.exists(cfgPc) || Files.getLastModifiedTime(cfgDisp).compareTo(Files.getLastModifiedTime(cfgPc)) > 0) {
                    Files.copy(cfgDisp, cfgPc, StandardCopyOption.REPLACE_EXISTING);
                    r.configBajada = true;
                } else {
                    r.subidas.add(new Subida(cfgPc, ".spotfix/config.json"));
                }
            }
        } else if (Files.exists(cfgPc)) {
            r.subidas.add(new Subida(cfgPc, ".spotfix/config.json"));
        }
        Path leeme = dispositivo.resolve("LEEME-IA.md");
        if (Files.exists(leeme) && !Files.exists(spotfix.resolve("LEEME-IA.md"))) {
            Files.copy(leeme, spotfix.resolve("LEEME-IA.md"));
        }

        Path notasPc = carpetaNotas(raiz);
        Path notasDisp = dispositivo.resolve("notas");
        Map<String, Path> fuentes = null; // índice de archivos .kt/.java, solo si hace falta

        for (Map.Entry<String, Path> e : notas(notasDisp).entrySet()) {
            String rel = e.getKey();
            Path disp = e.getValue();
            Path pc = notasPc.resolve(rel);
            String textoDisp = Files.readString(disp);
            if (!Files.exists(pc)) {
                Matcher f = FUENTE.matcher(textoDisp);
                if (f.find() && !Files.exists(raiz.resolve(f.group(1)))) {
                    if (fuentes == null) fuentes = indiceFuentes(raiz);
                    String real = resolverFuente(f.group(1), fuentes);
                    if (real != null) {
                        textoDisp = textoDisp.substring(0, f.start(1)) + real + textoDisp.substring(f.end(1));
                    }
                }
                Files.createDirectories(pc.getParent());
                Files.writeString(pc, textoDisp);
                copiarCapturas(disp, pc);
                r.nuevas.add(rel);
                continue;
            }
            String textoPc = Files.readString(pc);
            boolean hechaPc = "hecha".equals(estado(textoPc));
            boolean hechaDisp = "hecha".equals(estado(textoDisp));
            if (hechaDisp && !hechaPc) {
                Files.writeString(pc, conEstado(textoPc, "hecha"));
                r.hechasEnProyecto.add(rel);
            } else if (hechaPc && !hechaDisp) {
                r.subidas.add(new Subida(pc, ".spotfix/notas/" + rel));
                r.hechasEnDispositivo++;
            }
        }

        // Notas de Android que el dispositivo ya no tiene (p. ej. se reinstaló la app): vuelven a subir
        // para que la lista del panel siga completa. Las capturas no hacen falta allí.
        Map<String, Path> enDisp = notas(notasDisp);
        for (Map.Entry<String, Path> e : notas(notasPc).entrySet()) {
            if (enDisp.containsKey(e.getKey())) continue;
            Matcher p = PLATAFORMA.matcher(Files.readString(e.getValue()));
            if (p.find() && p.group(1).equals("android")) {
                r.subidas.add(new Subida(e.getValue(), ".spotfix/notas/" + e.getKey()));
            }
        }
        return r;
    }

    /** Notas abiertas en una carpeta de notas. */
    static int abiertas(Path carpetaNotas) throws IOException {
        int n = 0;
        for (Path p : notas(carpetaNotas).values()) {
            if (!"hecha".equals(estado(Files.readString(p)))) n++;
        }
        return n;
    }

    /** La carpeta de notas del proyecto según .spotfix/config.json (relativa a la raíz o absoluta). */
    static Path carpetaNotas(Path raiz) throws IOException {
        Path cfg = raiz.resolve(".spotfix/config.json");
        String carpeta = CARPETA_DEFECTO;
        if (Files.exists(cfg)) {
            Matcher m = CARPETA.matcher(Files.readString(cfg));
            if (m.find() && !m.group(1).isBlank()) {
                carpeta = m.group(1).replace("\\\\", "\\").replace("\\\"", "\"").replace("\\/", "/").trim();
            }
        }
        Path c = Path.of(carpeta);
        return c.isAbsolute() ? c : raiz.resolve(carpeta);
    }

    static String estado(String nota) {
        Matcher m = ESTADO.matcher(nota);
        return m.find() ? m.group(1) : "abierta";
    }

    static String conEstado(String nota, String estado) {
        Matcher m = ESTADO.matcher(nota);
        if (!m.find()) return nota;
        return nota.substring(0, m.start(1)) + estado + nota.substring(m.end(1));
    }

    /**
     * La pila de llamadas de Android solo da {@code paquete/Archivo.kt}; aquí se busca el archivo real
     * en el proyecto ({@code app/src/main/java/paquete/Archivo.kt}). Si hay varios o ninguno, se deja igual.
     */
    static String resolverFuente(String fuente, Map<String, Path> indice) {
        String sufijo = "/" + fuente;
        String hallado = null;
        for (String rel : indice.keySet()) {
            if (rel.endsWith(sufijo) || rel.equals(fuente)) {
                if (hallado != null) return null;
                hallado = rel;
            }
        }
        return hallado;
    }

    static Map<String, Path> indiceFuentes(Path raiz) throws IOException {
        Map<String, Path> indice = new TreeMap<>();
        try (Stream<Path> s = Files.walk(raiz)) {
            s.filter(p -> {
                String nombre = p.getFileName().toString();
                return nombre.endsWith(".kt") || nombre.endsWith(".java");
            }).filter(p -> {
                for (Path parte : raiz.relativize(p)) {
                    if (NO_BUSCAR.contains(parte.toString())) return false;
                }
                return true;
            }).forEach(p -> indice.put(raiz.relativize(p).toString().replace('\\', '/'), p));
        }
        return indice;
    }

    /** {@code AAAA-MM-DD/nota.md} → archivo, ordenadas. */
    private static Map<String, Path> notas(Path carpeta) throws IOException {
        Map<String, Path> out = new TreeMap<>();
        if (!Files.isDirectory(carpeta)) return out;
        try (Stream<Path> dias = Files.list(carpeta)) {
            for (Path dia : (Iterable<Path>) dias::iterator) {
                String d = dia.getFileName().toString();
                if (!Files.isDirectory(dia) || d.length() != 10 || d.charAt(4) != '-') continue;
                try (Stream<Path> archivos = Files.list(dia)) {
                    archivos.filter(a -> a.getFileName().toString().endsWith(".md") && Files.isRegularFile(a))
                        .forEach(a -> out.put(d + "/" + a.getFileName(), a));
                }
            }
        }
        return out;
    }

    /** Capturas de una nota: {@code img/<nombre base>_N.png} del mismo día. */
    private static void copiarCapturas(Path notaDisp, Path notaPc) throws IOException {
        String base = notaDisp.getFileName().toString().replaceFirst("\\.md$", "") + "_";
        Path img = notaDisp.getParent().resolve("img");
        if (!Files.isDirectory(img)) return;
        try (Stream<Path> s = Files.list(img)) {
            for (Path p : (Iterable<Path>) s::iterator) {
                if (!p.getFileName().toString().startsWith(base)) continue;
                Path destino = notaPc.getParent().resolve("img").resolve(p.getFileName().toString());
                if (Files.exists(destino)) continue;
                Files.createDirectories(destino.getParent());
                Files.copy(p, destino, StandardCopyOption.COPY_ATTRIBUTES);
            }
        }
    }
}
