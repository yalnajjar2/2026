# 🚀 دليل رفع منصة مشروعي على GoDaddy
## النسخة 4.2 — آخر تحديث: 2026-04-30

---

## 📋 نظرة عامة على المشروع

**اسم المنصة:** مشروعي (Mashrooi)  
**النوع:** موقع ثابت (Static Website / SPA)  
**اللغة:** عربي (RTL)  
**الإصدار:** 4.2  
**الشركة:** تمزا القابضة — Tamza Holding

---

## 📁 هيكل الملفات الكاملة

```
mashrooi-website/
│
├── index.html              ← الصفحة الرئيسية (SPA)
├── 404.html                ← صفحة الخطأ المخصصة
├── .htaccess               ← إعدادات Apache لـ GoDaddy
├── robots.txt              ← تعليمات محركات البحث
├── sitemap.xml             ← خريطة الموقع
│
├── css/
│   ├── fonts.css           ← خطوط Cairo وTajawal (محلي)
│   ├── fontawesome.min.css ← أيقونات Font Awesome (محلي)
│   ├── variables.css       ← متغيرات CSS
│   ├── navbar.css          ← شريط التنقل
│   ├── homepage.css        ← تصميم الصفحة الرئيسية
│   ├── dashboard.css       ← لوحات التحكم
│   ├── pages.css           ← الصفحات الداخلية
│   ├── advanced-features.css← المزايا المتقدمة
│   ├── product-detail.css  ← صفحة تفاصيل المنتج
│   └── sme-stores.css      ← صفحة متاجر الشركات
│
├── js/
│   ├── app.js              ← التطبيق الرئيسي
│   ├── products-database.js← قاعدة بيانات المنتجات
│   ├── pages.js            ← محتوى الصفحات
│   ├── dashboard.js        ← لوحات التحكم
│   ├── kyc.js              ← التحقق من الهوية
│   ├── product-management.js← إدارة المنتجات
│   ├── product-detail.js   ← تفاصيل المنتج
│   └── sme-stores.js       ← متاجر الشركات الصغيرة
│
├── webfonts/               ← خطوط Font Awesome المحلية
│   ├── fa-solid-900.woff2
│   ├── fa-regular-400.woff2
│   └── fa-brands-400.woff2
│
└── images/
    └── mashroie-logo.png   ← شعار المنصة
```

---

## 🛠️ متطلبات الاستضافة على GoDaddy

### نوع الاستضافة المطلوبة:
- ✅ **Shared Hosting (Linux/cPanel)** — الأنسب والأرخص
- ✅ **WordPress Hosting** (يعمل كـ HTML عادي)
- ✅ **Business Hosting**
- ❌ Windows Hosting — **لا يدعم .htaccess**

### المتطلبات التقنية:
| المتطلب | المطلوب |
|---------|---------|
| PHP | غير مطلوب |
| MySQL | غير مطلوب |
| Apache | مطلوب (للـ .htaccess) |
| mod_rewrite | مطلوب (لتوجيه SPA) |
| mod_deflate | مُفضَّل (للضغط) |
| mod_expires | مُفضَّل (للتخزين المؤقت) |
| SSL | مطلوب (HTTPS) |

---

## 📤 خطوات الرفع على GoDaddy

### الطريقة 1: رفع عبر File Manager (cPanel) — الأسهل

1. **سجّل دخولك** على GoDaddy → My Products → Hosting → Manage
2. **افتح cPanel** → File Manager
3. **انتقل إلى** `public_html/` (الجذر)
4. **احذف** أي ملفات موجودة مسبقاً (cgi-bin يمكن إبقاؤه)
5. **ارفع الملفات**:
   - انقر **Upload** → اختر جميع الملفات من جهازك
   - أو اضغط **Upload** ثم اسحب وأفلت الملفات
6. **تحقق من الرفع**:
   - يجب أن يكون `index.html` في `/public_html/index.html`
   - مجلد `css/` في `/public_html/css/`
   - مجلد `js/` في `/public_html/js/`
   - مجلد `webfonts/` في `/public_html/webfonts/`
   - مجلد `images/` في `/public_html/images/`

### الطريقة 2: رفع عبر FTP (للمحترفين)

**بيانات FTP من GoDaddy:**
- عنوان FTP: `ftp.yourdomain.com` أو `IP of your server`
- اسم المستخدم: حساب cPanel
- كلمة المرور: كلمة مرور cPanel
- المنفذ: `21` (FTP) أو `22` (SFTP)

**استخدام FileZilla:**
```
Host: ftp.yourdomain.com
Username: your-cpanel-username
Password: your-cpanel-password
Port: 21
```

