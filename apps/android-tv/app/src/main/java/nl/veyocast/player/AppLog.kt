package nl.veyocast.player

import android.util.Log

object AppLog {
    private const val TAG = "VeyoCastPlayer"

    fun debug(message: String) {
        if (BuildConfig.DEBUG) Log.d(TAG, message)
    }

    fun info(message: String) {
        if (BuildConfig.DEBUG) Log.i(TAG, message)
    }

    fun warning(message: String) {
        Log.w(TAG, message)
    }

    fun error(message: String, throwable: Throwable? = null) {
        if (throwable == null) Log.e(TAG, message) else Log.e(TAG, message, throwable)
    }
}
