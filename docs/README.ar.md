<p align="right">  
  <a href="#downloads"><img src="https://user-images.githubusercontent.com/8535921/189104931-527ab8bc-8757-4e04-8150-5207d2077bb8.png" title="linux"></a>
  <a href="#downloads"><img src="https://user-images.githubusercontent.com/8535921/189104940-ade062d9-d2e0-4e08-83a4-f34cdb457025.png" title="windows"></a>
  <a href="#license"><img src="https://user-images.githubusercontent.com/8535921/189119543-b1f7cc20-bd0e-44e7-811a-c23b0ccdf767.png" title="open source"></a>
  <a href="http://www.binarynonsense.com/"><img src="https://user-images.githubusercontent.com/8535921/189104953-7ac2d4d1-7d36-483b-8cc9-3568d1cbf6e5.png" title="my website"></a>
  <a href="https://mastodon.social/@binarynonsense"><img src="https://github.com/binarynonsense/comic-book-reader/assets/8535921/053fff88-5e38-4928-8b50-9ecaf1be20f1" title="my mastodon"></a>
</p>

# ACBR - Comic Book Reader

قارئ للكتب المصورة ومحول لملفات CBZ و CBR و CB7 و EPUB و PDF.

![git_banner](https://github.com/binarynonsense/comic-book-reader/assets/8535921/a8a7f902-4445-4695-9bc0-bbae4cba78f2)

<p align="center">
  <a href="./README.en.md">English</a> | 
  <a href="./README.es.md">Español</a> | 
  <a href="./README.ru.md">Русский</a> | 
  <a href="./README.de.md">Deutsch</a> | 
  <span>العربية</span>
</p>

## المحتويات:

- [الميزات](#الميزات)
- [التنزيل](#التنزيل)
- [المساهمات](#المساهمات)
- [الترخيص](#الترخيص)
- [غير ذلك](#غير-ذلك)

## الميزات:

- إصدارات لـ ويندوز ولينكس.
- تنسيقات الملفات المتوافقة<sup>[1]</sup>:
  - الكتب المصورة: CBZ و CBR و CB7 و PDF و EPUB<sup>[2]</sup>
  - ملفات الصور: JPG و PNG و WebP و AVIF
  - الكتب الإلكترونية: PDF و EPUB<sup>[3]</sup>
- متوفر في وضعين: وضع واجهة مستخدم بسيطة و وضع ملء الشاشة (بدون عناصر واجهة المستخدم).
- عرض الصفحة حسب الخصائص التالية: 'مطابق لعرض الشاشة' أو 'مطابق لارتفاع الشاشة' أو 'بالتناسب مع ارتفاع الشاشة'.
- تدوير الصفحة.
- واجهة المستخدم متاحة في:
  - الإنجليزية والإسبانية والروسية والألمانية والعربية.
- استعادة آخر كتاب وصفحة تم فتحها في الجلسة السابقة تلقائيًا، وتذكر مواضع صفحات الكتب الأخيرة.
- الوضع المحمول (عن طريق إنشاء ملف باسم portable.txt في نفس المجلد الذي يحتوي على الملف القابل للتنفيذ).
- محرر البيانات الوصفية:
  - عرض البيانات الوصفية في ملفات PDF و EPUB أو البيانات الوصفية المخزنة في ملفات ComicInfo.xml داخل الكتب المصورة من نوع CBR و CBZ و CB7.
  - إنشاء و/أو تعديل البيانات الوصفية في ملفات PDF و EPUB أو البيانات الوصفية المخزنة في ملفات ComicInfo.xml داخل الكتب المصورة غير المشفرة من نوع CBR<sup>[4]</sup> و CBZ و CB7.
  - البحث عن البيانات الوصفية للكتب المصورة واستيرادها من Comic Vine (يتطلب توفر [مفتاح واجهة برمجة تطبيقات (API) من Comic Vine](https://comicvine.gamespot.com/api/))
- مشغل صوت متكامل:
  - يدعم ملفات MP3 و Ogg و WAV و M3U و M3U8.
  - إمكانية تصدير قوائم التشغيل إلى ملفات M3U.
- الأدوات:
  - تحويل التنسيق/تغيير الحجم:
    - الكتب المصورة (CBR أو CBZ أو CB7 أو PDF أو EPUB<sup>[2]</sup> إلى CBR<sup>[4]</sup> أو CBZ أو CB7 أو PDF أو EPUB).
    - الصور (JPG أو PNG أو AVIF أو WebP).
  - إنشاء:
    - كتاب مصور (CBR<sup>[4]</sup> أو CBZ أو CB7 أو PDF أو EPUB) من العديد من الصور و/أو الكتب المصورة.
    - صورة رمز الاستجابة السريعة (QR Code) من نص.
  - استخراج:
    - صفحات من الكتب المصورة (بتنسيق JPG أو PNG أو AVIF أو WebP).
    - نص من صفحة كتاب مصور أو صورة باستخدام تقنية التعرف الضوئي على الحروف (OCR).
    - نص رمز الاستجابة السريعة (QR code) من صفحة كتاب مصور أو ملف صورة.
    - لوحة ألوان من صفحة كتاب مصور أو ملف صورة.
      - يمكن تصديرها إلى ملف لوحة ألوان من نوع GPL أو ACO.
  - غير ذلك:
    - البحث وفتح الكتب وكتب القصص المصورة من:
      - المتحف الرقمي للقصص المصورة.
      - كتب من أرشيف الإنترنت.
      - مشروع غوتنبرغ.
      - قصص مصورة من xkcd.
      - موقع Comic Book Plus
    - البحث وفتح الكتب الصوتية من:
      - كتب صوتية من LibriVox
    - البحث عن مصطلحات القاموس من:
      - قاموس Wiktionary.
    - البحث عن والاستماع إلى البث المباشر للمحطات الاذاعية من:
      - radio-browser

> الملاحظات:
>
> [1]: بالإضافة إلى ذلك، الملفات المحمية بكلمة مرور: ملفات PDF و CBZ (لا تدعم تشفير AES) وملفات CB7 و CBR.
>
> [2]: صور فقط.
>
> [3]: قراءة الكتب الالكترونية بتنسيق EPUB هي ميزة تجريبية / إضافية خارج النطاق الرئيسي للمشروع. قد لا تعمل مع جميع الملفات ويمكن إزالتها في الإصدارات المستقبلية إذا لزم الأمر.
>
> [4]: إنشاء وتعديل ملفات CBR معطل بشكل افتراضي. يمكن تمكينهما في التفضيلات ولكنهما يتطلبان تثبيت أداة سطر أوامر تابعة لجهة خارجية ([rar](https://www.win-rar.com/cmd-shell-mode.html?&L=0) من WinRAR) في النظام.

## التنزيل:

<div dir="rtl"><a href="https://github.com/binarynonsense/comic-book-reader/releases/latest"><img src="https://shields.io/github/v/release/binarynonsense/comic-book-reader?display_name=tag&label=stable" title="version"></a> <a href="https://github.com/binarynonsense/comic-book-reader/releases"><img src="https://shields.io/github/v/release/binarynonsense/comic-book-reader?display_name=tag&label=latest&include_prereleases" title="version"></a> <a href="http://www.binarynonsense.com/webapps/github-releases-summary/?owner=binarynonsense&name=comic-book-reader"><img src="https://shields.io/github/downloads/binarynonsense/comic-book-reader/total?label=downloads" title="total downloads"></a></div>

الإصدار المستقر:

- [ويندوز](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows.zip)
- [ويندوز (Self-Extracting)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows_SelfExtracting.exe)
- [لينكس](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux.zip)
- [لينكس (AppImage)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux_AppImage.zip)

جميع الإصدارات (التجريبية والمستقرة):

- [قائمة الإصدارات](https://github.com/binarynonsense/comic-book-reader/releases)

## المساهمات:

- الترجمة الروسية من قبل [vanja-san](https://github.com/vanja-san)
- الترجمة الألمانية من قبل [Timo Heidutzek (trzyglow)](https://github.com/trzyglow)
- الترجمة العربية من قبل [Ahmed (ahmed-0011)](https://github.com/ahmed-0011)

للتعرف على كيفية المساهمة في المشروع، راجع الملف التالي [CONTRIBUTING.md](../CONTRIBUTING.md).

## الترخيص:

يتم إصدار كود ACBR بموجب [رخصة](../LICENSE) BSD 2-Clause. للتحقق من تراخيص node modules والمكتبات الأخرى المستخدمة في المشروع انتقل إلى مجلد [التراخيص](../licenses/).

## غير ذلك:

يمكن العثور على لقطات الشاشة، والمزيد من التفاصيل حول عناصر التحكم وغيرها من المعلومات الإضافية على [ويكي المشروع](https://github.com/binarynonsense/comic-book-reader/wiki).
