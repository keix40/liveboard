import { notFound } from "next/navigation";
import { isValidRoomId } from "@liveboard/shared";
import { BoardClient } from "@/components/BoardClient";

export default async function BoardPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  if (!isValidRoomId(roomId)) notFound();
  return <BoardClient roomId={roomId} />;
}
