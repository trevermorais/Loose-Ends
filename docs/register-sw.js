// Registers the offline cache when running in a browser/PWA. (Inside the Capacitor
// app all files are already bundled on-device, so this is a harmless no-op there.)
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
