"use client";

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  claimReward,
  completeMission,
  deleteMission,
  fetchMissionHistory,
  fetchMissions,
  fetchUnreadNotificationCount,
  fetchProfiles,
  fetchRewardClaims,
  fetchRewards,
  fetchSquadState,
  isRemoteApiEnabled,
  returnReward,
  uncompleteMission,
  updateMission,
  updateReward,
} from "@/lib/client-api";
import { didHeroLevelIncrease, shouldTriggerSquadGoalWin } from "@/lib/board-rules";
import { getHeroLevel } from "@/lib/hero-levels";
import { reportError } from "@/lib/monitoring";
import {
  enqueueCompletion,
  flushCompletionQueue,
  CompletionQueueItem,
  removeQueuedCompletionsForMission,
} from "@/lib/offline/queue";
import { publicEnv } from "@/lib/public-env";
import { getRewardCooldownStatus } from "@/lib/reward-cooldown";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useHeroDialog } from "@/hooks/use-hero-dialog";
import {
  MissionHistoryEntry,
  MissionWithState,
  Profile,
  Reward,
  RewardClaimEntry,
  SquadState,
} from "@/lib/types/domain";

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

interface UseMissionBoardControllerResult {
  profile: Profile | null;
  missions: MissionWithState[];
  squad: SquadState | null;
  rewards: Reward[];
  rewardClaims: RewardClaimEntry[];
  history: MissionHistoryEntry[];
  claimsLoading: boolean;
  historyLoading: boolean;
  loading: boolean;
  error: string | null;
  effectText: string | null;
  showPinGate: boolean;
  isPressingParentSpot: boolean;
  returningClaimById: Record<string, boolean>;
  showSquadWin: boolean;
  showTrophyCase: boolean;
  showHistory: boolean;
  unreadNotificationCount: number;
  updatingRewardById: Record<string, boolean>;
  updatingMissionById: Record<string, boolean>;
  savedRewardById: Record<string, boolean>;
  savedMissionById: Record<string, boolean>;
  rewardCooldownById: Record<
    string,
    { cooldownActive: boolean; nextClaimDate: string | null; cooldownDaysRemaining: number | null }
  >;
  heroLevel: ReturnType<typeof getHeroLevel> | null;
  personalProgress: number;
  todayRewardPointsEarned: number;
  dialogNode: ReactNode;
  showLevelUp: boolean;
  levelUpName: string | null;
  setShowPinGate: (show: boolean) => void;
  dismissSquadWin: () => void;
  dismissLevelUp: () => void;
  completeMissionAction: (mission: MissionWithState) => Promise<void>;
  undoMissionAction: (mission: MissionWithState) => Promise<void>;
  deleteMissionAction: (mission: MissionWithState) => Promise<void>;
  updateMissionAction: (
    mission: MissionWithState,
    next: {
      title: string;
      instructions: string;
      powerValue: number;
      recurringDaily: boolean;
    },
  ) => Promise<void>;
  updateRewardCostAction: (reward: Reward, nextCost: number) => Promise<void>;
  claimRewardAction: (reward: Reward) => Promise<void>;
  returnClaimAction: (claim: RewardClaimEntry) => Promise<void>;
  toggleHistory: () => void;
  toggleTrophyCase: () => void;
  startLongPress: () => void;
  stopLongPress: () => void;
  reloadBoard: () => Promise<void>;
}

