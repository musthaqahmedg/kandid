"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ID, Permission, Query, Role } from "appwrite";
import { config, tablesDB } from "@/lib/appwrite";
import { useI18n } from "@/lib/i18n";

type Props = {
  reportId: string;
  count: number;
  userId: string | null;
  reporterId: string;
  /** The user's existing upvote row id, if they already upvoted */
  myUpvoteId: string | null;
  onChange?: (myUpvoteId: string | null) => void;
};

/** "I saw this too" toggle. The real count is recomputed by the kandid-sync function. */
export default function UpvoteButton({ reportId, count, userId, reporterId, myUpvoteId, onChange }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [mine, setMine] = useState<string | null>(myUpvoteId);
  const [shown, setShown] = useState(count);
  const [busy, setBusy] = useState(false);
  const isOwn = !!userId && userId === reporterId;

  async function toggle() {
    if (!userId) return router.push("/login");
    if (isOwn || busy) return;
    setBusy(true);
    try {
      if (mine) {
        await tablesDB.deleteRow({ databaseId: config.databaseId, tableId: config.upvotesTableId, rowId: mine });
        setMine(null); setShown((n) => Math.max(0, n - 1)); onChange?.(null);
      } else {
        try {
          const row = await tablesDB.createRow({
            databaseId: config.databaseId,
            tableId: config.upvotesTableId,
            rowId: ID.unique(),
            data: { report_id: reportId, user_id: userId },
            permissions: [Permission.read(Role.any()), Permission.delete(Role.user(userId))],
          });
          setMine(row.$id); setShown((n) => n + 1); onChange?.(row.$id);
        } catch {
          // Already upvoted (e.g. from another device): pick up the existing row
          const res = await tablesDB.listRows({
            databaseId: config.databaseId, tableId: config.upvotesTableId,
            queries: [Query.equal("report_id", reportId), Query.equal("user_id", userId), Query.limit(1)],
          });
          const id = res.rows[0]?.$id ?? null;
          setMine(id); onChange?.(id);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`upvote${mine ? " on" : ""}`}
      onClick={toggle}
      disabled={busy || isOwn}
      aria-pressed={!!mine}
      title={isOwn ? t("upvote.own") : mine ? t("upvote.undo") : t("upvote.add")}
    >
      👍 {mine ? t("upvote.mine") : t("upvote.add")} · {shown}
    </button>
  );
}
