// Visits sent by AI assistants (ChatGPT, Perplexity, Gemini…). ChatGPT adds
// "utm_source=chatgpt.com" to the links it gives, so these visits look like an ad
// campaign unless we name them: they are free, not paid.

const ASSISTANTS: [RegExp, string][] = [
  [/(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com|openai)$/, "ChatGPT"],
  [/(^|\.)(perplexity\.ai|perplexity)$/, "Perplexity"],
  [/(^|\.)(gemini\.google\.com|bard\.google\.com|gemini)$/, "Gemini"],
  [/(^|\.)(copilot\.microsoft\.com|copilot)$/, "Copilot"],
  [/(^|\.)(claude\.ai)$/, "Claude"],
  [/(^|\.)(chat\.deepseek\.com|deepseek\.com)$/, "DeepSeek"]
];

function nameOf(host: string): string | null {
  const h = host.trim().toLowerCase().replace(/^www\./, "");
  if (!h) return null;
  for (const [pattern, name] of ASSISTANTS) if (pattern.test(h)) return name;
  return null;
}

function param(campaign: string, key: string): string {
  const part = campaign.split(" · ").find((p) => p.startsWith(`${key}=`));
  return part ? part.slice(key.length + 1) : "";
}

/** The assistant's name when the campaign is only an AI tag (not a paid ad), else null. */
export function aiFromCampaign(campaign: string | null | undefined): string | null {
  if (!campaign) return null;
  if (param(campaign, "utm_medium").toLowerCase() === "paid") return null;
  return nameOf(param(campaign, "utm_source"));
}

/** The assistant's name for a referring site ("chatgpt.com", "https://perplexity.ai/…"), else null. */
export function aiFromReferrer(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  let host = referrer;
  try {
    if (/^https?:\/\//i.test(referrer)) host = new URL(referrer).hostname;
  } catch {
    // Not a URL: use the text as a host name.
  }
  return nameOf(host.split("/")[0]);
}

/** The assistant behind a visit, from its campaign or its referrer, else null. */
export function aiAssistant(campaign: string | null | undefined, referrer: string | null | undefined): string | null {
  return aiFromCampaign(campaign) ?? aiFromReferrer(referrer);
}
