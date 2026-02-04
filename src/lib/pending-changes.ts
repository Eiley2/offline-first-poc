// Track local pending changes (changes made while offline or not yet synced)
// Persisted in localStorage to survive page reloads and HMR

const STORAGE_KEY = "offline-first:pending-changes";

// Load from localStorage on init
function loadPendingChanges(): Map<
  string,
  { completed: boolean; timestamp: number }
> {
  if (typeof window === "undefined") {
    return new Map();
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return new Map(Object.entries(parsed));
    }
  } catch (error) {
    console.error("Failed to load pending changes:", error);
  }

  return new Map();
}

// Save to localStorage
function savePendingChanges(
  changes: Map<string, { completed: boolean; timestamp: number }>
) {
  if (typeof window === "undefined") return;

  try {
    const obj = Object.fromEntries(changes);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (error) {
    console.error("Failed to save pending changes:", error);
  }
}

// Create a proxy to auto-save on changes
export const pendingChanges = new Proxy(loadPendingChanges(), {
  get(target, prop) {
    const value = Reflect.get(target, prop);
    // Wrap methods that modify the Map
    if (typeof value === "function") {
      return function (...args: any[]) {
        const result = value.apply(target, args);
        // Save after modification
        if (["set", "delete", "clear"].includes(prop as string)) {
          savePendingChanges(target);
        }
        return result;
      };
    }
    return value;
  },
});
