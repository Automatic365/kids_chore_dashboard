"use client";

import { useEffect, useRef } from "react";

export interface HeroDialogState {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface HeroDialogProps {
  state: HeroDialogState;
  onConfirm: () => void;
  onCancel: () => void;
}

export function HeroDialog({ state, onConfirm, onCancel }: HeroDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (state.open && !dialog.open) {
      dialog.showModal();
      return;
    }

    if (!state.open && dialog.open) {
      dialog.close();
    }
  }, [state.open]);

  return (
    <dialog
      ref={dialogRef}
      className="hero-dialog w-[min(92vw,540px)] rounded-2xl border-4 border-black bg-[var(--hero-panel)] p-0 text-white shadow-[10px_10px_0_#000]"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) {
          onCancel();
        }
      }}
    >
      <div className="p-5">
        <h2 className="text-2xl font-black uppercase text-[var(--hero-yellow)]">
          {state.title}
        </h2>
        <p className="mt-2 text-sm font-bold text-white/90">{state.description}</p>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="touch-target flex-1 rounded-xl border-2 border-black bg-white px-4 py-2 text-sm font-black uppercase text-black"
          >
            {state.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="touch-target flex-1 rounded-xl border-2 border-black bg-[var(--hero-red)] px-4 py-2 text-sm font-black uppercase text-white"
          >
            {state.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
