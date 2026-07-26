package nl.veyocast.player

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import java.time.Instant

class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action !in supportedActions) return
        val store = AutomationStore(context)
        val envelope = store.currentEnvelope()
        val settings = envelope?.settings
        if (settings?.restoreAfterReboot == true) {
            AutomationScheduler(context).apply(envelope)
            store.enqueueReport(
                eventType = "schedule-evaluated",
                metadata = mapOf("source" to (intent.action ?: "unknown"))
            )
        }
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        if (settings != null) {
            if (
                settings.startupEnabled &&
                settings.isCacheUsable(Instant.now()) &&
                AutomationScheduleEvaluator.evaluate(settings, Instant.now()).active
            ) {
                if (
                    settings.offlineExecutionEnabled ||
                    AutomationNetwork.isValidated(context)
                ) {
                    attemptActivityStart(context, "automatiseringsschema")
                } else {
                    store.enqueueReport(
                        eventType = "execution-failed",
                        status = "failed",
                        diagnosticCode = "OFFLINE_EXECUTION_DISABLED",
                        metadata = mapOf("source" to "boot")
                    )
                }
            }
            return
        }
        val preferences = AppPreferences(context)
        if (!preferences.bootStartEnabled || !preferences.mayAttemptBootStart()) return
        attemptActivityStart(context, "lokale autostartinstelling")
    }

    private fun attemptActivityStart(context: Context, source: String) {
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra(EXTRA_STARTED_AFTER_BOOT, true)
            putExtra(AutomationAlarmReceiver.EXTRA_AUTOMATION_START, true)
        }
        runCatching { context.startActivity(launchIntent) }
            .onSuccess { AppLog.info("Best-effort autostart aangevraagd via $source") }
            .onFailure {
                AutomationStore(context).enqueueReport(
                    eventType = "execution-failed",
                    status = "failed",
                    diagnosticCode = "BOOT_START_BLOCKED",
                    metadata = mapOf("source" to source)
                )
                AppLog.warning("Android heeft autostart na boot niet toegestaan")
            }
    }

    companion object {
        const val EXTRA_STARTED_AFTER_BOOT = "veyocast_started_after_boot"
        private val supportedActions = setOf(
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED
        )
    }
}
