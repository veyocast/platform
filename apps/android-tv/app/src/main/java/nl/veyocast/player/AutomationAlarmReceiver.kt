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
        store.enqueueReport(
            eventType = "wake-triggered",
            commandId = commandId,
            scheduledFor = scheduledFor
        )
        store.recordExecution("WAKE_TRIGGERED")
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra(EXTRA_AUTOMATION_START, true)
            putExtra(EXTRA_COMMAND_ID, commandId)
            putExtra(EXTRA_SCHEDULED_FOR, scheduledFor?.toString())
        }
        runCatching { context.startActivity(launchIntent) }
            .onSuccess {
                store.enqueueReport(
                    eventType = "activity-start-requested",
                    commandId = commandId,
                    scheduledFor = scheduledFor
                )
                store.recordExecution("ACTIVITY_START_REQUESTED")
            }
            .onFailure {
                store.enqueueReport(
                    eventType = "execution-failed",
                    status = "failed",
                    commandId = commandId,
                    diagnosticCode = "BACKGROUND_START_BLOCKED",
                    scheduledFor = scheduledFor
                )
                store.recordExecution("BACKGROUND_START_BLOCKED")
            }
        AutomationScheduler(context).apply(
            store.currentEnvelope(),
            scheduledFor ?: Instant.now()
        )
    }

    companion object {
        const val EXTRA_AUTOMATION_START = "veyocast_automation_start"
        const val EXTRA_COMMAND_ID = "veyocast_automation_command_id"
        const val EXTRA_SCHEDULED_FOR = "veyocast_automation_scheduled_for"
    }
}
