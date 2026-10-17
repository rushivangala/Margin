package io.github.rushivangala.margin;

import android.app.Activity;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.OpenableColumns;
import android.provider.Settings;
import android.view.ActionMode;
import android.view.KeyEvent;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import io.github.rushivangala.kit.KitShell;

/**
 * Margin: the web UI in assets/www plus a native bridge (window.Native, see Bridge).
 *
 * Routes served from https://app.local/ besides the bundled UI:
 * /book/ID/PATH  a file inside a book (strict CSP, see Books), /cover/ID a cover,
 * /pdf/ID/PAGE?w= a rendered PDF page, /raw/ID a text or Markdown book.
 */
public final class MainActivity extends Activity {
    static final String PREFS = "margin";
    static final int REQ_IMPORT = 11;
    static final int REQ_SAVE = 12;

    /** The page's own CSP: like the kit's, but it may frame book chapters from its own origin and fetch them for search. */
    static final String PAGE_CSP = "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self';"
            + " font-src 'self'; connect-src 'self'; frame-src 'self'; child-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'";

    ReaderView web;
    KitShell shell;
    Books books;
    final Handler main = new Handler(Looper.getMainLooper());
    private volatile String launch;
    private String importToken;
    private String saveToken;
    private String saveTextBody;
    volatile boolean reading;
    volatile boolean volumeKeys = true;

    /** WebView that hides the system's floating selection toolbar while reading (the reader shows its own). */
    static final class ReaderView extends WebView {
        volatile boolean ownSelectionMenu;

        ReaderView(Context c) {
            super(c);
        }

