package nl.veyocast.player

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.text.InputType
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.inputmethod.EditorInfo
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.Button
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.Switch
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.core.view.isVisible
import java.net.URI
import org.json.JSONObject

class MainActivity : ComponentActivity(), VeyoCastWebViewClient.Events {
    private lateinit var root: FrameLayout
    private lateinit var webViewContainer: FrameLayout
    private lateinit var errorOverlay: View
    private lateinit var errorTitle: TextView
    private lateinit var errorMessage: TextView
    private lateinit var retryButton: Button
    private lateinit var errorCard: View
    private lateinit var managementPanel: LinearLayout
    private lateinit var refreshButton: Button
    private lateinit var demoButton: Button
    private lateinit var demoSummary: TextView
    private lateinit var privacyButton: Button
    private lateinit var returnHomeButton: Button
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
        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() = handleBack()
            }
        )

        bindViews()
        configureViewportSizing()
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
            "VeyoCast Android ${BuildConfig.VERSION_NAME}; omgeving=${BuildConfig.ENVIRONMENT}; " +
                "host=${safeHost(playerUrl)}"
        )
    }

    override fun onResume() {
        super.onResume()
        activityResumed = true
        applyImmersiveMode()
        webView?.onResume()
        evaluatePlaybackScript(WebPlaybackScripts.RESUME_AFTER_BACKGROUND)
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
        evaluatePlaybackScript(WebPlaybackScripts.PAUSE_FOR_BACKGROUND)
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

    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean =
        if (handleHardwareKey(event)) true else super.onKeyDown(keyCode, event)

    override fun onKeyUp(keyCode: Int, event: KeyEvent): Boolean =
        if (handleHardwareKey(event)) true else super.onKeyUp(keyCode, event)

    private fun handleHardwareKey(event: KeyEvent): Boolean {
        if (event.keyCode == KeyEvent.KEYCODE_MENU) {
            if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
                toggleManagementPanel()
            }
            return true
        }

        if ((event.keyCode == KeyEvent.KEYCODE_DPAD_CENTER || event.keyCode == KeyEvent.KEYCODE_ENTER) &&
            ((!managementPanel.isVisible && !errorOverlay.isVisible) || centerKeyPressed)
        ) {
            return handleCenterKeyForPanel(event)
        }

        val remoteCommand = TvRemotePolicy.commandFor(event.keyCode)
        if (remoteCommand != null && !managementPanel.isVisible && !errorOverlay.isVisible) {
            if (event.action == KeyEvent.ACTION_UP) {
                executePlaybackCommand(remoteCommand, event.keyCode)
            }
            return true
        }

        return false
    }

    override fun onMainFrameLoadStarted() {
        mainFrameFailed = false
        AppLog.debug("Player-hoofdpagina wordt geladen; host=${safeHost(playerUrl)}")
    }

    override fun onMainFrameLoadSucceeded() {
        if (mainFrameFailed) return
        pageLoaded = true
        reconcileDemoRedirect()
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
        errorCard = findViewById(R.id.error_card)
        managementPanel = findViewById(R.id.management_panel)
        refreshButton = findViewById(R.id.refresh_button)
        demoButton = findViewById(R.id.demo_button)
        demoSummary = findViewById(R.id.demo_summary)
        privacyButton = findViewById(R.id.privacy_button)
        returnHomeButton = findViewById(R.id.return_home_button)
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

    private fun configureViewportSizing() {
        root.addOnLayoutChangeListener { _, left, _, right, _, _, _, _, _ ->
            val viewportWidth = right - left
            if (viewportWidth <= 0) return@addOnLayoutChangeListener
            val density = resources.displayMetrics.density
            applyViewWidth(
                managementPanel,
                ViewportSizing.managementPanelWidth(viewportWidth, density)
            )
            applyViewWidth(
                errorCard,
                ViewportSizing.errorCardWidth(viewportWidth, density)
            )
        }
    }

    private fun applyViewWidth(view: View, width: Int) {
        if (view.layoutParams.width == width) return
        view.layoutParams = view.layoutParams.apply { this.width = width }
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
        configureDemoMenu()
        privacyButton.setOnClickListener {
            runCatching {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(PRIVACY_POLICY_URL)))
            }.onFailure {
                AppLog.warning("Privacyverklaring kon niet in een externe app worden geopend")
            }
        }
        returnHomeButton.setOnClickListener { returnToAndroid() }
    }

    private fun configureDemoMenu() {
        val visibility = if (BuildConfig.DEMO_MENU_ENABLED) View.VISIBLE else View.GONE
        demoButton.visibility = visibility
        demoSummary.visibility = visibility
        if (!BuildConfig.DEMO_MENU_ENABLED) {
            preferences.demoModeEnabled = false
            return
        }
        updateDemoButton()
        demoButton.setOnClickListener {
            if (preferences.demoModeEnabled) disconnectDemo() else openDemoCodeDialog()
        }
    }

    private fun updateDemoButton() {
        demoButton.setText(
            if (preferences.demoModeEnabled) R.string.demo_disconnect else R.string.demo_start
        )
    }

    private fun openDemoCodeDialog() {
        val density = resources.displayMetrics.density
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val horizontal = (24 * density).toInt()
            val vertical = (8 * density).toInt()
            setPadding(horizontal, vertical, horizontal, 0)
        }
        val codeInput = EditText(this).apply {
            hint = getString(R.string.demo_code_hint)
            inputType = InputType.TYPE_CLASS_TEXT or
                InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS or
                InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS
            imeOptions = EditorInfo.IME_ACTION_DONE
            isSingleLine = true
            textSize = 22f
        }
        val feedback = TextView(this).apply {
            setTextColor(getColor(R.color.vc_text_muted))
            textSize = 15f
            visibility = View.GONE
        }
        container.addView(codeInput)
        container.addView(feedback)

        val dialog = AlertDialog.Builder(this)
            .setTitle(R.string.demo_dialog_title)
            .setMessage(R.string.demo_dialog_message)
            .setView(container)
            .setNegativeButton(R.string.cancel, null)
            .setPositiveButton(R.string.demo_connect, null)
            .create()

        dialog.setOnShowListener {
            val connectButton = dialog.getButton(AlertDialog.BUTTON_POSITIVE)
            connectButton.setOnClickListener {
                feedback.visibility = View.GONE
                connectButton.isEnabled = false
                activateDemo(codeInput.text?.toString().orEmpty()) { result ->
                    connectButton.isEnabled = true
                    when (result) {
                        DemoActivationResult.CONNECTED -> {
                            preferences.demoModeEnabled = true
                            updateDemoButton()
                            dialog.dismiss()
                            closeManagementPanel()
                            loadPlayer()
                        }
                        DemoActivationResult.INVALID_CODE -> {
                            feedback.setText(R.string.demo_invalid_code)
                            feedback.visibility = View.VISIBLE
                            codeInput.requestFocus()
                        }
                        DemoActivationResult.UNAVAILABLE -> {
                            feedback.setText(R.string.demo_unavailable)
                            feedback.visibility = View.VISIBLE
                            codeInput.requestFocus()
                        }
                    }
                }
            }
            codeInput.setOnEditorActionListener { _, actionId, _ ->
                if (actionId == EditorInfo.IME_ACTION_DONE) {
                    connectButton.performClick()
                    true
                } else {
                    false
                }
            }
            codeInput.requestFocus()
        }
        dialog.setOnDismissListener { applyImmersiveMode() }
        dialog.show()
    }

    private fun activateDemo(
        code: String,
        callback: (DemoActivationResult) -> Unit
    ) {
        val view = webView
        if (!BuildConfig.DEMO_MENU_ENABLED || view == null || !pageLoaded) {
            callback(DemoActivationResult.UNAVAILABLE)
            return
        }
        val resultKey = "__veyocastDemoActivation${SystemClock.elapsedRealtimeNanos()}"
        val quotedCode = JSONObject.quote(code)
        val quotedResultKey = JSONObject.quote(resultKey)
        val script = """
            (() => {
              const resultKey = $quotedResultKey;
              window[resultKey] = 'pending';
              fetch('/api/player/demo/session', {
                  body: JSON.stringify({ code: $quotedCode }),
                  cache: 'no-store',
                  credentials: 'same-origin',
                  headers: { 'Content-Type': 'application/json' },
                  method: 'POST'
                })
                .then((response) => {
                  window[resultKey] = response.ok ? 'connected' :
                    response.status === 401 ? 'invalid' : 'unavailable';
                })
                .catch(() => { window[resultKey] = 'unavailable'; });
              return 'started';
            })()
        """.trimIndent()
        view.evaluateJavascript(script) {
            pollDemoActivation(
                view = view,
                quotedResultKey = quotedResultKey,
                deadlineElapsedMs =
                    SystemClock.elapsedRealtime() + DEMO_ACTIVATION_TIMEOUT_MS,
                callback = callback
            )
        }
    }

    private fun pollDemoActivation(
        view: WebView,
        quotedResultKey: String,
        deadlineElapsedMs: Long,
        callback: (DemoActivationResult) -> Unit
    ) {
        if (webView !== view || SystemClock.elapsedRealtime() >= deadlineElapsedMs) {
            callback(DemoActivationResult.UNAVAILABLE)
            return
        }
        mainHandler.postDelayed({
            if (webView !== view) {
                callback(DemoActivationResult.UNAVAILABLE)
                return@postDelayed
            }
            view.evaluateJavascript(
                """
                    (() => {
                      const key = $quotedResultKey;
                      const result = window[key] || 'pending';
                      if (result !== 'pending') delete window[key];
                      return result;
                    })()
                """.trimIndent()
            ) { rawResult ->
                when (rawResult?.trim('"')) {
                    "connected" -> callback(DemoActivationResult.CONNECTED)
                    "invalid" -> callback(DemoActivationResult.INVALID_CODE)
                    "unavailable" -> callback(DemoActivationResult.UNAVAILABLE)
                    else -> pollDemoActivation(
                        view,
                        quotedResultKey,
                        deadlineElapsedMs,
                        callback
                    )
                }
            }
        }, DEMO_ACTIVATION_POLL_MS)
    }

    private fun disconnectDemo() {
        if (!BuildConfig.DEMO_MENU_ENABLED) return
        webView?.evaluateJavascript(
            "fetch('/api/player/demo/session', { method: 'DELETE', credentials: 'same-origin' }).catch(() => {})",
            null
        )
        CookieManager.getInstance().setCookie(
            playerUrl,
            "$DEMO_COOKIE_NAME=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Strict"
        )
        CookieManager.getInstance().flush()
        preferences.demoModeEnabled = false
        updateDemoButton()
        closeManagementPanel()
        loadPlayer()
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
        view.setInitialScale(ViewportSizing.WEBVIEW_INITIAL_SCALE_PERCENT)

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
            " VeyoCastAndroid/${BuildConfig.VERSION_NAME}"
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
        view.loadUrl(
            if (BuildConfig.DEMO_MENU_ENABLED && preferences.demoModeEnabled) {
                PlayerConfiguration.demoUrl(playerUrl)
            } else {
                playerUrl
            }
        )
    }

    private fun reconcileDemoRedirect() {
        if (
            !BuildConfig.DEMO_MENU_ENABLED ||
            !preferences.demoModeEnabled ||
            runCatching { URI(webView?.url.orEmpty()).path }.getOrNull() == "/demo"
        ) {
            return
        }
        preferences.demoModeEnabled = false
        updateDemoButton()
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
                    TvRemotePolicy.commandFor(event.keyCode)?.let {
                        executePlaybackCommand(it, event.keyCode)
                    }
                }
                panelOpenedByLongPress = false
                return true
            }
        }
        return true
    }

    private fun handleBack() {
        val view = webView
        val trustedWebHistoryAvailable = view != null &&
            !preferences.demoModeEnabled &&
            navigationPolicy.shouldNavigateBack(view.url, view.canGoBack())
        when (
            TvBackPolicy.decide(
                customMediaVisible = customView != null,
                managementVisible = managementPanel.isVisible,
                trustedWebHistoryAvailable = trustedWebHistoryAvailable
            )
        ) {
            TvBackAction.HIDE_FULLSCREEN_MEDIA -> hideCustomView()
            TvBackAction.RETURN_TO_ANDROID -> returnToAndroid()
            TvBackAction.NAVIGATE_WEB_HISTORY -> view?.goBack()
            TvBackAction.OPEN_MANAGEMENT -> openManagementPanel()
        }
    }

    private fun returnToAndroid() {
        closeManagementPanel()
        if (!moveTaskToBack(true)) finish()
    }

    private fun executePlaybackCommand(command: TvRemoteCommand, fallbackKeyCode: Int) {
        val view = webView ?: return
        view.evaluateJavascript(WebPlaybackScripts.command(command.playbackCommand)) { result ->
            if (result != "true" && command.fallbackToWebContent && view === webView) {
                dispatchKeyPairToWebView(view, fallbackKeyCode)
            }
        }
    }

    private fun evaluatePlaybackScript(script: String) {
        webView?.evaluateJavascript(script, null)
    }

    private fun dispatchKeyPairToWebView(view: WebView, keyCode: Int) {
        view.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, keyCode))
        view.dispatchKeyEvent(KeyEvent(KeyEvent.ACTION_UP, keyCode))
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
        const val DEMO_ACTIVATION_POLL_MS = 100L
        const val DEMO_ACTIVATION_TIMEOUT_MS = 10_000L
        const val DEMO_COOKIE_NAME = "veyocast_player_demo_session"
        const val PANEL_LONG_PRESS_MS = 1_200L
        const val PRIVACY_POLICY_URL = "https://veyocast.nl/privacy"
    }
}

private enum class DemoActivationResult {
    CONNECTED,
    INVALID_CODE,
    UNAVAILABLE
}
