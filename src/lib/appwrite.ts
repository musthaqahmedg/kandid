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

export function photoUrl(fileId: string, width = 800) {
  return storage.getFilePreview({ bucketId: config.photosBucketId, fileId, width, quality: 75 });
}
