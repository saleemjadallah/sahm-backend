export interface CulturalGuide {
  rules: string;
}

type ProjectTypeKey = "WEDDING" | "BABY";
type LanguageGuides = Record<string, string>;
type Metadata = Record<string, unknown> | null | undefined;

const BASE_GUIDES: Record<ProjectTypeKey, LanguageGuides> = {
  WEDDING: {
    ar: `
    - Arabic wedding text should feel formal, celebratory, and well-spaced
    - Use Arabic calligraphy as a cultural design asset, not automatically as a religious signal
    - If Arabic is primary, keep hierarchy strong and elegant with clear RTL spacing
    - Religious headers such as bismillah are optional and should appear only when the ceremony context supports them
    `,
    hi: `
    - Hindi wedding text should be rendered in polished Devanagari with proper matras and clear shirorekha
    - Ceremonial headers such as "श्री गणेशाय नमः" or "शुभ विवाह" are optional and should depend on the family tradition
    - Indian wedding communication often spans multiple events, so language should fit the selected event type
    `,
    en: `
    - English wedding text should be warm, formal, and easy to read
    - Avoid generic luxury filler language; keep the tone grounded in the selected ceremony style
    `,
  },
  BABY: {
    ar: `
    - Arabic baby text should feel warm, graceful, and family-centered
    - Blessings such as "ما شاء الله" or "اللهم بارك" are optional and should only appear when culturally appropriate
    - Arabic calligraphy may be decorative, but do not force religious phrases into non-Muslim occasions
    `,
    hi: `
    - Hindi baby text should feel auspicious, joyful, and family-centered
    - Naming and first-food ceremonies can use traditional celebratory language if the selected occasion supports it
    - Keep Devanagari elegant and legible rather than ornamental to the point of confusion
    `,
    en: `
    - English baby text should be tender, joyful, and print-friendly
    - Keep the tone specific to the selected occasion rather than generic newborn copy
    `,
  },
};

function weddingTraditionRules(tradition: string): string {
  switch (tradition) {
    case "gulf_arab":
      return `
      - Father's names and family names are often important supporting lines
      - Hijri date can be included if appropriate
      - Bismillah or a formal Arabic opening may be used, but only when it suits the family
      - Avoid couple photography; let typography, geometry, and ornament carry the design
      `;
    case "hindu":
      return `
      - Traditional red, maroon, saffron, and gold palettes are culturally appropriate
      - Ganesh motifs, lotus forms, and mandala or paisley borders are suitable
      - Headers such as "श्री गणेशाय नमः" or "शुभ विवाह" may be used
      - The design should feel festive and auspicious rather than Islamic
      `;
    case "christian_arab":
      return `
      - Arabic is fully native to this audience; treat it as heritage language, not Islamic-only language
      - Cross motifs, Byzantine ornament, church iconography, and gold-liturgical styling are appropriate
      - Do not use bismillah or Islamic framing unless explicitly provided in the text
      `;
    case "filipino":
      return `
      - Family-centered and welcoming phrasing is important
      - Floral, celebratory, and reception-friendly layouts are a strong fit
      - Keep English especially readable; Arabic can appear as a Gulf-local accent when provided
      `;
    case "western_expat":
      return `
      - Keep the design elegant and readable in English first
      - Arabic calligraphy may appear as a sophisticated Gulf cultural accent or souvenir element
      - Do not add religious headers unless explicitly indicated
      `;
    case "sikh":
      return `
      - Avoid Islamic-specific motifs and headers
      - Rich jewel tones, floral ornament, and dignified ceremonial balance are appropriate
      - Do not invent Gurmukhi or Punjabi text unless it is explicitly provided
      `;
    default:
      return `
      - Use culturally respectful, non-denominational ceremonial design cues
      - Do not assume a specific religion or header unless the context makes it clear
      `;
  }
}

function weddingEventRules(eventType: string): string {
  switch (eventType) {
    case "mehendi":
      return `
      - This is a Mehendi event, so the tone should be playful, colorful, and festive
      - Mehendi illustration cues, florals, and lighter celebratory energy are appropriate
      `;
    case "sangeet":
      return `
      - This is a Sangeet event, so the tone can be musical, lively, and celebratory
      - Prioritize movement, glamour, and evening-event energy over solemn formality
      `;
    case "reception":
      return `
      - This is a reception event, so the layout may feel more modern and guest-facing than the main ceremony invite
      - Focus on celebration, venue, and timing clarity
      `;
    case "engagement":
      return `
      - This is an engagement event, so the tone should feel anticipatory and elegant rather than fully ceremonial
      `;
    default:
      return `
      - This is the main wedding ceremony, so the design should feel ceremonial, high-stakes, and refined
      `;
  }
}

