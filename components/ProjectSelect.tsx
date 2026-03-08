"use client";

import { useState, useEffect } from "react";

export interface Project {
  id: string;
  name: string;
  creatorType: string;
  groupId?: string | null;
  groupName?: string | null;
  placesCount?: number;
  assetEntriesCount?: number;
}

interface RobloxGroup {
  groupId: number;
  groupName: string;
  roleName: string;
  roleRank: number;
}

interface ProjectSelectProps {
  projects: Project[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (data: {
    name: string;
    creatorType: string;
    groupId?: string;
    groupName?: string;
  }) => void;
  loading?: boolean;
}

export function ProjectSelect({
  projects,
  selectedId,
  onSelect,
  onCreate,
  loading = false,
}: ProjectSelectProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createCreatorType, setCreateCreatorType] = useState("user");
  const [createGroupId, setCreateGroupId] = useState("");
  const [createGroupName, setCreateGroupName] = useState("");

  const [robloxGroups, setRobloxGroups] = useState<RobloxGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  const selectedProject = projects.find((p) => p.id === selectedId);

  useEffect(() => {
    if (showCreateModal && robloxGroups.length === 0) {
      setGroupsLoading(true);
      fetch("/api/groups")
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => setRobloxGroups(data))
        .catch(() => {})
        .finally(() => setGroupsLoading(false));
    }
  }, [showCreateModal, robloxGroups.length]);

  const getCreatorLabel = () => {
    if (!selectedProject) return null;
    if (selectedProject.creatorType === "user") return "個人";
    return selectedProject.groupName ?? `グループ ${selectedProject.groupId}`;
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "__create__") {
      setShowCreateModal(true);
      return;
    }
    onSelect(value);
  };

  const handleCreate = () => {
    const name = createName.trim();
    if (!name) return;

    if (createCreatorType === "group" && createGroupId) {
      onCreate({
        name,
        creatorType: "group",
        groupId: createGroupId,
        groupName: createGroupName,
      });
    } else {
      onCreate({ name, creatorType: "user" });
    }

    setCreateName("");
    setCreateCreatorType("user");
    setCreateGroupId("");
    setCreateGroupName("");
    setShowCreateModal(false);
  };

  const handleCancelCreate = () => {
    setCreateName("");
    setCreateCreatorType("user");
    setCreateGroupId("");
    setCreateGroupName("");
    setShowCreateModal(false);
  };

  return (
    <div className="flex flex-col gap-1">
      <select
        value={selectedId ?? ""}
        onChange={handleSelectChange}
        disabled={loading}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition-colors focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:focus:border-amber-400 dark:focus:ring-amber-400 dark:disabled:bg-slate-800/50"
      >
        <option value="">-- プロジェクトを選択 --</option>
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
        <option value="__create__">+ 新規プロジェクト</option>
      </select>

      {getCreatorLabel() && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {getCreatorLabel()}
        </p>
      )}

      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={handleCancelCreate}
        >
          <div
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-200">
              新規プロジェクト
            </h3>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="project-name"
                  className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400"
                >
                  プロジェクト名
                </label>
                <input
                  id="project-name"
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="プロジェクト名を入力"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:placeholder-slate-500 dark:focus:border-amber-400 dark:focus:ring-amber-400"
                />
              </div>

              <div>
                <label
                  htmlFor="creator-type"
                  className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-400"
                >
                  クリエイター
                </label>
                <select
                  id="creator-type"
                  value={
                    createCreatorType === "group" ? createGroupId : "user"
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "user") {
                      setCreateCreatorType("user");
                      setCreateGroupId("");
                      setCreateGroupName("");
                    } else {
                      setCreateCreatorType("group");
                      setCreateGroupId(v);
                      const g = robloxGroups.find(
                        (g) => String(g.groupId) === v
                      );
                      setCreateGroupName(g?.groupName ?? "");
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:focus:border-amber-400 dark:focus:ring-amber-400"
                >
                  <option value="user">自分（個人）</option>
                  {groupsLoading ? (
                    <option disabled>グループを読み込み中...</option>
                  ) : (
                    robloxGroups.length > 0 && (
                      <optgroup label="Roblox グループ">
                        {robloxGroups.map((g) => (
                          <option key={g.groupId} value={String(g.groupId)}>
                            {g.groupName}（{g.roleName}）
                          </option>
                        ))}
                      </optgroup>
                    )
                  )}
                </select>
                {!groupsLoading && robloxGroups.length === 0 && (
                  <p className="mt-1 text-xs text-gray-400">
                    開発者権限のあるグループが見つかりませんでした
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={handleCancelCreate}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!createName.trim()}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 dark:disabled:hover:bg-slate-700"
              >
                作成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
