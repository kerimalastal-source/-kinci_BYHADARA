# CLAUDE.md — سياق مشروع HADARA Real Estate

هذا الملف مرجع كامل للمشروع، مخصص لأي محادثة جديدة مع Claude Code تشتغل على هذا الريبو. اقرأه أولاً قبل أي تعديل.

> **ملاحظة ثابتة من المستخدم**: هذا الريبو هو **المرجع الرسمي المعتمد** لـ "موقع حضارة الجديد". أي طلب تعديل مستقبلي على الموقع الجديد (نصوص، تصميم، مشاريع، صفحات...) يُنفَّذ هنا مباشرة.
> - **workflow التعديل**: اعمل تعديلاتك على فرع `claude/peaceful-hypatia-rtg37p`، ثم commit + push على الفرع، وبعدين merge على `main` وpush (`git fetch origin main && git checkout -B main origin/main && git merge --no-edit claude/peaceful-hypatia-rtg37p && git push origin main && git checkout claude/peaceful-hypatia-rtg37p`). بما إن مشروع Vercel (`kinci-byhadara`) مربوط بفرع `main` عبر `gitSource`، أي push على `main` بيعمل إعادة نشر تلقائي — **بدون رفع ملفات يدوي إطلاقاً**.
> - بعد كل push على `main`، انتظر ~20-30 ثانية وتحقق من `mcp__Vercel__get_project({idOrName: "kinci-byhadara"})` — إذا `readyState` لسا `QUEUED`/`BUILDING`، جدول `ScheduleWakeup` قصير وتحقق مرة تانية، وبعدين أخبر المستخدم بالعربي إنه النشر خلص.
> - **لا تلمس أبداً** مشاريع `hadararealestate` أو `byhadara` الأصلية على Vercel، ولا تربط أي دومين بـ `hadararealestate.com` من دون طلب صريح — المستخدم هو من سيقوم بربط الدومين الرسمي بنفسه.
> - **قاعدة ثابتة عن المحاذاة (alignment)**: أي تعديل أو إضافة (عنصر جديد بالهيدر، زر، قائمة، سكشن جديد، فورم) **يجب** أن يُختبر بصرياً بعد التنفيذ (screenshot عبر Playwright بالعربي والإنجليزي، وبعرض شاشة واسع وضيق) للتأكد إنه المحاذاة والمسافات لائقة ومتناسقة مع باقي الموقع — **قبل** اعتباره منتهي. لا تفترض إنه الكود سليم لأنه بنى بدون أخطاء؛ التنسيق البصري (centering، spacing، عدم التصاق العناصر بحافة، عدم overflow أفقي بالـ RTL) مسؤولية أساسية بكل تعديل، مش خطوة اختيارية.

## 1. نظرة عامة

موقع ويب حديث ومحترف لشركة **حضارة للتطوير العقاري (HADARA Real Estate)** — شركة تطوير عقاري في إسطنبول. المشروع بديل عصري لموقع Wix القديم (byhadara.com)، مبني من الصفر بـ **TypeScript + CSS خام** (بدون أي framework مثل React/Vue).

- **الريبو**: `kerimalastal-source/-kinci_BYHADARA`
- **فرع التطوير**: `claude/peaceful-hypatia-rtg37p` (كل التعديلات تبدأ هنا، وبعدين تُدمج على `main`)
- **فرع النشر**: `main` — هذا الفرع مربوط بـ Vercel مباشرة، أي push عليه = نشر فوري
- **الحالة**: الموقع **منشور فعلياً ويعمل** (راجع قسم 9). مبني بنجاح محلياً (`npm run build` بدون أخطاء) وتم اختباره بـ Playwright بالعربي والإنجليزي مراراً.

## 2. المكدس التقني

- **Vite** (bundler) + **TypeScript** (بدون framework — DOM manipulation مباشر)
- **CSS خام** مقسّم لملفات منطقية (variables/base/layout/components/rtl)
- **Hash-based routing** بدون مكتبة routing، كود يدوي في `src/router.ts`. الـ routes الحالية:
  - `#/` (الرئيسية) · `#/projects` · `#/projects/:slug` · `#/about` · `#/citizenship` · `#/faq` · `#/blog` · `#/blog/:slug` · `#/property-request` · `#/contact`
- `package.json` build script: `"build": "tsc && vite build"`

## 3. اللغات (i18n) — 4 لغات كاملة

- **الإنجليزية (en)** — اللغة الافتراضية
- **العربية (ar)** — مع دعم RTL كامل
- **الفرنسية (fr)**
- **الروسية (ru)**

