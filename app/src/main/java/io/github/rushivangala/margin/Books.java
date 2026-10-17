package io.github.rushivangala.margin;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * Opens books and serves their contents to the reader.
 *
 * Book content is untrusted. Every response for book content carries a Content-Security-Policy
 * that allows nothing but the book's own images, styles and fonts from https://app.local/ — no
 * scripts, no frames, no forms, no network. The reader shows it in an iframe sandboxed without
 * allow-scripts, and the activity refuses every navigation, so a malicious book stays inert.
 */
final class Books {
    static final String BOOK_CSP = "default-src 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; media-src 'self';"
            + " script-src 'none'; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; connect-src 'none'; form-action 'none'; base-uri 'none'";

    private static Books instance;
    final Context app;
    final Library library;
    final Store store;
    private final File covers;

    /** A few open archives, most recent last (books are opened and reopened while paging). */
    private final LinkedHashMap<String, Open> open = new LinkedHashMap<>(4, 0.75f, true);

    static final class Open {
        final ZipFile zip;
        final Epub epub; // null for CBZ and broken books

        Open(ZipFile zip, Epub epub) {
            this.zip = zip;
            this.epub = epub;
        }
    }

    static synchronized Books get(Context c) {
        if (instance == null) instance = new Books(c.getApplicationContext());
        return instance;
    }

    private Books(Context app) {
        this.app = app;
        this.library = new Library(new File(app.getFilesDir(), "library.tsv"));
        this.store = new Store(new File(app.getFilesDir(), "data"));
        this.covers = new File(app.getFilesDir(), "covers");
        //noinspection ResultOfMethodCallIgnored
        covers.mkdirs();
    }

    File imported() {
        File d = new File(app.getFilesDir(), "imported");
        //noinspection ResultOfMethodCallIgnored
        d.mkdirs();
        return d;
    }

    Library.Entry entry(String id) {
        return id == null ? null : library.get(id);
    }

    synchronized Open zip(String id) throws IOException {
        Open o = open.get(id);
        if (o != null) return o;
        Library.Entry e = entry(id);
        if (e == null) throw new IOException("Unknown book");
        ZipFile z = new ZipFile(e.file);
        Epub ep = null;
        if ("epub".equals(e.format)) {
            try {
                ep = Epub.open(z);
            } catch (IOException bad) {
                z.close();
                throw bad;
            }
        }
        o = new Open(z, ep);
        open.put(id, o);
        while (open.size() > 3) {
            String oldest = open.keySet().iterator().next();
            Open old = open.remove(oldest);
            try {
                old.zip.close();
            } catch (IOException ignored) {
            }
        }
        return o;
    }

    /** The book's structure for the reader (EPUB: spine and contents; CBZ: page list). */
    String structure(String id) {
        try {
            Library.Entry e = entry(id);
            if (e == null) return "{\"error\":\"This book is no longer in the library\"}";
            if ("epub".equals(e.format)) return zip(id).epub.json();
            if ("cbz".equals(e.format)) {
                List<String> pages = cbzPages(zip(id).zip);
                StringBuilder b = new StringBuilder("{\"pages\":[");
                for (int i = 0; i < pages.size(); i++) b.append(i == 0 ? "" : ",").append(Epub.quote(pages.get(i)));
                return b.append("]}").toString();
            }
            return "{}";
        } catch (Epub.BadBook bad) {
            return "{\"error\":" + Epub.quote("This EPUB can’t be read: " + bad.getMessage()) + "}";
        } catch (Exception ex) {
            return "{\"error\":" + Epub.quote("This book can’t be opened: " + ex.getMessage()) + "}";
        }
    }

    static List<String> cbzPages(ZipFile z) {
        List<String> out = new ArrayList<>();
        for (java.util.Enumeration<? extends ZipEntry> en = z.entries(); en.hasMoreElements(); ) {
            ZipEntry e = en.nextElement();
            String n = e.getName().toLowerCase(Locale.ROOT);
            if (!e.isDirectory() && !n.contains("__macosx") && n.matches(".*\\.(jpe?g|png|webp|gif)$")) out.add(e.getName());
        }
        Collections.sort(out, new java.util.Comparator<String>() {
            @Override
            public int compare(String a, String b) {
                return naturalCompare(a, b);
            }
        });
        return out;
    }

