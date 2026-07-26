package nl.veyocast.player

import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AutomationScheduleEvaluatorTest {
    @Test
    fun `evaluates weekly windows in the configured timezone`() {
        val settings = settings(
            periods = listOf(
                AutomationPeriod(
                    enabled = true,
                    start = LocalTime.of(7, 30),
                    end = LocalTime.of(9, 0),
                    weekday = 1
                )
            )
        )
        assertTrue(
            AutomationScheduleEvaluator.evaluate(
                settings,
                Instant.parse("2026-07-27T06:00:00Z")
            ).active
        )
        assertFalse(
            AutomationScheduleEvaluator.evaluate(
                settings,
                Instant.parse("2026-07-27T08:00:00Z")
            ).active
        )
    }

    @Test
    fun `closed date overrides weekly schedule`() {
        val settings = settings(
            exceptions = listOf(
                AutomationException(
                    date = LocalDate.parse("2026-07-27"),
                    end = null,
                    mode = "closed",
                    start = null
                )
            ),
            periods = listOf(
                AutomationPeriod(
                    enabled = true,
                    start = LocalTime.of(7, 0),
                    end = LocalTime.of(23, 0),
                    weekday = 1
                )
            )
        )
        val evaluation = AutomationScheduleEvaluator.evaluate(
            settings,
            Instant.parse("2026-07-27T10:00:00Z")
        )
        assertFalse(evaluation.active)
        assertEquals("exception_closed", evaluation.reason)
    }

    @Test
    fun `supports cross-midnight windows and finds next activation`() {
        val settings = settings(
            periods = listOf(
                AutomationPeriod(
                    enabled = true,
                    start = LocalTime.of(22, 0),
                    end = LocalTime.of(2, 0),
                    weekday = 5
                )
            )
        )
        assertTrue(
            AutomationScheduleEvaluator.evaluate(
                settings,
                Instant.parse("2026-07-31T23:30:00Z")
            ).active
        )
        assertEquals(
            Instant.parse("2026-08-07T20:00:00Z"),
            AutomationScheduleEvaluator.nextActivationAt(
                settings,
                Instant.parse("2026-08-01T08:00:00Z")
            )
        )
    }

    @Test
    fun `expires stale offline configurations`() {
        val settings = settings(
            cacheValidUntil = Instant.parse("2026-07-27T00:00:00Z"),
            scheduleMode = "always"
        )
        assertEquals(
            "cache_expired",
            AutomationScheduleEvaluator.evaluate(
                settings,
                Instant.parse("2026-07-28T00:00:00Z")
            ).reason
        )
    }

    private fun settings(
        cacheValidUntil: Instant = Instant.parse("2026-09-01T00:00:00Z"),
        exceptions: List<AutomationException> = emptyList(),
        periods: List<AutomationPeriod> = emptyList(),
        scheduleMode: String = "weekly"
    ) = AutomationSettings(
        cacheValidUntil = cacheValidUntil,
        enabled = true,
        exceptions = exceptions,
        hdmiCecEnabled = false,
        keepAwakeEnabled = true,
        localWakeEnabled = true,
        offlineExecutionEnabled = true,
        periods = periods,
        restoreAfterReboot = true,
        revision = 1,
        scheduleMode = scheduleMode,
        screenId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        startupEnabled = true,
        temporaryOverride = "none",
        temporaryOverrideUntil = null,
        timezone = ZoneId.of("Europe/Amsterdam"),
        wakeLeadMinutes = 5
    )
}
