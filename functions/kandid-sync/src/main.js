import { Client, Query, TablesDB } from "node-appwrite";
import { computeState, countUpvotes } from "./rules.js";

const DB = "kandid";
const REPORTS = "reports";
const UPVOTES = "upvotes";
const VERIFICATIONS = "verifications";

async function listAll(db, tableId, reportId) {
  const rows = [];
  let cursor = null;
  for (let page = 0; page < 20; page++) {
    const queries = [Query.equal("report_id", reportId), Query.limit(100)];
    if (cursor) queries.push(Query.cursorAfter(cursor));
    const res = await db.listRows({ databaseId: DB, tableId, queries });
    rows.push(...res.rows);
    if (res.rows.length < 100) break;
    cursor = res.rows[res.rows.length - 1].$id;
  }
  return rows;
}

// Triggered by create/update/delete events on the upvotes and verifications tables.
export default async ({ req, res, log, error }) => {
  const event = req.headers["x-appwrite-event"] || "";
  const row = req.bodyJson || {};
  const reportId = row.report_id;
  if (!reportId) return res.json({ ok: false, reason: "no report_id" });

  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers["x-appwrite-key"]);
  const db = new TablesDB(client);

  let report;
  try {
    report = await db.getRow({ databaseId: DB, tableId: REPORTS, rowId: reportId });
  } catch {
    return res.json({ ok: false, reason: "report not found" });
  }

  const update = {};
  if (event.includes(`.tables.${UPVOTES}.`)) {
    update.upvote_count = countUpvotes(await listAll(db, UPVOTES, reportId));
  }
  if (event.includes(`.tables.${VERIFICATIONS}.`)) {
    Object.assign(update, computeState(report, await listAll(db, VERIFICATIONS, reportId)));
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
