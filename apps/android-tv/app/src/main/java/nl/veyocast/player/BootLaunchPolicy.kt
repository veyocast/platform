package nl.veyocast.player

import android.content.Intent
import java.time.Instant

data class BootLaunchDecision(
    val diagnosticCode: String? = null,
    val shouldLaunch: Boolean,
    val source: String? = null
)

object BootLaunchPolicy {
    fun decide(
        action: String?,
        settings: AutomationSettings?,
        localBootStartEnabled: Boolean,
        networkValidated: Boolean,
        now: Instant
    ): BootLaunchDecision {
        if (
            action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_MY_PACKAGE_REPLACED
        ) {
            return BootLaunchDecision(shouldLaunch = false)
        }

        val scheduledStartActive =
            settings?.enabled == true &&
                settings.startupEnabled &&
                settings.isCacheUsable(now) &&
                AutomationScheduleEvaluator.evaluate(settings, now).active
        val scheduledStartAllowed =
            scheduledStartActive &&
                (settings?.offlineExecutionEnabled == true || networkValidated)

        if (localBootStartEnabled || scheduledStartAllowed) {
            val source = when {
                localBootStartEnabled && scheduledStartAllowed ->
                    "lokale autostartinstelling en automatiseringsschema"
                localBootStartEnabled -> "lokale autostartinstelling"
                else -> "automatiseringsschema"
            }
            return BootLaunchDecision(
                shouldLaunch = true,
                source = source
            )
        }

        if (scheduledStartActive && !networkValidated) {
            return BootLaunchDecision(
                diagnosticCode = "OFFLINE_EXECUTION_DISABLED",
                shouldLaunch = false
            )
        }
        return BootLaunchDecision(shouldLaunch = false)
    }
}
