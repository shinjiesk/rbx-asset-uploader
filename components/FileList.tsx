"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface FileItem {
  file: File;
  filename: string;
  size: number;
  category: "Image" | "Audio" | "Model";
  apiType: string;
  existingAssetId?: string;
  excluded: boolean;
  status: "pending" | "uploading" | "processing" | "success" | "failed";
  assetId?: string;
  error?: string;
}

interface FileListProps {
  files: FileItem[];
  onToggleExclude: (index: number) => void;
  onUpload: () => void;
  onClear: () => void;
  onRetryFailed: () => void;
  uploading: boolean;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const CATEGORY_STYLES = {
  Image: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  Audio: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  Model: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
} as const;

function FileRow({
  item,
  index,
  onToggleExclude,
  formatSizeFn,
}: {
  item: FileItem;
  index: number;
  onToggleExclude: (index: number) => void;
  formatSizeFn: (bytes: number) => string;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (item.category === "Image" && item.file) {
      const url = URL.createObjectURL(item.file);
      setImageUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [item.category, item.file]);

  useEffect(() => {
    if (item.category === "Audio" && item.file) {
      const url = URL.createObjectURL(item.file);
      setAudioUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [item.category, item.file]);

  const toggleAudio = useCallback(() => {
    if (item.category !== "Audio") return;
    const audio = audioRef.current;
    if (!audio) return;

    if (audioPlaying) {
      audio.pause();
      audio.currentTime = 0;
      setAudioPlaying(false);
    } else {
      audio.play();
      setAudioPlaying(true);
    }
  }, [item.category, audioPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setAudioPlaying(false);
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, []);

  const statusLabel =
    item.status === "pending"
      ? "待機"
      : item.status === "uploading"
        ? "アップロード中..."
        : item.status === "processing"
          ? "処理中..."
          : item.status === "success"
            ? `ID: ${item.assetId ?? ""}`
            : "失敗";

  const statusStyles =
    item.status === "pending"
      ? "text-slate-500 dark:text-slate-400"
      : item.status === "uploading" || item.status === "processing"
        ? "text-amber-600 dark:text-amber-400 animate-pulse"
        : item.status === "success"
          ? "text-green-600 dark:text-green-400 font-medium"
          : "text-red-600 dark:text-red-400 font-medium";

  return (
    <div
      className={`flex items-center gap-4 rounded-lg border px-4 py-3 transition-colors ${
        item.excluded
          ? "border-slate-200 bg-slate-50/50 opacity-60 dark:border-slate-700 dark:bg-slate-900/30"
          : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800/50"
      }`}
    >
      <label className="flex cursor-pointer items-center">
        <input
          type="checkbox"
          checked={!item.excluded}
          onChange={() => onToggleExclude(index)}
          className="h-4 w-4 rounded border-slate-300 text-slate-600 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-700"
        />
      </label>

      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-700">
        {item.category === "Image" && imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : item.category === "Audio" ? (
          <span className="text-xl text-slate-600 dark:text-slate-400">♪</span>
        ) : (
          <span className="text-xl text-slate-600 dark:text-slate-400">◇</span>
        )}
      </div>

      {item.category === "Audio" && (
        <button
          type="button"
          onClick={toggleAudio}
          disabled={item.excluded}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700 transition-colors hover:bg-slate-300 disabled:opacity-50 dark:bg-slate-600 dark:text-slate-300 dark:hover:bg-slate-500"
          aria-label={audioPlaying ? "一時停止" : "再生"}
        >
          {audioPlaying ? (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="ml-0.5 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
          {item.filename}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {formatSizeFn(item.size)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[item.category]}`}
        >
          {item.category}
        </span>
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            item.existingAssetId
              ? "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300"
              : "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
          }`}
        >
          {item.existingAssetId ? "上書き" : "新規"}
        </span>
      </div>

      <div
        className={`min-w-[120px] text-right text-sm ${statusStyles}`}
        title={item.status === "failed" && item.error ? item.error : undefined}
      >
        {statusLabel}
      </div>

      {item.category === "Audio" && audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          className="hidden"
        />
      )}
    </div>
  );
}

export function FileList({
  files,
  onToggleExclude,
  onUpload,
  onClear,
  onRetryFailed,
  uploading,
}: FileListProps) {
  const includedCount = files.filter((f) => !f.excluded).length;
  const hasFailed = files.some((f) => !f.excluded && f.status === "failed");
  const canUpload = includedCount > 0 && !uploading;

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/50">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
          ファイル ({includedCount})
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            disabled={files.length === 0 || uploading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            クリア
          </button>
          <button
            type="button"
            onClick={onUpload}
            disabled={!canUpload}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-700 dark:hover:bg-slate-600"
          >
            アップロード
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 p-4">
        {files.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
            ファイルがありません
          </p>
        ) : (
          files.map((item, index) => (
            <FileRow
              key={`${item.filename}-${index}`}
              item={item}
              index={index}
              onToggleExclude={onToggleExclude}
              formatSizeFn={formatSize}
            />
          ))
        )}

        {hasFailed && (
          <button
            type="button"
            onClick={onRetryFailed}
            disabled={uploading}
            className="mt-2 self-start rounded-lg border border-amber-500 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/40"
          >
            失敗したファイルを再アップロード
          </button>
        )}
      </div>
    </div>
  );
}
