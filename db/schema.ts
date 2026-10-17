import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().unique(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull(),
});

export const records = sqliteTable("records", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  kind: text("kind").notNull(),
  data: text("data", { mode: "json" }).notNull(),
  updatedAt: text("updated_at").notNull(),
  revision: integer("revision").notNull().default(1),
  lastEvent: text("last_event").notNull().default(""),
});

export const processedEvents = sqliteTable(
  "processed_events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("workspace_event_unique").on(table.workspaceId, table.id),
  ],
);

export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull(),
    subjectId: text("subject_id"),
    createdAt: text("created_at").notNull(),
    revokedAt: text("revoked_at"),
  },
  (t) => [
    uniqueIndex("membership_user_workspace").on(t.workspaceId, t.userId),
    uniqueIndex("active_subject_membership")
      .on(t.workspaceId, t.role, t.subjectId)
      .where(sql`${t.revokedAt} IS NULL`),
  ],
);

export const invitations = sqliteTable("invitations", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  tokenHash: text("token_hash").notNull().unique(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  subjectId: text("subject_id"),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  claimedBy: text("claimed_by"),
  revokedAt: text("revoked_at"),
});

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  actorId: text("actor_id").notNull(),
  action: text("action").notNull(),
  entityId: text("entity_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const serviceCounters = sqliteTable("service_counters", {
  id: text("id").primaryKey(),
  count: integer("count").notNull().default(0),
  expiresAt: integer("expires_at").notNull(),
});

export const mentorSessions = sqliteTable("mentor_sessions", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  studentId: text("student_id").notNull(),
  mentorId: text("mentor_id").notNull(),
  startsAt: text("starts_at").notNull(),
  minutes: integer("minutes").notNull(),
  status: text("status").notNull(),
  goal: text("goal").notNull(),
  createdAt: text("created_at").notNull(),
});

export const sessionMessages = sqliteTable("session_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => mentorSessions.id),
  senderId: text("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  text: text("text").notNull(),
  createdAt: text("created_at").notNull(),
});

export const submissions = sqliteTable(
  "submissions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    studentId: text("student_id").notNull(),
    opportunityId: text("opportunity_id").notNull(),
    partnerId: text("partner_id").notNull(),
    status: text("status").notNull(),
    snapshot: text("snapshot", { mode: "json" }).notNull(),
    response: text("response").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    uniqueIndex("one_submission_per_opportunity").on(
      t.workspaceId,
      t.studentId,
      t.opportunityId,
    ),
  ],
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    userId: text("user_id").notNull(),
    productId: text("product_id").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("INR"),
    status: text("status").notNull(),
    providerId: text("provider_id").unique(),
    checkoutUrl: text("checkout_url"),
    expiresAt: integer("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("one_pending_checkout")
      .on(t.workspaceId, t.userId, t.productId)
      .where(sql`${t.status} IN ('created','creating')`),
  ],
);

export const entitlements = sqliteTable("entitlements", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  userId: text("user_id").notNull(),
  productId: text("product_id").notNull(),
  paymentId: text("payment_id")
    .notNull()
    .references(() => payments.id),
  expiresAt: integer("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
});
