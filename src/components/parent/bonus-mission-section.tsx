"use client";

import { useEffect, useState } from "react";

import { createMission as createMissionRequest } from "@/lib/client-api";
import { Profile } from "@/lib/types/domain";

interface BonusMissionSectionProps {
  profiles: Profile[];
  onRefresh: () => Promise<void>;
  pushToast: (type: "success" | "error", text: string) => void;
}

export function BonusMissionSection({
  profiles,
  onRefresh,
  pushToast,
}: BonusMissionSectionProps) {
  const [profileId, setProfileId] = useState("");
  const [title, setTitle] = useState("");
  const [powerValue, setPowerValue] = useState(12);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!profileId && profiles.length > 0) {
      setProfileId(profiles[0].id);
    }
  }, [profileId, profiles]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!profileId || !title.trim()) return;

    setCreating(true);
    try {
      await createMissionRequest({
        profileId,
        title: title.trim(),
        instructions: "Bonus mission from Mission Command.",
        powerValue: Math.max(1, powerValue),
        recurringDaily: false,
        isActive: true,
      });
      setTitle("");
      setPowerValue(12);
      pushToast("success", "Bonus mission added.");
      await onRefresh();
    } catch {
      pushToast("error", "Failed to add bonus mission.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="comic-card p-4">
      <h2 className="text-xl font-black uppercase text-white">Bonus Mission</h2>
      <form onSubmit={(event) => void handleCreate(event)} className="mt-3 grid gap-2 sm:grid-cols-3">
        <select
          value={profileId}
          onChange={(event) => setProfileId(event.target.value)}
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
          required
        >
          <option value="">Choose Hero</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.heroName}
            </option>
          ))}
        </select>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Mission title"
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black sm:col-span-2"
          maxLength={120}
          required
        />
        <input
          type="number"
          value={powerValue}
          onChange={(event) => setPowerValue(Number(event.target.value) || 1)}
          min={1}
          max={100}
          className="w-28 rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
          required
        />
        <button
          type="submit"
          disabled={creating}
          className="rounded-xl border-2 border-black bg-[var(--hero-red)] px-4 py-2 text-sm font-black uppercase text-white disabled:opacity-60 sm:col-span-2"
        >
          {creating ? "Adding…" : "Add Bonus Mission"}
        </button>
      </form>
    </section>
  );
}
