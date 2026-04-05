export function startTourIfNeeded() {
  const TOUR_KEY = 'qvm_tour_completed';

  if (localStorage.getItem(TOUR_KEY)) {
    return;
  }

  if (typeof window.driver === 'undefined' || typeof window.driver.js === 'undefined' || !window.driver.js.driver) {
    console.warn('Driver.js is not loaded.');
    return;
  }

  const driver = window.driver.js.driver;

  const driverObj = driver({
    showProgress: true,
    animate: true,
    nextBtnText: 'التالي',
    prevBtnText: 'السابق',
    doneBtnText: 'إنهاء',
    onDestroyStarted: () => {
      localStorage.setItem(TOUR_KEY, 'true');
      driverObj.destroy();
    },
    steps: [
      {
        popover: {
          title: 'مرحباً بك في QVM! 👋',
          description: 'صانع فيديو القرآن الكريم. دعنا نأخذ جولة سريعة للتعرف على الميزات والأدوات المتاحة لك.',
          side: "left",
          align: 'start'
        }
      },
      {
        element: '#mainMenu .nav-buttons .nav-btn:nth-child(1)',
        popover: {
          title: 'سورة كاملة',
          description: 'من هنا يمكنك إنشاء فيديو متكامل لسورة كاملة من القرآن الكريم بخلفيات جذابة وتلاوة رائعة.',
          side: "bottom",
          align: 'start'
        }
      },
      {
        element: '#mainMenu .nav-buttons .nav-btn:nth-child(2)',
        popover: {
          title: 'آيات',
          description: 'إذا كنت تريد إنشاء فيديو لجزء مخصص أو بضع آيات محددة فقط، يمكنك فعل ذلك من خلال هذا القسم.',
          side: "bottom",
          align: 'start'
        }
      },
      {
        element: '#mainMenu .nav-buttons .nav-btn:nth-child(3)',
        popover: {
          title: 'المعرض',
          description: 'جميع مقاطع الفيديو التي قمت بإنشائها ستكون محفوظة ومتاحة للتحميل والمشاركة في المعرض الخاص بك.',
          side: "bottom",
          align: 'start'
        }
      },
      {
        element: '#userInfo',
        popover: {
          title: 'حسابك',
          description: 'هنا يمكنك متابعة اسم حسابك، تسجيل الخروج عند الانتهاء، أو إدارة الحساب.',
          side: "bottom",
          align: 'start'
        }
      }
    ]
  });

  setTimeout(() => {
    driverObj.drive();
  }, 300);
}

