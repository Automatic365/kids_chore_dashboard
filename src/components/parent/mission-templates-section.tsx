"use client";

import { useEffect, useState } from "react";

import { createMission as createMissionRequest } from "@/lib/client-api";
import { MISSION_TEMPLATE_PACKS } from "@/lib/mission-templates";
import { Profile } from "@/lib/types/domain";

interface MissionTemplatesSectionProps {
  profiles: Profile[];
  onRefresh: () => Promise<void>;
  pushToast: (type: "success" | "error", text: string) => void;
}

export function MissionTemplatesSection({
  profiles,
  onRefresh,
  pushToast,
}: MissionTemplatesSectionProps) {
  const [profileId, setProfileId] = useState("");
  const [loadingPackId, setLoadingPackId] = useState<string | null>(null);

  useEffect(() => {
    if (!profileId && profiles.length > 0) {
      setProfileId(profiles[0].id);
    }
  }, [profileId, profiles]);

  async function addMission(packId: string, mission: (typeof MISSION_TEMPLATE_PACKS)[number]["missions"][number]) {
    if (!profileId) return;
    setLoadingPackId(packId);
    try {
      await createMissionRequest({
        profileId,
        title: mission.title,
        instructions: mission.instructions,
        powerValue: mission.powerValue,
        recurringDaily: mission.recurringDaily,
        isActive: true,
      });
      pushToast("success", `Added "${mission.title}".`);
      await onRefresh();
    } catch {
      pushToast("error", "Failed to add template mission.");
    } finally {
      setLoadingPackId(null);
    }
  }

  async function addPack(packId: string) {
    if (!profileId) return;
    const pack = MISSION_TEMPLATE_PACKS.find((item) => item.id === packId);
    if (!pack) return;
    setLoadingPackId(packId);
    try {
      await Promise.all(
        pack.missions.map((mission) =>
          createMissionRequest({
            profileId,
            title: mission.title,
            instructions: mission.instructions,
            powerValue: mission.powerValue,
            recurringDaily: mission.recurringDaily,
            isActive: true,
          }),
        ),
      );
      pushToast("success", `Added "${pack.name}" pack.`);
      await onRefresh();
    } catch {
      pushToast("error", "Failed to add template pack.");
    } finally {
      setLoadingPackId(null);
    }
  }

  return (
    <section className="comic-card p-4">
      <h2 className="text-xl font-black uppercase text-white">Mission Templates</h2>
      <div className="mt-3">
        <select
          value={profileId}
          onChange={(event) => setProfileId(event.target.value)}
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
        >
          <option value="">Choose Hero</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.heroName}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {MISSION_TEMPLATE_PACKS.map((pack) => (
          <article
            key={pack.id}
            className="rounded-xl border-2 border-black bg-white p-3 text-black"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-lg font-black uppercase">{pack.name}</p>
                <p className="text-sm text-zinc-700">{pack.description}</p>
              </div>
              <button
                type="button"
                disabled={!profileId || loadingPackId === pack.id}
                onClick={() => void addPack(pack.id)}
                className="rounded-lg border-2 border-black bg-[var(--hero-yellow)] px-3 py-1 text-xs font-black uppercase text-black disabled:opacity-60"
              >
                Add All
              </button>
            </div>

            <ul className="mt-3 grid gap-2">
              {pack.missions.map((mission) => (
                <li
                  key={`${pack.id}-${mission.title}`}
                  className="rounded-lg border border-zinc-300 bg-zinc-50 p-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-black uppercase">{mission.title}</p>
                      <p className="text-xs text-zinc-700">{mission.instructions}</p>
                    </div>
                    <button
                      type="button"
                      disabled={!profileId || loadingPackId === pack.id}
                      onClick={() => void addMission(pack.id, mission)}
                      className="rounded border-2 border-black bg-white px-2 py-1 text-[10px] font-black uppercase disabled:opacity-60"
                    >
                      Add
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
