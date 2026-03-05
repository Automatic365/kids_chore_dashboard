"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  claimReward,
  completeMission,
  fetchMissionHistory,
  fetchMissions,
  fetchProfiles,
  fetchRewardClaims,
  fetchRewards,
  fetchSquadState,
  isRemoteApiEnabled,
  loginParent,
  returnReward,
  uncompleteMission,
} from "@/lib/client-api";
import {
  enqueueCompletion,
  flushCompletionQueue,
  CompletionQueueItem,
  removeQueuedCompletionsForMission,
} from "@/lib/offline/queue";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AvatarDisplay } from "@/components/avatar-display";
import {
  MissionHistoryEntry,
  MissionWithState,
  Profile,
  Reward,
  RewardClaimEntry,
  SquadState,
} from "@/lib/types/domain";
import { getHeroLevel, getStreakBadge } from "@/lib/hero-levels";

interface MissionBoardProps {
  profileId: string;
}

const SECRET_HERO_CODE_THRESHOLD = 60;
const SECRET_HERO_CODE_VALUE = "COMET-77";

const STAR_COLORS = [
  "var(--hero-yellow)",
  "var(--hero-red)",
  "#fff",
  "var(--hero-blue)",
  "#ff9f43",
];

const STARS = Array.from({ length: 28 }, (_, i) => {
  const angle = (i / 28) * 360;
  const dist = 120 + Math.random() * 160;
  const tx = Math.cos((angle * Math.PI) / 180) * dist;
  const ty = Math.sin((angle * Math.PI) / 180) * dist - 60;
  return {
    key: i,
    color: STAR_COLORS[i % STAR_COLORS.length],
    tx,
    ty,
    delay: (i * 0.04).toFixed(2),
    duration: (1.4 + Math.random() * 0.8).toFixed(2),
  };
});

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function playSuccessSound(): void {
  if (typeof window === "undefined") return;

  const audioContext = new window.AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.value = 880;
  gain.gain.value = 0.02;

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.12);
}

