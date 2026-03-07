import { getAuthenticatedUser, unauthorizedResponse } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

type ExportFormat = "csv" | "tsv" | "markdown";
type ExportCategory = "Image" | "Audio" | "Model" | "all";

const VALID_CATEGORIES = ["Image", "Audio", "Model"] as const;
const VALID_FORMATS: ExportFormat[] = ["csv", "tsv", "markdown"];

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(rows: { filename: string; assetId: string; category: string; rbxassetid: string; createdAt: string }[]): string {
  const header = "filename,assetId,category,rbxassetid,createdAt";
  const lines = rows.map((r) =>
    [escapeCsv(r.filename), escapeCsv(r.assetId), escapeCsv(r.category), escapeCsv(r.rbxassetid), escapeCsv(r.createdAt)].join(",")
  );
  return [header, ...lines].join("\n");
}

function toTsv(rows: { filename: string; assetId: string; category: string; rbxassetid: string; createdAt: string }[]): string {
  const header = "filename\tassetId\tcategory\trbxassetid\tcreatedAt";
  const lines = rows.map((r) => [r.filename, r.assetId, r.category, r.rbxassetid, r.createdAt].join("\t"));
  return [header, ...lines].join("\n");
}

function toMarkdown(rows: { filename: string; assetId: string; category: string; rbxassetid: string; createdAt: string }[]): string {
  const header = "| filename | assetId | category | rbxassetid | createdAt |";
  const sep = "| --- | --- | --- | --- | --- |";
  const lines = rows.map((r) => `| ${r.filename} | ${r.assetId} | ${r.category} | ${r.rbxassetid} | ${r.createdAt} |`);
  return [header, sep, ...lines].join("\n");
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const format = (searchParams.get("format") ?? "csv") as ExportFormat;
    const category = (searchParams.get("category") ?? "all") as ExportCategory;

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    if (!VALID_FORMATS.includes(format)) {
      return NextResponse.json({ error: "Invalid format. Use csv, tsv, or markdown" }, { status: 400 });
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: user.id },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const where: { projectId: string; category?: string } = { projectId };
    if (category !== "all" && VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
      where.category = category;
    }

    const assetEntries = await prisma.assetEntry.findMany({
      where,
      orderBy: [{ category: "asc" }, { filename: "asc" }],
    });

    const rows = assetEntries.map((e) => ({
      filename: e.filename,
      assetId: e.assetId,
      category: e.category,
      rbxassetid: `rbxassetid://${e.assetId}`,
      createdAt: e.createdAt.toISOString(),
    }));

    let content: string;
    let contentType: string;
    let filename: string;

    switch (format) {
      case "csv":
        content = toCsv(rows);
        contentType = "text/csv";
        filename = "assets.csv";
        break;
      case "tsv":
        content = toTsv(rows);
        contentType = "text/tab-separated-values";
        filename = "assets.tsv";
        break;
      case "markdown":
        content = toMarkdown(rows);
        contentType = "text/markdown";
        filename = "assets.md";
        break;
      default:
        content = toCsv(rows);
        contentType = "text/csv";
        filename = "assets.csv";
    }

    return new NextResponse(content, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("export GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
