"use client";

import { useState } from "react";

import {
  createProfile as createProfileRequest,
  deleteProfile as deleteProfileRequest,
  updateProfile as updateProfileRequest,
} from "@/lib/client-api";
import { Profile, UiMode } from "@/lib/types/domain";
import { ImagePicker } from "@/components/parent/image-picker";

interface ProfileManagerSectionProps {
  profiles: Profile[];
  onRefresh: () => Promise<void>;
  pushToast: (type: "success" | "error", text: string) => void;
}

export function ProfileManagerSection({
  profiles,
  onRefresh,
  pushToast,
}: ProfileManagerSectionProps) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editMode, setEditMode] = useState<UiMode>("text");
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAvatar, setNewAvatar] = useState("/avatars/captain.svg");
  const [newMode, setNewMode] = useState<UiMode>("text");
  const [creating, setCreating] = useState(false);

  function startEdit(profile: Profile) {
    setEditId(profile.id);
    setEditName(profile.heroName);
    setEditAvatar(profile.avatarUrl);
    setEditMode(profile.uiMode);
  }

  function cancelEdit() {
    setEditId(null);
  }

  async function saveEdit() {
    if (!editId || !editName.trim()) return;
    setSaving(true);
    try {
      await updateProfileRequest(editId, {
        heroName: editName.trim(),
        avatarUrl: editAvatar,
        uiMode: editMode,
      });
      pushToast("success", "Hero updated.");
      setEditId(null);
      await onRefresh();
    } catch {
      pushToast("error", "Failed to update hero.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(profile: Profile) {
    const confirmed = window.confirm(
      `Remove "${profile.heroName}"? All their missions will be trashed.`,
    );
    if (!confirmed) return;

    try {
      await deleteProfileRequest(profile.id);
      pushToast("success", `Removed "${profile.heroName}".`);
      await onRefresh();
    } catch {
      pushToast("error", "Failed to remove hero.");
    }
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createProfileRequest({
        heroName: newName.trim(),
        avatarUrl: newAvatar,
        uiMode: newMode,
      });
      pushToast("success", `Hero "${newName.trim()}" added.`);
      setNewName("");
      setNewAvatar("/avatars/captain.svg");
      setNewMode("text");
      await onRefresh();
    } catch {
      pushToast("error", "Failed to add hero.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="comic-card p-4">
      <h2 className="text-xl font-black uppercase text-white">Heroes</h2>
      <div className="mt-3 grid gap-3">
        {profiles.map((profile) =>
          editId === profile.id ? (
            <div
              key={profile.id}
              className="grid gap-2 rounded-xl border-2 border-black bg-white p-3 text-black"
            >
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                maxLength={60}
                placeholder="Hero name"
                className="rounded-lg border-2 border-black px-3 py-2"
              />
              <ImagePicker value={editAvatar} onChange={setEditAvatar} placeholder="Avatar URL" />
              <select
                value={editMode}
                onChange={(e) => setEditMode(e.target.value as UiMode)}
                className="rounded-lg border-2 border-black px-3 py-2"
              >
                <option value="text">Text mode (readers)</option>
                <option value="picture">Picture mode (toddlers)</option>
              </select>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void saveEdit()}
                  disabled={saving}
                  className="flex-1 rounded-lg border-2 border-black bg-[var(--hero-blue)] px-3 py-2 text-sm font-black uppercase text-white disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex-1 rounded-lg border-2 border-black bg-zinc-100 px-3 py-2 text-sm font-black uppercase text-black"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              key={profile.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-black bg-white p-3 text-black"
            >
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={profile.avatarUrl}
                  alt={profile.heroName}
                  className="h-10 w-10 rounded-lg border-2 border-black object-cover"
                />
                <div>
                  <p className="font-black uppercase">{profile.heroName}</p>
                  <p className="text-xs font-bold uppercase text-zinc-500">
                    {profile.uiMode === "text" ? "Text mode" : "Picture mode"} · Lv {profile.powerLevel}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(profile)}
                  className="rounded-lg border-2 border-black bg-zinc-100 px-3 py-1 text-xs font-black uppercase text-black"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(profile)}
                  className="rounded-lg border-2 border-black bg-[var(--hero-red)] px-3 py-1 text-xs font-black uppercase text-white"
                >
                  Remove
                </button>
              </div>
            </div>
          ),
        )}
      </div>

      <form onSubmit={(e) => void handleCreate(e)} className="mt-4 grid gap-2">
        <p className="text-sm font-black uppercase text-white/80">Add Hero</p>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          required
          minLength={2}
          maxLength={60}
          placeholder="Hero name"
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
        />
        <ImagePicker value={newAvatar} onChange={setNewAvatar} placeholder="Avatar URL" />
        <select
          value={newMode}
          onChange={(e) => setNewMode(e.target.value as UiMode)}
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
        >
          <option value="text">Text mode (readers)</option>
          <option value="picture">Picture mode (toddlers)</option>
        </select>
        <button
          type="submit"
          disabled={creating}
          className="rounded-xl border-2 border-black bg-[var(--hero-blue)] px-4 py-2 text-sm font-black uppercase text-white disabled:opacity-60"
        >
          {creating ? "Adding…" : "Add Hero"}
        </button>
      </form>
    </section>
  );
}
