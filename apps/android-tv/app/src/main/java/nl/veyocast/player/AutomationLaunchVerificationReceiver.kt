package nl.veyocast.player

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.time.Instant

class AutomationLaunchVerificationReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val attemptId =
            intent.getStringExtra(AutomationActivityLauncher.EXTRA_LAUNCH_ATTEMPT_ID)
                ?: return
        val scheduledFor =
            intent.getStringExtra(AutomationAlarmReceiver.EXTRA_SCHEDULED_FOR)
                ?.let { runCatching { Instant.parse(it) }.getOrNull() }
        val source =
            intent.getStringExtra(AutomationLaunchVerifier.EXTRA_SOURCE)
                ?: "onbekende startbron"
        val store = AutomationStore(context)
        if (
            store.failLaunchAttempt(
                attemptId = attemptId,
                commandId = intent.getStringExtra(AutomationAlarmReceiver.EXTRA_COMMAND_ID),
                diagnosticCode = "BACKGROUND_START_NOT_VISIBLE",
                scheduledFor = scheduledFor,
                source = source
            )
        ) {
            AppLog.warning("Android bevestigde de aangevraagde Playerstart niet binnen 30 seconden")
        }
    }
}
