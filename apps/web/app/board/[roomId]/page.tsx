import { notFound } from "next/navigation";
import { isValidRoomId } from "@liveboard/shared";
import { Whiteboard } from "@/components/Whiteboard";

export default async function BoardPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  if (!isValidRoomId(roomId)) notFound();
  return <Whiteboard roomId={roomId} />;
}
