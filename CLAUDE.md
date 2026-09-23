# CLAUDE.md — سياق مشروع HADARA Real Estate

هذا الملف مرجع كامل للمشروع، مخصص لأي محادثة جديدة مع Claude Code تشتغل على هذا الريبو. اقرأه أولاً قبل أي تعديل.

> **ملاحظة ثابتة من المستخدم**: هذا الريبو هو **المرجع الرسمي المعتمد** لـ "موقع حضارة الجديد". أي طلب تعديل مستقبلي على الموقع الجديد (نصوص، تصميم، مشاريع، صفحات...) يُنفَّذ هنا مباشرة.
> - **workflow التعديل**: اعمل تعديلاتك، commit + push. بما إن مشروع Vercel (`kinci-byhadara`) مربوط بفرع `main` عبر `gitSource`، أي push على `main` (أو أي PR يندمج فيه) بيعمل إعادة نشر تلقائي — **بدون رفع ملفات يدوي إطلاقاً**.
> - إذا كان التعديل بسيط ومباشر، ممكن تشتغل مباشرة على `main` (بعد `git pull` للتأكد إنك على آخر نسخة) وتـ push، أو تفتح فرع جديد وPR إذا كان تعديل أكبر — استخدم تقديرك حسب حجم التعديل.
> - **لا تلمس أبداً** مشاريع `hadararealestate` أو `byhadara` الأصلية على Vercel، ولا تربط أي دومين بـ `hadararealestate.com` من دون طلب صريح — المستخدم هو من سيقوم بربط الدومين الرسمي بنفسه.
> - **قاعدة ثابتة عن المحاذاة (alignment)**: أي تعديل أو إضافة (عنصر جديد بالهيدر، زر، قائمة، أي شي) **يجب** أن يُختبر بصرياً بعد التنفيذ (screenshot بالعربي والإنجليزي، وبعرض شاشة واسع وضيق) للتأكد إنه المحاذاة والمسافات لائقة ومتناسقة مع باقي الموقع — **قبل** اعتباره منتهي. لا تفترض إنه الكود سليم لأنه بنى بدون أخطاء؛ التنسيق البصري (centering، spacing، عدم التصاق العناصر بحافة) مسؤولية أساسية بكل تعديل، مش خطوة اختيارية.

## 1. نظرة عامة

موقع ويب حديث ومحترف لشركة **حضارة للتطوير العقاري (HADARA Real Estate)** — شركة تطوير عقاري في إسطنبول. المشروع بديل عصري لموقع Wix القديم (byhadara.com)، مبني من الصفر بـ **TypeScript + CSS خام** (بدون أي framework مثل React/Vue).

- **الريبو**: `kerimalastal-source/-kinci_BYHADARA`
- **الفرع الحالي**: `claude/peaceful-hypatia-rtg37p`
- **Pull Request**: #1 مفتوح على `main` (يحتوي كل الكود)
- **الحالة**: الكود مكتمل، مبني بنجاح محلياً (`npm run build` بدون أخطاء)، تم اختباره بـ Playwright بالعربي والإنجليزي.

## 2. المكدس التقني

- **Vite** (bundler) + **TypeScript** (بدون framework — DOM manipulation مباشر)
- **CSS خام** مقسّم لملفات منطقية (variables/base/layout/components/rtl)
- **Hash-based routing** (`#/`, `#/projects`, `#/projects/:slug`, `#/about`, `#/citizenship`, `#/contact`) — بدون مكتبة routing، كود يدوي في `src/router.ts`
- `package.json` build script: `"build": "tsc && vite build"`

## 3. اللغات (i18n) — 4 لغات كاملة

- **الإنجليزية (en)** — اللغة الافتراضية
- **العربية (ar)** — مع دعم RTL كامل
- **الفرنسية (fr)**
- **الروسية (ru)**

النظام في `src/i18n/`:
- `index.ts`: منطق الترجمة — `t(key)` (نص)، `tRaw<T>(key)` (بيانات خام كـ arrays/objects)، `getLocale()`/`setLocale()`/`onLocaleChange()`، حفظ اللغة بـ `localStorage` (`hadara-locale`)، وضبط `document.documentElement.dir` تلقائياً (`rtl` لو عربي).
- `en.json` / `ar.json` / `fr.json` / `ru.json`: قواميس ترجمة متطابقة البنية بالكامل — نفس الـ keys بكل اللغات، بما فيها `projectsData` (اسم/تاجلاين/وصف قصير وطويل/highlights لكل مشروع بكل لغة).
- زر تبديل اللغة بالـ header (`src/components/header.ts`).

### دعم RTL

