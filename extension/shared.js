/* Original implementation; no third-party code or runtime dependencies. */
(() => {
  const sites = Object.freeze({
    bilibili: {name: "B站", entry: "bilibili.html", home: "https://www.bilibili.com/"},
    xiaohongshu: {name: "小红书", entry: "xiaohongshu.html", home: "https://www.xiaohongshu.com/"}
  });
  const defaultFavorites = Object.freeze({bilibili: "", xiaohongshu: ""});
  function failure(code, params = {}) { return Object.assign(new Error(code), {code, params}); }
  function favoriteUrl(site, value) {
    if (!sites[site]) throw failure("invalidSite");
    let url;
    try { url = new URL(String(value).trim()); } catch { throw failure("invalidFavorite", {site}); }
    const hosts = site === "bilibili" ? ["bilibili.com", "www.bilibili.com", "space.bilibili.com"] : ["xiaohongshu.com", "www.xiaohongshu.com"];
    if (url.protocol !== "https:" || !hosts.includes(url.hostname) || url.username || url.password || url.port) throw failure("favoriteHttps", {site});
    if (isHome(url.href)) throw failure("favoriteNotHome");
    return url.href;
  }
  function pendingUrl(pending) {
    return pending.kind === "favorite" ? favoriteUrl(pending.site, pending.target) : searchUrl(pending.site, pending.keyword);
  }
  function isCollectionPage(site, value) {
    let url;
    try { url = new URL(favoriteUrl(site, value)); } catch { return false; }
    if (site === "bilibili") {
      return (url.hostname === "space.bilibili.com" && /^\/\d+\/favlist\/?$/.test(url.pathname) && /^\d+$/.test(url.searchParams.get("fid") || "")) ||
        (url.hostname === "space.bilibili.com" && /^\/\d+\/lists\/(?:ml)?\d+\/?$/.test(url.pathname)) ||
        (url.hostname === "www.bilibili.com" && /^\/(?:medialist\/(?:detail|play)|list)\/ml\d+\/?$/.test(url.pathname));
    }
    return /^\/user\/profile\/[a-zA-Z0-9]+\/?$/.test(url.pathname) && url.searchParams.get("tab") === "fav";
  }
  function collectionTarget(site, value) {
    const url = new URL(favoriteUrl(site, value));
    if (site === "xiaohongshu" && /^\/user\/profile\/[a-zA-Z0-9]+\/?$/.test(url.pathname)) {
      // Xiaohongshu can switch profile tabs without updating the address bar.
      // A profile is enough to construct its saved-posts destination explicitly.
      url.searchParams.set("tab", "fav");
      if (!url.searchParams.has("subTab")) url.searchParams.set("subTab", "note");
      return url.href;
    }
    if (!isCollectionPage(site, value)) throw failure("setupChooseCollection");
    return url.href;
  }
  function searchUrl(site, keyword) {
    const word = String(keyword).trim();
    if (!sites[site] || !word) throw failure("emptySearch");
    const url = new URL(site === "bilibili" ? "https://search.bilibili.com/all" : "https://www.xiaohongshu.com/search_result");
    url.searchParams.set("keyword", word);
    if (site === "xiaohongshu") url.searchParams.set("source", "web_explore_feed");
    return url.href;
  }
  function siteFor(url) {
    let value;
    try { value = new URL(url); } catch { return null; }
    if (!["http:", "https:"].includes(value.protocol)) return null;
    const host = value.hostname;
    if (["bilibili.com", "www.bilibili.com", "search.bilibili.com", "space.bilibili.com"].includes(host)) return "bilibili";
    if (["xiaohongshu.com", "www.xiaohongshu.com"].includes(host)) return "xiaohongshu";
    return null;
  }
  function isHome(url) {
    let u; try { u = new URL(url); } catch { return false; }
    const site = siteFor(url);
    return site === "bilibili" ? ["bilibili.com", "www.bilibili.com"].includes(u.hostname) && /^\/(index\.html)?$/.test(u.pathname) : site === "xiaohongshu" && /^\/(explore\/?)?$/.test(u.pathname);
  }
  globalThis.FocusSearch = Object.freeze({sites, defaultFavorites, favoriteUrl, pendingUrl, searchUrl, siteFor, isHome, isCollectionPage, collectionTarget, failure});
})();