ارفع كل الملفات إلى `/public_html/`

### الطريقة 3: رفع عبر Git (GoDaddy Git Deployment)

إذا كان لديك خطة Business/Pro:
```bash
git init
git add .
git commit -m "Mashrooi Platform v4.2"
git remote add godaddy ssh://user@yourdomain.com/~/repo.git
git push godaddy main
```

---

## ⚙️ إعداد .htaccess

الملف موجود مسبقاً ومُهيَّأ. تأكد من:

```apache
# توجيه SPA
RewriteRule ^ /index.html [L]

# إعادة توجيه HTTPS (فعّل بعد تنصيب SSL)
RewriteCond %{HTTPS} off
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

> ⚠️ **تحذير:** إذا لم يكن لديك شهادة SSL بعد، احذف سطري إعادة التوجيه إلى HTTPS مؤقتاً.

---

## 🔐 تفعيل شهادة SSL المجانية (Let's Encrypt)

1. cPanel → **SSL/TLS Status**
2. انقر **Run AutoSSL**
3. انتظر 5-10 دقائق
4. تحقق بزيارة `https://yourdomain.com`

---

## 🌐 ربط النطاق (Domain)

إذا اشتريت النطاق من GoDaddy:
- يُربط تلقائياً مع الاستضافة

إذا كان النطاق من مزوّد آخر، غيّر DNS:
```
A Record:  @    →  IP_of_GoDaddy_Server
CNAME:     www  →  yourdomain.com
```

---

## 🔧 استكشاف الأخطاء

### الموقع يظهر صفحة بيضاء:
- تحقق أن `index.html` في `/public_html/` مباشرة
- تحقق أن الملفات CSS/JS تم رفعها بنفس الهيكل

### خطأ 500 Internal Server Error:
- مشكلة في `.htaccess`
- امسح ملف `.htaccess` مؤقتاً وأعد المحاولة
- تواصل مع GoDaddy Support

### الأيقونات لا تظهر (Font Awesome):
- تحقق أن مجلد `webfonts/` موجود في `/public_html/webfonts/`
- تحقق أن ملفات `fa-solid-900.woff2` و`fa-regular-400.woff2` و`fa-brands-400.woff2` موجودة

### الخطوط العربية لا تظهر:
- تحقق أن `css/fonts.css` مرفوع
- إذا لم يعمل Bunny Fonts، عدّل `css/fonts.css` واستبدل بـ Google Fonts:
```css
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&display=swap');
```

### المسارات لا تعمل (SPA navigation):
- تأكد أن ملف `.htaccess` تم رفعه
- في GoDaddy cPanel → تأكد أن AllowOverride مفعّل

---

## 📊 أداء الموقع

| الملف | الحجم |
|-------|-------|
| index.html | ~62 KB |
| css/fontawesome.min.css | ~100 KB |
| js/pages.js | ~122 KB |
| js/products-database.js | ~82 KB |
| js/dashboard.js | ~84 KB |
| images/mashroie-logo.png | ~79 KB |

**إجمالي المشروع:** ~800 KB (قبل الضغط)  
**بعد ضغط GZIP:** ~200-250 KB

---

## 🔄 تحديث الموقع لاحقاً

لتحديث الموقع:
1. عدّل الملفات محلياً
2. ارفع الملفات المعدّلة فقط عبر cPanel أو FTP
3. **لا حاجة لإعادة رفع كل شيء**

لمسح ذاكرة التخزين المؤقت:
- أضف `?v=4.3` لروابط CSS/JS في index.html

---

## 📞 معلومات التواصل

- **البريد الإلكتروني:** info@mshroue.com
- **الهاتف:** 800800800
- **واتساب:** 773880066

---

## ✅ قائمة التحقق قبل الإطلاق

- [ ] تم رفع جميع الملفات
- [ ] الموقع يفتح بـ http://yourdomain.com
- [ ] تم تفعيل SSL وشغّال بـ https://yourdomain.com
- [ ] إعادة توجيه HTTP→HTTPS تعمل
- [ ] الأيقونات تظهر بشكل صحيح
- [ ] الخطوط العربية تظهر بشكل صحيح
- [ ] التنقل بين الصفحات يعمل
- [ ] الموقع يعمل على الجوال
- [ ] صفحة 404 تظهر للروابط غير الصحيحة
- [ ] سرعة الموقع مقبولة (اختبر على PageSpeed Insights)

---

*آخر تحديث: 2026-04-30 | الإصدار 4.2 | منصة مشروعي*
