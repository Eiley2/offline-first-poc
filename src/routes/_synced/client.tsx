import { getPostsFromClient } from "@/db/query";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_synced/client")({
  component: RouteComponent,
  loader: () => getPostsFromClient(),
});

function RouteComponent() {
  const posts = Route.useLoaderData();
  return (
    <div>
      <Link to="/server">Go to Server</Link>
      {posts.map((post) => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  );
}
