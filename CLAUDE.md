# CLAUDE.md — سياق مشروع HADARA Real Estate

هذا الملف مرجع كامل للمشروع، مخصص لأي محادثة جديدة مع Claude Code تشتغل على هذا الريبو. اقرأه أولاً قبل أي تعديل.

> **ملاحظة ثابتة من المستخدم**: هذا الريبو هو **المرجع الرسمي المعتمد** لـ "موقع حضارة الجديد". أي طلب تعديل مستقبلي على الموقع الجديد (نصوص، تصميم، مشاريع، صفحات...) يُنفَّذ هنا مباشرة.
> - **workflow التعديل**: اعمل تعديلاتك، commit + push. بما إن مشروع Vercel (`kinci-byhadara`) مربوط بفرع `main` عبر `gitSource`، أي push على `main` (أو أي PR يندمج فيه) بيعمل إعادة نشر تلقائي — **بدون رفع ملفات يدوي إطلاقاً**.
> - إذا كان التعديل بسيط ومباشر، ممكن تشتغل مباشرة على `main` (بعد `git pull` للتأكد إنك على آخر نسخة) وتـ push، أو تفتح فرع جديد وPR إذا كان تعديل أكبر — استخدم تقديرك حسب حجم التعديل.
> - **لا تلمس أبداً** مشاريع `hadararealestate` أو `byhadara` الأصلية على Vercel، ولا تربط أي دومين بـ `hadararealestate.com` من دون طلب صريح — المستخدم هو من سيقوم بربط الدومين الرسمي بنفسه.
> - **قاعدة ثابتة عن المحاذاة (alignment)**: أي تعديل أو إضافة (عنصر جديد بالهيدر، زر، قائمة، أي شي) **يجب** أن يُختبر بصرياً بعد التنفيذ (screenshot بالعربي والإنجليزي، وبعرض شاشة واسع وضيق) للتأكد إنه المحاذاة والمسافات لائقة ومتناسقة مع باقي الموقع — **قبل** اعتباره منتهي. لا تفترض إنه الكود سليم لأنه بنى بدون أخطاء؛ التنسيق البصري (centering، spacing، عدم التصاق العناصر بحافة) مسؤولية أساسية بكل تعديل، مش خطوة اختيارية.
> - **ملاحظة عن الجلسات المتوازية**: أكثر من محادثة Claude Code ممكن تشتغل على هذا الريبو بالتوازي (فروع مختلفة تندمج بـ `main`). لو رجعت من فترة غياب أو انفتح merge conflict، **افحص `git log`/الملفات الفعلية قبل ما تفترض إنه بس نسختك هي الصحيحة** — وحدة أي conflict بدمج المحتوى الحقيقي من الطرفين (متل ما صار بهذا الملف نفسه)، ما تحسم لصالح نسخة وحدة فقط.
> - **ادفع دائماً بدون ما تسأل**: بمجرد ما التعديل جاهز (commit تم عمله، والبناء `npm run build` نظيف)، اعمل `git push` على `main` مباشرة من دون ما تسأل المستخدم "بدفعه؟" أو تنتظر تأكيد إضافي — طلب صريح من المستخدم بتاريخ 2026-09-25.

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
  - **⚠️ خطوة إعداد يدوية إلزامية على أي مشروع Supabase جديد**: `supabase/migrations/0001_init.sql` بالريبو يحتوي كل الجداول (`profiles`, `listings`, `listing_photos`, `listing_inquiries`)، الـ triggers، وسياسات RLS — **لازم يُشغَّل يدوياً** بـ Supabase Dashboard → SQL Editor (نسخ محتواه بالكامل والـ Run). لو ما اتشغّل، أي عملية على `listings` بترجع خطأ "Could not find the table 'public.listings' in the schema cache" (صار فعلياً بهذا المشروع). لو نسخ/لصق الملف كامل دفعة وحدة فشل بخطأ "syntax error at end of input" (انقطاع بالنسخ)، قسّمه لأجزاء أصغر (حسب أقسام الملف: profiles، listings، listing_photos+listing_documents، listing_inquiries+grants، storage buckets) وشغّل كل جزء لحاله.
  - **بعد تشغيل الـ migration**: أي حساب سجّل **قبل** تشغيلها ما رح يكون عنده صف بجدول `profiles` (الـ trigger التلقائي ما كان موجود وقت تسجيله) — لازم تشغّل مرة وحدة: `insert into public.profiles (id, full_name, phone, country, role) select id, raw_user_meta_data->>'full_name', raw_user_meta_data->>'phone', raw_user_meta_data->>'country', 'seller' from auth.users where id not in (select id from public.profiles);` وإلا رفع أي عقار بيفشل بخطأ foreign key violation.
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

