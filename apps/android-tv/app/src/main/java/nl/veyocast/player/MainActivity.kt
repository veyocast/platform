package nl.veyocast.player

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.Switch
import android.widget.TextView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.isVisible
import java.net.URI

class MainActivity : Activity(), VeyoCastWebViewClient.Events {
    private lateinit var root: FrameLayout
    private lateinit var webViewContainer: FrameLayout
    private lateinit var errorOverlay: View
    private lateinit var errorTitle: TextView
    private lateinit var errorMessage: TextView
    private lateinit var retryButton: Button
    private lateinit var managementPanel: LinearLayout
    private lateinit var refreshButton: Button
    private lateinit var closeAppButton: Button
    private lateinit var autostartSwitch: Switch
    private lateinit var connectionValue: TextView
    private lateinit var environmentValue: TextView
    private lateinit var versionValue: TextView

    private val mainHandler = Handler(Looper.getMainLooper())
    private val retryPolicy = RetryPolicy()
    private val crashLoopGuard = CrashLoopGuard()
    private lateinit var preferences: AppPreferences
    private lateinit var networkMonitor: NetworkMonitor
    private lateinit var playerUrl: String
    private lateinit var navigationPolicy: NavigationPolicy

    private var webView: WebView? = null
    private var mainFrameFailed = false
    private var pageLoaded = false
    private var networkAvailable = false
    private var activityResumed = false
    private var rendererRecoveryPending = false
    private var pageRetryPending = false
    private var retryScheduled = false
    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var centerKeyPressed = false
    private var panelOpenedByLongPress = false

    private val retryRunnable = Runnable {
        retryScheduled = false
        if (!activityResumed) {
            pageRetryPending = true
            return@Runnable
        }
        AppLog.info("Automatische Player-retry gestart")
        loadPlayer()
    }

    private val openPanelRunnable = Runnable {
        if (centerKeyPressed && !managementPanel.isVisible) {
            panelOpenedByLongPress = true
            openManagementPanel()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        setContentView(R.layout.activity_main)

        bindViews()
        preferences = AppPreferences(this)
        playerUrl = PlayerConfiguration.resolvePlayerUrl(
            configuredUrl = BuildConfig.PLAYER_URL,
            allowDebugOverride = BuildConfig.ALLOW_DEBUG_URL_OVERRIDE,
            debugOverride = intent?.getStringExtra(PlayerConfiguration.DEBUG_URL_EXTRA)
        )
        navigationPolicy = NavigationPolicy(playerUrl)

        configureManagementPanel()
        configureErrorOverlay()
        WebView.setWebContentsDebuggingEnabled(BuildConfig.WEBVIEW_DEBUGGING)
        createWebView()

        networkMonitor = NetworkMonitor(this, ::handleNetworkAvailability)
        networkMonitor.start()

        AppLog.info(
            "VeyoCast Android TV ${BuildConfig.VERSION_NAME}; omgeving=${BuildConfig.ENVIRONMENT}; " +
                "host=${safeHost(playerUrl)}"
        )
    }

    override fun onResume() {
        super.onResume()
        activityResumed = true
        applyImmersiveMode()
        webView?.onResume()
        if (rendererRecoveryPending) {
            rendererRecoveryPending = false
            recreateWebViewAfterRendererFailure()
        }
        if (pageRetryPending) {
            pageRetryPending = false
            scheduleRetry(delayMs = 250)
        }
    }

    override fun onPause() {
        activityResumed = false
        webView?.onPause()
        CookieManager.getInstance().flush()
        super.onPause()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) applyImmersiveMode()
    }

    override fun onDestroy() {
        mainHandler.removeCallbacksAndMessages(null)
        if (::networkMonitor.isInitialized) networkMonitor.stop()
        hideCustomView()
        destroyCurrentWebView()
        super.onDestroy()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.keyCode == KeyEvent.KEYCODE_MENU && event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
            toggleManagementPanel()
            return true
        }

        if ((event.keyCode == KeyEvent.KEYCODE_DPAD_CENTER || event.keyCode == KeyEvent.KEYCODE_ENTER) &&
            ((!managementPanel.isVisible && !errorOverlay.isVisible) || centerKeyPressed)
        ) {
            return handleCenterKeyForPanel(event)
        }

        if (event.keyCode == KeyEvent.KEYCODE_BACK && event.action == KeyEvent.ACTION_UP) {
            return handleBack()
        }

