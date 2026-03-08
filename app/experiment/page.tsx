"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

interface RobloxGroup {
  groupId: number;
  groupName: string;
  roleName: string;
  roleRank: number;
}

type AuthMethod = "oauth" | "apikey";

export default function ExperimentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [authMethod, setAuthMethod] = useState<AuthMethod>("oauth");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [groups, setGroups] = useState<RobloxGroup[]>([]);
  const [creatorType, setCreatorType] = useState<"user" | "group">("user");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchGroups = useCallback(async () => {
    const res = await fetch("/api/groups");
    if (res.ok) setGroups(await res.json());
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchGroups();
  }, [status, fetchGroups]);

  async function handleUpload() {
    if (!file) return;
    if (authMethod === "apikey" && !apiKey.trim()) return;

    const creatorId =
      creatorType === "user"
        ? session?.user?.id ?? ""
        : selectedGroupId;

    if (!creatorId) return;

    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("creatorType", creatorType);
      formData.append("creatorId", creatorId);
      formData.append("displayName", file.name.replace(/\.[^.]+$/, ""));

      let endpoint: string;
      if (authMethod === "oauth") {
        endpoint = "/api/experiment/oauth-upload";
      } else {
        endpoint = "/api/experiment/upload";
        formData.append("apiKey", apiKey.trim());
      }

      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      setUploading(false);
    }
  }

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">API キー実験</h1>
          <p className="mt-1 text-sm text-gray-500">
            ユーザー API キー 1 つでグループアセットをアップロードできるか検証
          </p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100"
        >
          戻る
        </button>
      </header>

      <div className="space-y-6">
        {/* Auth Method */}
        <section className="rounded-lg border border-gray-200 p-4">
          <h2 className="mb-2 text-sm font-semibold">1. 認証方式</h2>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="authMethod"
                checked={authMethod === "oauth"}
                onChange={() => setAuthMethod("oauth")}
              />
              <span>
                <strong>OAuth（推奨）</strong>
                <span className="ml-1 text-xs text-gray-500">
                  — ログイン済みトークンを使用
                </span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="authMethod"
                checked={authMethod === "apikey"}
                onChange={() => setAuthMethod("apikey")}
              />
              <span>
                API キー
                <span className="ml-1 text-xs text-gray-500">
                  — 手動入力
                </span>
              </span>
            </label>
          </div>
          {authMethod === "apikey" && (
            <div className="relative mt-3">
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
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
          )}
          {authMethod === "oauth" && (
            <p className="mt-3 rounded bg-blue-50 px-3 py-2 text-xs text-blue-700">
              ログイン時の OAuth トークン（スコープ: asset:read + asset:write）を使用します。API キーは不要です。
            </p>
          )}
        </section>

        {/* Creator */}
        <section className="rounded-lg border border-gray-200 p-4">
          <h2 className="mb-2 text-sm font-semibold">2. アップロード先</h2>
          <div className="space-y-3">
            <div className="flex gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="creatorType"
                  checked={creatorType === "user"}
                  onChange={() => setCreatorType("user")}
                />
                個人（{session?.user?.name}）
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="creatorType"
                  checked={creatorType === "group"}
                  onChange={() => setCreatorType("group")}
                />
                グループ
              </label>
            </div>
            {creatorType === "group" && (
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">-- グループを選択 --</option>
                {groups.map((g) => (
                  <option key={g.groupId} value={g.groupId}>
                    {g.groupName} ({g.roleName})
                  </option>
                ))}
              </select>
            )}
          </div>
        </section>

        {/* File */}
        <section className="rounded-lg border border-gray-200 p-4">
          <h2 className="mb-2 text-sm font-semibold">3. テストファイル</h2>
          <p className="mb-3 text-xs text-gray-500">
            小さい画像ファイル（.png, .jpg）を推奨
          </p>
          <input
            type="file"
            accept=".png,.jpg,.jpeg,.bmp,.mp3,.ogg,.fbx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          {file && (
            <p className="mt-2 text-xs text-gray-500">
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </section>

        {/* Upload */}
        <button
          onClick={handleUpload}
          disabled={
            !file ||
            uploading ||
            (authMethod === "apikey" && !apiKey.trim()) ||
            (creatorType === "group" && !selectedGroupId)
          }
          className="w-full rounded-lg bg-orange-600 px-4 py-3 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
        >
          {uploading ? "アップロード中..." : "テストアップロード実行"}
        </button>

        {/* Result */}
        {result && (
          <section className="rounded-lg border border-gray-200 p-4">
            <h2 className="mb-2 text-sm font-semibold">結果</h2>
            <pre className="max-h-80 overflow-auto rounded bg-gray-50 p-3 text-xs">
              {JSON.stringify(result, null, 2)}
            </pre>
          </section>
        )}
      </div>
    </main>
  );
}
