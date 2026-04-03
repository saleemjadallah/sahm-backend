import PDFDocument from "pdfkit";

export type StorybookPage = {
  imageBuffer: Buffer;
  title: string;
  body: string;
};

/**
 * Assemble a storybook PDF from illustrated pages.
 * Layout: Letter landscape (792x612pt), full-bleed illustration with
 * semi-transparent text overlay at the bottom.
 */
export async function assembleStorybookPdf(
  pages: StorybookPage[],
  petName: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const WIDTH = 792;
    const HEIGHT = 612;

    const doc = new PDFDocument({
      size: [WIDTH, HEIGHT],
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      autoFirstPage: false,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const isCover = i === 0;
      const isLast = i === pages.length - 1;

      doc.addPage({ size: [WIDTH, HEIGHT], margins: { top: 0, bottom: 0, left: 0, right: 0 } });

      // Full-bleed illustration
      try {
        doc.image(page.imageBuffer, 0, 0, { width: WIDTH, height: HEIGHT });
      } catch {
        // If image fails, fill with warm gradient background
        doc.rect(0, 0, WIDTH, HEIGHT).fill("#fdf6ec");
      }

      // Semi-transparent text overlay at bottom
      const overlayHeight = isLast ? HEIGHT * 0.35 : HEIGHT * 0.32;
      const overlayTop = HEIGHT - overlayHeight;

      doc.save();
      doc.opacity(0.82);
      doc.rect(0, overlayTop, WIDTH, overlayHeight).fill("#fffdf9");
      doc.restore();

      const textX = 48;
      const textWidth = WIDTH - 96;
      const align = isCover || isLast ? "center" : "left";

      // Title
      doc
        .font("Times-Bold")
        .fontSize(isCover ? 32 : 24)
        .fillColor("#4f3c2f")
        .text(page.title, textX, overlayTop + 20, { width: textWidth, align });

      // Body
      doc
        .font("Times-Roman")
        .fontSize(14)
        .fillColor("#5e5650")
        .text(page.body, textX, doc.y + 8, { width: textWidth, lineGap: 5, align });
    }

    // Back cover with branding
    doc.addPage({ size: [WIDTH, HEIGHT], margins: { top: 0, bottom: 0, left: 0, right: 0 } });
    doc.rect(0, 0, WIDTH, HEIGHT).fill("#fdf6ec");
    doc
      .font("Times-Italic")
      .fontSize(18)
      .fillColor("#8a7f72")
      .text(`A Day in ${petName}'s Life`, 0, HEIGHT / 2 - 40, { width: WIDTH, align: "center" });
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor("#b0a89e")
      .text("Created with love by Sahm  \u2022  getsahm.com", 0, HEIGHT / 2, {
        width: WIDTH,
        align: "center",
      });

    doc.end();
  });
}
