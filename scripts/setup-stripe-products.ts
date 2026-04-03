/**
 * Create Stripe products for Sahm's new per-portrait pricing flow.
 *
 * Usage:
 *   npx tsx scripts/setup-stripe-products.ts
 *
 * Requires: STRIPE_SECRET_KEY in .env
 *
 * Outputs product IDs to add to your .env file. Safe to re-run —
 * it checks for existing products by metadata before creating new ones.
 */

import "dotenv/config";
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("Missing STRIPE_SECRET_KEY in environment.");
  process.exit(1);
}

const stripe = new Stripe(key);

const PRODUCTS = [
  {
    envVar: "STRIPE_PRODUCT_PORTRAITS",
    name: "Memorial Portrait",
    description: "AI-generated memorial portrait of your beloved pet, delivered as a high-resolution PNG with print-ready file.",
    metadataKey: "sahm_portraits",
  },
  {
    envVar: "STRIPE_PRODUCT_YOUNG_AGAIN",
    name: "Young Again Portrait",
    description: "See your pet as a puppy or kitten — an extra portrait add-on.",
    metadataKey: "sahm_young_again",
  },
  {
    envVar: "STRIPE_PRODUCT_LETTER",
    name: "Letter From Heaven",
    description: "A heartfelt AI-written letter from your pet's perspective.",
    metadataKey: "sahm_letter",
  },
  {
    envVar: "STRIPE_PRODUCT_STORYBOOK",
    name: "A Day In Their Life",
    description: "An illustrated storybook featuring a day in your pet's happiest memories.",
    metadataKey: "sahm_storybook",
  },
] as const;

async function findExisting(metadataKey: string): Promise<string | null> {
  const products = await stripe.products.search({
    query: `metadata["sahm_type"]:"${metadataKey}"`,
  });
  return products.data[0]?.id ?? null;
}

async function main() {
  console.log("Setting up Stripe products for Sahm...\n");

  const results: Array<{ envVar: string; id: string; created: boolean }> = [];

  for (const def of PRODUCTS) {
    const existing = await findExisting(def.metadataKey);
    if (existing) {
      results.push({ envVar: def.envVar, id: existing, created: false });
      continue;
    }

    const product = await stripe.products.create({
      name: def.name,
      description: def.description,
      metadata: { sahm_type: def.metadataKey },
    });
    results.push({ envVar: def.envVar, id: product.id, created: true });
  }

  console.log("Done! Add these to your backend .env:\n");
  for (const r of results) {
    console.log(`${r.envVar}=${r.id}${r.created ? "" : "  # (already existed)"}`);
  }
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
