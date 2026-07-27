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
        val preferences = AppPreferences(context)
        val decision = BootLaunchPolicy.decide(
            action = intent.action,
            settings = settings,
            localBootStartEnabled = preferences.bootStartEnabled,
            networkValidated = AutomationNetwork.isValidated(context),
            now = Instant.now()
        )
        if (decision.diagnosticCode != null) {
            store.enqueueReport(
                eventType = "execution-failed",
                status = "failed",
                diagnosticCode = decision.diagnosticCode,
                metadata = mapOf("source" to (intent.action ?: "unknown"))
            )
        }
        if (
            !decision.shouldLaunch ||
            decision.source == null ||
            !preferences.mayAttemptBootStart(intent.action)
        ) return
        AutomationActivityLauncher.request(
            context = context,
            source = decision.source
        )
    }

    companion object {
        private val supportedActions = setOf(
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED
        )
    }
}
