package nl.veyocast.player

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RetryPolicyTest {
    @Test
    fun `retry delay backs off and remains bounded`() {
        val policy = RetryPolicy(baseDelayMs = 1_000, maximumDelayMs = 30_000)

        assertEquals(listOf(1_000L, 2_000L, 4_000L, 8_000L, 16_000L, 30_000L, 30_000L),
            List(7) { policy.nextDelayMs() })

        policy.reset()
        assertEquals(1_000L, policy.nextDelayMs())
    }

    @Test
    fun `renderer recovery stops after repeated crashes inside window`() {
        var now = 1_000L
        val guard = CrashLoopGuard(clock = { now }, windowMs = 60_000, maximumRecoveries = 3)

        assertTrue(guard.allowRecovery())
        assertTrue(guard.allowRecovery())
        assertTrue(guard.allowRecovery())
        assertFalse(guard.allowRecovery())

        now += 60_001
        assertTrue(guard.allowRecovery())
    }
}
