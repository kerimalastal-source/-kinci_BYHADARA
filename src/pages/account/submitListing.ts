import { t, link } from "../../i18n";
import { requireAuth, getCurrentUserId } from "../../auth/session";
import { renderNotFound } from "../notFound";
import { turkeyProvinces, type District } from "../../data/turkeyLocations";
import { escapeHtml } from "../../utils/html";
import { toWesternDigits } from "../../utils/numbers";
import {
  fetchListingById,
  createDraftListing,
  updateListing,
  submitForReview,
  fetchListingPhotos,
  uploadListingPhoto,
  deleteListingPhoto,
  fetchListingDocuments,
  uploadListingDocument,
  deleteListingDocument,
  listingPhotoUrl,
  type Listing,
  type ListingPhoto,
  type ListingDocument,
  type NewListingInput,
  type PropertyType
} from "../../data/listings";

const STEPS = ["details", "photos", "documents", "review"] as const;

const PROPERTY_TYPES: PropertyType[] = ["apartment", "villa", "land", "commercial", "other"];
const CURRENCIES = ["USD", "EUR", "GBP", "TRY"];

const EMPTY_INPUT: NewListingInput = {
  title: "",
  description: "",
  city: "",
  district: "",
  address_line: "",
  property_type: "apartment",
  size_m2: 0,
  bedrooms: 0,
  bathrooms: 0,
  asking_price: 0,
  currency: "USD",
  original_purchase_year: new Date().getFullYear()
};

export function renderSubmitListing(main: HTMLElement, listingId?: string): void {
  if (!requireAuth(main)) return;

  main.innerHTML = `<section class="section"><div class="container"><p>${t("common.loading")}</p></div></section>`;

  const requestId = crypto.randomUUID();
  main.dataset.requestId = requestId;

  const load = listingId
    ? Promise.all([fetchListingById(listingId), fetchListingPhotos(listingId), fetchListingDocuments(listingId)])
    : Promise.resolve<[Listing | null, ListingPhoto[], ListingDocument[]]>([null, [], []]);

  load
    .then(([listing, photos, documents]) => {
      if (main.dataset.requestId !== requestId) return;
      if (listingId && (!listing || listing.owner_id !== getCurrentUserId())) {
        renderNotFound(main);
        return;
      }
      mountWizard(main, listing, photos, documents);
    })
    .catch((err) => {
      console.error(err);
      if (main.dataset.requestId !== requestId) return;
      main.innerHTML = `<section class="section"><div class="container"><p class="form-field__error">${t("account.errors.saveFailed")}</p></div></section>`;
    });
}

