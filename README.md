# منصة مشروعي — Mashrooi Platform
## الإصدار v9.0 | نظام البوابات الموحد + لوحة المانحين الكاملة

---

## رؤية المنصة
منصة رقمية يمنية متكاملة تقود رائد الأعمال في رحلة موحدة:
```
ابدأ مشروعك → اختر حزمة → تجهيز المعدات → التحقق (KYC) → التمويل → الدفع → الشحن → التشغيل
```

---

## ✅ الأولويات الست — حالة الإنجاز

| الأولوية | الوصف | الحالة |
|----------|-------|--------|
| #1 | توحيد البوابات في حساب واحد متعدد الأدوار | ✅ مكتمل — `unified-auth.js` |
| #2 | بناء Backend آمن بدل JavaScript/localStorage | ⚠️ Static site — غير قابل للتنفيذ |
| #3 | إعادة تصميم الصفحة الرئيسية حول "ابدأ مشروعك" | ✅ مكتمل — `handleStartProject()` |
| #4 | تحويل المنتجات إلى حزم مشاريع جاهزة | ✅ مكتمل — 6 حزم في `project-wizard.js` |
| #5 | فصل المانحين والمنح كمرحلة لاحقة | ✅ مكتمل — حُذف من navbar |
| #6 | بناء لوحة إدارة عمليات حقيقية | ✅ **مكتمل v8.0** — `dashboard-admin-ops.js` |

---

## 📁 ملفات المشروع الرئيسية

### JavaScript — النواة
| الملف | الحجم | الوصف |
|-------|-------|-------|
| `js/unified-auth.js` | 15KB | نظام مصادقة موحد v7.0 — حساب واحد متعدد الأدوار |
| `js/project-wizard.js` | 55KB | Wizard رحلة المشروع 7 خطوات |
| `js/dashboard-admin-ops.js` | **90KB** | **لوحة عمليات الإدارة v8.0 — جديد** |
| `js/dashboard.js` | 173KB | لوحات التحكم الرئيسية (customer/supplier/finance/admin) |
| `js/dashboard-customer.js` | 62KB | لوحة تحكم العميل v6.0 |
| `js/dashboard-supplier.js` | 47KB | لوحة تحكم المورد v6.0 |
| `js/dashboard-finance.js` | 39KB | لوحة تحكم التمويل v6.0 |
| `js/dashboard-logistics.js` | 29KB | لوحة تحكم اللوجستيك |
| `js/app.js` | 27KB | التطبيق الرئيسي + navigation |
| `js/pages.js` | 140KB | محتوى الصفحات العامة |
| `js/portal-auth.js` | 33KB | نظام مصادقة البوابات |
| `js/admin-auth.js` | 17KB | نظام مصادقة الإدارة |
| `js/kyc.js` | 121KB | نظام التحقق من الهوية (KYC) |
| `js/payment.js` | 64KB | بوابة الدفع WeNet |
| `js/home-live.js` | 25KB | البيانات الحية للصفحة الرئيسية |
| `js/product-management.js` | 27KB | إدارة المنتجات |
| `js/portals.js` | 31KB | نظام البوابات القديم |

### HTML — الصفحات
| الملف | الوصف |
|-------|-------|
| `index.html` | الصفحة الرئيسية الموحدة (97KB) |
| `portal-customer.html` | بوابة العميل (legacy + backward compat) |
| `portal-supplier.html` | بوابة المورد (legacy) |
| `portal-finance.html` | بوابة التمويل (legacy) |
| `portal-donor.html` | بوابة المانح (مرحلة لاحقة) |
| `admin-login.html` | صفحة دخول الإدارة |
| `payment-gateway.html` | بوابة الدفع WeNet المستقلة |

---

## 🗄️ جداول قاعدة البيانات (18 جدول)

### المستخدمون والمصادقة
| الجدول | الوصف | السجلات |
|--------|-------|---------|
| `portal_users` | مستخدمو المنصة الموحدون | 5 (3 نشط + 2 انتظار) |
| `portal_sessions` | الجلسات النشطة | — |
| `portal_activity_log` | سجل نشاط المستخدمين | — |
| `admin_users` | يوزرات الإدارة | — |
| `admin_activity_log` | سجل نشاط الإدارة | — |

### KYC والامتثال
| الجدول | الوصف |
|--------|-------|
| `kyc_customers` | بيانات KYC العملاء (46 حقل) |
| `kyc_suppliers` | بيانات KYC الموردين (54 حقل) |
| `kyc_finance_partners` | بيانات KYC شركاء التمويل (57 حقل) |

