import { Account, Client, Storage, TablesDB } from "appwrite";

export const config = {
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://sgp.cloud.appwrite.io/v1",
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "6ae438bd00244ec90e73",
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "kandid",
  reportsTableId: process.env.NEXT_PUBLIC_APPWRITE_REPORTS_TABLE_ID ?? "reports",
  upvotesTableId: process.env.NEXT_PUBLIC_APPWRITE_UPVOTES_TABLE_ID ?? "upvotes",
  photosBucketId: process.env.NEXT_PUBLIC_APPWRITE_PHOTOS_BUCKET_ID ?? "report-photos",
};

export const client = new Client().setEndpoint(config.endpoint).setProject(config.projectId);
export const account = new Account(client);
export const tablesDB = new TablesDB(client);
export const storage = new Storage(client);

export const CATEGORIES = [
  { value: "road", label: "Road damage" },
  { value: "garbage", label: "Garbage" },
  { value: "water", label: "Water / leak" },
  { value: "streetlight", label: "Streetlight" },
  { value: "drainage", label: "Drainage" },
  { value: "other", label: "Other" },
] as const;

export type Category = (typeof CATEGORIES)[number]["value"];
export type Status = "open" | "acknowledged" | "fixed";

export type Report = {
  $id: string;
  $createdAt: string;
  photo_id: string;
  category: Category;
  note?: string | null;
  location: [number, number]; // [longitude, latitude]
  address?: string | null;
  status: Status;
  upvote_count: number;
  reporter_id: string;
  captured_at: string;
};

// Photos are resized in the browser before upload, so we serve the stored file directly
// (no server-side image transformations needed on the free plan).
export function photoUrl(fileId: string) {
  return storage.getFileView({ bucketId: config.photosBucketId, fileId });
}

/** Resize + re-encode a camera photo to a small JPEG (max 1600px, ~200-400 KB). */
export async function compressPhoto(file: File, maxSize = 1600, quality = 0.8): Promise<File> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bitmap) return file; // browser can't decode (e.g. HEIC on some devices) - upload as-is
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!blob) return file;
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}
