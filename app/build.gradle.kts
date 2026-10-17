import com.android.build.api.artifact.SingleArtifact
import java.io.ByteArrayOutputStream

plugins {
    id("com.android.application")
}

// versionCode = number of commits, so every CI build installs over the previous one.
fun commitCount(): Int = try {
    val out = ByteArrayOutputStream()
    val p = ProcessBuilder("git", "rev-list", "--count", "HEAD").directory(rootDir).redirectErrorStream(true).start()
    p.inputStream.copyTo(out)
    if (p.waitFor() == 0) out.toString().trim().toInt() else 1
} catch (e: Exception) { 1 }

android {
    namespace = "io.github.rushivangala.margin"
    compileSdk = 36

    defaultConfig {
        applicationId = "io.github.rushivangala.margin"
        minSdk = 33
        targetSdk = 36
        versionCode = commitCount()
        versionName = providers.gradleProperty("appVersionName").get()
    }

    signingConfigs {
        create("release") {
            // CI passes these from repository secrets (see README → Signing).
            val ks = System.getenv("SIGNING_KEYSTORE_FILE")
            if (ks != null && file(ks).exists()) {
                storeFile = file(ks)
                storePassword = System.getenv("SIGNING_STORE_PASSWORD")
                keyAlias = System.getenv("SIGNING_KEY_ALIAS")
                keyPassword = System.getenv("SIGNING_KEY_PASSWORD")
            } else {
                // No secrets: sign with the repository's shared CI key so builds still install and update.
                storeFile = rootProject.file("ci/ci-signing.jks")
                storePassword = "android"
                keyAlias = "ci"
                keyPassword = "android"
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            isShrinkResources = false
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    lint {
        abortOnError = false
        checkReleaseBuilds = true
    }

    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    // Plain JVM tests for the parsers and the reading logic; nothing from AndroidX.
    testImplementation("junit:junit:4.13.2")
}

base {
    archivesName.set("Margin-${providers.gradleProperty("appVersionName").get()}")
}

// ---------------------------------------------------------------- no internet, ever
// Libraries can add android.permission.INTERNET to the merged manifest without anyone noticing.
// This check reads the final merged manifest of every release build and fails the build if it is there.
abstract class CheckNoInternet : DefaultTask() {
    @get:InputFile
    abstract val manifest: RegularFileProperty

    @get:OutputFile
    abstract val report: RegularFileProperty

    @TaskAction
    fun check() {
        val text = manifest.get().asFile.readText()
        val found = Regex("\"android\\.permission\\.INTERNET\"").containsMatchIn(text)
        if (found) throw GradleException("The merged release manifest requests android.permission.INTERNET. Margin must stay offline: find the library that adds it and remove it (or add tools:node=\"remove\").")
        report.get().asFile.writeText("No INTERNET permission in ${manifest.get().asFile}\n")
    }
}

// The JavaScript unit tests (reading logic: positions, text books, recaps, flashcards …) run
// with plain node when it is installed, as on the GitHub runners.
val jsTest = tasks.register<Exec>("jsTest") {
    description = "Runs test/run.js with node"
    workingDir = rootDir
    commandLine("node", "test/run.js")
    onlyIf {
        try {
            ProcessBuilder("node", "--version").start().waitFor() == 0
        } catch (e: Exception) {
            logger.warn("node not found: skipping the JavaScript unit tests")
            false
        }
    }
}

androidComponents {
    onVariants(selector().withBuildType("release")) { variant ->
        val cap = variant.name.replaceFirstChar { it.uppercase() }
        val check = tasks.register<CheckNoInternet>("check${cap}NoInternet") {
            manifest.set(variant.artifacts.get(SingleArtifact.MERGED_MANIFEST))
            report.set(layout.buildDirectory.file("reports/noInternet/${variant.name}.txt"))
        }
        tasks.matching { it.name == "assemble$cap" || it.name == "bundle$cap" }.configureEach {
            dependsOn(check)
            // A release is only built when the unit tests pass.
            dependsOn("test${cap}UnitTest")
            dependsOn(jsTest)
        }
    }
}
