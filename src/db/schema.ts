import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const todos = pgTable("todos", {
  id: uuid().primaryKey().defaultRandom(),
  title: text().notNull(),
  createdAt: timestamp().defaultNow(),
});

export const posts = pgTable("posts", {
  id: uuid().primaryKey().defaultRandom(),
  title: text().notNull(),
  createdAt: timestamp().defaultNow(),
});

export type Post = typeof posts.$inferSelect;

export const postContents = pgTable("post_contents", {
  id: uuid().primaryKey().defaultRandom(),
  postId: uuid().references(() => posts.id),
  content: text().notNull(),
  createdAt: timestamp().defaultNow(),
});

export type PostContent = typeof postContents.$inferSelect;
