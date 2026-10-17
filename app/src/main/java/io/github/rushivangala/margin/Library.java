package io.github.rushivangala.margin;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.RandomAccessFile;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipFile;

/**
 * Finds books in the folders the reader chose and keeps a cache of what it learned about each
 * file (id, format, title, author, series, cover), so a rescan only opens new or changed files.
 *
 * A book's id comes from its size and first 64 KB, not its path, so moving or renaming a file
 * keeps its reading position, highlights and notes. Plain Java, unit-tested on the JVM.
 */
public final class Library {
    public static final String[] FORMATS = {"epub", "pdf", "txt", "md", "markdown", "html", "htm", "xhtml", "cbz"};
    static final int MAX_DEPTH = 8;

    public static final class Entry {
        public final File file;
        public final String id;
        public final String format;
        public final long size;
        public final long mtime;
        /** JSON object with title, author, series, seriesIndex, language, cover (zip entry). */
        public final String meta;

        Entry(File file, String id, String format, long size, long mtime, String meta) {
            this.file = file;
            this.id = id;
            this.format = format;
            this.size = size;
            this.mtime = mtime;
            this.meta = meta;
        }
    }

    private final File cacheFile;
    private final Map<String, Entry> byPath = new HashMap<>();
    private final Map<String, Entry> byId = new LinkedHashMap<>();

    public Library(File cacheFile) {
        this.cacheFile = cacheFile;
        load();
    }

    public static String formatOf(String name) {
        String n = name.toLowerCase(Locale.ROOT);
        int dot = n.lastIndexOf('.');
        if (dot < 0) return null;
        String ext = n.substring(dot + 1);
        for (String f : FORMATS) {
            if (f.equals(ext)) {
                if (ext.equals("markdown")) return "md";
                if (ext.equals("htm") || ext.equals("xhtml")) return "html";
                return ext;
            }
        }
        return null;
    }

    // ---------------------------------------------------------------- scanning

    /** Walks the roots (and extra single files) and returns every book, newest cache first. */
    public synchronized List<Entry> scan(List<File> roots, List<File> extra) {
        List<File> found = new ArrayList<>();
        for (File r : roots) walk(r, 0, found);
        if (extra != null) for (File f : extra) if (f.isFile() && formatOf(f.getName()) != null) found.add(f);
        List<Entry> out = new ArrayList<>();
        Map<String, Entry> seen = new LinkedHashMap<>();
        boolean changed = false;
        for (File f : found) {
            String key = f.getAbsolutePath();
            Entry e = byPath.get(key);
            if (e == null || e.size != f.length() || e.mtime != f.lastModified()) {
                Entry fresh = describe(f);
                if (fresh == null) continue;
                e = fresh;
                byPath.put(key, e);
                changed = true;
            }
            // The same book in two folders shows once.
            if (!seen.containsKey(e.id)) {
                seen.put(e.id, e);
                out.add(e);
            }
        }
        // forget files that are gone
        List<String> gone = new ArrayList<>();
        for (String p : byPath.keySet()) if (!new File(p).exists()) gone.add(p);
        for (String p : gone) byPath.remove(p);
        if (!gone.isEmpty()) changed = true;
        byId.clear();
        byId.putAll(seen);
        if (changed) save();
        return out;
    }

    private static void walk(File dir, int depth, List<File> out) {
        if (depth > MAX_DEPTH || dir == null) return;
        File[] list = dir.listFiles();
        if (list == null) return;
        for (File f : list) {
            String n = f.getName();
            if (n.startsWith(".")) continue;
            if (f.isDirectory()) {
                if (depth == 0 && n.equals("Android")) continue; // app-private data, never books
                walk(f, depth + 1, out);
            } else if (formatOf(n) != null && f.length() > 0) out.add(f);
        }
    }

    public synchronized Entry get(String id) {
        return byId.get(id);
    }

    /** Registers one file (an import) without a full rescan. */
    public synchronized Entry add(File f) {
        Entry e = describe(f);
        if (e == null) return null;
        byPath.put(f.getAbsolutePath(), e);
        if (!byId.containsKey(e.id)) byId.put(e.id, e);
        save();
        return byId.get(e.id);
    }

    // ---------------------------------------------------------------- identity and metadata

    public static String idOf(File f) throws IOException {
        try (InputStream in = new FileInputStream(f)) {
            MessageDigest md = MessageDigest.getInstance("SHA-1");
            md.update(Long.toString(f.length()).getBytes(StandardCharsets.US_ASCII));
            byte[] buf = new byte[65536];
            int total = 0, n;
            while (total < buf.length && (n = in.read(buf, total, buf.length - total)) > 0) total += n;
            md.update(buf, 0, total);
            byte[] d = md.digest();
            StringBuilder b = new StringBuilder();
            for (int i = 0; i < 8; i++) b.append(String.format(Locale.ROOT, "%02x", d[i]));
            return b.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IOException(e);
        }
    }

