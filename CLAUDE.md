# CLAUDE.md — سياق مشروع HADARA Real Estate

هذا الملف مرجع كامل للمشروع، مخصص لأي محادثة جديدة مع Claude Code تشتغل على هذا الريبو. اقرأه أولاً قبل أي تعديل.

> **ملاحظة ثابتة من المستخدم**: هذا الريبو هو **المرجع الرسمي المعتمد** لـ "موقع حضارة الجديد". أي طلب تعديل مستقبلي على الموقع الجديد (نصوص، تصميم، مشاريع، صفحات...) يُنفَّذ هنا مباشرة.
> - **workflow التعديل**: اعمل تعديلاتك، commit + push. بما إن مشروع Vercel (`kinci-byhadara`) مربوط بفرع `main` عبر `gitSource`، أي push على `main` (أو أي PR يندمج فيه) بيعمل إعادة نشر تلقائي — **بدون رفع ملفات يدوي إطلاقاً**.
> - إذا كان التعديل بسيط ومباشر، ممكن تشتغل مباشرة على `main` (بعد `git pull` للتأكد إنك على آخر نسخة) وتـ push، أو تفتح فرع جديد وPR إذا كان تعديل أكبر — استخدم تقديرك حسب حجم التعديل.
> - **لا تلمس أبداً** مشاريع `hadararealestate` أو `byhadara` الأصلية على Vercel، ولا تربط أي دومين بـ `hadararealestate.com` من دون طلب صريح — المستخدم هو من سيقوم بربط الدومين الرسمي بنفسه.
> - **قاعدة ثابتة عن المحاذاة (alignment)**: أي تعديل أو إضافة (عنصر جديد بالهيدر، زر، قائمة، أي شي) **يجب** أن يُختبر بصرياً بعد التنفيذ (screenshot بالعربي والإنجليزي، وبعرض شاشة واسع وضيق) للتأكد إنه المحاذاة والمسافات لائقة ومتناسقة مع باقي الموقع — **قبل** اعتباره منتهي. لا تفترض إنه الكود سليم لأنه بنى بدون أخطاء؛ التنسيق البصري (centering، spacing، عدم التصاق العناصر بحافة) مسؤولية أساسية بكل تعديل، مش خطوة اختيارية.
> - **ملاحظة عن الجلسات المتوازية**: أكثر من محادثة Claude Code ممكن تشتغل على هذا الريبو بالتوازي (فروع مختلفة تندمج بـ `main`). لو رجعت من فترة غياب أو انفتح merge conflict، **افحص `git log`/الملفات الفعلية قبل ما تفترض إنه بس نسختك هي الصحيحة** — وحدة أي conflict بدمج المحتوى الحقيقي من الطرفين (متل ما صار بهذا الملف نفسه)، ما تحسم لصالح نسخة وحدة فقط.

## 1. نظرة عامة

موقع ويب حديث ومحترف لشركة **حضارة للتطوير العقاري (HADARA Real Estate)** — شركة تطوير عقاري في إسطنبول. المشروع بديل عصري لموقع Wix القديم (byhadara.com)، مبني من الصفر بـ **TypeScript + CSS خام** (بدون أي framework مثل React/Vue).

- **الريبو**: `kerimalastal-source/-kinci_BYHADARA`
- **فرع الإنتاج**: `main` (مربوط بـ Vercel، أي push عليه = نشر تلقائي)
- **الحالة**: الكود مكتمل ومنشور فعلياً على Vercel (`kinci-byhadara`, `readyState: READY`)، مبني بنجاح (`npm run build` بدون أخطاء)، تم اختباره بـ Playwright بالعربي والإنجليزي.

## 2. المكدس التقني

