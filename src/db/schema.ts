// Drizzle schema (M1). Every tenant-owned table carries an `account_id` column,
// directly or via its parent (see docs/SPEC.md → Datenmodell).
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["owner", "member", "admin"]);
export const galleryStatus = pgEnum("gallery_status", [
  "draft",
  "published",
  "expired",
  "archived",
]);
export const downloadPolicy = pgEnum("download_policy", [
  "none",
  "web",
  "original",
]);
export const mediaType = pgEnum("media_type", ["photo", "video"]);
export const processingStatus = pgEnum("processing_status", [
  "pending",
  "processing",
  "ready",
  "failed",
]);
export const visitorRole = pgEnum("visitor_role", ["client", "guest"]);
export const eventType = pgEnum("event_type", [
  "view",
  "play",
  "download",
  "favorite",
]);

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const accounts = pgTable("accounts", {
  id: id(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("free"),
  subscriptionStatus: text("subscription_status").notNull().default("none"),
  billingInterval: text("billing_interval"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  // Time of the last applied billing webhook; guards against stale events.
  billingEventAt: timestamp("billing_event_at", { withTimezone: true }),
  storageUsedBytes: bigint("storage_used_bytes", { mode: "number" })
    .notNull()
    .default(0),
  stripeCustomerId: text("stripe_customer_id"),
  branding: jsonb("branding")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  customDomain: text("custom_domain").unique(),
  createdAt: createdAt(),
});

export const users = pgTable(
  "users",
  {
    id: id(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    emailVerified: timestamp("email_verified", { withTimezone: true }),
    image: text("image"),
    role: userRole("role").notNull().default("owner"),
    authProvider: text("auth_provider"),
    // Optional password login (D-141): scrypt hash, null = Magic Link / Google only.
    passwordHash: text("password_hash"),
    // 2FA (TOTP, D-131): secret is AES-GCM encrypted; active once totpEnabledAt is set.
    totpSecret: text("totp_secret"),
    totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
    totpLastStep: integer("totp_last_step"),
    totpRecoveryHashes: text("totp_recovery_hashes").array(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(sql`lower(${t.email})`),
    index("users_account_idx").on(t.accountId),
  ],
);

// Auth.js adapter tables (OAuth links, sessions, magic-link tokens). The token
// columns keep the snake_case keys the adapter expects.
export const authAccounts = pgTable(
  "auth_accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const authSessions = pgTable("auth_sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
  secondFactorAt: timestamp("second_factor_at", { withTimezone: true }),
});

export const authVerificationTokens = pgTable(
  "auth_verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export const themes = pgTable(
  "themes",
  {
    id: id(),
    // null = system theme available to all accounts
    accountId: uuid("account_id").references(() => accounts.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    config: jsonb("config")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: createdAt(),
  },
  (t) => [index("themes_account_idx").on(t.accountId)],
);

export const galleries = pgTable(
  "galleries",
  {
    id: id(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    // short info line shown under the title; null = none
    description: text("description"),
    eventDate: timestamp("event_date", { withTimezone: true, mode: "date" }),
    status: galleryStatus("status").notNull().default("draft"),
    themeId: uuid("theme_id").references(() => themes.id, {
      onDelete: "set null",
    }),
    // full ThemeConfig customised in the design editor; null = theme as is
    themeOverrides: jsonb("theme_overrides").$type<Record<string, unknown>>(),
    coverMediaId: uuid("cover_media_id"),
    passwordHash: text("password_hash"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    expiryReminderSentAt: timestamp("expiry_reminder_sent_at", {
      withTimezone: true,
    }),
    premiereAt: timestamp("premiere_at", { withTimezone: true }),
    downloadPolicy: downloadPolicy("download_policy").notNull().default("web"),
    watermarkId: uuid("watermark_id"),
    // F-SEC-03: web sizes carry the account's logo watermark; originals never do
    watermarkEnabled: boolean("watermark_enabled").notNull().default(false),
    musicTrackId: uuid("music_track_id"),
    faceSearchEnabled: boolean("face_search_enabled").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("galleries_slug_idx").on(t.slug),
    index("galleries_account_idx").on(t.accountId),
  ],
);

// Library folders (D-142); nested via parentId, optional for media.
export const folders = pgTable(
  "folders",
  {
    id: id(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => folders.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("folders_account_idx").on(t.accountId, t.parentId)],
);

export const media = pgTable(
  "media",
  {
    id: id(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    folderId: uuid("folder_id").references(() => folders.id, {
      onDelete: "set null",
    }),
    type: mediaType("type").notNull(),
    originalKey: text("original_key"),
    bunnyVideoId: text("bunny_video_id"),
    variants: jsonb("variants")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    width: integer("width"),
    height: integer("height"),
    durationS: integer("duration_s"),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull().default(0),
    takenAt: timestamp("taken_at", { withTimezone: true }),
    position: integer("position").notNull().default(0),
    revision: integer("revision").notNull().default(1),
    processingStatus: processingStatus("processing_status")
      .notNull()
      .default("pending"),
    createdAt: createdAt(),
  },
  (t) => [index("media_account_idx").on(t.accountId)],
);

// Assigns library media to galleries (D-142): a medium may sit in several
// galleries; storage is still counted once on the medium.
export const galleryMedia = pgTable(
  "gallery_media",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    galleryId: uuid("gallery_id")
      .notNull()
      .references(() => galleries.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.galleryId, t.mediaId] }),
    index("gallery_media_account_idx").on(t.accountId),
    index("gallery_media_order_idx").on(t.galleryId, t.position),
    index("gallery_media_media_idx").on(t.mediaId),
  ],
);

export const zipStatus = pgEnum("zip_status", ["pending", "ready", "failed"]);

// ZIP download of a gallery or set (F-SEC-02), built by the worker and mailed
// as a link. The row id doubles as the unguessable link token.
export const zipExports = pgTable(
  "zip_exports",
  {
    id: id(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    galleryId: uuid("gallery_id")
      .notNull()
      .references(() => galleries.id, { onDelete: "cascade" }),
    size: text("size").notNull().$type<"web" | "original">(),
    email: text("email").notNull(),
    status: zipStatus("status").notNull().default("pending"),
    storageKey: text("storage_key"),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("zip_exports_account_idx").on(t.accountId),
    index("zip_exports_expires_idx").on(t.expiresAt),
  ],
);

export const visitors = pgTable(
  "visitors",
  {
    id: id(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    galleryId: uuid("gallery_id")
      .notNull()
      .references(() => galleries.id, { onDelete: "cascade" }),
    email: text("email"),
    role: visitorRole("role").notNull().default("guest"),
    magicToken: text("magic_token").unique(),
    createdAt: createdAt(),
  },
  (t) => [
    index("visitors_account_idx").on(t.accountId),
    index("visitors_gallery_idx").on(t.galleryId),
  ],
);

export const favoriteLists = pgTable(
  "favorite_lists",
  {
    id: id(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    visitorId: uuid("visitor_id")
      .notNull()
      .references(() => visitors.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("favorite_lists_account_idx").on(t.accountId),
    index("favorite_lists_visitor_idx").on(t.visitorId),
  ],
);

export const favorites = pgTable(
  "favorites",
  {
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    listId: uuid("list_id")
      .notNull()
      .references(() => favoriteLists.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.listId, t.mediaId] }),
    index("favorites_account_idx").on(t.accountId),
  ],
);

export const events = pgTable(
  "events",
  {
    id: id(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    galleryId: uuid("gallery_id")
      .notNull()
      .references(() => galleries.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id").references(() => media.id, {
      onDelete: "set null",
    }),
    visitorId: uuid("visitor_id").references(() => visitors.id, {
      onDelete: "set null",
    }),
    type: eventType("type").notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("events_account_idx").on(t.accountId),
    index("events_gallery_ts_idx").on(t.galleryId, t.ts),
  ],
);

export const deliveryMails = pgTable(
  "delivery_mails",
  {
    id: id(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    galleryId: uuid("gallery_id")
      .notNull()
      .references(() => galleries.id, { onDelete: "cascade" }),
    recipient: text("recipient").notNull(),
    subject: text("subject").notNull(),
    status: text("status", { enum: ["sent", "failed"] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("delivery_mails_account_idx").on(t.accountId),
    index("delivery_mails_gallery_idx").on(t.galleryId, t.createdAt),
  ],
);
