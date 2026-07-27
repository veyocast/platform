package nl.veyocast.player

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.time.Instant

class AutomationAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val store = AutomationStore(context)
        val scheduledFor = intent.getStringExtra(EXTRA_SCHEDULED_FOR)
            ?.let { runCatching { Instant.parse(it) }.getOrNull() }
        val commandId = intent.getStringExtra(EXTRA_COMMAND_ID)
        val envelope = store.currentEnvelope()
        val settings = envelope?.settings
        if (
            commandId == null &&
            settings?.offlineExecutionEnabled == false &&
            !AutomationNetwork.isValidated(context)
        ) {
            store.enqueueReport(
                eventType = "execution-failed",
                status = "failed",
                diagnosticCode = "OFFLINE_EXECUTION_DISABLED",
                scheduledFor = scheduledFor
            )
            store.recordExecution("OFFLINE_EXECUTION_DISABLED")
            AutomationScheduler(context).apply(
                envelope,
                scheduledFor ?: Instant.now()
            )
            return
        }
        store.enqueueReport(
            eventType = "wake-triggered",
            commandId = commandId,
            scheduledFor = scheduledFor
        )
        store.recordExecution("WAKE_TRIGGERED")
        AutomationActivityLauncher.request(
            context = context,
            source = if (commandId == null) "lokaal automatiseringsalarm" else "Control-testopdracht",
            commandId = commandId,
            scheduledFor = scheduledFor
        )
        AutomationScheduler(context).apply(
            envelope,
            scheduledFor ?: Instant.now()
        )
    }

    companion object {
        const val EXTRA_AUTOMATION_START = "veyocast_automation_start"
        const val EXTRA_COMMAND_ID = "veyocast_automation_command_id"
        const val EXTRA_SCHEDULED_FOR = "veyocast_automation_scheduled_for"
    }
}
