package io.github.rushivangala.margin;

import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipFile;

/**
 * Prints what the app's native side would tell the web UI about a folder of books:
 * {"books": [...library entries...], "structures": {id: structure}}. Used by the desktop UI tests
 * (test/ui), so the browser sees exactly what Library and Epub produce on the phone.
 */
public final class Dump {
    public static void main(String[] args) throws Exception {
        Library lib = new Library(null);
        List<File> roots = new ArrayList<>();
        roots.add(new File(args[0]));
        List<Library.Entry> list = lib.scan(roots, null);
        StringBuilder b = new StringBuilder("{\"books\":").append(lib.json(list)).append(",\"structures\":{");
        boolean first = true;
        for (Library.Entry e : list) {
            if (!"epub".equals(e.format)) continue;
            String s;
            try (ZipFile z = new ZipFile(e.file)) {
                s = Epub.open(z).json();
            } catch (Exception ex) {
                s = "{\"error\":" + Epub.quote("This EPUB can’t be read: " + ex.getMessage()) + "}";
            }
            b.append(first ? "" : ",").append('"').append(e.id).append("\":").append(s);
            first = false;
        }
        new java.io.PrintStream(new java.io.FileOutputStream(java.io.FileDescriptor.out), true, "UTF-8").println(b.append("}}"));
    }
}
