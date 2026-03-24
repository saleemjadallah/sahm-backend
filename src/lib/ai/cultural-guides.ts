export interface CulturalGuide {
  rules: string;
}

type ProjectTypeKey = "WEDDING" | "BABY";
type LanguageGuides = Record<string, string>;
type Metadata = Record<string, unknown> | null | undefined;

const BASE_GUIDES: Record<ProjectTypeKey, LanguageGuides> = {
  WEDDING: {
    ar: `- Arabic wedding text: formal, celebratory, well-spaced RTL with intact letter connections
- Arabic calligraphy is a cultural design asset, not automatically a religious signal
- Religious headers such as bismillah appear only when the ceremony context supports them`,
    hi: `- Hindi text: polished Devanagari with proper matras, conjuncts, and continuous shirorekha
- Ceremonial headers like "श्री गणेशाय नमः" or "शुभ विवाह" depend on the family tradition
- Language tone should match the selected event type`,
    en: `- English text: warm, formal, easy to read in an elegant serif or display typeface
- Avoid generic luxury filler — keep the tone grounded in the selected ceremony`,
  },
  BABY: {
    ar: `- Arabic baby text: warm, graceful, family-centered with the child's name as hero
- Blessings like "ما شاء الله" appear only when culturally appropriate
- Arabic calligraphy may be decorative without forcing religious phrases`,
    hi: `- Hindi baby text: auspicious, joyful, family-centered
- Devanagari should be elegant and legible, not ornamental to the point of confusion
- Traditional celebratory language is welcome when the occasion supports it`,
    en: `- English baby text: tender, joyful, print-friendly
- Keep the tone specific to the selected occasion`,
  },
};

// ─── Wedding Tradition Rules ────────────────────────────

function weddingTraditionRules(tradition: string): string {
  switch (tradition) {
    case "gulf_arab":
      return `- Father's names and family names are important supporting lines
- Hijri date may appear alongside Gregorian when appropriate
- Bismillah or formal Arabic opening may be used when it suits the family
- Let typography, geometry, and ornament carry the design — avoid couple photography
- Gold-on-ivory or gold-on-dark-navy is the prestige palette for Gulf Arab weddings`;

    case "hindu":
      return `- Red, maroon, saffron, and gold are culturally auspicious colors
- Mandala borders, paisley patterns, lotus motifs, and temple-arch framing are suitable
- Marigold garlands and diya glow work as secondary motifs
- Headers like "श्री गणेशाय नमः" or "शुभ विवाह" may appear if appropriate
- The design must feel festive and auspicious, not Islamic`;

    case "christian_arab":
      return `- Arabic is fully native to this audience — treat it as heritage language, not Islamic
- Byzantine arch framing, gold-leaf mosaic textures, and illuminated-manuscript borders are appropriate
- Subtle cross motifs integrated into ornamental borders, olive branches, and grapevines
- Opening may use "بسم الاب والابن والروح القدس" (In the name of the Father, Son, and Holy Spirit)
- The design should feel Eastern Mediterranean, not like a Western invite with Arabic added`;

    case "filipino":
      return `- Family-centered and community-welcoming phrasing is important
- Tropical florals, sampaguita jasmine, and bright reception-friendly layouts are a strong fit
- English must be especially readable; Arabic appears as a Gulf-local accent when provided
- Ninong/ninang (godparent) roles may be referenced in formal invitations`;

    case "western_expat":
      return `- English-first, elegant, and readable
- Arabic calligraphy may appear as a sophisticated Gulf cultural accent or keepsake element
- No religious headers unless explicitly indicated
- The design should feel contemporary international with Gulf-local warmth`;

    case "sikh":
      return `- Rich jewel tones (royal blue, gold, maroon) and dignified floral ornament are appropriate
- Ik Onkar (ੴ) or Khanda symbols may appear if the family requests it
- Do not use Islamic or Hindu deity motifs
- Do not invent Gurmukhi or Punjabi text unless it is explicitly provided`;

    default:
      return `- Use culturally respectful, non-denominational ceremonial design cues
- Do not assume a specific religion or header unless the context makes it clear`;
  }
}

