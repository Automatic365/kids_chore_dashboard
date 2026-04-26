import { z } from "zod";

import { AiProvider } from "@/lib/types/domain";

const generatedMissionSchema = z.object({
  title: z.string().min(2).max(120),
  instructions: z.string().min(1).max(280),
  powerValue: z.number().int().min(1).max(100),
  recurringDaily: z.boolean().default(true),
});

const generatedMissionBatchSchema = z.object({
  missions: z.array(generatedMissionSchema).min(1).max(30),
});

export type GeneratedMission = z.infer<typeof generatedMissionSchema>;

interface GenerateMissionParams {
  tasks: string[];
  profileName?: string;
  uiMode?: "text" | "picture";
  provider?: AiProvider;
}

const MISSION_PREFIXES = [
  "Operation",
  "Mission",
  "Power Patrol",
  "Hero Alert",
  "Squad Signal",
  "Mega Rescue",
] as const;

const ACTION_WORDS = [
  "Rescue",
  "Blast",
  "Shield",
  "Power",
  "Zoom",
  "Spark",
  "Guardian",
  "Turbo",
] as const;

function toTitleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeForComparison(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(operation|mission|power patrol|hero alert|squad signal|mega rescue)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildThemedTitle(task: string, index: number): string {
  const compact = task.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "Hero Mission";
  }

  const prefix = MISSION_PREFIXES[index % MISSION_PREFIXES.length];
  const actionWord = ACTION_WORDS[index % ACTION_WORDS.length];
  const max = 34;
  const clipped = compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
  return `${prefix}: ${actionWord} ${toTitleCase(clipped)}`;
}

function buildThemedInstructions(task: string): string {
  const compact = task.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "Complete this hero mission with speed, focus, and teamwork.";
  }

  const lower = compact.charAt(0).toLowerCase() + compact.slice(1);
  return `Hero job: ${lower}. Move fast, finish the task fully, and report back to Mission Command when it is done.`;
}

function enforceHeroTheme(task: string, mission: GeneratedMission, index: number): GeneratedMission {
  const normalizedTask = normalizeForComparison(task);
  const normalizedTitle = normalizeForComparison(mission.title);
  const normalizedInstructions = normalizeForComparison(mission.instructions);

  const titleTooLiteral =
    normalizedTitle === normalizedTask ||
    normalizedTitle === task.toLowerCase().trim();
  const instructionsTooLiteral =
    normalizedInstructions === normalizedTask ||
    normalizedInstructions === task.toLowerCase().trim();

  return {
    ...mission,
    title: titleTooLiteral ? buildThemedTitle(task, index) : mission.title,
    instructions: instructionsTooLiteral
      ? buildThemedInstructions(task)
      : mission.instructions,
  };
}

function fallbackMissions(tasks: string[]): GeneratedMission[] {
  return tasks.slice(0, 30).map((task, index) => ({
    title: buildThemedTitle(task, index),
    instructions: buildThemedInstructions(task),
    powerValue: 10,
    recurringDaily: true,
  }));
}

function extractOpenAiResponseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const maybeOutputText = (payload as { output_text?: unknown }).output_text;
  if (typeof maybeOutputText === "string") {
    return maybeOutputText;
  }

  const output = (payload as { output?: unknown[] }).output;
  if (!Array.isArray(output)) {
    return "";
  }

  const fragments: string[] = [];
  for (const item of output) {
    const content = (item as { content?: unknown[] }).content;
    if (!Array.isArray(content)) continue;

    for (const part of content) {
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") {
        fragments.push(text);
      }
    }
  }

  return fragments.join("\n");
}

function extractGeminiResponseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const candidates = (payload as { candidates?: unknown[] }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return "";
  }

  const first = candidates[0] as { content?: { parts?: unknown[] } };
  const parts = first.content?.parts;
  if (!Array.isArray(parts)) {
    return "";
  }

  const fragments: string[] = [];
  for (const part of parts) {
    const text = (part as { text?: unknown }).text;
    if (typeof text === "string") {
      fragments.push(text);
    }
  }

  return fragments.join("\n");
}

function buildPrompt(tasks: string[], profileName?: string, uiMode?: "text" | "picture") {
  return [
    "Convert household tasks into kid-friendly superhero missions.",
    "Every mission title must sound like a comic-book mission, not a restatement of the chore.",
    "Do not copy the task verbatim as the title.",
    "Make the title playful, superhero-themed, and 2-6 words long.",
    "Keep instructions concrete and easy for a parent to read aloud to a child.",
    "Return strict JSON with mission title and concise action instructions.",
    profileName ? `Target hero: ${profileName}.` : "",
    uiMode ? `UI mode: ${uiMode}.` : "",
    "Good example: task `empty the dishwasher` -> title `Mission: Kitchen Power-Up`, instructions `Take the clean dishes out of the dishwasher and put each one in its home.`",
    "Bad example: title `Empty the Dishwasher`.",
    "Tasks:",
    ...tasks.map((task, index) => `${index + 1}. ${task}`),
  ]
    .filter(Boolean)
    .join("\n");
}

async function requestOpenAiMissions(prompt: string): Promise<GeneratedMission[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "You write short, specific mission titles and instructions for young children. Output JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "mission_batch",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              missions: {
                type: "array",
                minItems: 1,
                maxItems: 30,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    title: { type: "string" },
                    instructions: { type: "string" },
                    powerValue: { type: "integer", minimum: 1, maximum: 100 },
                    recurringDaily: { type: "boolean" },
                  },
                  required: [
                    "title",
                    "instructions",
                    "powerValue",
                    "recurringDaily",
                  ],
                },
              },
            },
            required: ["missions"],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as unknown;
  const text = extractOpenAiResponseText(payload);
  if (!text) {
    return null;
  }

  const parsed = JSON.parse(text) as unknown;
  const validated = generatedMissionBatchSchema.parse(parsed);
  return validated.missions;
}

async function requestGeminiMissions(prompt: string): Promise<GeneratedMission[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: "You write short, specific mission titles and instructions for young children. Output JSON only.",
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as unknown;
  const text = extractGeminiResponseText(payload);
  if (!text) {
    return null;
  }

  const parsed = JSON.parse(text) as unknown;
  const validated = generatedMissionBatchSchema.parse(parsed);
  return validated.missions;
}

export async function generateMissionsFromTasks({
  tasks,
  profileName,
  uiMode,
  provider = "openai",
}: GenerateMissionParams): Promise<GeneratedMission[]> {
  const cleaned = tasks.map((task) => task.trim()).filter(Boolean);
  if (cleaned.length === 0) {
    return [];
  }

  const prompt = buildPrompt(cleaned, profileName, uiMode);

  try {
    const missions =
      provider === "gemini"
        ? await requestGeminiMissions(prompt)
        : await requestOpenAiMissions(prompt);

    if (missions) {
      return missions.map((mission, index) =>
        enforceHeroTheme(cleaned[index] ?? mission.title, mission, index),
      );
    }
  } catch {
    // Fall through to deterministic mission generation.
  }

  return fallbackMissions(cleaned);
}
