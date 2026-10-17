package io.github.rushivangala.margin;

import android.webkit.JavascriptInterface;

/** window.Native: everything the web UI asks of Android. */
public final class Bridge {
    private final MainActivity a;

    Bridge(MainActivity a) {
        this.a = a;
    }

    @JavascriptInterface
    public String version() {
        try {
            return a.getPackageManager().getPackageInfo(a.getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "";
        }
    }
}
