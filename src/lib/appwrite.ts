import { Account, Client, Functions, Storage, TablesDB } from "appwrite";

export const config = {
  endpoint: process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://sgp.cloud.appwrite.io/v1",
  projectId: process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "6ae438bd00244ec90e73",
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "kandid",
  reportsTableId: process.env.NEXT_PUBLIC_APPWRITE_REPORTS_TABLE_ID ?? "reports",
  upvotesTableId: process.env.NEXT_PUBLIC_APPWRITE_UPVOTES_TABLE_ID ?? "upvotes",
  verificationsTableId: process.env.NEXT_PUBLIC_APPWRITE_VERIFICATIONS_TABLE_ID ?? "verifications",
  filingsTableId: "filings",
  flagsTableId: "flags",
  syncFunctionId: "kandid-sync",
  photosBucketId: process.env.NEXT_PUBLIC_APPWRITE_PHOTOS_BUCKET_ID ?? "report-photos",
};

export const client = new Client().setEndpoint(config.endpoint).setProject(config.projectId);
export const account = new Account(client);
export const tablesDB = new TablesDB(client);
export const storage = new Storage(client);
export const functions = new Functions(client);

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
  gps_accuracy?: number | null;
  pin_adjusted?: boolean;
  fixed_at?: string | null;
  fixed_photo_id?: string | null;
  fixed_votes?: number;
  broken_votes?: number;
  reporter_rating?: number | null;
  flag_count?: number;
  hidden?: boolean;
};

export type Verification = {
  $id: string;
  $createdAt: string;
  report_id: string;
  user_id: string;
  verdict: "fixed" | "still_broken";
  photo_id?: string | null;
  location: [number, number];
  rating?: number | null;
};

/** People must be this close to a report to confirm it is fixed or still broken. */
export const VERIFY_RADIUS_M = 200;

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

export function categoryLabel(c: string) {
  return CATEGORIES.find((x) => x.value === c)?.label ?? c;
}

export function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

/** Great-circle distance in metres between two [lng, lat] points. */
export function distanceMetres([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Whole days between two dates (at least 0). */
export function daysBetween(fromIso: string, to: Date | string = new Date()) {
  const end = typeof to === "string" ? new Date(to) : to;
  return Math.max(0, Math.floor((end.getTime() - new Date(fromIso).getTime()) / 86400000));
}

/** "Open for 12 days" / "Fixed in 3 days" style label. */
export function ageLabel(r: Report) {
  const plural = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
  if (r.status === "fixed" && r.fixed_at) {
    const d = daysBetween(r.captured_at, r.fixed_at);
    return d === 0 ? "Fixed the same day" : `Fixed in ${plural(d)}`;
  }
  const d = daysBetween(r.captured_at);
  return d === 0 ? "Reported today" : `Open for ${plural(d)}`;
}
