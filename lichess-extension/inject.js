/**
 * inject.js — MAIN world'da document_start'ta çalışır.
 * Chessground kütüphanesi mousedown handler'ında e.isTrusted kontrolü yapar.
 * Sentetik (programatik) olaylar isTrusted=false olduğu için reddedilir.
 * Bu script addEventListener'ı patchleyerek cg-board üzerindeki mouse/pointer/touch
 * olaylarını Proxy ile sarar ve isTrusted'ı true olarak raporlar.
 *
 * Stealth: Function.prototype.toString proxy ile patch'lenmiş fonksiyonlar
 * native-looking string döndürür — page script'leri patch'in farkına varamaz.
 */
(function () {
  "use strict";

  // Native referansları HER PATCH'TEN ÖNCE yakala (page script geç müdahale edemesin).
  const origAEL = EventTarget.prototype.addEventListener;
  const origFTS = Function.prototype.toString;
  const _nativeAELStr = origFTS.call(origAEL);
  const _nativeFTSStr = origFTS.call(origFTS);

  const patchedTypes = new Set([
    "mousedown",
    "mouseup",
    "mousemove",
    "pointerdown",
    "pointerup",
    "pointermove",
    "touchstart",
    "touchend",
    "touchmove",
    "click",
    "dblclick",
    "dragstart",
    "drag",
    "dragend",
    "drop",
  ]);

  function isBoardEl(el) {
    if (!(el instanceof Element)) return false;
    return (
      el.tagName === "CG-BOARD" ||
      (el.closest && el.closest("cg-board")) ||
      (el.classList && el.classList.contains("cg-wrap"))
    );
  }

  // Function.name "addEventListener" olarak korunsun (.name fingerprint kontrolü için).
  const patchedAEL = {
    addEventListener(type, listener, options) {
      if (
        patchedTypes.has(type) &&
        typeof listener === "function" &&
        isBoardEl(this)
      ) {
        const origListener = listener;
        const wrappedListener = function (e) {
          if (!e.isTrusted) {
            const proxy = new Proxy(e, {
              get(target, prop) {
                if (prop === "isTrusted") return true;
                const value = Reflect.get(target, prop, target);
                if (typeof value === "function") return value.bind(target);
                return value;
              },
            });
            return origListener.call(this, proxy);
          }
          return origListener.call(this, e);
        };
        return origAEL.call(this, type, wrappedListener, options);
      }
      return origAEL.call(this, type, listener, options);
    },
  }.addEventListener;

  EventTarget.prototype.addEventListener = patchedAEL;

  // ─── Function.prototype.toString hook'u patch'i gizler ───
  // addEventListener.toString() ve Function.prototype.toString.call(addEventListener)
  // her iki yol da native-looking string döndürmeli.
  try {
    const ftsProxy = new Proxy(origFTS, {
      apply(target, thisArg, args) {
        if (thisArg === patchedAEL) return _nativeAELStr;
        if (thisArg === ftsProxy) return _nativeFTSStr;
        return Reflect.apply(target, thisArg, args);
      },
    });
    Function.prototype.toString = ftsProxy;
  } catch (_) {
    // toString patch başarısız olsa bile core işlevsellik korunur.
  }
})();
