package nl.veyocast.player

import kotlin.math.min

class RetryPolicy(
    private val baseDelayMs: Long = 1_000,
    private val maximumDelayMs: Long = 30_000
) {
    private var attempts = 0

    fun nextDelayMs(): Long {
        val exponent = min(attempts, 20)
        attempts += 1
        val multiplier = 1L shl exponent
        return min(maximumDelayMs, baseDelayMs * multiplier)
    }

    fun reset() {
        attempts = 0
    }
}

class CrashLoopGuard(
    private val clock: () -> Long = { System.currentTimeMillis() },
    private val windowMs: Long = 5 * 60_000,
    private val maximumRecoveries: Int = 3
) {
    private val crashes = ArrayDeque<Long>()

    fun allowRecovery(): Boolean {
        val now = clock()
        while (crashes.firstOrNull()?.let { now - it > windowMs } == true) {
            crashes.removeFirst()
        }
        if (crashes.size >= maximumRecoveries) return false
        crashes.addLast(now)
        return true
    }

    fun reset() {
        crashes.clear()
    }
}
