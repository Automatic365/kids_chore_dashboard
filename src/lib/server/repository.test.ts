import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: fromMock,
    rpc: rpcMock,
  }),
}));

function makeMaybeSingle(table: string) {
  if (table === "profiles") {
    return Promise.resolve({ data: { hero_name: "Captain Comet" }, error: null });
  }
  if (table === "rewards") {
    return Promise.resolve({ data: { title: "Hero Sticker" }, error: null });
  }
  return Promise.resolve({ data: null, error: null });
}

function makeFromChain(table: string) {
  return {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle() {
      return makeMaybeSingle(table);
    },
  };
}

describe("SupabaseRepository claim_reward_v1", () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    vi.resetModules();
    rpcMock.mockReset();
    fromMock.mockReset();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    fromMock.mockImplementation((table: string) => makeFromChain(table));
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRole;
  });

  it("maps concurrent claim outcomes from claim_reward_v1 without overdrawing", async () => {
    rpcMock
      .mockResolvedValueOnce({
        data: {
          claimed: true,
          insufficient_points: false,
          new_power_level: 5,
          reward: {
            id: "r1",
            title: "Hero Sticker",
            description: "A shiny sticker",
            point_cost: 25,
            is_active: true,
            sort_order: 1,
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          claimed: false,
          insufficient_points: true,
          new_power_level: 5,
          reward: {
            id: "r1",
            title: "Hero Sticker",
            description: "A shiny sticker",
            point_cost: 25,
            is_active: true,
            sort_order: 1,
          },
        },
        error: null,
      });

    const { getRepository } = await import("./repository");
    const repo = getRepository();

    const [first, second] = await Promise.all([
      repo.claimReward({ profileId: "captain-alpha", rewardId: "r1" }),
      repo.claimReward({ profileId: "captain-alpha", rewardId: "r1" }),
    ]);

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock).toHaveBeenNthCalledWith(
      1,
      "claim_reward_v1",
      expect.objectContaining({
        p_profile_id: "captain-alpha",
        p_reward_id: "r1",
        p_image_url: expect.any(String),
      }),
    );
    expect(rpcMock).toHaveBeenNthCalledWith(
      2,
      "claim_reward_v1",
      expect.objectContaining({
        p_profile_id: "captain-alpha",
        p_reward_id: "r1",
        p_image_url: expect.any(String),
      }),
    );

    const claimedStates = [first.claimed, second.claimed].sort();
    const insufficientStates = [first.insufficientPoints, second.insufficientPoints].sort();

    expect(claimedStates).toEqual([false, true]);
    expect(insufficientStates).toEqual([false, true]);
    expect(first.reward.id).toBe("r1");
    expect(second.reward.id).toBe("r1");
  });
});
