package nl.veyocast.player

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.time.Duration
import java.time.Instant

class AutomationScheduler(private val context: Context) {
    private val alarmManager = context.getSystemService(AlarmManager::class.java)

    fun apply(envelope: AutomationEnvelope?, now: Instant = Instant.now()) {
        cancelScheduledWake()
        val settings = envelope?.settings ?: return
        if (
            !settings.enabled ||
            !settings.startupEnabled ||
            !settings.localWakeEnabled ||
            !settings.isCacheUsable(now)
        ) return
        val activation = AutomationScheduleEvaluator.nextActivationAt(settings, now) ?: return
        val requested = activation.minus(Duration.ofMinutes(settings.wakeLeadMinutes.toLong()))
        val triggerAt = maxOf(requested.toEpochMilli(), now.plusSeconds(2).toEpochMilli())
        schedule(
            requestCode = SCHEDULE_REQUEST_CODE,
            triggerAt = triggerAt,
            scheduledFor = activation,
            commandId = null
        )
        AppLog.info("Volgende inexacte lokale startpoging gepland")
    }

    fun scheduleTest(command: AutomationCommand) {
        if (command.expiresAt <= Instant.now()) return
        schedule(
            requestCode = TEST_REQUEST_CODE,
            triggerAt = Instant.now().plusSeconds(2).toEpochMilli(),
            scheduledFor = Instant.now(),
            commandId = command.id
        )
    }

    private fun schedule(
        requestCode: Int,
        triggerAt: Long,
        scheduledFor: Instant,
        commandId: String?
    ) {
        val intent = Intent(context, AutomationAlarmReceiver::class.java).apply {
            putExtra(AutomationAlarmReceiver.EXTRA_COMMAND_ID, commandId)
            putExtra(AutomationAlarmReceiver.EXTRA_SCHEDULED_FOR, scheduledFor.toString())
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent)
    }

    private fun cancelScheduledWake() {
        val intent = Intent(context, AutomationAlarmReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            SCHEDULE_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        if (pendingIntent != null) alarmManager.cancel(pendingIntent)
    }

    private companion object {
        const val SCHEDULE_REQUEST_CODE = 47_001
        const val TEST_REQUEST_CODE = 47_002
    }
}
