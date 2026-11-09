import { Client, Query, Storage, TablesDB, Users } from "node-appwrite";
import { HIDE_AT_FLAGS, computeState, countFlags, countUpvotes } from "./rules.js";

const DB = "kandid";
const BUCKET = "report-photos";
const REPORTS = "reports";
const UPVOTES = "upvotes";
const VERIFICATIONS = "verifications";
const FILINGS = "filings";
const FLAGS = "flags";
const CHILD_TABLES = [UPVOTES, VERIFICATIONS, FILINGS, FLAGS];

async function listAll(db, tableId, field, value) {
  const rows = [];
  let cursor = null;
  for (let page = 0; page < 50; page++) {
    const queries = [Query.equal(field, value), Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res = await db.listRows({ databaseId: DB, tableId, queries });
    rows.push(...res.rows);
    if (res.rows.length < 100) break;
    cursor = res.rows[res.rows.length - 1].$id;
  }
  return rows;
}

async function deleteFiles(storage, ids, log) {
  for (const fileId of new Set(ids.filter(Boolean))) {
    try { await storage.deleteFile({ bucketId: BUCKET, fileId }); } catch (e) { log(`file ${fileId}: ${e.message}`); }
  }
}

/** A report was deleted: remove its photos and everything attached to it. */
async function cleanupReport(db, storage, report, log) {
  const verifications = await listAll(db, VERIFICATIONS, "report_id", report.$id);
  await deleteFiles(storage, [report.photo_id, report.fixed_photo_id, ...verifications.map((v) => v.photo_id)], log);
  for (const tableId of CHILD_TABLES) {
    for (const row of await listAll(db, tableId, "report_id", report.$id)) {
      try { await db.deleteRow({ databaseId: DB, tableId, rowId: row.$id }); } catch {}
    }
  }
  log(`cleaned up report ${report.$id}`);
}

/** "Delete my account & data": remove the user's reports, votes, photos and account. */
async function deleteAccount(db, storage, users, userId, log) {
  for (const report of await listAll(db, REPORTS, "reporter_id", userId)) {
    await db.deleteRow({ databaseId: DB, tableId: REPORTS, rowId: report.$id }); // triggers cleanupReport
  }
  for (const tableId of CHILD_TABLES) {
    const rows = await listAll(db, tableId, "user_id", userId);
    if (tableId === VERIFICATIONS) await deleteFiles(storage, rows.map((r) => r.photo_id), log);
    for (const row of rows) {
      try { await db.deleteRow({ databaseId: DB, tableId, rowId: row.$id }); } catch {} // triggers recounts
    }
  }
  await users.delete({ userId });
  log(`deleted account ${userId}`);
}

export default async ({ req, res, log, error }) => {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers["x-appwrite-key"]);
  const db = new TablesDB(client);
  const storage = new Storage(client);
  const event = req.headers["x-appwrite-event"] || "";

  // Direct call from a signed-in user (not a database event)
  if (!event) {
    const userId = req.headers["x-appwrite-user-id"];
    if (req.path === "/delete-account" && req.method === "POST" && userId) {
      try {
        await deleteAccount(db, storage, new Users(client), userId, log);
        return res.json({ ok: true });
      } catch (e) {
        error(`delete-account ${userId}: ${e.message}`);
        return res.json({ ok: false, reason: "Could not delete account" }, 500);
      }
    }
    return res.json({ ok: false, reason: "not found" }, 404);
  }

  const row = req.bodyJson || {};

  if (event.includes(`.tables.${REPORTS}.`) && event.endsWith(".delete")) {
    await cleanupReport(db, storage, row, log);
    return res.json({ ok: true });
  }

  const reportId = row.report_id;
  if (!reportId) return res.json({ ok: false, reason: "no report_id" });

  let report;
  try {
    report = await db.getRow({ databaseId: DB, tableId: REPORTS, rowId: reportId });
  } catch {
    return res.json({ ok: false, reason: "report not found" });
  }

  const update = {};
  if (event.includes(`.tables.${UPVOTES}.`)) {
    update.upvote_count = countUpvotes(await listAll(db, UPVOTES, "report_id", reportId));
  }
  if (event.includes(`.tables.${VERIFICATIONS}.`)) {
    Object.assign(update, computeState(report, await listAll(db, VERIFICATIONS, "report_id", reportId)));
  }
  if (event.includes(`.tables.${FLAGS}.`)) {
    const n = countFlags(await listAll(db, FLAGS, "report_id", reportId), report);
    update.flag_count = n;
    update.hidden = n >= HIDE_AT_FLAGS;
  }
  if (Object.keys(update).length === 0) return res.json({ ok: true, skipped: event });

  try {
    await db.updateRow({ databaseId: DB, tableId: REPORTS, rowId: reportId, data: update });
    log(`report ${reportId} <- ${JSON.stringify(update)}`);
    return res.json({ ok: true, update });
  } catch (e) {
    error(`update failed for ${reportId}: ${e.message}`);
    return res.json({ ok: false, reason: e.message }, 500);
  }
};
