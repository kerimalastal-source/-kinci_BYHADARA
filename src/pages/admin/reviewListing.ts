import { t, link } from "../../i18n";
import { requireAdmin } from "../../auth/session";
import { navigate } from "../../router";
import { renderNotFound } from "../notFound";
import { fetchProfileById } from "../../data/profiles";
import { openLightbox } from "../../components/lightbox";
import { escapeHtml } from "../../utils/html";
import {
  fetchListingById,
  fetchListingPhotos,
  approveListing,
  rejectListing,
  listingPhotoUrl,
  type Listing,
  type ListingPhoto
} from "../../data/listings";
import type { Profile } from "../../auth/session";

export function renderAdminReviewListing(main: HTMLElement, listingId: string): void {
  if (!requireAdmin(main)) return;

  main.innerHTML = `<section class="section"><div class="container"><p>${t("common.loading")}</p></div></section>`;

  const requestId = crypto.randomUUID();
  main.dataset.requestId = requestId;

  Promise.all([fetchListingById(listingId), fetchListingPhotos(listingId)])
    .then(async ([listing, photos]) => {
      if (main.dataset.requestId !== requestId) return;
      if (!listing) {
        renderNotFound(main);
        return;
      }
      const seller = await fetchProfileById(listing.owner_id);
      if (main.dataset.requestId !== requestId) return;
      paint(main, listing, photos, seller);
    })
    .catch((err) => console.error(err));
}

function paint(main: HTMLElement, listing: Listing, photos: ListingPhoto[], seller: Profile | null): void {
  main.innerHTML = `
    <section class="page-hero">
      <div class="container">
        <a class="back-link" href="${link("/admin")}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          ${t("admin.backToQueueButton")}
        </a>
        <span class="status-badge status-badge--${listing.status}">${t(`account.statusLabels.${listing.status}`)}</span>
        <h1>${escapeHtml(listing.title)}</h1>
        <p class="page-hero__subtitle">${escapeHtml([listing.district, listing.city].filter(Boolean).join(", "))}</p>
      </div>
    </section>

    <section class="section project-detail">
      <div class="container project-detail__grid">
        <div class="project-detail__main">
          <h2>${t("admin.listingInfoTitle")}</h2>
          <p class="project-detail__description">${escapeHtml(listing.description)}</p>

          <div class="review-summary">
            <dl>
              <div><dt>${t("account.propertyTypeLabel")}</dt><dd>${listing.property_type ? t(`account.propertyTypes.${listing.property_type}`) : "—"}</dd></div>
              <div><dt>${t("account.sizeLabel")}</dt><dd dir="ltr">${listing.size_m2 ?? "—"} m²</dd></div>
              <div><dt>${t("account.bedroomsLabel")}</dt><dd dir="ltr">${listing.bedrooms ?? "—"}</dd></div>
              <div><dt>${t("account.bathroomsLabel")}</dt><dd dir="ltr">${listing.bathrooms ?? "—"}</dd></div>
              <div><dt>${t("account.priceLabel")}</dt><dd dir="ltr">${listing.asking_price?.toLocaleString() ?? "—"} ${listing.currency}</dd></div>
              <div><dt>${t("account.purchaseYearLabel")}</dt><dd dir="ltr">${listing.original_purchase_year ?? "—"}</dd></div>
              <div><dt>${t("account.addressLabel")}</dt><dd>${escapeHtml(listing.address_line) || "—"}</dd></div>
            </dl>
          </div>

          <h2>${t("admin.photosTitle")}</h2>
          <div class="gallery-grid" id="admin-gallery">
            ${photos
              .map(
                (p, i) => `
              <button type="button" class="gallery-grid__item${i === 0 ? " gallery-grid__item--wide" : ""}" data-index="${i}">
                <img src="${listingPhotoUrl(p.storage_path)}" alt="" loading="lazy" />
              </button>`
              )
              .join("")}
          </div>
        </div>

        <aside class="project-detail__sidebar">
          <div class="fact-card">
            <h3>${t("admin.sellerInfoTitle")}</h3>
            <dl class="fact-list">
              <div><dt>${t("account.fullNameLabel")}</dt><dd>${escapeHtml(seller?.full_name) || "—"}</dd></div>
              <div><dt>${t("account.phoneLabel")}</dt><dd dir="ltr">${escapeHtml(seller?.phone) || "—"}</dd></div>
              <div><dt>${t("account.countryLabel")}</dt><dd>${escapeHtml(seller?.country) || "—"}</dd></div>
            </dl>
          </div>

          ${
            listing.status === "pending_review"
              ? `
          <div class="cta-card">
            <h3>${t("admin.reviewTitle")}</h3>
            <button type="button" class="btn btn--primary btn--block" id="approve-btn">${t("admin.approveButton")}</button>
            <div class="form-field" style="margin-top: 1rem;">
              <label for="reject-reason">${t("admin.rejectionReasonPrompt")}</label>
              <textarea id="reject-reason" rows="3" placeholder="${t("admin.rejectionReasonPlaceholder")}"></textarea>
              <p class="form-field__error" data-error-for="reason"></p>
            </div>
            <button type="button" class="btn btn--outline btn--block" id="reject-btn">${t("admin.rejectButton")}</button>
            <p class="form-field__error" data-error-for="general"></p>
          </div>`
              : ""
          }
        </aside>
      </div>
    </section>
  `;

  const gallery = main.querySelector<HTMLElement>("#admin-gallery")!;
  gallery.querySelectorAll<HTMLButtonElement>(".gallery-grid__item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      openLightbox(
        photos.map((p) => ({ src: listingPhotoUrl(p.storage_path), alt: "" })),
        index
      );
    });
  });

  const approveBtn = main.querySelector<HTMLButtonElement>("#approve-btn");
  approveBtn?.addEventListener("click", () => {
    approveBtn.disabled = true;
    approveBtn.textContent = t("admin.approving");
    approveListing(listing.id)
      .then(() => navigate("/admin"))
      .catch((err) => {
        console.error(err);
        approveBtn.disabled = false;
        approveBtn.textContent = t("admin.approveButton");
      });
  });

  const rejectBtn = main.querySelector<HTMLButtonElement>("#reject-btn");
  rejectBtn?.addEventListener("click", () => {
    const textarea = main.querySelector<HTMLTextAreaElement>("#reject-reason")!;
    const reason = textarea.value.trim();
    const errorEl = main.querySelector<HTMLElement>('[data-error-for="reason"]')!;
    if (!reason) {
      errorEl.textContent = t("admin.rejectionReasonPrompt");
      return;
    }
    errorEl.textContent = "";
    rejectBtn.disabled = true;
    rejectBtn.textContent = t("admin.rejecting");
    rejectListing(listing.id, reason)
      .then(() => navigate("/admin"))
      .catch((err) => {
        console.error(err);
        rejectBtn.disabled = false;
        rejectBtn.textContent = t("admin.rejectButton");
      });
  });
}
