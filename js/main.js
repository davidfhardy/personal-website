/* Site-wide behaviour: navbar scroll state, mobile menu, CV/publications section highlighting. */
(function () {
  "use strict";

  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".navbar__toggle");
  var menu = document.getElementById("nav-menu");

  // --- Navbar: transparent over the hero, solid after scrolling -------------
  if (header && header.classList.contains("site-header--transparent")) {
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 40);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // --- Mobile menu ------------------------------------------------------------
  function setMenu(open) {
    if (!toggle || !menu) return;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.classList.toggle("is-open", open);
    if (header) header.classList.toggle("menu-open", open);
  }

  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) setMenu(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        toggle.focus();
      }
    });
    document.addEventListener("click", function (e) {
      if (toggle.getAttribute("aria-expanded") === "true" && !header.contains(e.target)) {
        setMenu(false);
      }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth >= 768) setMenu(false);
    });
  }

  // --- In-page table of contents: highlight the section in view -------------
  var tocLinks = document.querySelectorAll(".toc a[href^='#']");
  if (tocLinks.length && "IntersectionObserver" in window) {
    var byId = {};
    tocLinks.forEach(function (a) {
      byId[a.getAttribute("href").slice(1)] = a;
    });
    var visible = {};
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          visible[entry.target.id] = entry.isIntersecting;
        });
        var firstVisible = null;
        tocLinks.forEach(function (a) {
          var id = a.getAttribute("href").slice(1);
          if (!firstVisible && visible[id]) firstVisible = id;
        });
        if (firstVisible) {
          tocLinks.forEach(function (a) {
            a.classList.toggle("is-active", a === byId[firstVisible]);
          });
        }
      },
      { rootMargin: "-80px 0px -55% 0px" },
    );
    Object.keys(byId).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) observer.observe(el);
    });
  }

  // --- Home hero soft-crossfade slideshow ------------------------------------
  (function initHeroSlideshow() {
    var slidesRoot = document.querySelector(".hero__slides");
    if (!slidesRoot) return;

    var hero = slidesRoot.closest(".hero");
    var slides = Array.prototype.slice.call(slidesRoot.querySelectorAll(".hero__slide"));
    if (!hero || slides.length < 2) return;

    var INTERVAL_MS = 3000;
    var index = slides.findIndex(function (s) {
      return s.classList.contains("is-active");
    });
    if (index < 0) index = 0;
    var timer = null;
    var dots = [];

    function setActive(nextIndex) {
      if (nextIndex === index) return;
      slides[index].classList.remove("is-active");
      if (dots[index]) {
        dots[index].classList.remove("is-active");
        dots[index].removeAttribute("aria-current");
      }
      index = (nextIndex + slides.length) % slides.length;
      slides[index].classList.add("is-active");
      if (dots[index]) {
        dots[index].classList.add("is-active");
        dots[index].setAttribute("aria-current", "true");
      }
    }

    function clearTimer() {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    }

    function schedule() {
      clearTimer();
      // Keep advancing even when the pointer is over the full-viewport hero.
      // CSS already shortens/skips the fade when prefers-reduced-motion is on.
      if (document.hidden) return;
      timer = window.setTimeout(function () {
        setActive(index + 1);
        schedule();
      }, INTERVAL_MS);
    }

    var dotsNav = document.createElement("div");
    dotsNav.className = "hero__dots";
    dotsNav.setAttribute("role", "group");
    dotsNav.setAttribute("aria-label", "Hero photos");
    slides.forEach(function (_slide, i) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hero__dot" + (i === index ? " is-active" : "");
      btn.setAttribute("aria-label", "Show photo " + (i + 1) + " of " + slides.length);
      if (i === index) btn.setAttribute("aria-current", "true");
      btn.addEventListener("click", function () {
        setActive(i);
        schedule();
      });
      dotsNav.appendChild(btn);
      dots.push(btn);
    });
    hero.appendChild(dotsNav);

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) clearTimer();
      else schedule();
    });

    schedule();
  })();
})();
