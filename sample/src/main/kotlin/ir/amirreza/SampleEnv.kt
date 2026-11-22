package ir.amirreza

/**
 * Connection settings for the sample app, read from environment variables.
 * Defaults match upstream's original hardcoded values.
 *
 * - DB_URL, DB_USER, DB_PASSWORD: PostgreSQL connection
 * - MONGO_HOST, MONGO_PORT, MONGO_USER, MONGO_PASSWORD, MONGO_AUTH_DB, MONGO_DB:
 *   MongoDB connection; Mongo is only registered when MONGO_HOST is set.
 */
object SampleEnv {
    private fun env(name: String, default: String) = System.getenv(name)?.takeIf { it.isNotBlank() } ?: default

    val dbUrl = env("DB_URL", "jdbc:postgresql://localhost:5432/postgres")
    val dbUser = env("DB_USER", "amirreza")
    val dbPassword = env("DB_PASSWORD", "your_password")

    val mongoHost: String? = System.getenv("MONGO_HOST")?.takeIf { it.isNotBlank() }
    val mongoPort = env("MONGO_PORT", "27017").toInt()
    val mongoUser = env("MONGO_USER", "amirreza")
    val mongoPassword = env("MONGO_PASSWORD", "your_password")
    val mongoAuthDb = env("MONGO_AUTH_DB", "admin")
    val mongoDb = env("MONGO_DB", "0@localhost")
}
