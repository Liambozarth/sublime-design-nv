import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { requireAdminApiSession, unauthorizedResponse } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdminApiSession();
  if (!session) return unauthorizedResponse();

  const tags = await prisma.assetPaintColor.findMany({
    where: { assetId: params.id },
    include: {
      paintColor: {
        select: { id: true, name: true, number: true, code: true, brand: true, hex: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(tags.map((t) => ({ tagId: t.id, ...t.paintColor })));
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdminApiSession();
  if (!session) return unauthorizedResponse();

  const body = await req.json() as { paintColorId?: string };
  if (!body.paintColorId) {
    return NextResponse.json({ error: "paintColorId is required" }, { status: 400 });
  }

  const tag = await prisma.assetPaintColor.upsert({
    where: { assetId_paintColorId: { assetId: params.id, paintColorId: body.paintColorId } },
    update: {},
    create: { assetId: params.id, paintColorId: body.paintColorId },
    include: {
      paintColor: {
        select: { id: true, name: true, number: true, code: true, brand: true, hex: true },
      },
    },
  });

  return NextResponse.json({ tagId: tag.id, ...tag.paintColor }, { status: 201 });
}