- **Vite** (bundler) + **TypeScript** (بدون framework — DOM manipulation مباشر)
- **CSS خام** مقسّم لملفات منطقية (variables/base/layout/components/rtl)
- **Path-based routing (History API)** — روابط حقيقية مثل `/projects/lotus-koru-2`، واللغات غير الإنجليزية لها بادئة: `/ar/...`, `/fr/...`, `/ru/...`. التحويل بين الرابط والصفحة في `src/seo/routes.ts` (`parseRoute`/`routePath`/`localizePath`)، والتنقل في `src/router.ts` (اعتراض النقر على الروابط الداخلية `interceptLinks` + `popstate`). الروابط القديمة `#/...` تُحوَّل تلقائياً للمسار الجديد (`normalizeInitialUrl`).
- **أي رابط داخلي جديد** يُكتب بـ `href="${link("/path")}"` (من `src/i18n`) حتى يأخذ بادئة اللغة الحالية، والتنقل البرمجي بـ `navigate("/path")` — **لا تستخدم `#/` أبداً**.
- `vercel.json`: `rewrites` كل المسارات إلى `index.html` (الملفات الموجودة فعلياً تُخدَم أولاً).
- **Supabase** (`@supabase/supabase-js`) — قاعدة بيانات + auth حقيقيين لبوابة إعادة البيع/الوسطاء (راجع قسم 4.6). العميل في `src/lib/supabase.ts`، يعتمد على متغيرات بيئة `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (لازم تكونوا مضبوطين بـ Vercel project settings، راجع `.env.example`).
- `package.json` build script: `"build": "tsc && vite build"`

## 3. اللغات (i18n) — 4 لغات كاملة

- **الإنجليزية (en)** — اللغة الافتراضية
- **العربية (ar)** — بلغة عربية فصحى رسمية (MSA)، مع دعم RTL كامل
- **الفرنسية (fr)**
- **الروسية (ru)**

النظام في `src/i18n/`:
- `dictionaries.ts`: القواميس ودالة `lookup()` بدون أي اعتماد على DOM (تُستخدم أيضاً وقت البناء لتوليد صفحات SEO الثابتة).
- `index.ts`: منطق الترجمة — `t(key)` (نص)، `tRaw<T>(key)` (بيانات خام كـ arrays/objects)، `link(path)` (يبني الرابط ببادئة اللغة الحالية)، `getLocale()`/`setLocale()`/`onLocaleChange()`. **اللغة تُؤخذ من الرابط** (بادئة `/ar` إلخ)؛ `setLocale()` ينقل لنفس الصفحة باللغة الجديدة ويحفظ الاختيار بـ `localStorage` (`hadara-locale`) لتوجيه الزائر العائد، ويضبط `lang`/`dir` تلقائياً.
- `en.json` / `ar.json` / `fr.json` / `ru.json`: قواميس ترجمة متطابقة البنية بالكامل — نفس الـ keys بكل اللغات، بما فيها `projectsData`، `blogData.<slug>`، `faq.categories`، `propertyRequest.*`، `seo.<page>`.
- زر تبديل اللغة بالـ header (`src/components/header.ts`).

### دعم RTL

- أغلب الـ layout يعتمد على **CSS logical properties** (`inset-inline-*`, `padding-inline-*`, `margin-inline-*`, `text-align: start/end`) فبينقلب أوتوماتيكياً مع `[dir="rtl"]`.
- `src/styles/rtl.css`: استثناءات فقط للعناصر الحساسة للاتجاه (أيقونات السهم بالـ back-link، أسهم الـ lightbox) عبر `transform: scaleX(-1)`.
- **مشكلة Bidi معروفة وتم حلها**: أي نص فيه أرقام إنجليزية (أرقام هاتف، مدى سنوات مثل "2022 – 2024"، قيم إحصائيات) يظهر معكوس بصرياً داخل سياق RTL. **الحل المطبّق**: إضافة `dir="ltr"` على كل عنصر يعرض رقم هاتف/إيميل/`project.timeline`/`stat.value`/سعر. لو أضفت رقم أو مدى تاريخ جديد بمكان جديد، **لازم** تعمل نفس الشي.
- **درس مستفاد**: أي خاصية CSS فيزيائية (`left`/`right` بدل `inset-inline-start/end`) على عنصر ظاهر بكل الصفحات (متل `.skip-link`) ممكن تسبب horizontal overflow بالعربي RTL من دون ما تنلاحظ بصرياً بسهولة — تأكد دايماً إنه `document.documentElement.scrollWidth` ما يتجاوز عرض الشاشة بعد أي تعديل.

## 4. البيانات الحقيقية (من Wix)

تم استخراج كل المحتوى والصور من موقع Wix الأصلي "حضارة العقاري" عبر Wix Data API فعلياً — **ليست بيانات وهمية**.

- `src/data/projects.ts`: 5 مشاريع حقيقية بكل تفاصيلها (slug, district, city, status, timeline, stats, gallery images):
  1. `beylikduzu-living` (new-launch، تسليم 2028)
  2. `lotus-koru-2` (ongoing)
  3. `lotus-istanbul` (ongoing، مبنى متعدد الاستخدامات)
  4. `lotus-koru-1` (delivered)
  5. `marmara-haven-villa` (ongoing، فيلا خاصة)
- **الصور**: مستضافة على Wix مباشرة (`https://static.wixstatic.com/media/<mediaId>`)، مبنية عبر `wixImg()` في `src/utils/image.ts`. **هذه نقطة اعتماد على Wix خارجي** — لو حذفت الشركة الصور من حساب Wix الأصلي، الصور بتنكسر بالموقع الجديد. للـ production الحقيقي، الأفضل نزّل الصور ورفعها لـ CDN/استضافة خاصة بالموقع الجديد.
- بيانات التواصل الحقيقية: الإيميل `info@byhadara.com`، الهاتف `+90 531 930 92 14` (`00905319309214` بأزرار WhatsApp/اتصال العائمة)، العنوان "Adnan Kahveci Mah., Beylikdüzü, Istanbul 34000, Türkiye".
- `src/data/blog.ts`: 10 مقالات مدونة عقارية حقيقية المحتوى (استثمار عقاري بتركيا، الجنسية عبر الاستثمار، الحياة بتركيا، إجراءات الطابو، الضرائب والرسوم، التثمين العقاري...) بكل اللغات الأربعة، بصور توضيحية مولّدة بالذكاء الاصطناعي (Canva) ومستضافة على Wix (`mcp__Wix__UploadImageToWixSite`) للحصول على رابط دائم.
- `src/data/turkeyLocations.ts`: **كل الـ 81 محافظة التركية بمناطقها الكاملة (province → district)** — مصدر موحّد لأي قائمة منسدلة مدينة/منطقة بالموقع (فورم طلب عقار مخصص، فورم رفع عقار لإعادة البيع...). لا تنشئ قائمة مدن/مناطق منفصلة بمكان جديد — استورد من هنا.
- `src/data/countries.ts`: قائمة دول لحقل الجنسية/الهاتف الدولي.
- `src/data/partners.ts` + `public/partners/*.png`: شعارات 6 شركاء نجاح (DTC, Faisal Holding, DAG Holding, WUJHA Development, Lotus, Studio Vertebra) — معالَجة بخلفية شفافة، مقصوصة لنفس النسبة.