- أغلب الـ layout يعتمد على **CSS logical properties** (`inset-inline-*`, `padding-inline-*`, `margin-inline-*`, `text-align: start/end`) فبينقلب أوتوماتيكياً مع `[dir="rtl"]`.
- `src/styles/rtl.css`: استثناءات فقط للعناصر الحساسة للاتجاه (أيقونات السهم بالـ back-link، أسهم الـ lightbox) عبر `transform: scaleX(-1)`.
- **مشكلة Bidi معروفة وتم حلها**: أي نص فيه أرقام إنجليزية (أرقام هاتف، مدى سنوات مثل "2022 – 2024"، قيم إحصائيات) يظهر معكوس بصرياً داخل سياق RTL. **الحل المطبّق**: إضافة `dir="ltr"` على كل عنصر يعرض رقم هاتف/إيميل/`project.timeline`/`stat.value`. لو أضفت رقم أو مدى تاريخ جديد بمكان جديد، **لازم** تعمل نفس الشي.

## 4. البيانات الحقيقية (من Wix)

تم استخراج كل المحتوى والصور من موقع Wix الأصلي "حضارة العقاري" عبر Wix Data API فعلياً — **ليست بيانات وهمية**.

- `src/data/projects.ts`: 5 مشاريع حقيقية بكل تفاصيلها (slug, district, city, status, timeline, stats, gallery images):
  1. `beylikduzu-living` (new-launch، تسليم 2028)
  2. `lotus-koru-2` (ongoing)
  3. `lotus-istanbul` (ongoing، مبنى متعدد الاستخدامات)
  4. `lotus-koru-1` (delivered)
  5. `marmara-haven-villa` (ongoing، فيلا خاصة)
- **الصور**: مستضافة على Wix مباشرة (`https://static.wixstatic.com/media/<mediaId>`)، مبنية عبر `wixImg()` في `src/utils/image.ts`. **هذه نقطة اعتماد على Wix خارجي** — لو حذفت الشركة الصور من حساب Wix الأصلي، الصور بتنكسر بالموقع الجديد. للـ production الحقيقي، الأفضل نزّل الصور ورفعها لـ CDN/استضافة خاصة بالموقع الجديد.
- بيانات التواصل الحقيقية: الإيميل `info@byhadara.com`، الهاتف `+90 531 930 92 14`، العنوان "Adnan Kahveci Mah., Beylikdüzü, Istanbul 34000, Türkiye".

## 5. نظام التصميم (Design System)

`src/styles/variables.css`:
- الألوان: أخضر غامق `--color-primary: #0f2b21` + ذهبي `--color-accent: #c9a24b` (هوية بصرية عقارية فاخرة)
- الخطوط: **Playfair Display** (عناوين، لاتيني) + **Noto Naskh Arabic** (عناوين عربي) + **Inter** (نص، لاتيني) + **Noto Kufi Arabic** (نص عربي) — كل الخطوط من Google Fonts
- الملفات: `variables.css` (متغيرات) → `base.css` (reset/typography) → `layout.css` (header/footer/hero) → `components.css` (كل الأجزاء: buttons, cards, forms, stats, gallery, lightbox, search...) → `rtl.css` (استثناءات RTL) — كلها مجمّعة بـ `main.css` عبر `@import`.

## 6. الصفحات (`src/pages/`)

| صفحة | ملف | ملاحظات |
|---|---|---|
| الرئيسية | `home.ts` | hero، إحصائيات متحركة، مشاريع مميزة، خدمات، لماذا حضارة، CTA للجنسية |
| المشاريع | `projects.ts` | فلترة حسب الحالة (all/new-launch/ongoing/delivered) |
| تفاصيل مشروع | `projectDetail.ts` | وصف كامل، highlights، معرض صور بـ lightbox، مشاريع أخرى مقترحة |
| من نحن | `about.ts` | قصة الشركة، رسالة/رؤية، قيم، timeline تاريخي، إحصائيات |
| الجنسية بالاستثمار | `citizenship.ts` | خطوات البرنامج، فوائد الجنسية التركية |
| تواصل معنا | `contact.ts` | فورم التواصل + معلومات التواصل + خريطة OpenStreetMap embed |
| 404 | `notFound.ts` | صفحة خطأ بسيطة |

## 7. المكونات (`src/components/`)

