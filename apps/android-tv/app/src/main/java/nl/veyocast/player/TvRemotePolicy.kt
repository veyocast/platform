package nl.veyocast.player

import android.view.KeyEvent

enum class PlaybackCommand {
    TOGGLE,
    PLAY,
    PAUSE,
    SEEK_BACKWARD,
    SEEK_FORWARD
}

data class TvRemoteCommand(
    val playbackCommand: PlaybackCommand,
    val fallbackToWebContent: Boolean
)

object TvRemotePolicy {
    fun commandFor(keyCode: Int): TvRemoteCommand? = when (keyCode) {
        KeyEvent.KEYCODE_DPAD_CENTER,
        KeyEvent.KEYCODE_ENTER -> TvRemoteCommand(PlaybackCommand.TOGGLE, fallbackToWebContent = true)

        KeyEvent.KEYCODE_DPAD_LEFT ->
            TvRemoteCommand(PlaybackCommand.SEEK_BACKWARD, fallbackToWebContent = true)
        KeyEvent.KEYCODE_DPAD_RIGHT ->
            TvRemoteCommand(PlaybackCommand.SEEK_FORWARD, fallbackToWebContent = true)
        KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE ->
            TvRemoteCommand(PlaybackCommand.TOGGLE, fallbackToWebContent = false)
        KeyEvent.KEYCODE_MEDIA_PLAY ->
            TvRemoteCommand(PlaybackCommand.PLAY, fallbackToWebContent = false)
        KeyEvent.KEYCODE_MEDIA_PAUSE,
        KeyEvent.KEYCODE_MEDIA_STOP ->
            TvRemoteCommand(PlaybackCommand.PAUSE, fallbackToWebContent = false)
        KeyEvent.KEYCODE_MEDIA_REWIND ->
            TvRemoteCommand(PlaybackCommand.SEEK_BACKWARD, fallbackToWebContent = false)
        KeyEvent.KEYCODE_MEDIA_FAST_FORWARD ->
            TvRemoteCommand(PlaybackCommand.SEEK_FORWARD, fallbackToWebContent = false)
        else -> null
    }
}
