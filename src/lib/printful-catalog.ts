/** Printful product catalog mapping for Sahm print orders. */

export type PrintProductType = "FRAMED_POSTER" | "CANVAS" | "FRAMED_CANVAS";
export type PrintSize = "12x16" | "16x20" | "24x36";
export type FrameColor = "black" | "white" | "natural";

interface PrintVariant {
  variantId: number;
  printfulCost: number; // cents
}

interface PrintProduct {
  printfulProductId: number;
  label: string;
  description: string;
  sizes: Partial<Record<PrintSize, {
    /** Frame color → Printful variant ID + cost. Unframed products use "none" key. */
    variants: Record<string, PrintVariant>;
  }>>;
}

export const PRINT_CATALOG: Record<PrintProductType, PrintProduct> = {
  FRAMED_POSTER: {
    printfulProductId: 2,
    label: "Framed Print",
    description: "Museum-quality matte paper in a solid wood frame, ready to hang",
    sizes: {
      "12x16": {
        variants: {
          black:   { variantId: 1350,  printfulCost: 3195 },
          white:   { variantId: 10751, printfulCost: 3195 },
          natural: { variantId: 15025, printfulCost: 3157 },
        },
      },
      "16x20": {
        variants: {
          black:   { variantId: 4399,  printfulCost: 4475 },
          white:   { variantId: 10753, printfulCost: 4475 },
          natural: { variantId: 15029, printfulCost: 4177 },
        },
      },
    },
  },

  CANVAS: {
    printfulProductId: 3,
    label: "Canvas",
    description: "Gallery-wrapped canvas on a sturdy wooden frame",
    sizes: {
      "12x16": {
        variants: {
          none: { variantId: 5, printfulCost: 2525 },
        },
      },
      "16x20": {
        variants: {
          none: { variantId: 6, printfulCost: 3075 },
        },
      },
    },
  },

  FRAMED_CANVAS: {
    printfulProductId: 614,
    label: "Framed Canvas",
    description: "Premium canvas in a floating wooden frame — gallery showpiece",
    sizes: {
      "16x20": {
        variants: {
          black:   { variantId: 16037, printfulCost: 7225 },
          white:   { variantId: 15698, printfulCost: 7225 },
          natural: { variantId: 16043, printfulCost: 7225 },
        },
      },
      "24x36": {
        variants: {
          black:   { variantId: 16039, printfulCost: 11750 },
          white:   { variantId: 15700, printfulCost: 11750 },
          natural: { variantId: 16045, printfulCost: 11750 },
        },
      },
    },
  },
} as const;

/** Retail prices in cents. */
export const RETAIL_PRICES: Record<PrintProductType, Record<string, number>> = {
  FRAMED_POSTER: { "12x16": 4999, "16x20": 6999 },
  CANVAS:        { "12x16": 4499, "16x20": 5499 },
  FRAMED_CANVAS: { "16x20": 10999, "24x36": 17999 },
};

export const FRAME_COLORS: Record<string, string> = {
  black: "Black",
  white: "White",
  natural: "Natural Wood",
};

export function getVariant(product: PrintProductType, size: PrintSize, frame: string) {
  const sizeData = PRINT_CATALOG[product]?.sizes[size];
  if (!sizeData) return null;
  return sizeData.variants[frame] ?? null;
}

export function getRetailPrice(product: PrintProductType, size: PrintSize) {
  return RETAIL_PRICES[product]?.[size] ?? null;
}

export function requiresFrame(product: PrintProductType) {
  return product !== "CANVAS";
}

/** Build a flat list of available print products for the frontend. */
export function getPrintProductList() {
  return Object.entries(PRINT_CATALOG).flatMap(([type, product]) =>
    Object.entries(product.sizes).flatMap(([size, sizeData]) => {
      const retail = RETAIL_PRICES[type as PrintProductType]?.[size] ?? 0;
      const frames = Object.keys(sizeData!.variants).filter((f) => f !== "none");
      return {
        type,
        label: product.label,
        description: product.description,
        size,
        retailPrice: retail,
        frameColors: frames.length > 0 ? frames : null,
      };
    }),
  );
}
