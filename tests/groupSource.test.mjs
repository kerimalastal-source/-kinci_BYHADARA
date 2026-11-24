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

test("the Instagram bio link is named in the alert, not shown as an ad", async () => {
  const { bioLink } = await import("../.test-build/_lib/groupSource.js");
  const bio = "utm_source=ig · utm_medium=social · utm_content=link_in_bio · fbclid=PAZXh0bg";
  assert.equal(bioLink(bio), "رابط البايو في إنستغرام");
  assert.equal(bioLink("utm_source=facebook · utm_content=link_in_bio"), "رابط البايو في فيسبوك");
  assert.equal(bioLink("utm_source=ig · utm_medium=paid · utm_content=link_in_bio"), "");
  assert.equal(bioLink("utm_source=facebook · utm_campaign=villa"), "");
  const msg = newVisitorMessage(view(bio), PLACE, ORIGIN);
  assert.match(msg, /📸 جاء من: رابط البايو في إنستغرام \(ليس إعلاناً\)/);
  assert.doesNotMatch(msg, /📣 الإعلان|fbclid/);
});

test("the owner's personal Instagram link is named, even with Instagram's bio tag added", async () => {
  const { fromOwnerPersonal } = await import("../.test-build/_lib/groupSource.js");
  const link = "utm_source=owner · utm_medium=social · utm_campaign=personal-bio";
  assert.equal(fromOwnerPersonal(link), true);
  assert.equal(fromOwnerPersonal("utm_source=ig · utm_content=link_in_bio"), false);
  const msg = newVisitorMessage(view(`${link} · utm_content=link_in_bio · fbclid=x`), PLACE, ORIGIN);
  assert.match(msg, /👤 جاء من: حساب المالك الشخصي على إنستغرام \(رابط البايو\)/);
  assert.doesNotMatch(msg, /📸|📣/);
});

test("the company's own Instagram bio link is named", async () => {
  const { fromCompanyInstagram } = await import("../.test-build/_lib/groupSource.js");
  const link = "utm_source=hadara_ig · utm_medium=social · utm_campaign=company-bio";
  assert.equal(fromCompanyInstagram(link), true);
  assert.equal(fromCompanyInstagram("utm_source=ig · utm_content=link_in_bio"), false);
  const msg = newVisitorMessage(view(`${link} · utm_content=link_in_bio · fbclid=x`), PLACE, ORIGIN);
  assert.match(msg, /📸 جاء من: حساب الشركة على إنستغرام \(hadararealestate\) \(رابط البايو\)/);
  assert.doesNotMatch(msg, /👤|📣|fbclid/);
});

test("a link inside our PDF catalogues is named, not shown as an ad", async () => {
  const { catalogLink } = await import("../.test-build/_lib/groupSource.js");
  const link = "utm_source=catalog · utm_medium=print · utm_campaign=catalog-2026";
  assert.equal(catalogLink(link), "كتالوج مشاريع حضارة (PDF)");
  assert.equal(catalogLink("utm_source=catalog · utm_medium=print · utm_campaign=villa-brochure-2026"), "كتالوج فيلا مرمرة هيفن (PDF)");
  assert.equal(catalogLink("utm_source=catalog · utm_medium=paid"), "");
  assert.equal(catalogLink("utm_source=facebook · utm_campaign=catalog-2026"), "");
  const msg = newVisitorMessage(view(link), PLACE, ORIGIN);
  assert.match(msg, /📄 جاء من: رابط داخل كتالوج مشاريع حضارة \(PDF\)/);
  assert.doesNotMatch(msg, /📣 الإعلان/);
});
