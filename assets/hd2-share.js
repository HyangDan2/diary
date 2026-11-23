/* ==========================================================================
   HD2Lab · share (link) button
   --------------------------------------------------------------------------
   One floating button per page, where the Light/Dark toggle used to sit.

     · a touch device with the Web Share API -> the system share sheet
       ({ title, url }; a dismissed sheet — AbortError — says nothing)
     · anything else (a desktop pointer, an older browser) -> copy the URL,
       then confirm it in the toast

   The markup carries both languages; this file picks the one that matches
   the page's <html lang>. Styles: /assets/hd2-share.css
   ========================================================================== */
(function () {
  'use strict';

  var button = document.querySelector('[data-hd2-share]');
  if (!button) return;

  var toast = document.querySelector('[data-hd2-share-toast]');
  var hideTimer = 0;
  var TOAST_MS = 3000;

  function korean() {
    var lang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    return lang.indexOf('ko') === 0;
  }

  /* data-copied-ko / data-copied-en, with a sensible default */
  function wording(key, fallbackKo, fallbackEn) {
    var value = korean()
      ? button.getAttribute('data-' + key + '-ko')
      : button.getAttribute('data-' + key + '-en');
    return value || (korean() ? fallbackKo : fallbackEn);
  }

  function showToast(text) {
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add('is-visible');
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(function () {
      toast.classList.remove('is-visible');
    }, TOAST_MS);
  }

  /* clipboard.writeText needs a secure context; http or an old engine gets this */
  function legacyCopy(text) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);

    var copied = false;
    try {
      area.select();
      area.setSelectionRange(0, area.value.length);
      copied = document.execCommand('copy');
    } catch (error) {
      copied = false;
    }

    document.body.removeChild(area);
    return copied;
  }

  function copyLink() {
    var url = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(url).then(
        function () {
          return true;
        },
        function () {
          return legacyCopy(url);
        }
      );
    }
    return Promise.resolve(legacyCopy(url));
  }

  function copyAndConfirm() {
    return copyLink().then(function (copied) {
      showToast(
        copied
          ? wording('copied', '링크가 복사되었어요', 'Link copied')
          : wording('failed', '링크를 복사하지 못했어요', 'Could not copy the link')
      );
    });
  }

  /* the share sheet belongs to a finger; a mouse gets the clipboard + toast */
  function prefersShareSheet() {
    if (typeof navigator.share !== 'function') return false;
    if (navigator.maxTouchPoints > 0) return true;
    try {
      return window.matchMedia('(pointer: coarse)').matches;
    } catch (error) {
      return false;
    }
  }

  button.addEventListener('click', function () {
    var url = window.location.href;

    if (prefersShareSheet()) {
      navigator.share({ title: document.title, url: url }).catch(function (error) {
        if (error && error.name === 'AbortError') return; /* the sheet was closed */
        copyAndConfirm(); /* share refused (permissions, no target) — still useful */
      });
      return;
    }

    copyAndConfirm();
  });
})();
