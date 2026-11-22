
plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.ksp)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.maven.publish)
    alias(libs.plugins.ktlint)
    alias(libs.plugins.binary.compatibility.validator)
}

group = "io.github.devkrsachin"

val projectName = "KtorAdmin"

java {
    toolchain {
        languageVersion.set(
            JavaLanguageVersion.of(
                libs.versions.javaV
                    .map { it.toInt() }
                    .get(),
            ),
        )
    }
}

mavenPublishing {
    publishToMavenCentral()
    signAllPublications()

    coordinates(
        groupId = group.toString(),
        artifactId = projectName,
        version = version.toString(),
    )

    pom {
        name = projectName
        description =
            "Fork of KtorAdmin (github.com/Amirroid/KtorAdmin), a dynamic admin panel for Ktor applications, with additional fixes and improvements."
        inceptionYear = "2025"
        url = "https://github.com/devkrsachin/KtorAdmin"
        licenses {
            license {
                name = "The MIT License"
                url = "https://opensource.org/licenses/MIT"
                distribution = "https://opensource.org/licenses/MIT"
            }
        }
        developers {
            developer {
                id = "Amirroid"
                name = "Amirreza Gholami"
                url = "https://github.com/Amirroid"
            }
            developer {
                id = "devkrsachin"
                name = "Sachin"
                url = "https://github.com/devkrsachin"
            }
        }
        scm {
            url = "https://github.com/devkrsachin/KtorAdmin"
            connection = "scm:git:git://github.com/devkrsachin/KtorAdmin.git"
            developerConnection = "scm:git:ssh://git@github.com/devkrsachin/KtorAdmin.git"
        }
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation(kotlin("reflect"))

    testImplementation(kotlin("test"))
    testImplementation(libs.ktor.server.test.host)
    testImplementation(libs.ktor.server.sessions)
    testImplementation(libs.ktor.server.content.negotiation)
    testImplementation(libs.ktor.serialization.json)
    testImplementation(libs.h2)

    implementation(libs.ksp.api)

    implementation(libs.kotlinpoet)
    implementation(libs.kotlinpoet.ksp)

    implementation(libs.reflections)

    implementation(libs.ktor.server.core)
    implementation(libs.ktor.server.velocity)

    implementation(libs.kotlin.jdbc)
    implementation(libs.hikari)

    implementation(libs.aws.s3)

    implementation(libs.ktor.server.auth)

    implementation(libs.mongodb.coroutine)

    implementation(libs.ktor.server.rate.limit)

    implementation(libs.itext.core)
}

tasks.test {
    useJUnitPlatform()
}

ktlint {
    filter {
        exclude("**/generated/**")
        exclude("**/build/**")
    }
}
