package nl.veyocast.player

import android.content.Context
import android.content.Intent
import androidx.core.content.edit

class AppPreferences(context: Context) {
    private val preferences = context.getSharedPreferences(FILE_NAME, Context.MODE_PRIVATE)

    var bootStartEnabled: Boolean
        get() = preferences.getBoolean(KEY_BOOT_START, BuildConfig.BOOT_START_DEFAULT)
        set(value) = preferences.edit { putBoolean(KEY_BOOT_START, value) }

    var demoModeEnabled: Boolean
        get() = BuildConfig.DEMO_MENU_ENABLED && preferences.getBoolean(KEY_DEMO_MODE, false)
        set(value) = preferences.edit {
            putBoolean(KEY_DEMO_MODE, BuildConfig.DEMO_MENU_ENABLED && value)
        }

    fun mayAttemptBootStart(
        trigger: String?,
        now: Long = System.currentTimeMillis()
    ): Boolean {
        val key =
            if (trigger == Intent.ACTION_MY_PACKAGE_REPLACED) {
                KEY_LAST_UPDATE_ATTEMPT
            } else {
                KEY_LAST_BOOT_ATTEMPT
            }
        val previousAttempt = preferences.getLong(key, 0)
        if (previousAttempt > now || now - previousAttempt >= START_ATTEMPT_COOLDOWN_MS) {
            preferences.edit { putLong(key, now) }
            return true
        }
        return false
    }

    private companion object {
        const val FILE_NAME = "veyocast_native_settings"
        const val KEY_BOOT_START = "boot_start_enabled"
        const val KEY_DEMO_MODE = "staging_demo_mode_enabled"
        const val KEY_LAST_BOOT_ATTEMPT = "last_boot_attempt_ms"
        const val KEY_LAST_UPDATE_ATTEMPT = "last_update_attempt_ms"
        const val START_ATTEMPT_COOLDOWN_MS = 60_000L
    }
}
