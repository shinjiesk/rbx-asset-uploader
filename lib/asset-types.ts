export type AssetCategory = "Image" | "Audio" | "Model";

export type AssetApiType = "Decal" | "Audio" | "Model";

interface AssetTypeInfo {
  category: AssetCategory;
  apiType: AssetApiType;
}

const EXTENSION_MAP: Record<string, AssetTypeInfo> = {
  png: { category: "Image", apiType: "Decal" },
  jpeg: { category: "Image", apiType: "Decal" },
  jpg: { category: "Image", apiType: "Decal" },
  mp3: { category: "Audio", apiType: "Audio" },
  ogg: { category: "Audio", apiType: "Audio" },
  flac: { category: "Audio", apiType: "Audio" },
  wav: { category: "Audio", apiType: "Audio" },
  fbx: { category: "Model", apiType: "Model" },
};

export function getAssetTypeInfo(filename: string): AssetTypeInfo | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return EXTENSION_MAP[ext] ?? null;
}

export function isSupportedFile(filename: string): boolean {
  return getAssetTypeInfo(filename) !== null;
}

export const SUPPORTED_EXTENSIONS = Object.keys(EXTENSION_MAP);