## 4.5 SEO

- `src/seo/meta.ts` (بدون DOM): `buildMeta(route, locale)` يبني لكل صفحة: title، description، canonical، hreflang (4 لغات + x-default)، Open Graph/Twitter، وJSON-LD (`RealEstateAgent` بكل الصفحات، `WebSite` للرئيسية، `ApartmentComplex`/`SingleFamilyResidence` للمشاريع، `BlogPosting` للمقالات، `FAQPage`، `ItemList`، `BreadcrumbList`). صفحات الدخول/الحساب/الإدارة/404 عليها `noindex`.
- نصوص العناوين والأوصاف في قسم `seo` بالقواميس الأربعة — **أي صفحة جديدة تحتاج مفتاح `seo.<page>`** بالأربع لغات + إضافتها في `PAGE_KEYS` و`indexableRoutes()` إذا كانت قابلة للفهرسة.
- المتصفح: `src/seo/head.ts` يستبدل الوسوم (`[data-seo]`) بكل تنقل.
- وقت البناء: plugin بـ `vite.config.ts` يولّد ملف HTML مستقل لكل صفحة × لغة (`dist/ar/projects/index.html`...) فيه الوسوم جاهزة بالـ `<head>`، ويولّد `sitemap.xml` و`robots.txt`.
- الدومين المعتمد للروابط الـ canonical والـ sitemap: `https://hadararealestate.com` (قابل للتغيير عبر متغير البيئة `VITE_SITE_URL`).

