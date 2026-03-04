/* ================================================================
   menu.js — Shared application menu (hamburger drawer)
   ================================================================ */
'use strict';

(function () {
  var toggle   = document.getElementById('menuToggle');
  var drawer   = document.getElementById('menuDrawer');
  var backdrop = document.getElementById('menuBackdrop');
  var closeBtn = document.getElementById('menuCloseBtn');

  if (!toggle || !drawer || !backdrop) return;

  function openMenu() {
    drawer.classList.add('is-open');
    backdrop.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    if (closeBtn) closeBtn.focus();
  }

  function closeMenu() {
    drawer.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    toggle.focus();
  }

  toggle.addEventListener('click', function () {
    drawer.classList.contains('is-open') ? closeMenu() : openMenu();
  });

  if (closeBtn) closeBtn.addEventListener('click', closeMenu);
  backdrop.addEventListener('click', closeMenu);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
      closeMenu();
    }
  });

  // Trap focus inside drawer while open
  drawer.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var focusable = drawer.querySelectorAll('a[href], button:not([disabled])');
    if (focusable.length === 0) return;
    var first = focusable[0];
    var last  = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // Highlight current page in menu
  var path = window.location.pathname;
  var items = drawer.querySelectorAll('.menu-item');
  items.forEach(function (item) {
    var href = item.getAttribute('href');
    var active = false;

    // Orders: home page
    if (href === '/' || href === '/index.html') {
      active = (path === '/' || path === '/index.html');
    }
    // Management section (includes sub-pages)
    else if (href === '/management.html') {
      active = (path === '/management.html' ||
                path === '/shift-planning.html' ||
                path === '/designer.html');
    }
    // Exact match fallback
    else {
      active = (path === href);
    }

    if (active) item.classList.add('menu-item--active');
  });
})();
