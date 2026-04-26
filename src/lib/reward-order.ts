import { Reward } from "@/lib/types/domain";

export function compareRewardsByCost(a: Reward, b: Reward): number {
  if (a.pointCost !== b.pointCost) {
    return a.pointCost - b.pointCost;
  }
  if (a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder;
  }
  return a.title.localeCompare(b.title);
}
