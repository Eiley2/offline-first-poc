import {
  createClientOnlyFn,
  createIsomorphicFn,
  createMiddleware,
  createServerFn,
} from "@tanstack/react-start";
import { db } from ".";
import { dexieDb } from "@/lib/dexie";
import { posts, todos } from "./schema";
import { ulid } from "ulid";
import { eq } from "drizzle-orm";
import { broadcastTodoChange } from "@/lib/sse-broadcast";

export const getTodosFromServer = createServerFn({
  method: "GET",
}).handler(async () => {
  return await db.query.todos.findMany();
});

export const getTodosFromClient = createClientOnlyFn(() => {
  return dexieDb.todos.toArray();
});

export const getTodos = createIsomorphicFn()
  .client(getTodosFromClient)
  .server(getTodosFromServer);

export const addTodo = createIsomorphicFn()
  .client(async (title: string) => {
    const id = ulid();
    await dexieDb.todos.add({
      id,
      title,
      completed: false,
      createdAt: new Date(),
    });
    return id;
  })
  .server(async (title: string) => {
    const id = ulid();
    await db.insert(todos).values({
      id,
      title,
      completed: false,
      createdAt: new Date(),
    });
    return id;
  });

export const getLatestTodo = createMiddleware({
  type: "function",
}).client(async ({ next }) => {
  const todos = await dexieDb.todos.toArray();

  const latestTodo = todos.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  )[0];

  console.log("latestTodo", latestTodo);

  return next({
    sendContext: {
      latestTodo,
    },
  });
});

// Get latest todo from server
export const getLatestTodoFromServer = createServerFn({
  method: "GET",
}).handler(async () => {
  const allTodos = await db.query.todos.findMany();
  if (allTodos.length === 0) return null;

  return allTodos.sort(
    (a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
  )[0];
});

// Get latest todo from client
export const getLatestTodoFromClient = createClientOnlyFn(async () => {
  const allTodos = await dexieDb.todos.toArray();
  if (allTodos.length === 0) return null;

  return allTodos.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  )[0];
});

// Insert todo to server with ULID
export const insertTodoToServer = createServerFn({
  method: "POST",
})
  .inputValidator(
    (data: {
      id: string;
      title: string;
      completed: boolean;
      createdAt: string;
    }) => data
  )
  .handler(async ({ data }) => {
    await db.insert(todos).values({
      id: data.id,
      title: data.title,
      completed: data.completed,
      createdAt: new Date(data.createdAt),
    });

    // Notify SSE clients about the new todo
    broadcastTodoChange({
      type: "created",
      todoId: data.id,
      data: {
        id: data.id,
        title: data.title,
        completed: data.completed,
      },
      timestamp: Date.now(),
    });

    return { success: true };
  });

// Update todo completed status on server
export const updateTodoCompletedOnServer = createServerFn({
  method: "POST",
})
  .inputValidator((data: { id: string; completed: boolean }) => data)
  .handler(async ({ data }) => {
    await db
      .update(todos)
      .set({ completed: data.completed })
      .where(eq(todos.id, data.id));

    // Notify SSE clients about the update
    broadcastTodoChange({
      type: "updated",
      todoId: data.id,
      data: {
        id: data.id,
        completed: data.completed,
      },
      timestamp: Date.now(),
    });

    return { success: true };
  });

// Delete todo from server
export const deleteTodoFromServer = createServerFn({
  method: "POST",
})
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await db.delete(todos).where(eq(todos.id, data.id));

    // Notify SSE clients about the deletion
    broadcastTodoChange({
      type: "deleted",
      todoId: data.id,
      timestamp: Date.now(),
    });

    return { success: true };
  });

// Delete todo (client-side with server sync)
export const deleteTodo = createClientOnlyFn(async (id: string) => {
  console.log(`[deleteTodo] Deleting ${id}`);

  // Always delete from Dexie first (works offline)
  await dexieDb.todos.delete(id);
  console.log(`[deleteTodo] ✅ Local delete successful`);

  // Try to delete on server (will fail silently if offline)
  try {
    await deleteTodoFromServer({ data: { id } });
    console.log(`[deleteTodo] ✅ Server delete successful`);
  } catch (error) {
    console.log(`[deleteTodo] ⚠️ Server delete failed (offline?):`, error);
    // TODO: Track pending deletes for sync later
  }
});