function weddingEventRules(eventType: string): string {
  switch (eventType) {
    case "mehendi":
      return `- Mehendi event: playful, colorful, and festive — the most fun event in the wedding sequence
- Intricate henna-pattern borders, paisley, marigold garlands, and illustrated henna-decorated hands
- Warm palette: mustard yellow, henna green, coral, magenta with gold accents
- Lighter and more playful than the main wedding invite — no heavy religious headers
- Hanging lanterns, diyas, and string-light motifs add warmth`;

    case "sangeet":
      return `- Sangeet event: musical, glamorous, and high-energy evening celebration
- Dhol drum illustrations, musical instrument motifs, dancing-couple silhouettes
- Jewel-tone palette: deep purple, magenta, gold, hot pink — dramatic and cinematic
- Bollywood-glamour energy with fairy-light bokeh and chandelier motifs
- This is a party, not a prayer — prioritize movement and evening-event energy`;

    case "reception":
      return `- Reception event: modern, guest-facing, and celebration-focused
- Venue name and timing are the hero elements, not the couple's names
- Cleaner and more functional than the main ceremony invite
- Include dress code guidance and practical timing details
- Shares the visual DNA of the main invite but in a simpler, more scannable form`;

    case "engagement":
      return `- Engagement event: anticipatory, elegant, lighter than the main wedding
- Ring motifs (subtle, not clip-art) and celebratory framing
- Both families' names appear prominently — this is a family-to-family announcement
- The tone is joyful anticipation, not full ceremony formality`;

    default:
      return `- Main wedding ceremony: the highest-stakes piece in the suite
- Full ceremonial design expression with all ornament, motifs, and calligraphy at peak quality
- Names are the hero element, date and venue prominent, family names supporting`;
  }
}

// ─── Baby Tradition Rules ───────────────────────────────

function babyTraditionRules(tradition: string): string {
  switch (tradition) {
    case "gulf_arab":
      return `- Baby's name is the absolute hero, especially in Arabic calligraphy
- Crescent moon and stars are recognizable Islamic celebratory motifs for baby events
- Blessings like "ما شاء الله" or "تبارك الله" are appropriate for Muslim families
- Soft lamb illustrations reference aqeeqah tradition when relevant
- Premium modern feel: gold foil accents, soft watercolor backgrounds, layered depth`;

    case "hindu":
      return `- Saffron, marigold, gold, and vermilion are auspicious baby celebration colors
- Lotus, diya glow, baby cradle (palna) illustrations, and mandala borders are appropriate
- Rangoli-inspired background textures add cultural warmth
- For annaprashana: silver bowl with kheer, rice grains, banana leaf, gold ring/spoon motifs
- For naam karan: temple-arch framing, peacock motifs, auspicious ornament`;

    case "christian_arab":
      return `- Cross motifs (Byzantine or Maronite three-bar), dove, holy water symbolism are appropriate
- Arabic calligraphy is culturally native — use elegant Naskh for blessings
- Church-arch framing and illuminated-manuscript borders carry the sacramental tone
- Baby's full name including father's name is important in Arab culture
- Godparents may be named; church name and officiating priest may appear`;

    case "filipino":
      return `- Family warmth and community celebration are central
- Christening/baptism cards: scallop shell, dove, floral borders with sampaguita jasmine
- Ninong (godfather) and ninang (godmother) listing is traditional and important
- Tone balances sacramental reverence with approachable family joy
- Bright floral palette with gold accents`;

    case "western_expat":
      return `- Contemporary, gentle, and giftable tone
- Botanical and celestial motifs work well
- Arabic accents appear as a Gulf-life keepsake element, not mandatory
- Muted earth tones, sage, and warm neutrals are trending`;

    case "sikh":
      return `- Royal blue, gold, and saffron are appropriate colors
- Ik Onkar or Khanda symbols may appear if requested
- Naming ceremony visuals: dignified, warm, jewel-toned
- Do not use Islamic or Hindu deity motifs
- Do not invent Gurmukhi text unless explicitly supplied`;

    default:
      return `- Keep the design warm, respectful, and ceremony-specific
- Do not default to any religion's visual language`;
  }
}