## 4.6 بوابة إعادة البيع / الوسطاء (Resale & Broker Portal)

نظام كامل يسمح لأصحاب العقارات (بائعين/وسطاء) بتسجيل حساب ورفع عقارات لإعادة البيع، ومراجعة إدارية قبل النشر العام:

- **Auth**: `src/auth/session.ts` — يستخدم Supabase Auth، حالة عامة (`userId`/`email`/`profile`/`loading`) مع `onAuthChange()` (pub/sub، الهيدر والراوتر يشتركوا فيها). `Profile.role` إما `"seller"` أو `"admin"`. `requireAuth()`/`requireAdmin()` guards تُستخدم بصفحات الحساب/الإدارة (تحويل لصفحة `/login` تلقائياً لو مش مسجل دخول).
- **صفحات المستخدم**: `/login`، `/register` (`pages/login.ts`, `pages/register.ts`)، `/account` (لوحة تحكم البائع، `pages/account/dashboard.ts`)، `/account/listings/new` و`/account/listings/:id/edit` (فورم رفع/تعديل عقار، `pages/account/submitListing.ts` — أكبر فورم بالموقع، فيه صور متعددة، مدينة/منطقة من `turkeyLocations.ts`، هاتف دولي من `phoneInput.ts`).
- **السوق العام**: `/resale` (قائمة عقارات معتمدة، `pages/resale/list.ts`) و`/resale/:id` (تفاصيل، `pages/resale/detail.ts`) — يظهر فيها فقط العقارات بحالة `approved`.
- **لوحة الإدارة**: `/admin` (طابور المراجعة، `pages/admin/dashboard.ts`) و`/admin/listings/:id` (موافقة/رفض عقار، `pages/admin/reviewListing.ts`) — محمية بـ `requireAdmin()`.
- **البيانات**: `src/data/listings.ts` (CRUD مع Supabase: `fetchPendingListings`, `fetchCoverPhotos`, `listingPhotoUrl`...)، `src/data/profiles.ts`.
- **الهيدر**: `account-switch` بالهيدر يعرض دخول/تسجيل لو زائر، أو اسم المستخدم + قائمة (حسابي، لوحة الإدارة لو admin، تسجيل خروج) لو مسجل دخول.
- **متطلب بيئة**: لازم `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` مضبوطين بـ Vercel (Project Settings → Environment Variables) وإلا الموقع بيطبع خطأ بالـ console وميزات الحساب ما بتشتغل (باقي الموقع يشتغل عادي لأنه مستقل).

## 5. نظام التصميم (Design System)

