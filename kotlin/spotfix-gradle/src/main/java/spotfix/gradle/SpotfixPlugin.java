package spotfix.gradle;

import com.android.build.api.variant.ApplicationAndroidComponentsExtension;
import com.android.build.api.variant.ApplicationVariant;
import org.gradle.api.Action;
import org.gradle.api.Plugin;
import org.gradle.api.Project;
import org.gradle.api.provider.Property;

/**
 * {@code plugins { id("spotfix") }} en el módulo app. Añade:
 * <ul>
 *   <li>{@code spotfixPull}: trae las notas del dispositivo a .spotfix/ del proyecto y lleva al
 *       dispositivo las que la IA marcó como hechas.</li>
 *   <li>{@code spotfixStatus}: cuántas notas abiertas hay en cada lado, sin cambiar nada.</li>
 * </ul>
 * Usa el adb del SDK y el applicationId de la variante debug ({@code -Pspotfix.app=...} para otro).
 */
public class SpotfixPlugin implements Plugin<Project> {
    @Override
    public void apply(Project project) {
        project.getPlugins().withId("com.android.application", p -> configurar(project));
    }

    private void configurar(Project project) {
        ApplicationAndroidComponentsExtension android =
            project.getExtensions().getByType(ApplicationAndroidComponentsExtension.class);
        Property<String> app = project.getObjects().property(String.class);
        Object forzada = project.findProperty("spotfix.app");
        if (forzada != null) {
            app.set(forzada.toString());
        } else {
            android.onVariants(android.selector().withBuildType("debug"),
                (Action<ApplicationVariant>) v -> app.set(v.getApplicationId()));
        }

        for (boolean soloContar : new boolean[] {false, true}) {
            String nombre = soloContar ? "spotfixStatus" : "spotfixPull";
            project.getTasks().register(nombre, SincronizarTarea.class, t -> {
                t.setGroup("spotfix");
                t.setDescription(soloContar
                    ? "Cuenta las notas de spotfix abiertas en el dispositivo y en el proyecto."
                    : "Trae las notas de spotfix del dispositivo a .spotfix/ y sube los estados 'hecha'.");
                t.getAdb().set(android.getSdkComponents().getAdb());
                t.getAplicacion().set(app);
                t.getRaiz().set(project.getRootDir());
                t.getTemporal().set(project.getLayout().getBuildDirectory().dir("spotfix"));
                t.getSoloContar().set(soloContar);
            });
        }
    }
}
