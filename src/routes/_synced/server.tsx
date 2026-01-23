import { getPostsFromServer, insertPostToServer } from "@/db/query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { dexieDb } from "@/lib/dexie";

export const Route = createFileRoute("/_synced/server")({
  component: RouteComponent,
  loader: () => getPostsFromServer(),
  ssr: "data-only"
});

// Client function to add post (to dexieDb and server if online)
export const addPost = async (title: string) => {
  const createdAt = new Date();

  // Always save to dexieDb (local storage)
  const postId = await dexieDb.posts.add({
    title,
    createdAt
  });

  // If online, also save to server
  const isOnline = navigator.onLine;
  if (isOnline) {
    try {
      await insertPostToServer({
        data: {
          title,
          createdAt: createdAt.toISOString(),
        },
      });
    } catch (error) {
      console.error("Failed to sync post to server:", error);
    }
  }

  return postId;
};

function RouteComponent() {
  const posts = Route.useLoaderData();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const title = formData.get("title") as string;
    if (title) {
      await addPost(title);
      router.invalidate();
      (e.target as HTMLFormElement).reset();
    }
  };

  return (
    <div className="p-4">
      <div className="mb-4">
        <Link to="/client" className="text-blue-500 hover:underline">Go to Client</Link>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2">Add Post (Server + DexieDB)</h2>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            name="title"
            placeholder="Add post to server..."
            className="border p-2 flex-1"
            required
          />
          <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
            Add to Server
          </button>
        </form>
        <p className="text-sm text-gray-600 mt-1">
          Posts are saved to DexieDB immediately. If online, also saved to server.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Posts from Server: {posts.length}</h3>
        {posts.length === 0 ? (
          <p className="text-gray-500">No posts yet. Add one above!</p>
        ) : (
          <div className="space-y-2">
            {posts.map((post) => (
              <div key={post.id} className="border p-3 rounded">
                <div className="font-medium">{post.title}</div>
                <div className="text-sm text-gray-500">
                  {post.createdAt?.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
