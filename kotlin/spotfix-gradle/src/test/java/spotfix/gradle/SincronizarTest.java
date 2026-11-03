package spotfix.gradle;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class SincronizarTest {
    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    private static String nota(String estado, String plataforma, String fuente) {
        return "---\nid: \"x\"\nfecha: \"2026-10-24T15:32:10-05:00\"\ntipo: \"bug\"\nestado: \"" + estado
            + "\"\nplataforma: \"" + plataforma + "\"\nseccion: \"Main\"\nfuente: \"" + fuente
            + "\"\ncapturas: [\"img/a_1.png\"]\n---\n\nTexto con estado: \"abierta\" dentro\n";
    }

    private static void escribir(Path p, String texto) throws IOException {
        Files.createDirectories(p.getParent());
        Files.writeString(p, texto);
    }

    @Test
    public void copiaNotasNuevasConCapturasYResuelveLaFuente() throws IOException {
        Path disp = tmp.newFolder("disp").toPath();
        Path raiz = tmp.newFolder("proyecto").toPath();
        escribir(raiz.resolve("app/src/main/java/com/ej/Main.kt"), "package com.ej");
        escribir(disp.resolve("notas/2026-10-24/a.md"), nota("abierta", "android", "com/ej/Main.kt:42"));
        escribir(disp.resolve("notas/2026-10-24/img/a_1.png"), "png");
        escribir(disp.resolve("notas/2026-10-24/img/a-2_1.png"), "otra nota");
        escribir(disp.resolve("LEEME-IA.md"), "leeme");

        Sincronizar.Resultado r = Sincronizar.mezclar(disp, raiz);

        Path pc = raiz.resolve(".spotfix/notas/2026-10-24/a.md");
        assertEquals(1, r.nuevas.size());
        assertTrue(Files.readString(pc).contains("fuente: \"app/src/main/java/com/ej/Main.kt:42\""));
        assertTrue(Files.exists(raiz.resolve(".spotfix/notas/2026-10-24/img/a_1.png")));
        assertFalse(Files.exists(raiz.resolve(".spotfix/notas/2026-10-24/img/a-2_1.png")));
        assertTrue(Files.exists(raiz.resolve(".spotfix/LEEME-IA.md")));
        assertTrue(r.subidas.isEmpty());
    }

    @Test
    public void ganaHechaEnLosDosSentidos() throws IOException {
        Path disp = tmp.newFolder("disp").toPath();
        Path raiz = tmp.newFolder("proyecto").toPath();
        escribir(disp.resolve("notas/2026-10-24/a.md"), nota("hecha", "android", "a.kt:1"));
        escribir(raiz.resolve(".spotfix/notas/2026-10-24/a.md"), nota("abierta", "android", "a.kt:1"));
        escribir(disp.resolve("notas/2026-10-24/b.md"), nota("abierta", "android", "a.kt:1"));
        escribir(raiz.resolve(".spotfix/notas/2026-10-24/b.md"), nota("hecha", "android", "a.kt:1"));

        Sincronizar.Resultado r = Sincronizar.mezclar(disp, raiz);

        String a = Files.readString(raiz.resolve(".spotfix/notas/2026-10-24/a.md"));
        assertEquals("hecha", Sincronizar.estado(a));
        // Solo cambia la cabecera, no el texto del usuario.
        assertTrue(a.contains("Texto con estado: \"abierta\" dentro"));
        assertEquals(1, r.hechasEnProyecto.size());
        assertEquals(1, r.hechasEnDispositivo);
        assertEquals(".spotfix/notas/2026-10-24/b.md", r.subidas.get(0).remota());
    }

    @Test
    public void respetaLaCarpetaDeConfigYElConfigMasReciente() throws IOException {
        Path disp = tmp.newFolder("disp").toPath();
        Path raiz = tmp.newFolder("proyecto").toPath();
        escribir(raiz.resolve(".spotfix/config.json"), "{ \"carpeta\": \"docs/notas\", \"enabled\": true }\n");
        escribir(disp.resolve("config.json"), "{ \"carpeta\": \"docs/notas\", \"tema\": \"oscuro\" }\n");
        Files.setLastModifiedTime(raiz.resolve(".spotfix/config.json"), FileTime.fromMillis(1_000));
        escribir(disp.resolve("notas/2026-10-24/a.md"), nota("abierta", "android", "a.kt:1"));

        Sincronizar.Resultado r = Sincronizar.mezclar(disp, raiz);

        assertTrue(r.configBajada);
        assertTrue(Files.readString(raiz.resolve(".spotfix/config.json")).contains("oscuro"));
        assertTrue(Files.exists(raiz.resolve("docs/notas/2026-10-24/a.md")));
        assertEquals(1, Sincronizar.abiertas(raiz.resolve("docs/notas")));
    }

    @Test
    public void subeNotasDeAndroidQueElDispositivoPerdio() throws IOException {
        Path disp = tmp.newFolder("disp").toPath();
        Path raiz = tmp.newFolder("proyecto").toPath();
        escribir(raiz.resolve(".spotfix/notas/2026-10-24/a.md"), nota("abierta", "android", "a.kt:1"));
        escribir(raiz.resolve(".spotfix/notas/2026-10-24/web.md"), nota("abierta", "next", "a.kt:1"));

        Sincronizar.Resultado r = Sincronizar.mezclar(disp, raiz);

        assertEquals(1, r.subidas.size());
        assertEquals(".spotfix/notas/2026-10-24/a.md", r.subidas.get(0).remota());
    }

    @Test
    public void fuenteAmbiguaSeDejaIgual() throws IOException {
        Path raiz = tmp.newFolder("proyecto").toPath();
        escribir(raiz.resolve("a/src/main/java/com/ej/Main.kt"), "");
        escribir(raiz.resolve("b/src/main/java/com/ej/Main.kt"), "");
        escribir(raiz.resolve("build/generated/com/ej/Otro.kt"), "");
        var indice = Sincronizar.indiceFuentes(raiz);
        assertEquals(null, Sincronizar.resolverFuente("com/ej/Main.kt", indice));
        assertEquals(null, Sincronizar.resolverFuente("com/ej/Otro.kt", indice));
    }
}
