import { startRouter } from "./router";
import { captureCampaign } from "./utils/campaign";
import { initFavorites } from "./components/favorites";

captureCampaign();
initFavorites();

const app = document.querySelector<HTMLDivElement>("#app")!;
startRouter(app);
