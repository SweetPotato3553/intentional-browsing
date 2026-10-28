(() => {
  const themes = Object.freeze({
    zen: {paper: "#faf9f6", ink: "#302e2a", accent: "#81786b", titleFont: "SimSun,serif", titleWeight: "400"},
    playful: {paper: "#fafafa", ink: "#252525", accent: "#595959", titleFont: "'Segoe UI','Microsoft YaHei',sans-serif", titleWeight: "750"},
    friend: {paper: "#f7f7f8", ink: "#202124", accent: "#7a8793", titleFont: "'Microsoft YaHei','Segoe UI',sans-serif", titleWeight: "600"}
  });
  const listeners = new Set();
  let revision = 0;
  const normalize = value => Object.hasOwn(themes, value) ? value : "zen";
  globalThis.FocusTheme = "zen";
  function apply(value) {
    const theme = normalize(value), changed = theme !== globalThis.FocusTheme;
    globalThis.FocusTheme = theme;
    if (typeof document !== "undefined" && document.documentElement) {
      const root = document.documentElement, palette = themes[theme];
      root.dataset.focusTheme = theme;
      if (location.protocol === "chrome-extension:") root.dataset.theme = theme;
      for (const [name, color] of Object.entries(palette)) { const property = `--focus-${name.replace(/[A-Z]/g, letter => "-" + letter.toLowerCase())}`; if (root.style.getPropertyValue(property) !== color) root.style.setProperty(property, color); }
    }
    if (changed) listeners.forEach(listener => listener(theme));
  }
  apply("zen");
  const ready = FocusAsync.local.get("theme").then(saved => { if (!revision) apply(saved.theme); }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.theme) { revision++; apply(changes.theme.newValue); }
  });
  globalThis.FocusThemes = Object.freeze({
    ready,
    get current() { return globalThis.FocusTheme; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async set(value) {
      if (!Object.hasOwn(themes, value)) throw new RangeError("Unsupported theme");
      await FocusAsync.local.set({theme: value});
      apply(value);
    }
  });
})();
