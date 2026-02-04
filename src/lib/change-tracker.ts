// Track when the last change occurred
let lastChangeTimestamp = Date.now();

export function notifyTodoChange() {
  lastChangeTimestamp = Date.now();
  console.log(
    "[ChangeTracker] Todo change recorded at",
    new Date(lastChangeTimestamp).toISOString()
  );
}

export function getLastChangeTimestamp(): number {
  return lastChangeTimestamp;
}
