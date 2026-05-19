import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { requireAdminApiSession, unauthorizedResponse } from "@/lib/auth";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdminApiSession();
  if (!session) return unauthorizedResponse();

  const { id } = params;

  try {
    await prisma.material.delete({ where: { id } });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2003") {
      return NextResponse.json(
        { ok: false, error: "IN_USE", detail: "This material is referenced by other records and cannot be deleted." },
        { status: 409 },
      );
    }
    if (code === "P2025") {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    throw err;
  }

  return NextResponse.json({ success: true });
}

// Whitelist of Material fields admins can patch. FK columns (categoryId,
// manufacturerId) are deliberately excluded — re-parenting a material has
// invariants (supplier pricing, asset references) that deserve a dedicated
// endpoint if it's ever needed.
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
  if ("sku" in body) data.sku = body.sku;
  if ("description" in body) data.description = body.description;
  if ("imageUrl" in body) data.imageUrl = body.imageUrl;
  if ("isPublic" in body) data.isPublic = body.isPublic;
  if ("grade" in body) data.grade = body.grade;
  if ("sheen" in body) data.sheen = body.sheen;
  if ("finish" in body) data.finish = body.finish;
  if ("thickness" in body) data.thickness = body.thickness;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "NO_FIELDS" }, { status: 400 });
  }

  try {
    const updated = await prisma.material.update({
      where: { id: params.id },
      data,
      include: {
        category: { select: { name: true } },
        manufacturer: { select: { name: true } },
        _count: { select: { pricing: true } },
      },
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
