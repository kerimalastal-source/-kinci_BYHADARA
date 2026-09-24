import { t, link } from "../../i18n";
import { fetchApprovedListings, fetchCoverPhotos, type Listing, type PropertyType } from "../../data/listings";
import { renderListingCard } from "../../components/listingCard";

type FilterKey = "all" | PropertyType;

const PROPERTY_TYPES: PropertyType[] = ["apartment", "villa", "land", "commercial", "other"];

export function renderResaleList(el: HTMLElement): void {
  el.innerHTML = `
    <section class="page-hero">
      <div class="container">
        <p class="eyebrow eyebrow--on-dark">${t("resale.heroEyebrow")}</p>
        <h1>${t("resale.heroTitle")}</h1>
        <p class="page-hero__subtitle">${t("resale.heroSubtitle")}</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="filter-bar" id="filter-bar">
          <button type="button" class="filter-chip is-active" data-filter="all">${t("resale.filterAll")}</button>
          ${PROPERTY_TYPES.map((pt) => `<button type="button" class="filter-chip" data-filter="${pt}">${t(`account.propertyTypes.${pt}`)}</button>`).join("")}
        </div>
        <div class="project-grid" id="listing-grid"></div>
        <p class="project-grid__empty" id="listing-empty" hidden>${t("resale.noResults")}</p>
        <p class="project-grid__empty" id="listing-error" hidden>${t("resale.loadError")}</p>

        <div class="cta-card resale-sell-cta">
          <h3>${t("resale.wantToSellCta")}</h3>
          <a class="btn btn--primary" href="${link("/register")}">${t("resale.wantToSellButton")}</a>
        </div>
      </div>
    </section>
  `;

  const requestId = crypto.randomUUID();
  el.dataset.requestId = requestId;

  const filterBar = el.querySelector<HTMLElement>("#filter-bar")!;
  const grid = el.querySelector<HTMLElement>("#listing-grid")!;
  const empty = el.querySelector<HTMLElement>("#listing-empty")!;
  const errorEl = el.querySelector<HTMLElement>("#listing-error")!;

  let listings: Listing[] = [];
  let covers: Record<string, string> = {};

  function paint(filtered: Listing[]): void {
    grid.innerHTML = filtered.map((l) => renderListingCard(l, covers[l.id])).join("");
    empty.hidden = filtered.length > 0;
  }

  // Wired up immediately (not inside the fetch) so the filters are never dead,
  // even if the listings request is slow, empty, or fails outright.
  filterBar.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".filter-chip");
    if (!btn) return;
    const key = btn.dataset.filter as FilterKey;

    filterBar.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("is-active"));
    btn.classList.add("is-active");

    paint(key === "all" ? listings : listings.filter((l) => l.property_type === key));
  });

  fetchApprovedListings()
    .then(async (data) => {
      if (el.dataset.requestId !== requestId) return;
      listings = data;
      covers = await fetchCoverPhotos(listings.map((l) => l.id));
      if (el.dataset.requestId !== requestId) return;
      paint(listings);
    })
    .catch((err) => {
      console.error(err);
      if (el.dataset.requestId !== requestId) return;
      empty.hidden = true;
      errorEl.hidden = false;
    });
}
