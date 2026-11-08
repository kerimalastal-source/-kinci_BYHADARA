// Visits from AI assistants (ChatGPT adds utm_source=chatgpt.com to its links) are named
// as such in the Telegram alert, not shown as an ad.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { aiAssistant, aiFromCampaign, aiFromReferrer } from "../.test-build/_lib/aiSources.js";
import { newVisitorMessage } from "../.test-build/_lib/visitAlerts.js";

const view = (campaign, referrer = "") => ({ sessionId: randomUUID(), path: "/projects/alya-city-veliefendi", locale: "en", referrer, title: "", landingPath: "/projects/alya-city-veliefendi", landingTitle: "", trail: [], trailSkipped: 0, campaign });
const PLACE = { country: "IL", city: "Rishon LeTsiyyon" };

test("AI assistants are recognised from utm_source or the referrer", () => {
  assert.equal(aiFromCampaign("utm_source=chatgpt.com"), "ChatGPT");
  assert.equal(aiFromCampaign("utm_source=perplexity"), "Perplexity");
  assert.equal(aiFromCampaign("utm_source=chatgpt.com · utm_medium=paid"), null);
  assert.equal(aiFromCampaign("utm_source=facebook · utm_campaign=gulf-villa-en"), null);
  assert.equal(aiFromReferrer("www.perplexity.ai"), "Perplexity");
  assert.equal(aiFromReferrer("https://gemini.google.com/app"), "Gemini");
  assert.equal(aiFromReferrer("google.com"), null);
  assert.equal(aiFromReferrer("notchatgpt.com.evil"), null);
  assert.equal(aiAssistant("", "chatgpt.com"), "ChatGPT");
  assert.equal(aiAssistant("", ""), null);
});

test("the alert says 🤖 ChatGPT instead of 📣 ad", () => {
  const ai = newVisitorMessage(view("utm_source=chatgpt.com"), PLACE, "https://www.hadararealestate.com");
  assert.match(ai, /🤖 جاء من: ChatGPT/);
  assert.doesNotMatch(ai, /📣/);
  const ad = newVisitorMessage(view("utm_source=facebook · utm_campaign=villa"), PLACE, "https://www.hadararealestate.com");
  assert.match(ad, /📣 الإعلان: utm_source=facebook/);
  assert.doesNotMatch(ad, /🤖/);
});
