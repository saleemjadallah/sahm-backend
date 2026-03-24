/**
 * A text zone defines where a piece of text goes on the design.
 * Positions are percentages (0–100) of image dimensions.
 */
export interface TextZone {
  field: string;           // key into textContent (e.g. "groomName", "date")
  yPct: number;            // vertical center position (% from top)
  fontSizePct: number;     // font size as % of image height
  fontRole: "display" | "body";
  color: string;           // hex color
  align: "left" | "center" | "right";
  maxWidthPct: number;     // max line width as % of image width
  secondaryScale: number;  // secondary language font size multiplier (e.g. 0.6)
}

export interface TextLayout {
  zones: TextZone[];
}

// ─── Shared zone builders ───────────────────────────────

const heroName = (field: string, yPct: number): TextZone => ({
  field, yPct, fontSizePct: 6, fontRole: "display", color: "#1a1a3e",
  align: "center", maxWidthPct: 80, secondaryScale: 0.6,
});

const detailLine = (field: string, yPct: number): TextZone => ({
  field, yPct, fontSizePct: 2.5, fontRole: "body", color: "#333333",
  align: "center", maxWidthPct: 70, secondaryScale: 0.7,
});

const smallLine = (field: string, yPct: number): TextZone => ({
  field, yPct, fontSizePct: 2, fontRole: "body", color: "#555555",
  align: "center", maxWidthPct: 70, secondaryScale: 0.7,
});

// ─── Wedding Layouts ────────────────────────────────────

const WEDDING_INVITATION: TextLayout = {
  zones: [
    heroName("groomName", 30),
    { ...heroName("brideName", 42), fontSizePct: 5.5 },
    detailLine("date", 56),
    detailLine("time", 62),
    detailLine("venue", 68),
    smallLine("city", 74),
    smallLine("familyName", 82),
    smallLine("additionalInfo", 88),
  ],
};

const WEDDING_SAVE_THE_DATE: TextLayout = {
  zones: [
    { ...heroName("date", 40), fontSizePct: 8 },
    { ...detailLine("groomName", 58), fontSizePct: 3.5, fontRole: "display" },
    { ...detailLine("brideName", 66), fontSizePct: 3.5, fontRole: "display" },
    smallLine("venue", 78),
  ],
};

const WEDDING_RSVP_CARD: TextLayout = {
  zones: [
    { ...detailLine("groomName", 25), fontSizePct: 3, fontRole: "display" },
    { ...detailLine("brideName", 35), fontSizePct: 3, fontRole: "display" },
    detailLine("date", 50),
    detailLine("venue", 62),
    smallLine("additionalInfo", 78),
  ],
};

const WEDDING_MENU_CARD: TextLayout = {
  zones: [
    { ...heroName("groomName", 12), fontSizePct: 3.5 },
    detailLine("additionalInfo", 50),
  ],
};

const WEDDING_TABLE_NUMBER: TextLayout = {
  zones: [
    { ...heroName("additionalInfo", 50), fontSizePct: 14 },
  ],
};

const WEDDING_WELCOME_SIGN: TextLayout = {
  zones: [
    heroName("groomName", 35),
    { ...heroName("brideName", 50), fontSizePct: 5.5 },
    detailLine("date", 68),
    smallLine("venue", 78),
  ],
};

const WEDDING_THANK_YOU: TextLayout = {
  zones: [
    { ...heroName("groomName", 35), fontSizePct: 4 },
    { ...heroName("brideName", 47), fontSizePct: 4 },
    smallLine("additionalInfo", 65),
  ],
};

const WEDDING_SOCIAL: TextLayout = {
  zones: [
    heroName("groomName", 32),
    { ...heroName("brideName", 50), fontSizePct: 5.5 },
    detailLine("date", 70),
  ],
};

// ─── Baby Layouts ───────────────────────────────────────

const BABY_BIRTH_ANNOUNCEMENT: TextLayout = {
  zones: [
    { ...heroName("babyName", 35), fontSizePct: 7 },
    detailLine("birthDate", 52),
    detailLine("birthTime", 58),
    smallLine("weight", 64),
    smallLine("length", 69),
    smallLine("parentNames", 80),
    smallLine("additionalInfo", 88),
  ],
};

const BABY_NURSERY_ART: TextLayout = {
  zones: [
    { ...heroName("babyName", 50), fontSizePct: 10 },
  ],
};

const BABY_CEREMONY_INVITE: TextLayout = {
  zones: [
    { ...heroName("babyName", 30), fontSizePct: 6 },
    detailLine("birthDate", 48),
    detailLine("venue", 56),
    smallLine("parentNames", 68),
    smallLine("additionalInfo", 80),
  ],
};

const BABY_MILESTONE: TextLayout = {
  zones: [
    { ...heroName("babyName", 35), fontSizePct: 5 },
    { ...heroName("additionalInfo", 60), fontSizePct: 8 },
  ],
};

const BABY_WHATSAPP: TextLayout = {
  zones: [
    { ...heroName("babyName", 30), fontSizePct: 7 },
    detailLine("birthDate", 52),
    smallLine("weight", 62),
    smallLine("parentNames", 75),
  ],
};

const BABY_THANK_YOU: TextLayout = {
  zones: [
    { ...heroName("babyName", 35), fontSizePct: 5 },
    smallLine("parentNames", 55),
    smallLine("additionalInfo", 68),
  ],
};

// ─── Registry ───────────────────────────────────────────

const LAYOUTS: Record<string, TextLayout> = {
  WEDDING_INVITATION,
  WEDDING_SAVE_THE_DATE,
  WEDDING_RSVP_CARD,
  WEDDING_MENU_CARD,
  WEDDING_TABLE_NUMBER,
  WEDDING_WELCOME_SIGN,
  WEDDING_THANK_YOU,
  WEDDING_INSTAGRAM_POST: WEDDING_SOCIAL,
  WEDDING_WHATSAPP_CARD: WEDDING_SOCIAL,
  BABY_BIRTH_ANNOUNCEMENT,
  BABY_NURSERY_ART,
  BABY_AQEEQAH_INVITE: BABY_CEREMONY_INVITE,
  BABY_MILESTONE_CARD: BABY_MILESTONE,
  BABY_WHATSAPP_CARD: BABY_WHATSAPP,
  BABY_THANK_YOU,
};

export function getTextLayout(designType: string): TextLayout | null {
  return LAYOUTS[designType] || null;
}

/**
 * Generate a human-readable zone description for the AI prompt,
 * so the model knows where to leave blank space.
 */
export function describeZones(designType: string): string {
  const layout = LAYOUTS[designType];
  if (!layout) return "Leave generous centered space for text overlay.";

  const lines = layout.zones.map((z) => {
    const pct = z.yPct;
    const region = pct < 30 ? "upper" : pct < 60 ? "middle" : "lower";
    const size = z.fontSizePct > 5 ? "large" : z.fontSizePct > 3 ? "medium" : "small";
    return `- ${region} area (~${pct}% from top): ${size} blank zone for ${z.field}`;
  });

  return lines.join("\n");
}
