"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchProfiles } from "@/lib/client-api";
import { AvatarDisplay } from "@/components/avatar-display";
import { heroCardPositionToCssObjectPosition } from "@/lib/hero-card-position";
import { getHeroLevel, getStreakBadge } from "@/lib/hero-levels";
import { Profile } from "@/lib/types/domain";

export function HeroSelect() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchProfiles()
      .then((data) => {
        if (!cancelled) setProfiles(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 md:py-8">
      <header className="mb-5 text-center md:mb-8">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--hero-yellow)]">
          HeroHabits: Super Squad
        </p>
        <h1 className="text-3xl font-black uppercase text-white sm:text-4xl">
          Choose Your Hero
        </h1>
      </header>

      {error ? (
        <p className="rounded-xl border-2 border-red-600 bg-red-100 px-4 py-3 text-red-700">
          {error}
        </p>
      ) : null}

      {loading && !error ? (
        <section className="grid flex-1 gap-4 md:grid-cols-2 md:gap-6">
          {[0, 1].map((slot) => (
            <article
              key={slot}
              className="comic-card min-h-[340px] animate-pulse overflow-hidden"
            >
              <div className="relative h-full min-h-[340px] w-full bg-[var(--hero-blue)]/30">
                <div className="h-full w-full bg-gradient-to-br from-white/10 via-white/0 to-black/10" />
                <div className="absolute inset-x-0 bottom-0 border-t-2 border-black bg-[var(--hero-panel)] px-4 py-3">
                  <div className="h-7 w-2/3 rounded bg-white/20" />
                  <div className="mt-2 h-4 w-1/2 rounded bg-white/15" />
                  <div className="mt-2 h-3 w-1/3 rounded bg-white/10" />
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : profiles.length === 0 && !error ? (
        <section className="mx-auto grid w-full max-w-2xl flex-1 place-items-center">
          <article className="comic-card w-full max-w-xl p-8 text-center">
            <p className="mb-3 text-7xl">🦸‍♀️</p>
            <h2 className="text-3xl font-black uppercase text-white">
              Welcome to HeroHabits!
            </h2>
            <p className="mt-2 text-base font-bold text-white/85">
              Ask a parent to set up your first hero.
            </p>
            <Link
              href="/parent"
              className="mt-6 inline-flex rounded-xl border-2 border-black bg-[var(--hero-yellow)] px-5 py-3 text-sm font-black uppercase text-black shadow-[4px_4px_0_#000]"
            >
              → Parent Setup
            </Link>
          </article>
        </section>
      ) : (
        <section className="grid flex-1 gap-4 md:grid-cols-2 md:gap-6">
          {profiles.map((profile) => (
            <Link
              key={profile.id}
              href={`/hero/${profile.id}`}
              className="comic-card comic-card-interactive group relative min-h-[340px] overflow-hidden"
            >
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const url = `${window.location.origin}/hero/${profile.id}`;
                  void navigator.clipboard.writeText(url).then(() => {
                    setCopiedId(profile.id);
                    window.setTimeout(
                      () => setCopiedId((current) => (current === profile.id ? null : current)),
                      2000,
                    );
                  });
                }}
                className="touch-target absolute top-2 right-2 z-10 rounded-lg border-2 border-black bg-white/95 px-2 py-1 text-xs font-black uppercase text-black"
              >
                Share
              </button>
              {copiedId === profile.id ? (
                <span className="status-chip absolute top-12 right-2 z-10 bg-[var(--hero-yellow)] text-black">
                  Copied!
                </span>
              ) : null}

              <div className="relative h-full min-h-[340px] w-full overflow-hidden bg-[var(--hero-blue)]/30">
                <AvatarDisplay
                  avatarUrl={profile.avatarUrl}
                  alt={profile.heroName}
                  className="grid h-full w-full place-items-center object-cover text-7xl transition duration-300 group-hover:scale-105"
                  objectPosition={heroCardPositionToCssObjectPosition(
                    profile.heroCardObjectPosition,
                  )}
                  textClassName="drop-shadow-[0_3px_0_#000]"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t-2 border-black bg-[var(--hero-panel)] px-4 py-3 text-white">
                  <h2 className="truncate text-2xl font-black uppercase leading-none sm:text-3xl">
                    {profile.heroName}
                  </h2>
                  <p
                    className="mt-1 text-sm font-black uppercase leading-tight"
                    style={{ color: getHeroLevel(profile.powerLevel).color }}
                  >
                    Level: {getHeroLevel(profile.powerLevel).displayName}
                  </p>
                  {profile.currentStreak > 0 ? (
                    <p className="mt-1 text-xs font-bold uppercase leading-tight text-[var(--hero-yellow)]">
                      {getStreakBadge(profile.currentStreak) ?? "🔥"} {profile.currentStreak} Day Streak
                    </p>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}
