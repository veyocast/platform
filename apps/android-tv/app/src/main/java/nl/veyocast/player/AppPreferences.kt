package nl.veyocast.player

import android.content.Context
import androidx.core.content.edit

class AppPreferences(context: Context) {
    private val preferences = context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)

    var bootStartEnabled: Boolean
        get() = preferences.getBoolean(KEY_BOOT_START, BuildConfig.BOOT_START_DEFAULT)
        set(value) = preferences.edit { putBoolean(KEY_BOOT_START, value) }

    fun mayAttemptBootStart(now: Long = System.currentTimeMillis()): Boolean {
        val previousAttempt = preferences.getLong(KEY_LAST_BOOT_ATTEMPT, 0)
        if (previousAttempt > now || now - previousAttempt >= BOOT_ATTEMPT_COOLDOWN_MS) {
            preferences.edit { putLong(KEY_LAST_BOOT_ATTEMPT, now) }
            return true
        }
        return false
    }

    private companion object {
        const val FILE_NAME = "veyocast_native_settings"
        const val KEY_BOOT_START = "boot_start_enabled"
        const val KEY_LAST_BOOT_ATTEMPT = "last_boot_attempt_ms"
        const val BOOT_ATTEMPT_COOLDOWN_MS = 5 * 60_000L
    }
}
