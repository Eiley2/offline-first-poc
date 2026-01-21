// db.ts
import { Post, PostContent } from "@/db/schema";
import { Dexie, type EntityTable } from "dexie";

interface Todo {
  id: number;
  title: string;
  createdAt: Date;
}

const db = new Dexie("offline-first") as Dexie & {
  todos: EntityTable<Todo, "id">;
  posts: EntityTable<Post, "id">;
  postContents: EntityTable<PostContent, "id">;
};

// Schema declaration:
db.version(1).stores({
  todos: "++id, title, createdAt", // primary key "id" (for the runtime!)
  posts: "++id, title, createdAt",
  postContents: "++id, postId, content, createdAt",
});

export { db as dexieDb };