`src/styles/variables.css`:
- الألوان: أخضر غامق `--color-primary: #0f2b21` + ذهبي `--color-accent: #c9a24b` (هوية بصرية عقارية فاخرة)
- الخطوط: **Playfair Display** (عناوين، لاتيني) + **Noto Naskh Arabic** (عناوين عربي) + **Inter** (نص، لاتيني) + **Noto Kufi Arabic** (نص عربي) — كل الخطوط من Google Fonts
- الملفات: `variables.css` (متغيرات) → `base.css` (reset/typography) → `layout.css` (header/footer/hero) → `components.css` (كل الأجزاء: buttons, cards, forms, stats, gallery, lightbox, search, partners, floating actions...) → `rtl.css` (استثناءات RTL) — كلها مجمّعة بـ `main.css` عبر `@import`.
- **اللوغو**: اللوغو الحقيقي لحضارة (`public/logo-dark.png`/`logo-light.png` + favicons) بالهيدر/الفوتر/تاب المتصفح، بحجم واضح وكبير (مثل مرجع hadarahospitality.com) مع "REAL ESTATE" كـ tagline بدل "HOSPITALITY".
- **الهيدر**: `.site-header__inner` هو **CSS grid بـ 3 أعمدة** (`auto 1fr auto`: brand / nav / actions) مع `.main-nav { display:flex; justify-content:center }` عشان المنيو تضل بمنتصف الهيدر تماماً بكل اللغات (LTR/RTL) — **هذا نمط إلزامي، لا ترجع لـ flex + margin-auto**. القوائم الفرعية غير الأساسية (الجنسية، طلب عقار مخصص، المدونة، الأسئلة الشائعة) مجمّعة بقائمة منسدلة "Resources" (`NAV_RESOURCES` بـ `header.ts`) لتفادي ازدحام الهيدر — أي صفحة جديدة غير أساسية تنضاف هون.
- **الأزرار العائمة**: WhatsApp + اتصال هاتفي، ثابتة فيزيائياً على يمين الشاشة بكل اللغات (`src/components/floatingButtons.ts`)، تستخدم الرقم `00905319309214`.
- **`scrollReveal.ts`**: أداة عامة قابلة لإعادة الاستخدام (`initScrollReveal(container)`, IntersectionObserver) لـ fade/slide-up متدرّج (`[data-reveal]`/`[data-reveal-index]`)، تحترم `prefers-reduced-motion` — تُستخدم بقسم شركاء النجاح وغيره.

## 6. الصفحات (`src/pages/`)

| صفحة | مسار | ملف | ملاحظات |
|---|---|---|---|
| الرئيسية | `/` | `home.ts` | hero، إحصائيات متحركة، شركاء النجاح، مشاريع مميزة، خدمات، لماذا حضارة، CTA للجنسية |
| المشاريع | `/projects` | `projects.ts` | فلترة حسب الحالة (all/new-launch/ongoing/delivered) + CTA "ما لقيت المشروع؟" لطلب عقار مخصص |
| تفاصيل مشروع | `/projects/:slug` | `projectDetail.ts` | وصف كامل، highlights، معرض صور بـ lightbox، مشاريع أخرى مقترحة |
| من نحن | `/about` | `about.ts` | قصة الشركة، رسالة/رؤية، قيم، timeline تاريخي، إحصائيات |
| الجنسية بالاستثمار | `/citizenship` | `citizenship.ts` | خطوات البرنامج، فوائد الجنسية التركية |
| اطلب عقارك المخصص | `/property-request` | `propertyRequest.ts` | فورم طلب عقار خارج مشاريعنا (نوع، مدينة/منطقة، جديد/مستعمل، ميزانية، طابق) — كل الحقول إلزامية |
| المدونة العقارية | `/blog` | `blog.ts` | 10 مقالات، صور توضيحية |
| تفاصيل مقال | `/blog/:slug` | `blogDetail.ts` | محتوى كامل + "مقالات أخرى تهمك" |
| الأسئلة الشائعة | `/faq` | `faq.ts` | 3 فئات (عن حضارة، الاستثمار العقاري بتركيا، الجنسية التركية) بشكل أكورديون |
| سوق إعادة البيع | `/resale` | `resale/list.ts` | عقارات معتمدة من مستخدمين آخرين |
| تفاصيل عقار (إعادة بيع) | `/resale/:id` | `resale/detail.ts` | |
| تسجيل دخول / حساب جديد | `/login`, `/register` | `login.ts`, `register.ts` | Supabase Auth |
| لوحة تحكم البائع | `/account` | `account/dashboard.ts` | عقاراتي |
| رفع/تعديل عقار | `/account/listings/new`, `/:id/edit` | `account/submitListing.ts` | |
| لوحة الإدارة | `/admin`, `/admin/listings/:id` | `admin/dashboard.ts`, `admin/reviewListing.ts` | مراجعة/موافقة العقارات (admin فقط) |
| تواصل معنا | `/contact` | `contact.ts` | فورم التواصل + معلومات التواصل + خريطة OpenStreetMap embed |
| 404 | — | `notFound.ts` | صفحة خطأ بسيطة |