- `src/data/projects.ts`: 10 مشاريع حقيقية بكل تفاصيلها (slug, district, city, status, timeline, stats, gallery images)، مرتبة حسب `priority`:
  1. `beylikduzu-living` (new-launch، تسليم 2028) — هو نفسه مشروع **Lotus Yaşam** (Lotus Yapı Proje، 18 بلوك حسب مخطط الموقع: A1–A6، B1–B2، C1–C4، D1–D4، E، F؛ 2+1/3+1/4+1)؛ كتالوجه "LOTUS YAŞAM SUNUM DOSYASI" (مقسوم لأجزاء بمجلد المشاريع)، وصوره صارت محلية بـ `public/images/projects/beylikduzu-living/` بدل Wix
  2. `diamond-marin` (new-launch، Yıltaş × Lotus، Beylikdüzü، تسليم أواخر 2027)
  3. `lotus-manzara-guzelce` (delivered + `unitsAvailable`، 32 فيلا 6+2، Lotus Yapı، Büyükçekmece)
  4. `lotus-manzara-beylikduzu` (delivered + `unitsAvailable`، 16 فيلا 5+2: 8 مستقلة A + 8 توأم B، Lotus Yapı، Beylikdüzü/Dereağzı)
  5. `lotus-yali` (delivered + `unitsAvailable`، 48 شقة 3+1 و5+2 دوبلكس في 8 بلوكات A–H على 8,600 م²، Lotus Yapı، Büyükçekmece/Mimarsinan؛ مسابح داخلية منفصلة — صوره الأربعة بعتها المستخدم مباشرة لأنه أجزاء الكتالوج كانت كبيرة، ممكن تنضاف صور داخلية لاحقاً)
  6. `cadde-ispartakule` (delivered + `unitsAvailable`، 78 شقة + 12 محل، MH Grup، Avcılar/Ispartakule)
  7. `lotus-koru-2` (delivered + `unitsAvailable`)
  8. `lotus-istanbul` (delivered + `unitsAvailable`، مبنى متعدد الاستخدامات)
  9. `lotus-koru-1` (delivered + `soldOut` — تم البيع بالكامل حسب المستخدم)
  10. `marmara-haven-villa` (delivered، فيلا خاصة — بدون شارة وحدات لأنها وحدة وحيدة)
