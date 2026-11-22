// Visits from the group's parent website (byhadara.com, utm_source=byhadara) are named as such
// in the Telegram alert, not shown as an ad (owner 2026-11-22).
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fromGroupSite, groupPlacement } from "../.test-build/_lib/groupSource.js";
import { newVisitorMessage } from "../.test-build/_lib/visitAlerts.js";

const view = (campaign, referrer = "") => ({ sessionId: randomUUID(), path: "/projects/marmara-haven-villa", locale: "ar", referrer, title: "", landingPath: "/projects/marmara-haven-villa", landingTitle: "", trail: [], trailSkipped: 0, campaign });
const PLACE = { country: "TR", city: "Istanbul" };
const ORIGIN = "https://www.hadararealestate.com";

test("the group site is recognised from utm_source or the referrer", () => {
  assert.equal(fromGroupSite("utm_source=byhadara · utm_medium=referral · utm_campaign=home", ""), true);
  assert.equal(fromGroupSite("utm_source=byhadara.com", ""), true);
  assert.equal(fromGroupSite("utm_source=byhadara · utm_medium=paid", ""), false);
  assert.equal(fromGroupSite("", "byhadara.com"), true);
  assert.equal(fromGroupSite("", "https://www.byhadara.com/ar/insights"), true);
  assert.equal(fromGroupSite("", "notbyhadara.com"), false);
  assert.equal(fromGroupSite("utm_source=facebook · utm_campaign=villa", "google.com"), false);
  assert.equal(groupPlacement("utm_source=byhadara · utm_medium=referral · utm_campaign=article-lotus-yasam"), "article-lotus-yasam");
});

test("the alert names the group site and the page that sent the visitor", () => {
  const msg = newVisitorMessage(view("utm_source=byhadara · utm_medium=referral · utm_campaign=home"), PLACE, ORIGIN);
  assert.match(msg, /🏛️ جاء من: موقع حضارة الأم \(BYHADARA Group\) · home/);
  assert.doesNotMatch(msg, /📣 الإعلان/);
  const byRef = newVisitorMessage(view("", "byhadara.com"), PLACE, ORIGIN);
  assert.match(byRef, /🏛️ جاء من: موقع حضارة الأم/);
  const ad = newVisitorMessage(view("utm_source=facebook · utm_campaign=villa"), PLACE, ORIGIN);
  assert.match(ad, /📣 الإعلان/);
});

test("the Google Business Profile link is named in the alert, not shown as an ad", async () => {
  const { fromGoogleBusiness } = await import("../.test-build/_lib/groupSource.js");
  assert.equal(fromGoogleBusiness("utm_source=google_business · utm_medium=organic · utm_campaign=gbp"), true);
  assert.equal(fromGoogleBusiness("utm_source=google_business · utm_medium=paid"), false);
  assert.equal(fromGoogleBusiness("utm_source=google · utm_medium=cpc"), false);
  const msg = newVisitorMessage(view("utm_source=google_business · utm_medium=organic · utm_campaign=gbp"), PLACE, ORIGIN);
  assert.match(msg, /📍 جاء من: ملف جوجل التجاري \(خرائط جوجل\)/);
  assert.doesNotMatch(msg, /📣 الإعلان/);
});
