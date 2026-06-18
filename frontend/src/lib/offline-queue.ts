import type { ReportInput } from "./api/types";
import { reportsService } from "./api/services";

const KEY = "epilink:offline-reports";

export interface QueuedReport {
  id: string;
  payload: any;
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
  enqueue(payload: ReportInput) {
    const items = read();
    items.push({
      id: crypto.randomUUID(),
      payload,
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
        await reportsService.create(item.payload);
      } catch {
        remaining.push(item);
      }
    }
    write(remaining);
    return { synced: items.length - remaining.length, remaining: remaining.length };
  },
};
