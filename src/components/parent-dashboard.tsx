"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchParentDashboard, loginParent, logoutParent } from "@/lib/client-api";
import { ParentDashboardData } from "@/lib/types/domain";

import { AddMissionSection } from "@/components/parent/add-mission-section";
import { AiGeneratorSection } from "@/components/parent/ai-generator-section";
import { ManageMissionsSection } from "@/components/parent/manage-missions-section";
import { PinChangeSection } from "@/components/parent/pin-change-section";
import { ProfileManagerSection } from "@/components/parent/profile-manager-section";
import { SquadControlSection } from "@/components/parent/squad-control-section";
import { TrashSection } from "@/components/parent/trash-section";

interface ToastMessage {
  id: string;
  type: "success" | "error";
  text: string;
}

export function ParentDashboard() {
  const [pin, setPin] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<ParentDashboardData | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const pushToast = useCallback((type: ToastMessage["type"], text: string) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((current) => [...current.slice(-2), { id, type, text }]);
    const timer = setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 3000);
    toastTimers.current.push(timer);
  }, []);

  useEffect(() => {
    const timers = toastTimers.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchParentDashboard();
      setDashboard(data);
      setAuthError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message === "UNAUTHORIZED") {
        setDashboard(null);
      }
      setAuthError(message === "UNAUTHORIZED" ? null : message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async () => {
    const ok = await loginParent(pin);
    if (!ok) {
      setAuthError("Invalid PIN");
      return;
    }
    setPin("");
    setAuthError(null);
    await refresh();
  }, [pin, refresh]);

  const logout = useCallback(async () => {
    await logoutParent();
    setDashboard(null);
  }, []);

  if (loading) {
    return <p className="text-white">Loading parent dashboard...</p>;
  }

  if (!dashboard) {
    return (
      <section className="mx-auto w-full max-w-md rounded-2xl border-4 border-black bg-white p-5 text-black shadow-[8px_8px_0_#000]">
        <h1 className="text-2xl font-black uppercase">Mission Command</h1>
        <p className="mt-1 text-sm">Enter parent PIN to continue.</p>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void login();
          }}
          className="mt-4 w-full rounded-xl border-2 border-black px-3 py-3 text-xl tracking-[0.3em]"
          placeholder="••••"
          autoFocus
        />
        {authError ? <p className="mt-2 text-sm text-red-600">{authError}</p> : null}
        <button
          type="button"
          onClick={() => void login()}
          className="mt-4 w-full rounded-xl border-2 border-black bg-[var(--hero-red)] px-4 py-3 font-black uppercase text-white"
        >
          Unlock
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-2 py-4 sm:px-4">
      {toasts.length > 0 ? (
        <div className="pointer-events-none fixed top-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`rounded-xl border-2 border-black px-3 py-2 text-sm font-bold shadow-[4px_4px_0_#000] ${
                toast.type === "success"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {toast.text}
            </div>
          ))}
        </div>
      ) : null}

      <SquadControlSection
        squad={dashboard.squad}
        cycleDate={dashboard.squad.cycleDate}
        onRefresh={refresh}
        pushToast={pushToast}
        onLogout={() => void logout()}
      />

      <ProfileManagerSection
        profiles={dashboard.profiles}
        onRefresh={refresh}
        pushToast={pushToast}
      />

      <AddMissionSection
        profiles={dashboard.profiles}
        onRefresh={refresh}
        pushToast={pushToast}
      />

      <AiGeneratorSection
        profiles={dashboard.profiles}
        onRefresh={refresh}
        pushToast={pushToast}
      />

      <ManageMissionsSection
        missions={dashboard.missions}
        onRefresh={refresh}
        pushToast={pushToast}
      />

      <TrashSection
        missions={dashboard.trashedMissions}
        onRefresh={refresh}
        pushToast={pushToast}
      />

      <PinChangeSection pushToast={pushToast} />
    </section>
  );
}