export function MissionBoard({ profileId }: MissionBoardProps) {
  const remoteEnabled = isRemoteApiEnabled();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [missions, setMissions] = useState<MissionWithState[]>([]);
  const [squad, setSquad] = useState<SquadState | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rewardClaims, setRewardClaims] = useState<RewardClaimEntry[]>([]);
  const [history, setHistory] = useState<MissionHistoryEntry[]>([]);
  const [showTrophyCase, setShowTrophyCase] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [effectText, setEffectText] = useState<string | null>(null);
  const [showPinGate, setShowPinGate] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [isPressingParentSpot, setIsPressingParentSpot] = useState(false);
  const [returningClaimById, setReturningClaimById] = useState<Record<string, boolean>>({});
  const [showSquadWin, setShowSquadWin] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const completedCount = useMemo(
    () => missions.filter((mission) => mission.completedToday).length,
    [missions],
  );

  const personalProgress = useMemo(() => {
    if (missions.length === 0) return 0;
    return Math.round((completedCount / missions.length) * 100);
  }, [completedCount, missions.length]);

  const heroLevel = useMemo(
    () => (profile ? getHeroLevel(profile.powerLevel) : null),
    [profile],
  );

  const claimedRewardIds = useMemo(
    () => new Set(rewardClaims.map((claim) => claim.rewardId)),
    [rewardClaims],
  );

  const loadBoard = useCallback(async () => {
    try {
      setLoading(true);
      const [profiles, missionRows, squadState, rewardRows, rewardClaimRows, historyRows] =
        await Promise.all([
        fetchProfiles(),
        fetchMissions(profileId),
        fetchSquadState(),
        fetchRewards(),
        fetchRewardClaims(profileId),
        fetchMissionHistory(profileId, 7),
      ]);

      const activeProfile = profiles.find((item) => item.id === profileId) ?? null;
      setProfile(activeProfile);
      setMissions(missionRows);
      setSquad(squadState);
      setRewards(rewardRows);
      setRewardClaims(rewardClaimRows);
      setHistory(historyRows);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load board";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  const syncOfflineQueue = useCallback(async () => {
    if (!remoteEnabled) {
      return;
    }

    await flushCompletionQueue(async (item: CompletionQueueItem) => {
      await completeMission({
        missionId: item.missionId,
        profileId: item.profileId,
        clientRequestId: item.clientRequestId,
        clientCompletedAt: item.clientCompletedAt,
      });
    });

    await loadBoard();
  }, [loadBoard, remoteEnabled]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    if (!remoteEnabled) {
      return;
    }

    void syncOfflineQueue();

    const handleOnline = () => {
      void syncOfflineQueue();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [syncOfflineQueue, remoteEnabled]);

  useEffect(() => {
    if (!remoteEnabled) {
      const timer = window.setInterval(() => {
        void loadBoard();
      }, 8000);
      return () => window.clearInterval(timer);
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      const timer = window.setInterval(() => {
        void loadBoard();
      }, 8000);
      return () => window.clearInterval(timer);
    }

    const channel = supabase
      .channel(`hero-habits-${profileId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "squad_state" },
        () => {
          void loadBoard();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mission_history" },
        () => {
          void loadBoard();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "missions" },
        () => {
          void loadBoard();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        () => {
          void loadBoard();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profileId, loadBoard, remoteEnabled]);

  const handleComplete = useCallback(
    async (mission: MissionWithState) => {
      if (mission.completedToday || !profile || !squad) {
        return;
      }

      const optimisticPower = profile.powerLevel + mission.powerValue;
      const optimisticSquad = Math.min(
        squad.squadPowerMax,
        squad.squadPowerCurrent + mission.powerValue,
      );

      setProfile({ ...profile, powerLevel: optimisticPower });
      setSquad({ ...squad, squadPowerCurrent: optimisticSquad });
      setMissions((current) =>
        current.map((item) =>
          item.id === mission.id ? { ...item, completedToday: true } : item,
        ),
      );

      playSuccessSound();
      setEffectText(profile.uiMode === "picture" ? "KAPOW!" : "MISSION COMPLETE!");
      window.setTimeout(() => setEffectText(null), 900);

      const payload = {
        missionId: mission.id,
        profileId,
        clientRequestId:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : makeId(),
        clientCompletedAt: new Date().toISOString(),
      };

      if (!remoteEnabled) {
        const result = await completeMission(payload);
        setProfile((current) =>
          current ? { ...current, powerLevel: result.profilePowerLevel } : current,
        );
        setSquad((current) =>
          current
            ? {
                ...current,
                squadPowerCurrent: result.squadPowerCurrent,
                squadPowerMax: result.squadPowerMax,
              }
            : current,
        );
        if (result.squadPowerCurrent >= result.squadPowerMax) {
          setShowSquadWin(true);
        }
        return;
      }

      if (!navigator.onLine) {
        await enqueueCompletion({ id: makeId(), ...payload });
        return;
      }

      try {
        const result = await completeMission(payload);
        setProfile((current) =>
          current ? { ...current, powerLevel: result.profilePowerLevel } : current,
        );
        setSquad((current) =>
          current
            ? {
                ...current,
                squadPowerCurrent: result.squadPowerCurrent,
                squadPowerMax: result.squadPowerMax,
              }
            : current,
        );
        if (result.squadPowerCurrent >= result.squadPowerMax) {
          setShowSquadWin(true);
        }
      } catch {
        await enqueueCompletion({ id: makeId(), ...payload });
      }
    },
    [profile, profileId, squad, remoteEnabled],
  );

  const handleUndo = useCallback(
    async (mission: MissionWithState) => {
      if (!mission.completedToday || !profile || !squad) {
        return;
      }

      const optimisticPower = Math.max(0, profile.powerLevel - mission.powerValue);
      const optimisticSquad = Math.max(
        0,
        squad.squadPowerCurrent - mission.powerValue,
      );

      setProfile({ ...profile, powerLevel: optimisticPower });
      setSquad({ ...squad, squadPowerCurrent: optimisticSquad });
      setMissions((current) =>
        current.map((item) =>
          item.id === mission.id ? { ...item, completedToday: false } : item,
        ),
      );

      await removeQueuedCompletionsForMission(profileId, mission.id);

      if (remoteEnabled && !navigator.onLine) {
        return;
      }

      try {
        const result = await uncompleteMission({
          missionId: mission.id,
          profileId,
        });

        if (!result.undone) {
          if (result.insufficientUnspentPoints) {
            const neededPower = Math.max(
              0,
              mission.powerValue - result.profilePowerLevel,
            );
            let recovered = 0;
            const claimsToReturn: RewardClaimEntry[] = [];
            for (const claim of rewardClaims) {
              claimsToReturn.push(claim);
              recovered += claim.pointCost;
              if (result.profilePowerLevel + recovered >= mission.powerValue) {
                break;
              }
            }

            if (
              claimsToReturn.length > 0 &&
              result.profilePowerLevel + recovered >= mission.powerValue
            ) {
              const names = claimsToReturn
                .slice(0, 3)
                .map((claim) => claim.title)
                .join(", ");
              const label =
                claimsToReturn.length > 3
                  ? `${names}, +${claimsToReturn.length - 3} more`
                  : names;
              const ok = window.confirm(
                `Undo is locked because points were spent.\nReturn ${claimsToReturn.length} reward(s) (${recovered} power) to undo this mission?\n${label}`,
              );
              if (ok) {
                for (const claim of claimsToReturn) {
                  await returnReward({
                    profileId,
                    rewardClaimId: claim.id,
                  });
                }

                const retry = await uncompleteMission({
                  missionId: mission.id,
                  profileId,
                });
                if (retry.undone) {
                  setProfile((current) =>
                    current
                      ? { ...current, powerLevel: retry.profilePowerLevel }
                      : current,
                  );
                  setSquad((current) =>
                    current
                      ? {
                          ...current,
                          squadPowerCurrent: retry.squadPowerCurrent,
                          squadPowerMax: retry.squadPowerMax,
                        }
                      : current,
                  );
                  setEffectText("UNDO COMPLETE!");
                  window.setTimeout(() => setEffectText(null), 900);
                  await loadBoard();
                  return;
                }
              }
            }

            setEffectText(neededPower > 0 ? "RETURN TROPHIES" : "UNDO LOCKED");
            window.setTimeout(() => setEffectText(null), 1200);
          }
          await loadBoard();
          return;
        }

        setProfile((current) =>
          current ? { ...current, powerLevel: result.profilePowerLevel } : current,
        );
        setSquad((current) =>
          current
            ? {
                ...current,
                squadPowerCurrent: result.squadPowerCurrent,
                squadPowerMax: result.squadPowerMax,
              }
            : current,
        );
        setEffectText("UNDO COMPLETE!");
        window.setTimeout(() => setEffectText(null), 900);
      } catch {
        await loadBoard();
      }
    },
    [loadBoard, profile, profileId, rewardClaims, squad, remoteEnabled],
  );

  const handleClaimReward = useCallback(
    async (reward: Reward) => {
      if (!profile) {
        return;
      }
      if (claimedRewardIds.has(reward.id)) {
        return;
      }
      if (profile.powerLevel < reward.pointCost) {
        return;
      }

      const ok = window.confirm(
        `Claim "${reward.title}" for ${reward.pointCost} power points?`,
      );
      if (!ok) {
        return;
      }

      try {
        const result = await claimReward({
          profileId,
          rewardId: reward.id,
        });
        if (result.claimed) {
          setProfile((current) =>
            current ? { ...current, powerLevel: result.newPowerLevel } : current,
          );
          setEffectText("REWARD UNLOCKED!");
          window.setTimeout(() => setEffectText(null), 1000);
        }
        await loadBoard();
      } catch {
        await loadBoard();
      }
    },
    [claimedRewardIds, loadBoard, profile, profileId],
  );

  const handleReturnClaim = useCallback(
    async (claim: RewardClaimEntry) => {
      const ok = window.confirm(
        `Give back "${claim.title}" and restore ${claim.pointCost} power?`,
      );
      if (!ok) {
        return;
      }

      setReturningClaimById((current) => ({ ...current, [claim.id]: true }));
      try {
        const result = await returnReward({
          profileId,
          rewardClaimId: claim.id,
        });
        if (result.returned) {
          setProfile((current) =>
            current ? { ...current, powerLevel: result.newPowerLevel } : current,
          );
          setEffectText("TROPHY RETURNED!");
          window.setTimeout(() => setEffectText(null), 1000);
        }
        await loadBoard();
      } catch {
        await loadBoard();
      } finally {
        setReturningClaimById((current) => ({ ...current, [claim.id]: false }));
      }
    },
    [loadBoard, profileId],
  );

  const startLongPress = useCallback(() => {
    setIsPressingParentSpot(true);
    longPressTimer.current = setTimeout(() => {
      setShowPinGate(true);
      setIsPressingParentSpot(false);
    }, 3000);
  }, []);

  const stopLongPress = useCallback(() => {
    setIsPressingParentSpot(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleParentLogin = useCallback(async () => {
    const ok = await loginParent(pin);
    if (!ok) {
      setPinError("PIN is incorrect");
      return;
    }

    setShowPinGate(false);
    setPin("");
    setPinError(null);
    router.push("/parent");
  }, [pin, router]);

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-7xl p-6 text-white">
        <p className="text-xl font-bold uppercase">Loading Mission Control...</p>
      </main>
    );
  }

  if (!profile || !squad) {
    return (
      <main className="mx-auto min-h-screen max-w-7xl p-6 text-white">
        <p className="rounded-xl border-2 border-red-600 bg-red-100 px-4 py-3 text-red-700">
          {error ?? "Profile not found."}
        </p>
        <Link href="/" className="mt-4 inline-flex text-white underline">
          Back to Hero Select
        </Link>
      </main>
    );
  }

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 text-white sm:px-6">
      <button
        type="button"
        aria-label="Parent control"
        className={`absolute top-2 left-2 z-40 rounded-xl border-2 border-black px-3 py-2 text-left shadow-[4px_4px_0_#000] transition ${
          isPressingParentSpot
            ? "scale-95 bg-[var(--hero-yellow)] text-black"
            : "bg-white/95 text-black"
        }`}
        onPointerDown={startLongPress}
        onPointerUp={stopLongPress}
        onPointerLeave={stopLongPress}
        onPointerCancel={stopLongPress}
      >
        <p className="text-[10px] font-black uppercase leading-tight">Parent</p>
        <p className="text-[10px] font-bold uppercase leading-tight">Hold 3s</p>
      </button>

      <header className="mb-4 grid gap-3 rounded-2xl border-4 border-black bg-[var(--hero-blue)] p-4 shadow-[6px_6px_0_#000] sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl border-2 border-black bg-white text-2xl text-black"
          >
            ←
          </Link>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-white/80">
              Mission Control
            </p>
            <h1 className="text-2xl font-black uppercase">{profile.heroName}</h1>
            {heroLevel ? (
              <p
                className="text-xs font-black uppercase tracking-wide"
                style={{ color: heroLevel.color }}
              >
                {heroLevel.name}
                {heroLevel.nextPower ? ` · Next ${heroLevel.nextPower}` : " · Max"}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-2">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-wide">
              <span>Power Level</span>
              <span>{profile.powerLevel}</span>
            </div>
            <div className="meter-wrap">
              <div className="meter-fill" style={{ width: `${personalProgress}%` }} />
            </div>
            {profile.currentStreak > 0 ? (
              <p className="mt-1 text-[11px] font-black uppercase tracking-wide text-[var(--hero-yellow)]">
                {getStreakBadge(profile.currentStreak) ?? "🔥"} {profile.currentStreak} Day Streak
              </p>
            ) : null}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-xs font-bold uppercase tracking-wide">
              <span>Squad Power</span>
              <span>
                {squad.squadPowerCurrent}/{squad.squadPowerMax}
              </span>
            </div>
            <div className="meter-wrap bg-[var(--hero-red)]/30">
              <div
                className="meter-fill bg-[var(--hero-yellow)]"
                style={{
                  width: `${Math.round(
                    (squad.squadPowerCurrent / Math.max(1, squad.squadPowerMax)) * 100,
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>
      </header>

      {squad.squadGoal ? (
        <section className="mb-4 rounded-2xl border-4 border-black bg-[var(--hero-yellow)] p-4 text-black shadow-[6px_6px_0_#000]">
          <p className="text-xs font-bold uppercase tracking-wide">Squad Goal</p>
          <p className="text-2xl font-black uppercase">{squad.squadGoal.title}</p>
          <p className="mt-1 text-sm font-bold">
            {Math.max(0, squad.squadGoal.targetPower - squad.squadPowerCurrent)} more power needed.
          </p>
          <p className="text-xs font-bold uppercase">
            Reward: {squad.squadGoal.rewardDescription}
          </p>
        </section>
      ) : null}

      {profile.uiMode === "text" &&
      profile.powerLevel >= SECRET_HERO_CODE_THRESHOLD ? (
        <section className="mb-4 rounded-2xl border-4 border-black bg-[var(--hero-yellow)] p-4 text-black shadow-[6px_6px_0_#000]">
          <p className="text-xs font-bold uppercase tracking-wide">
            Hero Gadget Unlocked
          </p>
          <p className="text-3xl font-black uppercase">{SECRET_HERO_CODE_VALUE}</p>
        </section>
      ) : null}

      <section className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {missions.map((mission) => (
          <article
            key={mission.id}
            className={`comic-card comic-card-interactive relative flex min-h-[170px] flex-col overflow-hidden p-0 text-left ${
              mission.completedToday
                ? "cursor-not-allowed saturate-0 opacity-65"
                : "hover:-translate-y-1"
            }`}
          >
            <button
              type="button"
              disabled={mission.completedToday}
              onClick={() => void handleComplete(mission)}
              className="h-full w-full text-left"
            >
            {mission.recurringDaily ? (
              <span className="status-chip absolute top-2 right-2 z-10 bg-[var(--hero-yellow)] text-black">
                Daily
              </span>
            ) : null}

            {profile.uiMode === "picture" ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mission.imageUrl ?? "/missions/default.svg"}
                  alt={mission.title}
                  className="h-44 w-full object-cover sm:h-52"
                />
                <div className="bg-black/65 p-3">
                  <p className="text-sm font-black uppercase tracking-wide">
                    +{mission.powerValue} Power
                  </p>
                  <p className="mt-1 text-xs font-bold text-white/90">
                    {mission.instructions}
                  </p>
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col justify-between p-4">
                <p className="text-2xl font-black uppercase leading-tight text-white">
                  {mission.title}
                </p>
                <p className="mt-2 text-sm font-bold text-white/85">
                  {mission.instructions}
                </p>
                <p className="mt-3 text-sm font-bold uppercase text-[var(--hero-yellow)]">
                  +{mission.powerValue} Power
                </p>
              </div>
            )}
            </button>

            {mission.completedToday ? (
              <div className="absolute inset-0 z-20 grid place-items-center bg-black/60 p-4 text-center">
                <div className="flex flex-col items-center gap-3">
                  <p className="text-2xl font-black uppercase text-[var(--hero-yellow)]">
                    Mission Accomplished!
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleUndo(mission)}
                    className="touch-target rounded-xl border-2 border-black bg-white px-4 py-2 text-sm font-black uppercase text-black shadow-[4px_4px_0_#000]"
                  >
                    Undo
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </section>

      <section className="mt-4 rounded-2xl border-4 border-black bg-[var(--hero-blue)]/80 p-4 shadow-[6px_6px_0_#000]">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-black uppercase">Rewards</h2>
          <p className="text-xs font-bold uppercase text-white/80">
            Spend Power Points
          </p>
        </div>
        {rewards.length === 0 ? (
          <p className="text-sm font-bold text-white/80">No rewards available.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {rewards.map((reward) => {
              const isClaimed = claimedRewardIds.has(reward.id);
              return (
              <article
                key={reward.id}
                className="rounded-xl border-2 border-black bg-white p-3 text-black"
              >
                <p className="text-lg font-black uppercase">{reward.title}</p>
                <p className="mt-1 text-sm">{reward.description}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="rounded-full border-2 border-black bg-[var(--hero-yellow)] px-2 py-1 text-xs font-black uppercase">
                    {reward.pointCost} Power
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleClaimReward(reward)}
                    disabled={isClaimed || profile.powerLevel < reward.pointCost}
                    className="rounded-lg border-2 border-black bg-[var(--hero-red)] px-3 py-1 text-xs font-black uppercase text-white disabled:opacity-50"
                  >
                    {isClaimed ? "Claimed" : "Claim"}
                  </button>
                </div>
                {isClaimed ? (
                  <p className="mt-1 text-xs font-black uppercase text-emerald-700">
                    Already claimed
                  </p>
                ) : null}
              </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-4 rounded-2xl border-4 border-black bg-[var(--hero-blue)] p-4 text-white shadow-[6px_6px_0_#000]">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="rounded-md bg-black/40 px-2 py-1 text-lg font-black uppercase text-[var(--hero-yellow)]">
            Trophy Case
          </h2>
          <p className="text-xs font-bold uppercase text-white/90">
            {rewardClaims.length} Claimed
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowTrophyCase((current) => !current)}
          className="touch-target w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-sm font-black uppercase text-black"
        >
          {showTrophyCase ? "Hide Trophy Case" : "Show Trophy Case"}
        </button>
        {showTrophyCase ? (
          rewardClaims.length === 0 ? (
            <p className="mt-3 text-sm font-bold text-white/90">
              Claim rewards to fill your trophy case.
            </p>
          ) : (
            <div className="mx-auto mt-3 grid w-full max-w-[560px] grid-cols-3 gap-2 md:grid-cols-4">
              {rewardClaims.map((claim) => (
                <article
                  key={claim.id}
                  className="rounded-lg border-2 border-black bg-white p-1.5 text-black"
                >
                  <AvatarDisplay
                    avatarUrl={claim.imageUrl ?? ""}
                    alt={`${claim.title} sticker`}
                    className="mb-1 grid h-14 w-full place-items-center rounded-md border-2 border-black bg-[var(--hero-blue)]/20 object-cover text-lg"
                  />
                  <p className="line-clamp-1 text-[11px] font-black uppercase leading-tight">
                    {claim.title}
                  </p>
                  <p className="mt-0.5 text-[9px] font-black uppercase text-zinc-600">
                    {new Date(claim.claimedAt).toLocaleDateString()}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleReturnClaim(claim)}
                    disabled={Boolean(returningClaimById[claim.id])}
                    className="touch-target mt-1 w-full rounded-md border-2 border-black bg-amber-300 px-1 py-1 text-[9px] font-black uppercase text-black disabled:opacity-60"
                  >
                    {returningClaimById[claim.id] ? "Returning..." : "Give Back"}
                  </button>
                </article>
              ))}
            </div>
          )
        ) : null}
      </section>

      <section className="mt-4 rounded-2xl border-4 border-black bg-black/45 p-4">
        <button
          type="button"
          onClick={() => setShowHistory((current) => !current)}
          className="touch-target w-full rounded-lg border-2 border-black bg-white px-3 py-2 text-sm font-black uppercase text-black"
        >
          {showHistory ? "Hide Mission Log" : "Show Mission Log"}
        </button>
        {showHistory ? (
          <div className="mt-3 grid gap-3">
            {history.length === 0 ? (
              <p className="text-sm font-bold text-white/80">No mission history yet.</p>
            ) : (
              history.map((entry) => (
                <article
                  key={entry.date}
                  className="rounded-xl border-2 border-black bg-white p-3 text-black"
                >
                  <p className="text-sm font-black uppercase">{entry.date}</p>
                  <ul className="mt-2 grid gap-1">
                    {entry.missions.map((item, index) => (
                      <li
                        key={`${entry.date}-${item.title}-${index}`}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>{item.title}</span>
                        <span className="font-black text-[var(--hero-blue)]">
                          +{item.powerAwarded}
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))
            )}
          </div>
        ) : null}
      </section>

      {effectText ? (
        <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center">
          <p className="effect-pop text-5xl font-black uppercase text-[var(--hero-yellow)] sm:text-7xl">
            {effectText}
          </p>
        </div>
      ) : null}

      {showPinGate ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border-4 border-black bg-white p-5 text-black shadow-[8px_8px_0_#000]">
            <h2 className="text-2xl font-black uppercase">Mission Command PIN</h2>
            <p className="mt-1 text-sm">Parents only.</p>

            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              className="mt-4 w-full rounded-xl border-2 border-black px-3 py-3 text-xl tracking-[0.3em]"
              placeholder="••••"
            />
            {pinError ? <p className="mt-2 text-sm text-red-600">{pinError}</p> : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowPinGate(false);
                  setPinError(null);
                }}
                className="flex-1 rounded-xl border-2 border-black bg-zinc-100 px-3 py-2 font-bold uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleParentLogin()}
                className="flex-1 rounded-xl border-2 border-black bg-[var(--hero-red)] px-3 py-2 font-bold uppercase text-white"
              >
                Enter
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showSquadWin ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4">
          <div className="relative flex flex-col items-center gap-6 text-center">
            {STARS.map((star) => (
              <span
                key={star.key}
                className="squad-win-star pointer-events-none"
                style={{
                  background: star.color,
                  "--tx": `${star.tx}px`,
                  "--ty": `${star.ty}px`,
                  "--delay": `${star.delay}s`,
                  "--duration": `${star.duration}s`,
                } as React.CSSProperties}
              />
            ))}
            <p className="squad-win-text text-xs font-black uppercase tracking-widest text-[var(--hero-yellow)]">
              {profile.heroName} &amp; The Squad
            </p>
            <p
              className="squad-win-text text-7xl font-black uppercase leading-none text-[var(--hero-yellow)] sm:text-9xl"
              style={{ textShadow: "4px 4px 0 #000, -4px -4px 0 #000, 4px -4px 0 #000, -4px 4px 0 #000" }}
            >
              SQUAD WINS!
            </p>
            <p className="squad-win-text text-lg font-bold text-white/80">
              Full power achieved. Heroes unite!
            </p>
            <button
              type="button"
              onClick={() => setShowSquadWin(false)}
              className="squad-win-text rounded-2xl border-4 border-black bg-[var(--hero-yellow)] px-8 py-4 text-xl font-black uppercase text-black shadow-[6px_6px_0_#000]"
            >
              Keep Going!
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
