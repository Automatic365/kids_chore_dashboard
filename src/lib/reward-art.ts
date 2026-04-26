import { RewardStickerType } from "@/lib/types/domain";

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pick<T>(items: readonly T[], seed: number): T {
  return items[seed % items.length] as T;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type StickerConcept = {
  id: string;
  label: string;
  accent: string;
};

const VEHICLE_CONCEPTS: readonly StickerConcept[] = [
  { id: "jet", label: "Sky Jet", accent: "wings" },
  { id: "hover-bike", label: "Hover Bike", accent: "thrusters" },
  { id: "rocket-kart", label: "Rocket Kart", accent: "boost" },
  { id: "rescue-truck", label: "Rescue Truck", accent: "sirens" },
  { id: "speed-boat", label: "Speed Boat", accent: "waves" },
  { id: "mech-rover", label: "Mech Rover", accent: "gears" },
] as const;

const COMPANION_CONCEPTS: readonly StickerConcept[] = [
  { id: "robo-pup", label: "Robo Pup", accent: "spark" },
  { id: "astro-owl", label: "Astro Owl", accent: "stars" },
  { id: "shield-bear", label: "Shield Bear", accent: "badge" },
  { id: "lightning-fox", label: "Lightning Fox", accent: "bolts" },
  { id: "guardian-bot", label: "Guardian Bot", accent: "beams" },
  { id: "comet-dragon", label: "Comet Dragon", accent: "trail" },
] as const;

const STICKER_CONCEPTS: Record<RewardStickerType, readonly StickerConcept[]> = {
  vehicle: VEHICLE_CONCEPTS,
  companion: COMPANION_CONCEPTS,
};

const STICKER_TYPE_ORDER: readonly RewardStickerType[] = ["vehicle", "companion"];

type HeroPalette = {
  panel: string;
  glow: string;
  accent: string;
  accentSoft: string;
  ink: string;
};

const HERO_PALETTES: readonly HeroPalette[] = [
  {
    panel: "#102a83",
    glow: "#3b82f6",
    accent: "#facc15",
    accentSoft: "#fef08a",
    ink: "#111827",
  },
  {
    panel: "#7f1d1d",
    glow: "#ef4444",
    accent: "#f59e0b",
    accentSoft: "#fdba74",
    ink: "#111827",
  },
  {
    panel: "#14532d",
    glow: "#22c55e",
    accent: "#facc15",
    accentSoft: "#bbf7d0",
    ink: "#0f172a",
  },
  {
    panel: "#581c87",
    glow: "#a855f7",
    accent: "#f472b6",
    accentSoft: "#f5d0fe",
    ink: "#111827",
  },
  {
    panel: "#0f766e",
    glow: "#14b8a6",
    accent: "#facc15",
    accentSoft: "#99f6e4",
    ink: "#0f172a",
  },
] as const;

export type StickerSelection = {
  stickerType: RewardStickerType;
  stickerConceptId: string;
  stickerPromptSeed: string;
};

export function isStickerReward(params: {
  rewardTitle: string;
  rewardDescription?: string | null;
}): boolean {
  const haystack = normalize(
    `${params.rewardTitle} ${params.rewardDescription ?? ""}`,
  );
  if (!haystack) {
    return false;
  }

  return haystack.includes("sticker");
}

function getHeroPalette(heroName: string): HeroPalette {
  return pick(HERO_PALETTES, hashString(heroName));
}

function getHeroVibe(heroName: string): string {
  const words = normalize(heroName).split(" ").filter(Boolean);
  const vibeSeeds = [
    "cosmic",
    "speedy",
    "rescue-ready",
    "thunder-charged",
    "shield-strong",
    "sky-patrol",
  ];
  if (words.length === 0) {
    return vibeSeeds[0]!;
  }
  return pick(vibeSeeds, hashString(words.join("|")));
}

function getConcepts(type: RewardStickerType): readonly StickerConcept[] {
  return STICKER_CONCEPTS[type];
}

function getUnusedConcept(
  type: RewardStickerType,
  existingStickerConceptIds: Set<string>,
  seed: number,
): StickerConcept | null {
  const concepts = getConcepts(type);
  const unused = concepts.filter((concept) => !existingStickerConceptIds.has(concept.id));
  if (unused.length === 0) {
    return null;
  }
  return pick(unused, seed);
}

export function selectStickerConcept(params: {
  heroName: string;
  claimedAt: string;
  existingStickerConceptIds?: string[];
}): StickerSelection {
  const existingStickerConceptIds = new Set(params.existingStickerConceptIds ?? []);
  const seed = hashString(`${params.heroName}|${params.claimedAt}`);
  const preferredType = pick(STICKER_TYPE_ORDER, seed);
  const alternateType = preferredType === "vehicle" ? "companion" : "vehicle";

  let stickerType = preferredType;
  const candidate =
    getUnusedConcept(preferredType, existingStickerConceptIds, seed + 11) ??
    getUnusedConcept(alternateType, existingStickerConceptIds, seed + 23);
  let concept: StickerConcept;

  if (!candidate) {
    stickerType = preferredType;
    concept = pick(getConcepts(preferredType), seed + 31);
  } else {
    concept = candidate;
    if (!getConcepts(preferredType).some((item) => item.id === concept.id)) {
      stickerType = alternateType;
    }
  }

  return {
    stickerType,
    stickerConceptId: concept.id,
    stickerPromptSeed: `${getHeroVibe(params.heroName)}:${stickerType}:${concept.id}`,
  };
}

function getConcept(type: RewardStickerType, conceptId: string): StickerConcept {
  return (
    getConcepts(type).find((concept) => concept.id === conceptId) ??
    getConcepts(type)[0]!
  );
}

function renderConceptPattern(params: {
  concept: StickerConcept;
  palette: HeroPalette;
  stickerType: RewardStickerType;
}): string {
  const { concept, palette, stickerType } = params;
  const soft = palette.accentSoft;
  const bright = palette.glow;
  const accent = palette.accent;

  switch (concept.id) {
    case "jet":
      return `<path d="M24 170L86 120" stroke="${soft}" stroke-width="10" stroke-linecap="round" opacity="0.7" />
<path d="M140 104L204 48" stroke="${soft}" stroke-width="10" stroke-linecap="round" opacity="0.7" />
<path d="M26 196L78 150" stroke="${bright}" stroke-width="6" stroke-linecap="round" opacity="0.8" />`;
    case "hover-bike":
      return `<ellipse cx="70" cy="170" rx="44" ry="18" fill="none" stroke="${bright}" stroke-width="8" opacity="0.6" />
<ellipse cx="184" cy="170" rx="40" ry="16" fill="none" stroke="${soft}" stroke-width="8" opacity="0.6" />
<path d="M38 104C72 88 106 88 140 104" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" opacity="0.7" />`;
    case "rocket-kart":
      return `<circle cx="52" cy="76" r="14" fill="${accent}" opacity="0.7" />
<circle cx="74" cy="52" r="9" fill="${soft}" opacity="0.75" />
<path d="M176 78L206 112L176 146" fill="none" stroke="${bright}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity="0.75" />`;
    case "rescue-truck":
      return `<path d="M34 64H188" stroke="${accent}" stroke-width="10" stroke-linecap="round" opacity="0.7" />
<path d="M34 84H176" stroke="${soft}" stroke-width="8" stroke-linecap="round" opacity="0.55" />
<circle cx="190" cy="64" r="12" fill="${bright}" opacity="0.8" />`;
    case "speed-boat":
      return `<path d="M28 198C50 184 74 182 100 192C126 202 152 204 192 190" fill="none" stroke="${soft}" stroke-width="10" stroke-linecap="round" opacity="0.7" />
<path d="M38 214C64 204 88 204 116 212C144 220 168 220 196 208" fill="none" stroke="${bright}" stroke-width="8" stroke-linecap="round" opacity="0.75" />`;
    case "mech-rover":
      return `<circle cx="58" cy="70" r="22" fill="none" stroke="${accent}" stroke-width="8" opacity="0.75" />
<circle cx="58" cy="70" r="10" fill="none" stroke="${soft}" stroke-width="6" opacity="0.75" />
<path d="M164 52L196 84L164 116L132 84Z" fill="none" stroke="${bright}" stroke-width="8" opacity="0.7" />`;
    case "robo-pup":
      return `<circle cx="52" cy="74" r="10" fill="${soft}" opacity="0.8" />
<circle cx="74" cy="60" r="8" fill="${soft}" opacity="0.7" />
<circle cx="94" cy="74" r="10" fill="${soft}" opacity="0.8" />
<path d="M154 196C166 184 182 180 198 182" fill="none" stroke="${bright}" stroke-width="8" stroke-linecap="round" opacity="0.75" />`;
    case "astro-owl":
      return `<circle cx="54" cy="64" r="8" fill="${soft}" opacity="0.9" />
<circle cx="84" cy="42" r="6" fill="${soft}" opacity="0.85" />
<circle cx="186" cy="58" r="10" fill="${bright}" opacity="0.8" />
<path d="M36 196L64 170L92 196" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" opacity="0.75" />`;
    case "shield-bear":
      return `<path d="M48 62L78 78V100C78 118 64 132 48 140C32 132 18 118 18 100V78Z" fill="${soft}" opacity="0.55" />
<path d="M172 58L194 80L172 102L150 80Z" fill="none" stroke="${bright}" stroke-width="8" opacity="0.7" />
<path d="M144 198H200" stroke="${accent}" stroke-width="10" stroke-linecap="round" opacity="0.75" />`;
    case "lightning-fox":
      return `<path d="M34 70L60 46L54 74L82 62L58 98L64 74Z" fill="${bright}" opacity="0.85" />
<path d="M168 46L192 78L166 74L182 104L150 72L170 72Z" fill="${soft}" opacity="0.8" />`;
    case "guardian-bot":
      return `<path d="M36 60H88" stroke="${bright}" stroke-width="10" stroke-linecap="round" opacity="0.75" />
<path d="M36 82H74" stroke="${soft}" stroke-width="8" stroke-linecap="round" opacity="0.75" />
<circle cx="188" cy="72" r="18" fill="none" stroke="${accent}" stroke-width="8" opacity="0.7" />`;
    case "comet-dragon":
      return `<path d="M30 80C58 34 108 22 174 38" fill="none" stroke="${bright}" stroke-width="10" stroke-linecap="round" opacity="0.75" />
<circle cx="176" cy="38" r="12" fill="${soft}" opacity="0.85" />
<path d="M154 188C172 180 190 182 206 194" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" opacity="0.7" />`;
    default:
      return stickerType === "vehicle"
        ? `<path d="M28 184L196 56" stroke="${soft}" stroke-width="8" stroke-linecap="round" opacity="0.65" />`
        : `<circle cx="56" cy="64" r="16" fill="${soft}" opacity="0.7" />`;
  }
}

function renderVehicleIllustration(params: {
  conceptId: string;
  palette: HeroPalette;
}): string {
  const { conceptId, palette } = params;
  const common = `fill="${palette.accent}" stroke="${palette.ink}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"`;
  const glow = `fill="${palette.glow}" stroke="${palette.ink}" stroke-width="6"`;

  switch (conceptId) {
    case "hover-bike":
      return `<ellipse cx="72" cy="164" rx="32" ry="14" ${glow} />
<ellipse cx="184" cy="164" rx="32" ry="14" ${glow} />
<path d="M56 144H164L188 118H126L96 92L72 118H52Z" ${common} />
<circle cx="104" cy="118" r="16" fill="${palette.accentSoft}" stroke="${palette.ink}" stroke-width="6" />
<path d="M180 110L212 98L196 132Z" fill="${palette.glow}" stroke="${palette.ink}" stroke-width="6" />`;
    case "rocket-kart":
      return `<rect x="54" y="112" width="112" height="56" rx="20" ${common} />
<circle cx="82" cy="176" r="20" ${glow} />
<circle cx="150" cy="176" r="20" ${glow} />
<path d="M166 124L212 140L166 156Z" fill="${palette.glow}" stroke="${palette.ink}" stroke-width="6" />
<path d="M94 104H140V128H94Z" fill="${palette.accentSoft}" stroke="${palette.ink}" stroke-width="6" />`;
    case "rescue-truck":
      return `<rect x="42" y="104" width="128" height="68" rx="18" ${common} />
<path d="M170 124H208L220 150H170Z" fill="${palette.glow}" stroke="${palette.ink}" stroke-width="6" />
<circle cx="82" cy="182" r="22" ${glow} />
<circle cx="170" cy="182" r="22" ${glow} />
<path d="M72 120H138" stroke="${palette.ink}" stroke-width="8" />
<path d="M105 102V138" stroke="${palette.ink}" stroke-width="8" />`;
    case "speed-boat":
      return `<path d="M38 148H214L176 186H72Z" ${common} />
<path d="M114 78V148" stroke="${palette.ink}" stroke-width="8" />
<path d="M114 86L170 122H114Z" fill="${palette.glow}" stroke="${palette.ink}" stroke-width="6" />
<path d="M72 194C88 210 108 218 132 218C156 218 176 210 192 194" fill="none" stroke="${palette.accentSoft}" stroke-width="8" stroke-linecap="round" />`;
    case "mech-rover":
      return `<rect x="64" y="96" width="96" height="68" rx="18" ${common} />
<path d="M80 164L64 202" stroke="${palette.ink}" stroke-width="8" />
<path d="M144 164L160 202" stroke="${palette.ink}" stroke-width="8" />
<path d="M84 202H52" stroke="${palette.ink}" stroke-width="8" />
<path d="M140 202H172" stroke="${palette.ink}" stroke-width="8" />
<circle cx="96" cy="126" r="12" ${glow} />
<circle cx="128" cy="126" r="12" ${glow} />`;
    case "jet":
    default:
      return `<path d="M34 146L118 118L192 72L208 96L152 132L208 142L186 164L138 156L112 204L92 194L100 152L50 170Z" ${common} />
<path d="M146 108L196 92L180 118Z" fill="${palette.glow}" stroke="${palette.ink}" stroke-width="6" />
<circle cx="120" cy="132" r="14" fill="${palette.accentSoft}" stroke="${palette.ink}" stroke-width="6" />`;
  }
}

function renderCompanionIllustration(params: {
  conceptId: string;
  palette: HeroPalette;
}): string {
  const { conceptId, palette } = params;
  const common = `fill="${palette.accent}" stroke="${palette.ink}" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"`;
  const glow = `fill="${palette.glow}" stroke="${palette.ink}" stroke-width="6"`;

  switch (conceptId) {
    case "astro-owl":
      return `<circle cx="112" cy="110" r="42" ${common} />
<path d="M68 136L40 176L92 160Z" ${common} />
<path d="M156 136L184 176L132 160Z" ${common} />
<circle cx="94" cy="106" r="12" ${glow} />
<circle cx="130" cy="106" r="12" ${glow} />
<path d="M104 128H120L112 142Z" fill="${palette.accentSoft}" stroke="${palette.ink}" stroke-width="5" />`;
    case "shield-bear":
      return `<circle cx="112" cy="110" r="46" ${common} />
<circle cx="88" cy="88" r="16" ${common} />
<circle cx="136" cy="88" r="16" ${common} />
<path d="M112 136L150 154V184C150 208 130 226 112 236C94 226 74 208 74 184V154Z" ${glow} />
<path d="M100 178H124" stroke="${palette.ink}" stroke-width="8" />
<path d="M112 166V190" stroke="${palette.ink}" stroke-width="8" />`;
    case "lightning-fox":
      return `<path d="M66 142L42 98L88 110L112 76L136 110L182 98L158 142L180 176L134 170L112 206L90 170L44 176Z" ${common} />
<circle cx="86" cy="124" r="10" ${glow} />
<circle cx="138" cy="124" r="10" ${glow} />
<path d="M112 146L132 186L102 176L120 214L90 178L110 180Z" fill="${palette.accentSoft}" stroke="${palette.ink}" stroke-width="5" />`;
    case "guardian-bot":
      return `<rect x="66" y="82" width="92" height="100" rx="24" ${common} />
<circle cx="94" cy="116" r="12" ${glow} />
<circle cx="130" cy="116" r="12" ${glow} />
<path d="M82 82L76 56" stroke="${palette.ink}" stroke-width="8" />
<path d="M142 82L148 56" stroke="${palette.ink}" stroke-width="8" />
<path d="M88 164H136" stroke="${palette.ink}" stroke-width="8" />
<path d="M90 182L74 216" stroke="${palette.ink}" stroke-width="8" />
<path d="M134 182L150 216" stroke="${palette.ink}" stroke-width="8" />`;
    case "comet-dragon":
      return `<path d="M48 162C62 108 108 78 154 90C188 98 210 126 202 162C194 196 160 218 126 210L104 236L94 202C62 198 40 184 48 162Z" ${common} />
<path d="M126 86L164 44L156 94Z" fill="${palette.glow}" stroke="${palette.ink}" stroke-width="6" />
<circle cx="102" cy="140" r="12" ${glow} />
<path d="M132 164C148 170 162 182 174 198" fill="none" stroke="${palette.accentSoft}" stroke-width="8" stroke-linecap="round" />`;
    case "robo-pup":
    default:
      return `<circle cx="112" cy="122" r="50" ${common} />
<path d="M74 92L56 54L94 74Z" ${common} />
<path d="M150 92L168 54L130 74Z" ${common} />
<circle cx="94" cy="120" r="10" ${glow} />
<circle cx="130" cy="120" r="10" ${glow} />
<path d="M96 150C104 158 120 158 128 150" fill="none" stroke="${palette.ink}" stroke-width="8" stroke-linecap="round" />`;
  }
}

function renderBackdrop(params: {
  heroName: string;
  selection: StickerSelection;
  palette: HeroPalette;
}): string {
  const concept = getConcept(params.selection.stickerType, params.selection.stickerConceptId);
  const bannerFill = params.selection.stickerType === "vehicle" ? params.palette.glow : params.palette.accent;
  const bannerAccent =
    params.selection.stickerType === "vehicle" ? params.palette.accentSoft : params.palette.glow;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="260" viewBox="0 0 220 260">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${params.palette.panel}" />
      <stop offset="100%" stop-color="${params.palette.glow}" />
    </linearGradient>
  </defs>
  <rect x="6" y="6" rx="28" ry="28" width="208" height="248" fill="url(#g)" stroke="${params.palette.ink}" stroke-width="8" />
  ${renderConceptPattern({
    concept,
    palette: params.palette,
    stickerType: params.selection.stickerType,
  })}
  <path d="M28 64L84 28H192L144 64Z" fill="${bannerFill}" opacity="0.92" />
  <path d="M22 214L68 192H176L128 228Z" fill="${bannerAccent}" opacity="0.82" />
  <circle cx="52" cy="52" r="10" fill="${params.palette.accentSoft}" />
  <circle cx="188" cy="184" r="12" fill="${params.palette.accentSoft}" />
  <circle cx="166" cy="48" r="6" fill="${params.palette.accent}" />
  ${params.selection.stickerType === "vehicle"
    ? renderVehicleIllustration({
        conceptId: concept.id,
        palette: params.palette,
      })
    : renderCompanionIllustration({
        conceptId: concept.id,
        palette: params.palette,
      })}
  <rect x="26" y="18" width="168" height="28" rx="14" fill="rgba(255,255,255,0.18)" />
  <text x="110" y="37" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="11" fill="#ffffff">${escapeXml(params.heroName.slice(0, 20).toUpperCase())}</text>
</svg>`;
}

function generateLegacyRewardStickerDataUrl(params: {
  rewardTitle: string;
  heroName: string;
  claimedAt: string;
}): string {
  const seed = hashString(`${params.rewardTitle}|${params.heroName}|${params.claimedAt}`);
  const bgA = pick(["#1d4ed8", "#dc2626", "#f59e0b", "#16a34a"], seed);
  const bgB = pick(["#60a5fa", "#fb7185", "#fde047", "#4ade80"], seed + 7);
  const badge = pick(["HERO", "WOW", "POW", "ZAP", "WIN"], seed + 13);
  const shape = pick(["star", "burst", "shield"], seed + 19);

  const icon =
    shape === "star"
      ? '<polygon points="110,15 135,75 200,80 150,122 165,185 110,150 55,185 70,122 20,80 85,75" fill="#fef08a" stroke="#111" stroke-width="6" />'
      : shape === "burst"
        ? '<path d="M110 15L130 55L175 38L165 85L210 90L180 120L210 150L165 155L175 202L130 185L110 225L90 185L45 202L55 155L10 150L40 120L10 90L55 85L45 38L90 55Z" fill="#fef08a" stroke="#111" stroke-width="6" />'
        : '<path d="M110 18L192 48V116C192 168 152 206 110 224C68 206 28 168 28 116V48Z" fill="#fef08a" stroke="#111" stroke-width="6" />';

  const title = params.rewardTitle.slice(0, 28).toUpperCase();
  const hero = params.heroName.slice(0, 20).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="260" viewBox="0 0 220 260">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bgA}" />
      <stop offset="100%" stop-color="${bgB}" />
    </linearGradient>
  </defs>
  <rect x="6" y="6" rx="24" ry="24" width="208" height="248" fill="url(#g)" stroke="#111" stroke-width="8"/>
  ${icon}
  <text x="110" y="134" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="24" fill="#111">${badge}</text>
  <rect x="20" y="186" width="180" height="54" rx="12" ry="12" fill="rgba(255,255,255,0.92)" stroke="#111" stroke-width="4"/>
  <text x="110" y="208" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="12" fill="#111">${escapeXml(title)}</text>
  <text x="110" y="226" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="10" fill="#111">${escapeXml(hero)}</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function buildStickerPrompt(params: {
  rewardTitle: string;
  rewardDescription?: string | null;
  heroName: string;
  selection: StickerSelection;
}): string {
  const concept = getConcept(params.selection.stickerType, params.selection.stickerConceptId);
  const palette = getHeroPalette(params.heroName);
  const roleDescription =
    params.selection.stickerType === "vehicle"
      ? `a superhero vehicle sticker featuring a ${concept.label.toLowerCase()}`
      : `a sidekick hero companion sticker featuring a ${concept.label.toLowerCase()}`;

  return [
    `Create a single collectible children's sticker for hero "${params.heroName}".`,
    `Draw ${roleDescription} with comic-book energy and a centered composition.`,
    `The design must feel unique to this hero, with bold colors inspired by ${palette.glow} and ${palette.accent}.`,
    `Use a ${getHeroVibe(params.heroName)} vibe and strong silhouette readability at small sizes.`,
    `Reward context: "${params.rewardTitle}".`,
    params.rewardDescription ? `Optional reward context: "${params.rewardDescription}".` : "",
    `Concept seed: ${params.selection.stickerPromptSeed}.`,
    "Kid-safe only. No text, no letters, no numbers, no captions, no watermark, no background scene clutter.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function generateRewardStickerDataUrl(params: {
  rewardTitle: string;
  heroName: string;
  claimedAt: string;
  stickerType?: RewardStickerType;
  stickerConceptId?: string | null;
  stickerPromptSeed?: string | null;
  existingStickerConceptIds?: string[];
}): string {
  if (!params.stickerType || !params.stickerConceptId) {
    return generateLegacyRewardStickerDataUrl({
      rewardTitle: params.rewardTitle,
      heroName: params.heroName,
      claimedAt: params.claimedAt,
    });
  }
  const selection = {
    stickerType: params.stickerType,
    stickerConceptId: params.stickerConceptId,
    stickerPromptSeed:
      params.stickerPromptSeed ??
      `${getHeroVibe(params.heroName)}:${params.stickerType}:${params.stickerConceptId}`,
  };
  const svg = renderBackdrop({
    heroName: params.heroName,
    selection,
    palette: getHeroPalette(params.heroName),
  });
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function getStickerConceptCatalog(): Record<RewardStickerType, readonly StickerConcept[]> {
  return STICKER_CONCEPTS;
}
