(() => {
  const catalogs = globalThis.FocusMessages;
  const listeners = new Set();
  const normalize = value => /^zh/i.test(value || "") ? "zh_CN" : "en";
  let language = normalize(chrome.i18n.getUILanguage());
  let languageRevision = 0;
  function t(key, values = {}, theme = FocusTheme) {
    const params = {...(theme === "friend" && key === "headline" ? FocusFriend.current : {}), ...values};
    if (params.site) params.site = t(params.site === "bilibili" ? "siteBilibili" : "siteXiaohongshu");
    const themed = globalThis.FocusThemeMessages[theme] || {};
    return (themed[language]?.[key] ?? catalogs[language][key] ?? themed.en?.[key] ?? catalogs.en[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ""));
  }
  function notify() { listeners.forEach(listener => listener(language)); }
  function apply(scope = document) {
    scope.querySelectorAll("[data-i18n]").forEach(node => { const value = t(node.dataset.i18n); if (node.textContent !== value) node.textContent = value; });
    for (const [attribute, dataset] of [["placeholder", "i18nPlaceholder"], ["aria-label", "i18nAria"], ["title", "i18nTitle"]]) {
      const selector = `data-${dataset.replace(/[A-Z]/g, letter => "-" + letter.toLowerCase())}`;
      scope.querySelectorAll(`[${selector}]`).forEach(node => { const value = t(node.dataset[dataset]); if (node.getAttribute(attribute) !== value) node.setAttribute(attribute, value); });
    }
  }
  const ready = Promise.all([FocusThemes.ready, FocusFriend.ready, FocusAsync.local.get("language")]).then(([, , saved]) => {
    if (!languageRevision && saved.language) language = normalize(saved.language);
  }).catch(() => {});
  FocusThemes.subscribe(notify);
  FocusFriend.subscribe(notify);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.language) {
      languageRevision++;
      language = normalize(changes.language.newValue || chrome.i18n.getUILanguage());
      notify();
    }
  });
  globalThis.FocusI18n = {
    ready, t, apply,
    get language() { return language; },
    async setLanguage(value) { language = normalize(value); await FocusAsync.local.set({language}); notify(); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    mountLanguageControls(parent) {
      const group = document.createElement("div");
      group.className = "language-switch"; group.setAttribute("role", "group");
      group.innerHTML = '<button type="button" data-lang="zh_CN" aria-label="切换为中文">中</button><span aria-hidden="true">/</span><button type="button" data-lang="en" aria-label="Switch to English">EN</button>';
      group.querySelectorAll("button").forEach(button => button.addEventListener("click", () => globalThis.FocusI18n.setLanguage(button.dataset.lang).catch(() => {})));
      const render = () => { group.setAttribute("aria-label", t("languageLabel")); group.querySelectorAll("button").forEach(button => { button.setAttribute("aria-pressed", String(button.dataset.lang === language)); button.setAttribute("aria-label", t(button.dataset.lang === "zh_CN" ? "switchToChinese" : "switchToEnglish")); }); };
      render(); listeners.add(render); parent.append(group); return group;
    },
    error(error) { return error?.code ? t(error.code, error.params) : error?.message || t("unexpectedError"); }
  };
})();
