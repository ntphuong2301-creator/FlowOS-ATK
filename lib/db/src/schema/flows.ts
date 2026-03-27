import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const flowsTable = pgTable("flows", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  projectId: text("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  ownerId: text("owner_id").notNull().references(() => usersTable.id),
  nodes: text("nodes").notNull().default("[]"),
  edges: text("edges").notNull().default("[]"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertFlowSchema = createInsertSchema(flowsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertFlow = z.infer<typeof insertFlowSchema>;
export type Flow = typeof flowsTable.$inferSelect;