النظام في `src/i18n/`:
- `index.ts`: منطق الترجمة — `t(key)` (نص)، `tRaw<T>(key)` (بيانات خام كـ arrays/objects)، `getLocale()`/`setLocale()`/`onLocaleChange()`، حفظ اللغة بـ `localStorage` (`hadara-locale`)، وضبط `document.documentElement.dir` تلقائياً (`rtl` لو عربي).
- `en.json` / `ar.json` / `fr.json` / `ru.json`: قواميس ترجمة متطابقة البنية بالكامل — نفس الـ keys بكل اللغات. أهم الأقسام المتداخلة (nested content بدل نص بسيط):
  - `projectsData.<slug>`: اسم/تاجلاين/وصف قصير وطويل/highlights لكل مشروع
  - `faq.categories`: 3 أقسام أسئلة شائعة (كل قسم فيه `title` + `items[{q,a}]`)
  - `blogData.<slug>`: `category`/`title`/`excerpt`/`body[]` (مصفوفة فقرات) لكل مقال من مقالات المدونة
  - `propertyRequest.cities` / `propertyRequest.districts` / `propertyRequest.propertyTypes` / `propertyRequest.conditions` / `propertyRequest.budgets` / `propertyRequest.floors`: خرائط `slug -> label` مترجمة لخيارات فورم طلب العقار
- زر تبديل اللغة بالـ header (`src/components/header.ts`).

### دعم RTL

- أغلب الـ layout يعتمد على **CSS logical properties** (`inset-inline-*`, `padding-inline-*`, `margin-inline-*`, `text-align: start/end`) فبينقلب أوتوماتيكياً مع `[dir="rtl"]`.
- `src/styles/rtl.css`: استثناءات فقط للعناصر الحساسة للاتجاه (أيقونات السهم بالـ back-link، أسهم الـ lightbox) عبر `transform: scaleX(-1)`.
- **مشكلة Bidi معروفة وتم حلها**: أي نص فيه أرقام إنجليزية (أرقام هاتف، مدى سنوات مثل "2022 – 2024"، قيم إحصائيات) يظهر معكوس بصرياً داخل سياق RTL. **الحل المطبّق**: إضافة `dir="ltr"` على كل عنصر يعرض رقم هاتف/إيميل/`project.timeline`/`stat.value`. لو أضفت رقم أو مدى تاريخ جديد بمكان جديد، **لازم** تعمل نفس الشي.
- **باغ overflow أفقي بالعربي تم حله**: `.skip-link` كان فيه `left: -999px` (physical property) بدل `inset-inline-start` — سبب سكرول أفقي كامل بالصفحة بوضع RTL. أي `left`/`right` physical جديد لازم يُفحص بنفس الطريقة (screenshot + فحص `document.documentElement.scrollWidth` بالعربي).
- **الأزرار العائمة (WhatsApp/اتصال)** بقصد مثبتة بـ physical `right` (مش logical) — هاي الحالة الوحيدة المتعمدة لأنه اتفقنا إنها تبقى بنفس المكان الفعلي بكل اللغات (نفس اتفاقية widgets الواتساب العالمية).

## 4. البيانات الحقيقية والصور

- `src/data/projects.ts`: 5 مشاريع حقيقية مُستخرجة من موقع Wix الأصلي "حضارة العقاري" عبر Wix Data API (slug, district, city, status, timeline, stats, gallery images):
  1. `beylikduzu-living` (new-launch، تسليم 2028) · 2. `lotus-koru-2` (ongoing) · 3. `lotus-istanbul` (ongoing، متعدد الاستخدامات) · 4. `lotus-koru-1` (delivered) · 5. `marmara-haven-villa` (ongoing، فيلا خاصة)
