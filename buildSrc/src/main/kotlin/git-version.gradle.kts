fun resolveVersionFromGit(): String {
    return try {
        val process = ProcessBuilder(
            "git", "describe", "--tags", "--always", "--dirty"
        )
            .directory(rootProject.projectDir)
            .start()

        val output = process.inputStream.bufferedReader().readText().trim()
        val error = process.errorStream.bufferedReader().readText().trim()
        val exitCode = process.waitFor()

        if (exitCode != 0 || output.isEmpty()) {
            logger.warn("git describe failed (exit=$exitCode): $error")
            "0.0.0"
        } else {
            // Drop "-dirty" and the "-<commits>-g<sha>" part git describe adds after the tag,
            // keeping a pre-release suffix from the tag itself (e.g. "1.6.1-ezymoney.1").
            val cleaned = output
                .removePrefix("v")
                .removeSuffix("-dirty")
                .replace(Regex("-\\d+-g[0-9a-f]+$"), "")
            val versionRegex = Regex("^\\d+\\.\\d+\\.\\d+(-[0-9A-Za-z.]+)?$")
            val match = versionRegex.find(cleaned)

            if (match == null) {
                logger.warn("Could not extract semantic version from git describe output: $cleaned")
                "0.0.0"
            } else {
                match.value
            }
        }
    } catch (ex: Exception) {
        logger.warn("git describe threw: ${ex.message}")
        "0.0.0"
    }
}

version = resolveVersionFromGit()
