import { supabase } from "../lib/supabase";

/**
 * The admin "connect a WhatsApp number" button: Meta's Embedded Signup with coexistence
 * (the number keeps working on the WhatsApp Business app). Facebook's SDK loads only when the
 * button is pressed. The popup posts the WABA id to this window (WA_EMBEDDED_SIGNUP message)
 * and FB.login returns a one-time code; both go to /api/meta-leads, which finishes the job
 * (api/_lib/whatsappConnect.ts).
 */

/** Meta app "HADARA Publisher Real Estate" (public id, like the Pixel). */
export const META_APP_ID = "1839985177009532";
/** Facebook Login for Business configuration (WhatsApp Embedded Signup); not secret. */
export const WA_SIGNUP_CONFIG_ID = "";
const CONFIG_KEY = "hadara-wa-config";
const SDK_VERSION = "v22.0";

export interface ConnectResult {
  ok: boolean;
  wabaId?: string;
  numbers?: { id: string; display: string; name: string }[];
  subscribed?: boolean;
  error?: string;
  detail?: string;
  missing?: string;
  /** The popup's last step when the admin closed it, or Meta's message on an error. */
  step?: string;
  status?: number;
}

interface FbLoginResponse {
  authResponse?: { code?: string } | null;
  status?: string;
}
interface FbSdk {
  init(options: Record<string, unknown>): void;
  login(callback: (response: FbLoginResponse) => void, options: Record<string, unknown>): void;
}
declare global {
  interface Window {
    FB?: FbSdk;
    fbAsyncInit?: () => void;
  }
}

export function savedConfigId(): string {
  try {
    return localStorage.getItem(CONFIG_KEY) || WA_SIGNUP_CONFIG_ID;
  } catch {
    return WA_SIGNUP_CONFIG_ID;
  }
}

function saveConfigId(id: string): void {
  try {
    localStorage.setItem(CONFIG_KEY, id);
  } catch {
    /* private window: nothing to remember */
  }
}

let sdk: Promise<FbSdk> | null = null;

/** Loads Facebook's SDK ahead of the click (the popup must open straight from the click). */
export function loadSdk(): Promise<FbSdk> {
  if (window.FB) return Promise.resolve(window.FB);
  sdk ??= new Promise<FbSdk>((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB!.init({ appId: META_APP_ID, autoLogAppEvents: false, xfbml: false, version: SDK_VERSION });
      resolve(window.FB!);
    };
    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => {
      sdk = null;
      reject(new Error("sdk"));
    };
    document.head.appendChild(script);
  });
  return sdk;
}

interface SessionInfo {
  wabaId: string;
  phoneNumberId: string;
  cancelled?: string;
  error?: string;
}

/** Listens for the signup popup's WA_EMBEDDED_SIGNUP messages until stop() is called. */
function listenForSession() {
  let info: SessionInfo | null = null;
  const onMessage = (event: MessageEvent) => {
    if (!/(^|\.)facebook\.com$/.test(new URL(event.origin).hostname)) return;
    let data: { type?: string; event?: string; data?: Record<string, string> } | null = null;
    try {
      data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
    } catch {
      return;
    }
    if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
    const d = data.data ?? {};
    if (data.event === "CANCEL") info = { wabaId: "", phoneNumberId: "", cancelled: d.current_step || "cancel" };
    else if (data.event === "ERROR") info = { wabaId: "", phoneNumberId: "", error: d.error_message || "error" };
    else if (data.event?.startsWith("FINISH")) info = { wabaId: d.waba_id ?? "", phoneNumberId: d.phone_number_id ?? "" };
  };
  window.addEventListener("message", onMessage);
  return {
    get: () => info,
    stop: () => window.removeEventListener("message", onMessage)
  };
}

async function finish(code: string, info: SessionInfo | null): Promise<ConnectResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "session" };
  try {
    const res = await fetch("/api/meta-leads", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "whatsapp-connect",
        code,
        wabaId: info?.wabaId ?? "",
        phoneNumberId: info?.phoneNumberId ?? "",
        page: location.origin + location.pathname
      })
    });
    if (res.status === 403) return { ok: false, error: "forbidden", status: 403 };
    const body = (await res.json().catch(() => null)) as ConnectResult | null;
    return body ?? { ok: false, error: "http", status: res.status };
  } catch {
    return { ok: false, error: "network" };
  }
}

/** Runs the whole signup; resolves with what happened (never throws). */
export async function connectWhatsAppNumber(configId: string): Promise<ConnectResult> {
  const config = configId.trim();
  if (!/^\d{5,30}$/.test(config)) return { ok: false, error: "config" };
  saveConfigId(config);
  // FB.login has to run in the click itself, or the browser blocks Meta's popup.
  const fb = window.FB;
  if (!fb) {
    void loadSdk().catch(() => undefined);
    return { ok: false, error: "sdk" };
  }
  const session = listenForSession();
  const response = await new Promise<FbLoginResponse>((resolve) =>
    fb.login(resolve, {
      config_id: config,
      response_type: "code",
      override_default_response_type: true,
      extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" }
    })
  );
  // The popup's message can arrive just after the login callback.
  for (let i = 0; i < 20 && !session.get(); i++) await new Promise((r) => setTimeout(r, 150));
  session.stop();
  const info = session.get();
  const code = response.authResponse?.code;
  if (!code) {
    if (info?.error) return { ok: false, error: "meta", step: info.error };
    return { ok: false, error: "cancelled", step: info?.cancelled };
  }
  return finish(code, info);
}
