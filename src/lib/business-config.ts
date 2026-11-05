/**
 * Central business configuration for Lumiere Belleza Store
 * Override via environment variables or database settings in production.
 */

export const businessConfig = {
  name: "Lumiere Belleza",
  slug: "lumiere-belleza",
  tagline: "Original Skincare & Cosmetics in Abuja",
  description:
    "Trusted brands like CeraVe, PanOxyl, Nivea, Korean skincare and more. 100% original products with nationwide delivery.",
  logoUrl: "/logo.svg",
  website: "https://www.lumierebellezastore.com",

  // Brand colours (inspired by Solar Axis dark theme + warm accent)
  colors: {
    primary: "#F5A623",      // yellow/amber accent
    navy: "#0F1C2E",
    aiBubble: "#1A7A4C",
    adminBubble: "#2B5CDB",
    background: "#0B1220",
  },

  // Contact
  whatsappPhoneNumber: "+2349041111160",
  whatsappDisplay: "0904 111 1160",
  supportEmail: "hello@lumierebellezastore.com",
  address: "Shop C1, 09, River Park Estate Plaza, Lugbe Airport Road, Abuja",

  // Locale
  timezone: "Africa/Lagos",
  currency: "NGN",
  currencySymbol: "₦",
  locale: "en-NG",

  // AI / Support context
  systemPromptContext: `
You are the AI customer support assistant for Lumiere Belleza Store, a premium skincare and cosmetics retailer in Abuja, Nigeria.
We sell 100% original products including CeraVe, PanOxyl, Nivea, Olay, St. Ives, Palmer's, Garnier, Dr Teal's, EOS, Korean skincare and more.
We specialise in products suitable for dark skin and offer nationwide delivery (1-day in Abuja).
Be warm, professional, helpful and knowledge about skincare routines.
Always encourage customers to shop at https://www.lumierebellezastore.com or visit our store in Lugbe.
WhatsApp number for human support: +234 904 111 1160.
`,

  // Default product categories (can be expanded from DB)
  categories: [
    "Cleansers",
    "Moisturisers",
    "Body Care",
    "Serums & Treatments",
    "Sunscreen",
    "Fragrance",
    "Kids & Baby",
    "Sale",
  ],
} as const;

export type BusinessConfig = typeof businessConfig;