- `src/data/blog.ts`: 10 مقالات المدونة العقارية (راجع قسم 6 للتفاصيل).
- `src/data/partners.ts`: 5 شركاء (DTC, Faisal Holding, DAG Holding, WUJHA Development, Lotus) — شعاراتهم بـ `public/partners/*.png`، مُعالَجة محلياً (خلفية شفافة + قص محكم) من صور رفعها المستخدم.
- `src/data/propertyRequestOptions.ts`: بنية المدن/المناطق (slugs فقط، الترجمة بالـ i18n) + خيارات نوع العقار/الميزانية/الطابق.
- **الصور**: مستضافة على Wix مباشرة (`https://static.wixstatic.com/media/<mediaId>`)، مبنية عبر `wixImg()` في `src/utils/image.ts`. **نقطة اعتماد خارجي على Wix** — إذا حُذفت الصور من حساب Wix الأصلي، بتنكسر بالموقع الجديد.
  - **مهم**: صور المدونة (10 صور) تم توليدها بالذكاء الاصطناعي (Canva `generate-image`) لأنها مواضيع عامة (تركيا، إسطنبول، طابو، ضرائب...) وليست صور مشاريع حقيقية، ثم رُفعت لنفس مكتبة ميديا Wix (`mcp__Wix__UploadImageToWixSite`, siteId المشروع: `21910a9f-d588-43e2-92a5-8c660fbc376a` = "HADARA Real Estate") للحصول على رابط `static.wixstatic.com` دائم متوافق مع باقي الموقع. **لو المستخدم طلب صور مقالات حقيقية بدل المولّدة، لازم تستبدل هذي الروابط.**
  - **بيئة العمل الحالية لا تصل لـ `static.wixstatic.com` أو أي دومين خارجي آخر (egress محجوب)** — الصور بتظهر مكسورة بأي screenshot تعمله محلياً بـ Playwright. هذا **متوقع وليس خطأ حقيقي** — الصور شغالة فعلياً لأي زائر حقيقي بمتصفحه (تأكد المستخدم من هذا بنفسه على الموقع المنشور). لا تحاول تشخّص "الصور المكسورة" بالـ screenshots المحلية كباغ.
- بيانات التواصل الحقيقية: الإيميل `info@byhadara.com`، الهاتف `+90 531 930 92 14` (=`00905319309214`)، العنوان "Adnan Kahveci Mah., Beylikdüzü, Istanbul 34000, Türkiye".

## 5. نظام التصميم (Design System)

- الألوان (`variables.css`): أخضر غامق `--color-primary: #0f2b21` + ذهبي `--color-accent: #c9a24b`
- الخطوط: **Playfair Display** (عناوين لاتيني) + **Noto Naskh Arabic** (عناوين عربي) + **Inter** (نص لاتيني) + **Noto Kufi Arabic** (نص عربي) — من Google Fonts
- الملفات: `variables.css` → `base.css` (reset/typography) → `layout.css` (header/footer/hero) → `components.css` (كل الأجزاء) → `rtl.css` — مجمّعة بـ `main.css` عبر `@import`
- **الشعار الحقيقي**: `public/logo-dark.png` (هيدر، خلفية فاتحة) و `public/logo-light.png` (فوتر، خلفية خضراء غامقة) — الشعار الأصلي من Google Drive (مجلد "Hadara Real Estate")، مُعالَج محلياً بإزالة الخلفية البيضاء (Pillow). أيقونة التبويب (`favicon.ico` + `favicon-*.png` + `apple-touch-icon.png`) مبنية من نفس الشعار على خلفية خضراء دائرية.
- **الهيدر**: `.site-header__inner` هو **CSS grid بثلاث أعمدة** (`auto 1fr auto`: شعار | قائمة تنقل بالمنتصف | أزرار)، مش flex عادي — هذا **مقصود** حتى تبقى القائمة بمنتصف الهيدر بكل اللغات بدل ما تلتصق بحافة. لا ترجّع `display: flex` مع `margin-inline-end: auto` على `.brand` (كانت الطريقة القديمة الغلط).
  - القائمة الرئيسية عندها 5 عناصر بس: الرئيسية، المشاريع، من نحن، **قائمة منسدلة "مصادر ومعلومات" (Resources)**، تواصل معنا. صفحات الجنسية/طلب عقار/المدونة/الأسئلة الشائعة **مجمّعة داخل** قائمة Resources المنسدلة (`src/components/header.ts` → `NAV_RESOURCES`) حتى ما تزدحم القائمة. **أي صفحة جديدة من نوع "معلومات/موارد" (مش صفحة أساسية) لازم تُضاف لـ `NAV_RESOURCES` مش لـ `NAV_LINKS`**، وإلا القائمة بتزدحم وتنكسر المحاذاة من جديد (صار هذا فعلياً مرتين قبل ما نثبّت هذا النمط).
  - Breakpoint التحول لقائمة الموبايل المنسدلة هو `1400px` (مش `900px` القديم) لأنه بعد إضافة عناصر أكتر، القائمة الكاملة بتحتاج مساحة أكتر قبل ما تنكسر.
