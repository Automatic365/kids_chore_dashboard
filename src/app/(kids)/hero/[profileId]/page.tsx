import { MissionBoard } from "@/components/mission-board";

export default async function HeroMissionPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  return <MissionBoard profileId={profileId} />;
}