export function handlePageTour(pageId) {
  if (typeof window.driver === 'undefined' || typeof window.driver.js === 'undefined' || !window.driver.js.driver) {
    return;
  }
  const driver = window.driver.js.driver;

  if (pageId === 'fullOptions' || pageId === 'partOptions') {
    const key = `qvm_tour_options_${pageId}`;
    if (localStorage.getItem(key)) return;

    const driverObj = driver({
      showProgress: true,
      animate: true,
      nextBtnText: 'التالي',
      prevBtnText: 'السابق',
      doneBtnText: 'إنهاء',
      onDestroyStarted: () => {
        localStorage.setItem(key, 'true');
        driverObj.destroy();
      },
      steps: [
        {
          element: `#${pageId} .nav-buttons .nav-btn:nth-child(1)`,
          popover: {
            title: 'مكتبة التلاوة',
            description: 'اختر هذا الخيار إذا كنت ترغب في الاعتماد على مكتبتنا المدمجة واختيار قارئ من قائمة القراء المتوفرة مسبقاً، حيث تتم المزامنة تلقائياً وبشكل دقيق.',
            side: "bottom",
            align: 'start'
          }
        },
        {
          element: `#${pageId} .nav-buttons .nav-btn:nth-child(2)`,
          popover: {
            title: 'تلاوة مخصصة',
            description: 'اختر هذا الخيار إذا كان لديك ملف صوتي خاص بك (تلاوتك الخاصة أو تلاوة نادرة) وتريد رفعه ودمجه مع الفيديو إما تلقائياً أو يدوياً.',
            side: "bottom",
            align: 'start'
          }
        }
      ]
    });
    setTimeout(() => driverObj.drive(), 300);
  }

  if (pageId === 'fullForm' || pageId === 'partForm') {
    const key = `qvm_tour_library_${pageId}`;
    if (localStorage.getItem(key)) return;

    const driverObj = driver({
      showProgress: true,
      animate: true,
      nextBtnText: 'التالي',
      prevBtnText: 'السابق',
      doneBtnText: 'إنهاء',
      onDestroyStarted: () => {
        localStorage.setItem(key, 'true');
        driverObj.destroy();
      },
      steps: [
        {
          element: `#${pageId} .form-section:nth-child(1)`,
          popover: {
            title: 'إعدادات الفيديو',
            description: 'هنا يمكنك تخصيص مظهر الفيديو بالكامل: التحكم بلون النص، نوع وحجم الخط، إضافة ترجمة، أو اختيار خلفية مرئية جذابة من عدة مصادر متاحة.',
            side: "left",
            align: 'start'
          }
        },
        {
          element: `#${pageId} .form-section:nth-child(2)`,
          popover: {
            title: 'إعدادات القرآن',
            description: 'حدد هنا الرواية، واسم القارئ، والسورة التي تريدها. يمكنك أيضاً تفعيل خيار "فيديو عمودي (9:16)" ليناسب شكل الريلز في وسائل التواصل الاجتماعي.',
            side: "right",
            align: 'start'
          }
        }
      ]
    });
    setTimeout(() => driverObj.drive(), 300);
  }

  if (pageId === 'fullFormCustom' || pageId === 'partFormCustom') {
    const key = `qvm_tour_custom_${pageId}`;
    if (localStorage.getItem(key)) return;

    const driverObj = driver({
      showProgress: true,
      animate: true,
      nextBtnText: 'التالي',
      prevBtnText: 'السابق',
      doneBtnText: 'إنهاء',
      onDestroyStarted: () => {
        localStorage.setItem(key, 'true');
        driverObj.destroy();
      },
      steps: [
        {
          element: `#${pageId} .form-section:nth-child(1)`,
          popover: {
            title: 'إعدادات الفيديو',
            description: 'تماماً مثل مكتبة التلاوة، يمكنك هنا تخصيص كل ما يتعلق بمظهر الفيديو وشكل الخط والمقاسات والخلفية المستعملة.',
            side: "left",
            align: 'start'
          }
        },
        {
          element: `#${pageId === 'fullFormCustom' ? 'customAudioFull' : 'customAudioPart'}`,
          popover: {
            title: 'رفع التلاوة الخاصة بك',
            description: 'اضغط هنا لرفع الملف الصوتي الذي تود استخدامه في الفيديو من جهازك الخاص.',
            side: "bottom",
            align: 'start'
          }
        },
        {
          element: `#${pageId} .sync-method-buttons`,
          popover: {
            title: 'طريقة المزامنة',
            description: 'بعد رفع الصوت وضبط الإعدادات، اختر "مزامنة يدوية" لتحديد توقيت ظهور كل آية بنفسك عند الاستماع، أو جرب "المزامنة التلقائية".',
            side: "top",
            align: 'start'
          }
        }
      ]
    });
    setTimeout(() => driverObj.drive(), 300);
  }

  if (pageId === 'tapToSyncPage') {
    const key = `qvm_tour_sync_page`;
    if (localStorage.getItem(key)) return;

    const driverObj = driver({
      showProgress: true,
      animate: true,
      nextBtnText: 'التالي',
      prevBtnText: 'السابق',
      doneBtnText: 'إنهاء',
      onDestroyStarted: () => {
        localStorage.setItem(key, 'true');
        driverObj.destroy();
      },
      steps: [
        {
          element: '#currentVerseDisplay',
          popover: {
            title: 'نص الآية',
            description: 'هذا هو نص الآية الحالية. يجب عليك متابعة القراءة مع هذا النص وتجهيز نفسك للآية القادمة.',
            side: "bottom",
            align: 'center'
          }
        },
        {
          element: '.audio-controls',
          popover: {
            title: 'أزرار التشغيل',
            description: 'استخدم هذه الأزرار لتشغيل التلاوة وإيقافها مؤقتاً.',
            side: "bottom",
            align: 'center'
          }
        },
        {
          element: '#markVerseBtn',
          popover: {
            title: 'زر المزامنة',
            description: 'اضغط على هذا الزر تماماً عندما يبدأ القارئ بقراءة الآية المعروضة بالأعلى.',
            side: "top",
            align: 'center'
          }
        }
      ]
    });
    setTimeout(() => driverObj.drive(), 300);
  }
}

export function showTooltip(element, type) {
  if (typeof window.driver === 'undefined' || typeof window.driver.js === 'undefined' || !window.driver.js.driver) {
    return;
  }
  const driver = window.driver.js.driver;

  let title = '';
  let description = '';

  if (type === 'verticalVideo') {
    title = 'فيديو عمودي';
    description = 'تفعيل هذا الخيار يقوم بإنشاء الفيديو بأبعاد 9:16 (طولي) لتناسب الريلز، التيك توك، وحالات واتساب.';
  } else if (type === 'syncMethod') {
    title = 'طريقة المزامنة';
    description = 'المزامنة التلقائية تعتمد على الذكاء الاصطناعي (قد تخطئ أحياناً)، بينما المزامنة اليدوية تتيح لك بدقة متناهية اختيار بداية كل آية بضغطة زر.';
  }

  const d = driver({
    showProgress: false,
    showButtons: ['close']
  });

  d.highlight({
    element: element,
    popover: {
      title: title,
      description: description,
      side: 'bottom',
      align: 'start'
    }
  });
}

window.handlePageTour = handlePageTour;
window.showTooltip = showTooltip;