- **الأزرار العائمة** (`src/components/floatingButtons.ts`): واتساب + اتصال، ثابتين أسفل يمين الشاشة فعلياً (`position: fixed; right/bottom`) بكل اللغات — الرقم `00905319309214`.
- **سكشن "شركاء النجاح"** بالصفحة الرئيسية (`.partners-section` بـ `home.ts`): شعارات بخلفية شفافة، ارتفاع متساوٍ (`object-fit: contain` بصندوق ثابت الارتفاع)، رمادي (`grayscale`) بشكل افتراضي ويرجع لونه الأصلي عند hover، وحركة fade-in خفيفة عند الظهور بالتمرير (`src/components/scrollReveal.ts` — يستخدم `[data-reveal]`/`[data-reveal-index]`، قابل لإعادة الاستخدام بأي سكشن جديد).

## 6. الصفحات (`src/pages/`)

| صفحة | ملف | ملاحظات |
|---|---|---|
| الرئيسية | `home.ts` | hero، إحصائيات متحركة، **سكشن شركاء النجاح**، مشاريع مميزة، خدمات، لماذا حضارة، CTA للجنسية |
| المشاريع | `projects.ts` | فلترة حسب الحالة + سكشن "لم تجد ما تبحث عنه؟" بآخر الصفحة يوجّه لـ `#/property-request` |
| تفاصيل مشروع | `projectDetail.ts` | وصف كامل، highlights، معرض صور بـ lightbox، مشاريع أخرى مقترحة |
| من نحن | `about.ts` | قصة الشركة، رسالة/رؤية، قيم، timeline تاريخي، إحصائيات |
| الجنسية بالاستثمار | `citizenship.ts` | خطوات البرنامج، فوائد الجنسية التركية |
| **الأسئلة الشائعة** | `faq.ts` | 3 أقسام (عن حضارة / الاستثمار العقاري بتركيا / الجنسية عبر الاستثمار)، كل سؤال accordion بـ `<details>/<summary>` أصلي (بدون JS) |
| **المدونة العقارية** | `blog.ts` (قائمة) + `blogDetail.ts` (مقال) | 10 مقالات × 4 لغات، كل مقال له صورة غلاف مولّدة بالـ AI (راجع قسم 4) |
| **اطلب عقارك المخصص** | `propertyRequest.ts` | فورم طلب عقار خارج مشاريع حضارة — راجع تفاصيل الحقول بقسم 7 |
| تواصل معنا | `contact.ts` | فورم التواصل + معلومات التواصل + خريطة OpenStreetMap embed |
| 404 | `notFound.ts` | صفحة خطأ بسيطة |

## 7. المكونات (`src/components/`)

- **`header.ts`**: القائمة الرئيسية (5 عناصر + قائمة Resources منسدلة)، تبديل اللغة، أيقونة البحث، CTA "تواصل معنا"، قائمة موبايل قابلة للطي، الشعار الحقيقي. راجع قسم 5 لتفاصيل التخطيط.
- **`footer.ts`**: روابط سريعة (كل الصفحات بما فيها الجديدة)، معلومات تواصل، سوشيال ميديا، الشعار الفاتح.
- **`floatingButtons.ts`**: زري واتساب/اتصال العائمين — راجع قسم 5.
- **`scrollReveal.ts`**: `initScrollReveal(container)` — يفعّل fade/slide-up لأي عنصر عليه `[data-reveal]` (اختياري: `[data-reveal-index]` للـ stagger). استخدمه لأي سكشن جديد يحتاج حركة دخول خفيفة بدل كتابة IntersectionObserver من الصفر.
- **`contactForm.ts`**: فورم تواصل عام — **الاسم والإيميل والهاتف حقول إلزامية**، فاليديشن بـ regex (`EMAIL_RE`, `PHONE_RE`)، الإرسال عبر `mailto:`.
- **`propertyRequestForm.ts`**: فورم طلب عقار مخصص — نفس نمط `contactForm.ts` (validate/setError/mailto) بس بحقول أكتر، **كل الحقول إلزامية بقرار من المستخدم**: الاسم، الإيميل، الهاتف، نوع العقار (غرفتين وصالون/ثلاثة وصالون/فيلا/أخرى)، **المدينة ثم المنطقة** (قائمتين منسدلتين متتاليتين — المنطقة تُعاد تعبيتها ديناميكياً عند اختيار المدينة، عبر `cityOptions` بـ `propertyRequestOptions.ts`)، جديد أو مستعمل، الميزانية (12 نطاق من 50 لـ600+ ألف دولار)، الطابق المفضل. حقل "تفاصيل إضافية" اختياري وحيد. **أي حقل select جديد بأي فورم لازم يستخدم نفس نمط `.form-field select` بـ`components.css`** (فيه سهم مخصص متكيف مع RTL جاهز).
- **`search.ts`**: بحث شامل (overlay) على المشاريع، مقالات المدونة، والصفحات، فلترة فورية. **أي صفحة/محتوى جديد لازم يُضاف هون كمان** حتى يظهر بالبحث.
- **`statCounter.ts`**: عداد أرقام متحرك (`IntersectionObserver`) — يحلل نص مثل `"12+"` أو `"60,000+ m²"` لـ prefix/number/suffix ويعمل count-up animation.
- **`projectCard.ts`**: بطاقة مشروع (صورة، حالة، موقع، إحصائية أساسية، زر "اكتشف المزيد").
- **`lightbox.ts`**: معرض صور بملء الشاشة مع تنقل بالكيبورد (أسهم، Escape).