    static Entry describe(File f) {
        String format = formatOf(f.getName());
        if (format == null) return null;
        try {
            String id = idOf(f);
            String meta;
            switch (format) {
                case "epub":
                    meta = epubMeta(f);
                    break;
                case "pdf":
                    meta = pdfMeta(f);
                    break;
                case "txt":
                case "md":
                    meta = textMeta(f);
                    break;
                default:
                    meta = nameMeta(f);
            }
            if (meta == null) return null;
            return new Entry(f, id, format, f.length(), f.lastModified(), meta);
        } catch (IOException e) {
            return null;
        }
    }

    static String baseName(File f) {
        String n = f.getName();
        int dot = n.lastIndexOf('.');
        if (dot > 0) n = n.substring(0, dot);
        return n.replace('_', ' ').replaceAll("\\s+", " ").trim();
    }

    /** "Author - Title" or "Title" from a file name. */
    static String nameMeta(File f) {
        String n = baseName(f), author = "", title = n;
        int dash = n.indexOf(" - ");
        if (dash > 0) {
            author = n.substring(0, dash).trim();
            title = n.substring(dash + 3).trim();
        }
        return meta(title, author, "", 0, "", "", false);
    }

    static String epubMeta(File f) {
        try (ZipFile z = new ZipFile(f)) {
            Epub e = Epub.open(z);
            String title = e.title.isEmpty() ? baseName(f) : e.title;
            return meta(title, e.author, e.series, e.seriesIndex, e.language, e.cover, false);
        } catch (IOException e) {
            // Not a readable EPUB: still list it so the reader sees it and gets a clear message.
            return meta(baseName(f), "", "", 0, "", "", true);
        }
    }

    private static final Pattern PDF_TITLE = Pattern.compile("/Title\\s*\\(((?:\\\\.|[^\\\\)])*)\\)");
    private static final Pattern PDF_AUTHOR = Pattern.compile("/Author\\s*\\(((?:\\\\.|[^\\\\)])*)\\)");

    /** The PDF Info dictionary usually sits near the end of the file; read its plain-string Title and Author. */
    static String pdfMeta(File f) throws IOException {
        String tail;
        try (RandomAccessFile r = new RandomAccessFile(f, "r")) {
            long len = r.length();
            int n = (int) Math.min(len, 65536);
            byte[] b = new byte[n];
            r.seek(len - n);
            r.readFully(b);
            tail = new String(b, StandardCharsets.ISO_8859_1);
            if (!tail.contains("/Title") && len > n) {
                byte[] h = new byte[(int) Math.min(len, 65536)];
                r.seek(0);
                r.readFully(h);
                tail = new String(h, StandardCharsets.ISO_8859_1);
            }
        }
        String title = pdfString(PDF_TITLE, tail), author = pdfString(PDF_AUTHOR, tail);
        if (author.matches("(?i)anonymous|unknown|user|admin|author")) author = "";
        String lower = title.toLowerCase(Locale.ROOT);
        if (title.isEmpty() || lower.equals("untitled") || lower.matches(".*\\.(docx?|odt|pdf)$")) title = baseName(f);
        return meta(title, author, "", 0, "", "", false);
    }

