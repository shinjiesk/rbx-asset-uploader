"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { DropZone } from "@/components/DropZone";
import { FileList } from "@/components/FileList";
import type { FileItem } from "@/components/FileList";
import { ProjectSelect } from "@/components/ProjectSelect";
import type { Project } from "@/components/ProjectSelect";
import { getAssetTypeInfo } from "@/lib/asset-types";

const MAX_CONCURRENT = 3;

function ExportMenu({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const formats = [
    { label: "CSV", format: "csv", ext: "csv" },
    { label: "TSV", format: "tsv", ext: "tsv" },
    { label: "Markdown", format: "markdown", ext: "md" },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-100"
      >
        エクスポート ▾
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 w-40 rounded-lg border border-gray-200 bg-white shadow-lg">
          {formats.map((f) => (
            <a
              key={f.format}
              href={`/api/export?projectId=${projectId}&format=${f.format}&category=all`}
              download={`assets.${f.ext}`}
              className="block px-4 py-2 text-sm hover:bg-gray-50"
              onClick={() => setOpen(false)}
            >
              {f.label}
            </a>
          ))}
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50"
            onClick={async () => {
              setOpen(false);
              const res = await fetch(
                `/api/export?projectId=${projectId}&format=tsv&category=all`
              );
              if (res.ok) {
                const text = await res.text();
                await navigator.clipboard.writeText(text);
                alert("クリップボードにコピーしました");
              }
            }}
          >
            クリップボードにコピー
          </button>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null
  );
  const [groupProfiles, setGroupProfiles] = useState<
    Array<{ id: string; groupName: string }>
  >([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [existingAssets, setExistingAssets] = useState<
    Map<string, string>
  >(new Map());

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  const fetchProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    if (res.ok) setProjects(await res.json());
  }, []);

  const fetchGroupProfiles = useCallback(async () => {
    const res = await fetch("/api/group-profiles");
    if (res.ok) setGroupProfiles(await res.json());
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchProjects();
      fetchGroupProfiles();
    }
  }, [status, fetchProjects, fetchGroupProfiles]);

  useEffect(() => {
    if (!selectedProjectId) return;
    fetch(`/api/lockfile?projectId=${selectedProjectId}&format=json`)
      .then((r) => r.json())
      .then((data: Array<{ filename: string; assetId: string }>) => {
        const map = new Map<string, string>();
        if (Array.isArray(data)) {
          for (const entry of data) {
            map.set(entry.filename, entry.assetId);
          }
        }
        setExistingAssets(map);
      })
      .catch(() => setExistingAssets(new Map()));
  }, [selectedProjectId]);

  function handleFilesSelected(selectedFiles: File[]) {
    const items: FileItem[] = [];
    for (const file of selectedFiles) {
      const info = getAssetTypeInfo(file.name);
      if (!info) continue;
      items.push({
        file,
        filename: file.name,
        size: file.size,
        category: info.category,
        apiType: info.apiType,
        existingAssetId: existingAssets.get(file.name),
        excluded: false,
        status: "pending",
      });
    }

    setFiles((prev) => [...prev, ...items]);
  }

  function handleToggleExclude(index: number) {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, excluded: !f.excluded } : f))
    );
  }

  function handleClear() {
    setFiles([]);
  }

  async function uploadSingleFile(item: FileItem, index: number) {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, status: "uploading" } : f))
    );

    try {
      const formData = new FormData();
      formData.append("file", item.file);
      formData.append("projectId", selectedProjectId!);
      formData.append("displayName", item.filename.replace(/\.[^.]+$/, ""));

      const endpoint = item.existingAssetId ? "/api/update" : "/api/upload";
      if (item.existingAssetId) {
        formData.append("assetId", item.existingAssetId);
      }

      const res = await fetch(endpoint, { method: "POST", body: formData });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? { ...f, status: "success", assetId: data.assetId }
            : f
        )
      );
    } catch (e) {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? {
                ...f,
                status: "failed",
                error: e instanceof Error ? e.message : String(e),
              }
            : f
        )
      );
    }
  }

  async function handleUpload() {
    if (!selectedProjectId) return;
    setUploading(true);

    const activeIndices = files
      .map((f, i) => ({ f, i }))
      .filter(({ f }) => !f.excluded && f.status !== "success")
      .map(({ i }) => i);

    let cursor = 0;
    const running = new Set<Promise<void>>();

    while (cursor < activeIndices.length || running.size > 0) {
      while (running.size < MAX_CONCURRENT && cursor < activeIndices.length) {
        const idx = activeIndices[cursor++];
        const promise = uploadSingleFile(files[idx], idx).then(() => {
          running.delete(promise);
        });
        running.add(promise);
      }
      if (running.size > 0) {
        await Promise.race(running);
      }
    }

    setUploading(false);
  }

  async function handleRetryFailed() {
    setFiles((prev) =>
      prev.map((f) =>
        f.status === "failed" ? { ...f, status: "pending", error: undefined } : f
      )
    );
    await handleUpload();
  }

  async function handleCreateProject(data: {
    name: string;
    creatorType: string;
    groupProfileId?: string;
  }) {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const project = await res.json();
      await fetchProjects();
      setSelectedProjectId(project.id);
    }
  }

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </main>
    );
  }

  if (status === "unauthenticated") return null;

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-6">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">Roblox Asset Uploader</h1>
        <div className="flex items-center gap-3">
          {session?.user?.image && (
            <img
              src={session.user.image}
              alt=""
              className="h-8 w-8 rounded-full"
            />
          )}
          <span className="text-sm text-gray-600">{session?.user?.name}</span>
          <button
            onClick={() => router.push("/settings")}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
          >
            設定
          </button>
          <button
            onClick={() => signOut()}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* Project selector */}
      <div className="mb-6">
        <ProjectSelect
          projects={projects}
          selectedId={selectedProjectId}
          onSelect={setSelectedProjectId}
          onCreate={handleCreateProject}
          groupProfiles={groupProfiles}
        />
      </div>

      {/* Upload area */}
      {selectedProjectId && files.length === 0 && (
        <DropZone onFilesSelected={handleFilesSelected} />
      )}

      {/* File list */}
      {files.length > 0 && (
        <FileList
          files={files}
          onToggleExclude={handleToggleExclude}
          onUpload={handleUpload}
          onClear={handleClear}
          onRetryFailed={handleRetryFailed}
          uploading={uploading}
        />
      )}

      {/* Actions */}
      {selectedProjectId && (
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={`/api/codegen?projectId=${selectedProjectId}`}
            download="Assets.lua"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Assets.lua
          </a>
          <a
            href={`/api/lockfile?projectId=${selectedProjectId}&format=toml`}
            download="assets.lock.toml"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-100"
          >
            ロックファイル
          </a>
          <ExportMenu projectId={selectedProjectId} />
        </div>
      )}

      {/* No project selected hint */}
      {!selectedProjectId && (
        <div className="mt-12 text-center text-gray-400">
          <p>プロジェクトを選択してください</p>
        </div>
      )}
    </main>
  );
}
