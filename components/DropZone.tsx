"use client";

declare module "react" {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

import { useCallback, useRef, useState } from "react";
import { isSupportedFile } from "@/lib/asset-types";

const ACCEPT =
  ".png,.jpeg,.jpg,.mp3,.ogg,.flac,.wav,.fbx";

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
}

export function DropZone({ onFilesSelected }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const filterSupported = useCallback((files: File[]): File[] => {
    return files.filter((f) => isSupportedFile(f.name));
  }, []);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      const arr = Array.from(files);
      const filtered = filterSupported(arr);
      if (filtered.length) onFilesSelected(filtered);
    },
    [filterSupported, onFilesSelected]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const readDirEntries = useCallback(
    async (entry: FileSystemDirectoryEntry): Promise<File[]> => {
      const files: File[] = [];
      const read = async (dir: FileSystemDirectoryEntry): Promise<void> => {
        const reader = dir.createReader();
        let entries: FileSystemEntry[] = [];
        do {
          entries = await new Promise((resolve, reject) =>
            reader.readEntries(resolve, reject)
          );
          for (const e of entries) {
            if (e.isFile) {
              const file = await new Promise<File>((res, rej) =>
                (e as FileSystemFileEntry).file(res, rej)
              );
              files.push(file);
            } else {
              await read(e as FileSystemDirectoryEntry);
            }
          }
        } while (entries.length > 0);
      };
      await read(entry);
      return files;
    },
    []
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const items = e.dataTransfer?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind !== "file") continue;
        const entry = item.webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          const dirFiles = await readDirEntries(entry as FileSystemDirectoryEntry);
          files.push(...dirFiles);
        } else {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }

      const filtered = filterSupported(files);
      if (filtered.length) onFilesSelected(filtered);
    },
    [filterSupported, onFilesSelected, readDirEntries]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      e.target.value = "";
    },
    [handleFiles]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed
        px-8 py-12 transition-colors duration-200
        ${isDragging
          ? "border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-950/30"
          : "border-slate-300 bg-slate-50/50 dark:border-slate-600 dark:bg-slate-900/50 hover:border-slate-400 dark:hover:border-slate-500"
        }
      `}
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className={`
            flex h-14 w-14 items-center justify-center rounded-lg border-2 border-dashed
            ${isDragging ? "border-amber-500 bg-amber-100 dark:border-amber-400 dark:bg-amber-900/40" : "border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800/50"}
          `}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6 text-slate-500 dark:text-slate-400"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p className="text-center text-sm font-medium text-slate-600 dark:text-slate-400">
          ファイルまたはフォルダをドロップ
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={handleFileInputChange}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          webkitdirectory=""
          directory=""
          onChange={handleFileInputChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
        >
          ファイルを選択
        </button>
        <button
          type="button"
          onClick={() => folderInputRef.current?.click()}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          フォルダを選択
        </button>
      </div>
    </div>
  );
}
