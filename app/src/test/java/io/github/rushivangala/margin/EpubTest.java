package io.github.rushivangala.margin;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.junit.Test;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipOutputStream;

public class EpubTest {
    static File book(String name) {
        // Gradle runs tests from the module directory; the local runner from the repository root.
        for (String base : new String[]{"src/test/resources/books/", "app/src/test/resources/books/"}) {
            File f = new File(base + name);
            if (f.exists()) return f;
        }
        throw new AssertionError("missing test book " + name);
    }

    static Epub open(String name) throws Exception {
        try (ZipFile z = new ZipFile(book(name))) {
            return Epub.open(z);
        }
    }

    @Test
    public void epub3WithNavDocument() throws Exception {
        Epub e = open("english-epub3.epub");
        assertEquals(3, e.version);
        assertEquals("The Keeper of Harwick Light", e.title);
        assertEquals("Ada Testwright", e.author);
        assertEquals("en", e.language);
        assertEquals("A lighthouse keeper finds the old logbook.", e.description);
        assertEquals("OEBPS/images/cover.png", e.cover);
        assertEquals("OEBPS/content.opf", e.opfPath);
        // the cover page is in the spine but not linear
        assertEquals(5, e.spine.size());
        assertFalse(e.spine.get(0).linear);
        assertTrue(e.spine.get(1).linear);
        assertEquals("OEBPS/chapter01.xhtml", e.spine.get(1).path);
        assertEquals(4, e.toc.size());
        assertEquals("Chapter 3. The Grey Widow", e.toc.get(2).label);
        assertEquals("OEBPS/chapter03.xhtml", e.toc.get(2).path);
        assertEquals("ch3", e.toc.get(2).fragment);
        assertEquals("text/css", e.typeOf("OEBPS/style.css"));
    }

    @Test
    public void epub2WithNcxSeriesAndLatin1Chapter() throws Exception {
        Epub e = open("swedish-epub2.epub");
        assertEquals(2, e.version);
        assertEquals("Sommaren på Gråskär", e.title);
        assertEquals("Åsa Provskrivare", e.author);
        assertEquals("sv", e.language);
        assertEquals("Skärgårdsböckerna", e.series);
        assertEquals(2.0, e.seriesIndex, 0.001);
        assertEquals(3, e.spine.size());
        assertEquals("OEBPS/kapitel1.html", e.spine.get(0).path);
        assertEquals(3, e.toc.size());
        assertEquals("Kapitel 2. Fyren", e.toc.get(1).label);
        assertEquals("", e.cover);
        try (ZipFile z = new ZipFile(book("swedish-epub2.epub"))) {
            String s = Epub.decode(Epub.read(z, "OEBPS/kapitel2.html"));
            assertTrue("ISO-8859-1 chapter decodes", s.contains("främmande bokstäver"));
            assertTrue(s.contains("encoding=\"UTF-8\""));
            assertNotNull(Epub.xml(Epub.read(z, "OEBPS/kapitel2.html")));
        }
    }

    @Test
    public void imagesNotesAndCollectionSeries() throws Exception {
        Epub e = open("images-notes.epub");
        assertEquals("Ada Testwright, B. Example", e.author);
        assertEquals("Harwick Papers", e.series);
        assertEquals(1.5, e.seriesIndex, 0.001);
        assertEquals("OEBPS/images/cover.svg", e.cover);
        assertEquals(3, e.toc.size());
        assertEquals(0, e.toc.get(0).depth);
        assertEquals(1, e.toc.get(1).depth);
        assertEquals("n2", e.toc.get(1).fragment);
        assertEquals("image/png", e.typeOf("OEBPS/images/light.png"));
        assertTrue(e.json().contains("\"seriesIndex\":1.5"));
    }

    @Test
    public void maliciousBookIsParsedSafely() throws Exception {
        Epub e = open("malicious.epub");
        // the DOCTYPE with its entities is dropped: no file contents, no expansion
        assertFalse(e.title.contains("root:"));
        assertFalse(e.author.contains("AAAA"));
        // path traversal and remote hrefs never become spine items
        assertEquals(1, e.spine.size());
        assertEquals("OEBPS/evil.xhtml", e.spine.get(0).path);
        for (Epub.Item it : e.spine) {
            assertFalse(it.path.contains(".."));
            assertFalse(it.path.contains(":"));
        }
    }

    @Test
    public void pathsAreNormalisedInsideTheArchive() {
        assertEquals("OEBPS/a.xhtml", Epub.resolve("OEBPS/text/", "../a.xhtml")[0]);
        assertEquals("etc/passwd", Epub.resolve("OEBPS/", "../../../etc/passwd")[0]);
        assertEquals("OEBPS/my file.xhtml", Epub.resolve("OEBPS/", "my%20file.xhtml#x")[0]);
        assertEquals("x", Epub.resolve("OEBPS/", "my%20file.xhtml#x")[1]);
        assertEquals("a+b.xhtml", Epub.resolve("", "a+b.xhtml")[0]);
        assertEquals("root.xhtml", Epub.resolve("OEBPS/deep/", "/root.xhtml")[0]);
    }

    @Test
    public void namedHtmlEntitiesBecomeCharacters() {
        assertEquals("a&#160;b &amp; &#8212;&#32;", Epub.htmlEntities("a&nbsp;b &amp; &mdash;&unknownthing;"));
        assertNotNull(Epub.xml("<x>caf&eacute; &hellip;</x>".getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    public void jsonEscapesControlCharacters() {
        assertEquals("\"a\\\"b\\\\c\\nd\\u2028\"", Epub.quote("a\"b\\c\nd "));
    }

    @Test
    public void notAnEpub() throws Exception {
        File f = File.createTempFile("bad", ".epub");
        f.deleteOnExit();
        try (ZipOutputStream z = new ZipOutputStream(new FileOutputStream(f))) {
            z.putNextEntry(new ZipEntry("hello.txt"));
            z.write("hi".getBytes(StandardCharsets.UTF_8));
        }
        try (ZipFile z = new ZipFile(f)) {
            Epub.open(z);
            fail("expected BadBook");
        } catch (Epub.BadBook expected) {
            assertNull(null);
        }
    }

    @Test
    public void caseInsensitiveEntryLookup() throws Exception {
        File f = File.createTempFile("case", ".epub");
        f.deleteOnExit();
        try (ZipOutputStream z = new ZipOutputStream(new FileOutputStream(f))) {
            z.putNextEntry(new ZipEntry("META-INF/container.xml"));
            z.write("<container><rootfiles><rootfile full-path=\"oebps/Content.opf\" media-type=\"application/oebps-package+xml\"/></rootfiles></container>".getBytes(StandardCharsets.UTF_8));
            z.putNextEntry(new ZipEntry("OEBPS/content.opf"));
            z.write(("<package version=\"2.0\"><metadata><title>T</title></metadata><manifest><item id=\"a\" href=\"a.xhtml\" media-type=\"application/xhtml+xml\"/></manifest>"
                    + "<spine><itemref idref=\"a\"/></spine></package>").getBytes(StandardCharsets.UTF_8));
            z.putNextEntry(new ZipEntry("oebps/a.xhtml"));
            z.write("<html><body><p>x</p></body></html>".getBytes(StandardCharsets.UTF_8));
        }
        try (ZipFile z = new ZipFile(f)) {
            Epub e = Epub.open(z);
            assertEquals("T", e.title);
            assertEquals(1, e.spine.size());
        }
    }
}
