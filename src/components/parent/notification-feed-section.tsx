"use client";

import { useCallback, useState } from "react";

import {
  fetchNotifications,
  markNotificationsRead,
} from "@/lib/client-api";
import { NotificationEvent } from "@/lib/types/domain";

interface NotificationFeedSectionProps {
  pushToast: (type: "success" | "error", text: string) => void;
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function NotificationFeedSection({ pushToast }: NotificationFeedSectionProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchNotifications(200);
      setNotifications(rows);
      setLoading(false);
      if (rows.some((row) => row.readAt === null)) {
        await markNotificationsRead();
        const now = new Date().toISOString();
        setNotifications((current) =>
          current.map((row) => ({ ...row, readAt: row.readAt ?? now })),
        );
      }
    } catch {
      setLoading(false);
      pushToast("error", "Failed to load notification feed.");
    }
  }, [pushToast]);

  const unreadCount = notifications.filter((row) => row.readAt === null).length;

  return (
    <section className="comic-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black uppercase text-white">Parent Feed</h2>
        {unreadCount > 0 ? (
          <span className="rounded-full border-2 border-black bg-[var(--hero-yellow)] px-2 py-1 text-xs font-black uppercase text-black">
            {unreadCount} unread
          </span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) {
            void loadNotifications();
          }
        }}
        className="mt-3 w-full rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-black uppercase text-black"
      >
        {open ? "Hide Feed" : "Show Feed"}
      </button>

      {open ? (
        <div className="mt-3 grid gap-2">
          {loading ? (
            <p className="text-sm font-bold text-white/85">Loading notifications...</p>
          ) : notifications.length === 0 ? (
            <p className="text-sm font-bold text-white/85">No notifications yet.</p>
          ) : (
            notifications.map((item) => (
              <article
                key={item.id}
                className={`rounded-xl border-2 border-black p-3 text-sm ${
                  item.readAt ? "bg-white text-black" : "bg-[var(--hero-yellow)] text-black"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black uppercase">{item.title}</p>
                  <p className="text-xs font-bold uppercase">
                    {formatTimestamp(item.createdAt)}
                  </p>
                </div>
                <p className="mt-1 font-semibold">{item.message}</p>
              </article>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}
