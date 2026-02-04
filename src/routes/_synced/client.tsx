import { getPostsFromClient, insertPostToServer } from "@/db/query";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { dexieDb } from "@/lib/dexie";
import { ulid } from "ulid";

export const Route = createFileRoute("/_synced/client")({
  component: RouteComponent,
  loader: () => getPostsFromClient(),
  ssr: false,
});

export const addPost = async (title: string) => {
  const createdAt = new Date();
  const id = ulid();

  // Always save to dexieDb (local storage)
  await dexieDb.posts.add({
    id,
    title,
    createdAt,
  });

  // If online, also save to server
  const isOnline = navigator.onLine;
  if (isOnline) {
    try {
      await insertPostToServer({
        data: {
          id,
          title,
          createdAt: createdAt.toISOString(),
        },
      });
    } catch (error) {
      console.error("Failed to sync post to server:", error);
    }
  }

  return id;
};

function RouteComponent() {
  const posts = Route.useLoaderData();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const title = formData.get("title") as string;
    await addPost(title);
    router.invalidate();
  };

  return (
    <div className="p-4">
      <div className="mb-4">
        <Link to="/server" className="text-blue-500 hover:underline">
          Go to Server
        </Link>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold mb-2">
          Add Post (Client Only - DexieDB)
        </h2>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            name="title"
            placeholder="Add post from client..."
            className="border p-2 flex-1"
            required
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Add to Client
          </button>
        </form>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">
          Posts from Client (DexieDB): {posts.length}
        </h3>
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
