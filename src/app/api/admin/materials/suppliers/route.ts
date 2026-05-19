import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { requireAdminApiSession, unauthorizedResponse } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await requireAdminApiSession();
  if (!session) return unauthorizedResponse();

  const body = await req.json();
  const { name, slug, website, phone, address, city, state, description } = body;

  if (!name || !slug) {
    return NextResponse.json({ error: "name and slug are required" }, { status: 400 });
  }

  const supplier = await prisma.supplier.create({
    data: {
      name,
      slug,
      website: website || null,
      phone: phone || null,
      address: address || null,
      city: city || null,
      state: state || null,
      description: description || null,
    },
    include: { _count: { select: { pricing: true } } },
  });

  return NextResponse.json(supplier, { status: 201 });
}
