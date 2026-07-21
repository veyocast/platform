package nl.veyocast.player

import java.net.URI

object PlayerConfiguration {
    const val DEBUG_URL_EXTRA = "veyocast_player_url"

    private val debugHosts = setOf("10.0.2.2", "127.0.0.1", "localhost")

    fun resolvePlayerUrl(
        configuredUrl: String,
        allowDebugOverride: Boolean,
        debugOverride: String?
    ): String {
        val canonicalUrl = normalize(configuredUrl)
        if (!allowDebugOverride || debugOverride.isNullOrBlank()) return canonicalUrl
        return if (isSafeDebugOverride(debugOverride)) normalize(debugOverride) else canonicalUrl
    }

    fun isSafeDebugOverride(candidate: String): Boolean = runCatching {
        val uri = URI(candidate)
        val schemeAllowed = uri.scheme.equals("http", ignoreCase = true) ||
            uri.scheme.equals("https", ignoreCase = true)
        schemeAllowed &&
            uri.userInfo == null &&
            uri.host?.lowercase() in debugHosts &&
            uri.fragment == null
    }.getOrDefault(false)

    private fun normalize(url: String): String = url.trim().trimEnd('/')
}
