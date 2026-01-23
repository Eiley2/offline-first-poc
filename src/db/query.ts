import {
  createClientOnlyFn,
  createIsomorphicFn,
  createMiddleware,
  createServerFn,
} from "@tanstack/react-start";
import { db } from ".";
import { dexieDb } from "@/lib/dexie";
import { posts, todos } from "./schema";

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
    const todo = await dexieDb.todos.add({ title, createdAt: new Date() });
    return todo;
  })
  .server(async (title: string) => {
    return db.insert(todos).values({ title, createdAt: new Date() });
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

// Insert todo to server
// Note: createdAt is sent as ISO string because Date objects can't be serialized
export const insertTodoToServer = createServerFn({
  method: "POST",
})
  .inputValidator((data: { title: string; createdAt: string }) => data)
  .handler(async ({ data }) => {
    await db.insert(todos).values({
      title: data.title,
      createdAt: new Date(data.createdAt),
    });
    return { success: true };
  });

// Sync function: when going from offline to online
// Syncs all todos from client that don't exist on server (oldest to newest)
export const syncOnReconnect = createClientOnlyFn(async () => {
  const clientTodos = await dexieDb.todos.toArray();
  const serverTodos = await getTodosFromServer();

  // If no client todos, nothing to sync
  if (clientTodos.length === 0) {
    return { synced: false, reason: "no_client_todos", count: 0 };
  }

  // Find todos that exist on client but not on server
  // Compare by title and createdAt timestamp
  const todosToSync = clientTodos.filter((clientTodo) => {
    return !serverTodos.some(
      (serverTodo) =>
        serverTodo.title === clientTodo.title &&
        serverTodo.createdAt?.getTime() === clientTodo.createdAt.getTime()
    );
  });

  if (todosToSync.length === 0) {
    return { synced: false, reason: "already_in_sync", count: 0 };
  }

  // Sort from oldest to newest
  const sortedTodos = todosToSync.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  // Insert each todo to server (oldest first)
  for (const todo of sortedTodos) {
    await insertTodoToServer({
      data: {
        title: todo.title,
        createdAt: todo.createdAt.toISOString(),
      },
    });
  }

  return { synced: true, count: sortedTodos.length, todos: sortedTodos };
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

// Insert post to server
export const insertPostToServer = createServerFn({
  method: "POST",
})
  .inputValidator((data: { title: string; createdAt: string }) => data)
  .handler(async ({ data }) => {
    await db.insert(posts).values({
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
        serverPost.createdAt?.getTime() === clientPost.createdAt.getTime()
    );
  });

  if (postsToSync.length === 0) {
    return { synced: false, reason: "already_in_sync", count: 0 };
  }

  // Sort from oldest to newest
  const sortedPosts = postsToSync.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  // Insert each post to server (oldest first)
  for (const post of sortedPosts) {
    await insertPostToServer({
      data: {
        title: post.title,
        createdAt: post.createdAt.toISOString(),
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
