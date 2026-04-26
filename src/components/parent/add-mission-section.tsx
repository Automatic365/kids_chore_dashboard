"use client";

import { createMission as createMissionRequest } from "@/lib/client-api";
import { Profile } from "@/lib/types/domain";
import { ImagePicker } from "@/components/parent/image-picker";
import { useState } from "react";

const ALL_HEROES_VALUE = "__all_heroes__";

interface AddMissionSectionProps {
  profiles: Profile[];
  onRefresh: () => Promise<void>;
  pushToast: (type: "success" | "error", text: string) => void;
}

export function AddMissionSection({ profiles, onRefresh, pushToast }: AddMissionSectionProps) {
  const [imageUrl, setImageUrl] = useState("");

  function resolveTargetProfileIds(targetValue: string): string[] {
    if (targetValue === ALL_HEROES_VALUE) {
      return profiles.map((profile) => profile.id);
    }
    return targetValue ? [targetValue] : [];
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const target = String(formData.get("profileId") ?? "");
    const title = String(formData.get("title") ?? "").trim();
    const instructions = String(formData.get("instructions") ?? "").trim();
    const powerValue = Number(formData.get("powerValue") ?? 0);
    const recurringDaily = formData.get("recurringDaily") === "on";
    const profileIds = resolveTargetProfileIds(target);

    if (profileIds.length === 0) return;

    try {
      await Promise.all(
        profileIds.map((profileId) =>
          createMissionRequest({
            profileId,
            title,
            instructions,
            imageUrl: imageUrl || null,
            powerValue,
            isActive: true,
            recurringDaily,
          }),
        ),
      );
      const targetLabel =
        profileIds.length === 1 ? "hero" : `${profileIds.length} heroes`;
      pushToast("success", `Mission "${title}" created for ${targetLabel}.`);
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
      <form
        className="mt-3 grid gap-2 sm:grid-cols-2"
        onSubmit={(e) => void handleSubmit(e)}
        autoComplete="off"
        data-1p-ignore
        data-bwignore="true"
        data-lpignore="true"
      >
        <select
          name="profileId"
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
          autoComplete="off"
          data-1p-ignore
          data-bwignore="true"
          data-lpignore="true"
          required
        >
          <option value="">Choose Hero</option>
          {profiles.length > 1 ? (
            <option value={ALL_HEROES_VALUE}>All Heroes</option>
          ) : null}
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.heroName}
            </option>
          ))}
        </select>
        <input
          name="title"
          type="text"
          required
          minLength={2}
          maxLength={120}
          placeholder="Mission title"
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
          autoComplete="off"
          data-1p-ignore
          data-bwignore="true"
          data-lpignore="true"
        />
        <textarea
          name="instructions"
          required
          minLength={1}
          maxLength={1000}
          placeholder="Task instructions (what the child should do)"
          className="min-h-20 rounded-lg border-2 border-black bg-white px-3 py-2 text-black sm:col-span-2"
          autoComplete="off"
          data-1p-ignore
          data-bwignore="true"
          data-lpignore="true"
        />
        <ImagePicker
          value={imageUrl}
          onChange={setImageUrl}
          placeholder="Image URL (optional)"
          className="sm:col-span-2"
          uploadKind="mission"
        />
        <input
          name="powerValue"
          type="number"
          min={1}
          max={100}
          defaultValue={10}
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
          autoComplete="off"
          data-1p-ignore
          data-bwignore="true"
          data-lpignore="true"
        />
        <label className="inline-flex items-center gap-2 rounded-lg border-2 border-black bg-white px-3 py-2 text-sm font-bold uppercase text-black">
          <input
            type="checkbox"
            name="recurringDaily"
            defaultChecked
            autoComplete="off"
            data-1p-ignore
            data-bwignore="true"
            data-lpignore="true"
          />
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
