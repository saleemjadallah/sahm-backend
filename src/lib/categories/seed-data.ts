/**
 * Category seed data — defines all 12 categories with their prompt configs,
 * metadata schemas, output specs, subcategories, and applicable styles.
 *
 * This is the product definition layer. Each category is essentially a
 * prompt library + metadata schema + style options + output specs.
 *
 * Prompt content is enhanced by the prompt database (prompt-database.ts).
 * The main variant's prompts are applied to each category at export time,
 * so the DB seed always contains the latest optimized prompts.
 */

import { PROMPT_DATABASE } from "../ai/prompt-database.js";

export interface CategoryPromptConfig {
  systemPrompt: string;
  contextTemplate: string;
  outputGuidance: string;
  negativeGuidance: string;
}

export interface CategoryOutputSpecs {
  defaultAspectRatio: string;
  availableAspectRatios: string[];
  defaultResolution: string;
  supportsTextOverlay: boolean;
}

export interface SubcategorySeed {
  id: string;
  label: string;
  description: string;
  sortOrder: number;
  promptTemplate: string;
  defaultAspect: string;
}

export interface CategorySeed {
  id: string;
  label: string;
  description: string;
  sortOrder: number;
  promptConfig: CategoryPromptConfig;
  metadataSchema: Record<string, unknown>;
  outputSpecs: CategoryOutputSpecs;
  styleOptions: string[];
  subcategories: SubcategorySeed[];
}

// ─── All Styles ──────────────────────────────────────────

const ALL_STYLES = [
  "royal",
  "floral",
  "modern",
  "islamic",
  "christian_byzantine",
  "minimal",
  "watercolor",
  "gold_foil",
  "celestial",
  "indian_traditional",
  "indo_arabic",
  "tropical_floral",
];

// ─── Category Definitions ────────────────────────────────

