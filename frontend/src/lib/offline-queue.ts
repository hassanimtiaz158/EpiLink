import type { FormInputRequest } from "./api/types";
import { inputService } from "./api/services";

const KEY = "epilink:offline-reports";

export interface QueuedReport {
  id: string;
<<<<<<< HEAD
  payload: FormInputRequest;
=======
  payload: any;
>>>>>>> 67e0f965c0d324d8b9d3c8e6af0746f272eb1adc
  queuedAt: string;
}

function read(): QueuedReport[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as QueuedReport[];
  } catch {
    return [];
  }
}

function write(items: QueuedReport[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("epilink:queue-changed"));
}

export const offlineQueue = {
  list: read,
  enqueue(payload: FormInputRequest) {
    const items = read();
    items.push({
      id: crypto.randomUUID(),
      payload: { ...payload, submission_mode: "offline-cached" },
      queuedAt: new Date().toISOString(),
    });
    write(items);
  },
  remove(id: string) {
    write(read().filter((i) => i.id !== id));
  },
  clear() {
    write([]);
  },
  async flush() {
    const items = read();
    const remaining: QueuedReport[] = [];
    for (const item of items) {
      try {
        await inputService.form(item.payload);
      } catch {
        remaining.push(item);
      }
    }
    write(remaining);
    return { synced: items.length - remaining.length, remaining: remaining.length };
  },
};
