package io.github.rushivangala.kit;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.DialogInterface;
import android.graphics.Typeface;
import android.os.Build;
import android.widget.ScrollView;
import android.widget.TextView;

import java.io.PrintWriter;
import java.io.StringWriter;

/** Keeps the last crash so the next launch can show it (nothing ever leaves the phone). */
public final class KitCrash {
    private static boolean installed;

    private KitCrash() {
    }

    public static synchronized void install(final Context app) {
        if (installed) return;
        installed = true;
        final Thread.UncaughtExceptionHandler prev = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler(new Thread.UncaughtExceptionHandler() {
            @Override
            public void uncaughtException(Thread t, Throwable e) {
                try {
                    StringWriter sw = new StringWriter();
                    e.printStackTrace(new PrintWriter(sw));
                    String label = app.getApplicationInfo().loadLabel(app.getPackageManager()).toString();
                    String report = label + " " + versionOf(app) + " · Android " + Build.VERSION.RELEASE + " · " + Build.MODEL + "\nthread " + t.getName() + "\n\n" + sw;
                    if (report.length() > 8000) report = report.substring(0, 8000);
                    KitShell.prefs(app).edit().putString("crash", report).commit();
                } catch (Throwable ignored) {
                }
                if (prev != null) prev.uncaughtException(t, e);
            }
        });
    }

    static String versionOf(Context c) {
        try {
            return c.getPackageManager().getPackageInfo(c.getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "";
        }
    }

    public static void showIfAny(final Activity a) {
        final String report = KitShell.prefs(a).getString("crash", null);
        if (report == null) return;
        KitShell.prefs(a).edit().remove("crash").apply();
        TextView tv = new TextView(a);
        tv.setText(report);
        tv.setTextIsSelectable(true);
        tv.setTextSize(11f);
        tv.setTypeface(Typeface.MONOSPACE);
        int p = (int) (20 * a.getResources().getDisplayMetrics().density);
        tv.setPadding(p, p / 2, p, p / 2);
        ScrollView sv = new ScrollView(a);
        sv.addView(tv);
        new AlertDialog.Builder(a)
                .setTitle("The app closed unexpectedly last time")
                .setView(sv)
                .setPositiveButton("Copy report", new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(DialogInterface d, int w) {
                        ClipboardManager cm = (ClipboardManager) a.getSystemService(Context.CLIPBOARD_SERVICE);
                        if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("crash report", report));
                    }
                })
                .setNegativeButton("Close", null)
                .show();
    }
}
