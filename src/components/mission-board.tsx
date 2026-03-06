"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { HistorySection } from "@/components/board/history-section";
import { MissionsSection } from "@/components/board/missions-section";
import { ParentPinGate } from "@/components/board/parent-pin-gate";
import { RewardsSection } from "@/components/board/rewards-section";
import { SecretCodeSection } from "@/components/board/secret-code-section";
import { SquadSection } from "@/components/board/squad-section";
import { TrophyCaseSection } from "@/components/board/trophy-case-section";
import { useMissionBoardController } from "@/components/board/use-mission-board-controller";
import { loginParent } from "@/lib/client-api";

interface MissionBoardProps {
  profileId: string;
}

const SECRET_HERO_CODE_THRESHOLD = 60;
const SECRET_HERO_CODE_VALUE = "COMET-77";

export function MissionBoard({ profileId }: MissionBoardProps) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);

  const {
    profile,
    missions,
    squad,
    rewards,
    rewardClaims,
    history,
    claimsLoading,
    historyLoading,
    loading,
    error,
    effectText,
    showPinGate,
    isPressingParentSpot,
    returningClaimById,
    showSquadWin,
    showTrophyCase,
    showHistory,
    heroLevel,
    personalProgress,
    setShowPinGate,
    dismissSquadWin,
    completeMissionAction,
    undoMissionAction,
    claimRewardAction,
    returnClaimAction,
    toggleHistory,
    toggleTrophyCase,
    startLongPress,
    stopLongPress,
  } = useMissionBoardController(profileId);

  const closePinGate = useCallback(() => {
    setShowPinGate(false);
    setPinError(null);
  }, [setShowPinGate]);

  const handleParentLogin = useCallback(async () => {
    const ok = await loginParent(pin);
    if (!ok) {
      setPinError("PIN is incorrect");
      return;
    }

    setShowPinGate(false);
    setPin("");
    setPinError(null);
    router.push("/parent");
  }, [pin, router, setShowPinGate]);

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-7xl p-6 text-white">
        <p className="text-xl font-bold uppercase">Loading Mission Control...</p>
      </main>
    );
  }

  if (!profile || !squad) {
    return (
      <main className="mx-auto min-h-screen max-w-7xl p-6 text-white">
        <p className="rounded-xl border-2 border-red-600 bg-red-100 px-4 py-3 text-red-700">
          {error ?? "Profile not found."}
        </p>
        <Link href="/" className="mt-4 inline-flex text-white underline">
          Back to Hero Select
        </Link>
      </main>
    );
  }

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 text-white sm:px-6">
      <SquadSection
        profile={profile}
        squad={squad}
        heroLevel={heroLevel}
        personalProgress={personalProgress}
        isPressingParentSpot={isPressingParentSpot}
        onLongPressStart={startLongPress}
        onLongPressEnd={stopLongPress}
        showSquadWin={showSquadWin}
        onDismissSquadWin={dismissSquadWin}
      />

      {profile.uiMode === "text" && profile.powerLevel >= SECRET_HERO_CODE_THRESHOLD ? (
        <SecretCodeSection code={SECRET_HERO_CODE_VALUE} />
      ) : null}

      <MissionsSection
        missions={missions}
        profile={profile}
        onComplete={completeMissionAction}
        onUndo={undoMissionAction}
        effectText={effectText}
      />

      <RewardsSection
        rewards={rewards}
        profile={profile}
        onClaim={claimRewardAction}
      />

      <TrophyCaseSection
        rewardClaims={rewardClaims}
        show={showTrophyCase}
        loading={claimsLoading}
        onToggle={toggleTrophyCase}
        onReturn={returnClaimAction}
        returningClaimById={returningClaimById}
      />

      <HistorySection
        history={history}
        show={showHistory}
        loading={historyLoading}
        onToggle={toggleHistory}
      />

      {showPinGate ? (
        <ParentPinGate
          pin={pin}
          pinError={pinError}
          onPinChange={setPin}
          onCancel={closePinGate}
          onSubmit={handleParentLogin}
        />
      ) : null}
    </main>
  );
}
