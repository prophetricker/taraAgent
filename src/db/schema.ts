import {
  customType,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid
} from "drizzle-orm/pg-core";

const vector1536 = customType<{
  data: number[] | null;
  driverData: string | null;
}>({
  dataType() {
    return "vector(1536)";
  }
});

export const inspirationNodes = pgTable("inspiration_nodes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  parentId: uuid("parent_id"),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  vector: vector1536("vector"),
  positionX: integer("position_x").notNull().default(0),
  positionY: integer("position_y").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const conversations = pgTable("conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  nodeId: uuid("node_id").notNull(),
  title: text("title").notNull().default("未命名对话"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  conversationId: uuid("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const dandelionFragments = pgTable("dandelion_fragments", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  nodeId: uuid("node_id"),
  conversationId: uuid("conversation_id"),
  content: text("content").notNull(),
  originalContext: text("original_context").notNull(),
  sentimentVibe: text("sentiment_vibe"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});
