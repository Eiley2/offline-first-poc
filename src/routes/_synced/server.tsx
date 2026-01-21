import { db } from "@/db";
import { getPostsFromServer } from "@/db/query";
import { posts } from "@/db/schema";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_synced/server")({
  component: RouteComponent,
  loader: () => getPostsFromServer(),
});

export const addPostToServer = createServerFn({
  method: "POST",
})
  .inputValidator((data: { title: string }) => data)
  .handler(async ({ data }) => {
    const post = await db
      .insert(posts)
      .values({ title: data.title })
      .returning();
    return post;
  });

function RouteComponent() {
  const posts = Route.useLoaderData();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const title = formData.get("title") as string;
    await addPostToServer({ data: { title } });
    router.invalidate();
  };
  return (
    <div>
      <Link to="/client">Go to Client</Link>
      <form onSubmit={handleSubmit}>
        <input type="text" name="title" />
        <button type="submit">Add</button>
      </form>
      {posts.map((post) => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
}
