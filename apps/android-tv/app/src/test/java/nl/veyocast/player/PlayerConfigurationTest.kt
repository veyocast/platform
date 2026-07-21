package nl.veyocast.player

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PlayerConfigurationTest {
    @Test
    fun `production configuration resolves to production player`() {
        val url = PlayerConfiguration.resolvePlayerUrl(
            configuredUrl = "https://player.veyocast.nl/",
            allowDebugOverride = false,
            debugOverride = "http://10.0.2.2:3001"
        )

        assertEquals("https://player.veyocast.nl", url)
    }

    @Test
    fun `debug override only accepts local development hosts`() {
        assertTrue(PlayerConfiguration.isSafeDebugOverride("http://10.0.2.2:3001"))
        assertTrue(PlayerConfiguration.isSafeDebugOverride("https://localhost:3001"))
        assertFalse(PlayerConfiguration.isSafeDebugOverride("https://example.com"))
        assertFalse(PlayerConfiguration.isSafeDebugOverride("file:///tmp/player.html"))
        assertFalse(PlayerConfiguration.isSafeDebugOverride("javascript:alert(1)"))
    }

    @Test
    fun `current build variant uses an approved environment URL`() {
        when (BuildConfig.ENVIRONMENT) {
            "staging" -> assertEquals("https://staging-player.veyocast.nl", BuildConfig.PLAYER_URL)
            "production" -> assertEquals("https://player.veyocast.nl", BuildConfig.PLAYER_URL)
            else -> throw AssertionError("Onbekende Android TV-omgeving: ${BuildConfig.ENVIRONMENT}")
        }
    }
}
