"use client";

import Link from "next/link";
import { CSSProperties } from "react";

import { getHeroLevelProgress, getStreakBadge } from "@/lib/hero-levels";
import { Profile, SquadState } from "@/lib/types/domain";

interface HeroLevelInfo {
  name: string;
  color: string;
  nextPower: number | null;
}

interface SquadSectionProps {
  profile: Profile;
  squad: SquadState;
  heroLevel: HeroLevelInfo | null;
  personalProgress: number;
  unreadNotificationCount: number;
  isPressingParentSpot: boolean;
  onLongPressStart: () => void;
  onLongPressEnd: () => void;
  showSquadWin: boolean;
  onDismissSquadWin: () => void;
}

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

export function SquadSection({
  profile,
  squad,
  heroLevel,
  personalProgress,
  unreadNotificationCount,
  isPressingParentSpot,
  onLongPressStart,
  onLongPressEnd,
  showSquadWin,
  onDismissSquadWin,
}: SquadSectionProps) {
  const levelProgress = getHeroLevelProgress(profile.powerLevel);

  return (
    <>
      <button
        type="button"
        aria-label="Parent control"
        className={`absolute top-2 left-2 z-40 rounded-xl border-2 border-black px-3 py-2 text-left shadow-[4px_4px_0_#000] transition relative ${
          isPressingParentSpot
            ? "scale-95 bg-[var(--hero-yellow)] text-black"
            : "bg-white/95 text-black"
        }`}
        onPointerDown={onLongPressStart}
        onPointerUp={onLongPressEnd}
        onPointerLeave={onLongPressEnd}
        onPointerCancel={onLongPressEnd}
      >
        <p className="text-[10px] font-black uppercase leading-tight">Parent</p>
        <p className="text-[10px] font-bold uppercase leading-tight">Hold 3s</p>
        {unreadNotificationCount > 0 ? (
          <span
            data-testid="parent-unread-badge"
            className="absolute -top-2 -right-2 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border-2 border-black bg-[var(--hero-red)] px-1 text-[10px] font-black uppercase text-white"
          >
            {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
          </span>
        ) : null}
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
              <span>Today&apos;s Progress</span>
              <span>{profile.powerLevel}</span>
            </div>
            <div className="meter-wrap">
              <div className="meter-fill" style={{ width: `${personalProgress}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-white/90">
              <span>Level XP</span>
              <span>
                {profile.powerLevel}
                {levelProgress.nextPower ? ` / ${levelProgress.nextPower}` : " / Max"}
              </span>
            </div>
            <div className="meter-wrap h-3 bg-white/20">
              <div
                className="meter-fill bg-[var(--hero-yellow)]"
                style={{ width: `${levelProgress.progressPercent}%` }}
              />
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
          {squad.goalCompletionCount > 0 ? (
            <p className="mt-1 text-xs font-black uppercase tracking-wide text-black/60">
              ★ Completed {squad.goalCompletionCount}×
            </p>
          ) : null}
        </section>
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
                } as CSSProperties}
              />
            ))}
            <p className="squad-win-text text-xs font-black uppercase tracking-widest text-[var(--hero-yellow)]">
              {profile.heroName} &amp; The Squad
            </p>
            <p
              className="squad-win-text text-7xl font-black uppercase leading-none text-[var(--hero-yellow)] sm:text-9xl"
              style={{
                textShadow:
                  "4px 4px 0 #000, -4px -4px 0 #000, 4px -4px 0 #000, -4px 4px 0 #000",
              }}
            >
              SQUAD WINS!
            </p>
            <p className="squad-win-text text-lg font-bold text-white/80">
              Full power achieved. Heroes unite!
            </p>
            <button
              type="button"
              onClick={onDismissSquadWin}
              className="squad-win-text rounded-2xl border-4 border-black bg-[var(--hero-yellow)] px-8 py-4 text-xl font-black uppercase text-black shadow-[6px_6px_0_#000]"
            >
              Keep Going!
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
