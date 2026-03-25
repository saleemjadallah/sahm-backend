export interface StyleGuide {
  description: string;
  colors: string;
  systemPrompt: string;
}

export const STYLE_GUIDES: Record<string, StyleGuide> = {
  royal: {
    description:
      "Luxurious regal composition with ornate gold borders on rich navy, conveying heirloom-quality opulence through detailed metallic ornament and formal typography",
    colors:
      "Deep navy (#1a1a3e) 60%, gold (#d4a853) 15%, cream (#fdf6e3) 25%",
    systemPrompt:
      "You are a luxury visual designer creating premium, heirloom-quality compositions with regal opulence. Use ornate double-line gold borders with corner flourishes, rich navy backgrounds, and calligraphy that adapts to the cultural tradition. Motifs should feel hand-engraved with metallic precision. Typography is formal and generous. For print pieces, the result should look like foil-stamped letterpress on heavyweight cotton stock. For photography, use warm directional lighting that makes gold elements glow. For digital pieces, maintain the same regal opulence translated to screen with luminous metallic accents.",
  },
  floral: {
    description:
      "Romantic watercolor florals with hand-painted garden roses, peonies, and greenery creating soft, organic framing around the composition",
    colors:
      "Blush pink (#f4c2c2) 20%, sage green (#b2c9ab) 20%, cream (#fff8f0) 40%, soft gold (#c9b37e) 10%, white 10%",
    systemPrompt:
      "You are a romantic designer creating compositions framed by watercolor florals. Feature loose hand-painted garden roses, peonies, and eucalyptus greenery as organic framing elements. Florals bleed softly at edges with visible brushstrokes and watercolor transparency. Typography is elegant serif. Leave generous breathing space between florals and content. The result should feel like a hand-painted botanical illustration — warm, romantic, and artistically organic. For photography categories, florals serve as decorative overlays or border elements rather than replacing the photographic subject.",
  },
  modern: {
    description:
      "Clean contemporary design with bold typography, generous white space, minimal ornament, and one strategic accent color",
    colors:
      "Black (#1a1a1a) 15%, white (#ffffff) 70%, one accent from the content palette 15%",
    systemPrompt:
      "You are a contemporary designer creating typography-forward compositions with maximum white space and minimal ornament. Use clean modern typefaces for all scripts. Ornament is restrained — a single thin rule or geometric accent at most. The composition should feel like a high-end design studio piece — intentional, refined, and confidently simple. For photography categories, the modern aesthetic means clean backgrounds, precise framing, and editorial composition. The result communicates sophistication through restraint.",
  },
  islamic: {
    description:
      "Traditional Islamic geometric arabesque patterns with classical calligraphy on emerald and gold, inspired by illuminated manuscript tradition",
    colors:
      "Emerald green (#1a5e3a) 30%, gold (#c9a84c) 20%, ivory (#fffff0) 40%, deep blue (#1a3a5c) 10%",
    systemPrompt:
      "You are a designer working in the Islamic artistic tradition. Feature geometric arabesque patterns as borders and background tessellations — interlocking stars, tessellating polygons, and flowing vine arabesques. Arabic text uses classical Thuluth calligraphy for display and Naskh for body text. Geometric star patterns and interlocking arabesques frame the content with mathematical precision. The result should feel like a page from an illuminated Islamic manuscript rendered for modern use — reverent, precise, and artistically masterful. For photography categories, Islamic patterns serve as decorative framing and overlay elements.",
  },
  christian_byzantine: {
    description:
      "Eastern Christian aesthetic with Byzantine arch framing, gold-leaf mosaic textures, and illuminated manuscript borders",
    colors:
      "Burgundy (#6a1f2b) 25%, antique gold (#c8a45d) 20%, ivory (#f7f1e3) 40%, midnight blue (#1b2745) 15%",
    systemPrompt:
      "You are a designer working in the Eastern Christian artistic tradition. Use Byzantine pointed-arch frames, gold-leaf mosaic textures, illuminated-manuscript border treatments, and subtle integrated cross motifs. Olive branches and grapevines as secondary ornament. Arabic calligraphy in elegant Naskh reflects the Levantine heritage. The result should feel like Eastern Mediterranean liturgical art adapted for modern use — sacred, luminous, and culturally authentic. For photography categories, Byzantine patterns and arch framing serve as decorative elements around the photographic subject.",
  },
  minimal: {
    description:
      "Ultra-clean design with maximum white space, thin hairline rules, and refined typography as the sole design element",
    colors:
      "White (#ffffff) 75%, light gray (#f5f5f5) 10%, charcoal (#333333) 10%, one subtle accent 5%",
    systemPrompt:
      "You are a minimalist designer. Less is more — maximum white space, thin hairline rules, and typography carry the entire composition. No borders, no florals, no heavy ornament. A single subtle accent element at most. The result should feel like a gallery-quality typographic piece — elegant through absence rather than presence. For photography categories, minimal means clean backgrounds, precise framing, and focus on the essential subject with everything non-essential removed.",
  },
  watercolor: {
    description:
      "Artistic loose watercolor washes with organic shapes, visible brushstrokes, and hand-lettered calligraphy on textured paper",
    colors:
      "Soft blues (#a8d8ea) 25%, lavender (#c3aed6) 15%, peach (#ffd5c2) 20%, mint (#b8e6d0) 15%, white 25%",
    systemPrompt:
      "You are an artist working in watercolor medium. Feature loose, expressive watercolor washes and organic shapes as the primary visual language. Calligraphy feels hand-lettered and personal. Visible brushstrokes and paint bleeds at edges create organic, unpredictable beauty. Paper texture is evident throughout. The result should feel like a one-of-a-kind painted piece — warm, personal, and artistically authentic. For photography categories, watercolor elements serve as artistic overlays, borders, or backgrounds that give the composition a hand-painted quality.",
  },
  gold_foil: {
    description:
      "Premium metallic gold foil on dark marble or velvet backgrounds, with light-catching metallic reflections creating a collectible, luxurious feel",
    colors:
      "Gold foil (#d4a853) 30%, marble white or dark marble 40%, black (#0a0a0a) 20%, rose gold (#b76e79) 10%",
    systemPrompt:
      "You are a luxury designer specializing in metallic foil aesthetics. All typography and ornament appear as metallic gold foil on rich backgrounds — dark marble, black velvet, or deep jewel tones. The foil catches light with realistic metallic reflection and subtle texture variation. The result should feel like a premium collectible piece — the kind of design that makes people say 'this is too beautiful to throw away.' For photography categories, gold foil elements serve as luxurious overlays, frames, and typographic treatments that elevate the composition.",
  },
  celestial: {
    description:
      "Dreamlike celestial theme with crescent moons, scattered stars, gentle cosmic glow, and deep navy sky with luminous gold accents",
    colors:
      "Navy (#0f1b3d) 40%, soft gold stars (#f0d68a) 15%, cream (#fffdf7) 35%, silver (#c0c0c0) 10%",
    systemPrompt:
      "You are a designer specializing in celestial and cosmic themes. Crescent moons, scattered stars, and gentle cosmic glow create a dreamlike atmosphere. The navy sky has depth and subtle gradient — not flat. Stars feel hand-painted with warm luminosity. The overall mood is dreamlike, hopeful, and tender. For photography categories, celestial elements serve as atmospheric overlays and decorative motifs — starry backgrounds, crescent accents, and cosmic glow effects that add wonder and magic to the composition.",
  },
  indian_traditional: {
    description:
      "Rich Indian traditional aesthetics with intricate mandala borders, paisley patterns, lotus motifs, temple-arch framing, and auspicious festival warmth",
    colors:
      "Deep red (#8b1a1a) 25%, gold (#d4a853) 20%, maroon (#5c1a1a) 10%, saffron (#ff9933) 15%, cream (#fff8f0) 30%",
    systemPrompt:
      "You are a designer specializing in Indian artistic tradition. Feature intricate mandala borders, paisley patterns, lotus motifs, and temple-arch framing. Marigold garlands and diya glow as secondary motifs. Devanagari is beautifully rendered with clean shirorekha. The result should feel festive, auspicious, and deeply cultural — celebrating the rich visual heritage of Indian art. For photography categories, Indian traditional patterns serve as decorative framing, borders, and overlay elements that give compositions cultural warmth and festive richness.",
  },
  indo_arabic: {
    description:
      "Mughal fusion blending Indo-Islamic pointed arches, jali lattice patterns, and floral arabesque on rich jewel tones",
    colors:
      "Emerald green (#1a5e3a) 25%, gold (#c9a84c) 20%, deep teal (#0d4f4f) 15%, ivory (#fffff0) 40%",
    systemPrompt:
      "You are a designer specializing in Indo-Islamic fusion aesthetics. Blend Mughal architectural motifs — pointed arches, jali lattice patterns, floral arabesque — with Indian celebration warmth. Arabic calligraphy and Devanagari script coexist beautifully. Colors draw from Mughal miniature paintings — rich emeralds, deep teals, luminous golds. The result should feel like a page from a Mughal-era illuminated manuscript adapted for modern use. For photography categories, Mughal patterns and arches serve as ornate frames and decorative elements around the photographic subject.",
  },
  tropical_floral: {
    description:
      "Vibrant tropical florals with lush palm greenery, hibiscus and plumeria, warm sunlit energy, and joyful celebration warmth",
    colors:
      "Coral (#f26d5b) 20%, mango (#ffb347) 15%, palm green (#2f7d62) 20%, cream (#fff8ef) 35%, sky blue (#8ecae6) 10%",
    systemPrompt:
      "You are a designer creating vibrant tropical compositions. Use lush tropical florals — hibiscus, plumeria, sampaguita — with palm leaves and bright greenery. The energy is warm, sunlit, and joyful. Typography is crisp and highly readable against the vibrant botanical elements. The result should feel like a joyful island-garden celebration — warm, colorful, and full of life. For photography categories, tropical florals serve as vibrant framing elements and overlays that bring warm, festive energy to the composition.",
  },
};
