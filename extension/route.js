/* Runs before preferences and IPC. Ordinary content/search pages are visible
   immediately; only home routes get the recommendation veil. */
(() => {
  const root = document.documentElement, listeners = new Set();
  let last = "";
  function attribute(name, value) { if (root.dataset[name] !== value) root.dataset[name] = value; }
  function sync(value = location.href, notify = true) {
    const site = FocusSearch.siteFor(value);
    if (!site) return;
    const home = FocusSearch.isHome(value), changed = value !== last;
    attribute("focusSite", site);
    attribute("focusHome", String(home));
    attribute("focusHomeHost", String([`${site}.com`, `www.${site}.com`].includes(new URL(value).hostname)));
    if (changed) {
      last = value;
      attribute("focusView", home && root.dataset.focusBreak !== "active" && root.dataset.focusSetup !== "active" ? "entry" : "content");
      if (notify) listeners.forEach(listener => listener());
    }
  }
  sync();
  if (globalThis.navigation) {
    navigation.addEventListener("navigate", event => {
      if (FocusSearch.isHome(event.destination.url)) sync(event.destination.url, false);
      setTimeout(() => sync(), 0); // Also reconcile a canceled navigation.
    });
    navigation.addEventListener("currententrychange", () => { sync(); listeners.forEach(listener => listener()); });
  }
  addEventListener("popstate", () => sync());
  if (!globalThis.navigation) setInterval(() => sync(), 1000); // Fallback for browsers without Navigation API.
  globalThis.FocusRoute = Object.freeze({sync, subscribe(listener) { listeners.add(listener); }});
})();
