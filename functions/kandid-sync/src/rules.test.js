import assert from "node:assert/strict";
import { test } from "node:test";
import { computeState, countUpvotes, distanceMetres, isValidVerification } from "./rules.js";

const R = { $id: "r", reporter_id: "rep", status: "open", location: [76.6544, 10.7764] };
const near = [76.6550, 10.7766]; // ~70 m
const far = [76.67, 10.79]; // ~2 km
let n = 0;
const v = (user, verdict, loc = near, extra = {}) => ({
  $id: `v${++n}`, $createdAt: new Date(2026, 0, 1, 0, n).toISOString(),
  $permissions: [`read("any")`, `update("user:${user}")`, `delete("user:${user}")`],
  user_id: user, verdict, location: loc, photo_id: verdict === "fixed" ? `p${n}` : null, ...extra,
});

test("distance", () => {
  const d = distanceMetres(R.location, near);
  assert.ok(d > 50 && d < 100, `got ${d}`);
});

test("reporter confirming fixes it", () => {
  const s = computeState(R, [v("rep", "fixed", near, { rating: 4 })]);
  assert.equal(s.status, "fixed");
  assert.equal(s.reporter_rating, 4);
  assert.ok(s.fixed_at);
});

test("two strangers are not enough, three are", () => {
  assert.equal(computeState(R, [v("a", "fixed"), v("b", "fixed")]).status, "open");
  assert.equal(computeState(R, [v("a", "fixed"), v("b", "fixed"), v("c", "fixed")]).status, "fixed");
});

test("more still-broken votes reopen it", () => {
  const vs = [v("rep", "fixed"), v("a", "still_broken"), v("b", "still_broken")];
  assert.equal(computeState({ ...R, status: "fixed", fixed_at: "x" }, vs).status, "open");
});

test("votes from far away, without photo, or forged are ignored", () => {
  const forged = { ...v("a", "fixed"), user_id: "rep" }; // claims to be reporter, created by a
  const noPhoto = { ...v("b", "fixed"), photo_id: null };
  const s = computeState(R, [v("c", "fixed", far), noPhoto, forged]);
  assert.equal(s.status, "open");
  assert.equal(s.fixed_votes, 0);
  assert.equal(isValidVerification(forged, R), false);
});

test("keeps original fixed_at while it stays fixed", () => {
  const s = computeState({ ...R, status: "fixed", fixed_at: "2026-01-05T00:00:00.000Z" }, [v("rep", "fixed")]);
  assert.equal(s.fixed_at, "2026-01-05T00:00:00.000Z");
});

test("acknowledged stays acknowledged until fixed", () => {
  assert.equal(computeState({ ...R, status: "acknowledged" }, [v("a", "still_broken")]).status, "acknowledged");
});

test("upvotes count unique real users only", () => {
  const up = (u, claim = u) => ({ user_id: claim, $permissions: [`delete("user:${u}")`] });
  assert.equal(countUpvotes([up("a"), up("b"), up("a"), up("c", "z")]), 2);
});

import { HIDE_AT_FLAGS, countFlags } from "./rules.js";
test("flags: distinct real users, reporter's own flag ignored", () => {
  const f = (u, claim = u) => ({ user_id: claim, $permissions: [`read("user:${u}")`] });
  assert.equal(countFlags([f("a"), f("a"), f("b"), f("rep"), f("c", "z")], R), 2);
  assert.equal(HIDE_AT_FLAGS, 3);
});