### المنتجات والطلبات
| الجدول | الوصف | السجلات |
|--------|-------|---------|
| `platform_products` | منتجات المنصة | — |
| `platform_orders` | طلبات الشراء | **7** |
| `finance_products` | منتجات التمويل | 5 |
| `financing_applications` | طلبات التمويل | **6** |
| `logistics_shipments` | الشحنات | — |

### الخدمات والمنح
| الجدول | السجلات |
|--------|---------|
| `service_catalog` | 8 خدمات |
| `service_requests` | — |
| `grants_projects` | — |
| `donors` | — |
| `beneficiaries` | — |

---

## 🛣️ رحلة المستخدم الموحدة

```
index.html
    ↓
[handleStartProject()]
    ↓ جلسة موجودة؟
   / \
نعم   لا
 ↓     ↓
[showProjectWizard()]  [_showUnifiedAuthModal()]
                              ↓
                    [Login / Register]
                              ↓
                    [ua_redirectAfterLogin()]
                              ↓
                    [index.html?page=dashboard-X&wizard=1]
                              ↓
                    [Project Wizard 7 خطوات]
```

---

## 🔑 بيانات الدخول التجريبية

### مستخدمو المنصة (portal_users)
| الحساب | كلمة المرور | الدور | الحالة |
|--------|------------|-------|--------|
| `customer@test.com` | `Test@1234` | عميل | ✅ نشط |
| `supplier@test.com` | `Supplier@1234` | مورد | ✅ نشط |
| `finance@test.com` | `Finance@1234` | شريك تمويل | ✅ نشط |
| `pending.user@test.com` | `Test@1234` | عميل | ⏳ انتظار الموافقة |
| `pending.supplier@test.com` | `Supplier@1234` | مورد | ⏳ انتظار الموافقة |

### مدراء النظام (admin_users)
> يُسجّل الدخول من `admin-login.html`
> أنشئ حساب إدارة من لوحة التحكم → قسم "إدارة الأدمنز"

---

## ⚡ لوحة عمليات الإدارة v8.0 — الجديد

`js/dashboard-admin-ops.js` (90KB) — Priority #6 المكتملة

### الصفحات الجديدة في لوحة الإدارة:

#### 1. الموافقات الموحدة (`admin-unified-approvals`)
- **3 tabs**: المستخدمون / المنتجات / منتجات التمويل
- اعتماد/رفض مع ملاحظات وتحديث DB فوري
- Badge عداد في الـ sidebar
- Modal تفاصيل المستخدم قبل القرار

#### 2. لوحة المخاطر (`admin-risk-board`)
- تقييم مخاطر ديناميكي لكل مستخدم
- **عوامل المخاطرة**: sanctions_check + pep_status + failed_attempts + previous_disputes + KYC غير مكتمل
- مخطط Doughnut توزيع المخاطر
- 4 مستويات: حرج / مرتفع / متوسط / منخفض

#### 3. تتبع الطلبات (`admin-orders-ops`)
- Timeline كامل لكل طلب مع تاريخ كل مرحلة
- تقديم الطلب عبر مراحله (pending→confirmed→processing→shipped→delivered)
- إلغاء الطلبات مع تسجيل في النشاط
- فلتر حسب الحالة

#### 4. طلبات التمويل (`admin-financing-apps`)
- قائمة طلبات `financing_applications`
- تقديم الطلب (pending→under_review→approved→disbursed)
- رفض مع سبب
- Progress bar لكل طلب

#### 5. تحليلات العمليات (`admin-ops-analytics`)
- إحصائيات حية من DB (users/orders/financing/shipments)
- مخطط توزيع المستخدمين (Doughnut)
- مخطط حالة الطلبات (Bar)
- مؤشرات الأداء (معدل التسليم/القبول/النشاط)

#### 6. الإحصائيات الحية في Overview
- 4 KPI cards حية من DB (المستخدمون/الطلبات/الإيرادات/الشحنات)
- تنبيهات تستلزم إجراءاً فورياً (clickable)
- مؤشرات العمليات السريعة (6 مؤشرات)
- تحديث تلقائي كل 90 ثانية

---

## 🔗 روابط المنصة الرئيسية

| الرابط | الوصف |
|--------|-------|
| `index.html` | الصفحة الرئيسية |
| `index.html?page=dashboard-customer` | لوحة العميل |
| `index.html?page=dashboard-supplier` | لوحة المورد |
| `index.html?page=dashboard-finance` | لوحة التمويل |
| `index.html?page=dashboard-admin` | لوحة الإدارة |
| `index.html?page=dashboard-customer&wizard=1` | لوحة العميل + Wizard |
| `admin-login.html` | دخول الإدارة |
| `payment-gateway.html` | بوابة الدفع WeNet |

---

## 📊 نسب الإنجاز

