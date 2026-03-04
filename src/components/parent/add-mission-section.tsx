"use client";

import { createMission as createMissionRequest } from "@/lib/client-api";
import { Profile } from "@/lib/types/domain";
import { ImagePicker } from "@/components/parent/image-picker";
import { useState } from "react";

interface AddMissionSectionProps {
  profiles: Profile[];
  onRefresh: () => Promise<void>;
  pushToast: (type: "success" | "error", text: string) => void;
}

export function AddMissionSection({ profiles, onRefresh, pushToast }: AddMissionSectionProps) {
  const [imageUrl, setImageUrl] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const profileId = String(formData.get("profileId") ?? "");
    const title = String(formData.get("title") ?? "").trim();
    const instructions = String(formData.get("instructions") ?? "").trim();
    const powerValue = Number(formData.get("powerValue") ?? 0);
    const recurringDaily = formData.get("recurringDaily") === "on";

    if (!profileId) return;

    try {
      await createMissionRequest({
        profileId,
        title,
        instructions,
        imageUrl: imageUrl || null,
        powerValue,
        isActive: true,
        recurringDaily,
      });
      pushToast("success", `Mission "${title}" created.`);
      setImageUrl("");
      event.currentTarget.reset();
      await onRefresh();
    } catch {
      pushToast("error", "Failed to create mission.");
    }
  }

  return (
    <section className="comic-card p-4">
      <h2 className="text-xl font-black uppercase text-white">Add Mission</h2>
      <form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={(e) => void handleSubmit(e)}>
        <select
          name="profileId"
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
          name="title"
          required
          minLength={2}
          maxLength={120}
          placeholder="Mission title"
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
        />
        <textarea
          name="instructions"
          required
          minLength={1}
          maxLength={1000}
          placeholder="Task instructions (what the child should do)"
          className="min-h-20 rounded-lg border-2 border-black bg-white px-3 py-2 text-black sm:col-span-2"
        />
        <ImagePicker
          value={imageUrl}
          onChange={setImageUrl}
          placeholder="Image URL (optional)"
          className="sm:col-span-2"
        />
        <input
          name="powerValue"
          type="number"
          min={1}
          max={100}
          defaultValue={10}
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
        />
        <label className="inline-flex items-center gap-2 rounded-lg border-2 border-black bg-white px-3 py-2 text-sm font-bold uppercase text-black">
          <input type="checkbox" name="recurringDaily" defaultChecked />
          Recurs Daily
        </label>
        <button
          type="submit"
          className="rounded-xl border-2 border-black bg-[var(--hero-red)] px-4 py-2 text-sm font-black uppercase text-white sm:col-span-2"
        >
          Create Mission
        </button>
      </form>
    </section>
  );
}
