import { reactive } from "vue";

// Module-level toast store: call toast({...}) from anywhere, render with <Toaster />.
export const toasts = reactive([]);
let nextId = 0;

export function toast({ title, description = null, accent = null, duration = 4000 }) {
  const id = ++nextId;
  toasts.push({ id, title, description, accent });
  setTimeout(() => {
    const i = toasts.findIndex((t) => t.id === id);
    if (i !== -1) toasts.splice(i, 1);
  }, duration);
}
