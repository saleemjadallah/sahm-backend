import PDFDocument from "pdfkit";

export async function createLetterPdf(options: {
  petName: string;
  letterText: string;
  portraitImageBuffer?: Buffer | null;
  memorialText?: string | null;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Cream background
    doc.rect(0, 0, doc.page.width, doc.page.height).fill("#fdf8f0");

    // Portrait image header (if available)
    if (options.portraitImageBuffer) {
      const imgSize = 160;
      const imgX = (doc.page.width - imgSize) / 2;
      doc.image(options.portraitImageBuffer, imgX, 56, {
        width: imgSize,
        height: imgSize,
      });
      doc.y = 56 + imgSize + 16;
    }

    // Pet name
    doc
      .font("Times-Bold")
      .fontSize(24)
      .fillColor("#3d3d3d")
      .text(options.petName, { align: "center" });

    // Memorial text
    if (options.memorialText) {
      doc
        .font("Times-Italic")
        .fontSize(11)
        .fillColor("#8a7f72")
        .text(options.memorialText, { align: "center" });
    }

    doc.moveDown(1);

    // Divider
    const lineY = doc.y;
    doc
      .moveTo(72, lineY)
      .lineTo(doc.page.width - 72, lineY)
      .strokeColor("#d4c9b8")
      .lineWidth(0.5)
      .stroke();

    doc.moveDown(1);

    // Letter body
    doc
      .font("Times-Roman")
      .fontSize(12)
      .fillColor("#3d3d3d")
      .text(options.letterText, {
        align: "left",
        lineGap: 6,
        paragraphGap: 12,
      });

    // Footer
    doc.moveDown(2);
    const footerY = doc.y;
    doc
      .moveTo(72, footerY)
      .lineTo(doc.page.width - 72, footerY)
      .strokeColor("#d4c9b8")
      .lineWidth(0.5)
      .stroke();
    doc.moveDown(0.5);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#b0a89e")
      .text("Created with love by Sahm  \u2022  getsahm.com", { align: "center" });

    doc.end();
  });
}
