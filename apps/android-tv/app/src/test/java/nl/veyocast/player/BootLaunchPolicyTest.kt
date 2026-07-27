package nl.veyocast.player

import android.content.Intent
import java.time.Instant
import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BootLaunchPolicyTest {
    private val now = Instant.parse("2026-07-28T10:00:00Z")

    @Test
    fun `local physical autostart remains authoritative when server schedule is inactive`() {
        val decision = BootLaunchPolicy.decide(
            action = Intent.ACTION_BOOT_COMPLETED,
            settings = settings(scheduleMode = "weekly"),
            localBootStartEnabled = true,
            networkValidated = false,
            now = now
        )

        assertTrue(decision.shouldLaunch)
        assertEquals("lokale autostartinstelling", decision.source)
        assertNull(decision.diagnosticCode)
    }

    @Test
    fun `normal package replacement attempts the same enabled autostart`() {
        val decision = BootLaunchPolicy.decide(
            action = Intent.ACTION_MY_PACKAGE_REPLACED,
            settings = null,
            localBootStartEnabled = true,
            networkValidated = true,
            now = now
        )

        assertTrue(decision.shouldLaunch)
        assertEquals("lokale autostartinstelling", decision.source)
    }

    @Test
    fun `time change only reschedules and never opens the activity`() {
        val decision = BootLaunchPolicy.decide(
            action = Intent.ACTION_TIME_CHANGED,
            settings = settings(scheduleMode = "always"),
            localBootStartEnabled = true,
            networkValidated = true,
            now = now
        )

        assertFalse(decision.shouldLaunch)
    }

    @Test
    fun `server schedule reports why offline launch is intentionally blocked`() {
        val decision = BootLaunchPolicy.decide(
            action = Intent.ACTION_BOOT_COMPLETED,
            settings = settings(
                offlineExecutionEnabled = false,
                scheduleMode = "always"
            ),
            localBootStartEnabled = false,
            networkValidated = false,
            now = now
        )

        assertFalse(decision.shouldLaunch)
        assertEquals("OFFLINE_EXECUTION_DISABLED", decision.diagnosticCode)
    }

    @Test
    fun `active online server schedule requests a verified launch`() {
        val decision = BootLaunchPolicy.decide(
            action = Intent.ACTION_BOOT_COMPLETED,
            settings = settings(
                offlineExecutionEnabled = false,
                scheduleMode = "always"
            ),
            localBootStartEnabled = false,
            networkValidated = true,
            now = now
        )

        assertTrue(decision.shouldLaunch)
        assertEquals("automatiseringsschema", decision.source)
    }

    private fun settings(
        offlineExecutionEnabled: Boolean = true,
        scheduleMode: String
    ) = AutomationSettings(
        cacheValidUntil = Instant.parse("2026-09-01T00:00:00Z"),
        enabled = true,
        exceptions = emptyList(),
        hdmiCecEnabled = false,
        keepAwakeEnabled = true,
        localWakeEnabled = true,
        offlineExecutionEnabled = offlineExecutionEnabled,
        periods = emptyList(),
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
