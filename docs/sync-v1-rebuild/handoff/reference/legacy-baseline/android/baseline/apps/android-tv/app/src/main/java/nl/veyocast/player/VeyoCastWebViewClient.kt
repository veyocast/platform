package nl.veyocast.player

import android.graphics.Bitmap
import android.net.http.SslError
import android.webkit.RenderProcessGoneDetail
import android.webkit.SslErrorHandler
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient

class VeyoCastWebViewClient(
    private val navigationPolicy: NavigationPolicy,
    private val events: Events
) : WebViewClient() {

    interface Events {
        fun onMainFrameLoadStarted()
        fun onMainFrameLoadSucceeded()
        fun onMainFrameLoadFailed(reason: FailureReason)
        fun onBlockedNavigation()
        fun onRendererGone(didCrash: Boolean)
    }

    enum class FailureReason {
        NETWORK,
        HTTP,
        SSL,
        RENDERER
    }

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        if (!request.isForMainFrame) return false
        val allowed = navigationPolicy.allowsTopLevelNavigation(request.url.toString())
        if (!allowed) events.onBlockedNavigation()
        return !allowed
    }

    override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
        events.onMainFrameLoadStarted()
    }

    override fun onPageFinished(view: WebView, url: String?) {
        events.onMainFrameLoadSucceeded()
    }

    override fun onReceivedError(
        view: WebView,
        request: WebResourceRequest,
        error: WebResourceError
    ) {
        if (request.isForMainFrame) events.onMainFrameLoadFailed(FailureReason.NETWORK)
    }

    override fun onReceivedHttpError(
        view: WebView,
        request: WebResourceRequest,
        errorResponse: WebResourceResponse
    ) {
        if (request.isForMainFrame && errorResponse.statusCode >= 400) {
            events.onMainFrameLoadFailed(FailureReason.HTTP)
        }
    }

    override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
        handler.cancel()
        if (navigationPolicy.isPlayerRoot(error.url)) {
            events.onMainFrameLoadFailed(FailureReason.SSL)
        } else {
            AppLog.warning("Onveilig certificaat voor Player-subresource geblokkeerd")
        }
    }

    override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
        events.onRendererGone(detail.didCrash())
        return true
    }
}
