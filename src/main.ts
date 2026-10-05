import { startRouter } from "./router";
import { captureCampaign } from "./utils/campaign";
import { initTracking } from "./utils/tracking";
import { initVisitActions } from "./utils/visitorTracker";
import { initFavorites } from "./components/favorites";
import { initChat } from "./components/chat";
import { initBackToTop } from "./components/backToTop";
import { initCookieConsent } from "./components/cookieConsent";
import { ensureLocales } from "./i18n/load";
import { splitLocale } from "./seo/routes";

captureCampaign();
initTracking();
initVisitActions();

// Only the page language is downloaded before the first render (see i18n/load.ts).
void ensureLocales([splitLocale(window.location.pathname).locale]).then(() => {
  initFavorites();
  initChat();
  const app = document.querySelector<HTMLDivElement>("#app")!;
  startRouter(app);
  initBackToTop();
  initCookieConsent();
});
