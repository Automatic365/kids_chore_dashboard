"use client";

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  claimReward,
  completeMission,
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
  heroLevel: ReturnType<typeof getHeroLevel> | null;
  personalProgress: number;
  dialogNode: ReactNode;
  showLevelUp: boolean;
  levelUpName: string | null;
  setShowPinGate: (show: boolean) => void;
  dismissSquadWin: () => void;
  dismissLevelUp: () => void;
  completeMissionAction: (mission: MissionWithState) => Promise<void>;
  undoMissionAction: (mission: MissionWithState) => Promise<void>;
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
  const { confirm, dialogNode } = useHeroDialog();

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const claimsLoadedRef = useRef(false);
  const historyLoadedRef = useRef(false);
  const claimsLoadingRef = useRef(false);
  const historyLoadingRef = useRef(false);

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

  const applyProfilePowerLevel = useCallback((nextPowerLevel: number, previousPowerLevel?: number) => {
    setProfile((current) => {
      if (!current) return current;
      const baselinePowerLevel = previousPowerLevel ?? current.powerLevel;
      if (didHeroLevelIncrease(baselinePowerLevel, nextPowerLevel)) {
        setLevelUpName(getHeroLevel(nextPowerLevel).name);
        setShowLevelUp(true);
      }
      return { ...current, powerLevel: nextPowerLevel };
    });
  }, []);

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
      const [profiles, missionRows, squadState, rewardRows, unreadCount] = await Promise.all([
        fetchProfiles(),
        fetchMissions(profileId),
        fetchSquadState(),
        fetchRewards(),
        fetchUnreadNotificationCount(),
      ]);

      const activeProfile = profiles.find((item) => item.id === profileId) ?? null;
      setProfile(activeProfile);
      setMissions(missionRows);
      setSquad(squadState);
      setRewards(rewardRows);
      setUnreadNotificationCount(unreadCount);
      setError(null);

      if (claimsLoadedRef.current) {
        void loadRewardClaims(true);
      }
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
  }, [profileId, loadHistory, loadRewardClaims]);

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
  }, [profileId]);

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
        applyProfilePowerLevel(result.profilePowerLevel, profile.powerLevel);
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
        applyProfilePowerLevel(result.profilePowerLevel, profile.powerLevel);
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
    [profile, profileId, squad, remoteEnabled, loadHistory, applyProfilePowerLevel],
  );

  const undoMissionAction = useCallback(
    async (mission: MissionWithState) => {
      if (!mission.completedToday || !profile || !squad) {
        return;
      }

      const optimisticPower = Math.max(0, profile.powerLevel - mission.powerValue);
      const optimisticSquad = Math.max(0, squad.squadPowerCurrent - mission.powerValue);

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
            const neededPower = Math.max(0, mission.powerValue - result.profilePowerLevel);
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
              const ok = await confirm({
                title: "Undo Is Locked",
                description: `Return ${claimsToReturn.length} reward(s) (${recovered} power) to undo this mission?\n${label}`,
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
                  setProfile((current) =>
                    current ? { ...current, powerLevel: retry.profilePowerLevel } : current,
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
        if (historyLoadedRef.current) {
          void loadHistory(true);
        }
      } catch (error) {
        reportError(error, { surface: "mission_undo" });
        await loadBoard();
      }
    },
    [loadBoard, profile, profileId, rewardClaims, squad, remoteEnabled, loadHistory, confirm],
  );

  const claimRewardAction = useCallback(
    async (reward: Reward) => {
      if (!profile) {
        return;
      }
      if (profile.powerLevel < reward.pointCost) {
        return;
      }

      const ok = await confirm({
        title: "Claim Reward",
        description: `Claim "${reward.title}" for ${reward.pointCost} power points?`,
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
          setProfile((current) =>
            current ? { ...current, powerLevel: result.newPowerLevel } : current,
          );
          setEffectText("REWARD UNLOCKED!");
          window.setTimeout(() => setEffectText(null), 1000);
        }
        await loadBoard();
        if (claimsLoadedRef.current) {
          await loadRewardClaims(true);
        }
      } catch (error) {
        reportError(error, { surface: "reward_claim" });
        await loadBoard();
      }
    },
    [loadBoard, profile, profileId, loadRewardClaims, confirm],
  );

  const returnClaimAction = useCallback(
    async (claim: RewardClaimEntry) => {
      const ok = await confirm({
        title: "Give Back Reward",
        description: `Give back "${claim.title}" and restore ${claim.pointCost} power?`,
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
          setProfile((current) =>
            current ? { ...current, powerLevel: result.newPowerLevel } : current,
          );
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
    [loadBoard, profileId, loadRewardClaims, confirm],
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
    heroLevel,
    personalProgress,
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
    claimRewardAction,
    returnClaimAction,
    toggleHistory,
    toggleTrophyCase,
    startLongPress,
    stopLongPress,
    reloadBoard: loadBoard,
  };
}
