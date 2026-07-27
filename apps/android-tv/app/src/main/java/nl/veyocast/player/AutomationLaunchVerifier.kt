package nl.veyocast.player

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import java.time.Instant

object AutomationLaunchVerifier {
    fun schedule(
        context: Context,
        attemptId: String,
        commandId: String?,
        scheduledFor: Instant?,
        source: String
    ) {
        val alarmManager = context.getSystemService(AlarmManager::class.java)
        val intent = Intent(context, AutomationLaunchVerificationReceiver::class.java).apply {
            putExtra(AutomationActivityLauncher.EXTRA_LAUNCH_ATTEMPT_ID, attemptId)
            putExtra(AutomationAlarmReceiver.EXTRA_COMMAND_ID, commandId)
            putExtra(AutomationAlarmReceiver.EXTRA_SCHEDULED_FOR, scheduledFor?.toString())
            putExtra(EXTRA_SOURCE, source)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.setAndAllowWhileIdle(
            AlarmManager.ELAPSED_REALTIME_WAKEUP,
            SystemClock.elapsedRealtime() + VISIBILITY_TIMEOUT_MS,
            pendingIntent
        )
    }

    fun cancel(context: Context) {
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            Intent(context, AutomationLaunchVerificationReceiver::class.java),
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        if (pendingIntent != null) {
            context.getSystemService(AlarmManager::class.java).cancel(pendingIntent)
            pendingIntent.cancel()
        }
    }

    const val EXTRA_SOURCE = "veyocast_automation_launch_source"
    private const val REQUEST_CODE = 47_003
    private const val VISIBILITY_TIMEOUT_MS = 30_000L
}
