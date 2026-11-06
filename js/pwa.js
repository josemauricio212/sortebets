/* SorteBets: instalação PWA para Android e desktop.
   A API do placar permanece online; nunca é armazenada pelo service worker. */
(() => {
  "use strict";
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
  addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // O site continua funcionando normalmente mesmo sem suporte a PWA.
    });
  });
})();
