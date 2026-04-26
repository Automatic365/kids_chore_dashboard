"use client";

interface ParentPinGateProps {
  pin: string;
  pinError: string | null;
  onPinChange: (value: string) => void;
  onCancel: () => void;
  onDashboardSubmit: () => void | Promise<void>;
  onBoardEditSubmit: () => void | Promise<void>;
}

export function ParentPinGate({
  pin,
  pinError,
  onPinChange,
  onCancel,
  onDashboardSubmit,
  onBoardEditSubmit,
}: ParentPinGateProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-2xl border-4 border-black bg-white p-5 text-black shadow-[8px_8px_0_#000]">
        <h2 className="text-2xl font-black uppercase">Mission Command PIN</h2>
        <p className="mt-1 text-sm">Parents only. Open the dashboard or unlock board edit mode.</p>

        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(event) => onPinChange(event.target.value)}
          className="mt-4 w-full rounded-xl border-2 border-black px-3 py-3 text-xl tracking-[0.3em]"
          placeholder="••••"
        />
        {pinError ? <p className="mt-2 text-sm text-red-600">{pinError}</p> : null}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border-2 border-black bg-zinc-100 px-3 py-2 font-bold uppercase"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onBoardEditSubmit()}
            className="flex-1 rounded-xl border-2 border-black bg-[var(--hero-yellow)] px-3 py-2 font-bold uppercase text-black"
          >
            Edit Board
          </button>
          <button
            type="button"
            onClick={() => void onDashboardSubmit()}
            className="flex-1 rounded-xl border-2 border-black bg-[var(--hero-red)] px-3 py-2 font-bold uppercase text-white"
          >
            Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
