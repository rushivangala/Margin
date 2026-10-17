package io.github.rushivangala.margin;

import android.annotation.TargetApi;
import android.graphics.RectF;
import android.graphics.pdf.PdfRenderer;
import android.graphics.pdf.content.PdfPageTextContent;
import android.os.ParcelFileDescriptor;

import java.io.File;
import java.util.List;
import java.util.Locale;

/**
 * Reads the text layer of a PDF with the platform API (Android 15+), for the flowing-text mode.
 * Output: {"pages":[[{"t":"text","b":[left,top,right,bottom]}, ...], ...]} in page points; the
 * web UI orders the pieces into columns and joins lines into paragraphs.
 */
@TargetApi(35)
final class PdfText {
    private PdfText() {
    }

    static String extract(File f) {
        try (ParcelFileDescriptor pfd = ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
             PdfRenderer r = new PdfRenderer(pfd)) {
            StringBuilder b = new StringBuilder("{\"pages\":[");
            for (int i = 0; i < r.getPageCount(); i++) {
                if (i > 0) b.append(',');
                b.append('[');
                try (PdfRenderer.Page p = r.openPage(i)) {
                    List<PdfPageTextContent> parts = p.getTextContents();
                    boolean first = true;
                    for (PdfPageTextContent c : parts) {
                        String t = c.getText();
                        if (t == null || t.trim().isEmpty()) continue;
                        float l = Float.MAX_VALUE, tp = Float.MAX_VALUE, rt = 0, bt = 0;
                        for (RectF rc : c.getBounds()) {
                            l = Math.min(l, rc.left);
                            tp = Math.min(tp, rc.top);
                            rt = Math.max(rt, rc.right);
                            bt = Math.max(bt, rc.bottom);
                        }
                        if (l == Float.MAX_VALUE) {
                            l = 0;
                            tp = 0;
                        }
                        if (!first) b.append(',');
                        first = false;
                        b.append("{\"t\":").append(Epub.quote(t)).append(String.format(Locale.ROOT, ",\"b\":[%.0f,%.0f,%.0f,%.0f]}", l, tp, rt, bt));
                    }
                }
                b.append(']');
                if (b.length() > 24 * 1024 * 1024) break;
            }
            return b.append("]}").toString();
        } catch (SecurityException se) {
            return "{\"error\":\"This PDF is password-protected\"}";
        } catch (Throwable t) {
            return "{\"error\":" + Epub.quote("Could not read the text of this PDF: " + t.getMessage()) + "}";
        }
    }
}
