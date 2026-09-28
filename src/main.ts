import { startRouter } from "./router";
import { captureCampaign } from "./utils/campaign";
import { initTracking } from "./utils/tracking";
import { initFavorites } from "./components/favorites";
import { initChat } from "./components/chat";
import { initBackToTop } from "./components/backToTop";
import { initCookieConsent } from "./components/cookieConsent";

captureCampaign();
initTracking();
initFavorites();
initChat();

const app = document.querySelector<HTMLDivElement>("#app")!;
startRouter(app);
initBackToTop();
initCookieConsent();