        @Override
        public ActionMode startActionMode(final ActionMode.Callback cb, int type) {
            if (!ownSelectionMenu) return super.startActionMode(cb, type);
            return super.startActionMode(new ActionMode.Callback2() {
                @Override
                public boolean onCreateActionMode(ActionMode m, Menu menu) {
                    cb.onCreateActionMode(m, menu);
                    menu.clear();
                    return true;
                }

                @Override
                public boolean onPrepareActionMode(ActionMode m, Menu menu) {
                    cb.onPrepareActionMode(m, menu);
                    menu.clear();
                    return true;
                }

                @Override
                public boolean onActionItemClicked(ActionMode m, MenuItem item) {
                    return cb.onActionItemClicked(m, item);
                }

                @Override
                public void onDestroyActionMode(ActionMode m) {
                    cb.onDestroyActionMode(m);
                }

                @Override
                public void onGetContentRect(ActionMode m, View v, android.graphics.Rect out) {
                    if (cb instanceof ActionMode.Callback2) ((ActionMode.Callback2) cb).onGetContentRect(m, v, out);
                    else super.onGetContentRect(m, v, out);
                }
            }, type);
        }
    }

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        books = Books.get(this);
        web = new ReaderView(this);
        setContentView(web);
        shell = new KitShell(this, web).install();
        web.addJavascriptInterface(new Bridge(this), "Native");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                // Nothing navigates: not the app, not a book chapter, not a link inside a book.
                return true;
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                try {
                    Uri u = r.getUrl();
                    if (!KitShell.HOST.equals(u.getHost()) || !"https".equals(u.getScheme())) return KitShell.notFound();
                    String path = u.getPath() == null ? "/" : u.getPath();
                    if (path.equals("/") || path.equals("/index.html")) return page();
                    WebResourceResponse res = route(u, path);
                    if (res != null) return res;
                    res = shell.serveAsset(r);
                    return res != null ? res : KitShell.notFound();
                } catch (Throwable e) {
                    return KitShell.notFound();
                }
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                shell.pageFinished();
            }
        });
        readLaunch(getIntent());
        shell.load("index.html");
    }

    private WebResourceResponse page() throws java.io.IOException {
        byte[] b;
        try (InputStream in = getAssets().open("www/index.html")) {
            b = Epub.readLimited(in, 1 << 20);
        }
        Map<String, String> h = new HashMap<>();
        h.put("Cache-Control", "no-store");
        h.put("Content-Security-Policy", PAGE_CSP);
        h.put("X-Content-Type-Options", "nosniff");
        return new WebResourceResponse("text/html", "utf-8", 200, "OK", h, new ByteArrayInputStream(b));
    }

    private WebResourceResponse route(Uri u, String path) throws Exception {
        if (path.startsWith("/book/")) {
            String rest = path.substring(6);
            int slash = rest.indexOf('/');
            if (slash <= 0) return KitShell.notFound();
            WebResourceResponse r = books.serve(rest.substring(0, slash), rest.substring(slash + 1), "1".equals(u.getQueryParameter("html")));
            return r != null ? r : KitShell.notFound();
        }
        if (path.startsWith("/cover/")) {
            WebResourceResponse r = books.cover(path.substring(7));
            return r != null ? r : KitShell.notFound();
        }
        if (path.startsWith("/pdf/")) {
            String[] p = path.substring(5).split("/");
            if (p.length != 2) return KitShell.notFound();
            int w = 1080;
            try {
                w = Integer.parseInt(u.getQueryParameter("w"));
            } catch (Exception ignored) {
            }
            WebResourceResponse r = books.pdf(p[0], Integer.parseInt(p[1]), w);
            return r != null ? r : KitShell.notFound();
        }
        if (path.startsWith("/raw/")) {
            WebResourceResponse r = books.raw(path.substring(5));
            return r != null ? r : KitShell.notFound();
        }
        if (path.startsWith("/fonts/")) {
            // Reading fonts bundled in assets/fonts (served like kit assets).
            String name = path.substring(7);
            if (!name.matches("[a-z0-9-]+\\.woff2")) return KitShell.notFound();
            InputStream in = getAssets().open("fonts/" + name);
            return KitShell.response("font/woff2", in, true);
        }
        return null;
    }

    // ---------------------------------------------------------------- launches: books opened or shared from other apps

    private void readLaunch(final Intent i) {
        if (i == null) return;
        String action = i.getAction();
        final List<Uri> uris = new ArrayList<>();
        if (Intent.ACTION_VIEW.equals(action) && i.getData() != null) uris.add(i.getData());
        else if (Intent.ACTION_SEND.equals(action)) {
            Uri u = i.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
            if (u != null) uris.add(u);
        } else if (Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            ArrayList<Uri> list = i.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri.class);
            if (list != null) uris.addAll(list);
        } else if (i.getStringExtra("open") != null) {
            try {
                launch = new JSONObject().put("open", i.getStringExtra("open")).put("id", i.getStringExtra("id")).put("n", System.nanoTime()).toString();
            } catch (Exception ignored) {
            }
            return;
        }
        if (uris.isEmpty()) return;
        final String type = i.getType();
        new Thread(new Runnable() {
            @Override
            public void run() {
                JSONArray ids = new JSONArray();
                String error = null;
                for (Uri u : uris) {
                    try {
                        Library.Entry e = importUri(u, type);
                        ids.put(e.id);
                    } catch (Exception ex) {
                        error = ex.getMessage();
                    }
                }
                try {
                    JSONObject o = new JSONObject().put("open", "book").put("ids", ids).put("n", System.nanoTime());
                    if (error != null) o.put("error", error);
                    launch = o.toString();
                } catch (Exception ignored) {
                }
                emit("{\"type\":\"launch\"}");
            }
        }, "import").start();
    }

    String takeLaunch() {
        String s = launch;
        launch = null;
        return s == null ? "" : s;
    }

    Library.Entry importUri(Uri u, String type) throws Exception {
        String name = displayName(u);
        if (name == null || Library.formatOf(name) == null) name = guessName(name, type != null ? type : getContentResolver().getType(u));
        try (InputStream in = getContentResolver().openInputStream(u)) {
            if (in == null) throw new java.io.IOException("Could not open the file");
            return books.importStream(in, name, importFolder());
        }
    }

    private String displayName(Uri u) {
        if ("file".equals(u.getScheme())) return u.getLastPathSegment();
        try (Cursor c = getContentResolver().query(u, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) {
        }
        return u.getLastPathSegment();
    }

    static String guessName(String name, String mime) {
        String base = name == null || name.isEmpty() ? "Book" : name;
        if (mime == null) return base;
        switch (mime) {
            case "application/epub+zip":
                return base + ".epub";
            case "application/pdf":
                return base + ".pdf";
            case "text/markdown":
                return base + ".md";
            case "text/html":
                return base + ".html";
            case "application/vnd.comicbook+zip":
            case "application/x-cbz":
                return base + ".cbz";
            case "text/plain":
                return base + ".txt";
            default:
                return base;
        }
    }

    /** Imported books go to the Books folder (so Files sees them) when Margin may use it; otherwise to private storage. */
    File importFolder() {
        if (Environment.isExternalStorageManager()) {
            File d = new File(Environment.getExternalStorageDirectory(), "Books");
            //noinspection ResultOfMethodCallIgnored
            d.mkdirs();
            if (d.isDirectory() && d.canWrite()) return d;
        }
        return books.imported();
    }

    void pickBooks(String token) {
        importToken = token;
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
                .putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/epub+zip", "application/pdf", "text/plain", "text/markdown", "text/html",
                        "application/vnd.comicbook+zip", "application/x-cbz", "application/zip", "application/octet-stream"})
                .putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        try {
            startActivityForResult(i, REQ_IMPORT);
        } catch (Exception e) {
            importToken = null;
            emitResult("import", token, false, "\"error\":\"No file picker on this phone\"");
        }
    }

    void saveText(final String name, final String mime, final String text, final String token) {
        main.post(new Runnable() {
            @Override
            public void run() {
                saveToken = token;
                saveTextBody = text;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                        .setType(mime == null || mime.isEmpty() ? "text/markdown" : mime).putExtra(Intent.EXTRA_TITLE, name);
                try {
                    startActivityForResult(i, REQ_SAVE);
                } catch (Exception e) {
                    saveToken = null;
                    saveTextBody = null;
                    emitResult("save", token, false, "\"error\":\"No file picker on this phone\"");
                }
            }
        });
    }

    @Override
    protected void onActivityResult(int req, int result, final Intent data) {
        super.onActivityResult(req, result, data);
        if (req == REQ_SAVE) {
            final String token = saveToken, body = saveTextBody;
            saveToken = null;
            saveTextBody = null;
            if (token == null) return;
            if (result != RESULT_OK || data == null || data.getData() == null || body == null) {
                emitResult("save", token, false, null);
                return;
            }
            new Thread(new Runnable() {
                @Override
                public void run() {
                    try (java.io.OutputStream out = getContentResolver().openOutputStream(data.getData(), "wt")) {
                        if (out == null) throw new java.io.IOException("Could not write the file");
                        out.write(body.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                        emitResult("save", token, true, null);
                    } catch (Exception e) {
                        emitResult("save", token, false, "\"error\":" + JSONObject.quote(String.valueOf(e.getMessage())));
                    }
                }
            }, "save").start();
            return;
        }
        if (req != REQ_IMPORT) return;
        final String token = importToken;
        importToken = null;
        if (token == null) return;
        if (result != RESULT_OK || data == null) {
            emitResult("import", token, false, null);
            return;
        }
        final List<Uri> uris = new ArrayList<>();
        ClipData clip = data.getClipData();
        if (clip != null) for (int k = 0; k < clip.getItemCount(); k++) uris.add(clip.getItemAt(k).getUri());
        else if (data.getData() != null) uris.add(data.getData());
        new Thread(new Runnable() {
            @Override
            public void run() {
                JSONArray ids = new JSONArray();
                JSONArray errors = new JSONArray();
                for (Uri u : uris) {
                    try {
                        ids.put(importUri(u, null).id);
                    } catch (Exception ex) {
                        errors.put(String.valueOf(ex.getMessage()));
                    }
                }
                emitResult("import", token, ids.length() > 0, "\"ids\":" + ids + ",\"errors\":" + errors);
            }
        }, "import").start();
    }

    // ---------------------------------------------------------------- lifecycle

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        readLaunch(intent);
        emit("{\"type\":\"launch\"}");
    }

    @Override
    protected void onResume() {
        super.onResume();
        shell.resumed();
        emit("{\"type\":\"resume\"}");
    }

    @Override
    protected void onPause() {
        super.onPause();
        emit("{\"type\":\"pause\"}");
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

    /** Volume keys turn pages while a book is open (if the reader wants that). */
    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int k = e.getKeyCode();
        if (reading && volumeKeys && (k == KeyEvent.KEYCODE_VOLUME_DOWN || k == KeyEvent.KEYCODE_VOLUME_UP)) {
            if (e.getAction() == KeyEvent.ACTION_DOWN) emit("{\"type\":\"key\",\"dir\":" + (k == KeyEvent.KEYCODE_VOLUME_DOWN ? 1 : -1) + "}");
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    void setReading(final boolean on, boolean volume) {
        reading = on;
        volumeKeys = volume;
        main.post(new Runnable() {
            @Override
            public void run() {
                if (web != null) web.ownSelectionMenu = on;
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
        });
    }

    void requestAllFiles() {
        try {
            startActivity(new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:" + getPackageName())));
        } catch (Exception e) {
            startActivity(new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION));
        }
    }

    // ---------------------------------------------------------------- JS events

    void emit(final String json) {
        main.post(new Runnable() {
            @Override
            public void run() {
                if (web != null && shell.isReady()) web.evaluateJavascript("window.app&&app.onNative(" + json + ")", null);
            }
        });
    }

    void emitResult(String type, String token, boolean ok, String extra) {
        emit("{\"type\":\"" + type + "\",\"token\":" + JSONObject.quote(token) + ",\"ok\":" + ok + (extra == null ? "" : "," + extra) + "}");
    }

    SharedPreferences prefs() {
        return getSharedPreferences(PREFS, 0);
    }

    /** Folders to scan for books; Books and Download by default. */
    List<File> folders() {
        List<File> out = new ArrayList<>();
        String json = prefs().getString("folders", null);
        File root = Environment.getExternalStorageDirectory();
        if (json == null) {
            out.add(new File(root, "Books"));
            out.add(new File(root, Environment.DIRECTORY_DOWNLOADS));
            return out;
        }
        try {
            JSONArray a = new JSONArray(json);
            for (int i = 0; i < a.length(); i++) out.add(new File(a.getString(i)));
        } catch (Exception ignored) {
        }
        return out;
    }
}
