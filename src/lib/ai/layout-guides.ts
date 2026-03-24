export interface LayoutGuide {
  description: string;
  aspectRatio: string;
  rules: string;
}

export const LAYOUT_GUIDES: Record<string, LayoutGuide> = {
  WEDDING_INVITATION: {
    description: "formal wedding invitation card",
    aspectRatio: "4:5",
    rules:
      "Optional ceremonial header at top only if it fits the selected tradition. Names large and centered, with the primary language most prominent. Date, time, venue, and RSVP details below. If bilingual or trilingual, use clear visual separation between language blocks.",
  },
  WEDDING_SAVE_THE_DATE: {
    description: "save the date card",
    aspectRatio: "4:5",
    rules:
      "Date is the hero element. Names are secondary, venue optional, and any header should match the selected culture or remain neutral.",
  },
  WEDDING_RSVP_CARD: {
    description: "RSVP response card",
    aspectRatio: "16:9",
    rules:
      "Keep this piece clean and functional. Include name field, attending or not attending, guest count, dietary notes, and a small heading in the primary language if appropriate.",
  },
  WEDDING_MENU_CARD: {
    description: "reception dinner menu card",
    aspectRatio: "4:5",
    rules:
      "Elegant header. Course sections clearly divided. Bilingual dish names. Match suite style.",
  },
  WEDDING_TABLE_NUMBER: {
    description: "small table number card",
    aspectRatio: "1:1",
    rules:
      "Table number large and centered, with any supporting label subtle. Match the suite style and keep it legible from a distance.",
  },
  WEDDING_WELCOME_SIGN: {
    description: "large welcome sign for wedding venue entrance",
    aspectRatio: "3:4",
    rules:
      "Very large text with a welcoming line in the primary language or a neutral ceremonial phrase. Couple names should be readable from a distance.",
  },
  WEDDING_THANK_YOU: {
    description: "post-wedding thank you card",
    aspectRatio: "4:5",
    rules:
      "Short gratitude message with a thank-you heading in the primary language only if it suits the selected tradition. Warm, elegant, and personal.",
  },
  WEDDING_INSTAGRAM_POST: {
    description: "wedding announcement for Instagram feed",
    aspectRatio: "1:1",
    rules:
      "Visually striking. Names as hero. No heavy text blocks. This needs to stop the scroll.",
  },
  WEDDING_WHATSAPP_CARD: {
    description: "wedding announcement optimized for WhatsApp sharing",
    aspectRatio: "1:1",
    rules:
      "Names very large and centered in primary language. Date and venue clear. Minimal detail \u2014 this is a teaser. Secondary languages smaller but legible. Include call to action for RSVP.",
  },
  BABY_BIRTH_ANNOUNCEMENT: {
    description: "birth announcement card",
    aspectRatio: "4:5",
    rules:
      "Child's name is the hero in the primary script. Birth details below, parents or family names secondary, and any blessing should only appear when it suits the selected tradition.",
  },
  BABY_NURSERY_ART: {
    description: "nursery wall art featuring baby's name",
    aspectRatio: "1:1",
    rules:
      "Feature the child's name as pure decorative art in the primary script. Keep extra text minimal and only add a blessing or motif if it fits the chosen context.",
  },
  BABY_AQEEQAH_INVITE: {
    description: "baby celebration invitation",
    aspectRatio: "4:5",
    rules:
      "Prominent child name, ceremony title, date, time, venue, and family names. The invitation heading should match the actual baby occasion rather than assuming aqeeqah.",
  },
  BABY_MILESTONE_CARD: {
    description: "baby monthly milestone card for sharing",
    aspectRatio: "1:1",
    rules:
      "Baby name + milestone text ('\u0634\u0647\u0631 \u0648\u0627\u062d\u062f' / '\u0664\u0660 \u064a\u0648\u0645' / '\u0633\u0646\u0629 \u0623\u0648\u0644\u0649'). Clean design matching original birth announcement style. Shareable on Instagram/WhatsApp.",
  },
  BABY_WHATSAPP_CARD: {
    description: "birth announcement optimized for WhatsApp",
    aspectRatio: "1:1",
    rules:
      "Child name large with key details such as date and weight. Designed to survive WhatsApp compression. Only include blessings or faith markers if the ceremony context supports them.",
  },
  BABY_THANK_YOU: {
    description: "thank you card for baby gifts and well-wishes",
    aspectRatio: "4:5",
    rules:
      "Short gratitude message matching the announcement style. Use a thank-you header only if it fits the family tradition and language set.",
  },
};
