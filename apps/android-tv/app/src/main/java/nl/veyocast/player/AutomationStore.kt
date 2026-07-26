package nl.veyocast.player

import android.content.Context
import android.os.Build
import androidx.core.content.edit
import java.time.Instant
import java.util.UUID
import org.json.JSONArray
import org.json.JSONObject

class AutomationStore(context: Context) {
    private val preferences =
        context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)

    fun currentEnvelope(): AutomationEnvelope? =
        preferences.getString(KEY_SYNC, null)?.let(AutomationConfiguration::parse)

    fun rawSync(): String? = preferences.getString(KEY_SYNC, null)

    fun storeSync(raw: String): AutomationEnvelope? {
        val parsed = AutomationConfiguration.parse(raw) ?: return null
        preferences.edit {
            putString(KEY_SYNC, raw)
            putString(KEY_LAST_SYNC_AT, Instant.now().toString())
        }
        return parsed
    }

    fun clearSync() {
        preferences.edit { remove(KEY_SYNC) }
    }

    @Synchronized
    fun enqueueReport(
        eventType: String,
        status: String = "success",
        commandId: String? = null,
        diagnosticCode: String? = null,
        scheduledFor: Instant? = null,
        metadata: Map<String, Any?> = emptyMap()
    ) {
        val queue = reportQueue()
        while (queue.length() >= MAX_REPORTS) queue.remove(0)
        queue.put(
            JSONObject().apply {
                put("commandId", commandId ?: JSONObject.NULL)
                put("diagnosticCode", diagnosticCode ?: JSONObject.NULL)
                put("eventId", UUID.randomUUID().toString())
                put("eventType", eventType)
                put("metadata", JSONObject(metadata))
                put("occurredAt", Instant.now().toString())
                put("scheduledFor", scheduledFor?.toString() ?: JSONObject.NULL)
                put("status", status)
            }
        )
        preferences.edit { putString(KEY_REPORTS, queue.toString()) }
    }

    @Synchronized
    fun pendingReport(): JSONObject? = reportQueue().optJSONObject(0)

    fun deliveredEventId(): String? = preferences.getString(KEY_DELIVERED_EVENT_ID, null)

    fun commandWasHandled(commandId: String): Boolean =
        preferences.getString(KEY_HANDLED_COMMAND_ID, null) == commandId

    fun markCommandHandled(commandId: String) {
        preferences.edit { putString(KEY_HANDLED_COMMAND_ID, commandId) }
    }

    fun markDelivered(eventId: String) {
        preferences.edit { putString(KEY_DELIVERED_EVENT_ID, eventId) }
    }

    @Synchronized
    fun acknowledgeDelivered() {
        val deliveredId = deliveredEventId() ?: return
        val queue = reportQueue()
        if (queue.optJSONObject(0)?.optString("eventId") == deliveredId) {
            queue.remove(0)
        }
        preferences.edit {
            putString(KEY_REPORTS, queue.toString())
            remove(KEY_DELIVERED_EVENT_ID)
        }
    }

    fun capabilities(context: Context): JSONObject {
        val cecFeature = context.packageManager.hasSystemFeature("android.hardware.hdmi.cec")
        return JSONObject().apply {
            put("automationSchemaVersion", 1)
            put("formFactor", BuildConfig.PLAYER_FORM_FACTOR)
            put(
                "hdmiCecWakeCapability",
                if (cecFeature) "probably_supported" else "unknown"
            )
            put(
                "lastAutomationExecutionAt",
                preferences.getString(KEY_LAST_EXECUTION_AT, null) ?: JSONObject.NULL
            )
            put(
                "lastAutomationResult",
                preferences.getString(KEY_LAST_RESULT, null) ?: JSONObject.NULL
            )
            put(
                "lastAutomationSyncAt",
                preferences.getString(KEY_LAST_SYNC_AT, null) ?: JSONObject.NULL
            )
            put("operatingSystem", "Android ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT})")
            put("supportsBootRestore", true)
            put("supportsKeepAwake", true)
            put("supportsLocalSchedule", true)
            put("supportsScheduledWake", true)
        }
    }

    fun recordExecution(result: String) {
        preferences.edit {
            putString(KEY_LAST_EXECUTION_AT, Instant.now().toString())
            putString(KEY_LAST_RESULT, result.take(100))
        }
    }

    private fun reportQueue(): JSONArray = runCatching {
        JSONArray(preferences.getString(KEY_REPORTS, "[]"))
    }.getOrElse { JSONArray() }

    private companion object {
        const val FILE_NAME = "veyocast_screen_automation"
        const val KEY_DELIVERED_EVENT_ID = "delivered_event_id"
        const val KEY_HANDLED_COMMAND_ID = "handled_command_id"
        const val KEY_LAST_EXECUTION_AT = "last_execution_at"
        const val KEY_LAST_RESULT = "last_result"
        const val KEY_LAST_SYNC_AT = "last_sync_at"
        const val KEY_REPORTS = "reports"
        const val KEY_SYNC = "sync"
        const val MAX_REPORTS = 40
    }
}