    /** "page2" before "page10". */
    static int naturalCompare(String a, String b) {
        int i = 0, j = 0;
        while (i < a.length() && j < b.length()) {
            char x = a.charAt(i), y = b.charAt(j);
            if (Character.isDigit(x) && Character.isDigit(y)) {
                int si = i, sj = j;
                while (i < a.length() && Character.isDigit(a.charAt(i))) i++;
                while (j < b.length() && Character.isDigit(b.charAt(j))) j++;
                String na = a.substring(si, i).replaceFirst("^0+(?=.)", ""), nb = b.substring(sj, j).replaceFirst("^0+(?=.)", "");
                if (na.length() != nb.length()) return na.length() - nb.length();
                int c = na.compareTo(nb);
                if (c != 0) return c;
            } else {
                int c = Character.toLowerCase(x) - Character.toLowerCase(y);
                if (c != 0) return c;
                i++;
                j++;
            }
        }
        return (a.length() - i) - (b.length() - j);
    }

    // ---------------------------------------------------------------- serving book content

    static WebResourceResponse respond(String mime, byte[] body, boolean cache) {
        Map<String, String> h = new HashMap<>();
        h.put("Cache-Control", cache ? "private, max-age=3600" : "no-store");
        h.put("Content-Security-Policy", BOOK_CSP);
        h.put("X-Content-Type-Options", "nosniff");
        h.put("Referrer-Policy", "no-referrer");
        boolean text = mime.startsWith("text/") || mime.contains("xml") || mime.contains("json");
        return new WebResourceResponse(mime, text ? "utf-8" : null, 200, "OK", h, new ByteArrayInputStream(body));
    }

    private static final Pattern META_REFRESH = Pattern.compile("<meta[^>]+http-equiv\\s*=\\s*[\"']?refresh[^>]*>", Pattern.CASE_INSENSITIVE);
    private static final Pattern BASE = Pattern.compile("<base\\b[^>]*>", Pattern.CASE_INSENSITIVE);

    /** /book/ID/entry/path — a file from inside the book. ?html=1 serves a malformed XHTML chapter as HTML. */
    WebResourceResponse serve(String id, String entry, boolean asHtml) throws IOException {
        Library.Entry e = entry(id);
        if (e == null) return null;
        if ("html".equals(e.format)) {
            // A single HTML file is its own one-chapter book.
            byte[] b;
            try (InputStream in = new FileInputStream(e.file)) {
                b = Epub.readLimited(in, 16 * 1024 * 1024);
            }
            return respond("text/html", sanitize(Epub.decode(b)).getBytes(StandardCharsets.UTF_8), false);
        }
        Open o = zip(id);
        byte[] b = Epub.read(o.zip, entry);
        if (b == null) return null;
        String type = o.epub != null ? o.epub.typeOf(entry) : Epub.guessType(entry);
        if (type.equals("application/xhtml+xml") || type.equals("text/html") || type.equals("application/x-dtbook+xml")) {
            String s = sanitize(Epub.decode(b));
            if (!asHtml) s = Epub.htmlEntities(s); // XML has no &nbsp;; turn named entities into characters
            return respond(asHtml ? "text/html" : "application/xhtml+xml", s.getBytes(StandardCharsets.UTF_8), true);
        }
        if (type.equals("text/css")) return respond("text/css", b, true);
        if (type.startsWith("image/") || type.startsWith("font/") || type.startsWith("audio/") || type.startsWith("video/")
                || type.equals("application/font-woff") || type.equals("application/vnd.ms-opentype") || type.equals("application/x-font-ttf")) {
            return respond(type.equals("image/svg+xml") ? "image/svg+xml" : type, b, true);
        }
        return null;
    }

    /** Belt and braces: the CSP already blocks these, but they should not even be there. */
    static String sanitize(String s) {
        s = META_REFRESH.matcher(s).replaceAll("");
        return BASE.matcher(s).replaceAll("");
    }

