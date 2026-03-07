import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { generateLockfileToml } from "@/lib/codegen";
import type { AssetCategory } from "@/lib/asset-types";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function parseLockfileToml(body: string): { filename: string; category: AssetCategory; assetId: string }[] {
  const entries: { filename: string; category: AssetCategory; assetId: string }[] = [];
  let currentCategory: AssetCategory = "Image";
  const categories: AssetCategory[] = ["Image", "Audio", "Model"];

  const lines = body.split(/\r?\n/);
  for (const line of lines) {
    const sectionMatch = line.match(/^\[assets\.(Image|Audio|Model)\]$/);
    if (sectionMatch) {
      const cat = sectionMatch[1] as AssetCategory;
      if (categories.includes(cat)) currentCategory = cat;
      continue;
    }

    const kvMatch = line.match(/^"([^"]+)"\s*=\s*(\d+)\s*$/);
    if (kvMatch) {
      const [, filename, assetId] = kvMatch;
      if (filename && assetId) {
        entries.push({ filename, category: currentCategory, assetId: String(assetId) });
      }
    }
  }
  return entries;
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const format = searchParams.get("format") ?? "toml";

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

    const toml = generateLockfileToml(assets);
    return new NextResponse(toml, {
      headers: {
        "Content-Type": "text/plain",
        "Content-Disposition": 'attachment; filename="lockfile.toml"',
      },
    });
  } catch (err) {
    console.error("lockfile GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.text();
    const entries = parseLockfileToml(body);

    for (const { filename, category, assetId } of entries) {
      await prisma.assetEntry.upsert({
        where: {
          projectId_filename: { projectId, filename },
        },
        create: { projectId, filename, category, assetId },
        update: { category, assetId },
      });
    }

    return NextResponse.json({ imported: entries.length });
  } catch (err) {
    console.error("lockfile POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
