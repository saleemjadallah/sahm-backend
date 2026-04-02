export function createPrintGuidePdf(petName: string) {
  const lines = [
    `${petName} Print Guide`,
    "Prepared at 300 DPI on a centered 16x20 canvas.",
    "Recommended print sizes:",
    "5x5, 8x8, 10x10, 12x12, and 16x20 inches.",
    "",
    "Best everyday printers:",
    "Walgreens Photo for same-day pickup and quick gifts.",
    "CVS Photo for local convenience and standard matte prints.",
    "Shutterfly for mailed prints, framed gifts, and larger home delivery.",
    "Mpix or a local fine art printer for the most premium paper finish.",
    "",
    "Paper suggestions:",
    "Matte archival paper for watercolor or pencil styles.",
    "Gloss or satin for vibrant styles like Pop Art and Stained Glass.",
    "",
    "Sizing tip:",
    "Use borderless printing only if the lab preserves the full image area.",
    "",
    "Store locators:",
    "walgreens.com/photo",
    "cvs.com/photo",
    "shutterfly.com/prints",
  ];

  const fontSize = 14;
  const lineHeight = 22;
  let contentStream = "BT /F1 14 Tf 50 760 Td ";
  lines.forEach((line, index) => {
    const escaped = line.replace(/[()\\]/g, "\\$&");
    if (index > 0) {
      contentStream += `0 -${lineHeight} Td `;
    }
    contentStream += `(${escaped}) Tj `;
  });
  contentStream += "ET";

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${contentStream.length} >> stream\n${contentStream}\nendstream endobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${offsets[index].toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}
