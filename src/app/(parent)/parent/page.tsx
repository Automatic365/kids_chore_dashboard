import Link from "next/link";

import { ParentDashboard } from "@/components/parent-dashboard";

export default function ParentPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl p-4 text-white sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--hero-yellow)]">
          Parent Access
        </h1>
        <Link href="/" className="text-sm font-bold uppercase underline">
          Back to Heroes
        </Link>
      </div>
      <ParentDashboard />
    </main>
  );
}
