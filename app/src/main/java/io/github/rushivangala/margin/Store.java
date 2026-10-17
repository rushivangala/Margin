package io.github.rushivangala.margin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

/**
 * Small JSON documents in the app's private storage (files/data/KEY.json). The web UI owns the
 * shape of each document; this class only reads and writes them atomically (write to a temporary
 * file, then rename), so a crash mid-write never leaves half a file.
 */
public final class Store {
    private static final Pattern KEY = Pattern.compile("[a-z0-9][a-z0-9._-]{0,80}");
    private final File dir;

    public Store(File dir) {
        this.dir = dir;
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
    }

    static boolean validKey(String key) {
        return key != null && KEY.matcher(key).matches() && !key.contains("..");
    }

    public synchronized String get(String key) {
        if (!validKey(key)) return "";
        File f = new File(dir, key + ".json");
        if (!f.exists()) return "";
        try (FileInputStream in = new FileInputStream(f)) {
            return new String(Epub.readLimited(in, 32 * 1024 * 1024), StandardCharsets.UTF_8);
        } catch (IOException e) {
            return "";
        }
    }

    public synchronized boolean put(String key, String json) {
        if (!validKey(key) || json == null) return false;
        File f = new File(dir, key + ".json");
        File tmp = new File(dir, key + ".json.tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) {
            out.write(json.getBytes(StandardCharsets.UTF_8));
            out.getFD().sync();
        } catch (IOException e) {
            //noinspection ResultOfMethodCallIgnored
            tmp.delete();
            return false;
        }
        return tmp.renameTo(f);
    }

    public synchronized boolean remove(String key) {
        if (!validKey(key)) return false;
        return new File(dir, key + ".json").delete();
    }

    /** Keys that start with prefix (for exports and clean-up). */
    public synchronized String[] keys(String prefix) {
        String[] names = dir.list();
        if (names == null) return new String[0];
        java.util.List<String> out = new java.util.ArrayList<>();
        for (String n : names) {
            if (n.endsWith(".json") && n.startsWith(prefix)) out.add(n.substring(0, n.length() - 5));
        }
        java.util.Collections.sort(out);
        return out.toArray(new String[0]);
    }
}