- **قاعدة الحالة**: أي مشروع انتهت مدته الزمنية (`timeline`) لازم يكون `delivered` (بيظهر "اكتمل الإنشاء" / "Completed")، وحسب المستخدم كل المشاريع المكتملة فيها وحدات متاحة للبيع (`unitsAvailable`). فلاتر صفحة المشاريع بتخفي أي حالة ما عليها مشاريع.
- **مشاريع الكتالوجات (2–6)**: مضافة من ملفات PDF بـ Google Drive (مجلد "حضارة العقاري/المشاريع")؛ صورها مقصوصة من الكتالوجات ومستضافة محلياً في `public/images/projects/<slug>/` (مش على Wix). الكتالوجات غالباً ما فيها تواريخ تسليم — لا تخترع تواريخ؛ `timeline` اختياري.
- **قيد تحميل ملفات Drive**: `download_file_content` حدّه الرسمي 10 ميغا، وعملياً بيفشل ("session expired") مع PDF أكبر من ~5 ميغا. `read_file_content` بيجيب النص بس. **الحل المجرّب والناجح**: المستخدم يقسّم الملف بـ ilovepdf (Split PDF) لأجزاء < 4 ميغا ويرفعها كـ PDF منفصلة (مش zip) — الأجزاء بتنزل عادي وبتنجمع. كل ملفات مجلد المشاريع انضافت (ما في ملفات معلّقة).
- **`soldOut: true`**: مشروع خلص البيع فيه — شارة "تم البيع بالكامل" (رمادية) بدل "وحدات متاحة"، وسطر "التوفر: تم بيع جميع الوحدات". صفحة المشاريع فيها فلتر **"وحدات متاحة"** (`available`) بيعرض المشاريع اللي عليها `unitsAvailable`.
- **أيقونات شريط الأرقام الرئيسية**: `src/components/statIcons.ts` (أيقونة لكل `labelKey`؛ أي `labelKey` جديد يحتاج أيقونة هون وإلا بتطلع أيقونة عامة). الأيقونة جوّا `<dt>` وموضوعة absolute (حتى يضل `<dl>` صالح)؛ على الموبايل بتطلع فوق الرقم.
- **`unitsAvailable: true`**: مشروع منفّذ (أو قيد الإنشاء) لسا فيه وحدات للبيع — بيظهر شارة "وحدات متاحة" على البطاقة والـ hero وسطر "التوفر" بأهم المعلومات. حسب المستخدم: مشاريع الكتالوجات المنفّذة كلها فيها وحدات متاحة للبيع.
- **أرقام الصفحة الرئيسية/من نحن** (`home.stats`/`about.stats` بالقواميس): 650+ وحدة سكنية (المجموع المعروف 643 بدون بيليكدوزو ليفينغ)، 3 مناطق (بيليكدوزو، بيوكجكمجة، أفجلار)، 10 مشاريع، 60,000+ م² أراضي (~63,000). أي مشروع جديد → حدّث هالأرقام.
- **المرافق المشتركة (`COMMUNITY` بـ `projects.ts`)**: حسب المستخدم، كل المشاريع السكنية (ما عدا فيلا مرمرة، ومشاريع الفلل بلا مسابح) فيها: مسابح منفصلة للرجال والنساء، جيم، مرآب مغلق، حراسة 24/7، كاميرات، نظافة داخلية، حدائق داخلية، مولد احتياطي، جودة بناء عالية — استخدم `community([...extras], {swap})` لأي مشروع جديد، و`swap` بيستبدل مرفق مشترك أو بيحذفه بـ `null`. **مشاريع الفلل (غوزلجه وبيليكدوزو مانزارا) ما فيها مسابح** (تأكيد المستخدم) وعندها مرآب خاص بدل المرآب المغلق — `VILLA_SWAP`. شبكة المرافق flex: 3 أعمدة لما العدد 6/9 و4 غير هيك، والصف الأخير الناقص بيتوسّط تلقائياً.
- **حقول المشروع الاختيارية** (`Project` في `projects.ts`): `developer`، `address`، `residences` (بطاقات الوحدات: layout/gross/net/garden/floors)، `amenities` (مفاتيح `AmenityKey` مع أيقونات في `components/amenityIcons.ts` وترجمات `projectDetail.amenities.*`)، ونص `nearby` (أماكن قريبة + وقت) داخل `projectsData.<slug>` بالقواميس. صفحة المشروع تعرض كل قسم فقط إذا بياناته موجودة، مع شريط أرقام رئيسية تحت الـ hero.
- **أسماء المناطق المترجمة**: قاموس `places.<key>` (المفتاح من `placeKey()` في `src/utils/place.ts`) + `placeName()` من `src/i18n` — أي مشروع بمنطقة جديدة يحتاج مفتاحها بالأربع لغات وإلا يظهر الاسم التركي.
- **عدد صور المعرض**: الأفضل عدد صور `gallery` (بدون الغلاف) = 2 أو 5 أو 8 أو 11...؛ لو بقيت صورة وحيدة بآخر صف، `galleryTail()` بـ `projectDetail.ts` بيمدّها كصورة بانوراما بعرض كامل تلقائياً.
- **صفحة المشروع حيّة**: أرقام الشريط تعدّ تصاعدياً (`initStatCounters`، بس للأرقام/المساحات البسيطة مش السنوات أو المدى)، والبطاقات/المرافق/المميزات بتظهر تدريجياً (`initScrollReveal`)، وبطاقات المرافق والوحدات عليها hover (رفع + إطار ذهبي).
- **الصور**: **كلها مستضافة محلياً** بـ `public/images/` — مشاريع بـ `public/images/projects/<slug>/<name>.jpg` (عبر helper `img(slug, file, w, h, alt)` بـ `projects.ts`)، أغلفة المدونة بـ `public/images/blog/<slug>.jpg`، وصور الصفحات بـ `public/images/pages/`. تم نقل آخر صور Wix بتاريخ 2026-09-26 وحُذف `wixImg()`/`src/utils/image.ts` — **الموقع ما عاد يعتمد على Wix إطلاقاً، لا ترجع تستخدم روابط `static.wixstatic.com`**. أي صورة جديدة → نزّلها لـ `public/images/...`. الروابط النسبية بتتحول لروابط مطلقة بوسوم SEO عبر `img()` بـ `src/seo/meta.ts`.
- بيانات التواصل الحقيقية: الإيميل `info@byhadara.com`، الهاتف `+90 531 930 92 14` (`00905319309214` بأزرار WhatsApp/اتصال العائمة)، العنوان "Adnan Kahveci Mah., Beylikdüzü, Istanbul 34000, Türkiye".
- `src/data/blog.ts`: 10 مقالات مدونة عقارية حقيقية المحتوى (استثمار عقاري بتركيا، الجنسية عبر الاستثمار، الحياة بتركيا، إجراءات الطابو، الضرائب والرسوم، التثمين العقاري...) بكل اللغات الأربعة. الأغلفة (1536×1024) مولّدة بـ Canva (`generate-image`) ومستضافة محلياً بـ `public/images/blog/<slug>.jpg`، ونسخها الأصلية بتصميم Canva "HADARA Blog Covers" (`DAHWQk3T6lk`، صفحة لكل مقال). **درس مهم**: الصورة اللي بترجعها `get-generate-image-job` هي thumbnail بحجم 200×133 بس (هيك طلعت الأغلفة القديمة مغبّشة) — للنسخة الكاملة: حط الصورة كخلفية صفحة بتصميم Canva (`update_fill`) وصدّرها بـ `export-design`. ولأنه `media.canva.com`/`export-download.canva.com` محجوبين بشبكة بيئة Claude، مرّر روابط التصدير لـ `mcp__Wix__UploadImageToWixSite` (موقع "HADARA Real Estate") ونزّلها من `static.wixstatic.com` (متاح).
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
- **متطلب بيئة**: لازم `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` مضبوطين بـ Vercel (Project Settings → Environment Variables) وإلا الموقع بيطبع خطأ بالـ console وميزات الحساب ما بتشتغل (باقي الموقع يشتغل عادي لأنه مستقل). **وبالإضافة لهيك، لازم الـ migration (فوق بقسم 2) يكون اتشغّل على قاعدة البيانات نفسها.**
- **فورم رفع العقار (`submitListing.ts`) — 3 خطوات بس** (`details` → `photos` → `review`): **تم حذف خطوة "رفع المستندات" بالكامل** (كانت رفع سند طابو + هوية/جواز) بطلب من المستخدم (اعتبرها تدخّل بالخصوصية غير ضروري بهذه المرحلة) — لا ترجّعها من دون طلب صريح. حقل "رقم سند الطابو" (`title_deed_number`) انشال هو كمان بالكامل من الفورم (كان اختياري لفترة قصيرة، بعدين حُذف تماماً) — عمود `listings.title_deed_number` ضل موجود بقاعدة البيانات (فاضي/غير مستخدم) لأنه حذف عمود يحتاج migration يدوي منفصل.
- **الحقول الرقمية بالفورم** (المساحة، غرف النوم، الحمامات، السعر، سنة الشراء): **لازم تكون `type="text" inputmode="numeric"`، أبداً `type="number"`** — متصفح Chromium (وأغلب المتصفحات) يرفض الأرقام العربية (١٢٣) بحقل `type="number"` بصمت (القيمة تضل فاضية من دون أي رسالة خطأ)، وهاد صار يسبب مشكلة حقيقية (المستخدم كتب بالعربي وما قدر يتقدم بالفورم). الحل: `type="text"` + دالة `toWesternDigits()` (`src/utils/numbers.ts`) تحوّل الأرقام العربية/الفارسية لغربية قبل أي `Number(...)` أو حفظ.
- **أمان مهم — escapeHtml()**: أي نص يدخله المستخدم (بائع) ويُعرض لشخص تاني (عنوان/وصف العقار، اسم البائع...) **يجب** يمرّ عبر `escapeHtml()` (`src/utils/html.ts`) قبل أي `innerHTML =`. اكتُشفت وصُلحت ثغرة XSS خطيرة هون (بائع خبيث كان ممكن يسرق جلسة الأدمن لما يفتح صفحة المراجعة) — راجع قسم 9. سياسات RLS بقاعدة البيانات (بالـ migration) قوية ومصممة صح (triggers تمنع self-approval، تمنع تعديل حقول الإدارة من غير admin) — الثغرة كانت فقط بعرض النصوص بالواجهة، مش بالصلاحيات.