function mountWizard(main: HTMLElement, initialListing: Listing | null, initialPhotos: ListingPhoto[], initialDocuments: ListingDocument[]): void {
  let listingId = initialListing?.id ?? null;
  let stepIndex = 0;
  let values: NewListingInput = initialListing
    ? {
        title: initialListing.title,
        description: initialListing.description ?? "",
        city: initialListing.city ?? "",
        district: initialListing.district ?? "",
        address_line: initialListing.address_line ?? "",
        property_type: (initialListing.property_type as PropertyType) ?? "apartment",
        size_m2: initialListing.size_m2 ?? 0,
        bedrooms: initialListing.bedrooms ?? 0,
        bathrooms: initialListing.bathrooms ?? 0,
        asking_price: initialListing.asking_price ?? 0,
        currency: initialListing.currency ?? "USD",
        original_purchase_year: initialListing.original_purchase_year ?? new Date().getFullYear()
      }
    : { ...EMPTY_INPUT };
  let photos = initialPhotos;
  let documents = initialDocuments;

  function paint(): void {
    main.innerHTML = `
      <section class="page-hero">
        <div class="container">
          <p class="eyebrow eyebrow--on-dark">${t("account.heroEyebrow")}</p>
          <h1>${t("account.submitListingTitle")}</h1>
          <p class="page-hero__subtitle">${t("account.submitListingSubtitle")}</p>
        </div>
      </section>
      <section class="section">
        <div class="container">
          <ul class="stepper">
            ${STEPS.map(
              (s, i) => `<li class="stepper__step${i === stepIndex ? " is-active" : ""}${i < stepIndex ? " is-done" : ""}">${i + 1}. ${t(`account.step${s.charAt(0).toUpperCase()}${s.slice(1)}`)}</li>`
            ).join("")}
          </ul>
          <div id="wizard-body"></div>
        </div>
      </section>
    `;
    const body = main.querySelector<HTMLElement>("#wizard-body")!;
    const step = STEPS[stepIndex];
    if (step === "details") paintDetails(body);
    else if (step === "photos") paintPhotos(body);
    else if (step === "documents") paintDocuments(body);
    else paintReview(body);
  }

  function fieldError(form: HTMLElement, field: string, message: string): void {
    const el = form.querySelector<HTMLElement>(`[data-error-for="${field}"]`);
    if (el) el.textContent = message;
  }

  function placeOptionsHtml(items: District[], placeholder: string, selectedLabel: string): string {
    return `
      <option value="" disabled${selectedLabel ? "" : " selected"}>${placeholder}</option>
      ${items.map((i) => `<option value="${i.value}"${i.label === selectedLabel ? " selected" : ""}>${i.label}</option>`).join("")}
    `;
  }

  function paintDetails(body: HTMLElement): void {
    body.innerHTML = `
      <form class="wizard-step" id="details-form" novalidate>
        <p class="form-field__error" data-error-for="general"></p>

        <div class="form-field">
          <label for="wf-title">${t("account.titleLabel")}</label>
          <input type="text" id="wf-title" name="title" placeholder="${t("account.titlePlaceholder")}" value="${escapeHtml(values.title)}" />
          <p class="form-field__error" data-error-for="title"></p>
        </div>

        <div class="form-field">
          <label for="wf-description">${t("account.descriptionLabel")}</label>
          <textarea id="wf-description" name="description" rows="4" placeholder="${t("account.descriptionPlaceholder")}">${escapeHtml(values.description)}</textarea>
          <p class="form-field__error" data-error-for="description"></p>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="wf-city">${t("account.cityLabel")}</label>
            <select id="wf-city" name="city">
              ${placeOptionsHtml(turkeyProvinces, t("account.cityPlaceholder"), values.city)}
            </select>
            <p class="form-field__error" data-error-for="city"></p>
          </div>
          <div class="form-field">
            <label for="wf-district">${t("account.districtLabel")}</label>
            <select id="wf-district" name="district"${values.city ? "" : " disabled"}>
              ${
                values.city
                  ? placeOptionsHtml(
                      turkeyProvinces.find((p) => p.label === values.city)?.districts ?? [],
                      t("account.districtSelectPlaceholder"),
                      values.district
                    )
                  : `<option value="" disabled selected>${t("account.districtPlaceholder")}</option>`
              }
            </select>
            <p class="form-field__error" data-error-for="district"></p>
          </div>
        </div>

        <div class="form-field">
          <label for="wf-address">${t("account.addressLabel")}</label>
          <input type="text" id="wf-address" name="address_line" placeholder="${t("account.addressPlaceholder")}" value="${escapeHtml(values.address_line)}" />
          <p class="form-field__error" data-error-for="address_line"></p>
          <p class="wizard-step__hint">${t("account.addressHint")}</p>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="wf-type">${t("account.propertyTypeLabel")}</label>
            <select id="wf-type" name="property_type">
              ${PROPERTY_TYPES.map((pt) => `<option value="${pt}"${values.property_type === pt ? " selected" : ""}>${t(`account.propertyTypes.${pt}`)}</option>`).join("")}
            </select>
          </div>
          <div class="form-field">
            <label for="wf-size">${t("account.sizeLabel")}</label>
            <input dir="ltr" type="text" inputmode="numeric" id="wf-size" name="size_m2" value="${values.size_m2 || ""}" />
            <p class="form-field__error" data-error-for="size_m2"></p>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="wf-bedrooms">${t("account.bedroomsLabel")}</label>
            <input dir="ltr" type="text" inputmode="numeric" id="wf-bedrooms" name="bedrooms" value="${values.bedrooms || ""}" />
          </div>
          <div class="form-field">
            <label for="wf-bathrooms">${t("account.bathroomsLabel")}</label>
            <input dir="ltr" type="text" inputmode="numeric" id="wf-bathrooms" name="bathrooms" value="${values.bathrooms || ""}" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="wf-price">${t("account.priceLabel")}</label>
            <input dir="ltr" type="text" inputmode="numeric" id="wf-price" name="asking_price" value="${values.asking_price || ""}" />
            <p class="form-field__error" data-error-for="asking_price"></p>
          </div>
          <div class="form-field">
            <label for="wf-currency">${t("account.currencyLabel")}</label>
            <select id="wf-currency" name="currency">
              ${CURRENCIES.map((c) => `<option value="${c}"${values.currency === c ? " selected" : ""}>${c}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="form-field">
          <label for="wf-year">${t("account.purchaseYearLabel")}</label>
          <input dir="ltr" type="text" inputmode="numeric" id="wf-year" name="original_purchase_year" value="${values.original_purchase_year || ""}" />
        </div>

        <div class="wizard-nav">
          <span></span>
          <button type="submit" class="btn btn--primary" id="wf-next">${t("account.nextButton")}</button>
        </div>
      </form>
    `;

    const form = body.querySelector<HTMLFormElement>("#details-form")!;
    const nextBtn = body.querySelector<HTMLButtonElement>("#wf-next")!;
    const citySelect = body.querySelector<HTMLSelectElement>("#wf-city")!;
    const districtSelect = body.querySelector<HTMLSelectElement>("#wf-district")!;

    citySelect.addEventListener("change", () => {
      const province = turkeyProvinces.find((p) => p.value === citySelect.value);
      fieldError(form, "district", "");
      if (!province) {
        districtSelect.innerHTML = `<option value="" disabled selected>${t("account.districtPlaceholder")}</option>`;
        districtSelect.disabled = true;
        return;
      }
      districtSelect.disabled = false;
      districtSelect.innerHTML = placeOptionsHtml(province.districts, t("account.districtSelectPlaceholder"), "");
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const next: NewListingInput = {
        title: String(data.get("title") ?? "").trim(),
        description: String(data.get("description") ?? "").trim(),
        city: citySelect.value ? (citySelect.selectedOptions[0]?.textContent ?? "") : "",
        district: districtSelect.value ? (districtSelect.selectedOptions[0]?.textContent ?? "") : "",
        address_line: String(data.get("address_line") ?? "").trim(),
        property_type: String(data.get("property_type") ?? "apartment") as PropertyType,
        size_m2: Number(toWesternDigits(String(data.get("size_m2") ?? ""))) || 0,
        bedrooms: Number(toWesternDigits(String(data.get("bedrooms") ?? ""))) || 0,
        bathrooms: Number(toWesternDigits(String(data.get("bathrooms") ?? ""))) || 0,
        asking_price: Number(toWesternDigits(String(data.get("asking_price") ?? ""))) || 0,
        currency: String(data.get("currency") ?? "USD"),
        original_purchase_year: Number(toWesternDigits(String(data.get("original_purchase_year") ?? ""))) || 0
      };

      let valid = true;
      const requiredChecks: [keyof NewListingInput, string][] = [
        ["title", "titleRequired"],
        ["description", "descriptionRequired"],
        ["city", "cityRequired"],
        ["district", "districtRequired"],
        ["address_line", "addressRequired"]
      ];
      for (const [field, errKey] of requiredChecks) {
        if (!String(next[field]).trim()) {
          fieldError(form, field, t(`account.errors.${errKey}`));
          valid = false;
        } else {
          fieldError(form, field, "");
        }
      }
      if (!next.size_m2) {
        fieldError(form, "size_m2", t("account.errors.sizeRequired"));
        valid = false;
      } else {
        fieldError(form, "size_m2", "");
      }
      if (!next.asking_price) {
        fieldError(form, "asking_price", t("account.errors.priceRequired"));
        valid = false;
      } else {
        fieldError(form, "asking_price", "");
      }
      if (!valid) return;

      fieldError(form, "general", "");
      values = next;
      nextBtn.disabled = true;

      const save = listingId ? updateListing(listingId, values).then(() => listingId!) : createDraftListing(values).then((l) => l.id);

      save
        .then((id) => {
          listingId = id;
          if (initialListing === null && window.location.pathname !== link(`/account/listings/${id}/edit`)) {
            history.replaceState(null, "", link(`/account/listings/${id}/edit`));
          }
          stepIndex = 1;
          paint();
        })
        .catch((err) => {
          console.error(err);
          fieldError(form, "general", err?.message ? `${t("account.errors.saveFailed")} (${err.message})` : t("account.errors.saveFailed"));
          nextBtn.disabled = false;
        });
    });
  }

  function paintPhotos(body: HTMLElement): void {
    body.innerHTML = `
      <div class="wizard-step">
        <h2>${t("account.photosStepTitle")}</h2>
        <p class="wizard-step__hint">${t("account.photosStepHint")}</p>
        <input type="file" id="photo-input" accept="image/*" multiple hidden />
        <button type="button" class="btn btn--outline" id="photo-choose">${t("account.uploadPhotosButton")}</button>
        <p class="form-field__error" data-error-for="photos"></p>
        <div class="upload-grid" id="photo-grid">
          ${photos
            .map(
              (p, i) => `
            <div class="upload-grid__item" data-id="${p.id}">
              <img src="${listingPhotoUrl(p.storage_path)}" alt="" />
              ${i === 0 ? `<span>${t("account.photosStepTitle")}</span>` : ""}
              <button type="button" class="upload-grid__remove" data-remove-photo="${p.id}">&times;</button>
            </div>`
            )
            .join("")}
        </div>
        <div class="wizard-nav">
          <button type="button" class="btn btn--outline" id="wf-back">${t("account.backButton")}</button>
          <button type="button" class="btn btn--primary" id="wf-next">${t("account.nextButton")}</button>
        </div>
      </div>
    `;

    const grid = body.querySelector<HTMLElement>("#photo-grid")!;
    const input = body.querySelector<HTMLInputElement>("#photo-input")!;

    body.querySelector<HTMLButtonElement>("#photo-choose")!.addEventListener("click", () => input.click());

    input.addEventListener("change", () => {
      const files = Array.from(input.files ?? []);
      input.value = "";
      let sortOrder = photos.length;
      fieldError(body, "photos", "");
      Promise.all(files.map((file) => uploadListingPhoto(listingId!, file, sortOrder++)))
        .then((uploaded) => {
          photos = [...photos, ...uploaded];
          paintPhotos(body);
        })
        .catch((err) => {
          console.error(err);
          fieldError(body, "photos", t("account.errors.saveFailed"));
        });
    });

    grid.querySelectorAll<HTMLButtonElement>("[data-remove-photo]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const photo = photos.find((p) => p.id === btn.dataset.removePhoto);
        if (!photo) return;
        deleteListingPhoto(photo).then(() => {
          photos = photos.filter((p) => p.id !== photo.id);
          paintPhotos(body);
        });
      });
    });

    body.querySelector<HTMLButtonElement>("#wf-back")!.addEventListener("click", () => {
      stepIndex = 0;
      paint();
    });

    body.querySelector<HTMLButtonElement>("#wf-next")!.addEventListener("click", () => {
      if (photos.length === 0) {
        fieldError(body, "photos", t("account.errors.minOnePhoto"));
        return;
      }
      stepIndex = 2;
      paint();
    });
  }

  function paintDocuments(body: HTMLElement): void {
    const docLabel = (docType: ListingDocument["doc_type"]) =>
      docType === "title_deed" ? t("account.uploadTitleDeedButton") : docType === "id_document" ? t("account.uploadIdButton") : docType;

    body.innerHTML = `
      <div class="wizard-step">
        <h2>${t("account.documentsStepTitle")}</h2>
        <p class="wizard-step__hint">${t("account.documentsStepHint")}</p>

        <input type="file" id="doc-input-deed" accept="image/*,.pdf" hidden />
        <input type="file" id="doc-input-id" accept="image/*,.pdf" hidden />
        <div class="form-row">
          <button type="button" class="btn btn--outline" id="doc-choose-deed">${t("account.uploadTitleDeedButton")}</button>
          <button type="button" class="btn btn--outline" id="doc-choose-id">${t("account.uploadIdButton")}</button>
        </div>
        <p class="form-field__error" data-error-for="documents"></p>

        <div class="doc-list" id="doc-list">
          ${documents
            .map(
              (d) => `
            <div class="doc-row" data-id="${d.id}">
              <div>
                <p class="doc-row__name">${docLabel(d.doc_type)}</p>
                <p class="doc-row__type">${d.storage_path.split("/").pop()}</p>
              </div>
              <button type="button" class="btn btn--outline btn--small" data-remove-doc="${d.id}">${t("account.removeDocumentButton")}</button>
            </div>`
            )
            .join("")}
        </div>

        <div class="wizard-nav">
          <button type="button" class="btn btn--outline" id="wf-back">${t("account.backButton")}</button>
          <button type="button" class="btn btn--primary" id="wf-next">${t("account.nextButton")}</button>
        </div>
      </div>
    `;

    function wireUpload(buttonId: string, inputId: string, docType: ListingDocument["doc_type"]): void {
      const btn = body.querySelector<HTMLButtonElement>(buttonId)!;
      const input = body.querySelector<HTMLInputElement>(inputId)!;
      btn.addEventListener("click", () => input.click());
      input.addEventListener("change", () => {
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;
        fieldError(body, "documents", "");
        uploadListingDocument(listingId!, file, docType)
          .then((doc) => {
            documents = [...documents, doc];
            paintDocuments(body);
          })
          .catch((err) => {
            console.error(err);
            fieldError(body, "documents", t("account.errors.saveFailed"));
          });
      });
    }

    wireUpload("#doc-choose-deed", "#doc-input-deed", "title_deed");
    wireUpload("#doc-choose-id", "#doc-input-id", "id_document");

    body.querySelectorAll<HTMLButtonElement>("[data-remove-doc]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const doc = documents.find((d) => d.id === btn.dataset.removeDoc);
        if (!doc) return;
        deleteListingDocument(doc).then(() => {
          documents = documents.filter((d) => d.id !== doc.id);
          paintDocuments(body);
        });
      });
    });

    body.querySelector<HTMLButtonElement>("#wf-back")!.addEventListener("click", () => {
      stepIndex = 1;
      paint();
    });

    body.querySelector<HTMLButtonElement>("#wf-next")!.addEventListener("click", () => {
      if (!documents.some((d) => d.doc_type === "title_deed")) {
        fieldError(body, "documents", t("account.errors.titleDeedDocRequired"));
        return;
      }
      stepIndex = 3;
      paint();
    });
  }

  function paintReview(body: HTMLElement): void {
    body.innerHTML = `
      <div class="wizard-step">
        <h2>${t("account.reviewStepTitle")}</h2>
        <p class="wizard-step__hint">${t("account.reviewStepHint")}</p>
        <p class="form-field__error" data-error-for="submit"></p>

        <div class="review-summary">
          <dl>
            <div><dt>${t("account.titleLabel")}</dt><dd>${escapeHtml(values.title)}</dd></div>
            <div><dt>${t("account.cityLabel")}</dt><dd>${values.district}, ${values.city}</dd></div>
            <div><dt>${t("account.propertyTypeLabel")}</dt><dd>${t(`account.propertyTypes.${values.property_type}`)}</dd></div>
            <div><dt>${t("account.sizeLabel")}</dt><dd dir="ltr">${values.size_m2} m²</dd></div>
            <div><dt>${t("account.priceLabel")}</dt><dd dir="ltr">${values.asking_price.toLocaleString()} ${values.currency}</dd></div>
            <div><dt>${t("account.stepPhotos")}</dt><dd dir="ltr">${photos.length}</dd></div>
            <div><dt>${t("account.stepDocuments")}</dt><dd dir="ltr">${documents.length}</dd></div>
          </dl>
        </div>

        <div class="wizard-nav">
          <button type="button" class="btn btn--outline" id="wf-back">${t("account.backButton")}</button>
          <button type="button" class="btn btn--primary" id="wf-submit">${t("account.submitForReviewButton")}</button>
        </div>
      </div>
    `;

    body.querySelector<HTMLButtonElement>("#wf-back")!.addEventListener("click", () => {
      stepIndex = 2;
      paint();
    });

    body.querySelector<HTMLButtonElement>("#wf-submit")!.addEventListener("click", () => {
      const btn = body.querySelector<HTMLButtonElement>("#wf-submit")!;
      fieldError(body, "submit", "");
      btn.disabled = true;
      btn.textContent = t("account.submitting");
      submitForReview(listingId!)
        .then(() => {
          body.innerHTML = `
            <div class="contact-form__success">
              <strong>${t("account.submitSuccessTitle")}</strong>
              <p>${t("account.submitSuccessText")}</p>
              <a class="btn btn--primary" href="${link("/account")}" style="margin-top: 1rem;">${t("account.myListingsTitle")}</a>
            </div>
          `;
        })
        .catch((err) => {
          console.error(err);
          fieldError(body, "submit", err?.message ? `${t("account.errors.saveFailed")} (${err.message})` : t("account.errors.saveFailed"));
          btn.disabled = false;
          btn.textContent = t("account.submitForReviewButton");
        });
    });
  }

  paint();
}
