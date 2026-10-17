package io.github.rushivangala.kit;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.res.ColorStateList;
import android.widget.RemoteViews;

import java.util.List;

/**
 * Helpers that give every home-screen widget in the suite the same look: the system's widget
 * corner radius, kit colours (or wallpaper colours), and one type scale. Layouts use
 * @drawable/kit_w_bg / kit_w_cell / kit_w_pill (white shapes that are tinted here).
 */
public final class KitWidgets {
    private KitWidgets() {
    }

    public static void tintBg(RemoteViews rv, int viewId, int color) {
        rv.setColorStateList(viewId, "setBackgroundTintList", ColorStateList.valueOf(color));
    }

    public static void tintImage(RemoteViews rv, int viewId, int color) {
        rv.setColorStateList(viewId, "setImageTintList", ColorStateList.valueOf(color));
    }

    /** Asks every widget provider in this app to redraw (after a theme change). */
    public static void refreshAll(Context c) {
        try {
            AppWidgetManager m = AppWidgetManager.getInstance(c);
            PackageManager pm = c.getPackageManager();
            Intent probe = new Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).setPackage(c.getPackageName());
            List<android.content.pm.ResolveInfo> rs = pm.queryBroadcastReceivers(probe, PackageManager.GET_META_DATA);
            for (android.content.pm.ResolveInfo r : rs) {
                ActivityInfo ai = r.activityInfo;
                ComponentName cn = new ComponentName(ai.packageName, ai.name);
                int[] ids = m.getAppWidgetIds(cn);
                if (ids == null || ids.length == 0) continue;
                c.sendBroadcast(new Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).setComponent(cn)
                        .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids));
            }
        } catch (Exception ignored) {
        }
    }

    /** Pins a widget from inside the app; returns false when the launcher can't. */
    public static boolean requestPin(Context c, Class<?> provider) {
        try {
            AppWidgetManager m = AppWidgetManager.getInstance(c);
            return m.isRequestPinAppWidgetSupported() && m.requestPinAppWidget(new ComponentName(c, provider), null, null);
        } catch (Exception e) {
            return false;
        }
    }
}