function babyOccasionRules(occasionType: string): string {
  switch (occasionType) {
    case "aqeeqah":
      return `- Aqeeqah celebration: Islamic baby naming and blessing ceremony
- Arabic calligraphy of the baby's name is the hero element at 2-3x size
- Crescent moon and stars, soft lamb illustration, Islamic geometric borders
- "عقيقة" as the ceremony title; blessings like "ما شاء الله" and "اللهم بارك" are appropriate
- Emerald green, gold, and ivory create the prestige palette
- The design should feel sacred yet tender — not a generic baby card with Arabic text`;

    case "baptism":
      return `- Baptism: a church sacrament with reverent, luminous tone
- Cross (Byzantine for Arab Christian, standard for others), dove in flight, holy water symbolism
- Scallop shell is an ancient Christian baptism symbol
- Sacramental white and gold palette with burgundy or soft blue accents
- For Arab Christian: Arabic Naskh calligraphy is the heritage language; opening may include Trinitarian blessing
- For Filipino: include ninong/ninang (godparent) section; sampaguita floral borders`;

    case "christening":
      return `- Christening: brighter and more community-celebratory than baptism
- Soft floral wreaths, gentle dove, nature motifs, daisy chains
- One cross or dove motif is sufficient — do not overdo religious symbolism
- Warmer and more playful palette than baptism: soft coral, mint, buttercream with gold accent
- This is "welcome to the community," not a solemn sacrament — keep it joyful
- Keepsake-quality design that could be framed`;

    case "annaprashana":
      return `- Annaprashana / first rice ceremony: Hindu baby's first-food celebration
- Silver bowl with kheer (sweet rice), rice grain borders, banana leaf, gold ring/spoon motifs
- Kalash (sacred pot) with coconut and mango leaves, diya, marigold garlands
- Saffron-orange, gold, cream, and deep red palette
- Temple-arch framing and rangoli-inspired textures
- "अन्नप्राशन" as Hindi ceremony title; baby's name is the hero after the title`;

    case "naam_karan":
    case "naming_ceremony":
      return `- Naming ceremony: the child's name dominates the design with ceremonial warmth
- Baby cradle (palna/jhula) illustration is the most iconic naming ceremony visual
- Lotus, diya, mandala borders, and peacock motifs as supporting elements
- For Hindu: saffron, gold, royal blue palette; headers like "शुभ नामकरण"
- For Sikh: royal blue, gold, saffron; Ik Onkar if requested; Gurdwara silhouette optional
- The name should be 2-3x larger than any other text element`;

    default:
      return `- Birth announcement: welcoming, tender, and clear
- Baby's name is the hero element in the primary script
- Botanical or celestial framing motifs work universally
- Birth details (date, time, weight, length) in a clean structured block
- Muted earth tones or soft pastels with gold accents for premium feel`;
  }
}

// ─── Design Type Rules ──────────────────────────────────

function designTypeRules(projectType: string, designType: string): string {
  const rules: Record<string, string> = {
    WEDDING_RSVP_CARD: "- RSVP: cleaner and more functional than the hero invitation. Same palette, reduced motifs. Readable form fields.",
    WEDDING_MENU_CARD: "- Menu card: elegant utility piece. Same typefaces and header treatment as the invitation. Course sections clearly divided.",
    WEDDING_TABLE_NUMBER: "- Table number: large numeral readable from a distance. One motif accent, same palette. The simplest piece in the suite.",
    WEDDING_WELCOME_SIGN: "- Welcome sign: the grandest piece. Couple names very large. Same hero motif at large scale. Welcoming warmth.",
    WEDDING_SAVE_THE_DATE: "- Save the date: the teaser. Date is the hero, names secondary. Simplest expression of the suite's visual DNA.",
    WEDDING_THANK_YOU: "- Thank you card: warm and personal. Same palette, more intimate and minimal than the invitation.",
    WEDDING_INSTAGRAM_POST: "- Instagram post: bold and high-contrast. Names as hero, minimal text. Must stop the scroll on a phone screen.",
    WEDDING_WHATSAPP_CARD: "- WhatsApp card: bold colors, large text. Must survive image compression. Names and date immediately readable.",
    BABY_NURSERY_ART: "- Nursery art: purely decorative and giftable. The child's name as illustration, not information. Frame-worthy.",
    BABY_MILESTONE_CARD: "- Milestone card: clean, matching the birth announcement style. Shareable on Instagram and WhatsApp.",
    BABY_WHATSAPP_CARD: "- WhatsApp card: bold, compression-friendly. Child name large, key details clear. Immediate visual impact.",
    BABY_THANK_YOU: "- Thank you card: warm gratitude matching the announcement style. Short and personal.",
  };
  return rules[designType] || "- Keep the design type visually coherent with the rest of the suite.";
}

// ─── Main Export ─────────────────────────────────────────

export function getCulturalGuide(
  projectType: string,
  designType: string,
  languages: string[],
  metadata?: Metadata,
): CulturalGuide {
  const guide = BASE_GUIDES[projectType as ProjectTypeKey];
  if (!guide) return { rules: "Follow standard formal design conventions." };

  const baseRules = languages.map((lang) => guide[lang] || "").filter(Boolean);
  const tradition = String(metadata?.tradition ?? "other");

  const contextualRules = projectType === "WEDDING"
    ? weddingTraditionRules(tradition)
    : babyTraditionRules(tradition);

  const occasionRules = projectType === "WEDDING"
    ? weddingEventRules(String(metadata?.eventType ?? "wedding"))
    : babyOccasionRules(String(metadata?.occasionType ?? "birth_announcement"));

  const parts = [
    ...baseRules,
    contextualRules,
    occasionRules,
    designTypeRules(projectType, designType),
    "- Include religious phrases, symbols, or headers only when the ceremony context above supports them.",
  ];

  return { rules: parts.join("\n\n") };
}
