"use client";

import { useCallback, useEffect, useState } from "react";

import { createMission as createMissionRequest } from "@/lib/client-api";
import { AiProvider, Profile } from "@/lib/types/domain";

interface GeneratedMissionDraft {
  title: string;
  instructions: string;
  powerValue: number;
  recurringDaily: boolean;
}

interface AiGeneratorSectionProps {
  profiles: Profile[];
  onRefresh: () => Promise<void>;
  pushToast: (type: "success" | "error", text: string) => void;
}

export function AiGeneratorSection({ profiles, onRefresh, pushToast }: AiGeneratorSectionProps) {
  const [aiTaskList, setAiTaskList] = useState("");
  const [aiProfileId, setAiProfileId] = useState("");
  const [aiProvider, setAiProvider] = useState<AiProvider>("openai");
  const [aiParentPin, setAiParentPin] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<GeneratedMissionDraft[]>([]);

  useEffect(() => {
    if (!aiProfileId && profiles.length > 0) {
      setAiProfileId(profiles[0].id);
    }
  }, [aiProfileId, profiles]);

  const generateAiSuggestions = useCallback(async () => {
    const tasks = aiTaskList
      .split(/\n|,/)
      .map((t) => t.trim())
      .filter(Boolean);

    if (tasks.length === 0) {
      setAiError("Add at least one task to generate missions.");
      return;
    }

    const profile = profiles.find((p) => p.id === aiProfileId);
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

      const data = (await response.json()) as { missions: GeneratedMissionDraft[] };
      setAiSuggestions(data.missions ?? []);
      pushToast("success", `Generated ${data.missions?.length ?? 0} mission suggestions.`);
    } catch {
      setAiError("AI generation failed.");
      pushToast("error", "AI generation failed.");
    } finally {
      setAiGenerating(false);
    }
  }, [aiParentPin, aiProfileId, aiProvider, aiTaskList, profiles, pushToast]);

  const addSuggestion = useCallback(
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
      await onRefresh();
    },
    [aiProfileId, onRefresh, pushToast],
  );

  const addAllSuggestions = useCallback(async () => {
    if (!aiProfileId || aiSuggestions.length === 0) return;
    await Promise.all(
      aiSuggestions.map((s) =>
        createMissionRequest({
          profileId: aiProfileId,
          title: s.title,
          instructions: s.instructions,
          powerValue: s.powerValue,
          recurringDaily: s.recurringDaily,
          isActive: true,
        }),
      ),
    );
    pushToast("success", `Added ${aiSuggestions.length} missions.`);
    setAiSuggestions([]);
    await onRefresh();
  }, [aiProfileId, aiSuggestions, onRefresh, pushToast]);

  return (
    <section className="comic-card p-4">
      <h2 className="text-xl font-black uppercase text-white">AI Mission Generator</h2>
      <p className="mt-1 text-sm text-white/80">
        Paste tasks and generate mission names + clear instructions.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select
          value={aiProfileId}
          onChange={(e) => setAiProfileId(e.target.value)}
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
        >
          <option value="">Choose Hero</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.heroName}
            </option>
          ))}
        </select>
        <input
          value={aiParentPin}
          onChange={(e) => setAiParentPin(e.target.value)}
          type="password"
          inputMode="numeric"
          placeholder="Parent PIN (needed in local mode)"
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
        />
        <select
          value={aiProvider}
          onChange={(e) => setAiProvider(e.target.value as AiProvider)}
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
        >
          <option value="openai">OpenAI</option>
          <option value="gemini">Gemini</option>
        </select>
        <textarea
          value={aiTaskList}
          onChange={(e) => setAiTaskList(e.target.value)}
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
              onClick={() => void addAllSuggestions()}
              className="rounded-lg border-2 border-black bg-white px-3 py-1 text-xs font-black uppercase text-black"
            >
              Add All
            </button>
          </div>
          {aiSuggestions.map((s, i) => (
            <article
              key={`${s.title}-${i}`}
              className="rounded-xl border-2 border-black bg-white p-3 text-black"
            >
              <p className="text-lg font-black uppercase">{s.title}</p>
              <p className="mt-1 text-sm">{s.instructions}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold uppercase">
                <span className="rounded-full bg-[var(--hero-yellow)] px-2 py-1">
                  +{s.powerValue} Power
                </span>
                <span className="rounded-full bg-zinc-200 px-2 py-1">
                  {s.recurringDaily ? "Daily" : "One-Time"}
                </span>
                <button
                  type="button"
                  onClick={() => void addSuggestion(s)}
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
  );
}
