package io.github.rushivangala.margin;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;

/**
 * Reads the structure of an EPUB 2 or 3 book: META-INF/container.xml, the OPF package (metadata,
 * manifest, spine) and the table of contents (EPUB 3 nav document, or the EPUB 2 NCX).
 * Plain Java with no Android classes, so it is unit-tested on the JVM.
 *
 * Book files are untrusted. DOCTYPEs are stripped before parsing so no external entity or DTD is
 * ever resolved, entries are size-limited, and every href is resolved to a zip entry name that
 * must exist in the archive.
 */
public final class Epub {
    static final int MAX_XML = 4 * 1024 * 1024;

    public String title = "";
    public String author = "";
    public String language = "";
    public String publisher = "";
    public String description = "";
    public String series = "";
    public double seriesIndex = 0;
    public String identifier = "";
    public int version = 2;
    /** Zip entry name of the cover image, or "" when there is none. */
    public String cover = "";
    public String opfPath = "";
    /** Reading order. */
    public final List<Item> spine = new ArrayList<>();
    /** Table of contents, flattened with depth. */
    public final List<Toc> toc = new ArrayList<>();
    /** Every manifest entry: zip entry name → media type. */
    public final Map<String, String> types = new LinkedHashMap<>();

    public static final class Item {
        public final String id;
        public final String path;
        public final String type;
        public final boolean linear;

        Item(String id, String path, String type, boolean linear) {
            this.id = id;
            this.path = path;
            this.type = type;
            this.linear = linear;
        }
    }

    public static final class Toc {
        public final String label;
        public final String path;
        public final String fragment;
        public final int depth;

        Toc(String label, String path, String fragment, int depth) {
            this.label = label;
            this.path = path;
            this.fragment = fragment;
            this.depth = depth;
        }
    }

    /** Thrown when the file is not a readable EPUB. */
    public static final class BadBook extends IOException {
        public BadBook(String m) {
            super(m);
        }
    }

    // ---------------------------------------------------------------- parsing

    public static Epub open(ZipFile zip) throws IOException {
        Epub e = new Epub();
        Document container = xml(read(zip, "META-INF/container.xml"));
        if (container == null) throw new BadBook("No META-INF/container.xml");
        String opf = "";
        for (Element rf : all(container.getDocumentElement(), "rootfile")) {
            String mt = rf.getAttribute("media-type");
            String fp = rf.getAttribute("full-path");
            if (fp.isEmpty()) continue;
            if (opf.isEmpty() || "application/oebps-package+xml".equals(mt)) {
                opf = fp;
                if ("application/oebps-package+xml".equals(mt)) break;
            }
        }
        if (opf.isEmpty()) throw new BadBook("container.xml names no package");
        opf = normalize(opf);
        Document pkg = xml(read(zip, opf));
        if (pkg == null) throw new BadBook("Package " + opf + " is missing or not XML");
        e.opfPath = opf;
        e.readPackage(zip, pkg.getDocumentElement(), dirOf(opf));
        if (e.spine.isEmpty()) throw new BadBook("The book has no reading order");
        return e;
    }

