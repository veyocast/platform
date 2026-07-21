package nl.veyocast.player

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class NavigationPolicyTest {
    private val policy = NavigationPolicy("https://player.veyocast.nl")

    @Test
    fun `same origin player routes are allowed`() {
        assertTrue(policy.allowsTopLevelNavigation("https://player.veyocast.nl/"))
        assertTrue(policy.allowsTopLevelNavigation("https://player.veyocast.nl/device-lab?mode=check"))
    }

    @Test
    fun `external insecure and deceptive origins are blocked`() {
        assertFalse(policy.allowsTopLevelNavigation("https://example.com"))
        assertFalse(policy.allowsTopLevelNavigation("http://player.veyocast.nl"))
        assertFalse(policy.allowsTopLevelNavigation("https://player.veyocast.nl.evil.example"))
        assertFalse(policy.allowsTopLevelNavigation("javascript:alert(1)"))
        assertFalse(policy.allowsTopLevelNavigation("file:///tmp/player.html"))
    }

    @Test
    fun `back navigation never leaves the player root in an unusable state`() {
        assertFalse(policy.shouldNavigateBack("https://player.veyocast.nl/", canGoBack = true))
        assertFalse(policy.shouldNavigateBack("https://player.veyocast.nl/?deviceToken=temporary", canGoBack = true))
        assertFalse(policy.shouldNavigateBack("https://example.com/page", canGoBack = true))
        assertFalse(policy.shouldNavigateBack("https://player.veyocast.nl/page", canGoBack = false))
        assertTrue(policy.shouldNavigateBack("https://player.veyocast.nl/device-lab", canGoBack = true))
    }

    @Test
    fun `root recognition does not classify api and media paths as the main page`() {
        assertTrue(policy.isPlayerRoot("https://player.veyocast.nl/"))
        assertTrue(policy.isPlayerRoot("https://player.veyocast.nl/?source=tv"))
        assertFalse(policy.isPlayerRoot("https://player.veyocast.nl/api/player/manifest"))
        assertFalse(policy.isPlayerRoot("https://media.example/video.mp4"))
    }
}
