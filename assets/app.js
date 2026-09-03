(function () {
  var STORAGE = "orys-tili-progress";
  var courses = window.COURSES || [];
  var params = new URLSearchParams(location.search);
  var gradeId = params.get("grade");
  if (gradeId && gradeId.indexOf("ru-") !== 0) gradeId = "ru-" + gradeId;

  var progress = {};
  try { progress = JSON.parse(localStorage.getItem(STORAGE) || "{}") || {}; } catch (e) {}

  function saveProgress() {
    localStorage.setItem(STORAGE, JSON.stringify(progress));
  }

  function lessonKey(course, href) {
    return course.folder + "/" + href;
  }

  function lessonCount(course) {
    var n = 0;
    course.modules.forEach(function (m) {
      m.lessons.forEach(function (g) { n += g.items.length; });
    });
    return n;
  }

  function doneCount(course) {
    var n = 0;
    course.modules.forEach(function (m) {
      m.lessons.forEach(function (g) {
        g.items.forEach(function (item) {
          if (progress[lessonKey(course, item.href)]) n += 1;
        });
      });
    });
    return n;
  }

  function findCourse(id) {
    for (var i = 0; i < courses.length; i++) if (courses[i].id === id) return courses[i];
    return null;
  }

  function flatLessons(course) {
    var list = [];
    course.modules.forEach(function (mod, mi) {
      mod.lessons.forEach(function (group, gi) {
        group.items.forEach(function (item, ii) {
          list.push({
            module: mod,
            group: group,
            item: item,
            mi: mi,
            gi: gi,
            ii: ii
          });
        });
      });
    });
    return list;
  }

  function setTitle(text) {
    document.title = text;
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }

  function renderPortal() {
    var app = document.getElementById("app");
    var totalLessons = courses.reduce(function (sum, c) { return sum + lessonCount(c); }, 0);
    var totalDone = courses.reduce(function (sum, c) { return sum + doneCount(c); }, 0);

    app.className = "app mode-portal";
    app.innerHTML =
      '<header class="top">' +
        '<a class="brand" href="./index.html">' +
          '<div class="mark">ОТ</div>' +
          '<div><h1>Орыс тілі</h1><p>Электронный учебник · 2–11 классы</p></div>' +
        '</a>' +
        '<div class="top-actions">' +
          '<input class="search" id="gradeSearch" type="search" placeholder="Найти модуль или класс" enterkeyhint="search">' +
        '</div>' +
      '</header>' +
      '<div class="portal">' +
        '<div class="hero">' +
          '<div>' +
            '<h2>Русский язык для урока</h2>' +
            '<p>Выберите класс, откройте модуль и проходите правила, упражнения, чтение, диалоги и тесты прямо в браузере — как обычный сайт.</p>' +
          '</div>' +
          '<div class="stats">' +
            '<div class="stat"><b>' + courses.length + '</b><span>классов</span></div>' +
            '<div class="stat"><b>' + totalLessons + '</b><span>уроков</span></div>' +
            '<div class="stat"><b>' + totalDone + '</b><span>пройдено</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="grades" id="grades"></div>' +
      '</div>';

    var box = document.getElementById("grades");

    function paint(query) {
      box.innerHTML = "";
      var q = (query || "").trim().toLowerCase();
      courses.forEach(function (course) {
        var hay = (course.title + " " + course.kk + " " + course.modules.map(function (m) { return m.title; }).join(" ")).toLowerCase();
        if (q && hay.indexOf(q) === -1) return;
        var total = lessonCount(course);
        var done = doneCount(course);
        var pct = total ? Math.round(done * 100 / total) : 0;
        var card = el("button", "grade-card");
        card.type = "button";
        card.innerHTML =
          '<div class="grade-num">' + course.grade + '</div>' +
          '<small>' + course.kk + '</small>' +
          '<b>' + course.title + '</b>' +
          '<span>' + course.modules.length + ' модулей · ' + total + ' уроков</span>' +
          '<div class="progress-bar"><i style="width:' + pct + '%"></i></div>';
        card.addEventListener("click", function () {
          location.href = "./index.html?grade=" + course.grade;
        });
        box.appendChild(card);
      });
      if (!box.children.length) box.appendChild(el("div", "empty-search", "Ничего не найдено. Попробуйте другое слово."));
    }

    paint("");
    document.getElementById("gradeSearch").addEventListener("input", function (e) {
      paint(e.target.value);
    });
    setTitle("Орыс тілі · Русский язык");
  }

  function renderViewer(course) {
    var app = document.getElementById("app");
    var all = flatLessons(course);
    var activeBtn = null;
    var currentIndex = -1;

    app.className = "app mode-viewer";
    app.innerHTML =
      '<header class="top">' +
        '<button class="btn menu-btn" id="menuBtn" type="button">Уроки</button>' +
        '<a class="brand" href="./index.html?grade=' + course.grade + '">' +
          '<div class="mark">' + course.grade + '</div>' +
          '<div><h1>' + course.title + '</h1><p>' + course.kk + ' · ' + course.modules.length + ' модулей</p></div>' +
        '</a>' +
        '<div class="top-actions">' +
          '<input class="search search-desktop" id="lessonSearchDesktop" type="search" placeholder="Поиск по урокам">' +
          '<button class="btn nav-desktop" id="prevBtnDesktop" type="button">←</button>' +
          '<button class="btn nav-desktop" id="nextBtnDesktop" type="button">→</button>' +
          '<a class="btn btn-solid" href="./index.html">Классы</a>' +
        '</div>' +
      '</header>' +
      '<div class="menu-backdrop" id="backdrop"></div>' +
      '<div class="viewer">' +
        '<aside id="menu">' +
          '<div class="drawer-head">' +
            '<input class="search drawer-search" id="lessonSearch" type="search" placeholder="Поиск по урокам" enterkeyhint="search">' +
            '<button class="btn-close" id="closeMenu" type="button" aria-label="Закрыть">✕</button>' +
          '</div>' +
          '<div class="menu-list" id="menuList"></div>' +
        '</aside>' +
        '<main>' +
          '<div class="stage">' +
            '<div class="toolbar" id="toolbar">' +
              '<span class="crumb" id="crumb"></span>' +
              '<span class="spacer"></span>' +
              '<span id="counter"></span>' +
            '</div>' +
            '<div class="stage-body">' +
              '<div class="welcome" id="welcome">' +
                '<div class="welcome-card">' +
                  '<h2>Выберите урок</h2>' +
                  '<p>Откройте меню «Уроки» и выберите модуль: правила, упражнения, чтение, аудирование, диалог или тест.</p>' +
                '</div>' +
                '<div class="cards" id="cards"></div>' +
              '</div>' +
              '<iframe id="frame" title="Урок" hidden></iframe>' +
            '</div>' +
          '</div>' +
        '</main>' +
      '</div>' +
      '<nav class="bottom-nav" id="bottomNav">' +
        '<button type="button" id="prevBtn">Назад</button>' +
        '<button type="button" class="nav-main" id="openMenuBottom">Уроки</button>' +
        '<button type="button" id="nextBtn">Далее</button>' +
      '</nav>';

    var menu = document.getElementById("menu");
    var menuList = document.getElementById("menuList");
    var backdrop = document.getElementById("backdrop");
    var cards = document.getElementById("cards");
    var welcome = document.getElementById("welcome");
    var frame = document.getElementById("frame");
    var toolbar = document.getElementById("toolbar");
    var crumb = document.getElementById("crumb");
    var counter = document.getElementById("counter");
    var prevBtn = document.getElementById("prevBtn");
    var nextBtn = document.getElementById("nextBtn");
    var moduleNodes = [];

    function lessonUrl(href) {
      return course.folder + "/" + href;
    }

    function markDone(href) {
      progress[lessonKey(course, href)] = true;
      saveProgress();
    }

    var prevBtnDesktop = document.getElementById("prevBtnDesktop");
    var nextBtnDesktop = document.getElementById("nextBtnDesktop");
    var lessonSearch = document.getElementById("lessonSearch");
    var lessonSearchDesktop = document.getElementById("lessonSearchDesktop");

    function isPhone() {
      return window.matchMedia("(max-width: 860px)").matches;
    }

    function setDrawer(open) {
      menu.classList.toggle("open", open);
      backdrop.classList.toggle("open", open);
    }

    function updateNav() {
      var atStart = currentIndex <= 0;
      var atEnd = currentIndex < 0 || currentIndex >= all.length - 1;
      prevBtn.disabled = atStart;
      nextBtn.disabled = atEnd;
      prevBtnDesktop.disabled = atStart;
      nextBtnDesktop.disabled = atEnd;
      if (currentIndex >= 0) {
        counter.textContent = (currentIndex + 1) + " / " + all.length;
      } else {
        counter.textContent = doneCount(course) + " из " + all.length + " пройдено";
      }
    }

    function injectLessonStyles() {
      try {
        var doc = frame.contentDocument;
        if (!doc || !doc.documentElement) return;
        var head = doc.head || doc.documentElement;
        if (!doc.querySelector('meta[name="viewport"]')) {
          var meta = doc.createElement("meta");
          meta.setAttribute("name", "viewport");
          meta.setAttribute("content", "width=device-width, initial-scale=1");
          head.insertBefore(meta, head.firstChild);
        }
        if (!doc.getElementById("orys-mobile-css")) {
          var link = doc.createElement("link");
          link.id = "orys-mobile-css";
          link.rel = "stylesheet";
          link.href = new URL("assets/lesson-mobile.css", location.href).href;
          head.appendChild(link);
        }
      } catch (err) {}
    }

    function openLesson(entry, btn) {
      currentIndex = all.indexOf(entry);
      welcome.classList.add("hidden");
      frame.hidden = false;
      frame.src = lessonUrl(entry.item.href);
      toolbar.classList.add("visible");
      crumb.textContent = entry.module.title + " · " + entry.group.group + " · " + entry.item.name;
      markDone(entry.item.href);
      if (activeBtn) activeBtn.classList.remove("active");
      if (btn) {
        btn.classList.add("active");
        btn.classList.add("done");
        activeBtn = btn;
      }
      moduleNodes.forEach(function (node) { node.classList.remove("open"); });
      var box = moduleNodes[entry.mi];
      if (box) box.classList.add("open");
      updateNav();
      setTitle(entry.item.name + " · " + course.title);
      history.replaceState(null, "", "./index.html?grade=" + course.grade + "&lesson=" + encodeURIComponent(entry.item.href));
      if (isPhone()) setDrawer(false);
    }

    function showHome() {
      currentIndex = -1;
      frame.hidden = true;
      frame.src = "about:blank";
      welcome.classList.remove("hidden");
      toolbar.classList.remove("visible");
      if (activeBtn) activeBtn.classList.remove("active");
      activeBtn = null;
      moduleNodes.forEach(function (node) { node.classList.remove("open"); });
      updateNav();
      setTitle(course.title);
      history.replaceState(null, "", "./index.html?grade=" + course.grade);
    }

    function buildMenu(query) {
      menuList.innerHTML = "";
      cards.innerHTML = "";
      moduleNodes = [];
      var q = (query || "").trim().toLowerCase();
      course.modules.forEach(function (mod, mi) {
        var visibleGroups = [];
        mod.lessons.forEach(function (group) {
          var items = group.items.filter(function (item) {
            if (!q) return true;
            return (mod.title + " " + group.group + " " + item.name).toLowerCase().indexOf(q) !== -1;
          });
          if (items.length) visibleGroups.push({ group: group.group, items: items, source: group });
        });
        if (!visibleGroups.length) return;

        var box = el("div", "module");
        var head = el("button", "", mod.title);
        head.type = "button";
        head.addEventListener("click", function () {
          var wasOpen = box.classList.contains("open");
          moduleNodes.forEach(function (node) { node.classList.remove("open"); });
          if (!wasOpen) box.classList.add("open");
        });
        var body = el("div", "module-body");
        visibleGroups.forEach(function (section) {
          body.appendChild(el("div", "section-title", section.group));
          section.items.forEach(function (item) {
            var btn = el("button", "lesson", item.name);
            btn.type = "button";
            btn.setAttribute("data-href", item.href);
            if (progress[lessonKey(course, item.href)]) btn.classList.add("done");
            btn.addEventListener("click", function () {
              var entry = all.find(function (x) { return x.item.href === item.href; });
              openLesson(entry, btn);
            });
            body.appendChild(btn);
          });
        });
        box.appendChild(head);
        box.appendChild(body);
        menuList.appendChild(box);
        moduleNodes[mi] = box;

        var card = el("button");
        card.type = "button";
        var n = mod.lessons.reduce(function (sum, g) { return sum + g.items.length; }, 0);
        card.innerHTML = "<b>" + mod.title + "</b><span>" + n + " материалов</span>";
        card.addEventListener("click", function () {
          moduleNodes.forEach(function (node) { node.classList.remove("open"); });
          box.classList.add("open");
          var first = box.querySelector(".lesson");
          if (first) first.click();
        });
        cards.appendChild(card);
      });
      if (!menuList.children.length) menuList.appendChild(el("div", "empty-search", "Ничего не найдено."));
    }

    function onSearch(value) {
      if (lessonSearch.value !== value) lessonSearch.value = value;
      if (lessonSearchDesktop.value !== value) lessonSearchDesktop.value = value;
      buildMenu(value);
    }

    buildMenu("");
    updateNav();
    lessonSearch.addEventListener("input", function (e) { onSearch(e.target.value); });
    lessonSearchDesktop.addEventListener("input", function (e) { onSearch(e.target.value); });
    document.getElementById("menuBtn").addEventListener("click", function () { setDrawer(true); });
    document.getElementById("openMenuBottom").addEventListener("click", function () { setDrawer(true); });
    document.getElementById("closeMenu").addEventListener("click", function () { setDrawer(false); });
    backdrop.addEventListener("click", function () { setDrawer(false); });
    frame.addEventListener("load", injectLessonStyles);

    function buttonFor(href) {
      return menu.querySelector('.lesson[data-href="' + href.replace(/"/g, "") + '"]');
    }

    function goTo(index) {
      if (index < 0 || index >= all.length) return;
      var entry = all[index];
      openLesson(entry, buttonFor(entry.item.href));
    }

    prevBtn.addEventListener("click", function () { goTo(currentIndex - 1); });
    nextBtn.addEventListener("click", function () { goTo(currentIndex + 1); });
    prevBtnDesktop.addEventListener("click", function () { goTo(currentIndex - 1); });
    nextBtnDesktop.addEventListener("click", function () { goTo(currentIndex + 1); });
    document.addEventListener("keydown", function (e) {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") setDrawer(false);
      if (e.key === "ArrowLeft") goTo(currentIndex - 1);
      if (e.key === "ArrowRight") goTo(currentIndex + 1);
    });

    var wanted = params.get("lesson");
    if (wanted) {
      var entry = all.find(function (x) { return x.item.href === wanted; });
      if (entry) openLesson(entry, buttonFor(entry.item.href));
    } else {
      setTitle(course.title);
    }
  }

  var requested = gradeId ? findCourse(gradeId) : null;
  if (requested) renderViewer(requested);
  else renderPortal();
})();
