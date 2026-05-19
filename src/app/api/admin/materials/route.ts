import { NextRequest, NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { requireAdminApiSession, unauthorizedResponse } from "@/lib/auth";

export async function GET() {
  const session = await requireAdminApiSession();
  if (!session) return unauthorizedResponse();

  const [materials, manufacturers, suppliers, categories] = await Promise.all([
    prisma.material.findMany({
      include: {
        category: { select: { name: true } },
        manufacturer: { select: { name: true } },
        _count: { select: { pricing: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.manufacturer.findMany({
      include: { _count: { select: { materials: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.supplier.findMany({
      include: { _count: { select: { pricing: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.materialCategory.findMany({ orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({ materials, manufacturers, suppliers, categories });
}

export async function POST(req: NextRequest) {
  const session = await requireAdminApiSession();
  if (!session) return unauthorizedResponse();

  const body = await req.json();
  const { name, slug, sku, description, categoryId, manufacturerId, grade, sheen, finish, thickness, isPublic } = body;

  if (!name || !slug || !categoryId || !manufacturerId) {
    return NextResponse.json({ error: "name, slug, categoryId, and manufacturerId are required" }, { status: 400 });
  }

  const material = await prisma.material.create({
    data: {
      name,
      slug,
      sku: sku || null,
      description: description || null,
      categoryId,
      manufacturerId,
      grade: grade || null,
      sheen: sheen || null,
      finish: finish || null,
      thickness: thickness || null,
      isPublic: isPublic !== false,
    },
    include: {
      category: { select: { name: true } },
      manufacturer: { select: { name: true } },
      _count: { select: { pricing: true } },
    },
  });

  return NextResponse.json(material, { status: 201 });
}
