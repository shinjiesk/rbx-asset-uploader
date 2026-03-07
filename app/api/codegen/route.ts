import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { generateAssetsLua } from "@/lib/codegen";
import type { AssetCategory } from "@/lib/asset-types";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const assetEntries = await prisma.assetEntry.findMany({
      where: { projectId },
      orderBy: [{ category: "asc" }, { filename: "asc" }],
    });

    const assets = assetEntries.map((e) => ({
      filename: e.filename,
      category: e.category as AssetCategory,
      assetId: e.assetId,
    }));

    const lua = generateAssetsLua(assets);
    return new NextResponse(lua, {
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": 'attachment; filename="Assets.lua"',
      },
    });
  } catch (err) {
    console.error("codegen GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