## 5. نظام التصميم (Design System)

> **مرجعان بصريان مهمّان**: هذا المشروع جزء من عائلة مواقع HADARA — الموقعين التاليين موجودين كـ Next.js repos على GitHub بحساب المستخدم (`kerimalastal-source/BYHADARA` = byhadara.com، `kerimalastal-source/hadararealestate` = hadararealestate.com)، ولازم يُرجَع لهم كمرجع تصميم عند أي طلب "خليه متل الموقع القديم/الأم". **الوصول المباشر لـ byhadara.com/hadararealestate.com عبر الإنترنت محجوب بسياسة الشبكة بهذه البيئة** (نفس قيد Wix/Supabase) — الطريقة الموثوقة: clone الريبوهات من GitHub (`git clone --depth 1 https://github.com/kerimalastal-source/<repo>`) وقراءة `styles/globals.css`/`components/Header.tsx`/`content/site.ts` منها مباشرة، مش محاولة fetch للموقع المباشر.

`src/styles/variables.css`:
- الألوان: خلفية الموقع `--color-bg: #f7f5f0` (ايفوري — نفس درجة hadararealestate.com بالضبط)، أخضر غامق `--color-primary: #0f2b21` + ذهبي `--color-accent: #c9a24b` (لسا الهوية الأساسية، بس يُستخدم بحيطية — راجع أدناه). أخضر غامق كخلفية كاملة لقسم محصور بـ: الهيرو (overlay فوق صورة)، الفوتر، وبانر CTA وحيد بآخر الصفحة الرئيسية — **مش كخلفية متكررة لأقسام عادية** (متل الأرقام/الإحصائيات) لأنه هيك بيصير الموقع "غامق" بشكل عام (كانت هاي شكوى فعلية من المستخدم، وصُلحت).
- الخطوط: **Inter** + **IBM Plex Sans Arabic** — للعناوين والنص كله (نفس خط byhadara.com بالضبط؛ لا تستخدم Playfair Display أو Noto Naskh/Kufi Arabic — انشالو من المشروع). من Google Fonts (`index.html`).
- الملفات: `variables.css` (متغيرات) → `base.css` (reset/typography) → `layout.css` (header/footer/hero) → `components.css` (كل الأجزاء: buttons, cards, forms, stats, gallery, lightbox, search, partners, floating actions...) → `rtl.css` (استثناءات RTL) — كلها مجمّعة بـ `main.css` عبر `@import`.
- **اللوغو**: اللوغو الحقيقي لحضارة (`public/logo-dark.png`/`logo-light.png` + favicons) بالهيدر/الفوتر/تاب المتصفح، بحجم واضح وكبير، مع "REAL ESTATE" كـ tagline تحت "HADARA" — **لازم مسافة واضحة (`margin-top`) بين الاسم والـ tagline**، مش ملزوقين ببعض (`.brand__tagline` بـ `layout.css`).
- **الشعار ثابت بكل اللغات (قاعدة إلزامية)**: الشعار + "HADARA" + "REAL ESTATE" يُبنى من مكان واحد فقط: `renderBrand()` بـ `src/components/brand.ts` (الهيدر والفوتر)، والاسم/الـ tagline ثوابت إنجليزية حرفية (`BRAND_NAME`/`BRAND_TAGLINE`) — **مش من القواميس، وممنوع ترجمتهم** (حتى بالعربي). العنصر عليه `lang="en" dir="ltr" translate="no"`. الشعار دايماً على **أقصى اليسار فيزيائياً** بكل اللغات: `.site-header__inner` و`.site-footer__inner` عليهم `direction: ltr`، والمنيو/الأزرار/أعمدة الفوتر الأخرى ترجع `direction: rtl` بالعربي (فبتنعكس عادي). بالفوتر العربي، الوصف والأيقونات تحت الشعار محاذاة لليسار حتى تضل تحته. أي مكان جديد يظهر فيه الشعار → استخدم `renderBrand()`.
- **الهيدر**: `.site-header__inner` هو **CSS grid بـ 3 أعمدة** (`max-content minmax(0,1fr) max-content`: brand / nav / actions، بأعمدة `grid-column` صريحة على كل وحدة) مع `.main-nav { display:flex; justify-content:center }` عشان المنيو تضل بمنتصف الهيدر تماماً بكل اللغات (LTR/RTL) — **هذا نمط إلزامي، لا ترجع لـ flex + margin-auto** (حتى لو الموقع المرجعي byhadara.com بيستخدم flex+space-between عادي، إحنا متمسكين بالـ centering). **مهم**: عمود الـ brand يجب يضل `max-content` (لا `auto`) وإلا الشعار بينضغط/يتراكب مع جاره لما المسافة تضيق (صار فعلياً بعد تعديل تصميم الهيدر — تم تصحيحه). القوائم الفرعية غير الأساسية (الجنسية، طلب عقار مخصص، المدونة، الأسئلة الشائعة) مجمّعة بقائمة منسدلة "Resources" (`NAV_RESOURCES` بـ `header.ts`) لتفادي ازدحام الهيدر — أي صفحة جديدة غير أساسية تنضاف هون. رابط "Contact" بالمنيو الرئيسية مخفي على الديسكتوب (مكرر مع زر "Get in Touch" جنبه)، بس موجود بقائمة الموبايل.
- **تبديل اللغة**: روابط نصية بسيطة جنب بعض (`EN AR FR RU`، النشطة تحتها خط) — **مش dropdown** (`.lang-switch` بـ `header.ts`/`layout.css`)، مطابق لأسلوب byhadara.com وhadararealestate.com. القائمة عليها `direction: ltr` صريح حتى ترتيبها يضل ثابت بكل اللغات (نفس نمط الموقعين المرجعيين).
- **الأزرار العائمة**: WhatsApp + اتصال هاتفي، ثابتة فيزيائياً على يمين الشاشة بكل اللغات (`src/components/floatingButtons.ts`)، تستخدم الرقم `00905319309214`.
- **صورة الهيرو الرئيسية**: `public/hero-istanbul.jpg` (منظر البوسفور الجوي — نفس صورة هيرو byhadara.com، منزّلة محلياً بدل رابط Wix خارجي مكسور).
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

