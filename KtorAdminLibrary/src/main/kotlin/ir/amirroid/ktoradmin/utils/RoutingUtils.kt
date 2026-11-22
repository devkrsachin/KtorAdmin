package ir.amirroid.ktoradmin.utils

import io.ktor.http.formUrlEncode
import io.ktor.http.parseQueryString
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respondRedirect
import ir.amirroid.ktoradmin.configuration.DynamicConfiguration

/**
 * Query parameter the list page passes to the add/edit pages with its own query string
 * (page, search, filters, ordering), so saving returns to the same list view.
 */
internal const val RETURN_TO_PARAM = "returnTo"

suspend fun ApplicationCall.respondBack(pluralName: String?) {
    respondRedirect(
        "/${DynamicConfiguration.adminPath}/${Constants.RESOURCES_PATH}/${pluralName.orEmpty()}" +
            listQueryFromReturnTo(request.queryParameters[RETURN_TO_PARAM]),
    )
}

/**
 * Turns a `returnTo` value (the list page's query string, e.g. `?page=3&filters.status=active`)
 * into a query string to append to the list URL, or "" if there is none.
 *
 * It's re-encoded from parsed parameters, so only a query string can come out of it; the path
 * stays fixed, which rules out open redirects.
 */
internal fun listQueryFromReturnTo(returnTo: String?): String {
    if (returnTo.isNullOrBlank()) return ""
    val encoded = parseQueryString(returnTo.removePrefix("?")).formUrlEncode()
    return if (encoded.isEmpty()) "" else "?$encoded"
}
