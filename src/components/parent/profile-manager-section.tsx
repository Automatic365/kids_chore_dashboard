"use client";

import { useEffect, useState } from "react";

import {
  createProfile as createProfileRequest,
  deleteProfile as deleteProfileRequest,
  generateAvatar,
  updateProfile as updateProfileRequest,
} from "@/lib/client-api";
import { useHeroDialog } from "@/hooks/use-hero-dialog";
import { Profile, UiMode } from "@/lib/types/domain";
import { AvatarDisplay } from "@/components/avatar-display";
import { ImagePicker } from "@/components/parent/image-picker";

interface ProfileManagerSectionProps {
  profiles: Profile[];
  onRefresh: () => Promise<void>;
  pushToast: (type: "success" | "error", text: string) => void;
}

interface ProfileDraft {
  heroName: string;
  avatarUrl: string;
  uiMode: UiMode;
}

export function ProfileManagerSection({
  profiles,
  onRefresh,
  pushToast,
}: ProfileManagerSectionProps) {
  const { confirm, dialogNode } = useHeroDialog();
  const [drafts, setDrafts] = useState<Record<string, ProfileDraft>>({});
  const [savingById, setSavingById] = useState<Record<string, boolean>>({});
  const [deletingById, setDeletingById] = useState<Record<string, boolean>>({});
  const [newName, setNewName] = useState("");
  const [newAvatar, setNewAvatar] = useState("/avatars/captain.svg");
  const [newMode, setNewMode] = useState<UiMode>("text");
  const [creating, setCreating] = useState(false);
  const [generatingAvatarForId, setGeneratingAvatarForId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        profiles.map((profile) => [
          profile.id,
          {
            heroName: profile.heroName,
            avatarUrl: profile.avatarUrl,
            uiMode: profile.uiMode,
          } satisfies ProfileDraft,
        ]),
      ),
    );
  }, [profiles]);

  function updateDraft(profileId: string, patch: Partial<ProfileDraft>) {
    setDrafts((current) => {
      const base = current[profileId] ?? {
        heroName: "",
        avatarUrl: "/avatars/captain.svg",
        uiMode: "text" as UiMode,
      };
      return {
        ...current,
        [profileId]: { ...base, ...patch },
      };
    });
  }

  async function saveProfile(profile: Profile) {
    const draft = drafts[profile.id];
    if (!draft || !draft.heroName.trim()) {
      pushToast("error", "Hero name is required.");
      return;
    }

    setSavingById((current) => ({ ...current, [profile.id]: true }));
    try {
      await updateProfileRequest(profile.id, {
        heroName: draft.heroName.trim(),
        avatarUrl: draft.avatarUrl,
        uiMode: draft.uiMode,
      });
      pushToast("success", `Updated "${draft.heroName.trim()}".`);
      await onRefresh();
    } catch {
      pushToast("error", "Failed to update hero.");
    } finally {
      setSavingById((current) => ({ ...current, [profile.id]: false }));
    }
  }

  async function handleDelete(profile: Profile) {
    const confirmed = await confirm({
      title: "Delete Hero",
      description: `Remove "${profile.heroName}"? This permanently deletes the hero and all their missions.`,
      confirmLabel: "Delete Hero",
    });
    if (!confirmed) return;

    setDeletingById((current) => ({ ...current, [profile.id]: true }));
    try {
      await deleteProfileRequest(profile.id);
      pushToast("success", `Removed "${profile.heroName}".`);
      await onRefresh();
    } catch {
      pushToast("error", "Failed to remove hero.");
    } finally {
      setDeletingById((current) => ({ ...current, [profile.id]: false }));
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

  async function handleGenerateEditAvatar(profileId: string) {
    const draft = drafts[profileId];
    if (!draft || !draft.heroName.trim()) return;

    setGeneratingAvatarForId(profileId);
    try {
      const value = await generateAvatar(draft.heroName.trim());
      updateDraft(profileId, { avatarUrl: value });
      pushToast("success", "Avatar generated.");
    } catch {
      pushToast("error", "Avatar generation failed.");
    } finally {
      setGeneratingAvatarForId(null);
    }
  }

  return (
    <section className="comic-card p-4">
      <h2 className="text-xl font-black uppercase text-white">Heroes</h2>
      <p className="mt-1 text-xs font-bold uppercase text-white/80">
        Edit each hero&apos;s name and picture directly below.
      </p>

      <div className="mt-3 grid gap-3">
        {profiles.map((profile) => {
          const draft =
            drafts[profile.id] ??
            ({
              heroName: profile.heroName,
              avatarUrl: profile.avatarUrl,
              uiMode: profile.uiMode,
            } satisfies ProfileDraft);

          return (
            <article
              key={profile.id}
              className="grid gap-2 rounded-xl border-2 border-black bg-white p-3 text-black"
            >
              <div className="flex items-center gap-3">
                <AvatarDisplay
                  avatarUrl={draft.avatarUrl}
                  alt={draft.heroName || profile.heroName}
                  className="grid h-12 w-12 place-items-center rounded-lg border-2 border-black bg-white object-cover text-xl"
                />
                <div>
                  <p className="text-xs font-black uppercase text-zinc-500">
                    Current Power: {profile.powerLevel}
                  </p>
                </div>
              </div>

              <input
                value={draft.heroName}
                onChange={(e) => updateDraft(profile.id, { heroName: e.target.value })}
                maxLength={60}
                placeholder="Hero name"
                className="rounded-lg border-2 border-black px-3 py-2"
              />

              <ImagePicker
                value={draft.avatarUrl}
                onChange={(value) => updateDraft(profile.id, { avatarUrl: value })}
                placeholder="Avatar URL"
              />

              <select
                value={draft.uiMode}
                onChange={(e) => updateDraft(profile.id, { uiMode: e.target.value as UiMode })}
                className="rounded-lg border-2 border-black px-3 py-2"
              >
                <option value="text">Text mode (readers)</option>
                <option value="picture">Picture mode (toddlers)</option>
              </select>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void saveProfile(profile)}
                  disabled={Boolean(savingById[profile.id])}
                  className="rounded-lg border-2 border-black bg-[var(--hero-blue)] px-3 py-2 text-xs font-black uppercase text-white disabled:opacity-60"
                >
                  {savingById[profile.id] ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleGenerateEditAvatar(profile.id)}
                  disabled={generatingAvatarForId === profile.id}
                  className="rounded-lg border-2 border-black bg-[var(--hero-yellow)] px-3 py-2 text-xs font-black uppercase text-black disabled:opacity-60"
                >
                  {generatingAvatarForId === profile.id
                    ? "Generating Avatar..."
                    : "AI Generate Avatar"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(profile)}
                  disabled={Boolean(deletingById[profile.id])}
                  className="rounded-lg border-2 border-black bg-[var(--hero-red)] px-3 py-2 text-xs font-black uppercase text-white disabled:opacity-60"
                >
                  {deletingById[profile.id] ? "Removing..." : "Remove"}
                </button>
              </div>
            </article>
          );
        })}
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
          {creating ? "Adding..." : "Add Hero"}
        </button>
      </form>
      {dialogNode}
    </section>
  );
}
