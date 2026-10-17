package io.github.rushivangala.kit;

import android.app.Activity;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.window.BackEvent;
import android.window.OnBackAnimationCallback;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Shared WebView shell used by every app in the suite (Calculator, Clock, Daybook, Files, Photos).
 * It owns the things that must behave the same everywhere: edge-to-edge insets, predictive back,
 * the phone's font size, theme-coloured system bars, serving the bundled web UI from
 * https://app.local/ with a strict Content-Security-Policy, and the crash report dialog.
 * Keep this file identical across the five repositories.
 */
public final class KitShell {
    public static final String HOST = "app.local";
    public static final String ORIGIN = "https://" + HOST + "/";
    static final String PREFS = "kit";

    final Activity activity;
    final WebView web;
    private boolean pageReady;
    private String pendingInsets;
    private boolean canGoBack;
    private boolean registered;
    private OnBackInvokedCallback backCallback;
    private float lastProgress = -1f;
    private boolean transparent;

    public KitShell(Activity activity, WebView web) {
        this.activity = activity;
        this.web = web;
    }

    /** For windows that float over other apps: never paints a background. Call before install(). */
    public KitShell transparent() {
        transparent = true;
        return this;
    }

    /** Configures the WebView and window. Call once from onCreate, before loading. */
    public KitShell install() {
        edgeToEdge();
        int bg = transparent ? Color.TRANSPARENT : savedBackground(activity);
        activity.getWindow().getDecorView().setBackgroundColor(bg);
        web.setBackgroundColor(bg);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setTextZoom(fontZoom());
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setHapticFeedbackEnabled(true);
        web.addJavascriptInterface(new KitBridge(this), "KitNative");
        web.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets wi) {
                Insets bars = wi.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                Insets ime = wi.getInsets(WindowInsets.Type.ime());
                float d = activity.getResources().getDisplayMetrics().density;
                pendingInsets = String.format(Locale.ROOT, "window.Kit&&Kit._insets(%.1f,%.1f,%.1f,%.1f,%.1f)",
                        bars.top / d, bars.bottom / d, bars.left / d, bars.right / d, Math.max(0, ime.bottom - bars.bottom) / d);
                if (pageReady) web.evaluateJavascript(pendingInsets, null);
                return WindowInsets.CONSUMED;
            }
        });
        KitCrash.install(activity.getApplicationContext());
        return this;
    }

    @SuppressWarnings("deprecation")
    private void edgeToEdge() {
        // Android 15+ is always edge-to-edge; earlier versions need the opt-in.
        if (Build.VERSION.SDK_INT < 35) activity.getWindow().setDecorFitsSystemWindows(false);
    }

    /** Loads the bundled UI. */
    public void load(String pathAndQuery) {
        web.loadUrl(ORIGIN + (pathAndQuery == null ? "index.html" : pathAndQuery));
    }

    /** Call from WebViewClient.onPageFinished. */
    public void pageFinished() {
        pageReady = true;
        if (pendingInsets != null) web.evaluateJavascript(pendingInsets, null);
        else web.requestApplyInsets();
    }

    public boolean isReady() {
        return pageReady;
    }

    /** Call from Activity.onResume: shows the report if the app crashed last time. */
    public void resumed() {
        KitCrash.showIfAny(activity);
    }

    /** Call from Activity.onConfigurationChanged. */
    public void configurationChanged(Configuration c) {
        web.getSettings().setTextZoom(fontZoom());
        js("window.Kit&&Kit._night()");
    }

    int fontZoom() {
        return Math.round(activity.getResources().getConfiguration().fontScale * 100f);
    }

    public void js(final String code) {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (web != null && pageReady) web.evaluateJavascript(code, null);
            }
        });
    }

    // ---------------------------------------------------------------- bundled assets

    /**
     * Serves assets/www/** at https://app.local/. Returns null when the URL is an app route that
     * the caller handles itself (thumbnails, media and so on), and a 404 for anything off-host.
     */
    public WebResourceResponse serveAsset(WebResourceRequest req) {
        Uri u = req.getUrl();
        if (!HOST.equals(u.getHost())) return notFound();
        String path = u.getPath() == null || "/".equals(u.getPath()) ? "/index.html" : u.getPath();
        String rel = path.substring(1);
        if (rel.contains("..") || !rel.matches("[A-Za-z0-9_./-]+")) return notFound();
        String mime = mimeOf(rel);
        if (mime == null) return null;
        try {
            InputStream in = activity.getAssets().open("www/" + rel);
            return response(mime, in, false);
        } catch (Exception e) {
            return null;
        }
    }

    static String mimeOf(String rel) {
        String r = rel.toLowerCase(Locale.ROOT);
        if (r.endsWith(".html")) return "text/html";
        if (r.endsWith(".js")) return "application/javascript";
        if (r.endsWith(".css")) return "text/css";
        if (r.endsWith(".woff2")) return "font/woff2";
        if (r.endsWith(".svg")) return "image/svg+xml";
        if (r.endsWith(".png")) return "image/png";
        if (r.endsWith(".json")) return "application/json";
        if (r.endsWith(".txt")) return "text/plain";
        return null;
    }

    public static WebResourceResponse response(String mime, InputStream in, boolean cacheable) {
        Map<String, String> h = new HashMap<>();
        h.put("Cache-Control", cacheable ? "private, max-age=86400" : "no-store");
        h.put("Content-Security-Policy", "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'");
        h.put("X-Content-Type-Options", "nosniff");
        boolean text = mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") || mime.contains("svg");
        return new WebResourceResponse(mime, text ? "utf-8" : null, 200, "OK", h, in);
    }

    public static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", new HashMap<String, String>(), new ByteArrayInputStream(new byte[0]));
    }

    // ---------------------------------------------------------------- system bars and colours

    void setChrome(final String bg, final boolean dark) {
        int c;
        try {
            c = Color.parseColor(bg);
        } catch (RuntimeException e) {
            c = 0xFF282828;
        }
        final int color = c;
        if (!transparent) prefs(activity).edit().putInt("bg", color).putBoolean("dark", dark).apply();
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (!transparent) {
                    activity.getWindow().getDecorView().setBackgroundColor(color);
                    web.setBackgroundColor(color);
                }
                WindowInsetsController ic = activity.getWindow().getInsetsController();
                if (ic != null) {
                    int light = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                    ic.setSystemBarsAppearance(dark ? 0 : light, light);
                }
            }
        });
    }

    static SharedPreferences prefs(android.content.Context c) {
        return c.getApplicationContext().getSharedPreferences(PREFS, 0);
    }

    public static int savedBackground(android.content.Context c) {
        return prefs(c).getInt("bg", 0xFF282828);
    }

    // ---------------------------------------------------------------- predictive back

    void setCanGoBack(final boolean can) {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                canGoBack = can;
                updateBackRegistration();
            }
        });
    }

    private void updateBackRegistration() {
        OnBackInvokedDispatcher d = activity.getOnBackInvokedDispatcher();
        if (backCallback == null) backCallback = Build.VERSION.SDK_INT >= 34 ? animated() : plain();
        if (canGoBack && !registered) {
            d.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, backCallback);
            registered = true;
        } else if (!canGoBack && registered) {
            d.unregisterOnBackInvokedCallback(backCallback);
            registered = false;
        }
    }

    /** Lets an activity force back handling on, e.g. while a native overlay is showing. */
    public void handleBack() {
        web.evaluateJavascript("(function(){try{return window.Kit?Kit._back():false}catch(e){return false}})()", new android.webkit.ValueCallback<String>() {
            @Override
            public void onReceiveValue(String r) {
                if (!"true".equals(r)) {
                    canGoBack = false;
                    updateBackRegistration();
                    activity.moveTaskToBack(true);
                }
            }
        });
    }

    private OnBackInvokedCallback plain() {
        return new OnBackInvokedCallback() {
            @Override
            public void onBackInvoked() {
                handleBack();
            }
        };
    }

    private OnBackInvokedCallback animated() {
        return new OnBackAnimationCallback() {
            @Override
            public void onBackStarted(BackEvent e) {
                lastProgress = 0f;
                js("window.Kit&&Kit._progress&&Kit._progress(0," + e.getSwipeEdge() + ")");
            }

            @Override
            public void onBackProgressed(BackEvent e) {
                float p = e.getProgress();
                if (Math.abs(p - lastProgress) >= 0.02f) {
                    lastProgress = p;
                    js("window.Kit&&Kit._progress&&Kit._progress(" + p + "," + e.getSwipeEdge() + ")");
                }
            }

            @Override
            public void onBackCancelled() {
                lastProgress = -1f;
                js("window.Kit&&Kit._progress&&Kit._progress(-1,0)");
            }

            @Override
            public void onBackInvoked() {
                lastProgress = -1f;
                js("window.Kit&&Kit._progress&&Kit._progress(-1,0)");
                handleBack();
            }
        };
    }
}
