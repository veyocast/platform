package nl.veyocast.player

import android.app.ActivityOptions
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import java.time.Instant

object AutomationActivityLauncher {
    fun request(
        context: Context,
        source: String,
        commandId: String? = null,
        scheduledFor: Instant? = null
    ) {
        val store = AutomationStore(context)
        val attemptId = store.beginLaunchAttempt(source)
        val launchIntent = Intent(context, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            putExtra(AutomationAlarmReceiver.EXTRA_AUTOMATION_START, true)
            putExtra(AutomationAlarmReceiver.EXTRA_COMMAND_ID, commandId)
            putExtra(AutomationAlarmReceiver.EXTRA_SCHEDULED_FOR, scheduledFor?.toString())
            putExtra(EXTRA_LAUNCH_ATTEMPT_ID, attemptId)
        }
        AutomationLaunchVerifier.schedule(
            context = context,
            attemptId = attemptId,
            commandId = commandId,
            scheduledFor = scheduledFor,
            source = source
        )

        val backgroundStartMode =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.BAKLAVA) {
                ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOW_ALWAYS
            } else {
                ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED
            }
        val creatorOptions =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.VANILLA_ICE_CREAM) {
                ActivityOptions.makeBasic()
                    .setPendingIntentCreatorBackgroundActivityStartMode(
                        backgroundStartMode
                    )
                    .toBundle()
            } else {
                null
            }
        val pendingIntent = PendingIntent.getActivity(
            context,
            ACTIVITY_REQUEST_CODE,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            creatorOptions
        )
        runCatching {
            context.getSystemService(AlarmManager::class.java).setAndAllowWhileIdle(
                AlarmManager.ELAPSED_REALTIME_WAKEUP,
                SystemClock.elapsedRealtime() + SYSTEM_DELIVERY_DELAY_MS,
                pendingIntent
            )
        }
            .onSuccess {
                store.enqueueReport(
                    eventType = "activity-start-requested",
                    commandId = commandId,
                    scheduledFor = scheduledFor,
                    metadata = mapOf(
                        "attemptId" to attemptId,
                        "source" to source
                    )
                )
                store.recordExecution("ACTIVITY_START_REQUESTED")
                AppLog.info(
                    "Autostart via Android-systeemalarm gepland vanuit $source; " +
                        "zichtbaarheid wordt geverifieerd"
                )
            }
            .onFailure {
                AutomationLaunchVerifier.cancel(context)
                store.failLaunchAttempt(
                    attemptId = attemptId,
                    commandId = commandId,
                    diagnosticCode = "BACKGROUND_START_BLOCKED",
                    scheduledFor = scheduledFor,
                    source = source
                )
                AppLog.warning("Android heeft de achtergrondstart niet toegestaan")
            }
    }

    const val EXTRA_LAUNCH_ATTEMPT_ID = "veyocast_automation_launch_attempt_id"
    private const val ACTIVITY_REQUEST_CODE = 47_004
    private const val SYSTEM_DELIVERY_DELAY_MS = 2_000L
}
