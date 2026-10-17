package io.github.rushivangala.margin;

import android.content.pm.PackageInfo;
import android.os.Build;
import android.os.Environment;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/** window.Native: everything the web UI asks of Android. Slow work runs off the UI thread and replies by token. */
public final class Bridge {
    private final MainActivity a;

    Bridge(MainActivity a) {
        this.a = a;
    }

    private void bg(Runnable r) {
        new Thread(r, "bridge").start();
    }

    // ---------------------------------------------------------------- status

    @JavascriptInterface
    public String version() {
        try {
            return a.getPackageManager().getPackageInfo(a.getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "";
        }
    }

    @JavascriptInterface
    public String status() {
        JSONObject o = new JSONObject();
        try {
            o.put("version", version());
            o.put("allFiles", Environment.isExternalStorageManager());
            o.put("noInternet", noInternet());
            o.put("sdk", Build.VERSION.SDK_INT);
            o.put("pdfText", Build.VERSION.SDK_INT >= 35);
            JSONArray f = new JSONArray();
            for (File d : a.folders()) f.put(d.getAbsolutePath());
            o.put("folders", f);
            o.put("root", Environment.getExternalStorageDirectory().getAbsolutePath());
        } catch (Exception ignored) {
        }
        return o.toString();
    }

    private boolean noInternet() {
        try {
            PackageInfo pi = a.getPackageManager().getPackageInfo(a.getPackageName(), android.content.pm.PackageManager.GET_PERMISSIONS);
            if (pi.requestedPermissions == null) return true;
            for (String p : pi.requestedPermissions) if (android.Manifest.permission.INTERNET.equals(p)) return false;
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @JavascriptInterface
    public String takeLaunch() {
        return a.takeLaunch();
    }

    // ---------------------------------------------------------------- library

    /** Scans the chosen folders plus imported books; replies {books:[...]} by token. */
    @JavascriptInterface
    public void library(final String token) {
        bg(new Runnable() {
            @Override
            public void run() {
                List<File> roots = new ArrayList<>();
                if (Environment.isExternalStorageManager()) roots.addAll(a.folders());
                roots.add(a.books.imported());
                List<Library.Entry> list = a.books.library.scan(roots, null);
                a.emitResult("library", token, true, "\"books\":" + a.books.library.json(list));
            }
        });
    }

    @JavascriptInterface
    public void importBooks(String token) {
        a.pickBooks(token);
    }

    @JavascriptInterface
    public void requestAllFiles() {
        a.requestAllFiles();
    }

    @JavascriptInterface
    public void setFolders(String json) {
        try {
            JSONArray in = new JSONArray(json), out = new JSONArray();
            for (int i = 0; i < in.length(); i++) {
                File f = new File(in.getString(i));
                if (f.isAbsolute()) out.put(f.getAbsolutePath());
            }
            a.prefs().edit().putString("folders", out.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    /** Sub-folders of a folder, for the in-app folder chooser: {path, parent, dirs:[name...]}. */
    @JavascriptInterface
    public String listDirs(String path) {
        JSONObject o = new JSONObject();
        try {
            File root = Environment.getExternalStorageDirectory();
            File d = path == null || path.isEmpty() ? root : new File(path);
            if (!d.getCanonicalPath().startsWith(root.getCanonicalPath())) d = root;
            o.put("path", d.getAbsolutePath());
            o.put("parent", d.getCanonicalPath().equals(root.getCanonicalPath()) ? "" : d.getParent());
            JSONArray dirs = new JSONArray();
            File[] kids = d.listFiles();
            if (kids != null) {
                Arrays.sort(kids, (x, y) -> x.getName().compareToIgnoreCase(y.getName()));
                for (File k : kids) if (k.isDirectory() && !k.getName().startsWith(".") && !(d.equals(root) && k.getName().equals("Android"))) dirs.put(k.getName());
            }
            o.put("dirs", dirs);
        } catch (Exception e) {
            try {
                o.put("error", String.valueOf(e.getMessage()));
            } catch (Exception ignored) {
            }
        }
        return o.toString();
    }

    /** Book structure: EPUB spine and contents, or CBZ pages. */
    @JavascriptInterface
    public String structure(String id) {
        return a.books.structure(id);
    }

    @JavascriptInterface
    public String pdfInfo(String id) {
        return a.books.pdfInfo(id);
    }

    @JavascriptInterface
    public void pdfText(final String id, final String token) {
        bg(new Runnable() {
            @Override
            public void run() {
                a.emitResult("pdfText", token, true, "\"text\":" + a.books.pdfText(id));
            }
        });
    }

    @JavascriptInterface
    public void forgetCover(String id) {
        a.books.forgetCover(id);
    }

    // ---------------------------------------------------------------- reading state

    @JavascriptInterface
    public void setReading(boolean on, boolean volumeKeys) {
        a.setReading(on, volumeKeys);
    }

    // ---------------------------------------------------------------- documents (JSON owned by the web UI)

    @JavascriptInterface
    public String load(String key) {
        return a.books.store.get(key);
    }

    @JavascriptInterface
    public boolean save(String key, String json) {
        return a.books.store.put(key, json);
    }

    @JavascriptInterface
    public boolean remove(String key) {
        return a.books.store.remove(key);
    }

    @JavascriptInterface
    public String keys(String prefix) {
        return new JSONArray(Arrays.asList(a.books.store.keys(prefix == null ? "" : prefix.toLowerCase(Locale.ROOT)))).toString();
    }
}
