import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { requireAdminApiSession, unauthorizedResponse } from "@/lib/auth";
import { slugify } from "@/lib/seo";

export async function POST(req: NextRequest) {
  const session = await requireAdminApiSession();
  if (!session) return unauthorizedResponse();

  const body = await req.json();
  const { name, website, description } = body;
  // Derive slug from name when the client doesn't supply one. Edit forms send
  // slug explicitly; Create forms don't include a slug input.
  const rawSlug = body.slug;
  const slug = (typeof rawSlug === "string" && rawSlug.trim().length > 0)
    ? rawSlug.trim()
    : slugify(typeof name === "string" ? name : "");

  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!slug) {
    return NextResponse.json(
      { ok: false, error: "INVALID_NAME", detail: "Name must produce a valid slug." },
      { status: 400 },
    );
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
