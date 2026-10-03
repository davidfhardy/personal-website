/**
 * gallery.js — justified-rows photo galleries + lightbox. No dependencies.
 *
 * Markup:   <div class="gallery" data-gallery="japan" data-section="0"></div>
 * Data:     window.PHOTO_DATA (see js/photos.js)
 * Options (data attributes on the container, all optional):
 *   data-section="N"        which section of a trip (default 0)
 *   data-row-height="300"   target row height in px on desktop
 *   data-layout="stack"     full-width vertical stack with always-visible captions
 *   data-layout="grid-2"    responsive two-column grid with always-visible captions
 *   data-layout="bleed"     full-bleed equal CSS grid (McKinnon-style); no tile captions
 *   data-layout="natural"   justified-row collage at intrinsic aspect ratios (alias: masonry)
 *                           (default: justified rows / collage)
 *
 * Deep link: add ?open=N to a page URL to open photo N (1-based) of the first
 * gallery on the page; ?open=N&section=S targets the gallery with data-section=S.
 */
(function () {
  "use strict";

  var GAP = 8; // must match --gallery-gap in style.css
  var DATA = window.PHOTO_DATA || {};

  // Photo paths in photos.js are relative to the site root. Work out the root
  // from this script's URL (…/js/gallery.js), so pages in sub-folders just work
  // — on GitHub Pages (user or project site), Live Server, or file://.
  var scriptEl = document.currentScript;
  var ROOT = scriptEl ? new URL("../", scriptEl.src) : new URL("./", document.baseURI);

  function resolve(path) {
    if (!path) return "";
    if (/^([a-z]+:)?\/\//i.test(path) || path.charAt(0) === "/") return path;
    return new URL(path, ROOT).href;
  }

  function getPhotos(key, sectionIndex) {
    var entry = DATA[key];
    if (!entry) return null;
    if (Array.isArray(entry)) return entry;
    if (Array.isArray(entry.photos)) return entry.photos;
    if (Array.isArray(entry.sections)) {
      var s = entry.sections[sectionIndex || 0];
      return s ? s.photos || [] : null;
    }
    return null;
  }


  function photoCaption(p) {
    if (p.caption) return p.caption;
    // Fall back to a short location-style label from alt (strip trailing "photo N").
    if (!p.alt) return "";
    return String(p.alt).replace(/\s*photo\s+\d+\s*$/i, "").trim();
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  // ---------------------------------------------------------------------------
  // Justified layout
  // ---------------------------------------------------------------------------

  /**
   * Split photos into rows that exactly fill `width`, each row as close as
   * possible to `target` height. Returns [{ items: [index…], height, full }].
   */
  function computeRows(ratios, width, target, gap) {
    var G = typeof gap === "number" ? gap : GAP;
    var rows = [];
    var row = [];
    var sum = 0; // sum of aspect ratios in current row

    for (var i = 0; i < ratios.length; i++) {
      var r = ratios[i];
      var nextSum = sum + r;
      var gaps = row.length * G; // gaps if we add this photo
      var widthAtTarget = nextSum * target + gaps;

      if (widthAtTarget < width) {
        row.push(i);
        sum = nextSum;
        continue;
      }

      // Adding photo i overflows the row. Either close the row with it
      // (shrinking the row) or without it (growing the row) — whichever
      // lands nearer the target height.
      var hWith = (width - gaps) / nextSum;
      var hWithout = row.length ? (width - (row.length - 1) * G) / sum : Infinity;

      if (
        !row.length ||
        Math.abs(Math.log(hWith / target)) <= Math.abs(Math.log(hWithout / target))
      ) {
        row.push(i);
        rows.push({ items: row, height: hWith, full: true });
        row = [];
        sum = 0;
      } else {
        rows.push({ items: row, height: hWithout, full: true });
        row = [i];
        sum = r;
      }
    }

    if (row.length) {
      // Last row: keep the target height (don't stretch) unless it would overflow.
      var h = Math.min(target, (width - (row.length - 1) * G) / sum);
      rows.push({ items: row, height: h, full: false });
    }
    return rows;
  }

  function targetHeight(container, width) {
    var desktop = parseFloat(container.getAttribute("data-row-height")) || 300;
    if (width < 600) return Math.round(desktop * 0.667); // ~200px on phones
    if (width < 960) return Math.round(desktop * 0.8); // ~240px on tablets
    return desktop;
  }

  // ---------------------------------------------------------------------------
  // Gallery
  // ---------------------------------------------------------------------------

  function Gallery(container) {
    this.container = container;
    this.key = container.getAttribute("data-gallery");
    this.section = parseInt(container.getAttribute("data-section") || "0", 10) || 0;
    var layout = container.getAttribute("data-layout") || "";
    this.stack = layout === "stack";
    this.grid = layout === "grid-2";
    this.bleed = layout === "bleed" || layout === "mckinnon";
    this.natural = layout === "natural" || layout === "masonry";
    this.gap = this.natural ? 4 : GAP; // keep in sync with --gallery-gap for natural
    this.photos = getPhotos(this.key, this.section);
    this.items = [];
    this.lastWidth = 0;

    if (!this.photos || !this.photos.length) {
      container.innerHTML = '<p class="gallery__empty">No photos here yet.</p>';
      if (!this.photos) {
        console.warn('gallery.js: no data for data-gallery="' + this.key + '"');
      }
      return;
    }

    if (this.stack) container.classList.add("gallery--stack");
    if (this.grid) container.classList.add("gallery--grid-2");
    if (this.bleed) container.classList.add("gallery--bleed");
    if (this.natural) container.classList.add("gallery--natural");

    this.ratios = this.photos.map(function (p) {
      var w = Number(p.width) || 3;
      var h = Number(p.height) || 2;
      return w / h;
    });

    this.build();
    this.layout();

    var self = this;
    var relayout = debounce(function () {
      self.layout();
    }, 120);
    if ("ResizeObserver" in window) {
      new ResizeObserver(relayout).observe(container);
    } else {
      window.addEventListener("resize", relayout);
    }
  }

  Gallery.prototype.build = function () {
    var self = this;
    this.photos.forEach(function (p, i) {
      var a = document.createElement("a");
      a.className = "gallery__item";
      a.href = resolve(p.src);
      a.setAttribute("data-index", String(i));
      a.setAttribute(
        "aria-label",
        (p.alt || "Photo " + (i + 1)) +
          " — open larger view (" +
          (i + 1) +
          " of " +
          self.photos.length +
          ")",
      );

      var img = document.createElement("img");
      img.alt = p.alt || "";
      img.loading = "lazy";
      img.decoding = "async";
      if (p.width && p.height) {
        img.width = p.width;
        img.height = p.height;
      }
      if (p.thumb) {
        img.src = resolve(p.thumb);
        // Let the browser upgrade to the full image on high-DPI screens.
        if (p.width) {
          var thumbW = Math.min(800, p.width);
          img.srcset =
            resolve(p.thumb) + " " + thumbW + "w, " + resolve(p.src) + " " + p.width + "w";
        }
      } else {
        img.src = resolve(p.src);
      }

      if (self.stack || self.grid) {
        var media = document.createElement("span");
        media.className = "gallery__media";
        media.appendChild(img);
        a.appendChild(media);

        var captionText = photoCaption(p);
        if (captionText) {
          var cap = document.createElement("span");
          cap.className = "gallery__caption";
          cap.textContent = captionText;
          a.appendChild(cap);
        }
      } else {
        a.appendChild(img);
      }

      a.addEventListener("click", function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // allow "open in new tab"
        e.preventDefault();
        Lightbox.open(self, i, a);
      });

      self.items.push(a);
    });
  };

  Gallery.prototype.layout = function () {
    if (this.stack) {
      this.layoutStack();
      return;
    }
    if (this.grid) {
      this.layoutGrid();
      return;
    }
    if (this.bleed) {
      this.layoutBleed();
      return;
    }

    var width = this.container.clientWidth;
    if (!width || width === this.lastWidth) return;
    this.lastWidth = width;

    var target = targetHeight(this.container, width);
    var gap = typeof this.gap === "number" ? this.gap : GAP;
    var rows = computeRows(this.ratios, width, target, gap);
    var frag = document.createDocumentFragment();
    var self = this;

    rows.forEach(function (row) {
      var rowEl = document.createElement("div");
      rowEl.className = "gallery__row";
      var h = Math.floor(row.height * 100) / 100;
      row.items.forEach(function (idx, j) {
        var item = self.items[idx];
        var w = self.ratios[idx] * h;
        item.style.height = h + "px";
        item.style.width = w + "px";
        // Absorb sub-pixel rounding so full rows end flush with the container.
        item.style.flexGrow = row.full && j === row.items.length - 1 ? "1" : "0";
        var img = item.querySelector("img");
        if (img && img.srcset) img.sizes = Math.ceil(w) + "px";
        rowEl.appendChild(item);
      });
      frag.appendChild(rowEl);
    });

    this.container.textContent = "";
    this.container.appendChild(frag);
  };

  /** Responsive CSS grid: CSS controls columns, JS only updates image sizes. */
  Gallery.prototype.layoutGrid = function () {
    var width = this.container.clientWidth;
    if (!width || width === this.lastWidth) return;
    this.lastWidth = width;

    var frag = document.createDocumentFragment();
    this.items.forEach(function (item) {
      item.style.height = "";
      item.style.width = "";
      item.style.flexGrow = "";
      var img = item.querySelector("img");
      if (img && img.srcset) img.sizes = "(min-width: 900px) 50vw, 100vw";
      frag.appendChild(item);
    });

    this.container.textContent = "";
    this.container.appendChild(frag);
  };

  /** Full-bleed equal CSS grid: CSS owns columns/aspect; JS only mounts + sizes. */
  Gallery.prototype.layoutBleed = function () {
    var width = this.container.clientWidth;
    if (!width || width === this.lastWidth) return;
    this.lastWidth = width;

    var frag = document.createDocumentFragment();
    this.items.forEach(function (item) {
      item.style.height = "";
      item.style.width = "";
      item.style.flexGrow = "";
      var img = item.querySelector("img");
      if (img && img.srcset) {
        img.sizes = "(min-width: 1100px) 25vw, 50vw";
      }
      frag.appendChild(item);
    });

    this.container.textContent = "";
    this.container.appendChild(frag);
  };

  /** Full-width vertical stack: one photo per row, natural aspect, captions via CSS. */
  Gallery.prototype.layoutStack = function () {
    var width = this.container.clientWidth;
    if (!width || width === this.lastWidth) return;
    this.lastWidth = width;

    var frag = document.createDocumentFragment();
    this.items.forEach(function (item) {
      item.style.height = "";
      item.style.width = "";
      item.style.flexGrow = "";
      var img = item.querySelector("img");
      if (img && img.srcset) img.sizes = Math.ceil(width) + "px";
      frag.appendChild(item);
    });

    this.container.textContent = "";
    this.container.appendChild(frag);
  };

  // ---------------------------------------------------------------------------
  // Lightbox (one shared instance per page)
  // ---------------------------------------------------------------------------

  var Lightbox = (function () {
    var el, img, caption, counter, btnPrev, btnNext, btnClose;
    var gallery = null;
    var index = 0;
    var opener = null;
    var inertEls = [];
    var touchX = null;
    var touchY = null;
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");

    function create() {
      el = document.createElement("div");
      el.className = "lightbox";
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      el.setAttribute("aria-label", "Photo viewer");
      el.hidden = true;
      el.innerHTML =
        '<button type="button" class="lightbox__close" aria-label="Close photo viewer">&times;</button>' +
        '<figure class="lightbox__figure">' +
        '<img class="lightbox__img" alt="" />' +
        '<figcaption class="lightbox__caption"></figcaption>' +
        "</figure>" +
        '<div class="lightbox__controls">' +
        '<button type="button" class="lightbox__btn lightbox__prev" aria-label="Previous photo">prev</button>' +
        '<span class="lightbox__sep" aria-hidden="true">/</span>' +
        '<button type="button" class="lightbox__btn lightbox__next" aria-label="Next photo">next</button>' +
        '<span class="lightbox__counter" aria-live="polite"></span>' +
        "</div>";
      document.body.appendChild(el);

      img = el.querySelector(".lightbox__img");
      caption = el.querySelector(".lightbox__caption");
      counter = el.querySelector(".lightbox__counter");
      btnPrev = el.querySelector(".lightbox__prev");
      btnNext = el.querySelector(".lightbox__next");
      btnClose = el.querySelector(".lightbox__close");

      btnClose.addEventListener("click", close);
      btnPrev.addEventListener("click", function () {
        go(-1);
      });
      btnNext.addEventListener("click", function () {
        go(1);
      });
      img.addEventListener("click", function () {
        go(1);
      });
      img.addEventListener("load", function () {
        img.classList.remove("is-loading");
      });

      // Click on the white backdrop (not the photo or controls) closes.
      el.addEventListener("click", function (e) {
        if (e.target === el || e.target.classList.contains("lightbox__figure")) close();
      });

      el.addEventListener("keydown", onKey);

      el.addEventListener(
        "touchstart",
        function (e) {
          if (e.touches.length !== 1) return;
          touchX = e.touches[0].clientX;
          touchY = e.touches[0].clientY;
        },
        { passive: true },
      );
      el.addEventListener(
        "touchend",
        function (e) {
          if (touchX === null) return;
          var dx = e.changedTouches[0].clientX - touchX;
          var dy = e.changedTouches[0].clientY - touchY;
          touchX = touchY = null;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
        },
        { passive: true },
      );
    }

    function show(i) {
      var photos = gallery.photos;
      index = (i + photos.length) % photos.length;
      var p = photos[index];
      var src = resolve(p.src);
      if (img.getAttribute("src") !== src) {
        img.classList.add("is-loading");
        if (p.width && p.height) {
          img.width = p.width;
          img.height = p.height;
        }
        img.src = src;
        if (img.complete) img.classList.remove("is-loading");
      }
      img.alt = p.alt || "";
      caption.textContent = photoCaption(p);
      counter.textContent = index + 1 + " / " + photos.length;
      var single = photos.length < 2;
      btnPrev.hidden = btnNext.hidden = single;
      el.querySelector(".lightbox__sep").hidden = single;

      // Preload neighbours for snappy navigation.
      [index + 1, index - 1].forEach(function (n) {
        var q = photos[(n + photos.length) % photos.length];
        if (q) new Image().src = resolve(q.src);
      });
    }

    function go(step) {
      if (gallery) show(index + step);
    }

    function focusables() {
      return Array.prototype.filter.call(el.querySelectorAll("button"), function (b) {
        return !b.hidden;
      });
    }

    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Tab") {
        // Focus trap
        var f = focusables();
        if (!f.length) return;
        var first = f[0];
        var last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (!el.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    function open(g, i, openerEl) {
      if (!el) create();
      gallery = g;
      opener = openerEl || null;
      show(i);

      // Lock page scroll (compensate for the disappearing scrollbar).
      var sbw = window.innerWidth - document.documentElement.clientWidth;
      document.documentElement.classList.add("lightbox-open");
      if (sbw > 0) document.body.style.paddingRight = sbw + "px";

      // Hide the rest of the page from assistive tech / keyboard.
      inertEls = Array.prototype.filter.call(document.body.children, function (c) {
        return c !== el && !c.inert && c.tagName !== "SCRIPT";
      });
      inertEls.forEach(function (c) {
        c.inert = true;
      });

      el.hidden = false;
      void el.offsetWidth; // restart transition
      el.classList.add("is-open");
      btnClose.focus();
    }

    function close() {
      if (!el || el.hidden) return;
      el.classList.remove("is-open");
      var done = function () {
        el.hidden = true;
        img.removeAttribute("src");
      };
      if (reduceMotion && reduceMotion.matches) done();
      else setTimeout(done, 300);

      inertEls.forEach(function (c) {
        c.inert = false;
      });
      inertEls = [];
      document.documentElement.classList.remove("lightbox-open");
      document.body.style.paddingRight = "";
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
      gallery = null;
    }

    return { open: open, close: close };
  })();

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  function init() {
    var galleries = Array.prototype.map.call(
      document.querySelectorAll(".gallery[data-gallery]"),
      function (c) {
        return new Gallery(c);
      },
    );

    // Deep link: ?open=N[&section=S]
    var params = new URLSearchParams(window.location.search);
    var openN = parseInt(params.get("open"), 10);
    if (openN > 0) {
      var sec = params.get("section");
      var g = galleries.filter(function (x) {
        return x.photos && x.photos.length && (sec === null || String(x.section) === sec);
      })[0];
      if (g) Lightbox.open(g, Math.min(openN, g.photos.length) - 1, g.items[openN - 1]);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