`src/utils/`:
- **`html.ts`** (`escapeHtml()`): تنقية أي نص يدخله مستخدم قبل عرضه بـ `innerHTML` — إلزامي لأي حقل مصدره بائع/مستخدم (راجع قسم 4.6).
- **`numbers.ts`** (`toWesternDigits()`): تحويل الأرقام العربية/الفارسية (١٢٣ / ۱۲۳) لأرقام غربية — إلزامي قبل أي `Number(...)` على قيمة من حقل `type="text" inputmode="numeric"` (راجع قسم 4.6).

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

- [x] نقل الصور من Wix لاستضافة الموقع نفسه (`public/images/`) — تم 2026-09-26، ما في أي رابط Wix متبقي بالكود. وأغلفة المدونة انعملت من جديد بدقة عالية (1536×1024) بدل النسخ القديمة الصغيرة/المشوّهة.
- [ ] ربط فورم التواصل/طلب العقار المخصص بخدمة إرسال حقيقية (بدل `mailto:`)
- [ ] ربط الدومين الحقيقي `hadararealestate.com` (يقوم بها المستخدم نفسه)
- [x] SEO: روابط حقيقية لكل صفحة ولغة، وسوم meta/hreflang/OG/JSON-LD، sitemap وrobots (راجع قسم 4.5)
- [x] بوابة إعادة بيع/وسطاء حقيقية بـ auth ومراجعة إدارية (راجع قسم 4.6) — تمت مراجعة أمنية: سياسات RLS بقاعدة البيانات قوية وسليمة، وتم اكتشاف وإصلاح ثغرة XSS بعرض النصوص (راجع `escapeHtml()` بقسم 4.6/7)
- [ ] بعد ربط الدومين: تسجيل الموقع بـ Google Search Console وإرسال `sitemap.xml`
- [ ] اختبار على أجهزة موبايل حقيقية (تم اختباره بـ Playwright فقط لحد الآن)