function babyTraditionRules(tradition: string): string {
  switch (tradition) {
    case "gulf_arab":
      return `
      - Baby's name should be the hero, especially in Arabic if Arabic is included
      - Blessings such as "ما شاء الله" may be appropriate for Muslim family contexts
      - Aqeeqah and naming celebration cues are acceptable when the occasion calls for them
      `;
    case "hindu":
      return `
      - Use warm auspicious tones such as saffron, marigold, vermilion, or gold
      - Lotus, diya-like glow, and gentle traditional ornament are appropriate
      - Naming ceremony and first-rice ceremony language should feel celebratory and sacred without feeling Islamic
      `;
    case "christian_arab":
      return `
      - Baptismal and church motifs can be appropriate for sacramental occasions
      - Arabic calligraphy remains culturally native here, but avoid Islamic blessings unless explicitly requested
      `;
    case "filipino":
      return `
      - Family warmth and joyful celebration are central
      - Christening and baptism announcements can feel bright, floral, and community-oriented
      `;
    case "western_expat":
      return `
      - Keep the tone contemporary, gentle, and giftable
      - Arabic accents may appear as a Gulf-life souvenir detail, but remain optional
      `;
    case "sikh":
      return `
      - Avoid Islamic framing
      - Naming ceremony visuals should feel dignified, warm, and jewel-toned
      - Do not invent Gurmukhi text unless explicitly supplied
      `;
    default:
      return `
      - Keep the design warm, respectful, and ceremony-specific without defaulting to a religion
      `;
  }
}

function babyOccasionRules(occasionType: string): string {
  switch (occasionType) {
    case "aqeeqah":
      return `
      - This is an aqeeqah celebration, so Muslim naming and blessing cues are appropriate
      `;
    case "baptism":
      return `
      - This is a baptism announcement, so church, water, cross, and sacramental symbolism may be used
      `;
    case "christening":
      return `
      - This is a christening announcement, so the tone should feel bright, blessed, and family-centered
      `;
    case "annaprashana":
      return `
      - This is a first-rice ceremony, so use celebratory and auspicious Indian ceremonial cues
      `;
    case "naam_karan":
    case "naming_ceremony":
      return `
      - This is a naming ceremony, so the child's name should dominate the design with ceremonial warmth
      `;
    default:
      return `
      - This is a birth announcement, so the tone should feel welcoming, tender, and clear
      `;
  }
}

function designTypeRules(projectType: string, designType: string): string {
  if (projectType === "WEDDING" && designType === "WEDDING_RSVP_CARD") {
    return "- RSVP pieces should stay clearer and more functional than the hero invitation while still matching the suite.";
  }
  if (projectType === "BABY" && designType === "BABY_NURSERY_ART") {
    return "- Nursery art can be more decorative and giftable than announcement cards, but keep it aligned with the chosen family tradition.";
  }
  return "- Keep the selected design type visually coherent with the rest of the suite.";
}

export function getCulturalGuide(
  projectType: string,
  designType: string,
  languages: string[],
  metadata?: Metadata,
): CulturalGuide {
  const guide = BASE_GUIDES[projectType as ProjectTypeKey];

  if (!guide) {
    return { rules: "Follow standard formal design conventions." };
  }

  const baseRules = languages
    .map((lang) => guide[lang] || "")
    .filter(Boolean);

  const tradition = String(metadata?.tradition ?? "other");
  const occasionRules = projectType === "WEDDING"
    ? weddingEventRules(String(metadata?.eventType ?? "wedding"))
    : babyOccasionRules(String(metadata?.occasionType ?? "birth_announcement"));

  const contextualRules = projectType === "WEDDING"
    ? weddingTraditionRules(tradition)
    : babyTraditionRules(tradition);

  const rules = [
    ...baseRules,
    contextualRules,
    occasionRules,
    designTypeRules(projectType, designType),
    "- Never assume Islamic headers, Christian symbols, Hindu blessings, or any religious phrase unless the ceremony context supports it.",
  ].join("\n\nAdditionally:\n");

  return { rules: rules || "Follow standard formal design conventions." };
}
