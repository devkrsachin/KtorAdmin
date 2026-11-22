package ir.amirreza

import io.ktor.server.application.*
import org.jetbrains.exposed.v1.jdbc.Database

fun main(args: Array<String>): Unit = io.ktor.server.netty.EngineMain.main(args)


fun Application.module() {
    val database =
        Database.connect(
            url = SampleEnv.dbUrl,
            user = SampleEnv.dbUser,
            driver = "org.postgresql.Driver",
            password = SampleEnv.dbPassword,
        )
    configureSecurity()
    configureSerialization()
    configureTemplating()
    configureRouting(database)
    configureAdmin(database)
    monitor.subscribe(ApplicationStopping) {
        HibernateUtil.closeSession()
    }
}
