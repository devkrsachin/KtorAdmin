package ir.amirroid.ktoradmin.utils

import io.ktor.client.request.get
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.encodeURLParameter
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import ir.amirroid.ktoradmin.configuration.DynamicConfiguration
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class RoutingUtilsTest {
    @Test
    fun `no returnTo gives empty query`() {
        assertEquals("", listQueryFromReturnTo(null))
        assertEquals("", listQueryFromReturnTo(""))
        assertEquals("", listQueryFromReturnTo("?"))
    }

    @Test
    fun `returnTo keeps page, search, filters and ordering`() {
        assertEquals(
            "?page=3&search=hdfc+bank&filters.status=active&order=name&orderDirection=desc",
            listQueryFromReturnTo("?page=3&search=hdfc%20bank&filters.status=active&order=name&orderDirection=desc"),
        )
        // Leading "?" is optional.
        assertEquals("?page=2", listQueryFromReturnTo("page=2"))
    }

    @Test
    fun `returnTo can't change the redirect target`() {
        val attempts =
            listOf(
                "//evil.example.com",
                "https://evil.example.com",
                "?next=//evil.example.com",
                "/../../logout",
                "?page=1%0D%0ALocation:%20https://evil.example.com",
                "?page=1\r\nSet-Cookie: x=1",
                "#fragment",
            )
        for (attempt in attempts) {
            val query = listQueryFromReturnTo(attempt)
            // Only ever empty or a single encoded query string: no path, scheme, host, fragment or line breaks.
            assertTrue(query.isEmpty() || query.startsWith("?"), "'$attempt' -> '$query'")
            assertFalse(query.drop(1).any { it in "/:?#\r\n " }, "'$attempt' -> '$query'")
        }
    }

    @Test
    fun `respondBack returns to the list view from returnTo`() =
        testApplication {
            routing {
                get("/save") { call.respondBack("banks") }
            }
            val client = createClient { followRedirects = false }
            val listUrl = "/${DynamicConfiguration.adminPath}/${Constants.RESOURCES_PATH}/banks"

            val withState = client.get("/save?returnTo=" + "?page=3&filters.status=active".encodeURLParameter())
            assertEquals(HttpStatusCode.Found, withState.status)
            assertEquals("$listUrl?page=3&filters.status=active", withState.headers[HttpHeaders.Location])

            val withoutState = client.get("/save")
            assertEquals(listUrl, withoutState.headers[HttpHeaders.Location])
        }
}
