plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.skyspeak.hindiflashcards"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.skyspeak.hindiflashcards"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Self-signed: reuses the debug key so the release APK is sideloadable as-is.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}

// Bundle the web app (../../web) into the APK's assets so it runs offline.
val copyWeb by tasks.registering(Sync::class) {
    from(rootProject.file("../web"))
    into(layout.projectDirectory.dir("src/main/assets/www"))
}
tasks.named("preBuild") { dependsOn(copyWeb) }
