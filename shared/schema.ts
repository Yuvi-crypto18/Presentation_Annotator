import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Presentations table
export const presentations = pgTable("presentations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  submitted: boolean("submitted").default(false),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Slides table
export const slides = pgTable("slides", {
  id: serial("id").primaryKey(),
  presentation_id: text("presentation_id").references(() => presentations.id).notNull(),
  slide_id: text("slide_id").notNull().unique(),
  slide_number: integer("slide_number").notNull(),
  image: text("image").notNull(), // Base64 encoded image
});

// Slide annotations table
export const slideAnnotations = pgTable("slide_annotations", {
  id: serial("id").primaryKey(),
  presentation_id: text("presentation_id").references(() => presentations.id).notNull(),
  slide_id: text("slide_id").references(() => slides.slide_id).notNull(),
  tags: text("tags").notNull(), // JSON string of key-value pairs
});

// Define relations
export const presentationsRelations = relations(presentations, ({ many }) => ({
  slides: many(slides),
  annotations: many(slideAnnotations),
}));

export const slidesRelations = relations(slides, ({ one, many }) => ({
  presentation: one(presentations, {
    fields: [slides.presentation_id],
    references: [presentations.id],
  }),
  annotations: many(slideAnnotations),
}));

export const slideAnnotationsRelations = relations(slideAnnotations, ({ one }) => ({
  presentation: one(presentations, {
    fields: [slideAnnotations.presentation_id],
    references: [presentations.id],
  }),
  slide: one(slides, {
    fields: [slideAnnotations.slide_id],
    references: [slides.slide_id],
  }),
}));

// Define schemas for validation
export const presentationInsertSchema = createInsertSchema(presentations, {
  name: (schema) => schema.min(1, "Presentation name is required"),
});

export const slideInsertSchema = createInsertSchema(slides, {
  slide_number: (schema) => schema.min(1, "Slide number must be at least 1"),
});

export const slideAnnotationInsertSchema = createInsertSchema(slideAnnotations, {
  tags: (schema) => schema.min(1, "At least one tag is required"),
});

// Users table (required by template)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
