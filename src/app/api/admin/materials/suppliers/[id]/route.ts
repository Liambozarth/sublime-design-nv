import { NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { requireAdminApiSession, unauthorizedResponse } from "@/lib/auth";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdminApiSession();
  if (!session) return unauthorizedResponse();

  const { id } = params;

  await prisma.supplier.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