// Update todo completed status (client-side)
export const updateTodoCompleted = createClientOnlyFn(
  async (id: string, completed: boolean) => {
    console.log(`[updateTodoCompleted] Updating ${id} to ${completed}`);

    // Always update in Dexie first (works offline)
    await dexieDb.todos.update(id, { completed });
    console.log(`[updateTodoCompleted] ✅ Local update successful`);

    // Try to update on server (will fail silently if offline)
    try {
      await updateTodoCompletedOnServer({ data: { id, completed } });
      console.log(`[updateTodoCompleted] ✅ Server update successful`);
    } catch (error) {
      console.log(
        `[updateTodoCompleted] ⚠️ Server update failed (offline?):`,
        error
      );
      // This is OK - the pending change will be synced later
    }
  }
);

// Sync function with LOCAL-FIRST strategy for approvals
// When reconnecting: local approvals are pushed to server (LOCAL WINS)
export const syncTodosWithServerPriority = createClientOnlyFn(async () => {
  const clientTodos = await dexieDb.todos.toArray();
  const serverTodos = await getTodosFromServer();

  let syncedCount = 0;

  // Step 1: Sync new todos from client to server (todos that don't exist on server)
  const newClientTodos = clientTodos.filter(
    (clientTodo) =>
      !serverTodos.some((serverTodo) => serverTodo.id === clientTodo.id)
  );

  for (const todo of newClientTodos) {
    try {
      await insertTodoToServer({
        data: {
          id: todo.id,
          title: todo.title,
          completed: todo.completed ?? false,
          createdAt: todo.createdAt.toISOString(),
        },
      });
      syncedCount++;
    } catch (error) {
      console.error("Failed to sync todo to server:", error);
    }
  }

  // Step 2: Sync todos from server to client
  // For todos that only exist on server: add to client
  const newServerTodos = serverTodos.filter(
    (serverTodo) =>
      !clientTodos.some((clientTodo) => clientTodo.id === serverTodo.id)
  );

  // Add new server todos to client
  for (const todo of newServerTodos) {
    try {
      await dexieDb.todos.add({
        id: todo.id,
        title: todo.title,
        completed: todo.completed ?? false,
        createdAt: todo.createdAt ?? new Date(),
      });
      syncedCount++;
    } catch (error) {
      console.error("Failed to add server todo to client:", error);
    }
  }

  // Step 3: For existing todos, push LOCAL changes to SERVER (LOCAL WINS)
  const existingTodos = serverTodos.filter((serverTodo) =>
    clientTodos.some((clientTodo) => clientTodo.id === serverTodo.id)
  );

  for (const serverTodo of existingTodos) {
    const clientTodo = clientTodos.find((ct) => ct.id === serverTodo.id);
    if (clientTodo && clientTodo.completed !== serverTodo.completed) {
      // LOCAL WINS: Push local approval state to server
      try {
        await updateTodoCompletedOnServer({
          data: {
            id: clientTodo.id,
            completed: clientTodo.completed ?? false,
          },
        });
        syncedCount++;
      } catch (error) {
        console.error("Failed to sync local approval to server:", error);
      }
    }
  }

  return {
    synced: syncedCount > 0,
    count: syncedCount,
    newFromClient: newClientTodos.length,
    newFromServer: newServerTodos.length,
  };
});

export const getPostsFromServer = createServerFn({
  method: "GET",
}).handler(async () => {
  return await db.query.posts.findMany();
});

export const getPostsFromClient = createClientOnlyFn(async () => {
  const isOffline = !navigator.onLine;
  if (isOffline) {
    return dexieDb.posts.toArray();
  }

  return await getPostsFromServer();
});

