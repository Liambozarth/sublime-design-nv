import { NextResponse } from "next/server";
import { db as prisma } from "@/lib/db";
import { requireAdminApiSession, unauthorizedResponse } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdminApiSession();
  if (!session) return unauthorizedResponse();

  const { id } = params;

  const pricing = await prisma.supplierPricing.findMany({
    where: { materialId: id },
    include: {
      supplier: { select: { name: true } },
    },
    orderBy: [{ isPreferred: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(pricing);
}
