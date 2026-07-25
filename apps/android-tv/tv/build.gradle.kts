import java.util.Properties

plugins {
    id("com.android.application")
}

val signingPropertiesFile = rootProject.file("keystore.properties")
val signingProperties = Properties().apply {
    if (signingPropertiesFile.isFile) {
        signingPropertiesFile.inputStream().use(::load)
    }
}

val configuredVersionCode = providers.gradleProperty("veyocastTvVersionCode")
    .orElse(providers.environmentVariable("VEYCAST_TV_VERSION_CODE"))
    .orElse("200000001")
    .get()
    .toIntOrNull()
    ?.takeIf { it in 200_000_000..299_999_999 }
    ?: throw GradleException(
        "veyocastTvVersionCode moet voor de Android TV Play-release tussen 200000000 en 299999999 liggen"
    )
val configuredVersionName = providers.gradleProperty("veyocastTvVersionName")
    .orElse(providers.environmentVariable("VEYCAST_TV_VERSION_NAME"))
    .orElse("1.0.0")
    .get()
    .trim()
    .takeIf { it.isNotEmpty() && it.length <= 100 }
    ?: throw GradleException("veyocastTvVersionName moet 1 tot en met 100 tekens bevatten")

fun signingValue(environmentName: String, propertyName: String): String? =
    providers.environmentVariable(environmentName).orNull?.trim()?.takeIf(String::isNotEmpty)
        ?: signingProperties.getProperty(propertyName)?.trim()?.takeIf(String::isNotEmpty)

val releaseStoreFilePath = signingValue("ANDROID_SIGNING_STORE_FILE", "storeFile")
val releaseStorePassword = signingValue("ANDROID_SIGNING_STORE_PASSWORD", "storePassword")
val releaseKeyAlias = signingValue("ANDROID_SIGNING_KEY_ALIAS", "keyAlias")
val releaseKeyPassword = signingValue("ANDROID_SIGNING_KEY_PASSWORD", "keyPassword")
val releaseSigningValues = listOf(
    releaseStoreFilePath,
    releaseStorePassword,
    releaseKeyAlias,
    releaseKeyPassword
)
val releaseSigningConfigured = releaseSigningValues.all { it != null }

if (!releaseSigningConfigured && releaseSigningValues.any { it != null }) {
    throw GradleException(
        "Android TV release signing is gedeeltelijk geconfigureerd; vul storebestand, beide wachtwoorden en alias in"
    )
}

android {
    namespace = "nl.veyocast.player"
    compileSdk {
        version = release(37) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        applicationId = "nl.veyocast.player"
        minSdk = 26
        targetSdk = 37
        versionCode = configuredVersionCode
        versionName = configuredVersionName
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        manifestPlaceholders["usesCleartextTraffic"] = "false"
    }

    flavorDimensions += "environment"
    productFlavors {
        create("staging") {
            dimension = "environment"
            applicationIdSuffix = ".staging"
            versionNameSuffix = "-staging"
            resValue("string", "app_name", "VeyoCast Player Staging (TV)")
            buildConfigField("String", "ENVIRONMENT", "\"staging\"")
            buildConfigField("String", "PLAYER_URL", "\"https://staging-player.veyocast.nl\"")
            buildConfigField("boolean", "BOOT_START_DEFAULT", "false")
            buildConfigField("boolean", "DEMO_MENU_ENABLED", "true")
        }
        create("production") {
            dimension = "environment"
            resValue("string", "app_name", "VeyoCast Player")
            buildConfigField("String", "ENVIRONMENT", "\"production\"")
            buildConfigField("String", "PLAYER_URL", "\"https://player.veyocast.nl\"")
            buildConfigField("boolean", "BOOT_START_DEFAULT", "false")
            buildConfigField("boolean", "DEMO_MENU_ENABLED", "false")
        }
    }

    signingConfigs {
        if (releaseSigningConfigured) {
            create("release") {
                storeFile = rootProject.file(requireNotNull(releaseStoreFilePath))
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            isMinifyEnabled = false
            manifestPlaceholders["usesCleartextTraffic"] = "true"
            buildConfigField("boolean", "ALLOW_DEBUG_URL_OVERRIDE", "true")
            buildConfigField("boolean", "WEBVIEW_DEBUGGING", "true")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "../app/proguard-rules.pro"
            )
            signingConfig = signingConfigs.findByName("release")
            buildConfigField("boolean", "ALLOW_DEBUG_URL_OVERRIDE", "false")
            buildConfigField("boolean", "WEBVIEW_DEBUGGING", "false")
        }
    }

    buildFeatures {
        buildConfig = true
        resValues = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets {
        getByName("main") {
            java.srcDirs("../app/src/main/java")
            res.srcDirs("../app/src/main/res")
        }
        getByName("test") {
            java.srcDirs("../app/src/test/java")
        }
    }

    testOptions {
        unitTests.isIncludeAndroidResources = true
    }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.13.0")
    implementation("androidx.core:core-ktx:1.19.0")

    testImplementation("junit:junit:4.13.2")
}