export function useMissionBoardController(
  profileId: string,
): UseMissionBoardControllerResult {
  const remoteEnabled = isRemoteApiEnabled();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [missions, setMissions] = useState<MissionWithState[]>([]);
  const [squad, setSquad] = useState<SquadState | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rewardClaims, setRewardClaims] = useState<RewardClaimEntry[]>([]);
  const [history, setHistory] = useState<MissionHistoryEntry[]>([]);
  const [showTrophyCase, setShowTrophyCase] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [effectText, setEffectText] = useState<string | null>(null);
  const [showPinGate, setShowPinGate] = useState(false);
  const [isPressingParentSpot, setIsPressingParentSpot] = useState(false);
  const [returningClaimById, setReturningClaimById] = useState<Record<string, boolean>>({});
  const [showSquadWin, setShowSquadWin] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpName, setLevelUpName] = useState<string | null>(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [todayRewardPointsEarned, setTodayRewardPointsEarned] = useState(0);
  const [updatingRewardById, setUpdatingRewardById] = useState<Record<string, boolean>>({});
  const [updatingMissionById, setUpdatingMissionById] = useState<Record<string, boolean>>({});
  const [savedRewardById, setSavedRewardById] = useState<Record<string, boolean>>({});
  const [savedMissionById, setSavedMissionById] = useState<Record<string, boolean>>({});
  const { confirm, dialogNode } = useHeroDialog();

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const claimsLoadedRef = useRef(false);
  const historyLoadedRef = useRef(false);
  const claimsLoadingRef = useRef(false);
  const historyLoadingRef = useRef(false);
  const savedRewardTimersRef = useRef<Record<string, number>>({});
  const savedMissionTimersRef = useRef<Record<string, number>>({});

  const completedCount = useMemo(
    () => missions.filter((mission) => mission.completedToday).length,
    [missions],
  );

  const personalProgress = useMemo(() => {
    if (missions.length === 0) return 0;
    const rawProgress = Math.round((completedCount / missions.length) * 100);
    return Math.max(0, Math.min(100, rawProgress));
  }, [completedCount, missions.length]);

  const heroLevel = useMemo(
    () => (profile ? getHeroLevel(profile.powerLevel) : null),
    [profile],
  );

  const rewardCooldownById = useMemo(
    () =>
      Object.fromEntries(
        rewards.map((reward) => [
          reward.id,
          getRewardCooldownStatus({
            reward,
            claims: rewardClaims,
            timeZone: publicEnv.appTimeZone,
          }),
        ]),
      ),
    [rewardClaims, rewards],
  );

  const applyProfileEconomy = useCallback(
    (
      next: {
        rewardPoints: number;
        xpPoints: number;
        powerLevel?: number;
      },
      previousXpPoints?: number,
    ) => {
      setProfile((current) => {
        if (!current) return current;
        const nextPowerLevel = next.powerLevel ?? next.xpPoints;
        const baselinePowerLevel = previousXpPoints ?? current.powerLevel;
        if (didHeroLevelIncrease(baselinePowerLevel, nextPowerLevel)) {
          setLevelUpName(getHeroLevel(nextPowerLevel).name);
          setShowLevelUp(true);
        }
        return {
          ...current,
          rewardPoints: next.rewardPoints,
          xpPoints: next.xpPoints,
          powerLevel: nextPowerLevel,
        };
      });
    },
    [],
  );

  const loadHistory = useCallback(
    async (force = false) => {
      if ((!force && historyLoadedRef.current) || historyLoadingRef.current) {
        return;
      }

      historyLoadingRef.current = true;
      setHistoryLoading(true);
      try {
        const historyRows = await fetchMissionHistory(profileId, 7);
        setHistory(historyRows);
        historyLoadedRef.current = true;
      } finally {
        historyLoadingRef.current = false;
        setHistoryLoading(false);
      }
    },
    [profileId],
  );

  const loadRewardClaims = useCallback(
    async (force = false) => {
      if ((!force && claimsLoadedRef.current) || claimsLoadingRef.current) {
        return;
      }

      claimsLoadingRef.current = true;
      setClaimsLoading(true);
      try {
        const rewardClaimRows = await fetchRewardClaims(profileId);
        setRewardClaims(rewardClaimRows);
        claimsLoadedRef.current = true;
      } finally {
        claimsLoadingRef.current = false;
        setClaimsLoading(false);
      }
    },
    [profileId],
  );

  const loadBoard = useCallback(async () => {
    try {
      setLoading(true);
      const [
        profiles,
        missionRows,
        squadState,
        rewardRows,
        rewardClaimRows,
        missionHistoryRows,
        unreadCount,
      ] = await Promise.all([
        fetchProfiles(),
        fetchMissions(profileId),
        fetchSquadState(),
        fetchRewards(),
        fetchRewardClaims(profileId),
        fetchMissionHistory(profileId, 1),
        fetchUnreadNotificationCount(),
      ]);

      const activeProfile = profiles.find((item) => item.id === profileId) ?? null;
      setProfile(activeProfile);
      setMissions(missionRows);
      setSquad(squadState);
      setRewards(rewardRows);
      setRewardClaims(rewardClaimRows);
      claimsLoadedRef.current = true;
      const todayHistory = missionHistoryRows.find((entry) => entry.date === squadState.cycleDate);
      const todayEarned = (todayHistory?.missions ?? []).reduce(
        (sum, mission) => sum + Number(mission.powerAwarded ?? 0),
        0,
      );
      setTodayRewardPointsEarned(todayEarned);
      setUnreadNotificationCount(unreadCount);
      setError(null);
      if (historyLoadedRef.current) {
        void loadHistory(true);
      }
    } catch (err) {
      reportError(err, { surface: "mission_board_load" });
      const message = err instanceof Error ? err.message : "Failed to load board";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [profileId, loadHistory]);

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
    claimsLoadedRef.current = false;
    historyLoadedRef.current = false;
    claimsLoadingRef.current = false;
    historyLoadingRef.current = false;
    setRewardClaims([]);
    setHistory([]);
    setShowTrophyCase(false);
    setShowHistory(false);
    setClaimsLoading(false);
    setHistoryLoading(false);
    setShowLevelUp(false);
    setLevelUpName(null);
    setSavedRewardById({});
    setSavedMissionById({});
  }, [profileId]);

  useEffect(() => {
    const rewardTimers = savedRewardTimersRef.current;
    const missionTimers = savedMissionTimersRef.current;
    return () => {
      Object.values(rewardTimers).forEach((timer) => clearTimeout(timer));
      Object.values(missionTimers).forEach((timer) => clearTimeout(timer));
    };
  }, []);

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

  const completeMissionAction = useCallback(
    async (mission: MissionWithState) => {
      if (mission.completedToday || !profile || !squad) {
        return;
      }

      const optimisticRewardPoints = profile.rewardPoints + mission.powerValue;
      const optimisticXpPoints = profile.xpPoints + mission.powerValue;
      const optimisticSquad = Math.min(
        squad.squadPowerMax,
        squad.squadPowerCurrent + mission.powerValue,
      );

      setProfile({
        ...profile,
        rewardPoints: optimisticRewardPoints,
        xpPoints: optimisticXpPoints,
        powerLevel: optimisticXpPoints,
      });
      setSquad({ ...squad, squadPowerCurrent: optimisticSquad });
      setMissions((current) =>
        current.map((item) =>
          item.id === mission.id ? { ...item, completedToday: true } : item,
        ),
      );

      playSuccessSound();
      if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
        navigator.vibrate([30, 20, 60]);
      }
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
        applyProfileEconomy(
          {
            rewardPoints: result.profileRewardPoints,
            xpPoints: result.profileXpPoints,
            powerLevel: result.profilePowerLevel,
          },
          profile.powerLevel,
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
        if (result.awarded) {
          setUnreadNotificationCount((current) => current + 1);
        }
        if (shouldTriggerSquadGoalWin(squad, result.squadPowerCurrent)) {
          setShowSquadWin(true);
        }
        if (historyLoadedRef.current) {
          void loadHistory(true);
        }
        return;
      }

      if (!navigator.onLine) {
        await enqueueCompletion({ id: makeId(), ...payload });
        return;
      }

      try {
        const result = await completeMission(payload);
        applyProfileEconomy(
          {
            rewardPoints: result.profileRewardPoints,
            xpPoints: result.profileXpPoints,
            powerLevel: result.profilePowerLevel,
          },
          profile.powerLevel,
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
        if (result.awarded) {
          setUnreadNotificationCount((current) => current + 1);
        }
        if (shouldTriggerSquadGoalWin(squad, result.squadPowerCurrent)) {
          setShowSquadWin(true);
        }
        if (historyLoadedRef.current) {
          void loadHistory(true);
        }
      } catch (error) {
        reportError(error, { surface: "mission_complete" });
        await enqueueCompletion({ id: makeId(), ...payload });
      }
    },
    [profile, profileId, squad, remoteEnabled, loadHistory, applyProfileEconomy],
  );

  const undoMissionAction = useCallback(
    async (mission: MissionWithState) => {
      if (!mission.completedToday || !profile || !squad) {
        return;
      }

      const optimisticRewardPoints = Math.max(0, profile.rewardPoints - mission.powerValue);
      const optimisticXpPoints = Math.max(0, profile.xpPoints - mission.powerValue);
      const optimisticSquad = Math.max(0, squad.squadPowerCurrent - mission.powerValue);

      setProfile({
        ...profile,
        rewardPoints: optimisticRewardPoints,
        xpPoints: optimisticXpPoints,
        powerLevel: optimisticXpPoints,
      });
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
              mission.powerValue - result.profileRewardPoints,
            );
            let recovered = 0;
            const claimsToReturn: RewardClaimEntry[] = [];
            for (const claim of rewardClaims) {
              claimsToReturn.push(claim);
              recovered += claim.pointCost;
              if (result.profileRewardPoints + recovered >= mission.powerValue) {
                break;
              }
            }

            if (
              claimsToReturn.length > 0 &&
              result.profileRewardPoints + recovered >= mission.powerValue
            ) {
              const names = claimsToReturn
                .slice(0, 3)
                .map((claim) => claim.title)
                .join(", ");
              const label =
                claimsToReturn.length > 3
                  ? `${names}, +${claimsToReturn.length - 3} more`
                  : names;
              const ok = await confirm({
                title: "Undo Is Locked",
                description: `Return ${claimsToReturn.length} reward(s) (${recovered} Reward Points) to undo this mission?\n${label}`,
                confirmLabel: "Return Rewards",
                cancelLabel: "Keep Locked",
              });
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
                  applyProfileEconomy({
                    rewardPoints: retry.profileRewardPoints,
                    xpPoints: retry.profileXpPoints,
                    powerLevel: retry.profilePowerLevel,
                  });
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
                  if (historyLoadedRef.current) {
                    await loadHistory(true);
                  }
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

        applyProfileEconomy({
          rewardPoints: result.profileRewardPoints,
          xpPoints: result.profileXpPoints,
          powerLevel: result.profilePowerLevel,
        });
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
        if (historyLoadedRef.current) {
          void loadHistory(true);
        }
      } catch (error) {
        reportError(error, { surface: "mission_undo" });
        await loadBoard();
      }
    },
    [
      loadBoard,
      profile,
      profileId,
      rewardClaims,
      squad,
      remoteEnabled,
      loadHistory,
      confirm,
      applyProfileEconomy,
    ],
  );

  const claimRewardAction = useCallback(
    async (reward: Reward) => {
      if (!profile) {
        return;
      }
      if (profile.rewardPoints < reward.pointCost) {
        setEffectText("NEED MORE REWARD POINTS");
        window.setTimeout(() => setEffectText(null), 1200);
        return;
      }

      const ok = await confirm({
        title: "Claim Reward",
        description: `Claim "${reward.title}" for ${reward.pointCost} Reward Points?`,
        confirmLabel: "Claim",
        cancelLabel: "Cancel",
      });
      if (!ok) {
        return;
      }

      try {
        const result = await claimReward({
          profileId,
          rewardId: reward.id,
        });
        if (result.claimed) {
          applyProfileEconomy({
            rewardPoints: result.newRewardPoints,
            xpPoints: result.newXpPoints,
            powerLevel: result.newPowerLevel,
          });
          setEffectText("REWARD UNLOCKED!");
          window.setTimeout(() => setEffectText(null), 1000);
        } else if (result.cooldownActive) {
          setEffectText(
            result.cooldownDaysRemaining && result.cooldownDaysRemaining > 0
              ? `READY IN ${result.cooldownDaysRemaining} DAY${result.cooldownDaysRemaining === 1 ? "" : "S"}`
              : "REWARD ON COOLDOWN",
          );
          window.setTimeout(() => setEffectText(null), 1300);
        } else if (result.insufficientPoints) {
          setEffectText("NEED MORE REWARD POINTS");
          window.setTimeout(() => setEffectText(null), 1200);
        } else {
          setEffectText("CLAIM NOT AVAILABLE");
          window.setTimeout(() => setEffectText(null), 1200);
        }
        await loadBoard();
        if (claimsLoadedRef.current) {
          await loadRewardClaims(true);
        }
      } catch (error) {
        reportError(error, { surface: "reward_claim" });
        setEffectText("CLAIM FAILED");
        window.setTimeout(() => setEffectText(null), 1200);
        await loadBoard();
      }
    },
    [loadBoard, profile, profileId, loadRewardClaims, confirm, applyProfileEconomy],
  );

  const updateMissionAction = useCallback(
    async (
      mission: MissionWithState,
      next: {
        title: string;
        instructions: string;
        powerValue: number;
        recurringDaily: boolean;
      },
    ) => {
      const title = next.title.trim();
      const instructions = next.instructions.trim();
      const powerValue = Math.max(1, Math.min(100, Math.round(next.powerValue)));

      if (!title || !instructions) {
        throw new Error("Mission title and instructions are required");
      }

      setUpdatingMissionById((current) => ({ ...current, [mission.id]: true }));
      setSavedMissionById((current) => ({ ...current, [mission.id]: false }));
      try {
        const updated = await updateMission(mission.id, {
          title,
          instructions,
          powerValue,
          recurringDaily: next.recurringDaily,
        });
        setMissions((current) =>
          current.map((item) =>
            item.id === mission.id
              ? {
                  ...item,
                  ...updated,
                  completedToday: item.completedToday,
                }
              : item,
          ),
        );
        const existingTimer = savedMissionTimersRef.current[mission.id];
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        setSavedMissionById((current) => ({ ...current, [mission.id]: true }));
        savedMissionTimersRef.current[mission.id] = window.setTimeout(() => {
          setSavedMissionById((current) => ({ ...current, [mission.id]: false }));
          delete savedMissionTimersRef.current[mission.id];
        }, 1400);
      } catch (error) {
        reportError(error, { surface: "mission_update" });
        await loadBoard();
        throw error;
      } finally {
        setUpdatingMissionById((current) => ({ ...current, [mission.id]: false }));
      }
    },
    [loadBoard],
  );

  const returnClaimAction = useCallback(
    async (claim: RewardClaimEntry) => {
      const ok = await confirm({
        title: "Give Back Reward",
        description: `Give back "${claim.title}" and restore ${claim.pointCost} Reward Points?`,
        confirmLabel: "Give Back",
        cancelLabel: "Cancel",
      });
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
          applyProfileEconomy({
            rewardPoints: result.newRewardPoints,
            xpPoints: result.newXpPoints,
            powerLevel: result.newPowerLevel,
          });
          setEffectText("TROPHY RETURNED!");
          window.setTimeout(() => setEffectText(null), 1000);
        }
        await loadBoard();
        if (claimsLoadedRef.current) {
          await loadRewardClaims(true);
        }
      } catch (error) {
        reportError(error, { surface: "reward_return" });
        await loadBoard();
      } finally {
        setReturningClaimById((current) => ({ ...current, [claim.id]: false }));
      }
    },
    [loadBoard, profileId, loadRewardClaims, confirm, applyProfileEconomy],
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

  const toggleHistory = useCallback(() => {
    setShowHistory((current) => {
      const next = !current;
      if (next) {
        void loadHistory();
      }
      return next;
    });
  }, [loadHistory]);

  const toggleTrophyCase = useCallback(() => {
    setShowTrophyCase((current) => {
      const next = !current;
      if (next) {
        void loadRewardClaims();
      }
      return next;
    });
  }, [loadRewardClaims]);

  const deleteMissionAction = useCallback(
    async (mission: MissionWithState) => {
      const ok = await confirm({
        title: "Trash Mission",
        description: `Move "${mission.title}" to trash? You can restore it later from Mission Command.`,
        confirmLabel: "Trash Mission",
        cancelLabel: "Keep Mission",
      });
      if (!ok) {
        return;
      }

      try {
        await deleteMission(mission.id);
        setEffectText("MISSION TRASHED!");
        window.setTimeout(() => setEffectText(null), 900);
        await loadBoard();
        if (historyLoadedRef.current) {
          await loadHistory(true);
        }
      } catch (error) {
        reportError(error, { surface: "mission_delete" });
        await loadBoard();
      }
    },
    [confirm, loadBoard, loadHistory],
  );

  const updateRewardCostAction = useCallback(
    async (reward: Reward, nextCost: number) => {
      const normalizedCost = Math.max(1, Math.min(1000, Math.round(nextCost)));
      if (normalizedCost === reward.pointCost) {
        return;
      }

      setUpdatingRewardById((current) => ({ ...current, [reward.id]: true }));
      setSavedRewardById((current) => ({ ...current, [reward.id]: false }));
      try {
        await updateReward(reward.id, { pointCost: normalizedCost });
        setRewards((current) =>
          current.map((item) =>
            item.id === reward.id ? { ...item, pointCost: normalizedCost } : item,
          ),
        );
        const existingTimer = savedRewardTimersRef.current[reward.id];
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        setSavedRewardById((current) => ({ ...current, [reward.id]: true }));
        savedRewardTimersRef.current[reward.id] = window.setTimeout(() => {
          setSavedRewardById((current) => ({ ...current, [reward.id]: false }));
          delete savedRewardTimersRef.current[reward.id];
        }, 1400);
      } catch (error) {
        reportError(error, { surface: "reward_cost_update" });
        await loadBoard();
      } finally {
        setUpdatingRewardById((current) => ({ ...current, [reward.id]: false }));
      }
    },
    [loadBoard],
  );

  return {
    profile,
    missions,
    squad,
    rewards,
    rewardClaims,
    history,
    claimsLoading,
    historyLoading,
    loading,
    error,
    effectText,
    showPinGate,
    isPressingParentSpot,
    returningClaimById,
    showSquadWin,
    showTrophyCase,
    showHistory,
    unreadNotificationCount,
    updatingRewardById,
    updatingMissionById,
    savedRewardById,
    savedMissionById,
    rewardCooldownById,
    heroLevel,
    personalProgress,
    todayRewardPointsEarned,
    dialogNode,
    showLevelUp,
    levelUpName,
    setShowPinGate,
    dismissSquadWin: () => setShowSquadWin(false),
    dismissLevelUp: () => {
      setShowLevelUp(false);
      setLevelUpName(null);
    },
    completeMissionAction,
    undoMissionAction,
    deleteMissionAction,
    updateMissionAction,
    updateRewardCostAction,
    claimRewardAction,
    returnClaimAction,
    toggleHistory,
    toggleTrophyCase,
    startLongPress,
    stopLongPress,
    reloadBoard: loadBoard,
  };
}
