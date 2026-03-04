"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  completeMission,
  fetchMissions,
  fetchProfiles,
  fetchSquadState,
  isRemoteApiEnabled,
  loginParent,
  uncompleteMission,
} from "@/lib/client-api";
import {
  enqueueCompletion,
  flushCompletionQueue,
  CompletionQueueItem,
} from "@/lib/offline/queue";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { MissionWithState, Profile, SquadState } from "@/lib/types/domain";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [effectText, setEffectText] = useState<string | null>(null);
  const [showPinGate, setShowPinGate] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [isPressingParentSpot, setIsPressingParentSpot] = useState(false);
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

  const loadBoard = useCallback(async () => {
    try {
      setLoading(true);
      const [profiles, missionRows, squadState] = await Promise.all([
        fetchProfiles(),
        fetchMissions(profileId),
        fetchSquadState(),
      ]);

      const activeProfile = profiles.find((item) => item.id === profileId) ?? null;
      setProfile(activeProfile);
      setMissions(missionRows);
      setSquad(squadState);
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

      try {
        const result = await uncompleteMission({
          missionId: mission.id,
          profileId,
        });

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
      } catch {
        await loadBoard();
      }
    },
    [loadBoard, profile, profileId, squad],
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
              <span className="absolute top-2 right-2 z-10 rounded-full border-2 border-black bg-[var(--hero-yellow)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-black">
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
                    className="rounded-xl border-2 border-black bg-white px-4 py-2 text-sm font-black uppercase text-black shadow-[4px_4px_0_#000]"
                  >
                    Undo
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        ))}
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
