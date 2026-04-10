/**
 * inject.js — MAIN world'da document_start'ta çalışır.
 * Chess.com'un wc-chess-board bileşeni isTrusted kontrolü yapabilir.
 * Bu script addEventListener'ı patchleyerek board üzerindeki mouse/pointer
 * olaylarını Proxy ile sarar ve isTrusted'ı true olarak raporlar.
 */
(function () {
  "use strict";

  const origAddEventListener = EventTarget.prototype.addEventListener;
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

  EventTarget.prototype.addEventListener = function (type, listener, options) {
    // Sadece chess board elementlerinin event handler'larını sar
    if (
      patchedTypes.has(type) &&
      typeof listener === "function" &&
      this instanceof Element &&
      (this.tagName === "WC-CHESS-BOARD" ||
        this.closest?.("wc-chess-board") ||
        this.classList?.contains("board"))
    ) {
      const origListener = listener;
      const wrappedListener = function (e) {
        if (!e.isTrusted) {
          const proxy = new Proxy(e, {
            get(target, prop, receiver) {
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
      return origAddEventListener.call(this, type, wrappedListener, options);
    }
    return origAddEventListener.call(this, type, listener, options);
  };
})();