    private void readPackage(ZipFile zip, Element root, String base) throws IOException {
        String v = root.getAttribute("version");
        version = v.startsWith("3") ? 3 : 2;

        // ---- manifest
        Map<String, String[]> byId = new HashMap<>(); // id → {path, type, properties}
        Element manifest = first(root, "manifest");
        if (manifest != null) {
            for (Element it : kids(manifest, "item")) {
                String href = it.getAttribute("href");
                if (href.isEmpty()) continue;
                String path = resolve(base, href)[0];
                String type = it.getAttribute("media-type").toLowerCase(Locale.ROOT);
                byId.put(it.getAttribute("id"), new String[]{path, type, it.getAttribute("properties")});
                types.put(path, type);
            }
        }

        // ---- metadata
        Element meta = first(root, "metadata");
        String coverId = "";
        Map<String, String> refines = new HashMap<>(); // "#id" + property → value
        if (meta != null) {
            List<String> titles = new ArrayList<>();
            List<String> creators = new ArrayList<>();
            for (Element m : all(meta, "*")) {
                String n = local(m);
                String text = clean(m.getTextContent());
                switch (n) {
                    case "title":
                        if (!text.isEmpty()) titles.add(text);
                        break;
                    case "creator":
                        if (!text.isEmpty()) creators.add(text);
                        break;
                    case "language":
                        if (language.isEmpty()) language = text;
                        break;
                    case "publisher":
                        if (publisher.isEmpty()) publisher = text;
                        break;
                    case "description":
                        if (description.isEmpty()) description = stripTags(text);
                        break;
                    case "identifier":
                        if (identifier.isEmpty()) identifier = text;
                        break;
                    case "meta": {
                        String name = m.getAttribute("name");
                        String content = m.getAttribute("content");
                        String prop = m.getAttribute("property");
                        if ("cover".equals(name)) coverId = content;
                        else if ("calibre:series".equals(name)) series = clean(content);
                        else if ("calibre:series_index".equals(name)) seriesIndex = number(content);
                        else if (!prop.isEmpty()) {
                            String ref = m.getAttribute("refines");
                            if ("belongs-to-collection".equals(prop) && ref.isEmpty() && series.isEmpty()) {
                                series = text;
                                String id = m.getAttribute("id");
                                if (!id.isEmpty()) refines.put("collection", "#" + id);
                            }
                            if (!ref.isEmpty()) refines.put(ref + " " + prop, text);
                        }
                        break;
                    }
                    default:
                        break;
                }
            }
            if (!titles.isEmpty()) title = titles.get(0);
            if (!creators.isEmpty()) author = String.join(", ", creators);
            String col = refines.get("collection");
            if (col != null) {
                String pos = refines.get(col + " group-position");
                if (pos != null) seriesIndex = number(pos);
            }
        }

        // ---- cover: EPUB 3 property first, then the EPUB 2 meta, then a guess
        for (String[] it : byId.values()) {
            if (it[2] != null && (" " + it[2] + " ").contains(" cover-image ")) cover = it[0];
        }
        if (cover.isEmpty() && byId.containsKey(coverId) && byId.get(coverId)[1].startsWith("image/")) cover = byId.get(coverId)[0];
        if (cover.isEmpty()) {
            for (Map.Entry<String, String[]> en : byId.entrySet()) {
                String[] it = en.getValue();
                if (it[1].startsWith("image/") && (en.getKey().toLowerCase(Locale.ROOT).contains("cover") || it[0].toLowerCase(Locale.ROOT).contains("cover"))) {
                    cover = it[0];
                    break;
                }
            }
        }
        if (!cover.isEmpty() && zip.getEntry(cover) == null) cover = "";

        // ---- spine
        Element sp = first(root, "spine");
        String ncxId = "";
        if (sp != null) {
            ncxId = sp.getAttribute("toc");
            for (Element ref : kids(sp, "itemref")) {
                String[] it = byId.get(ref.getAttribute("idref"));
                if (it == null || zip.getEntry(it[0]) == null) continue;
                if (!isDocument(it[1], it[0])) continue;
                spine.add(new Item(ref.getAttribute("idref"), it[0], it[1], !"no".equals(ref.getAttribute("linear"))));
            }
        }

        // ---- table of contents: nav document (EPUB 3), else NCX
        String navPath = "";
        String ncxPath = "";
        for (String[] it : byId.values()) {
            if (it[2] != null && (" " + it[2] + " ").contains(" nav ")) navPath = it[0];
            if ("application/x-dtbncx+xml".equals(it[1])) ncxPath = it[0];
        }
        if (!ncxId.isEmpty() && byId.containsKey(ncxId)) ncxPath = byId.get(ncxId)[0];
        if (!navPath.isEmpty()) readNav(zip, navPath);
        if (toc.isEmpty() && !ncxPath.isEmpty()) readNcx(zip, ncxPath);
        if (toc.isEmpty()) {
            for (int i = 0; i < spine.size(); i++) toc.add(new Toc("Part " + (i + 1), spine.get(i).path, "", 0));
        }
    }

    static boolean isDocument(String type, String path) {
        if (type.equals("application/xhtml+xml") || type.equals("text/html") || type.equals("application/x-dtbook+xml")) return true;
        String p = path.toLowerCase(Locale.ROOT);
        return type.isEmpty() && (p.endsWith(".xhtml") || p.endsWith(".html") || p.endsWith(".htm"));
    }

