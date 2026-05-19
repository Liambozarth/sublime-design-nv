import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { requireAdminApiSession, unauthorizedResponse } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await requireAdminApiSession();
  if (!session) return unauthorizedResponse();

  const body = await req.json();
  const { name, slug, website, description } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
  }

  const manufacturer = await prisma.manufacturer.create({
    data: {
      name,
      slug,
      website: website || null,
      description: description || null,
    },
    include: { _count: { select: { materials: true } } },
  });

  return NextResponse.json(manufacturer, { status: 201 });
}
