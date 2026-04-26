"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createMissionBackfill,
  deleteMissionBackfill,
  fetchMissionBackfills,
} from "@/lib/client-api";
import { useHeroDialog } from "@/hooks/use-hero-dialog";
import { MissionBackfillEntry, MissionWithState, Profile } from "@/lib/types/domain";

interface MissionBackfillSectionProps {
  profiles: Profile[];
  missions: MissionWithState[];
  cycleDate: string;
  onRefresh: () => Promise<void>;
  pushToast: (type: "success" | "error", text: string) => void;
}

function previousDate(dateString: string): string {
  const value = new Date(`${dateString}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

export function MissionBackfillSection({
  profiles,
  missions,
  cycleDate,
  onRefresh,
  pushToast,
}: MissionBackfillSectionProps) {
  const { confirm, dialogNode } = useHeroDialog();
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [missionId, setMissionId] = useState("");
  const [localDate, setLocalDate] = useState(previousDate(cycleDate));
  const [entries, setEntries] = useState<MissionBackfillEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removingById, setRemovingById] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!profiles.some((profile) => profile.id === profileId)) {
      setProfileId(profiles[0]?.id ?? "");
    }
  }, [profileId, profiles]);

  useEffect(() => {
    setLocalDate(previousDate(cycleDate));
  }, [cycleDate]);

  const profileMissions = useMemo(
    () =>
      missions
        .filter(
          (mission) =>
            mission.profileId === profileId &&
            mission.isActive &&
            mission.deletedAt === null,
        )
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [missions, profileId],
  );

  useEffect(() => {
    if (!profileMissions.some((mission) => mission.id === missionId)) {
      setMissionId(profileMissions[0]?.id ?? "");
    }
  }, [missionId, profileMissions]);

  const loadEntries = useCallback(async () => {
    if (!profileId) {
      setEntries([]);
      return;
    }

    setLoadingEntries(true);
    try {
      const backfills = await fetchMissionBackfills(profileId);
      setEntries(backfills);
    } catch {
      pushToast("error", "Failed to load mission backfills.");
    } finally {
      setLoadingEntries(false);
    }
  }, [profileId, pushToast]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    if (!profileId || !missionId || !localDate) {
      pushToast("error", "Choose hero, mission, and date.");
      return;
    }

    setSubmitting(true);
    try {
      await createMissionBackfill({ profileId, missionId, localDate });
      pushToast("success", "Missed mission points logged.");
      await Promise.all([onRefresh(), loadEntries()]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to log missed mission points.";
      pushToast("error", message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(entry: MissionBackfillEntry) {
    const ok = await confirm({
      title: "Remove Backfill",
      description: `Remove backfill for "${entry.missionTitle}" on ${entry.localDate}? Points will be reversed.`,
      confirmLabel: "Remove Backfill",
    });
    if (!ok) {
      return;
    }

    setRemovingById((current) => ({ ...current, [entry.id]: true }));
    try {
      await deleteMissionBackfill(entry.id);
      pushToast("success", "Backfill removed.");
      await Promise.all([onRefresh(), loadEntries()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to remove backfill.";
      pushToast("error", message);
    } finally {
      setRemovingById((current) => ({ ...current, [entry.id]: false }));
    }
  }

  return (
    <section className="comic-card p-4">
      <h2 className="text-xl font-black uppercase text-white">Missed Mission Backfill</h2>
      <p className="mt-1 text-sm text-white/80">
        Log missed points for past dates only. Backfills award reward points, XP, and squad
        power without completing today&apos;s mission.
      </p>

      <form onSubmit={(event) => void handleCreate(event)} className="mt-3 grid gap-2 sm:grid-cols-4">
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
        <select
          value={missionId}
          onChange={(event) => setMissionId(event.target.value)}
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
          required
        >
          <option value="">Choose Mission</option>
          {profileMissions.map((mission) => (
            <option key={mission.id} value={mission.id}>
              {mission.title} (+{mission.powerValue})
            </option>
          ))}
        </select>
        <input
          type="date"
          value={localDate}
          onChange={(event) => setLocalDate(event.target.value)}
          max={previousDate(cycleDate)}
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
          required
        />
        <button
          type="submit"
          disabled={submitting || !profileId || !missionId || !localDate}
          className="rounded-xl border-2 border-black bg-[var(--hero-yellow)] px-4 py-2 text-sm font-black uppercase text-black disabled:opacity-50"
        >
          {submitting ? "Logging…" : "Log Backfill"}
        </button>
      </form>

      <div className="mt-4 rounded-xl border-2 border-black bg-white p-3 text-black">
        <p className="text-sm font-black uppercase text-zinc-700">Backfilled Entries</p>
        {loadingEntries ? (
          <p className="mt-2 text-sm text-zinc-600">Loading backfills…</p>
        ) : entries.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">No mission backfills for this hero yet.</p>
        ) : (
          <div className="mt-2 grid gap-2">
            {entries.map((entry) => (
              <article
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-black uppercase">{entry.missionTitle}</p>
                  <p className="text-xs text-zinc-600">
                    {entry.localDate} • +{entry.pointsAwarded} points
                  </p>
                </div>
                <button
                  type="button"
                  disabled={Boolean(removingById[entry.id])}
                  onClick={() => void handleRemove(entry)}
                  className="rounded-lg border-2 border-black bg-[var(--hero-red)] px-3 py-1 text-xs font-black uppercase text-white disabled:opacity-50"
                >
                  {removingById[entry.id] ? "Removing…" : "Remove"}
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
      {dialogNode}
    </section>
  );
}
