export interface LayoutGuide {
  description: string;
  aspectRatio: string;
  rules: string;
}

export const LAYOUT_GUIDES: Record<string, LayoutGuide> = {
  // ─── Wedding Pieces ──────────────────────────────────

  WEDDING_INVITATION: {
    description: "formal wedding invitation card printed on premium card stock",
    aspectRatio: "4:5",
    rules: `Optional ceremonial header at top only when the tradition supports it.
Couple's names large and centered — the hero element — with the primary language most prominent at 1.5-2x size.
Date, time, venue, and RSVP details in a structured block below.
Father's names and family names as supporting lines when culturally important.
If bilingual or trilingual, use clear visual separation between language blocks with subtle dividers.
Border treatment and ornamental motifs at full expression — this is the anchor piece of the suite.
Leave breathing space between text blocks — 30% ornament, 70% content and space.`,
  },

  WEDDING_SAVE_THE_DATE: {
    description: "save the date card — the teaser piece in the suite",
    aspectRatio: "4:5",
    rules: `Date is the hero element — largest and most visually prominent.
Names are secondary, venue optional.
Simplest expression of the suite's visual DNA: same palette, same typefaces, minimal motifs.
Any header should match the selected culture or remain neutral.`,
  },

  WEDDING_RSVP_CARD: {
    description: "RSVP response card — functional companion to the invitation",
    aspectRatio: "16:9",
    rules: `Clean and functional. Same palette as the invitation but reduced ornament.
Include: name field, attendance toggle, guest count, dietary notes.
A small heading in the primary language if appropriate.
Readable form-like layout — clarity over decoration.`,
  },

  WEDDING_MENU_CARD: {
    description: "reception dinner menu card printed on matching card stock",
    aspectRatio: "4:5",
    rules: `Elegant header matching the invitation's typographic style.
Course sections clearly divided with subtle rules or spacing.
Bilingual dish names when multiple languages are selected.
Same border or motif system as the invitation, used with restraint.`,
  },

  WEDDING_TABLE_NUMBER: {
    description: "table number card readable from across a banquet table",
    aspectRatio: "1:1",
    rules: `Table number large and centered — readable from 2 meters away.
One motif accent from the suite, minimal supporting text.
Same palette, simplest piece in the suite.`,
  },

  WEDDING_WELCOME_SIGN: {
    description: "large welcome sign for wedding venue entrance",
    aspectRatio: "3:4",
    rules: `The grandest piece in the suite — hero motif at full scale.
Very large welcoming line in the primary language or a neutral ceremonial phrase.
Couple's names large and readable from a distance.
Full ornamental expression of the suite's border and motif system.`,
  },

  WEDDING_THANK_YOU: {
    description: "post-wedding thank you card printed on premium card stock",
    aspectRatio: "4:5",
    rules: `Short gratitude message — warm, elegant, personal.
Thank-you heading in the primary language only when the tradition supports it.
Same palette as the invitation but more intimate and minimal — less ornament, more breathing space.`,
  },

  WEDDING_INSTAGRAM_POST: {
    description: "wedding announcement designed to stop the scroll on Instagram",
    aspectRatio: "1:1",
    rules: `Visually striking with bold contrast — designed for phone screens.
Names as hero element, large and centered.
Minimal text — no heavy information blocks.
Same palette and motif as the suite but bolder and higher-contrast for digital.`,
  },

  WEDDING_WHATSAPP_CARD: {
    description: "wedding announcement optimized for WhatsApp sharing and compression",
    aspectRatio: "1:1",
    rules: `Names very large and centered in primary language.
Date and venue immediately readable.
Minimal detail — this is a teaser card.
Bold colors that survive WhatsApp image compression.
Include a call to action for RSVP.
Secondary languages smaller but legible.`,
  },

  // ─── Baby Pieces ─────────────────────────────────────

  BABY_BIRTH_ANNOUNCEMENT: {
    description: "birth announcement card printed on premium card stock",
    aspectRatio: "4:5",
    rules: `Child's name is the hero element in the primary script at 2-3x size.
Birth details (date, time, weight, length) in a clean structured block below.
Parents or family names as secondary elements.
Blessings or ceremonial headers only when the tradition supports them.
Framing motifs (botanical, celestial, or cultural) as elegant border treatment.`,
  },

  BABY_NURSERY_ART: {
    description: "nursery wall art — a frame-worthy decorative name print",
    aspectRatio: "1:1",
    rules: `Child's name as pure decorative art in the primary script — this is illustration, not information.
Keep extra text minimal — birth details optional and small if present.
Blessings or motifs only when they fit the ceremony context.
The design should be frame-worthy and giftable — suitable for hanging in a nursery.`,
  },

  BABY_AQEEQAH_INVITE: {
    description: "baby ceremony invitation card",
    aspectRatio: "4:5",
    rules: `Ceremony title as the heading — matching the actual baby occasion (aqeeqah, baptism, naming ceremony, etc.).
Child's name prominent below the heading.
Date, time, venue, and hosting family names in a structured details block.
Cultural motifs framing the content — appropriate to the selected tradition.
The invitation heading must match the actual occasion, not assume aqeeqah.`,
  },

  BABY_MILESTONE_CARD: {
    description: "baby milestone card for sharing on Instagram and WhatsApp",
    aspectRatio: "1:1",
    rules: `Baby name plus milestone text (e.g., "شهر واحد" / "٤٠ يوم" / "سنة أولى" or equivalent).
Clean design matching the original birth announcement style and palette.
Shareable on social media — bold enough for phone screens.
Milestone number or age is the hero element.`,
  },

  BABY_WHATSAPP_CARD: {
    description: "birth or ceremony announcement optimized for WhatsApp sharing",
    aspectRatio: "1:1",
    rules: `Child's name large and centered — immediately readable.
Key details (date, weight) clear and bold.
Bold colors that survive WhatsApp image compression.
Blessings or faith markers only when the ceremony context supports them.`,
  },

  BABY_THANK_YOU: {
    description: "thank you card for baby gifts and well-wishes",
    aspectRatio: "4:5",
    rules: `Short gratitude message matching the announcement style.
Same palette, same motif system, more intimate and personal.
Thank-you header in the primary language only when it fits the family tradition.`,
  },
};