export const CATEGORIES: CategorySeed[] = [
  // ──────────────────────────────────────────────────────
  // 1. EVENT STATIONERY
  // ──────────────────────────────────────────────────────
  {
    id: "event-stationery",
    label: "Event Stationery",
    description:
      "Premium AI-designed invitations and stationery for weddings, baby celebrations, birthdays, and special events",
    sortOrder: 1,
    promptConfig: {
      systemPrompt:
        "You are a luxury stationery designer creating premium print-ready designs for life celebrations. Every design should look like it was crafted by hand at a high-end atelier. Adapt to the cultural context and event type provided. Text must be rendered with calligraphic precision.",
      contextTemplate:
        "Create a {{subcategory}} design.\n\n{{#eventType}}Event type: {{eventType}}{{/eventType}}\n{{#names}}Names: {{names}}{{/names}}\n{{#date}}Date: {{date}}{{/date}}\n{{#venue}}Venue: {{venue}}{{/venue}}\n{{#additionalInfo}}Details: {{additionalInfo}}{{/additionalInfo}}",
      outputGuidance:
        "Print-ready at 300 DPI. Clean edges suitable for die-cutting or premium printing. Balanced composition with clear hierarchy between decorative elements and text areas.",
      negativeGuidance:
        "Do not include placeholder text, Lorem Ipsum, or example data. Do not use stock photo elements. No pixelated textures.",
    },
    metadataSchema: {
      type: "object",
      properties: {
        eventType: { type: "string", label: "Event Type", required: false },
        names: { type: "string", label: "Names", required: false },
        date: { type: "string", label: "Date", required: false },
        venue: { type: "string", label: "Venue", required: false },
        additionalInfo: {
          type: "string",
          label: "Additional Details",
          required: false,
        },
        languages: {
          type: "array",
          label: "Languages",
          items: { type: "string", enum: ["en", "ar", "hi"] },
          required: false,
        },
      },
    },
    outputSpecs: {
      defaultAspectRatio: "4:5",
      availableAspectRatios: ["4:5", "1:1", "A5", "A4", "16:9"],
      defaultResolution: "4k",
      supportsTextOverlay: true,
    },
    styleOptions: ALL_STYLES,
    subcategories: [
      {
        id: "wedding-invitation",
        label: "Wedding Invitation",
        description: "Elegant wedding invitations for all traditions",
        sortOrder: 1,
        promptTemplate:
          "A premium wedding invitation card. The design should be elegant, celebratory, and culturally appropriate for the couple's tradition.",
        defaultAspect: "4:5",
      },
      {
        id: "save-the-date",
        label: "Save the Date",
        description: "Save-the-date cards for upcoming events",
        sortOrder: 2,
        promptTemplate:
          "A beautiful save-the-date card. Focus on the date prominently displayed with romantic or festive framing.",
        defaultAspect: "4:5",
      },
      {
        id: "baby-announcement",
        label: "Baby Announcement",
        description: "Birth announcements and baby celebration cards",
        sortOrder: 3,
        promptTemplate:
          "A tender baby announcement card. Soft, warm tones with gentle motifs appropriate for welcoming a new life.",
        defaultAspect: "4:5",
      },
      {
        id: "birthday-invitation",
        label: "Birthday Invitation",
        description: "Birthday party invitations for all ages",
        sortOrder: 4,
        promptTemplate:
          "A festive birthday invitation card. Joyful and celebratory with age-appropriate design.",
        defaultAspect: "4:5",
      },
      {
        id: "engagement-card",
        label: "Engagement Card",
        description: "Engagement announcement and party invitations",
        sortOrder: 5,
        promptTemplate:
          "An elegant engagement announcement card. Romantic, refined, with a sense of anticipation and celebration.",
        defaultAspect: "4:5",
      },
      {
        id: "rsvp-card",
        label: "RSVP Card",
        description: "Response cards for events",
        sortOrder: 6,
        promptTemplate:
          "A coordinated RSVP response card. Compact, clear layout with space for guest response.",
        defaultAspect: "1:1",
      },
      {
        id: "thank-you-card",
        label: "Thank You Card",
        description: "Post-event thank you cards",
        sortOrder: 7,
        promptTemplate:
          "A graceful thank-you card. Warm, heartfelt design expressing gratitude.",
        defaultAspect: "4:5",
      },
      {
        id: "menu-card",
        label: "Menu Card",
        description: "Event menu and table cards",
        sortOrder: 8,
        promptTemplate:
          "An elegant menu card for a formal event. Clear hierarchy for course listings with decorative framing.",
        defaultAspect: "A5",
      },
    ],
  },

  // ──────────────────────────────────────────────────────
  // 2. WALL ART & HOME DECOR
  // ──────────────────────────────────────────────────────
  {
    id: "wall-art",
    label: "Wall Art & Home Decor",
    description:
      "Custom AI-generated wall art — Islamic calligraphy, name art, quotes, abstract, and heritage designs",
    sortOrder: 2,
    promptConfig: {
      systemPrompt:
        "You are a fine art print designer creating gallery-quality wall art for modern homes. Each piece should be striking enough to anchor a room. Focus on clean composition, rich detail, and emotional resonance. The artwork should look professionally produced, suitable for framing and display.",
      contextTemplate:
        "Create a {{subcategory}} wall art piece.\n\n{{#text}}Text/phrase: {{text}}{{/text}}\n{{#room}}Intended room: {{room}}{{/room}}\n{{#theme}}Theme: {{theme}}{{/theme}}\n{{#additionalInfo}}Notes: {{additionalInfo}}{{/additionalInfo}}",
      outputGuidance:
        "High-resolution artwork suitable for large-format printing. Rich detail that rewards close viewing. Balanced composition that works on a wall.",
      negativeGuidance:
        "Do not create generic clip-art style images. No overly busy compositions that lose clarity at print size. No low-detail areas that will look flat when printed large.",
    },
    metadataSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          label: "Text / Phrase",
          required: false,
        },
        room: {
          type: "string",
          label: "Room Type",
          required: false,
          enum: [
            "Living Room",
            "Bedroom",
            "Nursery",
            "Office",
            "Entrance",
            "Dining Room",
          ],
        },
        theme: { type: "string", label: "Theme", required: false },
        additionalInfo: {
          type: "string",
          label: "Additional Notes",
          required: false,
        },
      },
    },
    outputSpecs: {
      defaultAspectRatio: "3:4",
      availableAspectRatios: ["3:4", "4:3", "1:1", "2:3", "16:9"],
      defaultResolution: "4k",
      supportsTextOverlay: true,
    },
    styleOptions: [
      "royal",
      "islamic",
      "modern",
      "minimal",
      "watercolor",
      "gold_foil",
      "celestial",
      "indian_traditional",
      "indo_arabic",
    ],
    subcategories: [
      {
        id: "islamic-calligraphy",
        label: "Islamic Calligraphy",
        description:
          "Beautiful Islamic calligraphy art with geometric patterns",
        sortOrder: 1,
        promptTemplate:
          "A stunning Islamic calligraphy wall art piece. Feature masterful Arabic calligraphy with intricate geometric or arabesque patterns. The calligraphy should be the focal point, surrounded by harmonious decorative elements.",
        defaultAspect: "3:4",
      },
      {
        id: "quranic-verse",
        label: "Quranic Verse Art",
        description: "Beautifully rendered Quranic verses",
        sortOrder: 2,
        promptTemplate:
          "A reverential Quranic verse wall art. The Arabic text should be rendered in beautiful calligraphy as the centerpiece, with respectful decorative framing that enhances without distracting.",
        defaultAspect: "3:4",
      },
      {
        id: "name-art",
        label: "Name Art",
        description: "Personalized name art in Arabic or English calligraphy",
        sortOrder: 3,
        promptTemplate:
          "A personalized name art piece. The name should be the hero element, rendered in beautiful calligraphy with complementary decorative elements that celebrate the name's beauty.",
        defaultAspect: "3:4",
      },
      {
        id: "quote-art",
        label: "Quote Art",
        description: "Inspirational quotes and phrases as wall art",
        sortOrder: 4,
        promptTemplate:
          "An inspirational quote wall art piece. Typography is the star — the quote should be beautifully set with visual hierarchy and artistic framing.",
        defaultAspect: "3:4",
      },
      {
        id: "abstract-art",
        label: "Abstract Art",
        description: "Abstract contemporary art for modern interiors",
        sortOrder: 5,
        promptTemplate:
          "A striking abstract wall art piece. Bold composition with interesting texture, color interplay, and visual depth. Gallery-worthy contemporary art.",
        defaultAspect: "3:4",
      },
      {
        id: "heritage-art",
        label: "Heritage & Cultural Art",
        description:
          "Art celebrating Gulf, Arab, and South Asian cultural heritage",
        sortOrder: 6,
        promptTemplate:
          "A cultural heritage wall art piece. Celebrate traditional motifs, architecture, or cultural symbols in a contemporary art format.",
        defaultAspect: "3:4",
      },
    ],
  },

  // ──────────────────────────────────────────────────────
  // 3. GREETING & GIFT CARDS
  // ──────────────────────────────────────────────────────
  {
    id: "greeting-cards",
    label: "Greeting & Gift Cards",
    description:
      "AI-designed greeting cards for Eid, Ramadan, Diwali, Christmas, National Day, and all occasions",
    sortOrder: 3,
    promptConfig: {
      systemPrompt:
        "You are a greeting card designer creating heartfelt, culturally resonant cards. Each design should convey warmth and the spirit of the occasion. Cards should feel personal, not generic — as if hand-picked for the recipient.",
      contextTemplate:
        "Create a {{subcategory}} greeting card.\n\n{{#recipientName}}For: {{recipientName}}{{/recipientName}}\n{{#message}}Message: {{message}}{{/message}}\n{{#occasion}}Occasion: {{occasion}}{{/occasion}}\n{{#additionalInfo}}Notes: {{additionalInfo}}{{/additionalInfo}}",
      outputGuidance:
        "Print-ready card design with front-cover focus. Bold, emotionally resonant imagery with clear space for personalized message.",
      negativeGuidance:
        "Do not use generic stock imagery. No cluttered layouts. Avoid cliche clip-art elements.",
    },
    metadataSchema: {
      type: "object",
      properties: {
        recipientName: {
          type: "string",
          label: "Recipient Name",
          required: false,
        },
        message: { type: "string", label: "Message", required: false },
        occasion: { type: "string", label: "Occasion", required: false },
        additionalInfo: {
          type: "string",
          label: "Additional Notes",
          required: false,
        },
      },
    },
    outputSpecs: {
      defaultAspectRatio: "4:5",
      availableAspectRatios: ["4:5", "1:1", "3:4"],
      defaultResolution: "2k",
      supportsTextOverlay: true,
    },
    styleOptions: ALL_STYLES,
    subcategories: [
      {
        id: "eid-card",
        label: "Eid Mubarak Card",
        description: "Cards for Eid al-Fitr and Eid al-Adha",
        sortOrder: 1,
        promptTemplate:
          "A beautiful Eid greeting card. Capture the joy, generosity, and spiritual warmth of Eid celebrations with culturally appropriate motifs — crescents, lanterns, geometric patterns.",
        defaultAspect: "4:5",
      },
      {
        id: "ramadan-card",
        label: "Ramadan Kareem Card",
        description: "Cards for the holy month of Ramadan",
        sortOrder: 2,
        promptTemplate:
          "A serene Ramadan greeting card. Evoke the spiritual depth, tranquility, and community of the holy month. Crescents, mosques, lanterns, and iftar imagery.",
        defaultAspect: "4:5",
      },
      {
        id: "diwali-card",
        label: "Diwali Card",
        description: "Cards for the festival of lights",
        sortOrder: 3,
        promptTemplate:
          "A vibrant Diwali greeting card. Celebrate the festival of lights with diyas, rangoli patterns, fireworks, and warm golden glow. Festive and auspicious.",
        defaultAspect: "4:5",
      },
      {
        id: "christmas-card",
        label: "Christmas Card",
        description: "Christmas and holiday season cards",
        sortOrder: 4,
        promptTemplate:
          "A warm Christmas greeting card. Festive imagery with holiday spirit — can range from traditional nativity to modern winter wonderland depending on style.",
        defaultAspect: "4:5",
      },
      {
        id: "national-day-card",
        label: "National Day Card",
        description: "Cards for UAE National Day and regional celebrations",
        sortOrder: 5,
        promptTemplate:
          "A patriotic National Day greeting card. Celebrate national pride with iconic landmarks, flags, and cultural symbols. Dignified yet celebratory.",
        defaultAspect: "4:5",
      },
      {
        id: "thank-you-greeting",
        label: "Thank You Card",
        description: "General purpose thank you cards",
        sortOrder: 6,
        promptTemplate:
          "A heartfelt thank-you greeting card. Warm, genuine, and graceful. The design should convey sincere gratitude.",
        defaultAspect: "4:5",
      },
      {
        id: "congratulations-card",
        label: "Congratulations Card",
        description: "Cards for achievements and celebrations",
        sortOrder: 7,
        promptTemplate:
          "A celebratory congratulations card. Joyful, uplifting design that honors an achievement or milestone.",
        defaultAspect: "4:5",
      },
      {
        id: "condolence-card",
        label: "Condolence Card",
        description: "Sympathy and condolence cards",
        sortOrder: 8,
        promptTemplate:
          "A respectful condolence card. Gentle, dignified design that conveys sympathy and comfort. Muted, serene palette with reverent imagery.",
        defaultAspect: "4:5",
      },
    ],
  },

  // ──────────────────────────────────────────────────────
  // 4. SOCIAL MEDIA CONTENT
  // ──────────────────────────────────────────────────────
  {
    id: "social-media",
    label: "Social Media Content",
    description:
      "Scroll-stopping Instagram posts, stories, reels covers, WhatsApp cards, and announcement graphics",
    sortOrder: 4,
    promptConfig: {
      systemPrompt:
        "You are a social media creative director creating scroll-stopping visual content. Designs must be bold, immediately eye-catching at thumbnail size, and optimized for mobile viewing. Text must be minimal and highly readable. Think editorial, not template.",
      contextTemplate:
        "Create a {{subcategory}} design.\n\n{{#platform}}Platform: {{platform}}{{/platform}}\n{{#headline}}Headline: {{headline}}{{/headline}}\n{{#brandName}}Brand: {{brandName}}{{/brandName}}\n{{#description}}Description: {{description}}{{/description}}",
      outputGuidance:
        "Optimized for mobile viewing. Bold colors that survive compression. Text must be readable at thumbnail size. Clean negative space.",
      negativeGuidance:
        "Do not include tiny text, excessive detail, or subtle gradients that compress poorly. No busy backgrounds that compete with text.",
    },
    metadataSchema: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          label: "Platform",
          required: false,
          enum: ["Instagram", "Facebook", "WhatsApp", "YouTube", "TikTok", "LinkedIn"],
        },
        headline: { type: "string", label: "Headline", required: false },
        brandName: { type: "string", label: "Brand Name", required: false },
        description: {
          type: "string",
          label: "Description",
          required: false,
        },
      },
    },
    outputSpecs: {
      defaultAspectRatio: "1:1",
      availableAspectRatios: ["1:1", "9:16", "4:5", "16:9"],
      defaultResolution: "2k",
      supportsTextOverlay: false,
    },
    styleOptions: ["modern", "minimal", "floral", "gold_foil", "tropical_floral", "watercolor"],
    subcategories: [
      {
        id: "instagram-post",
        label: "Instagram Post",
        description: "Square posts for Instagram feed",
        sortOrder: 1,
        promptTemplate:
          "A scroll-stopping Instagram feed post. Bold visual with strong focal point. Minimal text, maximum impact.",
        defaultAspect: "1:1",
      },
      {
        id: "instagram-story",
        label: "Instagram Story",
        description: "Vertical stories for Instagram and WhatsApp",
        sortOrder: 2,
        promptTemplate:
          "A captivating vertical story graphic. Full-bleed vertical composition optimized for 9:16 mobile viewing.",
        defaultAspect: "9:16",
      },
      {
        id: "reel-cover",
        label: "Reel / TikTok Cover",
        description: "Cover images for video content",
        sortOrder: 3,
        promptTemplate:
          "An eye-catching reel or TikTok cover image. Thumbnail-optimized with bold text and strong visual hook.",
        defaultAspect: "9:16",
      },
      {
        id: "whatsapp-card",
        label: "WhatsApp Card",
        description: "Shareable cards for WhatsApp messages",
        sortOrder: 4,
        promptTemplate:
          "A beautiful shareable WhatsApp card. Clean, instantly readable on mobile. Warm and personal.",
        defaultAspect: "1:1",
      },
      {
        id: "announcement-graphic",
        label: "Announcement Graphic",
        description: "Bold announcement graphics for any platform",
        sortOrder: 5,
        promptTemplate:
          "A bold announcement graphic. High-impact visual that demands attention. Clear message hierarchy.",
        defaultAspect: "1:1",
      },
    ],
  },

  // ──────────────────────────────────────────────────────
  // 5. FOOD & RESTAURANT
  // ──────────────────────────────────────────────────────
  {
    id: "food-restaurant",
    label: "Food & Restaurant",
    description:
      "AI-generated food photography, menu designs, cafe branding, and restaurant social media content",
    sortOrder: 5,
    promptConfig: {
      systemPrompt:
        "You are a food photographer and restaurant branding designer. Create mouthwatering, appetite-inducing visuals that make people want to eat, visit, or order. Food should look fresh, vibrant, and authentically styled — never artificial or overly processed.",
      contextTemplate:
        "Create a {{subcategory}} design.\n\n{{#cuisine}}Cuisine: {{cuisine}}{{/cuisine}}\n{{#dishName}}Dish/Item: {{dishName}}{{/dishName}}\n{{#restaurantName}}Restaurant: {{restaurantName}}{{/restaurantName}}\n{{#mood}}Mood: {{mood}}{{/mood}}\n{{#additionalInfo}}Notes: {{additionalInfo}}{{/additionalInfo}}",
      outputGuidance:
        "Photo-realistic food imagery with professional lighting. Warm, appetizing color temperature. Styled as editorial food photography.",
      negativeGuidance:
        "Do not create unrealistic or plastic-looking food. No oversaturated colors. Avoid clinical or sterile compositions.",
    },
    metadataSchema: {
      type: "object",
      properties: {
        cuisine: {
          type: "string",
          label: "Cuisine Type",
          required: false,
          enum: [
            "Arabic",
            "Indian",
            "Italian",
            "Japanese",
            "American",
            "Fusion",
            "Cafe/Coffee",
            "Desserts",
            "Other",
          ],
        },
        dishName: { type: "string", label: "Dish / Item Name", required: false },
        restaurantName: {
          type: "string",
          label: "Restaurant Name",
          required: false,
        },
        mood: {
          type: "string",
          label: "Mood",
          required: false,
          enum: ["Cozy", "Upscale", "Casual", "Modern", "Traditional", "Rustic"],
        },
        additionalInfo: {
          type: "string",
          label: "Additional Notes",
          required: false,
        },
      },
    },
    outputSpecs: {
      defaultAspectRatio: "1:1",
      availableAspectRatios: ["1:1", "4:5", "3:4", "16:9"],
      defaultResolution: "2k",
      supportsTextOverlay: false,
    },
    styleOptions: ["modern", "minimal", "watercolor", "gold_foil", "tropical_floral"],
    subcategories: [
      {
        id: "food-photography",
        label: "Food Photography",
        description: "Styled food photography for menus and marketing",
        sortOrder: 1,
        promptTemplate:
          "Professional styled food photography. Beautifully plated dish with professional lighting, shallow depth of field, and appetizing presentation.",
        defaultAspect: "1:1",
      },
      {
        id: "menu-design",
        label: "Menu Design",
        description: "Restaurant and cafe menu layouts",
        sortOrder: 2,
        promptTemplate:
          "An elegant restaurant menu design. Clear typography hierarchy, beautiful layout, with food imagery integration.",
        defaultAspect: "A4",
      },
      {
        id: "cafe-social",
        label: "Cafe / Restaurant Social Media",
        description: "Social media posts for food businesses",
        sortOrder: 3,
        promptTemplate:
          "A mouthwatering social media post for a restaurant or cafe. Scroll-stopping food visual with brand-appropriate styling.",
        defaultAspect: "1:1",
      },
      {
        id: "recipe-card",
        label: "Recipe Card",
        description: "Beautiful recipe cards and food guides",
        sortOrder: 4,
        promptTemplate:
          "A beautifully designed recipe card. Combines appetizing food imagery with clear recipe layout.",
        defaultAspect: "4:5",
      },
    ],
  },

  // ──────────────────────────────────────────────────────
  // 6. BUSINESS & CORPORATE
  // ──────────────────────────────────────────────────────
  {
    id: "business",
    label: "Business & Corporate",
    description:
      "Professional business cards, letterheads, presentation covers, and corporate event materials",
    sortOrder: 6,
    promptConfig: {
      systemPrompt:
        "You are a corporate identity designer creating professional, polished business materials. Every design should communicate competence, trustworthiness, and brand sophistication. Clean, refined, and industry-appropriate.",
      contextTemplate:
        "Create a {{subcategory}} design.\n\n{{#companyName}}Company: {{companyName}}{{/companyName}}\n{{#industry}}Industry: {{industry}}{{/industry}}\n{{#brandColors}}Brand colors: {{brandColors}}{{/brandColors}}\n{{#tagline}}Tagline: {{tagline}}{{/tagline}}\n{{#additionalInfo}}Notes: {{additionalInfo}}{{/additionalInfo}}",
      outputGuidance:
        "Print-ready or presentation-quality. Professional typography, clean alignment, and intentional white space. Corporate but not sterile.",
      negativeGuidance:
        "Do not use overly creative or whimsical elements. No busy patterns. Avoid designs that look like free templates.",
    },
    metadataSchema: {
      type: "object",
      properties: {
        companyName: {
          type: "string",
          label: "Company Name",
          required: false,
        },
        industry: {
          type: "string",
          label: "Industry",
          required: false,
          enum: [
            "Technology",
            "Finance",
            "Healthcare",
            "Real Estate",
            "Consulting",
            "Education",
            "Hospitality",
            "Retail",
            "Legal",
            "Other",
          ],
        },
        brandColors: {
          type: "string",
          label: "Brand Colors",
          required: false,
        },
        tagline: { type: "string", label: "Tagline", required: false },
        additionalInfo: {
          type: "string",
          label: "Additional Notes",
          required: false,
        },
      },
    },
    outputSpecs: {
      defaultAspectRatio: "1:1",
      availableAspectRatios: ["1:1", "16:9", "A4", "3:2"],
      defaultResolution: "2k",
      supportsTextOverlay: false,
    },
    styleOptions: ["modern", "minimal", "royal", "gold_foil"],
    subcategories: [
      {
        id: "business-card",
        label: "Business Card",
        description: "Professional business card designs",
        sortOrder: 1,
        promptTemplate:
          "A premium business card design. Clean, professional layout with brand personality. Both front and back if requested.",
        defaultAspect: "3:2",
      },
      {
        id: "letterhead",
        label: "Letterhead",
        description: "Corporate letterhead and stationery",
        sortOrder: 2,
        promptTemplate:
          "A professional letterhead design. Subtle branding, clean layout, with appropriate header and footer zones.",
        defaultAspect: "A4",
      },
      {
        id: "presentation-cover",
        label: "Presentation Cover",
        description: "Slide deck covers and title cards",
        sortOrder: 3,
        promptTemplate:
          "A striking presentation cover slide. Bold, professional visual that sets the tone for a corporate presentation.",
        defaultAspect: "16:9",
      },
      {
        id: "corporate-event",
        label: "Corporate Event Material",
        description: "Conference badges, event signage, and materials",
        sortOrder: 4,
        promptTemplate:
          "Professional corporate event material. Clean, branded design suitable for conferences, workshops, or corporate events.",
        defaultAspect: "1:1",
      },
      {
        id: "company-profile",
        label: "Company Profile Visual",
        description: "Visual assets for company profiles and brochures",
        sortOrder: 5,
        promptTemplate:
          "A polished company profile visual. Communicates professionalism and industry expertise through refined design.",
        defaultAspect: "A4",
      },
    ],
  },

  // ──────────────────────────────────────────────────────
  // 7. REAL ESTATE & INTERIOR
  // ──────────────────────────────────────────────────────
  {
    id: "real-estate",
    label: "Real Estate & Interior",
    description:
      "Property listing graphics, room staging concepts, and interior design visualizations",
    sortOrder: 7,
    promptConfig: {
      systemPrompt:
        "You are a real estate marketing designer and interior visualization specialist. Create aspirational, luxurious property visuals that make people dream of living there. Lighting should be warm and inviting. Spaces should feel livable yet elevated.",
      contextTemplate:
        "Create a {{subcategory}} visual.\n\n{{#propertyType}}Property type: {{propertyType}}{{/propertyType}}\n{{#location}}Location: {{location}}{{/location}}\n{{#roomType}}Room: {{roomType}}{{/roomType}}\n{{#interiorStyle}}Interior style: {{interiorStyle}}{{/interiorStyle}}\n{{#additionalInfo}}Notes: {{additionalInfo}}{{/additionalInfo}}",
      outputGuidance:
        "Photo-realistic architectural visualization with professional lighting. Warm, inviting atmosphere. Magazine-quality composition.",
      negativeGuidance:
        "Do not create unrealistic floating furniture or impossible architecture. No overly artificial HDR looks. Avoid empty, cold compositions.",
    },
    metadataSchema: {
      type: "object",
      properties: {
        propertyType: {
          type: "string",
          label: "Property Type",
          required: false,
          enum: [
            "Villa",
            "Apartment",
            "Penthouse",
            "Office Space",
            "Retail",
            "Hotel",
            "Restaurant",
          ],
        },
        location: { type: "string", label: "Location", required: false },
        roomType: {
          type: "string",
          label: "Room Type",
          required: false,
          enum: [
            "Living Room",
            "Bedroom",
            "Kitchen",
            "Bathroom",
            "Office",
            "Exterior",
            "Pool Area",
            "Garden",
          ],
        },
        interiorStyle: {
          type: "string",
          label: "Interior Style",
          required: false,
          enum: [
            "Modern Minimalist",
            "Arabic Traditional",
            "Contemporary Luxury",
            "Scandinavian",
            "Industrial",
            "Art Deco",
            "Mediterranean",
          ],
        },
        additionalInfo: {
          type: "string",
          label: "Additional Notes",
          required: false,
        },
      },
    },
    outputSpecs: {
      defaultAspectRatio: "16:9",
      availableAspectRatios: ["16:9", "4:3", "3:2", "1:1"],
      defaultResolution: "4k",
      supportsTextOverlay: false,
    },
    styleOptions: ["modern", "minimal", "royal", "gold_foil"],
    subcategories: [
      {
        id: "property-listing",
        label: "Property Listing Graphic",
        description: "Marketing visuals for property listings",
        sortOrder: 1,
        promptTemplate:
          "A stunning property listing marketing visual. Aspirational real estate photography style with warm lighting and luxurious atmosphere.",
        defaultAspect: "16:9",
      },
      {
        id: "room-staging",
        label: "Room Staging",
        description: "Virtual staging for empty or unfurnished rooms",
        sortOrder: 2,
        promptTemplate:
          "A beautifully staged interior room. Warm, inviting, and livable. Professional interior photography style.",
        defaultAspect: "16:9",
      },
      {
        id: "interior-concept",
        label: "Interior Design Concept",
        description: "Interior design mood boards and visualizations",
        sortOrder: 3,
        promptTemplate:
          "An interior design visualization. Showcase a specific design concept with furniture, materials, and lighting that bring the vision to life.",
        defaultAspect: "16:9",
      },
      {
        id: "development-marketing",
        label: "Development Marketing",
        description: "Visual assets for real estate development marketing",
        sortOrder: 4,
        promptTemplate:
          "A real estate development marketing visual. Premium, aspirational imagery for property development advertising.",
        defaultAspect: "16:9",
      },
    ],
  },

  // ──────────────────────────────────────────────────────
  // 8. FASHION & LIFESTYLE
  // ──────────────────────────────────────────────────────
  {
    id: "fashion",
    label: "Fashion & Lifestyle",
    description:
      "Lookbook images, outfit cards, style boards, and fashion collection announcements",
    sortOrder: 8,
    promptConfig: {
      systemPrompt:
        "You are a fashion editorial creative director. Create high-fashion, magazine-worthy visuals with strong editorial point of view. Every image should tell a style story. Lighting, composition, and styling should be impeccable.",
      contextTemplate:
        "Create a {{subcategory}} visual.\n\n{{#brandName}}Brand: {{brandName}}{{/brandName}}\n{{#fashionStyle}}Style: {{fashionStyle}}{{/fashionStyle}}\n{{#season}}Season: {{season}}{{/season}}\n{{#garmentDescription}}Garment: {{garmentDescription}}{{/garmentDescription}}\n{{#additionalInfo}}Notes: {{additionalInfo}}{{/additionalInfo}}",
      outputGuidance:
        "Editorial fashion photography quality. Professional lighting, intentional composition, and strong mood. Magazine-worthy.",
      negativeGuidance:
        "Do not create amateur-looking product shots. No harsh flash photography. Avoid generic catalog styling.",
    },
    metadataSchema: {
      type: "object",
      properties: {
        brandName: { type: "string", label: "Brand Name", required: false },
        fashionStyle: {
          type: "string",
          label: "Fashion Style",
          required: false,
          enum: [
            "Modest Fashion",
            "Streetwear",
            "Luxury",
            "Casual",
            "Traditional",
            "Athleisure",
            "Formal",
          ],
        },
        season: {
          type: "string",
          label: "Season",
          required: false,
          enum: ["Spring/Summer", "Fall/Winter", "Resort", "Pre-Fall"],
        },
        garmentDescription: {
          type: "string",
          label: "Garment Description",
          required: false,
        },
        additionalInfo: {
          type: "string",
          label: "Additional Notes",
          required: false,
        },
      },
    },
    outputSpecs: {
      defaultAspectRatio: "4:5",
      availableAspectRatios: ["4:5", "3:4", "1:1", "9:16"],
      defaultResolution: "2k",
      supportsTextOverlay: false,
    },
    styleOptions: ["modern", "minimal", "gold_foil", "watercolor", "floral"],
    subcategories: [
      {
        id: "lookbook",
        label: "Lookbook Image",
        description: "Editorial lookbook photography",
        sortOrder: 1,
        promptTemplate:
          "A high-fashion lookbook image. Editorial styling with strong visual narrative and intentional mood.",
        defaultAspect: "4:5",
      },
      {
        id: "outfit-card",
        label: "Outfit Card",
        description: "Styled outfit flat-lays and cards",
        sortOrder: 2,
        promptTemplate:
          "A beautifully styled outfit card. Clean flat-lay or styled arrangement showcasing a complete look.",
        defaultAspect: "1:1",
      },
      {
        id: "style-board",
        label: "Style Board",
        description: "Fashion mood boards and style guides",
        sortOrder: 3,
        promptTemplate:
          "A curated fashion style board. Cohesive mood board combining textures, colors, and pieces into an inspiring visual story.",
        defaultAspect: "1:1",
      },
      {
        id: "collection-announcement",
        label: "Collection Announcement",
        description: "New collection or drop announcements",
        sortOrder: 4,
        promptTemplate:
          "A striking fashion collection announcement visual. Bold, editorial, with strong brand presence.",
        defaultAspect: "4:5",
      },
    ],
  },

  // ──────────────────────────────────────────────────────
  // 9. PORTRAITS & AVATARS
  // ──────────────────────────────────────────────────────
  {
    id: "portraits",
    label: "Portraits & Avatars",
    description:
      "Stylized portraits, professional avatars, family portraits, and pet portraits",
    sortOrder: 9,
    promptConfig: {
      systemPrompt:
        "You are a portrait artist creating stunning stylized portraits and avatars. Each portrait should capture personality and character while applying the chosen artistic style beautifully. The result should feel like a commissioned artwork.",
      contextTemplate:
        "Create a {{subcategory}}.\n\n{{#subject}}Subject: {{subject}}{{/subject}}\n{{#artisticStyle}}Artistic style: {{artisticStyle}}{{/artisticStyle}}\n{{#background}}Background: {{background}}{{/background}}\n{{#additionalInfo}}Notes: {{additionalInfo}}{{/additionalInfo}}",
      outputGuidance:
        "High-detail portrait with expressive quality. Professional composition with intentional lighting and color palette.",
      negativeGuidance:
        "Do not create uncanny-valley faces. No distorted features or unnatural proportions. Avoid generic, lifeless expressions.",
    },
    metadataSchema: {
      type: "object",
      properties: {
        subject: {
          type: "string",
          label: "Subject Description",
          required: false,
        },
        artisticStyle: {
          type: "string",
          label: "Artistic Style",
          required: false,
          enum: [
            "Oil Painting",
            "Watercolor",
            "Digital Art",
            "Pop Art",
            "Anime/Manga",
            "Realistic",
            "Minimalist Line Art",
            "Comic Book",
          ],
        },
        background: {
          type: "string",
          label: "Background",
          required: false,
          enum: [
            "Solid Color",
            "Abstract",
            "Nature",
            "Urban",
            "Studio",
            "Transparent",
          ],
        },
        additionalInfo: {
          type: "string",
          label: "Additional Notes",
          required: false,
        },
      },
    },
    outputSpecs: {
      defaultAspectRatio: "1:1",
      availableAspectRatios: ["1:1", "3:4", "4:5"],
      defaultResolution: "2k",
      supportsTextOverlay: false,
    },
    styleOptions: ["modern", "watercolor", "minimal", "gold_foil", "celestial"],
    subcategories: [
      {
        id: "stylized-portrait",
        label: "Stylized Portrait",
        description: "Artistic portrait from description",
        sortOrder: 1,
        promptTemplate:
          "A beautiful stylized portrait. Capture the subject's personality with artistic flair in the chosen style.",
        defaultAspect: "3:4",
      },
      {
        id: "professional-avatar",
        label: "Professional Avatar",
        description: "Avatars for LinkedIn, websites, and profiles",
        sortOrder: 2,
        promptTemplate:
          "A polished professional avatar. Clean, approachable, suitable for business profiles and social media.",
        defaultAspect: "1:1",
      },
      {
        id: "family-portrait",
        label: "Family Portrait",
        description: "Stylized family portrait artwork",
        sortOrder: 3,
        promptTemplate:
          "A heartwarming family portrait artwork. Capture the warmth and connection of family in an artistic style.",
        defaultAspect: "3:4",
      },
      {
        id: "pet-portrait",
        label: "Pet Portrait",
        description: "Artistic pet portraits",
        sortOrder: 4,
        promptTemplate:
          "An adorable pet portrait artwork. Capture the personality and charm of the pet with artistic skill.",
        defaultAspect: "1:1",
      },
    ],
  },

  // ──────────────────────────────────────────────────────
  // 10. RELIGIOUS & SPIRITUAL
  // ──────────────────────────────────────────────────────
  {
    id: "religious-art",
    label: "Religious & Spiritual",
    description:
      "Islamic mosque art, Christian church art, Hindu temple art, prayer cards, daily adhkar, and Ramadan calendars",
    sortOrder: 10,
    promptConfig: {
      systemPrompt:
        "You are a sacred art designer creating reverent, beautiful religious and spiritual artwork. Every piece should honor the faith tradition it represents with deep respect and artistic excellence. Sacred text must be rendered with the utmost care and calligraphic beauty.",
      contextTemplate:
        "Create a {{subcategory}} design.\n\n{{#faith}}Faith tradition: {{faith}}{{/faith}}\n{{#text}}Sacred text: {{text}}{{/text}}\n{{#purpose}}Purpose: {{purpose}}{{/purpose}}\n{{#additionalInfo}}Notes: {{additionalInfo}}{{/additionalInfo}}",
      outputGuidance:
        "High-quality artwork with reverent, respectful treatment of sacred content. Rich detail suitable for printing and display.",
      negativeGuidance:
        "Do not create anything disrespectful to any faith. No inaccurate religious text. Avoid mixing religious symbols from different faiths unless explicitly requested.",
    },
    metadataSchema: {
      type: "object",
      properties: {
        faith: {
          type: "string",
          label: "Faith Tradition",
          required: false,
          enum: ["Islam", "Christianity", "Hinduism", "Sikhism", "Universal/Interfaith"],
        },
        text: { type: "string", label: "Sacred Text / Verse", required: false },
        purpose: {
          type: "string",
          label: "Purpose",
          required: false,
          enum: [
            "Wall Art",
            "Prayer Card",
            "Daily Reminder",
            "Gift",
            "Ramadan Calendar",
            "Decoration",
          ],
        },
        additionalInfo: {
          type: "string",
          label: "Additional Notes",
          required: false,
        },
      },
    },
    outputSpecs: {
      defaultAspectRatio: "3:4",
      availableAspectRatios: ["3:4", "1:1", "4:5", "16:9"],
      defaultResolution: "4k",
      supportsTextOverlay: true,
    },
    styleOptions: [
      "islamic",
      "christian_byzantine",
      "indian_traditional",
      "gold_foil",
      "royal",
      "watercolor",
      "celestial",
      "minimal",
    ],
    subcategories: [
      {
        id: "mosque-art",
        label: "Mosque & Islamic Art",
        description: "Mosque illustrations and Islamic decorative art",
        sortOrder: 1,
        promptTemplate:
          "A stunning Islamic art piece featuring mosque architecture, geometric patterns, or Islamic motifs. Reverent and beautiful.",
        defaultAspect: "3:4",
      },
      {
        id: "church-art",
        label: "Church & Christian Art",
        description: "Church illustrations and Christian spiritual art",
        sortOrder: 2,
        promptTemplate:
          "A beautiful Christian spiritual art piece. Byzantine, iconographic, or contemporary sacred art honoring the Christian tradition.",
        defaultAspect: "3:4",
      },
      {
        id: "temple-art",
        label: "Temple & Hindu Art",
        description: "Temple illustrations and Hindu spiritual art",
        sortOrder: 3,
        promptTemplate:
          "A vibrant Hindu spiritual art piece. Temple architecture, deities, or sacred symbols rendered with devotion and artistic beauty.",
        defaultAspect: "3:4",
      },
      {
        id: "prayer-card",
        label: "Prayer Card",
        description: "Beautiful prayer cards for daily use",
        sortOrder: 4,
        promptTemplate:
          "A serene prayer card. Sacred text beautifully rendered with reverent decorative framing. Suitable for daily devotional use.",
        defaultAspect: "4:5",
      },
      {
        id: "daily-adhkar",
        label: "Daily Adhkar / Dua",
        description: "Daily remembrance and supplication cards",
        sortOrder: 5,
        promptTemplate:
          "A beautiful daily adhkar or dua card. Arabic text rendered in calligraphy with serene, contemplative design.",
        defaultAspect: "1:1",
      },
      {
        id: "ramadan-calendar",
        label: "Ramadan Calendar",
        description: "30-day Ramadan tracking calendars",
        sortOrder: 6,
        promptTemplate:
          "A beautiful Ramadan calendar design. 30-day grid with Islamic motifs, crescent moons, and space for daily tracking.",
        defaultAspect: "3:4",
      },
    ],
  },

  // ──────────────────────────────────────────────────────
  // 11. EDUCATION
  // ──────────────────────────────────────────────────────
  {
    id: "education",
    label: "Education",
    description:
      "Certificates, classroom decor, flashcards, and achievement cards for schools and learning",
    sortOrder: 11,
    promptConfig: {
      systemPrompt:
        "You are an educational materials designer creating engaging, professional learning resources. Designs should inspire learning, celebrate achievement, and make educational spaces more vibrant. Age-appropriate and culturally inclusive.",
      contextTemplate:
        "Create a {{subcategory}} design.\n\n{{#institution}}Institution: {{institution}}{{/institution}}\n{{#subject}}Subject: {{subject}}{{/subject}}\n{{#ageGroup}}Age group: {{ageGroup}}{{/ageGroup}}\n{{#recipientName}}Recipient: {{recipientName}}{{/recipientName}}\n{{#additionalInfo}}Notes: {{additionalInfo}}{{/additionalInfo}}",
      outputGuidance:
        "Clean, professional, and engaging. Readable typography suitable for the target age group. Print-ready quality.",
      negativeGuidance:
        "Do not create infantile designs for older students. No overly complex layouts for young children. Avoid culturally insensitive imagery.",
    },
    metadataSchema: {
      type: "object",
      properties: {
        institution: {
          type: "string",
          label: "School / Institution",
          required: false,
        },
        subject: { type: "string", label: "Subject", required: false },
        ageGroup: {
          type: "string",
          label: "Age Group",
          required: false,
          enum: [
            "Early Years (3-5)",
            "Primary (6-10)",
            "Middle School (11-14)",
            "High School (15-18)",
            "University",
            "Professional",
          ],
        },
        recipientName: {
          type: "string",
          label: "Recipient Name",
          required: false,
        },
        additionalInfo: {
          type: "string",
          label: "Additional Notes",
          required: false,
        },
      },
    },
    outputSpecs: {
      defaultAspectRatio: "A4",
      availableAspectRatios: ["A4", "1:1", "16:9", "4:5"],
      defaultResolution: "2k",
      supportsTextOverlay: true,
    },
    styleOptions: ["modern", "minimal", "floral", "watercolor", "celestial", "tropical_floral"],
    subcategories: [
      {
        id: "certificate",
        label: "Certificate",
        description: "Achievement and completion certificates",
        sortOrder: 1,
        promptTemplate:
          "A prestigious certificate design. Formal enough to celebrate achievement, with elegant borders and clear hierarchy for name and achievement text.",
        defaultAspect: "A4",
      },
      {
        id: "classroom-decor",
        label: "Classroom Decor",
        description: "Educational posters and classroom wall art",
        sortOrder: 2,
        promptTemplate:
          "An engaging classroom decoration. Educational, visually stimulating, and age-appropriate. Makes learning spaces more inspiring.",
        defaultAspect: "3:4",
      },
      {
        id: "flashcard",
        label: "Flashcard",
        description: "Learning flashcards and study aids",
        sortOrder: 3,
        promptTemplate:
          "A clear, effective educational flashcard. Bold visual with clean typography. Designed for quick learning and memorization.",
        defaultAspect: "1:1",
      },
      {
        id: "achievement-card",
        label: "Achievement Card",
        description: "Student achievement and star awards",
        sortOrder: 4,
        promptTemplate:
          "A celebratory achievement card. Makes students feel proud and recognized. Colorful, positive, and encouraging.",
        defaultAspect: "4:5",
      },
    ],
  },

  // ──────────────────────────────────────────────────────
  // 12. TRAVEL & HOSPITALITY
  // ──────────────────────────────────────────────────────
  {
    id: "travel",
    label: "Travel & Hospitality",
    description:
      "Destination art, hotel welcome cards, itinerary designs, and travel poster art",
    sortOrder: 12,
    promptConfig: {
      systemPrompt:
        "You are a travel and hospitality designer creating aspirational, wanderlust-inducing visuals. Every piece should make people dream of visiting. Capture the spirit of place — the light, the architecture, the culture, the feeling of being there.",
      contextTemplate:
        "Create a {{subcategory}} design.\n\n{{#destination}}Destination: {{destination}}{{/destination}}\n{{#hotelName}}Hotel/Property: {{hotelName}}{{/hotelName}}\n{{#theme}}Theme: {{theme}}{{/theme}}\n{{#season}}Season: {{season}}{{/season}}\n{{#additionalInfo}}Notes: {{additionalInfo}}{{/additionalInfo}}",
      outputGuidance:
        "Rich, atmospheric visuals that capture sense of place. Warm, inviting color temperature. Magazine-quality travel photography or artistic illustration.",
      negativeGuidance:
        "Do not create generic stock-photo-style travel images. No oversaturated HDR. Avoid cliche tourist poses.",
    },
    metadataSchema: {
      type: "object",
      properties: {
        destination: {
          type: "string",
          label: "Destination",
          required: false,
        },
        hotelName: {
          type: "string",
          label: "Hotel / Property Name",
          required: false,
        },
        theme: {
          type: "string",
          label: "Theme",
          required: false,
          enum: [
            "Beach & Sea",
            "Desert & Dunes",
            "Mountain",
            "City",
            "Cultural Heritage",
            "Luxury Resort",
            "Adventure",
          ],
        },
        season: {
          type: "string",
          label: "Season",
          required: false,
          enum: ["Summer", "Winter", "Spring", "Autumn"],
        },
        additionalInfo: {
          type: "string",
          label: "Additional Notes",
          required: false,
        },
      },
    },
    outputSpecs: {
      defaultAspectRatio: "16:9",
      availableAspectRatios: ["16:9", "3:4", "1:1", "4:5"],
      defaultResolution: "2k",
      supportsTextOverlay: false,
    },
    styleOptions: [
      "modern",
      "watercolor",
      "minimal",
      "tropical_floral",
      "gold_foil",
      "royal",
    ],
    subcategories: [
      {
        id: "destination-art",
        label: "Destination Art",
        description: "Artistic destination posters and prints",
        sortOrder: 1,
        promptTemplate:
          "A stunning destination art poster. Capture the essence and spirit of the place in an artistic, poster-worthy composition.",
        defaultAspect: "3:4",
      },
      {
        id: "hotel-welcome",
        label: "Hotel Welcome Card",
        description: "Guest welcome cards for hotels and resorts",
        sortOrder: 2,
        promptTemplate:
          "An elegant hotel welcome card. Warm, inviting design that makes guests feel special upon arrival.",
        defaultAspect: "4:5",
      },
      {
        id: "itinerary-design",
        label: "Itinerary Design",
        description: "Beautiful travel itinerary layouts",
        sortOrder: 3,
        promptTemplate:
          "A beautifully designed travel itinerary. Clear timeline layout with destination imagery and practical organization.",
        defaultAspect: "A4",
      },
      {
        id: "travel-poster",
        label: "Travel Poster",
        description: "Vintage and modern travel posters",
        sortOrder: 4,
        promptTemplate:
          "A captivating travel poster. Bold, artistic, with strong sense of place. Can range from vintage Art Deco to modern minimalist.",
        defaultAspect: "3:4",
      },
    ],
  },
];

