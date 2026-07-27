package nl.veyocast.player

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NativeRecoveryIdentityTest {
    @Test
    fun `credential is stable for the same official app installation`() {
        val first = NativeRecoveryIdentity.deriveCredential(
            androidId = "0123456789abcdef",
            applicationId = "nl.veyocast.player",
            environment = "production"
        )
        val second = NativeRecoveryIdentity.deriveCredential(
            androidId = "0123456789ABCDEF",
            applicationId = "nl.veyocast.player",
            environment = "production"
        )

        assertEquals(first, second)
        assertTrue(first?.matches(Regex("^[a-f0-9]{64}$")) == true)
    }

    @Test
    fun `credential is isolated by app and environment`() {
        val production = credential("nl.veyocast.player", "production")
        val staging = credential("nl.veyocast.player.staging", "staging")

        assertFalse(production == staging)
    }

    @Test
    fun `malformed platform identity is rejected`() {
        assertNull(
            NativeRecoveryIdentity.deriveCredential(
                androidId = null,
                applicationId = "nl.veyocast.player",
                environment = "production"
            )
        )
        assertNull(
            NativeRecoveryIdentity.deriveCredential(
                androidId = "not-an-android-id",
                applicationId = "nl.veyocast.player",
                environment = "production"
            )
        )
    }

    @Test
    fun `production cookie is http only strict and secure`() {
        val cookie = NativeRecoveryIdentity.cookie(
            credential = credential("nl.veyocast.player", "production"),
            secure = true
        )

        assertTrue(cookie.startsWith("${NativeRecoveryIdentity.COOKIE_NAME}="))
        assertTrue(cookie.contains("; Path=/"))
        assertTrue(cookie.contains("; HttpOnly"))
        assertTrue(cookie.contains("; SameSite=Strict"))
        assertTrue(cookie.endsWith("; Secure"))
    }

    private fun credential(applicationId: String, environment: String) =
        requireNotNull(
            NativeRecoveryIdentity.deriveCredential(
                androidId = "0123456789abcdef",
                applicationId = applicationId,
                environment = environment
            )
        )
}
