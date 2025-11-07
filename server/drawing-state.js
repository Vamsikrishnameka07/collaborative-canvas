// This module is intentionally light: state logic lives in rooms.js
// Keep here for future persistence (e.g., saving/loading operations to DB).
export function serializeOperations(ops) {
return JSON.stringify(ops);
}


export function deserializeOperations(json) {
try { return JSON.parse(json) || []; } catch { return []; }
}