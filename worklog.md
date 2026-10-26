# Worklog

---
Task ID: 1
Agent: main (Z.ai)
Task: تحويل برنامج سطح المكتب "قائمتي" (MyList_V9 — Python/Tkinter) إلى موقع ويب تفاعلي كامل (Next.js) بنفس كل الميزات، بستايل تركواز فاتح جديد وبدون تسجيل دخول، مع حفظ البيانات في قاعدة بيانات الموقع.

Work Log:
- استخراج وفحص MyList_V9.zip: قراءة PROJECT_HANDOFF.md + اقرأني README + core.py (1959 سطر) + scraper.py + theme.py — فهم كامل لنموذج البيانات (works/seasons/episodes/servers) والمنطق (تطبيع embed، اللصق الذكي fill_smart، توحيد النص العربي norm_text، بصمة التصدير work_signature md5، بناء SQL لقاعدة vibehub، الاستخراج scraper، المصادر TMDB/TVmaze/iTunes/ويكيبيديا/Jikan).
- تهيئة بيئة fullstack (Next.js 16 + Prisma/SQLite + shadcn/ui).
- قاعدة البيانات (prisma/schema.prisma): Work/Season/Episode/Server/Setting/StoredImage — بنفس الحقول الزملاء (sid, expSig, metaLocked, posterLocal, sourceUrl...) + db:push.
- مكتبة المنطق src/lib/mylist/: urls.ts (EMBED_RULES الـ11 قاعدة + servers هو الأصل/link متزامن)، text.ts (normText + fillSmart بالأرقام العربي)، signature.ts (pyJsonStringify متوافق byte-for-byte مع json.dumps + js-md5)، sqlbuilder.ts (buildSql T-SQL/MySQL مطابق)، logic.ts (validate/metadata/normalize)، types.ts.
- سيرفر: providers.ts (كل المصادر + imageSearch + checkUrl مع كاش TTL)، scraper.ts (HTMLParser tokenizer + نفس قواعد الحلقات/السيرفرات + applyToSeason)، store.ts (CRUD كامل + استيراد/تصدير backup بصيغة my_list_data.json).
- 12 API route: works CRUD، search، details، metadata، image-search، images (رفع/مكتبة/عرض)، scraper، export-sql (مع تعليم expSig/sid)، check-links، backup، settings.
- الواجهة RTL تركواز فاتح: TopBar (بحث مباشر + أدوات)، MyListView (بطاقات + شرائح تصنيف + حالات جديد/معدّل/متصدّر)، ResultsView (سكلتون + إضافة للقائمة)، WorkView (هيدر + مواسم + جدول حلقات + لصق سريع)، و13 نافذة: إضافة يدوي (جلب تلقائي)، بيانات العمل (قفل الحقول)، اختيار الصورة (بحث/رفع/مكتبة/لينك)، السيرفرات (ترتيب/قفل/فحص/تجربة)، لصق ذكي، استخراج من موقع (سجل ملون + تطبيق)، إعدادات، تصدير SQL (فحص مسبق + معاينة + تنزيل)، تحديث بيانات تلقائي (مراجعة قبل التطبيق)، معاينة سيرفرات (iframes بتبويبات)، فحص لينكات، تقرير، نسخ احتياطي/دمج، شرح.
- إصلاح 3 مشاكل بيئة: (1) Toaster خارج body → hydration error؛ (2) IPv4 egress timings في Node → instrumentation.ts بيفعّل setDefaultAutoSelectFamily (Happy Eyeballs IPv6)؛ (3) ويكيبيديا 403 → UA متوافق مع سياسة Wikimedia.
- إصلاح منطقي مهم: link بيتعيد بناؤه من السيرفرات عند القراءة من القاعدة (هي الأصل) — بدونه البصمة والحلقات بتبوظ بعد أول save.
- اختبارات ناجحة: بصمة TS = بصمة بايثون بالبايت (c8ae0aabc85256b98b3a61721c12342a) — استيراد بيانات قديمة يفضل «متصدّر»؛ اللصق الذكي (حلقة/EP/أرقام عربي/فصل بأسطر/توزيع بالترتيب)؛ تحويل embed للـ10 مواقع؛ الاستخراج على موقع fixture محلي (3 حلقات × 4 سيرفرات، تجاهل iframe داخل script)؛ البحث العربي (17 نتيجة) والإنجليزي؛ فحص لينكات حي (200/403/404)؛ تصدير SQL سليم (تحقق base64)؛ استيراد نسخة برنامج أصلي؛ تعليم «متصدّر» بعد التصدير.
- تحقق بالمتصفح (agent-browser): لا أخطاء console، المسار الكامل: إضافة يدوي → لصق ذكي → سيرفرات → فحص → تصدير → متصدّر؛ بحث حي + إضافة One Piece بمواسم وأسماء حلقات حقيقية (1181 حلقة)؛ استخراج وتطبيق (12 سيرفر اتضاف)؛ موبايل متجاوب؛ footer لاصق.

Stage Summary:
- الموقع جاهز بالكامل على المسار "/" — كل ميزات البرنامج الأصلي موجودة، بستايل تركواز فاتح جديد، بدون تسجيل دخول، والبيانات محفوظة في SQLite عبر Prisma.
- أهم قرار تصميمي: servers هو مصدر الحقيقة في القاعدة مع إعادة بناء link المتزامن عند القراءة — يضمن توافق البصمة مع ملفات البرنامج الأصلي 100%.
- ملفات الاختبار في scripts/ (test_sql, test_sig, test_paste, test_scrape, test_state2, test_api_state) والفيكستر في scripts/fixture/.
