package nl.veyocast.player

import java.time.Instant
import java.time.temporal.ChronoUnit

data class AutomationEvaluation(
    val active: Boolean,
    val reason: String
)

object AutomationScheduleEvaluator {
    fun evaluate(settings: AutomationSettings, at: Instant): AutomationEvaluation {
        if (!settings.enabled) return AutomationEvaluation(false, "disabled")
        if (!settings.isCacheUsable(at)) return AutomationEvaluation(false, "cache_expired")
        val local = at.atZone(settings.timezone)
        val minute = local.hour * 60 + local.minute
        val todayExceptions = settings.exceptions.filter { it.date == local.toLocalDate() }
        if (todayExceptions.any { it.mode == "closed" }) {
            return AutomationEvaluation(false, "exception_closed")
        }
        val openings = todayExceptions.filter { it.mode == "open" }
        if (openings.isNotEmpty()) {
            return AutomationEvaluation(
                openings.any {
                    matchesAnchored(
                        minute,
                        requireNotNull(it.start),
                        requireNotNull(it.end)
                    )
                },
                "exception_open"
            )
        }
        val previousOpenings = settings.exceptions.filter {
            it.date == local.toLocalDate().minusDays(1) && it.mode == "open"
        }
        if (previousOpenings.any {
                crossesMidnight(requireNotNull(it.start), requireNotNull(it.end)) &&
                    minute < minutes(requireNotNull(it.end))
            }
        ) {
            return AutomationEvaluation(true, "exception_open")
        }
        val overrideActive = settings.temporaryOverride != "none" &&
            settings.temporaryOverrideUntil?.isAfter(at) == true
        if (overrideActive) {
            return if (settings.temporaryOverride == "active") {
                AutomationEvaluation(true, "temporary_active")
            } else {
                AutomationEvaluation(false, "temporary_paused")
            }
        }
        if (settings.scheduleMode == "always") return AutomationEvaluation(true, "weekly")
        val weekday = local.dayOfWeek.value
        val previousWeekday = if (weekday == 1) 7 else weekday - 1
        val active = settings.periods.filter(AutomationPeriod::enabled).any { period ->
            (
                period.weekday == weekday &&
                    matchesAnchored(minute, period.start, period.end)
                ) ||
                (
                    period.weekday == previousWeekday &&
                        crossesMidnight(period.start, period.end) &&
                        minute < minutes(period.end)
                    )
        }
        return AutomationEvaluation(active, if (active) "weekly" else "outside_schedule")
    }

    fun nextActivationAt(
        settings: AutomationSettings,
        from: Instant,
        searchMinutes: Int = 9 * 24 * 60
    ): Instant? {
        val start = from.truncatedTo(ChronoUnit.MINUTES)
        var wasActive = evaluate(settings, start).active
        var inactiveObserved = !wasActive
        for (offset in 1..searchMinutes) {
            val candidate = start.plus(offset.toLong(), ChronoUnit.MINUTES)
            val active = evaluate(settings, candidate).active
            if (!active) inactiveObserved = true
            if (active && !wasActive && inactiveObserved) return candidate
            wasActive = active
        }
        return null
    }

    private fun matchesAnchored(
        minute: Int,
        start: java.time.LocalTime,
        end: java.time.LocalTime
    ): Boolean {
        val startMinute = minutes(start)
        val endMinute = minutes(end)
        return if (startMinute < endMinute) {
            minute in startMinute until endMinute
        } else {
            minute >= startMinute
        }
    }

    private fun crossesMidnight(start: java.time.LocalTime, end: java.time.LocalTime) =
        minutes(start) > minutes(end)

    private fun minutes(time: java.time.LocalTime) = time.hour * 60 + time.minute
}
