function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pick<T>(items: T[], seed: number): T {
  return items[seed % items.length] as T;
}

export function generateRewardStickerDataUrl(params: {
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
  <text x="110" y="208" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="12" fill="#111">${title}</text>
  <text x="110" y="226" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="10" fill="#111">${hero}</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
