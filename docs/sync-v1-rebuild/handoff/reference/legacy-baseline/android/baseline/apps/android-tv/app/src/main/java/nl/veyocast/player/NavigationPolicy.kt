package nl.veyocast.player

import java.net.URI

class NavigationPolicy(playerUrl: String) {
    private val root = URI(playerUrl)
    private val rootPath = normalizedPath(root.path)

    fun allowsTopLevelNavigation(candidate: String?): Boolean {
        if (candidate.isNullOrBlank()) return false
        return runCatching {
            val uri = URI(candidate)
            uri.userInfo == null &&
                uri.scheme.equals(root.scheme, ignoreCase = true) &&
                uri.host.equals(root.host, ignoreCase = true) &&
                effectivePort(uri) == effectivePort(root)
        }.getOrDefault(false)
    }

    fun shouldNavigateBack(currentUrl: String?, canGoBack: Boolean): Boolean {
        if (!canGoBack || !allowsTopLevelNavigation(currentUrl)) return false
        val current = runCatching { URI(currentUrl) }.getOrNull() ?: return false
        return normalizedPath(current.path) != rootPath
    }

    fun isPlayerRoot(candidate: String?): Boolean {
        if (!allowsTopLevelNavigation(candidate)) return false
        val uri = runCatching { URI(candidate) }.getOrNull() ?: return false
        return normalizedPath(uri.path) == rootPath
    }

    private fun effectivePort(uri: URI): Int = when {
        uri.port >= 0 -> uri.port
        uri.scheme.equals("https", ignoreCase = true) -> 443
        uri.scheme.equals("http", ignoreCase = true) -> 80
        else -> -1
    }

    private fun normalizedPath(path: String?): String = path.orEmpty().ifBlank { "/" }.trimEnd('/').ifBlank { "/" }
}