- **`header.ts`**: القائمة الرئيسية، تبديل اللغة، أيقونة البحث، CTA "تواصل معنا"، قائمة موبايل قابلة للطي.
- **`footer.ts`**: روابط سريعة، معلومات تواصل، سوشيال ميديا.
- **`contactForm.ts`**: فورم تواصل احترافي — **الاسم والإيميل والهاتف حقول إلزامية** (كما طلب المستخدم أصلاً)، فاليديشن بـ regex (`EMAIL_RE`, `PHONE_RE`)، الإرسال عبر `mailto:` (يفتح برنامج الإيميل المحلي — **ملاحظة production**: هذا حل بسيط لا يرسل الرسالة فعلياً من السيرفر؛ لو أردنا فورم حقيقي يحتاج backend/service مثل Formspree أو API خاص).
- **`search.ts`**: بحث شامل (overlay) على المشاريع والصفحات، فلترة فورية.
- **`statCounter.ts`**: عداد أرقام متحرك (`IntersectionObserver`) — يحلل نص مثل `"12+"` أو `"60,000+ m²"` لـ prefix/number/suffix ويعمل count-up animation.
- **`projectCard.ts`**: بطاقة مشروع (صورة، حالة، موقع، إحصائية أساسية، زر "اكتشف المزيد").
- **`lightbox.ts`**: معرض صور بملء الشاشة مع تنقل بالكيبورد (أسهم، Escape).

## 8. حالة النشر (Deployment) — مهم جداً

- **الكود على GitHub**: مكتمل ومحفوظ 100%. **PR #1 تم دمجه (merged) على فرع `main`** — فرع `main` الآن يحتوي كل كود الموقع الجديد.
- **معاينة تجربة على Artifact (تعمل فعلياً)**: `https://claude.ai/artifact/XqiCPKwjHQXndH6pjbHde4` — كل الوظائف شغالة (اللغات، البحث، الفورم، الصفحات) **إلا** الصور الحقيقية من Wix (محجوبة بسياسة CSP الخاصة بـ Artifact sandbox).
- **✅ النشر الناجح على Vercel (الحالة الحالية)**: مشروع **`kinci-byhadara`** على Vercel — مربوط مباشرة بفرع `main` على GitHub (`gitSource`)، فيسحب الكود ويبنيه تلقائياً بدون أي رفع يدوي. **`readyState: READY`** — الموقع شغال فعلياً ومؤكد من المستخدم.
  - الروابط: `kinci-byhadara.vercel.app`, `kinci-byhadara-hadara1.vercel.app`, `kinci-byhadara-git-main-hadara1.vercel.app`
  - لسا مفعّل عليه `ssoProtection` (حماية تسجيل دخول فيرسل) — يفتح فقط لصاحب الحساب المسجل دخول. **بقرار من المستخدم متروك كما هو** لأنه رح يربط دومين `hadararealestate.com` الرسمي بنفسه لاحقاً (عندها الدومين المخصص يتجاوز الـ SSO تلقائياً).
  - **لا تلمس/تعدّل مشروع `hadararealestate` أو `byhadara` الأصلي على Vercel أبداً** (منفصل تماماً عن هذا المشروع التجريبي).
- **محاولات نشر سابقة فاشلة (تاريخية، لمرجعية فقط)**: قبل الوصول للحل أعلاه، تمت عدة محاولات فاشلة (`hadara-site-v2`, `hadara-preview-1` إلى `hadara-preview-5`) برفع الملفات يدوياً عبر `create_deployment`/`upload_file` — كلها فشلت بالبناء (`readyState: ERROR`) بسبب غلطات برفع الملفات (مسارات غلط، أو ملفات ناقصة). **الدرس المستفاد**: الربط المباشر بـ GitHub (`gitSource`) هو الطريقة الصحيحة الوحيدة الموثوقة لنشر هذا المشروع على Vercel — لا تحاول رفع الملفات يدوياً مرة تانية.

## 9. اعتبارات قبل الإطلاق الحقيقي (Production Checklist)

- [ ] نقل الصور من Wix لاستضافة/CDN خاص بالموقع الجديد (اعتماد خارجي حالياً)
- [ ] ربط فورم التواصل بخدمة إرسال حقيقية (بدل `mailto:`)
- [ ] ربط الدومين الحقيقي `hadararealestate.com` (يقوم بها المستخدم نفسه)
- [ ] مراجعة SEO tags (title/description) لكل صفحة
- [ ] اختبار على أجهزة موبايل حقيقية (تم اختباره بـ Playwright فقط لحد الآن)

## 10. ملاحظات عامة للتعديل المستقبلي

- أي نص جديد فيه أرقام/تواريخ يظهر داخل سياق عربي RTL → لازم `dir="ltr"` على العنصر (راجع قسم 3).
- أي ترجمة جديدة لازم تُضاف بنفس الـ key في **الأربع ملفات JSON** (`en`, `ar`, `fr`, `ru`) للحفاظ على التطابق.
- الـ router بسيط ومباشر — أي صفحة جديدة تحتاج: إضافة route في `src/router.ts` + دالة render في `src/pages/` + ترجمات جديدة بالقواميس الأربعة.