export const getPosts = createIsomorphicFn()
  .client(getPostsFromClient)
  .server(getPostsFromServer);

export const getPostContentsFromServer = createServerFn({
  method: "GET",
}).handler(async () => {
  return await db.query.postContents.findMany();
});

export const getPostContentsFromClient = createClientOnlyFn(async () => {
  const isOffline = !navigator.onLine;
  if (isOffline) {
    return dexieDb.postContents.toArray();
  }

  return await getPostContentsFromServer();
});

export const getPostContents = createIsomorphicFn()
  .client(getPostContentsFromClient)
  .server(getPostContentsFromServer);

// Insert post to server with ULID
export const insertPostToServer = createServerFn({
  method: "POST",
})
  .inputValidator(
    (data: { id: string; title: string; createdAt: string }) => data
  )
  .handler(async ({ data }) => {
    await db.insert(posts).values({
      id: data.id,
      title: data.title,
      createdAt: new Date(data.createdAt),
    });
    return { success: true };
  });

// Sync posts from client to server (client → server)
export const syncPostsToServer = createClientOnlyFn(async () => {
  const clientPosts = await dexieDb.posts.toArray();
  const serverPosts = await getPostsFromServer();

  // If no client posts, nothing to sync
  if (clientPosts.length === 0) {
    return { synced: false, reason: "no_client_posts", count: 0 };
  }

  // Find posts that exist on client but not on server
  const postsToSync = clientPosts.filter((clientPost) => {
    return !serverPosts.some(
      (serverPost) =>
        serverPost.title === clientPost.title &&
        serverPost.createdAt?.getTime() ===
          (clientPost.createdAt ?? new Date()).getTime()
    );
  });

  if (postsToSync.length === 0) {
    return { synced: false, reason: "already_in_sync", count: 0 };
  }

  // Sort from oldest to newest
  const sortedPosts = postsToSync.sort(
    (a, b) =>
      (a.createdAt ?? new Date()).getTime() -
      (b.createdAt ?? new Date()).getTime()
  );

  // Insert each post to server (oldest first)
  for (const post of sortedPosts) {
    await insertPostToServer({
      data: {
        id: post.id,
        title: post.title,
        createdAt: (post.createdAt ?? new Date()).toISOString(),
      },
    });
  }

  return { synced: true, count: sortedPosts.length, posts: sortedPosts };
});

// Sync posts from server to client (server → client)
export const syncOnConnect = createClientOnlyFn(async () => {
  const clientPosts = await dexieDb.posts.toArray();
  const serverPosts = await getPostsFromServer();

  if (serverPosts.length === 0) {
    console.log("no server posts");
    return { synced: false, reason: "no_server_posts", count: 0 };
  }

  // Find posts that exist on server but not on client (server → client sync)
  const postsToSync = serverPosts.filter((serverPost) => {
    return !clientPosts.some((clientPost) => clientPost.id === serverPost.id);
  });

  if (postsToSync.length === 0) {
    console.log("already in sync");
    return { synced: false, reason: "already_in_sync", count: 0 };
  }

  const serverPostContents = await getPostContentsFromServer();
  const clientPostContents = await dexieDb.postContents.toArray();

  // Find post contents that exist on server but not on client
  const postContentsToSync = serverPostContents.filter((serverPostContent) => {
    return !clientPostContents.some(
      (clientPostContent) => clientPostContent.id === serverPostContent.id
    );
  });

  // Add server posts to client (Dexie)
  for (const post of postsToSync) {
    await dexieDb.posts.add({
      id: post.id,
      title: post.title,
      createdAt: post.createdAt,
    });

    const postContent = postContentsToSync.find(
      (postContent) => postContent.postId === post.id
    );
    if (postContent) {
      await dexieDb.postContents.add({
        id: postContent.id,
        postId: postContent.postId,
        content: postContent.content,
        createdAt: postContent.createdAt,
      });
    }
  }

  return {
    synced: true,
    count: postsToSync.length + postContentsToSync.length,
    posts: postsToSync,
    postContents: postContentsToSync,
  };
});