    static String pdfString(Pattern p, String s) {
        Matcher m = p.matcher(s);
        String last = "";
        while (m.find()) last = m.group(1);
        if (last.isEmpty()) return "";
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < last.length(); i++) {
            char c = last.charAt(i);
            if (c == '\\' && i + 1 < last.length()) {
                char d = last.charAt(++i);
                if (d >= '0' && d <= '7') {
                    int j = i, v = 0;
                    while (j < last.length() && j < i + 3 && last.charAt(j) >= '0' && last.charAt(j) <= '7') v = v * 8 + (last.charAt(j++) - '0');
                    b.append((char) v);
                    i = j - 1;
                } else b.append(d == 'n' ? '\n' : d == 'r' ? '\r' : d == 't' ? '\t' : d);
            } else b.append(c);
        }
        String r = b.toString();
        // UTF-16BE strings start with a byte-order mark
        if (r.length() >= 2 && r.charAt(0) == 0xfe && r.charAt(1) == 0xff) {
            byte[] raw = r.substring(2).getBytes(StandardCharsets.ISO_8859_1);
            r = new String(raw, StandardCharsets.UTF_16BE);
        }
        return Epub.clean(r);
    }

    private static final Pattern GUT_TITLE = Pattern.compile("^Title:\\s*(.+)$", Pattern.MULTILINE);
    private static final Pattern GUT_AUTHOR = Pattern.compile("^Author:\\s*(.+)$", Pattern.MULTILINE);
    private static final Pattern GUT_LANG = Pattern.compile("^Language:\\s*(.+)$", Pattern.MULTILINE);
    private static final Pattern MD_TITLE = Pattern.compile("^#\\s+(.+)$", Pattern.MULTILINE);

    /** Project Gutenberg headers ("Title:", "Author:") or a Markdown "# Title". */
    static String textMeta(File f) throws IOException {
        StringBuilder head = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(new FileInputStream(f), StandardCharsets.UTF_8))) {
            String line;
            int n = 0;
            while ((line = r.readLine()) != null && n++ < 80) head.append(line).append('\n');
        }
        String h = head.toString().replace("﻿", "");
        Matcher t = GUT_TITLE.matcher(h), a = GUT_AUTHOR.matcher(h), l = GUT_LANG.matcher(h);
        if (t.find()) {
            String lang = l.find() ? l.group(1).trim().toLowerCase(Locale.ROOT) : "";
            if (lang.startsWith("english")) lang = "en";
            else if (lang.startsWith("swedish")) lang = "sv";
            return meta(t.group(1).trim(), a.find() ? a.group(1).trim() : "", "", 0, lang, "", false);
        }
        Matcher m = MD_TITLE.matcher(h);
        if (f.getName().toLowerCase(Locale.ROOT).matches(".*\\.(md|markdown)$") && m.find()) return meta(m.group(1).trim(), "", "", 0, "", "", false);
        return nameMeta(f);
    }

    static String meta(String title, String author, String series, double index, String lang, String cover, boolean broken) {
        return "{\"title\":" + Epub.quote(title) + ",\"author\":" + Epub.quote(author) + ",\"series\":" + Epub.quote(series)
                + ",\"seriesIndex\":" + (index == Math.floor(index) ? String.valueOf((long) index) : String.valueOf(index))
                + ",\"language\":" + Epub.quote(lang) + ",\"cover\":" + Epub.quote(cover) + ",\"broken\":" + broken + "}";
    }

    // ---------------------------------------------------------------- JSON and cache file

    public synchronized String json(List<Entry> list) {
        StringBuilder b = new StringBuilder("[");
        for (int i = 0; i < list.size(); i++) {
            Entry e = list.get(i);
            if (i > 0) b.append(',');
            b.append("{\"id\":\"").append(e.id).append("\",\"format\":\"").append(e.format).append("\",\"path\":").append(Epub.quote(e.file.getAbsolutePath()))
                    .append(",\"name\":").append(Epub.quote(e.file.getName())).append(",\"size\":").append(e.size).append(",\"mtime\":").append(e.mtime)
                    .append(",\"meta\":").append(e.meta).append('}');
        }
        return b.append(']').toString();
    }

    private void load() {
        if (cacheFile == null || !cacheFile.exists()) return;
        try (BufferedReader r = new BufferedReader(new InputStreamReader(new FileInputStream(cacheFile), StandardCharsets.UTF_8))) {
            String line;
            while ((line = r.readLine()) != null) {
                String[] p = line.split("\t", 6);
                if (p.length < 6) continue;
                File f = new File(p[0]);
                try {
                    Entry e = new Entry(f, p[3], p[4], Long.parseLong(p[1]), Long.parseLong(p[2]), p[5]);
                    byPath.put(p[0], e);
                    if (!byId.containsKey(e.id) && f.exists()) byId.put(e.id, e);
                } catch (NumberFormatException ignored) {
                }
            }
        } catch (IOException ignored) {
        }
    }

    private void save() {
        if (cacheFile == null) return;
        File tmp = new File(cacheFile.getPath() + ".tmp");
        try (Writer w = new OutputStreamWriter(new FileOutputStream(tmp), StandardCharsets.UTF_8)) {
            for (Entry e : byPath.values()) {
                if (e.file.getAbsolutePath().contains("\t") || e.file.getAbsolutePath().contains("\n")) continue;
                w.write(e.file.getAbsolutePath() + "\t" + e.size + "\t" + e.mtime + "\t" + e.id + "\t" + e.format + "\t" + e.meta + "\n");
            }
        } catch (IOException e) {
            return;
        }
        //noinspection ResultOfMethodCallIgnored
        tmp.renameTo(cacheFile);
    }
}
