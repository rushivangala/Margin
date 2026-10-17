package io.github.rushivangala.kit;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.view.HapticFeedbackConstants;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

/** window.KitNative — the small native surface every app shares (see kit.js). */
final class KitBridge {
    private final KitShell shell;

    KitBridge(KitShell shell) {
        this.shell = shell;
    }

    @JavascriptInterface
    public void setChrome(String bg, boolean dark) {
        shell.setChrome(bg, dark);
    }

    /** Theme colours for home-screen widgets and notifications: {light:{..}, dark:{..}, mode, dyn}. */
    @JavascriptInterface
    public void saveColors(String json) {
        KitColors.save(shell.activity, json);
    }

    @JavascriptInterface
    public String dynamicColors() {
        return KitColors.dynamicJson(shell.activity);
    }

    @JavascriptInterface
    public boolean isNight() {
        return KitColors.isNight(shell.activity);
    }

    @JavascriptInterface
    public void setCanGoBack(boolean can) {
        shell.setCanGoBack(can);
    }

    @JavascriptInterface
    public void haptic(final String kind) {
        shell.activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                int k;
                if ("confirm".equals(kind)) k = HapticFeedbackConstants.CONFIRM;
                else if ("reject".equals(kind)) k = HapticFeedbackConstants.REJECT;
                else if ("long".equals(kind)) k = HapticFeedbackConstants.LONG_PRESS;
                else if ("tick".equals(kind)) k = HapticFeedbackConstants.CLOCK_TICK;
                else k = HapticFeedbackConstants.KEYBOARD_TAP;
                shell.web.performHapticFeedback(k);
            }
        });
    }

    @JavascriptInterface
    public void copy(String text) {
        ClipboardManager cm = (ClipboardManager) shell.activity.getSystemService(Context.CLIPBOARD_SERVICE);
        if (cm != null && text != null) cm.setPrimaryClip(ClipData.newPlainText("text", text));
    }

    @JavascriptInterface
    public void toast(final String msg) {
        shell.activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(shell.activity, msg, Toast.LENGTH_SHORT).show();
            }
        });
    }

    @JavascriptInterface
    public String version() {
        try {
            return shell.activity.getPackageManager().getPackageInfo(shell.activity.getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "";
        }
    }

    @JavascriptInterface
    public float fontScale() {
        return shell.activity.getResources().getConfiguration().fontScale;
    }
}
