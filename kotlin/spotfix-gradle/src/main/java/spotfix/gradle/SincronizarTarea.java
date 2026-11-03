package spotfix.gradle;

import org.gradle.api.DefaultTask;
import org.gradle.api.GradleException;
import org.gradle.api.file.DirectoryProperty;
import org.gradle.api.file.RegularFileProperty;
import org.gradle.api.provider.Property;
import org.gradle.api.tasks.Input;
import org.gradle.api.tasks.Internal;
import org.gradle.api.tasks.TaskAction;
import org.gradle.work.DisableCachingByDefault;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

@DisableCachingByDefault(because = "Lee y escribe en el dispositivo")
public abstract class SincronizarTarea extends DefaultTask {
    @Internal
    public abstract RegularFileProperty getAdb();

    @Input
    public abstract Property<String> getAplicacion();

    @Internal
    public abstract DirectoryProperty getRaiz();

    @Internal
    public abstract DirectoryProperty getTemporal();

    @Input
    public abstract Property<Boolean> getSoloContar();

    public SincronizarTarea() {
        getOutputs().upToDateWhen(t -> false);
    }

    @TaskAction
    public void ejecutar() throws IOException {
        String app = getAplicacion().get();
        Path raiz = getRaiz().get().getAsFile().toPath();
        String remota = "/sdcard/Android/data/" + app + "/files/";

        // Copia de trabajo en build/spotfix/: se borra al terminar (solo contiene lo que bajó adb).
        Path base = getTemporal().get().getAsFile().toPath();
        Files.createDirectories(base);
        Path temporal = Files.createTempDirectory(base, "dispositivo-");
        try {
            Resultado bajada = adb("pull", "-a", remota + ".spotfix", temporal.toString());
            Path dispositivo = temporal.resolve(".spotfix");
            if (!bajada.ok() || !Files.isDirectory(dispositivo)) {
                if (bajada.salida().contains("does not exist")) {
                    getLogger().lifecycle("spotfix: el dispositivo aún no tiene notas de " + app
                        + ". Abre la versión debug de la app y guarda una nota.");
                    return;
                }
                throw new GradleException("spotfix: no se pudo leer el dispositivo.\n" + bajada.salida().trim());
            }

            if (getSoloContar().get()) {
                getLogger().lifecycle("spotfix (" + app + "): " + Sincronizar.abiertas(dispositivo.resolve("notas"))
                    + " notas abiertas en el dispositivo, " + Sincronizar.abiertas(Sincronizar.carpetaNotas(raiz))
                    + " en " + mostrar(raiz, Sincronizar.carpetaNotas(raiz)) + ".");
                return;
            }

            Sincronizar.Resultado r = Sincronizar.mezclar(dispositivo, raiz);
            for (Sincronizar.Subida s : r.subidas) {
                Resultado subida = adb("push", s.local().toString(), remota + s.remota());
                if (!subida.ok()) {
                    throw new GradleException("spotfix: no se pudo subir " + s.remota() + "\n" + subida.salida().trim());
                }
            }

            String carpeta = mostrar(raiz, Sincronizar.carpetaNotas(raiz));
            List<String> partes = new ArrayList<>();
            partes.add(r.nuevas.size() + (r.nuevas.size() == 1 ? " nota nueva" : " notas nuevas") + " en " + carpeta);
            if (!r.hechasEnProyecto.isEmpty()) partes.add(r.hechasEnProyecto.size() + " marcadas hechas en el proyecto");
            if (r.hechasEnDispositivo > 0) partes.add(r.hechasEnDispositivo + " marcadas hechas en el dispositivo");
            if (r.configBajada) partes.add("config.json actualizado desde el dispositivo");
            getLogger().lifecycle("spotfix: " + String.join(", ", partes) + ".");
            for (String n : r.nuevas) getLogger().lifecycle("  + " + n);
        } finally {
            borrarTemporal(temporal);
        }
    }

    private record Resultado(boolean ok, String salida) {}

    private Resultado adb(String... args) throws IOException {
        List<String> cmd = new ArrayList<>();
        File adb = getAdb().get().getAsFile();
        cmd.add(adb.exists() ? adb.getAbsolutePath() : "adb");
        cmd.addAll(List.of(args));
        Process p = new ProcessBuilder(cmd).redirectErrorStream(true).start();
        String salida = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        try {
            return new Resultado(p.waitFor() == 0, salida);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new GradleException("spotfix: adb interrumpido", e);
        }
    }

    private static String mostrar(Path raiz, Path p) {
        return p.startsWith(raiz) ? raiz.relativize(p).toString().replace('\\', '/') : p.toString();
    }

    /** Borra la copia de trabajo que creó esta tarea. Files.walk no sigue enlaces. */
    private static void borrarTemporal(Path temporal) throws IOException {
        try (Stream<Path> s = Files.walk(temporal)) {
            for (Path p : (Iterable<Path>) s.sorted(Comparator.reverseOrder())::iterator) {
                Files.deleteIfExists(p);
            }
        }
    }
}
