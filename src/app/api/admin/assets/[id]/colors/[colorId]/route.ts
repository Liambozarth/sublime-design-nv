import { NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { requireAdminApiSession, unauthorizedResponse } from "@/lib/auth";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; colorId: string } },
) {
  const session = await requireAdminApiSession();
  if (!session) return unauthorizedResponse();

  // colorId is the AssetPaintColor join record id (tagId)
  await prisma.assetPaintColor.deleteMany({
    where: { id: params.colorId, assetId: params.id },
  });

  return NextResponse.json({ success: true });
}
