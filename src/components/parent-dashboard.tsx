"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  awardSquadPower as awardSquadPowerRequest,
  createMission as createMissionRequest,
  deleteMission as deleteMissionRequest,
  fetchParentDashboard,
  loginParent,
  logoutParent,
  restoreMission as restoreMissionRequest,
  updateMission as updateMissionRequest,
} from "@/lib/client-api";
import { AiProvider, MissionWithState, ParentDashboardData } from "@/lib/types/domain";

interface MissionDraft {
  id: string;
  title: string;
  instructions: string;
  imageUrl: string;
  powerValue: number;
  isActive: boolean;
  recurringDaily: boolean;
}

interface GeneratedMissionDraft {
  title: string;
  instructions: string;
  powerValue: number;
  recurringDaily: boolean;
}

interface ToastMessage {
  id: string;
  type: "success" | "error";
  text: string;
}

function toDraft(mission: MissionWithState): MissionDraft {
  return {
    id: mission.id,
    title: mission.title,
    instructions: mission.instructions,
    imageUrl: mission.imageUrl ?? "",
    powerValue: mission.powerValue,
    isActive: mission.isActive,
    recurringDaily: mission.recurringDaily,
  };
}

export function ParentDashboard() {
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<ParentDashboardData | null>(null);
  const [drafts, setDrafts] = useState<Record<string, MissionDraft>>({});
  const [awardDelta, setAwardDelta] = useState(5);
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [savingByMission, setSavingByMission] = useState<Record<string, boolean>>({});
  const [deletingByMission, setDeletingByMission] = useState<Record<string, boolean>>({});
  const [restoringByMission, setRestoringByMission] = useState<Record<string, boolean>>({});
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const autosaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [aiTaskList, setAiTaskList] = useState("");
  const [aiProfileId, setAiProfileId] = useState("");
  const [aiProvider, setAiProvider] = useState<AiProvider>("openai");
  const [aiParentPin, setAiParentPin] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<GeneratedMissionDraft[]>([]);

  const missionDrafts = useMemo(() => Object.values(drafts), [drafts]);

  const pushToast = useCallback((type: ToastMessage["type"], text: string) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current.slice(-2), { id, type, text }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3000);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchParentDashboard();
      setDashboard(data);
      setDrafts(
        Object.fromEntries(data.missions.map((mission) => [mission.id, toDraft(mission)])),
      );
      setAuthError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message === "UNAUTHORIZED") {
        setDashboard(null);
      }
      setAuthError(message === "UNAUTHORIZED" ? null : message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!aiProfileId && dashboard?.profiles.length) {
      setAiProfileId(dashboard.profiles[0].id);
    }
  }, [aiProfileId, dashboard]);

  const login = useCallback(async () => {
    const ok = await loginParent(pin);
    if (!ok) {
      setAuthError("Invalid PIN");
      return;
    }

    setPin("");
    setAiParentPin(pin);
    setAuthError(null);
    await refresh();
  }, [pin, refresh]);

  const logout = useCallback(async () => {
    await logoutParent();
    setDashboard(null);
  }, []);

  const persistMissionDraft = useCallback(async (draft: MissionDraft) => {
    setSavingByMission((current) => ({ ...current, [draft.id]: true }));
    try {
      await updateMissionRequest(draft.id, {
        title: draft.title,
        instructions: draft.instructions,
        imageUrl: draft.imageUrl || null,
        powerValue: draft.powerValue,
        isActive: draft.isActive,
        recurringDaily: draft.recurringDaily,
      });
      setAutosaveError(null);
    } catch {
      setAutosaveError("Autosave failed for one or more missions.");
      pushToast("error", "Autosave failed for one or more missions.");
    } finally {
      setSavingByMission((current) => ({ ...current, [draft.id]: false }));
    }
  }, [pushToast]);

  const scheduleAutosave = useCallback(
    (draft: MissionDraft) => {
      const existingTimer = autosaveTimers.current[draft.id];
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      autosaveTimers.current[draft.id] = setTimeout(() => {
        void persistMissionDraft(draft);
        delete autosaveTimers.current[draft.id];
      }, 700);
    },
    [persistMissionDraft],
  );

  useEffect(() => {
    const timers = autosaveTimers.current;
    return () => {
      Object.values(timers).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const awardSquadPower = useCallback(async () => {
    try {
      await awardSquadPowerRequest({
        delta: awardDelta,
        note: "Manual parent award",
      });
      pushToast("success", "Squad power awarded.");
      await refresh();
    } catch {
      pushToast("error", "Failed to award squad power.");
    }
  }, [awardDelta, pushToast, refresh]);

  const createMissionFromForm = useCallback(
    async (formData: FormData) => {
      const profileId = String(formData.get("profileId") ?? "");
      const title = String(formData.get("title") ?? "");
      const instructions = String(formData.get("instructions") ?? "");
      const imageUrl = String(formData.get("imageUrl") ?? "");
      const powerValue = Number(formData.get("powerValue") ?? 0);
      const recurringDaily = formData.get("recurringDaily") === "on";

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
      await refresh();
    },
    [pushToast, refresh],
  );

  const generateAiSuggestions = useCallback(async () => {
    if (!dashboard) return;

    const tasks = aiTaskList
      .split(/\n|,/)
      .map((task) => task.trim())
      .filter(Boolean);

    if (tasks.length === 0) {
      setAiError("Add at least one task to generate missions.");
      return;
    }

    const profile = dashboard.profiles.find((item) => item.id === aiProfileId);
    if (!profile) {
      setAiError("Choose a hero before generating missions.");
      return;
    }

    setAiGenerating(true);
    setAiError(null);
    try {
      const response = await fetch("/api/parent/ai/generate-missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks,
          profileName: profile.heroName,
          uiMode: profile.uiMode,
          provider: aiProvider,
          parentPin: aiParentPin || undefined,
        }),
      });

      if (!response.ok) {
        setAiError(
          response.status === 401
            ? "AI generation needs parent PIN (or parent cookie auth)."
            : "AI generation failed.",
        );
        return;
      }

      const data = (await response.json()) as {
        missions: GeneratedMissionDraft[];
      };
      setAiSuggestions(data.missions ?? []);
      pushToast("success", `Generated ${data.missions?.length ?? 0} mission suggestions.`);
    } catch {
      setAiError("AI generation failed.");
      pushToast("error", "AI generation failed.");
    } finally {
      setAiGenerating(false);
    }
  }, [aiParentPin, aiProfileId, aiProvider, aiTaskList, dashboard, pushToast]);

  const addAiSuggestion = useCallback(
    async (suggestion: GeneratedMissionDraft) => {
      if (!aiProfileId) return;

      await createMissionRequest({
        profileId: aiProfileId,
        title: suggestion.title,
        instructions: suggestion.instructions,
        powerValue: suggestion.powerValue,
        recurringDaily: suggestion.recurringDaily,
        isActive: true,
      });
      pushToast("success", `Added mission "${suggestion.title}".`);
      await refresh();
    },
    [aiProfileId, pushToast, refresh],
  );

  const addAllAiSuggestions = useCallback(async () => {
    if (!aiProfileId || aiSuggestions.length === 0) return;

    for (const suggestion of aiSuggestions) {
      await createMissionRequest({
        profileId: aiProfileId,
        title: suggestion.title,
        instructions: suggestion.instructions,
        powerValue: suggestion.powerValue,
        recurringDaily: suggestion.recurringDaily,
        isActive: true,
      });
    }

    pushToast("success", `Added ${aiSuggestions.length} missions.`);
    setAiSuggestions([]);
    await refresh();
  }, [aiProfileId, aiSuggestions, pushToast, refresh]);

  const deleteMission = useCallback(
    async (missionId: string, missionTitle: string) => {
      const shouldDelete =
        typeof window === "undefined"
          ? true
          : window.confirm(`Move "${missionTitle}" to trash? You can restore it later.`);

      if (!shouldDelete) {
        return;
      }

      const pendingAutosave = autosaveTimers.current[missionId];
      if (pendingAutosave) {
        clearTimeout(pendingAutosave);
        delete autosaveTimers.current[missionId];
      }

      setDeletingByMission((current) => ({ ...current, [missionId]: true }));

      try {
        await deleteMissionRequest(missionId);
        setAutosaveError(null);
        pushToast("success", `Moved "${missionTitle}" to trash.`);
        await refresh();
      } catch {
        setAutosaveError("Delete failed for one or more missions.");
        pushToast("error", "Delete failed for one or more missions.");
      } finally {
        setDeletingByMission((current) => ({ ...current, [missionId]: false }));
      }
    },
    [pushToast, refresh],
  );

  const restoreMission = useCallback(
    async (missionId: string, missionTitle: string) => {
      setRestoringByMission((current) => ({ ...current, [missionId]: true }));
      try {
        await restoreMissionRequest(missionId);
        pushToast("success", `Restored "${missionTitle}".`);
        await refresh();
      } catch {
        pushToast("error", "Failed to restore mission.");
      } finally {
        setRestoringByMission((current) => ({ ...current, [missionId]: false }));
      }
    },
    [pushToast, refresh],
  );

  if (loading) {
    return <p className="text-white">Loading parent dashboard...</p>;
  }

  if (!dashboard) {
    return (
      <section className="mx-auto w-full max-w-md rounded-2xl border-4 border-black bg-white p-5 text-black shadow-[8px_8px_0_#000]">
        <h1 className="text-2xl font-black uppercase">Mission Command</h1>
        <p className="mt-1 text-sm">Enter parent PIN to continue.</p>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          className="mt-4 w-full rounded-xl border-2 border-black px-3 py-3 text-xl tracking-[0.3em]"
          placeholder="••••"
        />
        {authError ? <p className="mt-2 text-sm text-red-600">{authError}</p> : null}
        <button
          type="button"
          onClick={() => void login()}
          className="mt-4 w-full rounded-xl border-2 border-black bg-[var(--hero-red)] px-4 py-3 font-black uppercase text-white"
        >
          Unlock
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-2 py-4 sm:px-4">
      {toasts.length > 0 ? (
        <div className="pointer-events-none fixed top-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`rounded-xl border-2 border-black px-3 py-2 text-sm font-bold shadow-[4px_4px_0_#000] ${
                toast.type === "success"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {toast.text}
            </div>
          ))}
        </div>
      ) : null}

      <header className="comic-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black uppercase text-white">Mission Command</h1>
            <p className="text-sm uppercase text-white/75">
              Cycle Date: {dashboard.squad.cycleDate}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-xl border-2 border-black bg-white px-4 py-2 text-sm font-black uppercase text-black"
          >
            Log Out
          </button>
        </div>

        <div className="mt-3">
          <p className="mb-1 text-sm font-bold uppercase text-white/80">Squad Meter</p>
          <div className="meter-wrap bg-white/20">
            <div
              className="meter-fill bg-[var(--hero-yellow)]"
              style={{
                width: `${Math.round(
                  (dashboard.squad.squadPowerCurrent /
                    Math.max(1, dashboard.squad.squadPowerMax)) *
                    100,
                )}%`,
              }}
            />
          </div>
          <p className="mt-1 text-sm font-bold uppercase text-white">
            {dashboard.squad.squadPowerCurrent}/{dashboard.squad.squadPowerMax}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="number"
              value={awardDelta}
              onChange={(event) => setAwardDelta(Number(event.target.value))}
              className="w-24 rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
            />
            <button
              type="button"
              onClick={() => void awardSquadPower()}
              className="rounded-xl border-2 border-black bg-[var(--hero-yellow)] px-4 py-2 text-sm font-black uppercase text-black"
            >
              Award Squad Power
            </button>
          </div>
        </div>
      </header>

      <section className="comic-card p-4">
        <h2 className="text-xl font-black uppercase text-white">Add Mission</h2>
        <form
          className="mt-3 grid gap-2 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            void createMissionFromForm(formData);
            event.currentTarget.reset();
          }}
        >
          <select
            name="profileId"
            className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
            required
          >
            <option value="">Choose Hero</option>
            {dashboard.profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.heroName}
              </option>
            ))}
          </select>
          <input
            name="title"
            required
            placeholder="Mission title"
            className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
          />
          <textarea
            name="instructions"
            required
            placeholder="Task instructions (what the child should do)"
            className="min-h-24 rounded-lg border-2 border-black bg-white px-3 py-2 text-black sm:col-span-2"
          />
          <input
            name="imageUrl"
            placeholder="Image URL (optional)"
            className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
          />
          <input
            name="powerValue"
            type="number"
            min={1}
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

      <section className="comic-card p-4">
        <h2 className="text-xl font-black uppercase text-white">AI Mission Generator</h2>
        <p className="mt-1 text-sm text-white/80">
          Paste tasks and generate mission names + clear instructions.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select
            value={aiProfileId}
            onChange={(event) => setAiProfileId(event.target.value)}
            className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
          >
            <option value="">Choose Hero</option>
            {dashboard.profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.heroName}
              </option>
            ))}
          </select>
          <input
            value={aiParentPin}
            onChange={(event) => setAiParentPin(event.target.value)}
            type="password"
            inputMode="numeric"
            placeholder="Parent PIN (needed in local mode)"
            className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
          />
          <select
            value={aiProvider}
            onChange={(event) => setAiProvider(event.target.value as AiProvider)}
            className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
          >
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
          </select>
          <textarea
            value={aiTaskList}
            onChange={(event) => setAiTaskList(event.target.value)}
            placeholder={"One task per line, e.g.\nPick up toys\nBrush teeth\nPut shoes away"}
            className="min-h-28 rounded-lg border-2 border-black bg-white px-3 py-2 text-black sm:col-span-2"
          />
          <button
            type="button"
            onClick={() => void generateAiSuggestions()}
            disabled={aiGenerating}
            className="rounded-xl border-2 border-black bg-[var(--hero-yellow)] px-4 py-2 text-sm font-black uppercase text-black disabled:opacity-60 sm:col-span-2"
          >
            {aiGenerating ? "Generating..." : "Generate Missions"}
          </button>
        </div>
        {aiError ? <p className="mt-2 text-sm font-bold text-red-200">{aiError}</p> : null}

        {aiSuggestions.length > 0 ? (
          <div className="mt-4 grid gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black uppercase text-white/90">Suggestions</p>
              <button
                type="button"
                onClick={() => void addAllAiSuggestions()}
                className="rounded-lg border-2 border-black bg-white px-3 py-1 text-xs font-black uppercase text-black"
              >
                Add All
              </button>
            </div>
            {aiSuggestions.map((suggestion, index) => (
              <article
                key={`${suggestion.title}-${index}`}
                className="rounded-xl border-2 border-black bg-white p-3 text-black"
              >
                <p className="text-lg font-black uppercase">{suggestion.title}</p>
                <p className="mt-1 text-sm">{suggestion.instructions}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold uppercase">
                  <span className="rounded-full bg-[var(--hero-yellow)] px-2 py-1">
                    +{suggestion.powerValue} Power
                  </span>
                  <span className="rounded-full bg-zinc-200 px-2 py-1">
                    {suggestion.recurringDaily ? "Daily" : "One-Time"}
                  </span>
                  <button
                    type="button"
                    onClick={() => void addAiSuggestion(suggestion)}
                    className="rounded-lg border-2 border-black bg-[var(--hero-blue)] px-3 py-1 text-xs font-black uppercase text-white"
                  >
                    Add
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="comic-card p-4">
        <h2 className="text-xl font-black uppercase text-white">Manage Missions</h2>
        {autosaveError ? (
          <p className="mt-2 rounded-md bg-red-100 px-3 py-2 text-sm font-bold text-red-700">
            {autosaveError}
          </p>
        ) : null}
        <div className="mt-3 grid gap-3">
          {missionDrafts.map((mission) => (
            <article
              key={mission.id}
              className="rounded-xl border-2 border-black bg-white p-3 text-black"
            >
              <div className="grid gap-2 md:grid-cols-[2fr_2fr_2fr_120px_auto_auto_auto_auto] md:items-center">
                <input
                  value={mission.title}
                  onChange={(event) => {
                    const next = { ...mission, title: event.target.value };
                    setDrafts((current) => ({ ...current, [mission.id]: next }));
                    scheduleAutosave(next);
                  }}
                  className="rounded-lg border-2 border-black px-3 py-2"
                />
                <input
                  value={mission.instructions}
                  onChange={(event) => {
                    const next = { ...mission, instructions: event.target.value };
                    setDrafts((current) => ({ ...current, [mission.id]: next }));
                    scheduleAutosave(next);
                  }}
                  className="rounded-lg border-2 border-black px-3 py-2"
                  placeholder="Task instructions"
                />
                <input
                  value={mission.imageUrl}
                  onChange={(event) => {
                    const next = { ...mission, imageUrl: event.target.value };
                    setDrafts((current) => ({ ...current, [mission.id]: next }));
                    scheduleAutosave(next);
                  }}
                  className="rounded-lg border-2 border-black px-3 py-2"
                  placeholder="Image URL"
                />
                <input
                  type="number"
                  value={mission.powerValue}
                  onChange={(event) => {
                    const next = {
                      ...mission,
                      powerValue: Number(event.target.value),
                    };
                    setDrafts((current) => ({ ...current, [mission.id]: next }));
                    scheduleAutosave(next);
                  }}
                  className="rounded-lg border-2 border-black px-3 py-2"
                />
                <label className="inline-flex items-center gap-2 text-sm font-bold uppercase">
                  <input
                    type="checkbox"
                    checked={mission.isActive}
                    onChange={(event) => {
                      const next = {
                        ...mission,
                        isActive: event.target.checked,
                      };
                      setDrafts((current) => ({ ...current, [mission.id]: next }));
                      void persistMissionDraft(next);
                    }}
                  />
                  Active
                </label>
                <label className="inline-flex items-center gap-2 text-sm font-bold uppercase">
                  <input
                    type="checkbox"
                    checked={mission.recurringDaily}
                    onChange={(event) => {
                      const next = {
                        ...mission,
                        recurringDaily: event.target.checked,
                      };
                      setDrafts((current) => ({ ...current, [mission.id]: next }));
                      void persistMissionDraft(next);
                    }}
                  />
                  Daily
                </label>
                <span className="text-xs font-black uppercase text-[var(--hero-blue)]">
                  {savingByMission[mission.id] ? "Saving..." : "Autosave"}
                </span>
                <button
                  type="button"
                  onClick={() => void deleteMission(mission.id, mission.title)}
                  disabled={Boolean(deletingByMission[mission.id])}
                  className="rounded-lg border-2 border-black bg-[var(--hero-red)] px-3 py-1 text-xs font-black uppercase text-white disabled:opacity-60"
                >
                  {deletingByMission[mission.id] ? "Trashing..." : "Trash"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="comic-card p-4">
        <h2 className="text-xl font-black uppercase text-white">Trash</h2>
        <p className="mt-1 text-sm text-white/80">
          Deleted missions stay here until restored.
        </p>
        {dashboard.trashedMissions.length === 0 ? (
          <p className="mt-3 rounded-lg bg-white/15 px-3 py-2 text-sm font-bold uppercase text-white/90">
            Trash is empty.
          </p>
        ) : (
          <div className="mt-3 grid gap-3">
            {dashboard.trashedMissions.map((mission) => (
              <article
                key={mission.id}
                className="rounded-xl border-2 border-black bg-white p-3 text-black"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-lg font-black uppercase">{mission.title}</p>
                    <p className="text-sm">{mission.instructions}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void restoreMission(mission.id, mission.title)}
                    disabled={Boolean(restoringByMission[mission.id])}
                    className="rounded-lg border-2 border-black bg-[var(--hero-blue)] px-3 py-2 text-xs font-black uppercase text-white disabled:opacity-60"
                  >
                    {restoringByMission[mission.id] ? "Restoring..." : "Restore"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
