"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

interface ProjectItem {
  id: string;
  name: string;
  creatorType: string;
  groupId: string | null;
  groupName: string | null;
  placesCount: number;
  assetEntriesCount: number;
}

export default function SettingsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [hasApiKey, setHasApiKey] = useState(false);
  const [keyPreview, setKeyPreview] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchApiKeyStatus = useCallback(async () => {
    const res = await fetch("/api/user-apikey");
    if (res.ok) {
      const data = await res.json();
      setHasApiKey(data.hasApiKey);
      setKeyPreview(data.keyPreview ?? null);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    if (res.ok) setProjects(await res.json());
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchApiKeyStatus();
      fetchProjects();
    }
  }, [status, fetchApiKeyStatus, fetchProjects]);

  async function handleSaveApiKey() {
    if (!apiKeyInput.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user-apikey", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
      });
      if (res.ok) {
        setApiKeyInput("");
        setHasApiKey(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(`保存に失敗しました: ${data.error || "Unknown error"}`);
      }
    } catch (e) {
      setError(`ネットワークエラー: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteApiKey() {
    if (!confirm("API キーを削除しますか？グループへのアップロードができなくなります。")) return;
    await fetch("/api/user-apikey", { method: "DELETE" });
    setHasApiKey(false);
  }

  async function handleDeleteProject(id: string, name: string) {
    if (
      !confirm(
        `プロジェクト「${name}」を削除しますか？\nアセット一覧もすべて削除されます。`
      )
    )
      return;
    await fetch("/api/projects", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await fetchProjects();
  }

  async function handleUpdateProject(id: string) {
    if (!editName.trim()) return;
    await fetch("/api/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editName.trim() }),
    });
    setEditingProject(null);
    await fetchProjects();
  }

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-bold">設定</h1>
        <button
          onClick={() => router.push("/")}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
        >
          戻る
        </button>
      </header>

      {/* API Key */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">Open Cloud API キー</h2>
        <p className="mb-4 text-sm text-gray-500">
          グループのアセットをアップロードするには、Roblox Creator Hub
          で作成したユーザー API キー（asset:read + asset:write）が必要です。
          個人アセットのアップロードには不要です。
        </p>

        {hasApiKey ? (
          <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
            <div>
              <p className="font-medium">API キー登録済み</p>
              <p className="text-sm text-gray-500">
                {keyPreview ? (
                  <>キー: <code className="rounded bg-gray-100 px-1 font-mono text-xs">{keyPreview}</code></>
                ) : (
                  "グループへのアセットアップロードが有効です"
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setHasApiKey(false)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                変更
              </button>
              <button
                onClick={handleDeleteApiKey}
                className="text-sm text-red-500 hover:text-red-700"
              >
                削除
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="API キーを貼り付け"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-16 text-sm font-mono"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? "隠す" : "表示"}
                </button>
              </div>
              <a
                href="https://create.roblox.com/dashboard/credentials"
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm text-blue-600 hover:bg-gray-50"
              >
                API キー作成ページを開く ↗
              </a>
            </div>
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
            <button
              onClick={handleSaveApiKey}
              disabled={!apiKeyInput.trim() || saving}
              className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        )}
      </section>

      {/* Projects */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">プロジェクト管理</h2>

        {projects.length === 0 ? (
          <p className="text-sm text-gray-400">プロジェクトがありません</p>
        ) : (
          <div className="space-y-2">
            {projects.map((proj) => (
              <div
                key={proj.id}
                className="rounded-lg border border-gray-200 px-4 py-3"
              >
                {editingProject === proj.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                      autoFocus
                    />
                    <button
                      onClick={() => handleUpdateProject(proj.id)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setEditingProject(null)}
                      className="text-sm text-gray-400 hover:text-gray-600"
                    >
                      キャンセル
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{proj.name}</p>
                      <p className="text-sm text-gray-500">
                        {proj.creatorType === "user"
                          ? "個人"
                          : proj.groupName ?? `グループ ${proj.groupId}`}{" "}
                        · アセット {proj.assetEntriesCount} 件 · プレイス{" "}
                        {proj.placesCount} 件
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingProject(proj.id);
                          setEditName(proj.name);
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        編集
                      </button>
                      <button
                        onClick={() =>
                          handleDeleteProject(proj.id, proj.name)
                        }
                        className="text-sm text-red-500 hover:text-red-700"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
