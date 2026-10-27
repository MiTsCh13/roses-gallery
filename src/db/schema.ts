// Drizzle schema (M1). Every tenant-owned table carries an `account_id` column,
// directly or via its parent (see docs/SPEC.md → Datenmodell).
import { sql } from "drizzle-orm";
import {
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
  "archived",
]);
export const downloadPolicy = pgEnum("download_policy", [
  "none",
  "web",
  "original",
]);
export const setType = pgEnum("set_type", ["photo", "video"]);
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
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(sql`lower(${t.email})`),
    index("users_account_idx").on(t.accountId),
  ],
);

// Auth.js adapter tables (OAuth links, sessions, magic-link tokens).
export const authAccounts = pgTable(
  "auth_accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    expiresAt: integer("expires_at"),
    tokenType: text("token_type"),
    scope: text("scope"),
    idToken: text("id_token"),
    sessionState: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const authSessions = pgTable("auth_sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
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
    eventDate: timestamp("event_date", { withTimezone: true, mode: "date" }),
    status: galleryStatus("status").notNull().default("draft"),
    themeId: uuid("theme_id").references(() => themes.id, {
      onDelete: "set null",
    }),
    coverMediaId: uuid("cover_media_id"),
    passwordHash: text("password_hash"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    premiereAt: timestamp("premiere_at", { withTimezone: true }),
    downloadPolicy: downloadPolicy("download_policy").notNull().default("web"),
    watermarkId: uuid("watermark_id"),
    musicTrackId: uuid("music_track_id"),
    faceSearchEnabled: boolean("face_search_enabled").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("galleries_account_slug_idx").on(t.accountId, t.slug),
    index("galleries_account_idx").on(t.accountId),
  ],
);

export const sets = pgTable(
  "sets",
  {
    id: id(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    galleryId: uuid("gallery_id")
      .notNull()
      .references(() => galleries.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    type: setType("type").notNull().default("photo"),
    position: integer("position").notNull().default(0),
    downloadPolicy: downloadPolicy("download_policy"),
    createdAt: createdAt(),
  },
  (t) => [
    index("sets_account_idx").on(t.accountId),
    index("sets_gallery_idx").on(t.galleryId, t.position),
  ],
);

export const media = pgTable(
  "media",
  {
    id: id(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    setId: uuid("set_id")
      .notNull()
      .references(() => sets.id, { onDelete: "cascade" }),
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
  (t) => [
    index("media_account_idx").on(t.accountId),
    index("media_set_idx").on(t.setId, t.position),
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
