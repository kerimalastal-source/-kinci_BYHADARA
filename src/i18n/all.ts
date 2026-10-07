// Registers all five dictionaries at once, for build-time code (SEO tags, prerender) that renders every language.
import en from "./en.json";
import ar from "./ar.json";
import fa from "./fa.json";
import fr from "./fr.json";
import ru from "./ru.json";
import { registerDictionary } from "./dictionaries";

registerDictionary("en", en);
registerDictionary("ar", ar);
registerDictionary("fa", fa);
registerDictionary("fr", fr);
registerDictionary("ru", ru);
