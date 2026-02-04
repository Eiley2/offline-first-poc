import { useEffect, useRef } from "react";
import { getLastChangeTimestamp } from "@/db/query";

interface UseTodoPollingOptions {
  onTodoChange: () => void;
  enabled?: boolean;
  interval?: number; // Polling interval in milliseconds
}

export function useTodoPolling({
  onTodoChange,
  enabled = true,
  interval = 5000, // Default: check every 5 seconds
}: UseTodoPollingOptions) {
  const lastKnownTimestampRef = useRef<number>(Date.now());
  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const checkForChanges = async () => {
      try {
        const result = await getLastChangeTimestamp();

        if (result.timestamp > lastKnownTimestampRef.current) {
          console.log(
            `[Polling] Change detected! Last: ${new Date(lastKnownTimestampRef.current).toISOString()}, New: ${new Date(result.timestamp).toISOString()}`
          );
          lastKnownTimestampRef.current = result.timestamp;
          onTodoChange();
        }
      } catch (error) {
        console.error("[Polling] Failed to check for changes:", error);
      }
    };

    console.log(`[Polling] Starting with ${interval}ms interval`);

    // Check immediately on mount
    checkForChanges();

    // Then check periodically
    intervalRef.current = setInterval(checkForChanges, interval);

    // Cleanup on unmount
    return () => {
      console.log("[Polling] Stopping");
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, interval, onTodoChange]);

  return {
    stop: () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    },
  };
}
