"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

interface GroupProfile {
  id: string;
  groupId: string;
  groupName: string;
  roleName: string | null;
  createdAt: string;
}

interface RobloxGroup {
  groupId: number;
  groupName: string;
  roleName: string;
}

interface ProjectItem {
  id: string;
  name: string;
  creatorType: string;
  groupProfileId: string | null;
  _count: { assetEntries: number; places: number };
}

export default function SettingsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [groupProfiles, setGroupProfiles] = useState<GroupProfile[]>([]);
  const [robloxGroups, setRobloxGroups] = useState<RobloxGroup[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);

  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const fetchGroupProfiles = useCallback(async () => {
    const res = await fetch("/api/group-profiles");
    if (res.ok) setGroupProfiles(await res.json());
  }, []);

  const fetchRobloxGroups = useCallback(async () => {
    const res = await fetch("/api/groups");
    if (res.ok) setRobloxGroups(await res.json());
  }, []);

  const fetchProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    if (res.ok) setProjects(await res.json());
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchGroupProfiles();
      fetchRobloxGroups();
      fetchProjects();
    }
  }, [status, fetchGroupProfiles, fetchRobloxGroups, fetchProjects]);

  async function handleAddGroupProfile() {
    if (!selectedGroupId || !apiKeyInput.trim()) return;
    const group = robloxGroups.find(
      (g) => g.groupId.toString() === selectedGroupId
    );
    if (!group) return;

    setSaving(true);
    const res = await fetch("/api/group-profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId: group.groupId.toString(),
        groupName: group.groupName,
        roleName: group.roleName,
        apiKey: apiKeyInput.trim(),
      }),
    });
    setSaving(false);

    if (res.ok) {
      setSelectedGroupId("");
      setApiKeyInput("");
      await fetchGroupProfiles();
    }
  }

  async function handleDeleteGroupProfile(id: string) {
    if (!confirm("このグループプロファイルを削除しますか？")) return;
    await fetch("/api/group-profiles", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await fetchGroupProfiles();
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

  const availableGroups = robloxGroups.filter(
    (g) => !groupProfiles.some((gp) => gp.groupId === g.groupId.toString())
  );

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

      {/* Group Profiles */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">グループプロファイル</h2>
        <p className="mb-4 text-sm text-gray-500">
          グループのアセットをアップロードするには、グループオーナーが発行した
          Open Cloud API キーが必要です。
        </p>

        {groupProfiles.length > 0 && (
          <div className="mb-6 space-y-2">
            {groupProfiles.map((gp) => (
              <div
                key={gp.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{gp.groupName}</p>
                  <p className="text-sm text-gray-500">
                    {gp.roleName && `ロール: ${gp.roleName} · `}
                    ID: {gp.groupId}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteGroupProfile(gp.id)}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}

        {availableGroups.length > 0 ? (
          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="mb-3 text-sm font-medium">グループを追加</h3>
            <div className="space-y-3">
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">-- グループを選択 --</option>
                {availableGroups.map((g) => (
                  <option key={g.groupId} value={g.groupId}>
                    {g.groupName} ({g.roleName})
                  </option>
                ))}
              </select>
              <div className="relative">
                <input
                  type={showApiKey ? "text" : "password"}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="API キー"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-16 text-sm"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? "隠す" : "表示"}
                </button>
              </div>
              <button
                onClick={handleAddGroupProfile}
                disabled={!selectedGroupId || !apiKeyInput.trim() || saving}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "保存中..." : "追加"}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400">
            {robloxGroups.length === 0
              ? "所属グループがありません"
              : "すべてのグループが登録済みです"}
          </p>
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
                        {proj.creatorType === "user" ? "個人" : "グループ"} ·
                        アセット {proj._count.assetEntries} 件 · プレイス{" "}
                        {proj._count.places} 件
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
