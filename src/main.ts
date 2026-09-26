import { startRouter } from "./router";
import { captureCampaign } from "./utils/campaign";

captureCampaign();

const app = document.querySelector<HTMLDivElement>("#app")!;
startRouter(app);