        return super.dispatchKeyEvent(event)
    }

    override fun onMainFrameLoadStarted() {
        mainFrameFailed = false
        AppLog.debug("Player-hoofdpagina wordt geladen; host=${safeHost(playerUrl)}")
    }

    override fun onMainFrameLoadSucceeded() {
        if (mainFrameFailed) return
        pageLoaded = true
        retryPolicy.reset()
        cancelScheduledRetry()
        hideErrorOverlay()
        updateConnectionLabel()
        AppLog.info("Player-hoofdpagina geladen")
    }

    override fun onMainFrameLoadFailed(reason: VeyoCastWebViewClient.FailureReason) {
        if (mainFrameFailed) return
        mainFrameFailed = true
        pageLoaded = false
        AppLog.warning("Player-hoofdpagina mislukt; categorie=${reason.name}")
        when (reason) {
            VeyoCastWebViewClient.FailureReason.SSL -> showErrorOverlay(
                R.string.secure_connection_error_title,
                R.string.secure_connection_error_message
            )
            else -> showErrorOverlay(
                R.string.connection_error_title,
                R.string.connection_error_message
            )
        }
        scheduleRetry()
    }

    override fun onBlockedNavigation() {
        AppLog.warning("Externe top-level navigatie geblokkeerd")
    }

    override fun onRendererGone(didCrash: Boolean) {
        AppLog.error(if (didCrash) "WebView-renderer crashte" else "WebView-renderer werd beëindigd")
        pageLoaded = false
        mainFrameFailed = true
        hideCustomView()
        destroyCurrentWebView()

        if (!crashLoopGuard.allowRecovery()) {
            showErrorOverlay(
                R.string.player_recovery_paused_title,
                R.string.player_recovery_paused_message
            )
            return
        }

        showErrorOverlay(R.string.player_recovery_title, R.string.player_recovery_message)
        if (activityResumed) {
            mainHandler.postDelayed(::recreateWebViewAfterRendererFailure, 1_000)
        } else {
            rendererRecoveryPending = true
        }
    }

    private fun bindViews() {
        root = findViewById(R.id.player_root)
        webViewContainer = findViewById(R.id.webview_container)
        errorOverlay = findViewById(R.id.error_overlay)
        errorTitle = findViewById(R.id.error_title)
        errorMessage = findViewById(R.id.error_message)
        retryButton = findViewById(R.id.retry_button)
        managementPanel = findViewById(R.id.management_panel)
        refreshButton = findViewById(R.id.refresh_button)
        closeAppButton = findViewById(R.id.close_app_button)
        autostartSwitch = findViewById(R.id.autostart_switch)
        connectionValue = findViewById(R.id.connection_value)
        environmentValue = findViewById(R.id.environment_value)
        versionValue = findViewById(R.id.version_value)
    }

    private fun configureErrorOverlay() {
        retryButton.setOnClickListener {
            crashLoopGuard.reset()
            retryPolicy.reset()
            cancelScheduledRetry()
            if (webView == null) createWebView() else loadPlayer()
        }
    }

    private fun configureManagementPanel() {
        environmentValue.text = BuildConfig.ENVIRONMENT.replaceFirstChar { it.uppercase() }
        versionValue.text = BuildConfig.VERSION_NAME
        autostartSwitch.isChecked = preferencesOrDefaultBootStart()
        autostartSwitch.setOnCheckedChangeListener { _, checked ->
            preferences.bootStartEnabled = checked
            AppLog.info("Autostartinstelling gewijzigd; actief=$checked")
        }
        refreshButton.setOnClickListener {
            closeManagementPanel()
            retryPolicy.reset()
            loadPlayer()
        }
        closeAppButton.setOnClickListener {
            closeManagementPanel()
            finishAndRemoveTask()
        }
    }

    private fun preferencesOrDefaultBootStart(): Boolean = if (::preferences.isInitialized) {
        preferences.bootStartEnabled
    } else {
        BuildConfig.BOOT_START_DEFAULT
    }

    private fun createWebView() {
        if (webView != null) return
        val view = WebView(this)
        webView = view
        view.setBackgroundColor(Color.BLACK)
        view.layoutParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )
        view.overScrollMode = View.OVER_SCROLL_NEVER
        view.isHorizontalScrollBarEnabled = false
        view.isVerticalScrollBarEnabled = false
        view.isLongClickable = false
        view.setOnLongClickListener { true }
        view.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        view.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_BOUND, true)
        configureWebSettings(view.settings)

        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.setAcceptThirdPartyCookies(view, false)

        view.webViewClient = VeyoCastWebViewClient(navigationPolicy, this)
        view.webChromeClient = createWebChromeClient()
        webViewContainer.addView(view)
        view.requestFocus()
        loadPlayer()
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Suppress("DEPRECATION")
    private fun configureWebSettings(settings: WebSettings) {
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.allowFileAccessFromFileURLs = false
        settings.allowUniversalAccessFromFileURLs = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.loadsImagesAutomatically = true
        settings.javaScriptCanOpenWindowsAutomatically = false
        settings.setSupportMultipleWindows(true)
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.useWideViewPort = true
        settings.loadWithOverviewMode = true
        settings.textZoom = 100
        settings.setGeolocationEnabled(false)
        settings.safeBrowsingEnabled = true
        settings.userAgentString = settings.userAgentString +
            " VeyoCastAndroidTV/${BuildConfig.VERSION_NAME}"
    }

    private fun createWebChromeClient(): WebChromeClient = object : WebChromeClient() {
        override fun onShowCustomView(view: View, callback: CustomViewCallback) {
            if (customView != null) {
                callback.onCustomViewHidden()
                return
            }
            customView = view
            customViewCallback = callback
            root.addView(
                view,
                FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
            )
            applyImmersiveMode()
        }

        override fun onHideCustomView() = hideCustomView()

        override fun onPermissionRequest(request: PermissionRequest) {
            request.deny()
        }
    }

    private fun hideCustomView() {
        customView?.let(root::removeView)
        customView = null
        customViewCallback?.onCustomViewHidden()
        customViewCallback = null
    }

    private fun loadPlayer() {
        val view = webView ?: return
        mainFrameFailed = false
        AppLog.debug("Player-load aangevraagd; host=${safeHost(playerUrl)}")
        view.loadUrl(playerUrl)
    }

    private fun recreateWebViewAfterRendererFailure() {
        if (webView != null) return
        createWebView()
    }

    private fun destroyCurrentWebView() {
        val view = webView ?: return
        webView = null
        webViewContainer.removeView(view)
        view.stopLoading()
        view.destroy()
    }

    private fun handleNetworkAvailability(available: Boolean) {
        val wasAvailable = networkAvailable
        networkAvailable = available
        updateConnectionLabel()
        AppLog.debug("Netwerkstatus gewijzigd; beschikbaar=$available")
        if (available && !wasAvailable && (errorOverlay.isVisible || !pageLoaded)) {
            scheduleRetry(delayMs = 250)
        }
    }

    private fun scheduleRetry(delayMs: Long? = null) {
        val delay = delayMs ?: retryPolicy.nextDelayMs()
        cancelScheduledRetry()
        retryScheduled = true
        mainHandler.postDelayed(retryRunnable, delay)
        AppLog.debug("Player-retry gepland; vertragingMs=$delay")
    }

    private fun cancelScheduledRetry() {
        if (retryScheduled) mainHandler.removeCallbacks(retryRunnable)
        retryScheduled = false
        pageRetryPending = false
    }

    private fun showErrorOverlay(title: Int, message: Int) {
        errorTitle.setText(title)
        errorMessage.setText(message)
        errorOverlay.visibility = View.VISIBLE
        retryButton.requestFocus()
    }

    private fun hideErrorOverlay() {
        errorOverlay.visibility = View.GONE
        webView?.requestFocus()
    }

    private fun openManagementPanel() {
        hideCustomView()
        managementPanel.visibility = View.VISIBLE
        refreshButton.requestFocus()
    }

    private fun closeManagementPanel() {
        managementPanel.visibility = View.GONE
        if (errorOverlay.isVisible) retryButton.requestFocus() else webView?.requestFocus()
        applyImmersiveMode()
    }

    private fun toggleManagementPanel() {
        if (managementPanel.isVisible) closeManagementPanel() else openManagementPanel()
    }

    private fun handleCenterKeyForPanel(event: KeyEvent): Boolean {
        when (event.action) {
            KeyEvent.ACTION_DOWN -> {
                if (!centerKeyPressed) {
                    centerKeyPressed = true
                    panelOpenedByLongPress = false
                    mainHandler.postDelayed(openPanelRunnable, PANEL_LONG_PRESS_MS)
                }
                return true
            }
            KeyEvent.ACTION_UP -> {
                mainHandler.removeCallbacks(openPanelRunnable)
                centerKeyPressed = false
                if (!panelOpenedByLongPress) {
                    webView?.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, event.keyCode))
                    webView?.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, event.keyCode))
                }
                panelOpenedByLongPress = false
                return true
            }
        }
        return true
    }

    private fun handleBack(): Boolean {
        if (customView != null) {
            hideCustomView()
            return true
        }
        if (managementPanel.isVisible) {
            closeManagementPanel()
            return true
        }
        val view = webView
        if (view != null && navigationPolicy.shouldNavigateBack(view.url, view.canGoBack())) {
            view.goBack()
            return true
        }
        openManagementPanel()
        return true
    }

    private fun updateConnectionLabel() {
        connectionValue.setText(
            when {
                pageLoaded && networkAvailable -> R.string.connection_online
                pageLoaded -> R.string.connection_player_loaded
                networkAvailable -> R.string.connection_available
                else -> R.string.connection_offline
            }
        )
    }

    private fun applyImmersiveMode() {
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    private fun safeHost(url: String): String = runCatching { URI(url).host }.getOrNull() ?: "onbekend"

    private companion object {
        const val PANEL_LONG_PRESS_MS = 1_200L
    }
}