    /** /raw/ID — a plain text or Markdown book as text for the reader to lay out. */
    WebResourceResponse raw(String id) throws IOException {
        Library.Entry e = entry(id);
        if (e == null || !("txt".equals(e.format) || "md".equals(e.format))) return null;
        byte[] b;
        try (InputStream in = new FileInputStream(e.file)) {
            b = Epub.readLimited(in, 32 * 1024 * 1024);
        }
        String s = looksUtf8(b) ? new String(b, StandardCharsets.UTF_8) : new String(b, "windows-1252");
        return respond("text/plain", s.replace("\uFEFF", "").getBytes(StandardCharsets.UTF_8), false);
    }

    static boolean looksUtf8(byte[] b) {
        java.nio.charset.CharsetDecoder d = StandardCharsets.UTF_8.newDecoder();
        try {
            d.decode(java.nio.ByteBuffer.wrap(b, 0, Math.min(b.length, 1 << 20)));
            return true;
        } catch (java.nio.charset.CharacterCodingException ex) {
            // a cut multi-byte character at the 1 MB boundary is fine
            return b.length > (1 << 20);
        }
    }

    // ---------------------------------------------------------------- covers

    /** /cover/ID — a small JPEG, made once and kept. Returns null when the book has no cover. */
    WebResourceResponse cover(String id) {
        File f = new File(covers, id + ".jpg");
        File none = new File(covers, id + ".none");
        if (none.exists()) return null;
        try {
            if (!f.exists()) {
                Bitmap bm = makeCover(id);
                if (bm == null) {
                    //noinspection ResultOfMethodCallIgnored
                    none.createNewFile();
                    return null;
                }
                try (FileOutputStream out = new FileOutputStream(f)) {
                    bm.compress(Bitmap.CompressFormat.JPEG, 84, out);
                }
                bm.recycle();
            }
            try (InputStream in = new FileInputStream(f)) {
                return respond("image/jpeg", Epub.readLimited(in, 4 * 1024 * 1024), true);
            }
        } catch (Throwable t) {
            return null;
        }
    }

    private Bitmap makeCover(String id) throws IOException {
        Library.Entry e = entry(id);
        if (e == null) return null;
        if ("pdf".equals(e.format)) return pdfPage(e.file, 0, 480);
        if (!"epub".equals(e.format) && !"cbz".equals(e.format)) return null;
        Open o = zip(id);
        String path = "";
        if (o.epub != null) path = o.epub.cover;
        else {
            List<String> pages = cbzPages(o.zip);
            if (!pages.isEmpty()) path = pages.get(0);
        }
        if (path.isEmpty() || path.toLowerCase(Locale.ROOT).endsWith(".svg")) return null;
        byte[] b = Epub.read(o.zip, path);
        if (b == null) return null;
        BitmapFactory.Options opt = new BitmapFactory.Options();
        opt.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(b, 0, b.length, opt);
        int sample = 1;
        while (opt.outWidth / (sample * 2) >= 480) sample *= 2;
        opt = new BitmapFactory.Options();
        opt.inSampleSize = sample;
        Bitmap bm = BitmapFactory.decodeByteArray(b, 0, b.length, opt);
        if (bm == null) return null;
        if (bm.getWidth() > 480) {
            Bitmap s = Bitmap.createScaledBitmap(bm, 480, Math.max(1, bm.getHeight() * 480 / bm.getWidth()), true);
            bm.recycle();
            bm = s;
        }
        return bm;
    }

    void forgetCover(String id) {
        //noinspection ResultOfMethodCallIgnored
        new File(covers, id + ".jpg").delete();
        //noinspection ResultOfMethodCallIgnored
        new File(covers, id + ".none").delete();
    }

    // ---------------------------------------------------------------- PDF

