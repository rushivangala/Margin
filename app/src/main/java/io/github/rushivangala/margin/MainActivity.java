package io.github.rushivangala.margin;

import android.app.Activity;
import android.content.res.Configuration;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import io.github.rushivangala.kit.KitShell;

/** Margin: the web UI in assets/www plus a native bridge (window.Native, see Bridge). */
public final class MainActivity extends Activity {
    WebView web;
    KitShell shell;
    final Handler main = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);
        shell = new KitShell(this, web).install();
        web.addJavascriptInterface(new Bridge(this), "Native");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                return true;
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                WebResourceResponse res = shell.serveAsset(r);
                return res != null ? res : KitShell.notFound();
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                shell.pageFinished();
            }
        });
        shell.load("index.html");
    }

    @Override
    protected void onResume() {
        super.onResume();
        shell.resumed();
    }

    @Override
    public void onConfigurationChanged(Configuration c) {
        super.onConfigurationChanged(c);
        shell.configurationChanged(c);
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
