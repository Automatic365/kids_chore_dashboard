"use client";

import { useCallback, useRef, useState } from "react";

import { HeroDialog, HeroDialogState } from "@/components/ui/hero-dialog";

interface ConfirmDialogOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

const CLOSED_STATE: HeroDialogState = {
  open: false,
  title: "",
  description: "",
  confirmLabel: "Confirm",
  cancelLabel: "Cancel",
};

export function useHeroDialog() {
  const [state, setState] = useState<HeroDialogState>(CLOSED_STATE);
  const resolverRef = useRef<((accepted: boolean) => void) | null>(null);

  const closeDialog = useCallback((accepted: boolean) => {
    resolverRef.current?.(accepted);
    resolverRef.current = null;
    setState(CLOSED_STATE);
  }, []);

  const confirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      if (resolverRef.current) {
        resolverRef.current(false);
      }
      resolverRef.current = resolve;
      setState({
        open: true,
        title: options.title,
        description: options.description,
        confirmLabel: options.confirmLabel ?? "Confirm",
        cancelLabel: options.cancelLabel ?? "Cancel",
      });
    });
  }, []);

  const dialogNode = (
    <HeroDialog
      state={state}
      onCancel={() => closeDialog(false)}
      onConfirm={() => closeDialog(true)}
    />
  );

  return {
    confirm,
    dialogNode,
    isOpen: state.open,
  };
}
