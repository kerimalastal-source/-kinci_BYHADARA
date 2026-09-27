import { startRouter } from "./router";
import { captureCampaign } from "./utils/campaign";
import { initFavorites } from "./components/favorites";
import { initChat } from "./components/chat";
import { initBackToTop } from "./components/backToTop";

captureCampaign();
initFavorites();
initChat();

const app = document.querySelector<HTMLDivElement>("#app")!;
startRouter(app);
initBackToTop();
