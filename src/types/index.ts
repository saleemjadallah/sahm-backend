import type {
  ProjectType,
  ProjectStatus,
  DesignType,
  RsvpStatus,
  MilestoneType,
  PurchaseType,
  SubPlan,
  GenerationStatus,
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

// ─── Project ───────────────────────────────────────────

export interface CreateProjectRequest {
  type: ProjectType;
  title?: string;
  nameEn?: string;
  nameAr?: string;
  nameHi?: string;
  date?: string;         // ISO date string
  dateHijri?: string;
  languages?: string[];  // ["en", "ar", "hi"]
  metadata?: WeddingMetadata | BabyMetadata;
  style?: string;
}

export interface WeddingMetadata {
  groomNameAr?: string;
  groomNameEn?: string;
  groomNameHi?: string;
  brideNameAr?: string;
  brideNameEn?: string;
  brideNameHi?: string;
  groomFatherAr?: string;
  groomFatherEn?: string;
  groomFatherHi?: string;
  brideFatherAr?: string;
  brideFatherEn?: string;
  brideFatherHi?: string;
  groomFamilyAr?: string;
  groomFamilyEn?: string;
  groomFamilyHi?: string;
  brideFamilyAr?: string;
  brideFamilyEn?: string;
  brideFamilyHi?: string;
  venue?: string;
  venueAr?: string;
  venueHi?: string;
  city?: string;
  weddingTime?: string;
  receptionTime?: string;
  dressCode?: string;
  rsvpDeadline?: string;
  colorTheme?: string;
  style?: string;
  languages?: string[];
}

export interface BabyMetadata {
  babyNameAr?: string;
  babyNameEn?: string;
  babyNameHi?: string;
  gender?: "boy" | "girl";
  weight?: string;
  length?: string;
  time?: string;
  parentNamesAr?: string;
  parentNamesEn?: string;
  parentNamesHi?: string;
  birthDateHijri?: string;
  style?: string;
  languages?: string[];
}

export interface ProjectResponse {
  id: string;
  type: ProjectType;
  title: string | null;
  status: ProjectStatus;
  nameEn: string | null;
  nameAr: string | null;
  nameHi: string | null;
  date: string | null;
  dateHijri: string | null;
  languages: string[];
  rsvpSlug: string | null;
  metadata: WeddingMetadata | BabyMetadata | null;
  designs: DesignResponse[];
  createdAt: string;
  updatedAt: string;
}

// ─── Design ────────────────────────────────────────────

export interface DesignResponse {
  id: string;
  projectId: string;
  designType: DesignType;
  style: string | null;
  previewUrl: string;
  fullUrl: string | null;
  aspectRatio: string;
  generationStatus: GenerationStatus;
  textContent: Record<string, Record<string, string>> | null;
  isDownloaded: boolean;
  createdAt: string;
}

export interface GenerateSuiteRequest {
  style?: string;
}

export interface RegenerateDesignRequest {
  style?: string;
}

export interface EditDesignRequest {
  textContent: Record<string, Record<string, string>>;
}

// ─── Translation ───────────────────────────────────────

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

// ─── Payment ───────────────────────────────────────────

export interface CheckoutRequest {
  projectId: string;
  purchaseType: "SINGLE_DESIGN" | "SUITE" | "SUITE_RSVP" | "BABY_SET" | "BABY_JOURNEY" | "CREDIT_PACK_10" | "CREDIT_PACK_30";
  designId?: string;  // Required for SINGLE_DESIGN
}

export interface CheckoutResponse {
  sessionId: string;
  url: string;
}

// ─── RSVP ──────────────────────────────────────────────

export interface RsvpPublicResponse {
  projectTitle: string | null;
  nameEn: string | null;
  nameAr: string | null;
  date: string | null;
  dateHijri: string | null;
  metadata: WeddingMetadata | null;
  invitationDesign: DesignResponse | null;
}

export interface RsvpRespondRequest {
  name: string;
  nameAr?: string;
  phone?: string;
  email?: string;
  rsvpStatus: "ATTENDING" | "NOT_ATTENDING" | "MAYBE";
  plusOnes?: number;
  dietaryNotes?: string;
}

// ─── Guest ─────────────────────────────────────────────

export interface CreateGuestRequest {
  name: string;
  nameAr?: string;
  phone?: string;
  email?: string;
  tableNumber?: string;
}

export interface UpdateGuestRequest {
  name?: string;
  nameAr?: string;
  phone?: string;
  email?: string;
  tableNumber?: string;
  rsvpStatus?: RsvpStatus;
  plusOnes?: number;
  dietaryNotes?: string;
}

export interface GuestImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export interface BroadcastRequest {
  guestIds?: string[];  // If empty, broadcast to all pending
  message?: string;
}

export interface BroadcastLink {
  guestId: string;
  guestName: string;
  whatsappUrl: string;
}

// ─── Pagination ────────────────────────────────────────

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

// ─── API Response ──────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
