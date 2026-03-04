"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchProfiles } from "@/lib/client-api";
import { Profile } from "@/lib/types/domain";

export function HeroSelect() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void fetchProfiles()
      .then((data) => {
        if (!cancelled) setProfiles(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
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

      <section className="grid flex-1 gap-4 md:grid-cols-2 md:gap-6">
        {profiles.map((profile) => (
          <Link
            key={profile.id}
            href={`/hero/${profile.id}`}
            className="comic-card comic-card-interactive group flex min-h-[280px] flex-col overflow-hidden"
          >
            <div className="relative h-48 w-full overflow-hidden bg-[var(--hero-blue)]/30 md:h-64">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={profile.avatarUrl}
                alt={profile.heroName}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
            </div>
            <div className="flex flex-1 flex-col justify-center gap-2 p-4 text-center md:p-5">
              <h2 className="text-3xl font-black uppercase text-white sm:text-4xl">
                {profile.heroName}
              </h2>
              <p className="text-base font-semibold uppercase tracking-wide text-white/80">
                {profile.uiMode === "text" ? "Team Captain Mode" : "Super-Tot Mode"}
              </p>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
