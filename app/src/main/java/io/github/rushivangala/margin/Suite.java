package io.github.rushivangala.margin;

import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;

/**
 * Talks to the other apps of the suite. A note goes to Daybook's SuiteReceiver, which only accepts
 * apps holding the signature permission io.github.rushivangala.permission.SUITE. The broadcast is
 * ordered so Margin learns whether Daybook took it; if not (Daybook missing or too old), the caller
 * falls back to the share sheet.
 */
final class Suite {
    static final String DAYBOOK = "io.github.rushivangala.daybook";
    static final String ADD_NOTE = "io.github.rushivangala.daybook.ADD_NOTE";
    static final String PERMISSION = "io.github.rushivangala.permission.SUITE";

    interface Done {
        void done(boolean ok);
    }

    private Suite() {
    }

    static boolean installed(Context c, String pkg) {
        try {
            c.getPackageManager().getPackageInfo(pkg, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    static void addNote(Context c, String title, String text, String key, final Done done) {
        if (!installed(c, DAYBOOK)) {
            done.done(false);
            return;
        }
        Intent i = new Intent(ADD_NOTE).setPackage(DAYBOOK)
                .putExtra("title", title == null ? "" : title)
                .putExtra("text", text == null ? "" : text)
                .putExtra("source", "Margin");
        if (key != null && !key.isEmpty()) i.putExtra("key", key);
        i.addFlags(Intent.FLAG_INCLUDE_STOPPED_PACKAGES);
        c.sendOrderedBroadcast(i, null, new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent in) {
                done.done(getResultCode() == Activity.RESULT_OK);
            }
        }, null, Activity.RESULT_CANCELED, null, null);
    }

    /** Plain share sheet with text (the fallback when Daybook can't take the note directly). */
    static void shareText(Activity a, String subject, String text) {
        Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
        if (subject != null && !subject.isEmpty()) send.putExtra(Intent.EXTRA_SUBJECT, subject);
        try {
            a.startActivity(Intent.createChooser(send, null));
        } catch (Exception ignored) {
        }
    }
}
