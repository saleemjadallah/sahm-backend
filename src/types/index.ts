import type {
  GenerationStatus,
  CreditTxnType,
  SubPlan,
} from "@prisma/client";

// ─── Auth ──────────────────────────────────────────────

export interface JwtPayload {
  sub: string;        // userId
  email: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  locale: string;
}

// ─── Auth Requests / Responses ─────────────────────────

export interface MagicLinkRequest {
  email: string;
}

export interface MagicLinkVerifyRequest {
  email: string;
  token: string;
}

export interface GoogleAuthRequest {
  idToken: string;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: TokenPair;
}

// ─── Category ─────────────────────────────────────────

export interface CategoryResponse {
  id: string;
  label: string;
  description: string | null;
  iconUrl: string | null;
  sortOrder: number;
  outputSpecs: CategoryOutputSpecsResponse | null;
  referenceImage: ReferenceImageConfigResponse | null;
  styleOptions: string[] | null;
  subcategories: SubcategoryResponse[];
}

export interface SubcategoryResponse {
  id: string;
  label: string;
  description: string | null;
  defaultAspect: string;
}

export interface CategoryOutputFormatResponse {
  id: string;
  label: string;
  description: string;
  aspectRatio: string;
  resolution: string;
  creditsCost: number;
  promptHint: string;
}

export interface CategoryOutputSpecsResponse {
  defaultAspectRatio: string;
  availableAspectRatios: string[];
  defaultResolution: string;
  supportsTextOverlay: boolean;
  defaultFormatId: string;
  formats: CategoryOutputFormatResponse[];
}

export interface ReferenceImageConfigResponse {
  mode: "identity" | "subject" | "scene";
  label: string;
  hint: string;
  maxCount: 1;
}

// ─── Generation ───────────────────────────────────────

export interface GenerateRequest {
  categoryId: string;
  subcategoryId?: string;
  userPrompt?: string;
  style?: string;
  aspectRatio?: string;
  outputFormatId?: string;
  referenceAssetId?: string;
  metadata?: Record<string, unknown>;
  promptVariant?: string;
}

export interface GenerationResponse {
  id: string;
  categoryId: string;
  subcategoryId: string | null;
  userPrompt: string | null;
  style: string | null;
  aspectRatio: string;
  referenceAssetId: string | null;
  previewUrl: string | null;
  fullUrl: string | null;
  status: GenerationStatus;
  creditsCost: number;
  packId: string | null;
  isDownloaded: boolean;
  createdAt: string;
  guestAccessToken?: string | null;
}

export interface RegenerateRequest {
  style?: string;
  userPrompt?: string;
  promptVariant?: string;
}

export interface ReferenceAssetResponse {
  id: string;
  categoryId: string;
  originalFilename: string | null;
  mimeType: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  createdAt: string;
}

// ─── Pack ─────────────────────────────────────────────

export interface CreatePackRequest {
  categoryId: string;
  items: {
    subcategoryId?: string;
    userPrompt?: string;
    metadata?: Record<string, unknown>;
  }[];
  style?: string;
  metadata?: Record<string, unknown>;
}

export interface PackResponse {
  id: string;
  categoryId: string;
  label: string;
  style: string | null;
  generations: GenerationResponse[];
  createdAt: string;
}

// ─── Credits ──────────────────────────────────────────

export interface CreditBalanceResponse {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
}

export interface CreditTransactionResponse {
  id: string;
  type: CreditTxnType;
  amount: number;
  balance: number;
  description: string | null;
  createdAt: string;
}

export interface CreditPurchaseRequest {
  packSize: "PACK_10" | "PACK_50" | "PACK_100" | "PACK_500";
  returnPath?: string;
}

export interface CheckoutResponse {
  sessionId: string;
  url: string;
  mode?: "checkout" | "subscription_checkout" | "billing_portal";
}

export interface SubscriptionCheckoutRequest {
  plan: "STARTER" | "PRO" | "UNLIMITED";
  returnPath?: string;
}

// ─── Translation ──────────────────────────────────────

export interface TranslateRequest {
  text: string;
  fieldType: "name" | "phrase" | "venue" | "general";
  fromLang: string;
  toLangs: string[];
  context?: string;
}

export interface TranslateUIRequest {
  strings: Record<string, string>;
  targetLang: "ar" | "hi";
}

// ─── Pagination ───────────────────────────────────────

export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ─── API Response ─────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
