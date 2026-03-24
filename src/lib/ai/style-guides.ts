export interface StyleGuide {
  description: string;
  colors: string;
  systemPrompt: string;
}

export const STYLE_GUIDES: Record<string, StyleGuide> = {
  royal: {
    description: "Luxurious, regal, gold-accented design with ornate borders",
    colors: "Deep navy (#1a1a3e), gold (#d4a853), cream (#fdf6e3), white",
    systemPrompt:
      "You are a luxury ceremonial stationery designer specializing in multilingual calligraphy. Your designs evoke royalty, elegance, and heritage. Use ornate gold borders, rich backgrounds, and script treatment that adapts to the selected ceremony tradition.",
  },
  floral: {
    description: "Romantic, soft floral design with watercolor elements",
    colors: "Blush pink (#f4c2c2), sage green (#b2c9ab), cream (#fff8f0), soft gold (#c9b37e)",
    systemPrompt:
      "You are a romantic stationery designer. Your designs feature soft watercolor florals, gentle color palettes, and elegant typography across every script. The feeling is warm, inviting, and celebratory.",
  },
  modern: {
    description: "Clean, contemporary, minimalist with bold typography",
    colors: "Black (#1a1a1a), white (#ffffff), one accent color from brand palette",
    systemPrompt:
      "You are a contemporary stationery designer. Your designs are minimal, typography-forward, with generous white space. All scripts use clean modern typefaces. The feeling is sophisticated and understated.",
  },
  islamic: {
    description: "Traditional Islamic geometric patterns with elegant calligraphy",
    colors: "Emerald green (#1a5e3a), gold (#c9a84c), ivory (#fffff0), deep blue (#1a3a5c)",
    systemPrompt:
      "You are an Islamic art-inspired stationery designer. Your designs incorporate geometric arabesque patterns, traditional Islamic borders, and classical Thuluth calligraphy for Arabic. Hindi and English text should harmonize with the Islamic geometric aesthetic. The feeling is sacred, beautiful, and culturally rooted.",
  },
  christian_byzantine: {
    description: "Arab Christian and Byzantine-inspired liturgical elegance",
    colors: "Burgundy (#6a1f2b), antique gold (#c8a45d), ivory (#f7f1e3), midnight blue (#1b2745)",
    systemPrompt:
      "You are a ceremonial designer creating Arab Christian stationery. Use Byzantine ornament, church-arch geometry, illuminated-manuscript elegance, subtle cross motifs where contextually appropriate, and refined Arabic plus English typography. The feeling is sacred, luminous, and heritage-rich without becoming heavy-handed.",
  },
  minimal: {
    description: "Ultra-clean, lots of white space, thin elegant typography",
    colors: "White (#ffffff), light gray (#f5f5f5), charcoal (#333333), one subtle accent",
    systemPrompt:
      "You are a minimalist stationery designer. Less is more. Your designs use maximum white space, thin elegant typography, and subtle touches. Arabic text is clean and refined. No ornament unless essential.",
  },
  watercolor: {
    description: "Artistic watercolor washes with hand-lettered feel",
    colors: "Soft blues (#a8d8ea), lavender (#c3aed6), peach (#ffd5c2), mint (#b8e6d0)",
    systemPrompt:
      "You are an artist-stationer. Your designs feature loose watercolor washes, organic shapes, and calligraphy that feels hand-lettered. The feeling is artistic, unique, and personal.",
  },
  gold_foil: {
    description: "Premium gold foil effect on dark or marble backgrounds",
    colors: "Gold foil (#d4a853), marble white, black (#0a0a0a), rose gold (#b76e79)",
    systemPrompt:
      "You are a luxury print designer. Your designs simulate premium gold foil stamping on rich backgrounds such as dark marble, velvet, or deep jewel tones. Typography should feel collectible, print-led, and culturally tailored to the ceremony.",
  },
  celestial: {
    description: "Stars, moon, cosmic elements \u2014 popular for baby designs",
    colors: "Navy (#0f1b3d), soft gold stars (#f0d68a), cream (#fffdf7), silver (#c0c0c0)",
    systemPrompt:
      "You are a whimsical designer specializing in celestial themes. Moons, stars, and gentle cosmic elements surround beautiful calligraphy in any script. The feeling is dreamlike, hopeful, and tender.",
  },
  indian_traditional: {
    description: "Rich Indian traditional style with mandala, paisley, and lotus motifs",
    colors: "Deep red (#8b1a1a), gold (#d4a853), maroon (#5c1a1a), saffron (#ff9933), cream (#fff8f0)",
    systemPrompt:
      "You are a designer specializing in Indian wedding and celebration stationery. Your designs feature intricate mandala borders, paisley patterns, lotus motifs, and rich warm colors. Devanagari should be beautifully rendered with clean shirorekha. Arabic and English, when present, must harmonize with the Indian aesthetic. The feeling is festive, auspicious, and deeply cultural.",
  },
  indo_arabic: {
    description: "Fusion style blending Mughal/Indo-Islamic aesthetics \u2014 perfect for Indian Muslim families",
    colors: "Emerald green (#1a5e3a), gold (#c9a84c), deep teal (#0d4f4f), ivory (#fffff0)",
    systemPrompt:
      "You are a designer specializing in Indo-Islamic fusion stationery. Your designs blend Mughal architectural motifs (arches, jali patterns, floral arabesque) with Indian celebration aesthetics. Arabic calligraphy and Devanagari script coexist beautifully. Colors draw from Mughal miniature paintings \u2014 emerald, gold, teal, ivory. The feeling is elegant, culturally rich, and harmonious across traditions.",
  },
  tropical_floral: {
    description: "Joyful tropical florals for Filipino and family celebration moments",
    colors: "Coral (#f26d5b), mango (#ffb347), palm green (#2f7d62), cream (#fff8ef), sky blue (#8ecae6)",
    systemPrompt:
      "You are a celebration designer creating vibrant tropical stationery. Use lush florals, sunlight, breezy compositions, and warm family-oriented energy. Keep typography crisp and accessible, with Arabic or Hindi used only when provided and always harmonized with the bright festive palette.",
  },
};
