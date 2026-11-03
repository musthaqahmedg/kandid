// Pure rules for Kandid, kept separate so they can be unit-tested.

export const MAX_DISTANCE_M = 200; // verifier must be within this distance of the report
export const FIXED_QUORUM = 3; // confirmations needed when the reporter hasn't confirmed

/** Great-circle distance in metres between two [lng, lat] points. */
export function distanceMetres([lng1, lat1], [lng2, lat2]) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * A row only counts if the user it claims to be from actually created it.
 * Appwrite only lets a user grant permissions to roles they belong to, so a
 * permission for user:<id> proves the creator is <id>.
 */
export function ownedBy(row, userId) {
  return Array.isArray(row.$permissions) && row.$permissions.some((p) => p.includes(`"user:${userId}"`));
}

/** Is this verification valid for this report? */
export function isValidVerification(v, report) {
  if (!ownedBy(v, v.user_id)) return false;
  if (!Array.isArray(v.location) || !Array.isArray(report.location)) return false;
  if (distanceMetres(v.location, report.location) > MAX_DISTANCE_M) return false;
  if (v.verdict === "fixed" && !v.photo_id) return false; // a fix needs an after photo
  return v.verdict === "fixed" || v.verdict === "still_broken";
}

/**
 * Work out a report's new state from all its verifications.
 * Fixed when (the reporter confirms OR FIXED_QUORUM people confirm) AND
 * more people say fixed than still broken. Otherwise it is (re)opened.
 */
export function computeState(report, verifications, now = new Date()) {
  const valid = verifications.filter((v) => isValidVerification(v, report));
  const fixed = valid.filter((v) => v.verdict === "fixed");
  const broken = valid.filter((v) => v.verdict === "still_broken");
  const reporterVote = valid.find((v) => v.user_id === report.reporter_id);
  const reporterSaysFixed = reporterVote?.verdict === "fixed";

  const isFixed = (reporterSaysFixed || fixed.length >= FIXED_QUORUM) && fixed.length > broken.length;

  let status;
  if (isFixed) status = "fixed";
  else if (report.status === "acknowledged") status = "acknowledged";
  else status = "open";

  // Latest after photo
  const latestFix = [...fixed].sort((a, b) => (a.$createdAt < b.$createdAt ? 1 : -1))[0];

  return {
    status,
    fixed_votes: fixed.length,
    broken_votes: broken.length,
    fixed_at: isFixed ? (report.status === "fixed" && report.fixed_at ? report.fixed_at : now.toISOString()) : null,
    fixed_photo_id: isFixed ? latestFix?.photo_id ?? null : null,
    reporter_rating: isFixed && reporterVote?.verdict === "fixed" ? reporterVote.rating ?? null : null,
  };
}

/** Count upvotes, ignoring any row not really created by the user it names. */
export function countUpvotes(rows) {
  const users = new Set();
  for (const r of rows) if (ownedBy(r, r.user_id)) users.add(r.user_id);
  return users.size;
}