## 7. المكونات (`src/components/`)

- **`header.ts`**: القائمة الرئيسية (Home/Projects/Resale/About) + قائمة "Resources" منسدلة + تبديل اللغة + أيقونة البحث + حساب المستخدم (دخول أو قائمة حساب/إدارة/خروج) + CTA "تواصل معنا" + قائمة موبايل قابلة للطي.
- **`footer.ts`**: روابط سريعة (بما فيها المدونة، الأسئلة الشائعة، طلب عقار مخصص)، معلومات تواصل، سوشيال ميديا.
- **`contactForm.ts`**: فورم تواصل احترافي — **الاسم والإيميل والهاتف حقول إلزامية**، فاليديشن بـ regex، الإرسال عبر `mailto:` (ملاحظة production: لا يرسل فعلياً من السيرفر؛ يحتاج backend/service مثل Formspree).
- **`propertyRequestForm.ts`**: فورم "اطلب عقارك المخصص" — كل الحقول إلزامية (نوع العقار، مدينة→منطقة من `turkeyLocations.ts`، جديد/لا فرق، ميزانية من `propertyRequestOptions.ts`، طابق مفضل)، هاتف دولي عبر `phoneInput.ts`، إرسال بـ `mailto:`.
- **`phoneInput.ts`**: حقل هاتف دولي مشترك (كود دولة + رقم) تستخدمه كل فورمات الموقع (تواصل، طلب عقار مخصص، تسجيل، رفع عقار).
- **`search.ts`**: بحث شامل (overlay) على المشاريع والصفحات، فلترة فورية.
- **`statCounter.ts`**: عداد أرقام متحرك (`IntersectionObserver`) — يحلل نص مثل `"12+"` أو `"60,000+ m²"` لـ prefix/number/suffix ويعمل count-up animation.
- **`projectCard.ts`**: بطاقة مشروع (صورة، حالة، موقع، إحصائية أساسية، زر "اكتشف المزيد").
- **`lightbox.ts`**: معرض صور بملء الشاشة مع تنقل بالكيبورد (أسهم، Escape).
- **`floatingButtons.ts`**: أزرار WhatsApp + اتصال عائمة، ثابتة على يمين الشاشة.
- **`scrollReveal.ts`**: أداة fade/slide-up متدرّج عند التمرير، عامة قابلة لإعادة الاستخدام.

## 8. حالة النشر (Deployment) — مهم جداً

- **الكود على GitHub**: مكتمل ومحفوظ 100% على فرع `main` (كل التعديلات — بما فيها من جلسات Claude Code متوازية — مدمجة هناك).
- **معاينة تجربة على Artifact (تعمل فعلياً)**: `https://claude.ai/artifact/XqiCPKwjHQXndH6pjbHde4` — كل الوظائف شغالة (اللغات، البحث، الفورم، الصفحات) **إلا** الصور الحقيقية من Wix (محجوبة بسياسة CSP الخاصة بـ Artifact sandbox).
- **✅ النشر الناجح على Vercel (الحالة الحالية)**: مشروع **`kinci-byhadara`** على Vercel — مربوط مباشرة بفرع `main` على GitHub (`gitSource`)، فيسحب الكود ويبنيه تلقائياً بدون أي رفع يدوي. **`readyState: READY`** — الموقع شغال فعلياً ومؤكد من المستخدم.
  - الروابط: `kinci-byhadara.vercel.app`, `kinci-byhadara-hadara1.vercel.app`, `kinci-byhadara-git-main-hadara1.vercel.app`
  - لسا مفعّل عليه `ssoProtection` (حماية تسجيل دخول فيرسل) — يفتح فقط لصاحب الحساب المسجل دخول. **بقرار من المستخدم متروك كما هو** لأنه رح يربط دومين `hadararealestate.com` الرسمي بنفسه لاحقاً (عندها الدومين المخصص يتجاوز الـ SSO تلقائياً).
  - **لازم متغيرات بيئة `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` مضبوطة بإعدادات مشروع Vercel** حتى تشتغل ميزات الحساب/إعادة البيع (راجع قسم 4.6) — تحقق منها لو صار خلل بتسجيل الدخول أو رفع العقارات بالموقع المنشور.
  - **لا تلمس/تعدّل مشروع `hadararealestate` أو `byhadara` الأصلي على Vercel أبداً** (منفصل تماماً عن هذا المشروع التجريبي).
