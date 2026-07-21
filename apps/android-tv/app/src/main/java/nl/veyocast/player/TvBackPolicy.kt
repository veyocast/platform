package nl.veyocast.player

enum class TvBackAction {
    HIDE_FULLSCREEN_MEDIA,
    RETURN_TO_ANDROID_TV,
    NAVIGATE_WEB_HISTORY,
    OPEN_MANAGEMENT
}

object TvBackPolicy {
    fun decide(
        customMediaVisible: Boolean,
        managementVisible: Boolean,
        trustedWebHistoryAvailable: Boolean
    ): TvBackAction = when {
        customMediaVisible -> TvBackAction.HIDE_FULLSCREEN_MEDIA
        managementVisible -> TvBackAction.RETURN_TO_ANDROID_TV
        trustedWebHistoryAvailable -> TvBackAction.NAVIGATE_WEB_HISTORY
        else -> TvBackAction.OPEN_MANAGEMENT
    }
}
