package nl.veyocast.player

import android.view.KeyEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TvInteractionPolicyTest {
    @Test
    fun `back reaches Android TV through the management surface`() {
        assertEquals(
            TvBackAction.OPEN_MANAGEMENT,
            TvBackPolicy.decide(
                customMediaVisible = false,
                managementVisible = false,
                trustedWebHistoryAvailable = false
            )
        )
        assertEquals(
            TvBackAction.RETURN_TO_ANDROID_TV,
            TvBackPolicy.decide(
                customMediaVisible = false,
                managementVisible = true,
                trustedWebHistoryAvailable = false
            )
        )
    }

    @Test
    fun `trusted web history and fullscreen media are handled before management`() {
        assertEquals(
            TvBackAction.HIDE_FULLSCREEN_MEDIA,
            TvBackPolicy.decide(true, managementVisible = true, trustedWebHistoryAvailable = true)
        )
        assertEquals(
            TvBackAction.NAVIGATE_WEB_HISTORY,
            TvBackPolicy.decide(false, managementVisible = false, trustedWebHistoryAvailable = true)
        )
    }

    @Test
    fun `dpad media controls preserve web fallback while hardware media keys do not`() {
        val center = TvRemotePolicy.commandFor(KeyEvent.KEYCODE_DPAD_CENTER)
        assertEquals(PlaybackCommand.TOGGLE, center?.playbackCommand)
        assertTrue(center?.fallbackToWebContent == true)

        val seek = TvRemotePolicy.commandFor(KeyEvent.KEYCODE_DPAD_RIGHT)
        assertEquals(PlaybackCommand.SEEK_FORWARD, seek?.playbackCommand)
        assertTrue(seek?.fallbackToWebContent == true)

        val mediaPause = TvRemotePolicy.commandFor(KeyEvent.KEYCODE_MEDIA_PAUSE)
        assertEquals(PlaybackCommand.PAUSE, mediaPause?.playbackCommand)
        assertFalse(mediaPause?.fallbackToWebContent ?: true)
        assertNull(TvRemotePolicy.commandFor(KeyEvent.KEYCODE_VOLUME_UP))
    }
}
