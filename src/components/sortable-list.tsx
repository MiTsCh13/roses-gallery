"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

export type SortableItem = {
  id: string;
  label: string;
  detail?: string;
  extra?: ReactNode;
};

type Props = {
  items: SortableItem[];
  /** Persists the new order (a server action bound to the parent). */
  onReorder: (orderedIds: string[]) => Promise<void>;
  labels: { up: string; down: string; handle: string };
  testId?: string;
};

/**
 * Reorderable list: native drag and drop for pointers, up/down buttons for
 * keyboard and touch. The order is saved after every move.
 */
export function SortableList({ items, onReorder, labels, testId }: Props) {
  const router = useRouter();
  const [order, setOrder] = useState(items.map((i) => i.id));
  const [synced, setSynced] = useState(items);
  const [dragging, setDragging] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Take over server data after a refresh (new uploads, other tabs).
  if (synced !== items) {
    setSynced(items);
    setOrder(items.map((i) => i.id));
  }

  const byId = new Map(items.map((i) => [i.id, i]));

  function commit(next: string[]) {
    setOrder(next);
    startTransition(async () => {
      await onReorder(next);
      router.refresh();
    });
  }

  function move(id: string, to: number) {
    const from = order.indexOf(id);
    if (from === to || to < 0 || to >= order.length) return;
    const next = order.filter((x) => x !== id);
    next.splice(to, 0, id);
    commit(next);
  }

  return (
    <ul className="space-y-2" data-testid={testId} aria-busy={pending}>
      {order.map((id, index) => {
        const item = byId.get(id);
        if (!item) return null;
        return (
          <li
            key={id}
            data-id={id}
            draggable
            onDragStart={() => setDragging(id)}
            onDragEnd={() => setDragging(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging) move(dragging, index);
              setDragging(null);
            }}
            className={`flex items-center gap-2 rounded-md border p-3 text-sm ${
              dragging === id ? "opacity-50" : ""
            }`}
          >
            <span aria-hidden title={labels.handle} className="cursor-grab">
              ⠿
            </span>
            <span className="flex-1">
              {item.label}
              {item.detail && (
                <span className="text-muted-foreground"> · {item.detail}</span>
              )}
            </span>
            {item.extra}
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label={`${labels.up}: ${item.label}`}
              disabled={index === 0 || pending}
              onClick={() => move(id, index - 1)}
            >
              ↑
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              aria-label={`${labels.down}: ${item.label}`}
              disabled={index === order.length - 1 || pending}
              onClick={() => move(id, index + 1)}
            >
              ↓
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