## 8. حالة النشر (Deployment) — مهم جداً

- **الكود على GitHub**: مكتمل ومحفوظ 100%. فرع `main` هو المصدر الحي للموقع المنشور.
- **✅ النشر الناجح على Vercel**: مشروع **`kinci-byhadara`** — مربوط مباشرة بفرع `main` عبر `gitSource`، فيسحب الكود ويبنيه تلقائياً بدون أي رفع يدوي. **الطريقة الوحيدة الموثوقة** لنشر هذا المشروع — لا تحاول `create_deployment`/`upload_file` اليدوي، جُرّب سابقاً وفشل مراراً (تفاصيل تاريخية غير مهمة الآن).
  - الروابط: `kinci-byhadara.vercel.app` (الرابط الرئيسي المستخدم)، `kinci-byhadara-hadara1.vercel.app`، `kinci-byhadara-git-main-hadara1.vercel.app`
  - `ssoProtection` مفعّل على روابط المعاينة الفرعية (تفتح فقط لصاحب الحساب) — **بقرار من المستخدم متروك كما هو** لحد ما يربط دومين `hadararealestate.com` الرسمي بنفسه (الدومين المخصص يتجاوز الـ SSO تلقائياً).
  - **لا تلمس/تعدّل مشروع `hadararealestate` أو `byhadara` الأصلي على Vercel أبداً** (منفصل تماماً).
- **معاينة احتياطية على Artifact**: `https://claude.ai/artifact/XqiCPKwjHQXndH6pjbHde4` — قديمة (من أول نسخة بالمشروع)، ناقصة الصفحات/الميزات الجديدة. **مرجعية تاريخية فقط، غير محدّثة** — لا تعتمد عليها لعرض الحالة الحالية للموقع.

## 9. اعتبارات قبل الإطلاق الحقيقي (Production Checklist)

- [ ] نقل الصور من Wix لاستضافة/CDN خاص بالموقع الجديد (اعتماد خارجي حالياً)
- [ ] استبدال صور المدونة المولّدة بالـ AI بصور حقيقية لو توفرت (راجع قسم 4)
- [ ] ربط فورم التواصل وفورم طلب العقار بخدمة إرسال حقيقية (بدل `mailto:`)
- [ ] ربط الدومين الحقيقي `hadararealestate.com` (يقوم بها المستخدم نفسه)
- [ ] مراجعة SEO tags (title/description) لكل صفحة
- [ ] اختبار على أجهزة موبايل حقيقية (تم اختباره بـ Playwright فقط لحد الآن)

## 10. ملاحظات عامة للتعديل المستقبلي

- أي نص جديد فيه أرقام/تواريخ يظهر داخل سياق عربي RTL → لازم `dir="ltr"` على العنصر (راجع قسم 3).
- أي ترجمة جديدة لازم تُضاف بنفس الـ key في **الأربع ملفات JSON** (`en`, `ar`, `fr`, `ru`) للحفاظ على التطابق — تحقق بـ `node -e "JSON.parse(require('fs').readFileSync('src/i18n/<lang>.json','utf8'))"` على الأربعة بعد كل تعديل.
- الـ router بسيط ومباشر — أي صفحة جديدة تحتاج: إضافة route بـ `src/router.ts` (النوع + `parseHash` + `renderRoute`) + دالة render بـ `src/pages/` + ترجمات بالقواميس الأربعة + رابط بالهيدر (`NAV_LINKS` أو `NAV_RESOURCES` — راجع قسم 5) + رابط بالفوتر + إدخال بالبحث (`search.ts`).
- قبل اعتبار أي تعديل UI منتهي: بناء (`npm run build`)، تشغيل `vite preview`، وتصوير screenshots بـ Playwright (عربي/إنجليزي، عرض واسع/ضيق) — راجع الملاحظة الثابتة بأعلى الملف.
- Playwright chromium بهاي البيئة موجود بـ `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (مش المسار الافتراضي المتوقع من مكتبة playwright).
