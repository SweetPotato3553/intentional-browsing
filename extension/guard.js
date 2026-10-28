(() => {
  "use strict";
  const I = FocusI18n;
  const site = FocusSearch.siteFor(location.href);
  if (!site) return;
  const palette = {paper:"var(--focus-paper,#faf9f6)",ink:"var(--focus-ink,#302e2a)",accent:"var(--focus-accent,#81786b)"};
  const root = document.documentElement;
  root.dataset.focusSite = site;
  root.dataset.focusTheme = FocusTheme;
  root.dataset.focusHomeHost = String([`${site}.com`, `www.${site}.com`].includes(location.hostname));
  const entry = chrome.runtime.getURL(FocusSearch.sites[site].entry);
  let mutationTimer = null;
  let lastUrl = "", scheduled = false, redirecting = false, panel, shadow;
  let seenLogin = false, resumeInFlight = false;
  let breakChecked = false, rest = null, endingRest = false, timerHost, timerShadow;
  let setup = null, setupHost, setupShadow, endingSetup = false, savingSetup = false;
  let breakVersion = 0, setupVersion = 0, refreshInFlight = null, lastStateCheck = 0;
  let setupStamp = "", timerStamp = "", panelStamp = "";
  const message = (type, extra = {}) => FocusAsync.request({type, site, ...extra});
  FocusRoute.sync();
  function maskSetupEnd() {
    endingSetup = true;
    FocusFloatingToolbar.clear();
    root.removeAttribute("data-focus-setup");
    root.dataset.focusView = "entry";
    document.querySelectorAll("video,audio").forEach(media => media.pause());
    setupHost?.remove();
    ensurePanel(false);
    setTimeout(() => { if (endingSetup) location.replace(entry + (setup?.purpose === "login" ? "?login=ended" : "?setup=ended")); }, 1200);
  }
  let cancelPending = false, cancelRetryAt = 0, breakRetryAt = 0;
  async function cancelSetup() {
    if (endingSetup || cancelPending || Date.now() < cancelRetryAt) return;
    cancelPending = true;
    try { await message("SETUP_CANCEL"); }
    catch (error) {
      cancelRetryAt = Date.now() + 10000;
      if (setupShadow) { setupShadow.querySelector(".error").textContent = I.error(error); FocusFloatingToolbar.expand(); }
    } finally { cancelPending = false; }
  }
  function renderSetup() {
    if (!setup || setup.quiet || endingSetup) return;
    if (setup.until <= Date.now()) { cancelSetup(); return; }
    if (!document.body) return;
    const stamp = [Math.ceil((setup.until - Date.now()) / 1000), setup.until, location.href, savingSetup, I.language, FocusTheme].join("|");
    if (setupHost?.isConnected && setupStamp === stamp) return;
    setupStamp = stamp;
    if (!setupHost?.isConnected) {
      setupHost = document.createElement("div");
      setupHost.id = "focus-collection-setup";
      setupHost.style.cssText = "all:initial!important;display:block!important;position:fixed!important;left:12px!important;top:12px!important;width:780px!important;max-width:calc(100vw - 24px)!important;z-index:2147483647!important;visibility:visible!important;";
      setupShadow = setupHost.attachShadow({mode: "closed"});
      setupShadow.innerHTML = `<style>
        :host{all:initial}*{box-sizing:border-box}
        .helper{display:flex;align-items:center;gap:16px;padding:14px 16px;border:1px solid #bbb;border-radius:8px;background:${palette.paper};color:${palette.ink};font:12px/1.6 'Segoe UI','Microsoft YaHei',sans-serif;box-shadow:0 4px 24px #00000018}
        .copy{flex:1;min-width:0;cursor:grab;touch-action:none}strong{font-size:14px;font-family:var(--focus-title-font);font-weight:var(--focus-title-weight)}p{font-size:12px;margin:4px 0 0;color:#6b6b6b}
        .actions{display:flex;align-items:center;gap:14px;flex-shrink:0}
        button{font:12px 'Segoe UI','Microsoft YaHei',sans-serif;padding:7px 0;background:transparent;color:${palette.ink};border:0;border-bottom:1px solid #999;cursor:pointer;white-space:nowrap}
        .capture{min-height:44px;padding:10px 18px;border:1px solid ${palette.ink};border-radius:4px;background:${palette.ink};color:${palette.paper};font-size:15px;font-weight:600}
        button:disabled{opacity:.4;cursor:default}button:focus-visible{outline:2px solid #777;outline-offset:4px}
        .drag-handle{font-size:22px;line-height:1;border:0;padding:4px 0;cursor:grab;touch-action:none;flex-shrink:0;color:#777}.drag-handle:active,.copy:active{cursor:grabbing}
        .collapse{font-size:12px;flex-shrink:0}
        .countdown{text-align:center;flex-shrink:0}.time-label{display:block;font-size:11px;color:#6b6b6b}.time{display:block;font-size:28px;line-height:1.2;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:1px}
        .error{color:#555}.error:empty{display:none}
        .collapsed{width:max-content;max-width:100%;gap:10px;padding:8px 12px}.collapsed .copy,.collapsed .time-label,.collapsed .cancel{display:none}.collapsed .time{font-size:20px}.collapsed .capture{font-size:13px;min-height:34px;padding:6px 10px}.collapsed .actions{gap:12px}
        @media(max-width:760px){.helper:not(.collapsed){flex-wrap:wrap;gap:12px 16px}.helper:not(.collapsed) .copy{flex-basis:calc(100% - 50px)}.helper:not(.collapsed) .countdown{text-align:left;margin-right:auto;margin-left:32px}.time{font-size:26px}.actions{gap:12px}}
        @media(max-width:360px){.capture{padding:8px 12px}.helper{padding:12px}.collapsed{padding:8px 10px}}
      </style><aside class="helper"><button type="button" class="drag-handle" data-i18n-title="setupDrag" data-i18n-aria="setupDrag">⠿</button><div class="copy" data-i18n-title="setupDrag"><strong data-i18n="setupTitle"></strong><p class="instruction"></p><p class="error" role="status"></p></div><div class="countdown"><span class="time-label" data-i18n="setupTimeLabel"></span><span class="time" role="timer"></span></div><div class="actions"><button type="button" class="capture" data-i18n="setupCapture"></button><button type="button" class="cancel" data-i18n="setupCancel"></button><button type="button" class="collapse" data-i18n="setupCollapse" aria-expanded="true"></button></div></aside>`;
      setupShadow.querySelector(".cancel").addEventListener("click", cancelSetup);
      setupShadow.querySelector(".capture").addEventListener("click", async () => {
        if (savingSetup) return;
        savingSetup = true; renderSetup();
        try { await message(setup.purpose === "login" ? "LOGIN_FINISH" : "SETUP_CAPTURE"); }
        catch (error) { if (setupShadow) { setupShadow.querySelector(".error").textContent = I.error(error); FocusFloatingToolbar.expand(); } }
        finally { savingSetup = false; renderSetup(); }
      });
      document.body.append(setupHost);
    }
    I.apply(setupShadow);
    setupHost.lang = I.language === "zh_CN" ? "zh-CN" : "en";
    const loginAccess = setup.purpose === "login";
    let valid = loginAccess;
    if (!valid) { try { FocusSearch.collectionTarget(site, location.href); valid = true; } catch {} }
    setupShadow.querySelector("strong").textContent = I.t(loginAccess ? "loginTitle" : "setupTitle");
    setupShadow.querySelector(".instruction").textContent = I.t(loginAccess ? "loginWindowHelp" : valid ? site === "xiaohongshu" ? "setupProfileReady" : "setupReady" : "setupChooseCollection");
    setupShadow.querySelector(".time-label").textContent = I.t(loginAccess ? "loginTimeLabel" : "setupTimeLabel");
    setupShadow.querySelector(".cancel").textContent = I.t(loginAccess ? "loginReturn" : "setupCancel");
    const capture = setupShadow.querySelector(".capture");
    capture.textContent = I.t(loginAccess ? "loginContinue" : "setupCapture");
    capture.disabled = !valid || savingSetup;
    if (savingSetup) capture.textContent = I.t("setupBusy");
    const seconds = Math.ceil((setup.until - Date.now()) / 1000);
    const time = `${String(Math.floor(seconds / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`;
    const clock = setupShadow.querySelector(".time");
    clock.textContent = time;
    clock.setAttribute("aria-label", I.t(loginAccess ? "loginRemaining" : "setupRemaining", {time}));
    FocusFloatingToolbar.mount(setupHost, setupShadow);
  }
  async function returnFromBreak(requestEnd) {
    if (endingRest || (requestEnd && Date.now() < breakRetryAt)) return;
    endingRest = true;
    if (requestEnd) {
      try { await message("BREAK_END"); }
      catch (error) {
        endingRest = false; breakRetryAt = Date.now() + 10000;
        if (timerShadow) {
          let status = timerShadow.querySelector("[role=status]");
          if (!status) { status = document.createElement("p"); status.setAttribute("role", "status"); status.style.cssText = "max-width:180px;font:12px sans-serif"; timerShadow.querySelector("aside").append(status); }
          status.textContent = I.error(error);
          timerShadow.querySelector("button").style.opacity = "1";
        }
        return;
      }
    }
    rest = null; root.removeAttribute("data-focus-break"); timerHost?.remove();
    if (!FocusSearch.isHome(location.href)) { endingRest = false; update(); return; }
    root.dataset.focusView = "entry";
    document.querySelectorAll("video,audio").forEach(media => media.pause());
    ensurePanel(false);
    // Only arm the navigation fallback after the worker confirms revocation.
    // Normally tabs.update replaces this document before the fallback runs.
    setTimeout(() => { if (endingRest) location.replace(entry + "?rest=ended"); }, 1200);
  }
  function renderTimer() {
    if (!rest || endingRest || setup || endingSetup) return;
    const remaining = rest.until - Date.now();
    if (remaining <= 0) { returnFromBreak(true); return; }
    if (!document.body) return;
    const stamp = [Math.ceil(remaining / 1000), rest.until, I.language, FocusTheme].join("|");
    if (timerHost?.isConnected && timerStamp === stamp) return;
    timerStamp = stamp;
    if (!timerHost?.isConnected) {
      timerHost = document.createElement("div");
      timerHost.id = "focus-break-timer";
      timerHost.style.cssText = "all:initial!important;position:fixed!important;right:12px!important;top:50%!important;transform:translateY(-50%)!important;z-index:2147483000!important;visibility:visible!important;";
      timerShadow = timerHost.attachShadow({mode: "closed"});
      timerShadow.innerHTML = `<style>:host{all:initial}.timer{display:flex;flex-direction:column;align-items:center;gap:10px;padding:12px 7px;color:#716a60;background:${palette.paper};font:10px/1.4 'Segoe UI','Microsoft YaHei',sans-serif;letter-spacing:.5px}.track{height:84px;width:3px;background:#ded9d0;overflow:hidden}.fill{height:100%;background:${palette.accent};transform-origin:bottom}.remaining{font-variant-numeric:tabular-nums}button{border:0;background:transparent;padding:3px 0;color:#716a60;font:10px 'Microsoft YaHei',sans-serif;cursor:pointer;opacity:0}.timer:hover button,button:focus-visible{opacity:1}button:focus-visible{outline:1px solid #827c72;outline-offset:3px}</style><aside class="timer" data-i18n-aria="timerLabel"><div class="track" role="progressbar" data-i18n-aria="timerRemaining" aria-valuemin="0" aria-valuemax="100"><div class="fill"></div></div><span class="remaining"></span><button type="button" data-i18n-title="timerEndTitle" data-i18n="timerEnd"></button></aside>`;
      timerShadow.querySelector("button").addEventListener("click", () => returnFromBreak(true));
      document.body.append(timerHost);
    }
    const seconds = Math.ceil(remaining / 1000);
    const fraction = Math.min(1, Math.max(0, remaining / (rest.until - rest.started)));
    const label = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    I.apply(timerShadow);
    timerHost.lang = I.language === "zh_CN" ? "zh-CN" : "en";
    timerShadow.querySelector(".remaining").textContent = label;
    timerShadow.querySelector(".fill").style.transform = `scaleY(${fraction})`;
    timerShadow.querySelector(".track").setAttribute("aria-valuenow", String(Math.round(fraction * 100)));
    timerShadow.querySelector(".track").setAttribute("aria-valuetext", I.t("timerValue", {time: label}));
  }
  function ensurePanel(loginMode) {
    if (!document.body) return;
    const stamp = [loginMode, I.language, FocusTheme].join("|");
    if (panel?.isConnected && panelStamp === stamp) return;
    panelStamp = stamp;
    if (!panel?.isConnected) {
      panel = document.createElement("div");
      panel.id = "focus-search-guard";
      panel.style.cssText = "position:fixed!important;inset:0!important;z-index:2147483000!important;pointer-events:none!important;visibility:visible!important;";
      shadow = panel.attachShadow({mode: "closed"});
      shadow.innerHTML = `<style>:host{all:initial}*{box-sizing:border-box}.hint{font:13px/1.8 'Segoe UI','Microsoft YaHei',sans-serif;position:absolute;left:28px;top:24px;max-width:460px;padding:12px 0;color:${palette.ink};background:${palette.paper};border-top:1px solid #cfcac1;pointer-events:auto}strong{font-family:var(--focus-title-font);font-weight:var(--focus-title-weight);font-size:16px;letter-spacing:1px}p{margin:8px 0 15px;color:#807a71;font-size:11px}button,a{font:inherit;font-size:11px;color:#4c463e;margin-right:18px;cursor:pointer}button{background:transparent;border:0;border-bottom:1px solid #cfcac1;padding:5px 0}a{text-decoration-color:#c8c1b6;text-underline-offset:5px}.error{color:#805746}</style><section class="hint"><strong></strong><p data-i18n="loginHelp"></p><button type="button" data-i18n="loginContinue"></button><a data-i18n="loginReturn"></a><p class="error" role="status"></p></section>`;
      shadow.querySelector("a").href = entry;
      shadow.querySelector("button").addEventListener("click", () => continueSearch().catch(showError));
      const retry = document.createElement("button");
      retry.type = "button"; retry.dataset.i18n = "loginRetry";
      retry.addEventListener("click", () => { FocusLogin.open(true); update(); });
      const fallback = document.createElement("button");
      fallback.type = "button"; fallback.dataset.i18n = "loginFallback";
      fallback.addEventListener("click", async () => {
        if (fallback.disabled) return;
        fallback.disabled = true;
        try {
          const result = await message("LOGIN_START");
          setup = result.setup;
          update();
          location.assign("https://www.xiaohongshu.com/explore?focus_login=1");
        } catch (error) { fallback.disabled = false; showError(error); }
      });
      shadow.querySelector("section").append(retry, fallback);
      document.body.append(panel);
    }
    I.apply(shadow);
    shadow.querySelector("strong").textContent = I.t(loginMode ? "loginTitle" : "openingEntry");
    shadow.querySelector("button").hidden = !loginMode;
    shadow.querySelector("p").hidden = !loginMode;
    shadow.querySelectorAll("button[data-i18n=loginRetry],button[data-i18n=loginFallback]").forEach(button => { button.hidden = !loginMode; });
  }
  function showError(error) { if (shadow) shadow.querySelector(".error").textContent = I.error(error); }
  async function continueSearch() {
    if (resumeInFlight) return;
    resumeInFlight = true;
    try {
      if (setup?.purpose === "login") { await message("LOGIN_FINISH"); return; }
      const {pending} = await message("GET");
      await message("DONE");
      location.replace(pending?.site === site ? FocusSearch.pendingUrl(pending) : entry);
    } catch (error) { resumeInFlight = false; throw error; }
  }
  function update() {
    if (scheduled) cancelAnimationFrame(scheduled);
    scheduled = false;
    FocusRoute.sync();
    if (endingRest || endingSetup) return;
    if (!breakChecked) { if (FocusSearch.isHome(location.href)) ensurePanel(false); return; }
    if (setup && !setup.quiet) {
      if (setup.until <= Date.now()) { cancelSetup(); return; }
      root.dataset.focusSetup = "active";
      root.dataset.focusView = "content";
      panel?.remove(); timerHost?.remove();
      renderSetup(); lastUrl = location.href;
      if (setup.purpose === "login" && site === "xiaohongshu") FocusLogin.open();
      return;
    }
    root.removeAttribute("data-focus-setup"); FocusFloatingToolbar.clear(); setupHost?.remove();
    if (rest) {
      if (rest.until <= Date.now()) { returnFromBreak(true); return; }
      root.dataset.focusBreak = "active";
      root.dataset.focusView = "content";
      panel?.remove();
      renderTimer();
      lastUrl = location.href;
      return;
    }
    root.removeAttribute("data-focus-break"); timerHost?.remove();
    if (setup?.quiet && setup.until <= Date.now()) { cancelSetup(); return; }
    const home = FocusSearch.isHome(location.href);
    const loginMode = site === "xiaohongshu" && home && new URL(location.href).searchParams.get("focus_login") === "1";
    const dialogs = site === "xiaohongshu" ? FocusLogin.nativeDialogs() : [];
    if (dialogs.length || loginMode) {
      root.dataset.focusView = "login";
      ensurePanel(true);
      if (dialogs.length && !seenLogin) {
        seenLogin = true;
        message("WAIT_LOGIN").catch(showError);
      }
      if (loginMode && !dialogs.length) FocusLogin.open();
      if (!dialogs.length && FocusLogin.signedIn()) continueSearch().catch(showError);
    } else if (home) {
      root.dataset.focusView = "entry";
      ensurePanel(false);
      if (!redirecting) { redirecting = true; location.replace(entry); }
    } else {
      root.dataset.focusView = "content";
      panel?.remove();
      FocusCollectionTabs.ensure();
      // Login overlays on search pages often close without a full navigation.
      if (seenLogin) {
        seenLogin = false;
        message("DONE").catch(() => {});
      }
    }
    lastUrl = location.href;
  }
  function schedule() {
    if (scheduled) return;
    scheduled = requestAnimationFrame(() => { scheduled = false; update(); });
  }
  function refreshState(reset = false) {
    if (reset) {
      breakVersion++; setupVersion++; endingRest = endingSetup = redirecting = resumeInFlight = false;
      breakChecked = false;
      if (!FocusSearch.isHome(location.href)) root.dataset.focusView = "content";
    } else if (refreshInFlight) return refreshInFlight;
    const versions = {rest: breakVersion, setup: setupVersion};
    lastStateCheck = Date.now();
    let stateReadOK = false;
    const task = Promise.allSettled([message("GET_BREAK"), message("GET_SETUP")]).then(([a, b]) => {
      stateReadOK = a.status === "fulfilled" && b.status === "fulfilled";
      if (a.status === "fulfilled" && versions.rest === breakVersion) rest = a.value.break;
      if (b.status === "fulfilled" && versions.setup === setupVersion) setup = b.value.setup;
    }).finally(() => {
      if (refreshInFlight === task) refreshInFlight = null;
      breakChecked = Boolean(rest || setup) || stateReadOK; update();
      if (!stateReadOK) setTimeout(() => refreshState(), 10000);
    });
    refreshInFlight = task;
    return task;
  }
  FocusRoute.subscribe(schedule);
  // Ignore our own hint panel so rendering it cannot trigger an observer loop.
  new MutationObserver(records => {
    if (records.some(record => {
      if (panel && (record.target === panel || panel.contains(record.target))) return false;
      if (timerHost && record.target === timerHost) return false;
      if (setupHost && record.target === setupHost) return false;
      if (record.type === "childList") {
        const changed = [...record.addedNodes, ...record.removedNodes];
        if (changed.length && changed.every(node => node === panel || node === timerHost || node === setupHost)) return false;
      }
      return true;
    })) { if (!mutationTimer) mutationTimer = setTimeout(() => { mutationTimer = null; schedule(); }, 150); }
  }).observe(root, {childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"]});
  addEventListener("popstate", update);
  addEventListener("pageshow", event => { if (event.persisted) refreshState(true); else update(); });
  const foreground = () => {
    renderTimer(); update();
    if (document.visibilityState === "visible" && Date.now() - lastStateCheck > 2000) refreshState();
  };
  addEventListener("focus", foreground);
  document.addEventListener("visibilitychange", foreground);
  chrome.runtime.onMessage.addListener(msg => {
    if (msg.type === "SETUP_CHANGED") {
      setupVersion++;
      if (msg.setup) { setup = msg.setup.site === site ? msg.setup : null; endingSetup = false; update(); }
      else if (msg.kept || setup?.inherited) { setup = null; endingSetup = false; root.removeAttribute("data-focus-setup"); setupHost?.remove(); update(); }
      else maskSetupEnd();
      return;
    }
    if (msg.type !== "BREAK_CHANGED" || msg.site !== site) return;
    breakVersion++;
    if (setup) { rest = msg.break; return; }
    if (msg.ended) { returnFromBreak(false); return; }
    rest = msg.break;
    breakChecked = true;
    update();
  });
  I.subscribe(() => { if (shadow) I.apply(shadow); if (setup) renderSetup(); else renderTimer(); if (breakChecked) update(); });
  setInterval(renderTimer, 1000);
  setInterval(renderSetup, 1000);
  setInterval(() => { if (!setup && !rest && !endingSetup && root.dataset.focusView === "content") FocusCollectionTabs.ensure(); }, 1200);
  // Retry after hydration even when the site makes no observable DOM change.
  setInterval(() => { if (site === "xiaohongshu" && (root.dataset.focusView === "login" || setup?.purpose === "login")) update(); }, 1200);
  // SPA route changes with no DOM mutation still get handled.
  setInterval(() => { if (location.href !== lastUrl) update(); }, 1000);
  // Search/content is already visible via route.js; only home routes wait here.
  I.ready.then(() => refreshState());
})();
