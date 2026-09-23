# CLAUDE.md — سياق مشروع HADARA Real Estate

هذا الملف مرجع كامل للمشروع، مخصص لأي محادثة جديدة مع Claude Code تشتغل على هذا الريبو. اقرأه أولاً قبل أي تعديل.

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

- **الكود على GitHub**: مكتمل ومحفوظ 100% (commit + push على الفرع أعلاه، PR #1 مفتوح).
- **معاينة تجربة على Artifact (تعمل فعلياً)**: `https://claude.ai/artifact/XqiCPKwjHQXndH6pjbHde4` — كل الوظائف شغالة (اللغات، البحث، الفورم، الصفحات) **إلا** الصور الحقيقية من Wix (محجوبة بسياسة CSP الخاصة بـ Artifact sandbox).
- **محاولات Vercel**: عدة محاولات نشر على Vercel كمعاينة مؤقتة (منفصلة تماماً عن `hadararealestate.com` بناءً على طلب صريح من المستخدم — **لا تلمس/تعدّل مشروع `hadararealestate` أو `byhadara` الأصلي على Vercel أبداً**). واجهنا مشكلتين تقنيتين:
  1. **SSO Protection**: كل مشاريع فريق Vercel محمية بتسجيل دخول تلقائي (`ssoProtection.deploymentType: "all_except_custom_domains"`) — الحل: `update_project` مع `ssoProtection: null`.
  2. **فشل البناء (`readyState: ERROR`, `errorCode: ENOENT`)**: سببه غلطة برفع الملفات يدوياً عبر `create_deployment` — الملفات انزرعت تحت مجلد `src/` إضافي زايد، فـ Vercel ما لقى `package.json` بالجذر. **الحل الصحيح**: رفع الملفات بمساراتها الصحيحة (بدون أي بريفكس إضافي) — الجذر لازم يحتوي مباشرة على `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`, `public/favicon.svg`, ومجلد `src/` بمحتوياته الحقيقية.
  - **قرار مهم للمستقبل**: بدل رفع 34 ملف يدوياً (عملية بطيئة وعرضة للغلط)، **الطريقة الصحيحة والأسهل** هي ربط مشروع Vercel مباشرة بفرع GitHub (`claude/peaceful-hypatia-rtg37p`) عن طريق `gitSource`، فيسحب فيرسل الملفات مباشرة من GitHub بدون رفع يدوي إطلاقاً — هذا يحل مشكلة الملفات الناقصة/المسارات الغلط نهائياً.
- **قرار المستخدم الصريح (يجب الالتزام به)**: أي نشر تجريبي على Vercel هو **مؤقت فقط** لغرض المعاينة. المستخدم لا يريد ربطه بـ `hadararealestate.com` — هو بنفسه رح يعمل الربط بعد ما يراجع الواجهة ويتأكد إنها ممتازة.

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