## 10. ملاحظات عامة للتعديل المستقبلي

- أي نص جديد فيه أرقام/تواريخ/أسعار يظهر داخل سياق عربي RTL → لازم `dir="ltr"` على العنصر (راجع قسم 3).
- أي ترجمة جديدة لازم تُضاف بنفس الـ key في **الأربع ملفات JSON** (`en`, `ar`, `fr`, `ru`) للحفاظ على التطابق.
- الـ router بسيط ومباشر — أي صفحة جديدة تحتاج: إضافة route في `src/seo/routes.ts` (النوع + `parseRoute` + `routePath`) + حالة بـ `renderRoute` بـ `src/router.ts` + دالة render بـ `src/pages/` + ترجمات جديدة (ومفتاح `seo.*`) بالقواميس الأربعة + رابط بالهيدر (أساسي أو ضمن "Resources") أو الفوتر حسب الأهمية.
- أي قائمة مدينة/منطقة تركية جديدة بفورم → استورد من `src/data/turkeyLocations.ts`، وأي حقل هاتف جديد → استخدم `src/components/phoneInput.ts` — لا تنشئ نسخ محلية مكررة.
- **دايماً اختبر بصرياً (screenshot عربي/إنجليزي، عرض واسع/ضيق) قبل اعتبار أي تعديل UI منتهي** — راجع الملاحظة الثابتة أعلى الملف.
