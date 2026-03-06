"use client";

interface SecretCodeSectionProps {
  code: string;
}

export function SecretCodeSection({ code }: SecretCodeSectionProps) {
  return (
    <section className="mb-4 rounded-2xl border-4 border-black bg-[var(--hero-yellow)] p-4 text-black shadow-[6px_6px_0_#000]">
      <p className="text-xs font-bold uppercase tracking-wide">Hero Gadget Unlocked</p>
      <p className="text-3xl font-black uppercase">{code}</p>
    </section>
  );
}
