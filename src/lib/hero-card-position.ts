import { HeroCardObjectPosition } from "@/lib/types/domain";

export const HERO_CARD_OBJECT_POSITION_CSS: Record<HeroCardObjectPosition, string> = {
  "top-left": "0% 0%",
  "top-center": "50% 0%",
  "top-right": "100% 0%",
  "center-left": "0% 50%",
  center: "50% 50%",
  "center-right": "100% 50%",
  "bottom-left": "0% 100%",
  "bottom-center": "50% 100%",
  "bottom-right": "100% 100%",
};

export function toHeroCardObjectPosition(
  value: string | null | undefined,
): HeroCardObjectPosition {
  if (!value) return "center";
  if (value in HERO_CARD_OBJECT_POSITION_CSS) {
    return value as HeroCardObjectPosition;
  }
  return "center";
}

export function heroCardPositionToCssObjectPosition(
  value: HeroCardObjectPosition | null | undefined,
): string {
  const normalized = toHeroCardObjectPosition(value);
  return HERO_CARD_OBJECT_POSITION_CSS[normalized];
}
