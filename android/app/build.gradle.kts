plugins {
    id("com.android.application") version "8.9.2"
}

android {
    namespace = "space.heisei.fukuokafootsteps"
    compileSdk = 36
    buildToolsVersion = "36.0.0"

    defaultConfig {
        applicationId = "space.heisei.fukuokafootsteps"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }
    sourceSets.named("main") {
        assets.srcDir("../../dist")
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    testImplementation("junit:junit:4.13.2")
}
