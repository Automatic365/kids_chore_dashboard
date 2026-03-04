"use client";

import { useState } from "react";

import { changeParentPin } from "@/lib/client-api";

interface PinChangeSectionProps {
  pushToast: (type: "success" | "error", text: string) => void;
}

export function PinChangeSection({ pushToast }: PinChangeSectionProps) {
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (newPin.length < 4 || !/^\d+$/.test(newPin)) {
      setError("PIN must be 4–8 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("PINs do not match.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await changeParentPin(newPin);
      pushToast("success", "PIN changed successfully.");
      setNewPin("");
      setConfirmPin("");
    } catch {
      setError("Failed to change PIN.");
      pushToast("error", "Failed to change PIN.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="comic-card p-4">
      <h2 className="text-xl font-black uppercase text-white">Change PIN</h2>
      <form onSubmit={(e) => void handleSubmit(e)} className="mt-3 grid gap-2 sm:grid-cols-2">
        <input
          type="password"
          inputMode="numeric"
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
          placeholder="New PIN (4–8 digits)"
          maxLength={8}
          pattern="\d{4,8}"
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
          required
        />
        <input
          type="password"
          inputMode="numeric"
          value={confirmPin}
          onChange={(e) => setConfirmPin(e.target.value)}
          placeholder="Confirm PIN"
          maxLength={8}
          className="rounded-lg border-2 border-black bg-white px-3 py-2 text-black"
          required
        />
        {error ? (
          <p className="text-sm font-bold text-red-200 sm:col-span-2">{error}</p>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl border-2 border-black bg-[var(--hero-blue)] px-4 py-2 text-sm font-black uppercase text-white disabled:opacity-60 sm:col-span-2"
        >
          {saving ? "Saving…" : "Update PIN"}
        </button>
      </form>
    </section>
  );
}
