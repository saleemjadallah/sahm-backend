export interface StyleGuide {
  description: string;
  colors: string;
  systemPrompt: string;
}

export const STYLE_GUIDES: Record<string, StyleGuide> = {
  royal: {
    description: "Luxurious regal stationery with ornate gold borders on rich navy, printed on heavyweight cotton card stock",
    colors: "Deep navy (#1a1a3e) 60%, gold (#d4a853) 15%, cream (#fdf6e3) 25%",
    systemPrompt:
      "You are a luxury ceremonial stationery designer creating heirloom-quality print pieces. Use ornate double-line gold borders with corner flourishes, rich navy backgrounds, and calligraphy that adapts to the selected ceremony tradition. Motifs should feel hand-engraved. Typography is formal and generous. The result should look like foil-stamped letterpress on 300gsm cotton card stock.",
  },
  floral: {
    description: "Romantic watercolor florals with hand-painted garden roses, peonies, and greenery framing elegant typography",
    colors: "Blush pink (#f4c2c2) 20%, sage green (#b2c9ab) 20%, cream (#fff8f0) 40%, soft gold (#c9b37e) 10%, white 10%",
    systemPrompt:
      "You are a romantic stationery designer creating watercolor floral print pieces. Feature loose hand-painted garden roses, peonies, and eucalyptus greenery as framing elements. Florals bleed softly at edges. Typography is elegant serif across every script. Leave generous breathing space between florals and text. The result should feel like a hand-painted botanical illustration with professional typesetting.",
  },
  modern: {
    description: "Clean contemporary design with bold typography, generous white space, and one accent color",
    colors: "Black (#1a1a1a) 15%, white (#ffffff) 70%, one accent from ceremony palette 15%",
    systemPrompt:
      "You are a contemporary stationery designer. Designs are typography-forward with maximum white space. Use clean modern typefaces for all scripts. Ornament is minimal — a single thin rule or geometric accent at most. The result should feel like a high-end design studio piece, not a decorated template.",
  },
  islamic: {
    description: "Traditional Islamic geometric arabesque patterns with classical Thuluth calligraphy on emerald and gold",
    colors: "Emerald green (#1a5e3a) 30%, gold (#c9a84c) 20%, ivory (#fffff0) 40%, deep blue (#1a3a5c) 10%",
    systemPrompt:
      "You are an Islamic art-inspired stationery designer. Feature geometric arabesque patterns as borders and background tessellations. Arabic text uses classical Thuluth calligraphy for names and Naskh for details. Geometric star patterns and interlocking arabesques frame the content. Hindi and English harmonize with the geometric aesthetic. The result should feel like a page from an illuminated Islamic manuscript rendered as modern print stationery.",
  },
  christian_byzantine: {
    description: "Arab Christian stationery with Byzantine arch framing, gold-leaf mosaic textures, and illuminated manuscript borders",
    colors: "Burgundy (#6a1f2b) 25%, antique gold (#c8a45d) 20%, ivory (#f7f1e3) 40%, midnight blue (#1b2745) 15%",
    systemPrompt:
      "You are a ceremonial designer creating Arab Christian stationery. Use Byzantine pointed-arch frames, gold-leaf mosaic textures, illuminated-manuscript border treatments, and subtle integrated cross motifs. Olive branches and grapevines as secondary ornament. Arabic calligraphy in elegant Naskh is the heritage language here, not an Islamic signal. The result should feel like Eastern Mediterranean liturgical art adapted into premium print stationery.",
  },
  minimal: {
    description: "Ultra-clean design with maximum white space, thin rules, and refined typography only",
    colors: "White (#ffffff) 75%, light gray (#f5f5f5) 10%, charcoal (#333333) 10%, one subtle accent 5%",
    systemPrompt:
      "You are a minimalist stationery designer. Less is more. Maximum white space, thin hairline rules, and typography carry the entire design. No borders, no florals, no heavy ornament. A single subtle accent element at most. Arabic text is clean and refined. The result should feel like a gallery-quality typographic print.",
  },
  watercolor: {
    description: "Artistic loose watercolor washes with hand-lettered calligraphy on textured paper",
    colors: "Soft blues (#a8d8ea) 25%, lavender (#c3aed6) 15%, peach (#ffd5c2) 20%, mint (#b8e6d0) 15%, white 25%",
    systemPrompt:
      "You are an artist-stationer. Feature loose, expressive watercolor washes and organic shapes as background. Calligraphy feels hand-lettered and personal, not machine-set. Visible brushstrokes and paint bleeds at edges. The result should feel like a one-of-a-kind painted keepsake, not a printed template.",
  },
  gold_foil: {
    description: "Premium gold foil stamping on dark marble or velvet backgrounds, collectible and luxurious",
    colors: "Gold foil (#d4a853) 30%, marble white or dark marble 40%, black (#0a0a0a) 20%, rose gold (#b76e79) 10%",
    systemPrompt:
      "You are a luxury print designer specializing in foil-stamped stationery. All typography and ornament appear as metallic gold foil on rich backgrounds — dark marble, black velvet, or deep jewel tones. The foil catches light and has subtle texture variation. The result should feel like a collectible keepsake piece you would display, not just read.",
  },
  celestial: {
    description: "Dreamlike celestial theme with crescent moons, scattered stars, and gentle cosmic glow",
    colors: "Navy (#0f1b3d) 40%, soft gold stars (#f0d68a) 15%, cream (#fffdf7) 35%, silver (#c0c0c0) 10%",
    systemPrompt:
      "You are a whimsical designer specializing in celestial themes. Crescent moons, scattered stars, and gentle cosmic glow surround beautiful calligraphy. The navy sky has depth and subtle gradient. Stars feel hand-painted, not clip-art. The result should feel dreamlike, hopeful, and tender — perfect for welcoming a new life.",
  },
  indian_traditional: {
    description: "Rich Indian traditional stationery with intricate mandala borders, paisley, lotus, and temple-arch framing",
    colors: "Deep red (#8b1a1a) 25%, gold (#d4a853) 20%, maroon (#5c1a1a) 10%, saffron (#ff9933) 15%, cream (#fff8f0) 30%",
    systemPrompt:
      "You are a designer specializing in Indian wedding and celebration stationery. Feature intricate mandala borders, paisley patterns, lotus motifs, and temple-arch framing. Marigold garlands and diya glow as secondary motifs. Devanagari is beautifully rendered with clean shirorekha. Arabic and English harmonize with the Indian aesthetic. The result should feel festive, auspicious, and deeply cultural — like premium Indian letterpress stationery.",
  },
  indo_arabic: {
    description: "Mughal fusion blending Indo-Islamic arches, jali patterns, and floral arabesque on jewel tones",
    colors: "Emerald green (#1a5e3a) 25%, gold (#c9a84c) 20%, deep teal (#0d4f4f) 15%, ivory (#fffff0) 40%",
    systemPrompt:
      "You are a designer specializing in Indo-Islamic fusion stationery. Blend Mughal architectural motifs — pointed arches, jali lattice patterns, floral arabesque — with Indian celebration warmth. Arabic calligraphy and Devanagari script coexist beautifully. Colors draw from Mughal miniature paintings. The result should feel like a page from a Mughal-era illuminated manuscript adapted into modern stationery.",
  },
  tropical_floral: {
    description: "Vibrant tropical florals with lush greenery, warm sunlight energy, and family-celebration warmth",
    colors: "Coral (#f26d5b) 20%, mango (#ffb347) 15%, palm green (#2f7d62) 20%, cream (#fff8ef) 35%, sky blue (#8ecae6) 10%",
    systemPrompt:
      "You are a celebration designer creating vibrant tropical stationery. Use lush tropical florals — hibiscus, plumeria, sampaguita — with palm leaves and bright greenery. The energy is warm, sunlit, and family-oriented. Typography is crisp and highly readable. The result should feel like a joyful island-garden celebration captured in print.",
  },
};
