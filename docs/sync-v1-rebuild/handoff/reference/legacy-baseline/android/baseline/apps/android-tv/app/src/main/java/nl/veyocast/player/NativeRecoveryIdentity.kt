package nl.veyocast.player

import android.content.Context
import android.provider.Settings
import java.security.MessageDigest

object NativeRecoveryIdentity {
    const val COOKIE_NAME = "veyocast_native_recovery"
    private const val COOKIE_MAX_AGE_SECONDS = 10L * 365L * 24L * 60L * 60L
    private val androidIdPattern = Regex("^[a-f0-9]{8,64}$")

    fun from(context: Context, environment: String): String? = deriveCredential(
        androidId = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID
        ),
        applicationId = context.packageName,
        environment = environment
    )

    fun deriveCredential(
        androidId: String?,
        applicationId: String,
        environment: String
    ): String? {
        val normalizedAndroidId = androidId?.trim()?.lowercase()
            ?.takeIf(androidIdPattern::matches)
            ?: return null
        val normalizedApplicationId = applicationId.trim().lowercase()
            .takeIf { it.matches(Regex("^[a-z0-9_.]{3,160}$")) }
            ?: return null
        val normalizedEnvironment = environment.trim().lowercase()
            .takeIf { it == "staging" || it == "production" }
            ?: return null
        val material = listOf(
            "veyocast-android-reinstall-v1",
            normalizedEnvironment,
            normalizedApplicationId,
            normalizedAndroidId
        ).joinToString("\u0000")
        return MessageDigest.getInstance("SHA-256")
            .digest(material.toByteArray(Charsets.UTF_8))
            .joinToString("") { byte -> "%02x".format(byte) }
    }

    fun cookie(credential: String, secure: Boolean): String {
        require(credential.matches(Regex("^[a-f0-9]{64}$")))
        return buildString {
            append(COOKIE_NAME)
            append('=')
            append(credential)
            append("; Path=/; Max-Age=")
            append(COOKIE_MAX_AGE_SECONDS)
            append("; HttpOnly; SameSite=Strict")
            if (secure) append("; Secure")
        }
    }
}