    private void readNav(ZipFile zip, String path) throws IOException {
        Document d = xml(read(zip, path));
        if (d == null) return;
        String base = dirOf(path);
        Element tocNav = null;
        for (Element nav : all(d.getDocumentElement(), "nav")) {
            String t = attrLocal(nav, "type");
            if ((" " + t + " ").contains(" toc ")) {
                tocNav = nav;
                break;
            }
            if (tocNav == null) tocNav = nav;
        }
        if (tocNav == null) return;
        Element ol = first(tocNav, "ol");
        if (ol != null) navList(ol, base, 0, zip);
    }

    private void navList(Element ol, String base, int depth, ZipFile zip) {
        for (Element li : kids(ol, "li")) {
            Element a = null;
            for (Element k : kids(li, "*")) {
                String n = local(k);
                if (n.equals("a") || n.equals("span")) {
                    a = k;
                    break;
                }
            }
            if (a != null) {
                String label = clean(a.getTextContent());
                String href = a.getAttribute("href");
                if (!label.isEmpty() && !href.isEmpty()) addToc(label, base, href, depth, zip);
            }
            Element sub = first(li, "ol");
            if (sub != null) navList(sub, base, depth + 1, zip);
        }
    }

    private void readNcx(ZipFile zip, String path) throws IOException {
        Document d = xml(read(zip, path));
        if (d == null) return;
        Element map = first(d.getDocumentElement(), "navMap");
        if (map != null) ncxPoints(map, dirOf(path), 0, zip);
    }

    private void ncxPoints(Element parent, String base, int depth, ZipFile zip) {
        for (Element np : kids(parent, "navPoint")) {
            Element label = first(np, "navLabel");
            Element content = null;
            for (Element k : kids(np, "content")) content = k;
            if (label != null && content != null) {
                String text = clean(label.getTextContent());
                String src = content.getAttribute("src");
                if (!text.isEmpty() && !src.isEmpty()) addToc(text, base, src, depth, zip);
            }
            ncxPoints(np, base, depth + 1, zip);
        }
    }

    private void addToc(String label, String base, String href, int depth, ZipFile zip) {
        if (href.contains(":")) return; // external links have no place in a table of contents
        String[] r = resolve(base, href);
        if (zip.getEntry(r[0]) == null) return;
        toc.add(new Toc(label, r[0], r[1], Math.min(depth, 6)));
    }

    // ---------------------------------------------------------------- paths

    /** Resolves href against a directory inside the zip. Returns {entry name, fragment}. */
    static String[] resolve(String baseDir, String href) {
        String frag = "";
        int h = href.indexOf('#');
        if (h >= 0) {
            frag = href.substring(h + 1);
            href = href.substring(0, h);
        }
        int q = href.indexOf('?');
        if (q >= 0) href = href.substring(0, q);
        try {
            href = URLDecoder.decode(href.replace("+", "%2B"), "UTF-8");
        } catch (Exception ignored) {
        }
        String joined = href.startsWith("/") ? href.substring(1) : baseDir + href;
        return new String[]{normalize(joined), frag};
    }

    /** Collapses "." and ".." segments; never climbs above the archive root. */
    static String normalize(String p) {
        List<String> out = new ArrayList<>();
        for (String s : p.replace('\\', '/').split("/")) {
            if (s.isEmpty() || s.equals(".")) continue;
            if (s.equals("..")) {
                if (!out.isEmpty()) out.remove(out.size() - 1);
            } else out.add(s);
        }
        return String.join("/", out);
    }

    static String dirOf(String p) {
        int i = p.lastIndexOf('/');
        return i < 0 ? "" : p.substring(0, i + 1);
    }

    // ---------------------------------------------------------------- XML helpers

    static byte[] read(ZipFile zip, String name) throws IOException {
        ZipEntry e = zip.getEntry(name);
        if (e == null) {
            // Some books use a different case for the folder names; look once, case-insensitively.
            String lower = name.toLowerCase(Locale.ROOT);
            for (java.util.Enumeration<? extends ZipEntry> en = zip.entries(); en.hasMoreElements(); ) {
                ZipEntry z = en.nextElement();
                if (z.getName().toLowerCase(Locale.ROOT).equals(lower)) {
                    e = z;
                    break;
                }
            }
        }
        if (e == null || e.isDirectory()) return null;
        try (InputStream in = zip.getInputStream(e)) {
            return readLimited(in, MAX_XML);
        }
    }

