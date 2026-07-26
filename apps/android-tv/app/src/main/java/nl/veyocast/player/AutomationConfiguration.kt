package nl.veyocast.player

import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import org.json.JSONObject

data class AutomationPeriod(
    val enabled: Boolean,
    val end: LocalTime,
    val start: LocalTime,
    val weekday: Int
)

data class AutomationException(
    val date: LocalDate,
    val end: LocalTime?,
    val mode: String,
    val start: LocalTime?
)

data class AutomationSettings(
    val cacheValidUntil: Instant,
    val enabled: Boolean,
    val exceptions: List<AutomationException>,
    val hdmiCecEnabled: Boolean,
    val keepAwakeEnabled: Boolean,
    val localWakeEnabled: Boolean,
    val offlineExecutionEnabled: Boolean,
    val periods: List<AutomationPeriod>,
    val restoreAfterReboot: Boolean,
    val revision: Int,
    val scheduleMode: String,
    val screenId: String,
    val startupEnabled: Boolean,
    val temporaryOverride: String,
    val temporaryOverrideUntil: Instant?,
    val timezone: ZoneId,
    val wakeLeadMinutes: Int
) {
    fun isCacheUsable(now: Instant): Boolean =
        !now.isAfter(cacheValidUntil)
}

data class AutomationCommand(
    val expiresAt: Instant,
    val id: String,
    val status: String
)

data class AutomationEnvelope(
    val command: AutomationCommand?,
    val settings: AutomationSettings?
)

object AutomationConfiguration {
    fun parse(raw: String): AutomationEnvelope? = runCatching {
        val root = JSONObject(raw)
        AutomationEnvelope(
            command = root.optJSONObject("command")?.let(::parseCommand),
            settings = root.optJSONObject("settings")?.let(::parseSettings)
        )
    }.onFailure {
        AppLog.warning("Lokale automatiseringsconfiguratie is ongeldig")
    }.getOrNull()

    private fun parseCommand(value: JSONObject) = AutomationCommand(
        expiresAt = Instant.parse(value.getString("expiresAt")),
        id = value.getString("id"),
        status = value.getString("status")
    )

    private fun parseSettings(value: JSONObject): AutomationSettings {
        require(value.getInt("schemaVersion") == 1)
        val periodsJson = value.getJSONArray("periods")
        val periods = buildList {
            for (index in 0 until periodsJson.length()) {
                val period = periodsJson.getJSONObject(index)
                add(
                    AutomationPeriod(
                        enabled = period.getBoolean("enabled"),
                        end = LocalTime.parse(period.getString("endLocalTime")),
                        start = LocalTime.parse(period.getString("startLocalTime")),
                        weekday = period.getInt("weekday")
                    )
                )
            }
        }
        val exceptionsJson = value.getJSONArray("exceptions")
        val exceptions = buildList {
            for (index in 0 until exceptionsJson.length()) {
                val exception = exceptionsJson.getJSONObject(index)
                add(
                    AutomationException(
                        date = LocalDate.parse(exception.getString("date")),
                        end = exception.optNullableString("endLocalTime")?.let(LocalTime::parse),
                        mode = exception.getString("mode"),
                        start = exception.optNullableString("startLocalTime")?.let(LocalTime::parse)
                    )
                )
            }
        }
        return AutomationSettings(
            cacheValidUntil = Instant.parse(value.getString("cacheValidUntil")),
            enabled = value.getBoolean("enabled"),
            exceptions = exceptions,
            hdmiCecEnabled = value.getBoolean("hdmiCecEnabled"),
            keepAwakeEnabled = value.getBoolean("keepAwakeEnabled"),
            localWakeEnabled = value.getBoolean("localWakeEnabled"),
            offlineExecutionEnabled = value.getBoolean("offlineExecutionEnabled"),
            periods = periods,
            restoreAfterReboot = value.getBoolean("restoreAfterReboot"),
            revision = value.getInt("revision"),
            scheduleMode = value.getString("scheduleMode"),
            screenId = value.getString("screenId"),
            startupEnabled = value.getBoolean("startupEnabled"),
            temporaryOverride = value.getString("temporaryOverride"),
            temporaryOverrideUntil =
                value.optNullableString("temporaryOverrideUntil")?.let(Instant::parse),
            timezone = ZoneId.of(value.getString("timezone")),
            wakeLeadMinutes = value.getInt("wakeLeadMinutes").coerceIn(0, 60)
        )
    }
}

private fun JSONObject.optNullableString(key: String): String? =
    if (isNull(key)) null else optString(key).takeIf(String::isNotBlank)
