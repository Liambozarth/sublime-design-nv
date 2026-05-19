import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { requireAdminApiSession, unauthorizedResponse } from "@/lib/auth";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdminApiSession();
  if (!session) return unauthorizedResponse();

  const { id } = params;

  try {
    await prisma.supplier.delete({ where: { id } });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "P2003") {
      return NextResponse.json(
        { ok: false, error: "IN_USE", detail: "This supplier is referenced by other records and cannot be deleted." },
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
  if ("phone" in body) data.phone = body.phone;
  if ("address" in body) data.address = body.address;
  if ("city" in body) data.city = body.city;
  if ("state" in body) data.state = body.state;
  if ("description" in body) data.description = body.description;
  if ("logoUrl" in body) data.logoUrl = body.logoUrl;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: "NO_FIELDS" }, { status: 400 });
  }

  try {
    const updated = await prisma.supplier.update({
      where: { id: params.id },
      data,
      include: { _count: { select: { pricing: true } } },
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
