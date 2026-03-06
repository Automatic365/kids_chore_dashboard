"use client";

interface LevelUpSectionProps {
  open: boolean;
  heroName: string;
  levelName: string;
  onDismiss: () => void;
}

export function LevelUpSection({
  open,
  heroName,
  levelName,
  onDismiss,
}: LevelUpSectionProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4">
      <div className="w-full max-w-lg rounded-2xl border-4 border-black bg-[var(--hero-yellow)] p-6 text-center text-black shadow-[10px_10px_0_#000]">
        <p className="text-sm font-black uppercase tracking-widest text-[var(--hero-red)]">
          Level Up
        </p>
        <h2 className="mt-2 text-5xl font-black uppercase leading-none">{levelName}</h2>
        <p className="mt-3 text-lg font-bold">{heroName} reached a new hero tier!</p>
        <button
          type="button"
          onClick={onDismiss}
          className="touch-target mt-6 rounded-xl border-2 border-black bg-[var(--hero-blue)] px-6 py-3 text-sm font-black uppercase text-white"
        >
          Keep Going
        </button>
      </div>
    </div>
  );
}
