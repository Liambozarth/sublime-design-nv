import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { requireAdminApiSession, unauthorizedResponse } from "@/lib/auth";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdminApiSession();
  if (!session) return unauthorizedResponse();

  const { id } = params;

  await prisma.manufacturer.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAdminApiSession();
  if (!session) return unauthorizedResponse();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if ("name" in body) data.name = body.name;
  if ("slug" in body) data.slug = body.slug;
  if ("website" in body) data.website = body.website;
  if ("description" in body) data.description = body.description;
  if ("logoUrl" in body) data.logoUrl = body.logoUrl;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "NO_FIELDS" }, { status: 400 });
  }

  try {
    const updated = await prisma.manufacturer.update({
      where: { id: params.id },
      data,
      include: { _count: { select: { materials: true } } },
    });
    return NextResponse.json({ ok: true, item: updated });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2025") {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    if (code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "UNIQUE_CONSTRAINT", detail: "A record with that value already exists." },
        { status: 409 },
      );
    }
    throw err;
  }
}
