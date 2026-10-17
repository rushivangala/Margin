package io.github.rushivangala.margin;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.Collections;
import java.util.List;

public class LibraryTest {
    static File tempDir() throws Exception {
        File d = Files.createTempDirectory("margin").toFile();
        d.deleteOnExit();
        return d;
    }

    static File copy(String book, File dir, String as) throws Exception {
        File out = new File(dir, as);
        out.getParentFile().mkdirs();
        Files.copy(EpubTest.book(book).toPath(), out.toPath(), StandardCopyOption.REPLACE_EXISTING);
        return out;
    }

    @Test
    public void formats() {
        assertEquals("epub", Library.formatOf("A.EPUB"));
        assertEquals("md", Library.formatOf("notes.markdown"));
        assertEquals("html", Library.formatOf("x.htm"));
        assertNull(Library.formatOf("photo.jpg"));
        assertNull(Library.formatOf("README"));
    }

    @Test
    public void scanFindsBooksSkipsHiddenAndAndroidAndDeduplicates() throws Exception {
        File root = tempDir();
        copy("english-epub3.epub", root, "Books/keeper.epub");
        copy("english-epub3.epub", root, "Download/keeper (1).epub"); // same book twice
        copy("swedish-epub2.epub", root, "Books/Sverige/sommar.epub");
        copy("text.pdf", root, "Download/chart.pdf");
        copy("plain.txt", root, "Books/plain.txt");
        copy("english-epub3.epub", root, ".hidden/secret.epub");
        copy("english-epub3.epub", root, "Android/data/x/book.epub");
        new File(root, "Download/photo.jpg").createNewFile();

        Library lib = new Library(new File(root, "cache.tsv"));
        List<Library.Entry> found = lib.scan(Collections.singletonList(root), null);
        assertEquals(4, found.size());
        Library.Entry keeper = null;
        for (Library.Entry e : found) if (e.meta.contains("The Keeper of Harwick")) keeper = e;
        assertNotNull(keeper);
        assertEquals("epub", keeper.format);
        assertTrue(keeper.meta.contains("\"author\":\"Ada Testwright\""));
        assertTrue(keeper.meta.contains("\"cover\":\"OEBPS/images/cover.png\""));
        assertEquals(16, keeper.id.length());
        assertTrue(lib.json(found).startsWith("[{\"id\":"));

        // The cache survives a restart and keeps ids stable across moves.
        String id = keeper.id;
        File moved = new File(root, "Books/renamed.epub");
        assertTrue(keeper.file.renameTo(moved));
        Library again = new Library(new File(root, "cache.tsv"));
        List<Library.Entry> later = again.scan(Collections.singletonList(root), null);
        assertEquals(4, later.size());
        assertNotNull(again.get(id));
    }

    @Test
    public void metadataFromPdfAndText() throws Exception {
        File root = tempDir();
        File pdf = copy("text.pdf", root, "Ada - Chart.pdf");
        assertTrue(Library.pdfMeta(pdf).contains("\"title\":\"Notes on the Harwick Chart\""));
        assertTrue(Library.pdfMeta(pdf).contains("\"author\":\"Ada Testwright\""));

        File gut = new File(root, "pg.txt");
        try (FileOutputStream o = new FileOutputStream(gut)) {
            o.write("﻿The Project Gutenberg eBook\n\nTitle: Röda rummet\n\nAuthor: August Strindberg\n\nLanguage: Swedish\n\n*** START ***\n".getBytes(StandardCharsets.UTF_8));
        }
        String m = Library.textMeta(gut);
        assertTrue(m, m.contains("\"title\":\"Röda rummet\""));
        assertTrue(m.contains("\"author\":\"August Strindberg\""));
        assertTrue(m.contains("\"language\":\"sv\""));

        File md = copy("notes.md", root, "keeper-notes.md");
        assertTrue(Library.textMeta(md).contains("\"title\":\"Keeper’s notes\""));
        assertTrue(Library.nameMeta(new File("Ada Testwright - The Keeper.html")).contains("\"author\":\"Ada Testwright\""));
    }

    @Test
    public void brokenEpubIsListedAsBroken() throws Exception {
        File root = tempDir();
        File bad = new File(root, "bad.epub");
        try (FileOutputStream o = new FileOutputStream(bad)) {
            o.write("not a zip".getBytes(StandardCharsets.UTF_8));
        }
        Library.Entry e = Library.describe(bad);
        assertNotNull(e);
        assertTrue(e.meta.contains("\"broken\":true"));
        assertFalse(e.meta.contains("\"title\":\"\""));
    }

    @Test
    public void pdfStringEscapes() {
        assertEquals("A (B) é", Library.pdfString(java.util.regex.Pattern.compile("/Title\\s*\\(((?:\\\\.|[^\\\\)])*)\\)"), "/Title (A \\(B\\) \\351)"));
    }

    @Test
    public void storeIsAtomicAndRejectsBadKeys() throws Exception {
        Store s = new Store(tempDir());
        assertTrue(s.put("book-abc", "{\"a\":1}"));
        assertEquals("{\"a\":1}", s.get("book-abc"));
        assertFalse(s.put("../escape", "{}"));
        assertFalse(s.put("Upper", "{}"));
        assertEquals("", s.get("missing"));
        assertEquals(1, s.keys("book-").length);
        assertTrue(s.remove("book-abc"));
        assertEquals("", s.get("book-abc"));
    }
}
