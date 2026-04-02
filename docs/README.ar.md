# ACBR - Comic Book Reader

قارئ ومحول للكتب المصورة يدعم ملفات CBZ و CBR و CB7 و EPUB و FB2 و MOBI و PDF.

![git_banner](https://github.com/user-attachments/assets/6ef7ded2-749a-4efd-a6b7-109d0f33d603)

## المحتويات:

- [الميزات](#الميزات)
- [التنزيل](#التنزيل)
- [المساهمات](#المساهمات)
- [غير ذلك](#غير-ذلك)

## الميزات:

- إصدارات لـ ويندوز ولينكس.
- تنسيقات الملفات المتوافقة<sup>[1]</sup>:
  - الكتب المصورة: CBZ و CBR و CB7 و PDF و EPUB
  - ملفات الصور: JPG و PNG و WebP و AVIF
  - الكتب الإلكترونية: PDF و FB2 و MOBI<sup>[4]</sup> و EPUB
- متوفر في وضعين: وضع واجهة مستخدم بسيطة و وضع ملء الشاشة (بدون عناصر واجهة المستخدم).
- تبديل وضع الصفحة: 'صفحة واحدة' أو 'صفحة مزدوجة' أو 'صفحة مزدوجة (توسيط الصفحة الأولى)'
- عرض الصفحة حسب الخصائص التالية: 'مطابق لعرض الشاشة' أو 'مطابق لارتفاع الشاشة' أو 'بالتناسب مع ارتفاع الشاشة'.
- تدوير الصفحة.
- واجهة المستخدم متاحة في الإنجليزية والإسبانية والروسية والألمانية والعربية والفلبينية واليابانية.
- استعادة آخر كتاب وصفحة تم فتحها في الجلسة السابقة تلقائيًا، وتذكر مواضع صفحات الكتب الأخيرة.
- الوضع المحمول (عن طريق إنشاء ملف باسم portable.txt في نفس المجلد الذي يحتوي على الملف القابل للتنفيذ).
- محرر البيانات الوصفية:
  - عرض البيانات الوصفية في ملفات PDF و EPUB أو البيانات الوصفية المخزنة في ملفات ComicInfo.xml داخل الكتب المصورة من نوع CBR و CBZ و CB7.
  - إنشاء و/أو تعديل البيانات الوصفية في ملفات PDF و EPUB أو البيانات الوصفية المخزنة في ملفات ComicInfo.xml داخل الكتب المصورة غير المشفرة من نوع CBR<sup>[3]</sup> و CBZ و CB7.
  - البحث عن البيانات الوصفية للكتب المصورة واستيرادها من Comic Vine (يتطلب توفر [مفتاح واجهة برمجة تطبيقات (API) من Comic Vine](https://comicvine.gamespot.com/api/))
- مشغل وسائط متكامل:
  - يدعم ملفات الصوت MP3 و Ogg و WAV و M3U و M3U8.
  - ملفات الفيديو التي تستخدم التراميز المتوافقة مع الويب مثل MP4 وWebM، بالإضافة إلى روابط يوتيوب وملفات الترجمة بتنسيق SRT.
  - إمكانية تصدير قوائم التشغيل إلى ملفات M3U.
  - يتم دعم المزيد من التنسيقات والتراميز والميزات في حالة [توفر](<https://github.com/binarynonsense/comic-book-reader/wiki/Third%E2%80%90Party-Executables-(rar,-ffmpeg...)>) برنامج FFmpeg.
- الأدوات:
  - تحويل التنسيق/تغيير الحجم:
      - الكتب المصورة والكتب الإلكترونية (CBR أو CBZ أو CB7 أو FB2 أو MOBI<sup>[4]</sup> أو PDF أو EPUB) إلى (CBR<sup>[3]</sup> أو CBZ أو CB7 أو PDF أو EPUB<sup>[2]</sup>).
      - الصور (JPG أو PNG أو AVIF أو WebP).
  - إنشاء:
    - كتاب مصور (CBR<sup>[3]</sup> أو CBZ أو CB7 أو PDF أو EPUB<sup>[2]</sup>) من العديد من الصور و/أو الكتب المصورة.
    - صورة رمز الاستجابة السريعة (QR Code) من نص.
  - استخراج:
    - صفحات من الكتب المصورة (بتنسيق JPG أو PNG أو AVIF أو WebP).
    - نص من صفحة كتاب مصور أو صورة باستخدام تقنية التعرف الضوئي على الحروف (OCR).
    - نص رمز الاستجابة السريعة (QR code) من صفحة كتاب مصور أو ملف صورة.
    - لوحة ألوان من صفحة كتاب مصور أو ملف صورة (يمكن تصديرها إلى ملف لوحة ألوان من نوع GPL أو ACO).
  - البحث والتصفح:
    - كتب وقصص مصورة من المتحف الرقمي للقصص المصورة وأرشيف الإنترنت ومشروع غوتنبرغ، وموقع xkcd للقصص المصورة، وموقع Comic Book Plus.
    - كتب صوتية من LibriVox.
    - مصطلحات من قاموس Wiktionary.
    - بث مباشر للمحطات الاذاعية من radio-browser
    - خلاصات RSS من المدونات الصوتية والمواقع الإلكترونية.
  - تصميم:
    - صانع قوالب لصفحات الكتب المصورة والصور المصغرة
    - مستخرج لوحة الألوان
  - غير ذلك:
    - قارئ RSS
    - بث إذاعي عبر الإنترنت

> الملاحظات:
>
> [1]: بالإضافة إلى ذلك، الملفات المحمية بكلمة مرور: ملفات PDF و CBZ (لا تدعم تشفير AES) وملفات CB7 و CBR.
>
> [2]: صور فقط.
>
> [3]: إنشاء وتعديل ملفات CBR معطل بشكل افتراضي. يمكن تمكينهما في التفضيلات ولكنهما يتطلبان تثبيت أداة سطر أوامر تابعة لجهة خارجية ([rar](https://www.win-rar.com/cmd-shell-mode.html?&L=0) من WinRAR) في النظام.
>
> [4]: [4]: لا يتم دعم سوى ملفات MOBI القديمة (MOBI 7). أما التنسيقات الأحدث مثل KF8 (AZW3) فهي غير متوافقة.

## التنزيل:

<a href="https://github.com/binarynonsense/comic-book-reader/releases/latest"><img src="https://shields.io/github/v/release/binarynonsense/comic-book-reader?display_name=tag&label=stable" title="version"></a> <a href="https://github.com/binarynonsense/comic-book-reader/releases"><img src="https://shields.io/github/v/release/binarynonsense/comic-book-reader?display_name=tag&label=latest&include_prereleases" title="version"></a> <a href="http://www.binarynonsense.com/webapps/github-releases-summary/?owner=binarynonsense&name=comic-book-reader"><img src="https://img.shields.io/github/downloads/binarynonsense/comic-book-reader/total" title="total downloads"></a>

الإصدار المستقر:

- [ويندوز](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows.zip)
- [ويندوز (Self-Extracting)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Windows_SelfExtracting.exe)
- [لينكس](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux.zip)
- [لينكس (AppImage)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux_AppImage.zip)
- [لينكس (deb)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux_deb.zip)
- [لينكس (flatpak)](https://github.com/binarynonsense/comic-book-reader/releases/latest/download/ACBR_Linux_flatpak.zip)

> ملاحظة: بالنسبة لتوزيعات لينكس التي تتطلب تعيين ملف تعريف AppArmor لتشغيل تطبيقات Electron، مثل Ubuntu 24.04، من الأفضل عدم استخدام الإصدار العادي أو إصدار AppImage لأنهما قد لا يعملان بشكل افتراضي بسبب هذا القيد.

جميع الإصدارات (التجريبية والمستقرة):

- [قائمة الإصدارات](https://github.com/binarynonsense/comic-book-reader/releases)

متوفر أيضًا على:

- [Flathub](https://flathub.org/apps/com.binarynonsense.acbr)

## المساهمات:

التصميم والبرمجة:

- [Álvaro García (binarynonsense)](https://github.com/binarynonsense)

الترجمة:

- [Álvaro García (binarynonsense)](https://github.com/binarynonsense) (الإنجليزية والإسبانية)
- [vanja-san](https://github.com/vanja-san) (الروسية)
- [Timo Heidutzek (trzyglow)](https://github.com/trzyglow) (الألمانية)
- [Ahmed (ahmed-0011)](https://github.com/ahmed-0011) (العربية)
- [AndrewL (CodeByMoriarty)](https://github.com/CodeByMoriarty) (الفلبينية)
- [coolvitto](https://github.com/coolvitto) (اليابانية)

للتعرف على كيفية المساهمة في المشروع، راجع الملف التالي [CONTRIBUTING.md](../CONTRIBUTING.md).

## غير ذلك:

يمكن العثور على لقطات الشاشة، والمزيد من التفاصيل حول عناصر التحكم وغيرها من المعلومات الإضافية على [ويكي المشروع](https://github.com/binarynonsense/comic-book-reader/wiki).
