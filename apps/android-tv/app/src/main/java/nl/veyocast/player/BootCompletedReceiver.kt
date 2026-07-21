package nl.veyocast.player

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val preferences = AppPreferences(context)
        if (!preferences.bootStartEnabled || !preferences.mayAttemptBootStart()) return

        val launchIntent = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra(EXTRA_STARTED_AFTER_BOOT, true)
        }
        runCatching { context.startActivity(launchIntent) }
            .onSuccess { AppLog.info("Best-effort autostart aangevraagd") }
            .onFailure { AppLog.warning("Android heeft autostart na boot niet toegestaan") }
    }

    companion object {
        const val EXTRA_STARTED_AFTER_BOOT = "veyocast_started_after_boot"
    }
}
