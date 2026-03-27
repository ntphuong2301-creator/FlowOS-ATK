import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const messageRoleEnum = pgEnum("message_role", ["user", "assistant"]);

export const aiMessagesTable = pgTable("ai_messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  role: messageRoleEnum("role").notNull(),
  context: text("context"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAiMessageSchema = createInsertSchema(aiMessagesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAiMessage = z.infer<typeof insertAiMessageSchema>;
export type AiMessage = typeof aiMessagesTable.$inferSelect;