// ─── Apply Enhanced Prompts from Database ───────────────

/**
 * Enhance CATEGORIES with main-variant prompts from the prompt database.
 * This ensures the DB seed always contains the latest Gemini-optimized prompts.
 */
function applyPromptDatabaseEnhancements(categories: CategorySeed[]): void {
  for (const category of categories) {
    const dbEntry = PROMPT_DATABASE.find((p) => p.categoryId === category.id);
    if (!dbEntry) continue;

    // Use main variant's prompts for the category config
    const mainVariant = dbEntry.variants.find((v) => v.id === "main");
    if (mainVariant) {
      category.promptConfig.systemPrompt = mainVariant.systemPrompt;
      category.promptConfig.contextTemplate = mainVariant.contextTemplate;
      category.promptConfig.outputGuidance = mainVariant.outputGuidance;
      category.promptConfig.negativeGuidance = mainVariant.negativeGuidance;
    }

    // Use enhanced subcategory prompts
    for (const subcategory of category.subcategories) {
      const dbSubcat = dbEntry.subcategories.find(
        (s) => s.subcategoryId === subcategory.id,
      );
      if (dbSubcat) {
        subcategory.promptTemplate = dbSubcat.promptTemplate;
      }
    }
  }
}

applyPromptDatabaseEnhancements(CATEGORIES);
