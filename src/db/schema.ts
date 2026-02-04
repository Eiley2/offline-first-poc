import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const todos = sqliteTable("todos", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

export type Todo = typeof todos.$inferSelect;

export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

export type Post = typeof posts.$inferSelect;

export const postContents = sqliteTable("post_contents", {
  id: text("id").primaryKey(),
  postId: text("postId").references(() => posts.id),
  content: text("content").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).$defaultFn(
    () => new Date()
  ),
});

export type PostContent = typeof postContents.$inferSelect;