- **محاولات نشر سابقة فاشلة (تاريخية، لمرجعية فقط)**: قبل الوصول للحل أعلاه، تمت عدة محاولات فاشلة (`hadara-site-v2`, `hadara-preview-1` إلى `hadara-preview-5`) برفع الملفات يدوياً عبر `create_deployment`/`upload_file` — كلها فشلت بالبناء (`readyState: ERROR`). **الدرس المستفاد**: الربط المباشر بـ GitHub (`gitSource`) هو الطريقة الصحيحة الوحيدة الموثوقة — لا تحاول رفع الملفات يدوياً مرة تانية.

## 9. اعتبارات قبل الإطلاق الحقيقي (Production Checklist)

- [ ] نقل الصور من Wix لاستضافة/CDN خاص بالموقع الجديد (اعتماد خارجي حالياً)
- [ ] ربط فورم التواصل/طلب العقار المخصص بخدمة إرسال حقيقية (بدل `mailto:`)
- [ ] ربط الدومين الحقيقي `hadararealestate.com` (يقوم بها المستخدم نفسه)
- [x] SEO: روابط حقيقية لكل صفحة ولغة، وسوم meta/hreflang/OG/JSON-LD، sitemap وrobots (راجع قسم 4.5)
- [x] بوابة إعادة بيع/وسطاء حقيقية بـ auth ومراجعة إدارية (راجع قسم 4.6) — تحتاج مراجعة أمنية/سياسات Supabase RLS قبل إطلاق واسع
- [ ] بعد ربط الدومين: تسجيل الموقع بـ Google Search Console وإرسال `sitemap.xml`
- [ ] اختبار على أجهزة موبايل حقيقية (تم اختباره بـ Playwright فقط لحد الآن)

## 10. ملاحظات عامة للتعديل المستقبلي

- أي نص جديد فيه أرقام/تواريخ/أسعار يظهر داخل سياق عربي RTL → لازم `dir="ltr"` على العنصر (راجع قسم 3).
- أي ترجمة جديدة لازم تُضاف بنفس الـ key في **الأربع ملفات JSON** (`en`, `ar`, `fr`, `ru`) للحفاظ على التطابق.
- الـ router بسيط ومباشر — أي صفحة جديدة تحتاج: إضافة route في `src/seo/routes.ts` (النوع + `parseRoute` + `routePath`) + حالة بـ `renderRoute` بـ `src/router.ts` + دالة render بـ `src/pages/` + ترجمات جديدة (ومفتاح `seo.*`) بالقواميس الأربعة + رابط بالهيدر (أساسي أو ضمن "Resources") أو الفوتر حسب الأهمية.
- أي قائمة مدينة/منطقة تركية جديدة بفورم → استورد من `src/data/turkeyLocations.ts`، وأي حقل هاتف جديد → استخدم `src/components/phoneInput.ts` — لا تنشئ نسخ محلية مكررة.
- **دايماً اختبر بصرياً (screenshot عربي/إنجليزي، عرض واسع/ضيق) قبل اعتبار أي تعديل UI منتهي** — راجع الملاحظة الثابتة أعلى الملف.
