// db.ts
import { Post, PostContent } from "@/db/schema";
import { Dexie, type EntityTable } from "dexie";

interface Todo {
  id: string; // ULID generated on client
  title: string;
  completed?: boolean;
  createdAt: Date;
}

const db = new Dexie("offline-first") as Dexie & {
  todos: EntityTable<Todo, "id">;
  posts: EntityTable<Post, "id">;
  postContents: EntityTable<PostContent, "id">;
};

// Schema declaration with string IDs (ULID)
db.version(1).stores({
  todos: "id, title, createdAt",
  posts: "id, title, createdAt",
  postContents: "id, postId, content, createdAt",
});

// Version 2: Add completed field to todos
db.version(2)
  .stores({
    todos: "id, title, completed, createdAt",
    posts: "id, title, createdAt",
    postContents: "id, postId, content, createdAt",
  })
  .upgrade((tx) => {
    // Set default completed = false for existing todos
    return tx
      .table("todos")
      .toCollection()
      .modify((todo) => {
        if (todo.completed === undefined) {
          todo.completed = false;
        }
      });
  });

export { db as dexieDb };
export type { Todo };
