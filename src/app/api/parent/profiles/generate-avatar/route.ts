import { NextResponse } from "next/server";

import { isParentAuthenticated } from "@/lib/server/auth";
import { generateAvatarSchema } from "@/lib/server/schemas";

const EMOJI_FALLBACKS = [
  "🦸",
  "🦸‍♀️",
  "🛡️",
  "⚡",
  "🌟",
  "🔥",
  "🚀",
  "🧠",
  "🦁",
  "🐯",
  "🐼",
  "🐙",
  "🦊",
  "🐲",
  "🛰️",
  "🎯",
  "🎨",
  "🏆",
  "💥",
  "🌈",
];

function fallbackEmoji(heroName: string): string {
  const first = heroName.trim().charCodeAt(0);
  const index = Number.isFinite(first)
    ? Math.abs(first) % EMOJI_FALLBACKS.length
    : 0;
  return EMOJI_FALLBACKS[index];
}

async function generateOpenAiAvatar(heroName: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: `Create a kid-safe, colorful superhero avatar portrait icon for "${heroName}". Plain background, no text.`,
      size: "1024x1024",
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const image = payload.data?.[0];
  if (!image) {
    return null;
  }

  if (image.b64_json) {
    return `data:image/png;base64,${image.b64_json}`;
  }

  if (!image.url) {
    return null;
  }

  const imageResponse = await fetch(image.url);
  if (!imageResponse.ok) {
    return null;
  }

  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  const contentType = imageResponse.headers.get("content-type") ?? "image/png";
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

export async function POST(request: Request) {
  if (!(await isParentAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = generateAvatarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const avatarDataUrl =
      (await generateOpenAiAvatar(parsed.data.heroName)) ??
      fallbackEmoji(parsed.data.heroName);
    return NextResponse.json({ avatarDataUrl });
  } catch {
    return NextResponse.json({
      avatarDataUrl: fallbackEmoji(parsed.data.heroName),
    });
  }
}
