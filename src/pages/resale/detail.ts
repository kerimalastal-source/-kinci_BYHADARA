import { t } from "../../i18n";
import { renderNotFound } from "../notFound";
import { openLightbox } from "../../components/lightbox";
import {
  fetchListingById,
  fetchListingPhotos,
  listingPhotoUrl,
  submitInquiry,
  type Listing,
  type ListingPhoto
} from "../../data/listings";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+()\d\s-]{7,20}$/;

export function renderResaleDetail(el: HTMLElement, id: string): void {
  el.innerHTML = `<section class="section"><div class="container"><p>${t("common.loading")}</p></div></section>`;

  const requestId = crypto.randomUUID();
  el.dataset.requestId = requestId;

  Promise.all([fetchListingById(id), fetchListingPhotos(id)])
    .then(([listing, photos]) => {
      if (el.dataset.requestId !== requestId) return;
      if (!listing || listing.status !== "approved") {
        renderNotFound(el);
        return;
      }
      paint(el, listing, photos);
    })
    .catch((err) => console.error(err));
}

function paint(el: HTMLElement, listing: Listing, photos: ListingPhoto[]): void {
  el.innerHTML = `
    <section class="project-hero" style="background-image: linear-gradient(180deg, rgba(15,20,18,.35), rgba(15,20,18,.88)), url('${photos[0] ? listingPhotoUrl(photos[0].storage_path) : ""}')">
      <div class="container project-hero__inner">
        <a class="back-link" href="#/resale">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          ${t("resale.detailBackLabel")}
        </a>
        <h1>${listing.title}</h1>
        <p class="project-hero__location">${[listing.district, listing.city].filter(Boolean).join(", ")}</p>
      </div>
    </section>

    <section class="section project-detail">
      <div class="container project-detail__grid">
        <div class="project-detail__main">
          <h2>${t("resale.detailOverviewTitle")}</h2>
          <p class="project-detail__description">${listing.description ?? ""}</p>

          <h2>${t("resale.detailGalleryTitle")}</h2>
          <div class="gallery-grid" id="listing-gallery">
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
            <h3>${t("resale.detailFactsTitle")}</h3>
            <dl class="fact-list">
              <div><dt>${t("account.propertyTypeLabel")}</dt><dd>${listing.property_type ? t(`account.propertyTypes.${listing.property_type}`) : "—"}</dd></div>
              <div><dt>${t("resale.sizeLabel")}</dt><dd dir="ltr">${listing.size_m2 ?? "—"} m²</dd></div>
              <div><dt>${t("resale.bedroomsLabel")}</dt><dd dir="ltr">${listing.bedrooms ?? "—"}</dd></div>
              <div><dt>${t("account.bathroomsLabel")}</dt><dd dir="ltr">${listing.bathrooms ?? "—"}</dd></div>
              <div><dt>${t("resale.priceLabel")}</dt><dd dir="ltr">${listing.asking_price ? listing.asking_price.toLocaleString() : "—"} ${listing.currency}</dd></div>
            </dl>
          </div>

          <div class="cta-card">
            <h3>${t("resale.inquiryTitle")}</h3>
            <p>${t("resale.inquiryText")}</p>
            <form class="auth-form" id="inquiry-form" novalidate style="background: transparent; border: none; padding: 0; box-shadow: none;">
              <div class="form-field">
                <label for="iq-name">${t("resale.inquiryNameLabel")}</label>
                <input type="text" id="iq-name" name="name" />
                <p class="form-field__error" data-error-for="name"></p>
              </div>
              <div class="form-field">
                <label for="iq-email">${t("resale.inquiryEmailLabel")}</label>
                <input dir="ltr" type="email" id="iq-email" name="email" />
                <p class="form-field__error" data-error-for="email"></p>
              </div>
              <div class="form-field">
                <label for="iq-phone">${t("resale.inquiryPhoneLabel")}</label>
                <input dir="ltr" type="tel" id="iq-phone" name="phone" />
                <p class="form-field__error" data-error-for="phone"></p>
              </div>
              <div class="form-field">
                <label for="iq-message">${t("resale.inquiryMessageLabel")}</label>
                <textarea id="iq-message" name="message" rows="3" placeholder="${t("resale.inquiryMessagePlaceholder")}"></textarea>
              </div>
              <button type="submit" class="btn btn--primary btn--block" id="iq-submit">${t("resale.inquirySubmitButton")}</button>
            </form>
            <div class="contact-form__success" id="iq-success" hidden>
              <strong>${t("resale.inquirySuccessTitle")}</strong>
              <p>${t("resale.inquirySuccessText")}</p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  `;

  const gallery = el.querySelector<HTMLElement>("#listing-gallery")!;
  gallery.querySelectorAll<HTMLButtonElement>(".gallery-grid__item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.index);
      openLightbox(
        photos.map((p) => ({ src: listingPhotoUrl(p.storage_path), alt: "" })),
        index
      );
    });
  });

  const form = el.querySelector<HTMLFormElement>("#inquiry-form")!;
  const submitBtn = el.querySelector<HTMLButtonElement>("#iq-submit")!;
  const successBox = el.querySelector<HTMLElement>("#iq-success")!;

  function setError(field: string, message: string): void {
    const errorEl = form.querySelector<HTMLElement>(`[data-error-for="${field}"]`);
    if (errorEl) errorEl.textContent = message;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();

    let valid = true;
    if (!name) {
      setError("name", t("contact.errors.nameRequired"));
      valid = false;
    } else setError("name", "");

    if (!email) {
      setError("email", t("contact.errors.emailRequired"));
      valid = false;
    } else if (!EMAIL_RE.test(email)) {
      setError("email", t("contact.errors.emailInvalid"));
      valid = false;
    } else setError("email", "");

    if (!phone) {
      setError("phone", t("contact.errors.phoneRequired"));
      valid = false;
    } else if (!PHONE_RE.test(phone)) {
      setError("phone", t("contact.errors.phoneInvalid"));
      valid = false;
    } else setError("phone", "");

    if (!valid) return;

    submitBtn.disabled = true;
    submitBtn.textContent = t("resale.inquirySubmitting");

    submitInquiry(listing.id, { name, email, phone, message })
      .then(() => {
        form.hidden = true;
        successBox.hidden = false;
      })
      .catch((err) => {
        console.error(err);
        submitBtn.disabled = false;
        submitBtn.textContent = t("resale.inquirySubmitButton");
      });
  });
}
