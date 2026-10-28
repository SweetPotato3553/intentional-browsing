/* A saved-posts URL also works when the native SPA ignores its tab parameter. */
(() => {
  let route = "", done = false, attempts = 0, lastAttempt = -Infinity;
  const tabSelectors = '[role="tab"],.reds-tab-item,.reds-tabs-tab,.tab-item,.tabs-item,[class*="tab-item"],[class*="tabItem"],[role="tablist"] button,.reds-tabs button,.profile-tabs button';
  function active(element) {
    return element.getAttribute("aria-selected") === "true" || element.dataset.state === "active" ||
      /(?:^|[\s_-])(?:active|selected|current)(?:$|[\s_-])/.test(element.className);
  }
  function ensure() {
    if (route !== location.href) { route = location.href; done = false; attempts = 0; lastAttempt = -Infinity; }
    if (done || FocusSearch.siteFor(route) !== "xiaohongshu" || !FocusSearch.isCollectionPage("xiaohongshu", route) || document.readyState === "loading") return;
    const tabs = [...document.querySelectorAll(tabSelectors)].filter(element =>
      /^(?:收藏|我的收藏|已收藏|saved|collections?|favorites?)(?:\s*[\d,.万wWkK+]+)?$/i.test(element.textContent.trim()) && FocusLogin.visible(element));
    if (tabs.some(active)) { done = true; return; }
    if (!tabs.length || attempts >= 20 || Date.now() - lastAttempt < 1200) return;
    lastAttempt = Date.now(); attempts++;
    tabs[0].click();
    if (active(tabs[0])) done = true;
  }
  document.addEventListener("click", event => {
    if (event.isTrusted && event.target.closest?.(tabSelectors) && FocusSearch.isCollectionPage("xiaohongshu", location.href)) {
      route = location.href; done = true;
    }
  }, true);
  globalThis.FocusCollectionTabs = Object.freeze({ensure});
})();
