import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

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
