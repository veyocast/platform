package nl.veyocast.player

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.os.Handler
import android.os.Looper

class NetworkMonitor(
    context: Context,
    private val onAvailabilityChanged: (Boolean) -> Unit
) {
    private val connectivityManager = context.getSystemService(ConnectivityManager::class.java)
    private val mainHandler = Handler(Looper.getMainLooper())
    private var registered = false

    private val callback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) = publishCurrentState()
        override fun onCapabilitiesChanged(network: Network, capabilities: NetworkCapabilities) =
            publishCurrentState()
        override fun onLost(network: Network) = publishCurrentState()
    }

    fun start() {
        if (registered) return
        registered = true
        runCatching { connectivityManager.registerDefaultNetworkCallback(callback) }
            .onFailure { AppLog.warning("Netwerkcallback kon niet worden geregistreerd") }
        publishCurrentState()
    }

    fun stop() {
        if (!registered) return
        registered = false
        runCatching { connectivityManager.unregisterNetworkCallback(callback) }
        mainHandler.removeCallbacksAndMessages(null)
    }

    fun isNetworkAvailable(): Boolean {
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun publishCurrentState() {
        mainHandler.post { onAvailabilityChanged(isNetworkAvailable()) }
    }
}