    static byte[] readLimited(InputStream in, int max) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) {
            out.write(buf, 0, n);
            if (out.size() > max) throw new BadBook("File inside the book is too large");
        }
        return out.toByteArray();
    }

    private static final Pattern DOCTYPE = Pattern.compile("<!DOCTYPE[^>\\[]*(\\[[\\s\\S]*?\\])?\\s*>", Pattern.CASE_INSENSITIVE);
    private static final Pattern ENTITY = Pattern.compile("&([A-Za-z][A-Za-z0-9]*);");

    /** Parses untrusted XML: no DOCTYPE, no external entities, HTML named entities turned into characters. */
    static Document xml(byte[] bytes) {
        if (bytes == null) return null;
        try {
            String s = decode(bytes);
            s = DOCTYPE.matcher(s).replaceAll("");
            s = htmlEntities(s);
            DocumentBuilderFactory f = DocumentBuilderFactory.newInstance();
            f.setNamespaceAware(true);
            f.setExpandEntityReferences(false);
            trySet(f, "http://apache.org/xml/features/disallow-doctype-decl", true);
            trySet(f, "http://xml.org/sax/features/external-general-entities", false);
            trySet(f, "http://xml.org/sax/features/external-parameter-entities", false);
            DocumentBuilder b = f.newDocumentBuilder();
            b.setErrorHandler(null);
            return b.parse(new ByteArrayInputStream(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            return null;
        }
    }

    private static void trySet(DocumentBuilderFactory f, String feature, boolean on) {
        try {
            f.setFeature(feature, on);
        } catch (Exception ignored) {
        }
    }

    /** UTF-8 by default; honours a UTF-16 BOM and an explicit encoding in the XML declaration. */
    static String decode(byte[] b) {
        if (b.length >= 2 && (b[0] & 0xff) == 0xfe && (b[1] & 0xff) == 0xff) return new String(b, 2, b.length - 2, StandardCharsets.UTF_16BE);
        if (b.length >= 2 && (b[0] & 0xff) == 0xff && (b[1] & 0xff) == 0xfe) return new String(b, 2, b.length - 2, StandardCharsets.UTF_16LE);
        int start = b.length >= 3 && (b[0] & 0xff) == 0xef && (b[1] & 0xff) == 0xbb && (b[2] & 0xff) == 0xbf ? 3 : 0;
        String head = new String(b, start, Math.min(200, b.length - start), StandardCharsets.ISO_8859_1);
        Matcher m = Pattern.compile("encoding=[\"']([A-Za-z0-9_-]+)[\"']").matcher(head);
        String s;
        if (m.find() && !m.group(1).equalsIgnoreCase("utf-8")) {
            try {
                s = new String(b, start, b.length - start, m.group(1));
            } catch (Exception e) {
                s = new String(b, start, b.length - start, StandardCharsets.UTF_8);
            }
            // The text is now a Java string, so the declaration must not claim another encoding.
            s = s.replaceFirst("encoding=[\"'][A-Za-z0-9_-]+[\"']", "encoding=\"UTF-8\"");
        } else s = new String(b, start, b.length - start, StandardCharsets.UTF_8);
        return s;
    }

    private static final Map<String, Integer> NAMED = new HashMap<>();

    static {
        String[] pairs = {"nbsp", "160", "iexcl", "161", "cent", "162", "pound", "163", "curren", "164", "yen", "165", "brvbar", "166", "sect", "167",
                "uml", "168", "copy", "169", "ordf", "170", "laquo", "171", "not", "172", "shy", "173", "reg", "174", "macr", "175", "deg", "176",
                "plusmn", "177", "sup2", "178", "sup3", "179", "acute", "180", "micro", "181", "para", "182", "middot", "183", "cedil", "184",
                "sup1", "185", "ordm", "186", "raquo", "187", "frac14", "188", "frac12", "189", "frac34", "190", "iquest", "191", "times", "215",
                "divide", "247", "szlig", "223", "Agrave", "192", "Aacute", "193", "Acirc", "194", "Atilde", "195", "Auml", "196", "Aring", "197",
                "AElig", "198", "Ccedil", "199", "Egrave", "200", "Eacute", "201", "Ecirc", "202", "Euml", "203", "Igrave", "204", "Iacute", "205",
                "Icirc", "206", "Iuml", "207", "ETH", "208", "Ntilde", "209", "Ograve", "210", "Oacute", "211", "Ocirc", "212", "Otilde", "213",
                "Ouml", "214", "Oslash", "216", "Ugrave", "217", "Uacute", "218", "Ucirc", "219", "Uuml", "220", "Yacute", "221", "THORN", "222",
                "agrave", "224", "aacute", "225", "acirc", "226", "atilde", "227", "auml", "228", "aring", "229", "aelig", "230", "ccedil", "231",
                "egrave", "232", "eacute", "233", "ecirc", "234", "euml", "235", "igrave", "236", "iacute", "237", "icirc", "238", "iuml", "239",
                "eth", "240", "ntilde", "241", "ograve", "242", "oacute", "243", "ocirc", "244", "otilde", "245", "ouml", "246", "oslash", "248",
                "ugrave", "249", "uacute", "250", "ucirc", "251", "uuml", "252", "yacute", "253", "thorn", "254", "yuml", "255",
                "OElig", "338", "oelig", "339", "Scaron", "352", "scaron", "353", "Yuml", "376", "fnof", "402", "circ", "710", "tilde", "732",
                "ensp", "8194", "emsp", "8195", "thinsp", "8201", "zwnj", "8204", "zwj", "8205", "lrm", "8206", "rlm", "8207",
                "ndash", "8211", "mdash", "8212", "lsquo", "8216", "rsquo", "8217", "sbquo", "8218", "ldquo", "8220", "rdquo", "8221", "bdquo", "8222",
                "dagger", "8224", "Dagger", "8225", "bull", "8226", "hellip", "8230", "permil", "8240", "prime", "8242", "Prime", "8243",
                "lsaquo", "8249", "rsaquo", "8250", "euro", "8364", "trade", "8482", "larr", "8592", "rarr", "8594", "uarr", "8593", "darr", "8595",
                "minus", "8722", "le", "8804", "ge", "8805", "ne", "8800", "infin", "8734", "alpha", "945", "beta", "946", "gamma", "947", "delta", "948",
                "pi", "960", "sigma", "963", "omega", "969", "mu", "956", "lambda", "955", "theta", "952"};
        for (int i = 0; i < pairs.length; i += 2) NAMED.put(pairs[i], Integer.parseInt(pairs[i + 1]));
    }

    static String htmlEntities(String s) {
        if (s.indexOf('&') < 0) return s;
        Matcher m = ENTITY.matcher(s);
        StringBuffer out = new StringBuffer();
        while (m.find()) {
            String n = m.group(1);
            String rep;
            if (n.equals("amp") || n.equals("lt") || n.equals("gt") || n.equals("quot") || n.equals("apos")) rep = m.group(0);
            else {
                Integer cp = NAMED.get(n);
                rep = "&#" + (cp == null ? 32 : cp) + ";";
            }
            m.appendReplacement(out, Matcher.quoteReplacement(rep));
        }
        m.appendTail(out);
        return out.toString();
    }

    static String local(Node n) {
        String l = n.getLocalName();
        if (l == null) {
            l = n.getNodeName();
            int c = l.indexOf(':');
            if (c >= 0) l = l.substring(c + 1);
        }
        return l;
    }

    /** An attribute by local name, whatever its namespace prefix (epub:type, xml:lang …). */
    static String attrLocal(Element e, String name) {
        org.w3c.dom.NamedNodeMap at = e.getAttributes();
        for (int i = 0; i < at.getLength(); i++) {
            Node a = at.item(i);
            if (name.equals(local(a))) return a.getNodeValue();
        }
        return "";
    }

    static List<Element> kids(Element parent, String name) {
        List<Element> out = new ArrayList<>();
        for (Node n = parent.getFirstChild(); n != null; n = n.getNextSibling()) {
            if (n.getNodeType() == Node.ELEMENT_NODE && ("*".equals(name) || name.equals(local(n)))) out.add((Element) n);
        }
        return out;
    }

    static List<Element> all(Element root, String name) {
        List<Element> out = new ArrayList<>();
        if (root == null) return out;
        NodeList nl = root.getElementsByTagName("*");
        for (int i = 0; i < nl.getLength(); i++) {
            Node n = nl.item(i);
            if ("*".equals(name) || name.equals(local(n))) out.add((Element) n);
        }
        return out;
    }

    static Element first(Element root, String name) {
        if (root == null) return null;
        if (name.equals(local(root))) return root;
        List<Element> a = all(root, name);
        return a.isEmpty() ? null : a.get(0);
    }

    static String clean(String s) {
        return s == null ? "" : s.replaceAll("[\\s\\u00a0]+", " ").trim();
    }

    static String stripTags(String s) {
        return clean(s.replaceAll("<[^>]*>", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&#39;", "'")).replaceAll("\\s+([.,;:!?])", "$1");
    }

    static double number(String s) {
        try {
            return Double.parseDouble(s.trim());
        } catch (Exception e) {
            return 0;
        }
    }

    // ---------------------------------------------------------------- JSON for the web UI

    public String json() {
        StringBuilder b = new StringBuilder(4096);
        b.append('{');
        kv(b, "title", title).append(',');
        kv(b, "author", author).append(',');
        kv(b, "language", language).append(',');
        kv(b, "publisher", publisher).append(',');
        kv(b, "description", description.length() > 2000 ? description.substring(0, 2000) : description).append(',');
        kv(b, "series", series).append(',');
        b.append("\"seriesIndex\":").append(seriesIndex == Math.floor(seriesIndex) ? String.valueOf((long) seriesIndex) : String.valueOf(seriesIndex)).append(',');
        b.append("\"version\":").append(version).append(',');
        kv(b, "cover", cover).append(',');
        b.append("\"spine\":[");
        for (int i = 0; i < spine.size(); i++) {
            Item it = spine.get(i);
            if (i > 0) b.append(',');
            b.append('{');
            kv(b, "path", it.path).append(',');
            kv(b, "type", it.type).append(',');
            b.append("\"linear\":").append(it.linear).append('}');
        }
        b.append("],\"toc\":[");
        for (int i = 0; i < toc.size(); i++) {
            Toc t = toc.get(i);
            if (i > 0) b.append(',');
            b.append('{');
            kv(b, "label", t.label).append(',');
            kv(b, "path", t.path).append(',');
            kv(b, "frag", t.fragment).append(',');
            b.append("\"depth\":").append(t.depth).append('}');
        }
        return b.append("]}").toString();
    }

    private static StringBuilder kv(StringBuilder b, String k, String v) {
        return b.append('"').append(k).append("\":").append(quote(v));
    }

    public static String quote(String s) {
        if (s == null) return "\"\"";
        StringBuilder b = new StringBuilder(s.length() + 2).append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"':
                    b.append("\\\"");
                    break;
                case '\\':
                    b.append("\\\\");
                    break;
                case '\n':
                    b.append("\\n");
                    break;
                case '\r':
                    b.append("\\r");
                    break;
                case '\t':
                    b.append("\\t");
                    break;
                default:
                    if (c < 0x20 || c == 0x2028 || c == 0x2029) b.append(String.format(Locale.ROOT, "\\u%04x", (int) c));
                    else b.append(c);
            }
        }
        return b.append('"').toString();
    }

    /** Media type for an entry, from the manifest or the extension. */
    public String typeOf(String path) {
        String t = types.get(path);
        if (t != null && !t.isEmpty()) return t;
        return guessType(path);
    }

    static String guessType(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        if (p.endsWith(".xhtml") || p.endsWith(".xht")) return "application/xhtml+xml";
        if (p.endsWith(".html") || p.endsWith(".htm")) return "text/html";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".gif")) return "image/gif";
        if (p.endsWith(".webp")) return "image/webp";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".ttf")) return "font/ttf";
        if (p.endsWith(".otf")) return "font/otf";
        if (p.endsWith(".woff")) return "font/woff";
        if (p.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    public static List<String> tocLabels(Epub e) {
        List<String> out = new ArrayList<>();
        for (Toc t : e.toc) out.add(t.label);
        return Collections.unmodifiableList(out);
    }
}