| المرحلة | الإصدار | النسبة |
|---------|---------|--------|
| v6.0 (قبل التوحيد) | KYC + لوحات + دفع | 65% |
| v7.0 (التوحيد) | Wizard + Auth موحد + Homepage | 80% |
| **v8.0 (العمليات)** | **لوحة الإدارة الحقيقية** | **92%** |

---

## ✅ الإنجازات الأخيرة (v9.0 — مايو 2025)

### ما أُكمل في جلسة v9.0 — البوابات الموحدة + لوحة المانحين:

| # | التعديل | الملف | الحالة |
|---|---------|-------|--------|
| 1 | نظام البوابات الموحد — 4 بوابات كاملة داخل SPA | `js/portals-unified.js` (51KB) | ✅ جديد |
| 2 | بوابة المورد — 12 نوع توريد بتصميم مخصص + KYC | `portals-unified.js` | ✅ جديد |
| 3 | بوابة المؤسسة المالية — 7 أنواع + ترخيص + محفظة | `portals-unified.js` | ✅ جديد |
| 4 | بوابة المانح — 6 أنواع + مشاريع + مستفيدون | `portals-unified.js` | ✅ جديد |
| 5 | لوحة تحكم المانح الكاملة — 6 صفحات داخلية | `js/dashboard-donor.js` (52KB) | ✅ جديد |
| 6 | صفحة هبوط جميع البوابات `page-portals` | `js/portals-unified.js` | ✅ جديد |
| 7 | تحديث navbar — قائمة بوابات موحدة تستخدم openPortal() | `index.html + home-live.js` | ✅ محدّث |
| 8 | تحديث صفحة الشركاء — أزرار تفتح البوابة الصحيحة | `js/pages.js` | ✅ محدّث |
| 9 | إصلاح صفحة الخدمات — كل أزرار التسجيل تفتح openPortal() | `js/pages.js` | ✅ محدّث |
| 10 | لوحة المانح في PROTECTED_PAGES + استدعاء donor_init() | `js/app.js` | ✅ محدّث |
| 11 | جداول DB: donor_projects (6 مشاريع) + beneficiaries (6 مستفيدين) | DB | ✅ مملوء |
| 12 | اختبار Playwright — 21 صفحة — 0 أخطاء | — | ✅ نجح |

### البوابات الأربع — المميزات الرئيسية:

**🚀 بوابة العملاء**: حقول أساسية + اختيار مشروع من 6 حزم → Wizard تلقائياً
**🏭 بوابة الموردين**: 12 نوع توريد (مصانع/تجار/لوجستيك/استشارات/تقنية/صيانة/...) + نبذة تجارية
**🏦 بوابة المؤسسات المالية**: 7 أنواع + رقم الترخيص + حجم المحفظة
**💚 بوابة المانحين**: 6 أنواع مانح + دولة + ميزانية → لوحة تحكم مستقلة

### لوحة تحكم المانح — الصفحات الست:
- **نظرة عامة**: KPIs حية + مشاريع تحتاج دعم + منحي الأخيرة
- **مشاريع تحتاج دعم**: تصفّح + تصفية + زر دعم مباشر
- **منحي المقدمة**: جدول شامل بكل المنح
- **المستفيدون**: بطاقات مفصلة مع احتياجات كل مستفيد
- **التقارير**: Chart.js doughnut + سجل زمني
- **الإعدادات**: بيانات الحساب + إعدادات الإشعارات

### تفاصيل التعديل الأهم — `_submitOrder()` في `project-wizard.js`:
عند إكمال الـ Wizard باختيار تمويل، يُنشأ تلقائياً سجل في `financing_applications`:
```javascript
if (WIZ.finance && WIZ.finance.id !== 'cash') {
  // POST → tables/financing_applications
  // customer_id, finance_product_id, requested_amount_usd, purpose, status:'pending'
  // WIZ.finAppId ← يُحفظ لاستخدامه لاحقاً
}
```

---

## 🚀 ما تبقى (مرحلة لاحقة — خارج نطاق static site)

1. **Backend آمن** — يحتاج Node.js/Python server
2. **إشعارات email** — عند الموافقة/الرفض للمستخدمين
3. **لوحة اللوجستيك** — ربط أعمق مع `logistics_shipments`
4. **تقارير PDF** قابلة للتصدير
5. **نظام المانحين** — `donors` + `grants_projects` + `beneficiaries`

---

## ⚙️ القيود التقنية

- **Static Site**: لا server-side processing — كل العمليات client-side + RESTful Table API
- **كلمات المرور**: hash بسيط (djb2) — في الإنتاج يحتاج bcrypt server-side
- **الجلسات**: localStorage مع TTL 8 ساعات — ليس httpOnly cookie

---

*آخر تحديث: مايو 2025 — v9.0 — 21 صفحة · 4 بوابات موحدة · لوحة مانحين كاملة · 0 أخطاء*
