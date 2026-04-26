"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { HistorySection } from "@/components/board/history-section";
import { LevelUpSection } from "@/components/board/level-up-section";
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
  const [boardEditMode, setBoardEditMode] = useState(false);

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
    unreadNotificationCount,
    updatingRewardById,
    updatingMissionById,
    savedRewardById,
    savedMissionById,
    rewardCooldownById,
    heroLevel,
    personalProgress,
    todayRewardPointsEarned,
    dialogNode,
    showLevelUp,
    levelUpName,
    setShowPinGate,
    dismissSquadWin,
    dismissLevelUp,
    completeMissionAction,
    undoMissionAction,
    deleteMissionAction,
    updateMissionAction,
    updateRewardCostAction,
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

  const handleParentDashboardLogin = useCallback(async () => {
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

  const handleBoardEditLogin = useCallback(async () => {
    const ok = await loginParent(pin);
    if (!ok) {
      setPinError("PIN is incorrect");
      return;
    }

    setShowPinGate(false);
    setPin("");
    setPinError(null);
    setBoardEditMode(true);
  }, [pin, setShowPinGate]);

  if (loading) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-4 text-white sm:px-6">
        <section className="comic-card mb-4 p-4">
          <div className="h-5 w-40 animate-pulse rounded bg-white/20" />
          <div className="mt-3 h-3 w-full animate-pulse rounded bg-white/15" />
          <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-white/10" />
        </section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <article
              key={`mission-skeleton-${index}`}
              className="comic-card min-h-[190px] animate-pulse p-4"
            >
              <div className="h-24 w-full rounded bg-white/10" />
              <div className="mt-3 h-4 w-3/4 rounded bg-white/15" />
              <div className="mt-2 h-3 w-full rounded bg-white/10" />
            </article>
          ))}
        </section>
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
        completedCount={missions.filter((mission) => mission.completedToday).length}
        missionCount={missions.length}
        todayRewardPointsEarned={todayRewardPointsEarned}
        unreadNotificationCount={unreadNotificationCount}
        isPressingParentSpot={isPressingParentSpot}
        onLongPressStart={startLongPress}
        onLongPressEnd={stopLongPress}
        showSquadWin={showSquadWin}
        onDismissSquadWin={dismissSquadWin}
      />

      {profile.uiMode === "text" && profile.rewardPoints >= SECRET_HERO_CODE_THRESHOLD ? (
        <SecretCodeSection code={SECRET_HERO_CODE_VALUE} />
      ) : null}

      {boardEditMode ? (
        <section className="comic-card mb-4 flex items-center justify-between gap-3 p-3">
          <p className="text-sm font-black uppercase text-white">
            Board Edit Mode: edit or trash missions here and update reward costs without leaving this hero&apos;s board.
          </p>
          <button
            type="button"
            onClick={() => setBoardEditMode(false)}
            className="rounded-xl border-2 border-black bg-white px-4 py-2 text-sm font-black uppercase text-black"
          >
            Done Editing
          </button>
        </section>
      ) : null}

      <MissionsSection
        missions={missions}
        profile={profile}
        boardEditMode={boardEditMode}
        updatingMissionById={updatingMissionById}
        savedMissionById={savedMissionById}
        onComplete={completeMissionAction}
        onUndo={undoMissionAction}
        onDelete={deleteMissionAction}
        onUpdate={updateMissionAction}
        effectText={effectText}
      />

      <RewardsSection
        rewards={rewards}
        profile={profile}
        boardEditMode={boardEditMode}
        updatingRewardById={updatingRewardById}
        savedRewardById={savedRewardById}
        rewardCooldownById={rewardCooldownById}
        onClaim={claimRewardAction}
        onUpdateCost={updateRewardCostAction}
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
          onDashboardSubmit={handleParentDashboardLogin}
          onBoardEditSubmit={handleBoardEditLogin}
        />
      ) : null}

      <LevelUpSection
        open={showLevelUp}
        heroName={profile.heroName}
        levelName={levelUpName ?? heroLevel?.name ?? "Hero"}
        onDismiss={dismissLevelUp}
      />

      {dialogNode}
    </main>
  );
}
