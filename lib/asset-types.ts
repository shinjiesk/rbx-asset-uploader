export type AssetCategory = "Image" | "Audio" | "Model";

export type AssetApiType = "Decal" | "Audio" | "Model";

interface AssetTypeInfo {
  category: AssetCategory;
  apiType: AssetApiType;
  contentType: string;
}

const EXTENSION_MAP: Record<string, AssetTypeInfo> = {
  png: { category: "Image", apiType: "Decal", contentType: "image/png" },
  jpeg: { category: "Image", apiType: "Decal", contentType: "image/jpeg" },
  jpg: { category: "Image", apiType: "Decal", contentType: "image/jpeg" },
  bmp: { category: "Image", apiType: "Decal", contentType: "image/bmp" },
  mp3: { category: "Audio", apiType: "Audio", contentType: "audio/mpeg" },
  ogg: { category: "Audio", apiType: "Audio", contentType: "audio/ogg" },
  flac: { category: "Audio", apiType: "Audio", contentType: "audio/flac" },
  wav: { category: "Audio", apiType: "Audio", contentType: "audio/wav" },
  fbx: { category: "Model", apiType: "Model", contentType: "model/fbx" },
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
