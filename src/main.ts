import { startRouter } from "./router";
import { captureCampaign } from "./utils/campaign";
import { initTracking } from "./utils/tracking";
import { initVisitActions } from "./utils/visitorTracker";
import { initFavorites } from "./components/favorites";
import { initChat } from "./components/chat";
import { initBackToTop } from "./components/backToTop";
import { initPhoneInputs } from "./components/phoneInput";
import { initCookieConsent } from "./components/cookieConsent";
import { ensureRoute } from "./i18n/load";
import { parseRoute, splitLocale } from "./seo/routes";

captureCampaign();
initTracking();
initVisitActions();

// Only what the first page reads is downloaded before the first render (see i18n/load.ts).
const first = splitLocale(window.location.pathname);
void ensureRoute(parseRoute(first.path), first.locale).then(() => {
  initFavorites();
  initChat();
  const app = document.querySelector<HTMLDivElement>("#app")!;
  startRouter(app);
  initBackToTop();
  initPhoneInputs();
  initCookieConsent();
});
