import { getTodos, syncTodosWithServerPriority } from "@/db/query";
import { dexieDb } from "@/lib/dexie";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/local")({
  component: RouteComponent,
  loader: () => getTodos(),
});

export function RouteComponent() {
  const todos = Route.useLoaderData();
  const [isOffline, setIsOffline] = useState(false);
  const wasOffline = useRef(false);
  const router = useRouter();

  // Set initial offline state on client
  useEffect(() => {
    const offline = !navigator.onLine;
    setIsOffline(offline);
    wasOffline.current = offline;
  }, []);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOffline(false);

      // If we were offline and now we're online, sync
      if (wasOffline.current) {
        console.log("Reconnected! Syncing...");
        const result = await syncTodosWithServerPriority();
        console.log("Sync result:", result);

        if (result.synced) {
          router.invalidate();
        }
      }
      wasOffline.current = false;
    };

    const handleOffline = () => {
      setIsOffline(true);
      wasOffline.current = true;
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [router]);
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const title = formData.get("title") as string;
    const { ulid } = await import("ulid");
    await dexieDb.todos.add({
      id: ulid(),
      title,
      completed: false,
      createdAt: new Date(),
    });
    router.invalidate();
  };
  return (
    <>
      <Link to="/server">Go to Test2</Link>
      {todos.map((todo) => (
        <div key={todo.id}>
          <p>{todo.title}</p>
          <p>{todo.createdAt?.toISOString()}</p>
        </div>
      ))}
      <form onSubmit={handleSubmit}>
        <input type="text" name="title" />
        <button type="submit">Add</button>
      </form>

      {isOffline ? <p>Offline</p> : <p>Online</p>}
    </>
  );
}
