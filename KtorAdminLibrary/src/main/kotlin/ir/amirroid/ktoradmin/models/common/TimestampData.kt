package ir.amirroid.ktoradmin.models.common

/**
 * A timestamp cell in the list view.
 *
 * [isoInstant] is the UTC instant (ISO-8601, e.g. `2026-11-22T05:02:11Z`) that the browser
 * converts to the viewer's local time zone. [display] is the server-formatted fallback,
 * used when JavaScript is unavailable and wherever the value is rendered as plain text.
 */
internal data class TimestampData(
    val isoInstant: String,
    val display: String,
) {
    override fun toString(): String = display
}
