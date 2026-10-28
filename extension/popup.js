(async () => {
  await FocusI18n.ready;
  FocusI18n.mountLanguageControls(document.body);
  FocusAppearance.mount(document.body, {inline: true});
  const render = () => {
    document.documentElement.lang = FocusI18n.language === "zh_CN" ? "zh-CN" : "en";
    document.documentElement.dataset.theme = FocusTheme;
    document.title = FocusI18n.t("brand");
    FocusI18n.apply();
    document.documentElement.dataset.uiReady = "true";
  };
  FocusI18n.subscribe(render); render();
})().catch(error => {
  document.documentElement.dataset.uiReady = "true";
  const status = document.createElement("p"); status.setAttribute("role", "status");
  status.textContent = FocusI18n.error(error); document.body.append(status);
});
