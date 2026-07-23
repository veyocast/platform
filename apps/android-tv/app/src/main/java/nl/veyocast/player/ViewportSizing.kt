package nl.veyocast.player

import kotlin.math.min
import kotlin.math.roundToInt

object ViewportSizing {
    const val WEBVIEW_INITIAL_SCALE_PERCENT = 0

    fun managementPanelWidth(viewportWidthPx: Int, density: Float): Int =
        boundedWidth(viewportWidthPx, density, preferredWidthDp = 420, marginDp = 24)

    fun errorCardWidth(viewportWidthPx: Int, density: Float): Int =
        boundedWidth(viewportWidthPx, density, preferredWidthDp = 560, marginDp = 24)

    private fun boundedWidth(
        viewportWidthPx: Int,
        density: Float,
        preferredWidthDp: Int,
        marginDp: Int
    ): Int {
        val safeDensity = density.takeIf { it.isFinite() && it > 0f } ?: 1f
        val preferredWidth = (preferredWidthDp * safeDensity).roundToInt()
        val horizontalMargin = (marginDp * safeDensity).roundToInt()
        val availableWidth = (viewportWidthPx - (horizontalMargin * 2)).coerceAtLeast(1)
        return min(preferredWidth, availableWidth)
    }
}