    static Bitmap pdfPage(File f, int page, int width) throws IOException {
        try (ParcelFileDescriptor pfd = ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
             PdfRenderer r = new PdfRenderer(pfd)) {
            if (page < 0 || page >= r.getPageCount()) return null;
            try (PdfRenderer.Page p = r.openPage(page)) {
                int w = Math.max(64, Math.min(2400, width));
                int h = Math.max(1, Math.round(w * (float) p.getHeight() / p.getWidth()));
                Bitmap bm = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
                new Canvas(bm).drawColor(Color.WHITE);
                p.render(bm, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                return bm;
            }
        }
    }

    /** /pdf/ID/PAGE?w=WIDTH — one page as an image. */
    WebResourceResponse pdf(String id, int page, int width) throws IOException {
        Library.Entry e = entry(id);
        if (e == null || !"pdf".equals(e.format)) return null;
        Bitmap bm = pdfPage(e.file, page, width);
        if (bm == null) return null;
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bm.compress(Bitmap.CompressFormat.JPEG, 88, out);
        bm.recycle();
        return respond("image/jpeg", out.toByteArray(), true);
    }

    /** Page count and page sizes (in points) as JSON. */
    String pdfInfo(String id) {
        Library.Entry e = entry(id);
        if (e == null || !"pdf".equals(e.format)) return "{\"error\":\"Not a PDF\"}";
        try (ParcelFileDescriptor pfd = ParcelFileDescriptor.open(e.file, ParcelFileDescriptor.MODE_READ_ONLY);
             PdfRenderer r = new PdfRenderer(pfd)) {
            StringBuilder b = new StringBuilder("{\"pages\":").append(r.getPageCount()).append(",\"sizes\":[");
            for (int i = 0; i < r.getPageCount(); i++) {
                try (PdfRenderer.Page p = r.openPage(i)) {
                    b.append(i == 0 ? "" : ",").append('[').append(p.getWidth()).append(',').append(p.getHeight()).append(']');
                }
            }
            return b.append("],\"text\":").append(Build.VERSION.SDK_INT >= 35).append('}').toString();
        } catch (SecurityException se) {
            return "{\"error\":\"This PDF is password-protected\"}";
        } catch (Exception ex) {
            return "{\"error\":" + Epub.quote("This PDF can’t be opened: " + ex.getMessage()) + "}";
        }
    }

    /** Text of each page as JSON [[ "line", ... ], ...], using the platform text API (Android 15+). */
    String pdfText(String id) {
        Library.Entry e = entry(id);
        if (e == null || !"pdf".equals(e.format)) return "{\"error\":\"Not a PDF\"}";
        if (Build.VERSION.SDK_INT < 35) return "{\"error\":\"Flowing text needs Android 15 or newer\"}";
        return PdfText.extract(e.file);
    }

    // ---------------------------------------------------------------- importing

    /** Copies a stream into the imported folder under its own name (made unique) and registers it. */
    Library.Entry importStream(InputStream in, String name, File into) throws IOException {
        if (name == null || Library.formatOf(name) == null) throw new IOException("Margin opens EPUB, PDF, text, Markdown, HTML and CBZ books");
        name = name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
        if (into == null) into = imported();
        //noinspection ResultOfMethodCallIgnored
        into.mkdirs();
        File tmp = new File(into, ".incoming-" + System.nanoTime());
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            byte[] buf = new byte[65536];
            int n;
            long total = 0;
            while ((n = in.read(buf)) > 0) {
                out.write(buf, 0, n);
                total += n;
                if (total > 1024L * 1024 * 1024) throw new IOException("This file is too large");
            }
        } catch (IOException ex) {
            //noinspection ResultOfMethodCallIgnored
            tmp.delete();
            throw ex;
        }
        // Already in the library (same content)? Use that copy and drop this one.
        String id = Library.idOf(tmp);
        Library.Entry have = library.get(id);
        if (have != null && have.file.exists()) {
            //noinspection ResultOfMethodCallIgnored
            tmp.delete();
            return have;
        }
        File dest = new File(into, name);
        int dot = name.lastIndexOf('.');
        for (int i = 2; dest.exists(); i++) dest = new File(into, name.substring(0, dot) + " (" + i + ")" + name.substring(dot));
        if (!tmp.renameTo(dest)) {
            //noinspection ResultOfMethodCallIgnored
            tmp.delete();
            throw new IOException("Could not save the book");
        }
        return library.add(dest);
    }
}
