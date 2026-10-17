package io.github.rushivangala.kit;

import android.content.Context;
import android.content.res.Configuration;

import org.json.JSONObject;

/**
 * Colours shared between the web UI, widgets and notifications.
 * The web UI saves both its light and dark palettes; widgets pick the one matching the phone,
 * so they follow dark mode even when the app has not been opened since.
 */
public final class KitColors {
    private KitColors() {
    }

    static void save(Context c, String json) {
        if (json == null) return;
        String old = KitShell.prefs(c).getString("colors", null);
        if (json.equals(old)) return;
        KitShell.prefs(c).edit().putString("colors", json).apply();
        KitWidgets.refreshAll(c);
    }

    public static boolean isNight(Context c) {
        return (c.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
    }

    /** Palette for native surfaces (widgets, notification accents). */
    public static Palette palette(Context c) {
        boolean night = isNight(c);
        try {
            JSONObject all = new JSONObject(KitShell.prefs(c).getString("colors", "{}"));
            String mode = all.optString("mode", "system");
            boolean dark = "dark".equals(mode) || (!"light".equals(mode) && night);
            JSONObject t = all.optJSONObject(dark ? "dark" : "light");
            if (t != null) return new Palette(t, dark);
        } catch (Exception ignored) {
        }
        return Palette.fallback(night);
    }

    static String hex(int c) {
        return String.format("#%06x", c & 0xFFFFFF);
    }

    /** Material You roles from the wallpaper, in the kit's token names, or null on older phones. */
    public static String dynamicJson(Context c) {
        try {
            JSONObject o = new JSONObject();
            o.put("light", tones(c, false));
            o.put("dark", tones(c, true));
            return o.toString();
        } catch (Exception e) {
            return "";
        }
    }

    private static JSONObject tones(Context ctx, boolean dark) throws Exception {
        JSONObject j = new JSONObject();
        if (dark) {
            j.put("bg", hex(ctx.getColor(android.R.color.system_neutral1_900)));
            j.put("low", hex(ctx.getColor(android.R.color.system_neutral1_800)));
            j.put("cont", hex(ctx.getColor(android.R.color.system_neutral2_800)));
            j.put("high", hex(ctx.getColor(android.R.color.system_neutral2_700)));
            j.put("ink", hex(ctx.getColor(android.R.color.system_neutral1_50)));
            j.put("muted", hex(ctx.getColor(android.R.color.system_neutral2_200)));
            j.put("outline", hex(ctx.getColor(android.R.color.system_neutral2_500)));
            j.put("pri", hex(ctx.getColor(android.R.color.system_accent1_200)));
            j.put("on-pri", hex(ctx.getColor(android.R.color.system_accent1_800)));
            j.put("pri-c", hex(ctx.getColor(android.R.color.system_accent1_700)));
            j.put("on-pri-c", hex(ctx.getColor(android.R.color.system_accent1_100)));
            j.put("sec", hex(ctx.getColor(android.R.color.system_accent2_200)));
            j.put("sec-c", hex(ctx.getColor(android.R.color.system_accent2_700)));
            j.put("on-sec-c", hex(ctx.getColor(android.R.color.system_accent2_100)));
            j.put("p1", hex(ctx.getColor(android.R.color.system_accent3_200)));
            j.put("inv-pri", hex(ctx.getColor(android.R.color.system_accent1_600)));
            j.put("on-ev", hex(ctx.getColor(android.R.color.system_neutral1_900)));
        } else {
            j.put("bg", hex(ctx.getColor(android.R.color.system_neutral1_10)));
            j.put("low", hex(ctx.getColor(android.R.color.system_neutral1_50)));
            j.put("cont", hex(ctx.getColor(android.R.color.system_neutral2_50)));
            j.put("high", hex(ctx.getColor(android.R.color.system_neutral2_100)));
            j.put("ink", hex(ctx.getColor(android.R.color.system_neutral1_900)));
            j.put("muted", hex(ctx.getColor(android.R.color.system_neutral2_700)));
            j.put("outline", hex(ctx.getColor(android.R.color.system_neutral2_400)));
            j.put("pri", hex(ctx.getColor(android.R.color.system_accent1_600)));
            j.put("on-pri", hex(ctx.getColor(android.R.color.system_accent1_0)));
            j.put("pri-c", hex(ctx.getColor(android.R.color.system_accent1_100)));
            j.put("on-pri-c", hex(ctx.getColor(android.R.color.system_accent1_900)));
            j.put("sec", hex(ctx.getColor(android.R.color.system_accent2_600)));
            j.put("sec-c", hex(ctx.getColor(android.R.color.system_accent2_100)));
            j.put("on-sec-c", hex(ctx.getColor(android.R.color.system_accent2_900)));
            j.put("p1", hex(ctx.getColor(android.R.color.system_accent3_600)));
            j.put("inv-pri", hex(ctx.getColor(android.R.color.system_accent1_200)));
            j.put("on-ev", hex(ctx.getColor(android.R.color.system_accent1_0)));
        }
        return j;
    }

    /** One theme's colours as ints. */
    public static final class Palette {
        public final boolean dark;
        public final int bg, low, cont, high, ink, muted, outline, pri, onPri, priC, onPriC, sec, secC, onSecC, err, ok, warn;
        public final int[] ev;

        Palette(JSONObject t, boolean dark) {
            this.dark = dark;
            Palette f = fallback(dark);
            bg = col(t, "bg", f.bg);
            low = col(t, "low", f.low);
            cont = col(t, "cont", f.cont);
            high = col(t, "high", f.high);
            ink = col(t, "ink", f.ink);
            muted = col(t, "muted", f.muted);
            outline = col(t, "outline", f.outline);
            pri = col(t, "pri", f.pri);
            onPri = col(t, "on-pri", f.onPri);
            priC = col(t, "pri-c", f.priC);
            onPriC = col(t, "on-pri-c", f.onPriC);
            sec = col(t, "sec", f.sec);
            secC = col(t, "sec-c", f.secC);
            onSecC = col(t, "on-sec-c", f.onSecC);
            err = col(t, "err", f.err);
            ok = col(t, "ok", f.ok);
            warn = col(t, "warn", f.warn);
            int[] e = f.ev.clone();
            org.json.JSONArray a = t.optJSONArray("ev");
            if (a != null) for (int i = 0; i < Math.min(e.length, a.length()); i++) e[i] = parse(a.optString(i), e[i]);
            ev = e;
        }

        private Palette(boolean dark, int[] v, int[] ev) {
            this.dark = dark;
            bg = v[0]; low = v[1]; cont = v[2]; high = v[3]; ink = v[4]; muted = v[5]; outline = v[6];
            pri = v[7]; onPri = v[8]; priC = v[9]; onPriC = v[10]; sec = v[11]; secC = v[12]; onSecC = v[13];
            err = v[14]; ok = v[15]; warn = v[16];
            this.ev = ev;
        }

        static Palette fallback(boolean dark) {
            if (dark) return new Palette(true, new int[]{0xFF282828, 0xFF32302F, 0xFF3C3836, 0xFF504945, 0xFFEBDBB2, 0xFFAFA18E, 0xFF665C54,
                    0xFFFABD2F, 0xFF282828, 0xFF564929, 0xFFFBDC8E, 0xFF83A598, 0xFF3A4A48, 0xFFCFE3D9, 0xFFFB4934, 0xFFB8BB26, 0xFFFE8019},
                    new int[]{0xFF83A598, 0xFF8EC07C, 0xFFD3869B, 0xFFFE8019, 0xFFB8BB26, 0xFFFABD2F, 0xFFFB4934});
            return new Palette(false, new int[]{0xFFF4EFE5, 0xFFEBE5D8, 0xFFE3DCCB, 0xFFD8CFBB, 0xFF2B2B28, 0xFF676053, 0xFFB5AA93,
                    0xFFA8432F, 0xFFFFF8F0, 0xFFF0D5C9, 0xFF5A1D12, 0xFF3A6A8A, 0xFFD5E1E8, 0xFF16384D, 0xFFA3301F, 0xFF55733A, 0xFFA8641F},
                    new int[]{0xFF3A6A8A, 0xFF4F7A5A, 0xFF8A4F7D, 0xFFB8742A, 0xFF6B7F2A, 0xFF9A7A1A, 0xFFA8432F});
        }

        private static int col(JSONObject t, String k, int d) {
            return parse(t.optString(k, null), d);
        }

        static int parse(String s, int d) {
            if (s == null) return d;
            try {
                return android.graphics.Color.parseColor(s);
            } catch (RuntimeException e) {
                return d;
            }
        }
    }
}
