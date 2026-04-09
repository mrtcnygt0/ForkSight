/**
 * inject.js — MAIN world'da document_start'ta çalışır.
 * Chessground kütüphanesi mousedown handler'ında e.isTrusted kontrolü yapar.
 * Sentetik (programatik) olaylar isTrusted=false olduğu için reddedilir.
 * Bu script addEventListener'ı patchleyerek cg-board üzerindeki mousedown
 * olaylarını Proxy ile sarar ve isTrusted'ı true olarak raporlar.
 */
(function () {
  "use strict";

  const origAddEventListener = EventTarget.prototype.addEventListener;

  EventTarget.prototype.addEventListener = function (type, listener, options) {
    // Sadece cg-board elementlerinin mousedown/touchstart handler'larını sar
    if (
      (type === "mousedown" || type === "touchstart") &&
      this.tagName === "CG-BOARD" &&
      typeof listener === "function"
    ) {
      const origListener = listener;
      const wrappedListener = function (e) {
        if (!e.isTrusted) {
          // Proxy ile isTrusted'ı true olarak raporla
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
