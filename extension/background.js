importScripts("async.js", "shared.js");
importScripts("collection-setup.js");
const keyFor = id => `tab:${id}`;
const fresh = item => item && Date.now() - item.created < 30 * 60 * 1000;
const breakKey = site => `break:${site}`;
const alarmName = site => `break-end:${site}`;
const ruleId = site => site === "bilibili" ? 9001 : 9002;
const urlsFor = site => site === "bilibili"
  ? ["*://bilibili.com/*", "*://www.bilibili.com/*", "*://search.bilibili.com/*", "*://space.bilibili.com/*"]
  : ["*://xiaohongshu.com/*", "*://www.xiaohongshu.com/*"];
let breakQueue = Promise.resolve();
const pendingQueues = new Map();
function serialPending(tabId, job) {
  const task = (pendingQueues.get(tabId) || Promise.resolve()).then(job);
  const tail = task.catch(() => {});
  pendingQueues.set(tabId, tail);
  void tail.then(() => { if (pendingQueues.get(tabId) === tail) pendingQueues.delete(tabId); });
  return task;
}
function serialBreak(job) {
  const task = breakQueue.then(job);
  breakQueue = task.catch(() => {});
  return task;
}
async function readBreak(site) { return (await FocusAsync.session.get(breakKey(site)))[breakKey(site)] ?? null; }
async function setBreakRule(site, enabled) {
  await FocusAsync.limit(() => chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ruleId(site)],
    addRules: enabled ? [{id: ruleId(site), priority: 100, action: {type: "allow"}, condition: {
      regexFilter: `^https?://(www\\.)?${site}\\.com/`, resourceTypes: ["main_frame"]
    }}] : []
  }));
}
async function broadcastBreak(site, state, ended = false) {
  const tabs = await FocusAsync.limit(() => chrome.tabs.query({url: urlsFor(site)})).catch(() => []);
  tabs.forEach(tab => FocusAsync.notice(tab.id, {type: "BREAK_CHANGED", site, break: state, ended}));
  return tabs;
}
async function endBreak(site) {
  try { return await finishBreak(site); }
  catch (error) {
    await chrome.alarms.create(alarmName(site), {when: Date.now() + 30000});
    throw error;
  }
}
async function finishBreak(site) {
  const previous = await readBreak(site);
  const stored = await FocusAsync.session.get(null);
  // Close the navigation exception before allowing further homepage loads.
  await setBreakRule(site, false);
  await FocusAsync.session.remove(breakKey(site));
  await chrome.alarms.clear(alarmName(site)).catch(console.error);
  if (!previous) return;
  const cleared = {};
  for (const [key, item] of Object.entries(stored)) {
    if (key.startsWith("tab:") && item.site === site && item.resume) cleared[key] = {...item, resume: false};
  }
  if (Object.keys(cleared).length) await FocusAsync.session.set(cleared).catch(console.error);
  const tabs = await broadcastBreak(site, null, true);
  const url = chrome.runtime.getURL(FocusSearch.sites[site].entry) + "?rest=ended";
  // Also handle background/discarded tabs whose content-script timers are throttled.
  const ordinary = tabs.filter(tab => { const setup = stored[`setup:${tab.id}`]; return FocusSearch.isHome(tab.url) && (!setup || setup.until <= Date.now()); });
  await Promise.allSettled(ordinary.map(tab => FocusAsync.limit(() => chrome.tabs.update(tab.id, {url}))));
}
async function activeBreak(site) {
  const state = await readBreak(site);
  if (state && state.until <= Date.now()) { await endBreak(site); return null; }
  if (state) {
    const rules = await FocusAsync.limit(() => chrome.declarativeNetRequest.getSessionRules());
    if (!rules.some(rule => rule.id === ruleId(site))) await setBreakRule(site, true);
    await chrome.alarms.create(alarmName(site), {when: state.until});
  }
  return state;
}
// Session storage survives worker suspension. Recreate alarms/rules on every wakeup.
let breakReady;
function ensureBreakReady() {
  if (breakReady) return breakReady;
  breakReady = serialBreak(async () => {
    for (const site of Object.keys(FocusSearch.sites)) {
      const state = await readBreak(site);
      if (state && state.until <= Date.now()) await endBreak(site);
      else {
        await setBreakRule(site, Boolean(state));
        if (state) await chrome.alarms.create(alarmName(site), {when: state.until});
        else await chrome.alarms.clear(alarmName(site));
      }
    }
  }).catch(error => { breakReady = null; throw error; });
  return breakReady;
}
void ensureBreakReady().catch(console.error);
chrome.alarms.onAlarm.addListener(alarm => {
  if (!alarm.name.startsWith("break-end:")) return;
  const site = alarm.name.slice("break-end:".length);
  if (FocusSearch.sites[site]) ensureBreakReady().then(() => serialBreak(async () => {
    const state = await readBreak(site);
    if (state?.until <= Date.now()) await endBreak(site);
    else if (state) await chrome.alarms.create(alarmName(site), {when: state.until});
  })).catch(error => { console.error(error); void chrome.alarms.create(alarmName(site), {when: Date.now() + 30000}); });
});
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message.type === "SETUP_SAVED") return false;
  (async () => {
    if (sender.id !== chrome.runtime.id || sender.frameId > 0) throw FocusSearch.failure("invalidSource");
    const extensionPage = sender.url?.startsWith(chrome.runtime.getURL(""));
    if (["GET_SETUP", "SETUP_START", "SETUP_CAPTURE", "SETUP_CANCEL", "LOGIN_START", "LOGIN_FINISH"].includes(message.type)) return handleSetup(message, sender, extensionPage);
    if (["GET_BREAK", "BREAK_START", "BREAK_END"].includes(message.type)) {
      const site = message.site;
      if (!FocusSearch.sites[site] || (!extensionPage && FocusSearch.siteFor(sender.url) !== site)) throw FocusSearch.failure("invalidSite");
      if (message.type === "BREAK_START" && !extensionPage) throw FocusSearch.failure("breakFromEntry");
      await ensureBreakReady();
      return serialBreak(async () => {
        if (message.type === "GET_BREAK") return {break: await activeBreak(site)};
        if (message.type === "BREAK_END") { await endBreak(site); return {ok: true}; }
        const minutes = Number(message.minutes);
        if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) throw FocusSearch.failure("invalidMinutes");
        const existing = await activeBreak(site);
        if (existing) return {break: existing}; // Opening another tab never extends a break.
        const state = {site, started: Date.now(), until: Date.now() + minutes * 60000};
        await FocusAsync.session.set({[breakKey(site)]: state});
        try {
          await chrome.alarms.create(alarmName(site), {when: state.until});
          await setBreakRule(site, true);
        } catch (error) {
          // Keep an expired recovery record until permission removal succeeds.
          await FocusAsync.session.set({[breakKey(site)]: {...state, until: Date.now()}}).catch(console.error);
          await chrome.alarms.create(alarmName(site), {when: Date.now() + 30000});
          await endBreak(site).catch(console.error);
          throw error;
        }
        await broadcastBreak(site, state);
        return {break: state};
      });
    }
    const tabId = sender.tab?.id ?? (extensionPage ? message.tabId : undefined);
    if (!Number.isInteger(tabId)) throw FocusSearch.failure("invalidTab");
    return serialPending(tabId, async () => {
      const key = keyFor(tabId);
      const stored = (await FocusAsync.session.get(key))[key];
      const pending = fresh(stored) ? stored : null;
      if (message.type === "GET") return {pending};
      if (message.type === "SET" && extensionPage) {
        const keyword = String(message.keyword ?? "").trim();
        FocusSearch.searchUrl(message.site, keyword);
        await FocusAsync.session.set({[key]: {site: message.site, keyword, created: Date.now(), resume: false}});
        return {ok: true};
      }
      if (message.type === "SET_FAVORITE" && extensionPage) {
        const target = FocusSearch.collectionTarget(message.site, message.target);
        await FocusAsync.session.set({[key]: {site: message.site, kind: "favorite", target, created: Date.now(), resume: false}});
        return {ok: true};
      }
      if (message.type === "WAIT_LOGIN") {
        if (pending?.site === "xiaohongshu") await FocusAsync.session.set({[key]: {...pending, resume: true}});
        return {ok: true};
      }
      if (message.type === "TAKE_RESUME" && extensionPage) {
        if (!pending?.resume || pending.site !== message.site) return {pending: null};
        await FocusAsync.session.set({[key]: {...pending, resume: false}});
        return {pending};
      }
      if (message.type === "DONE") {
        if (pending) await FocusAsync.session.set({[key]: {...pending, resume: false}});
        return {ok: true};
      }
      throw FocusSearch.failure("unsupported");
    });
  })().then(reply, error => reply({error: error.message, code: error.code, params: error.params}));
  return true;
});
chrome.tabs.onRemoved.addListener(id => { serialPending(id, () => FocusAsync.session.remove(keyFor(id))).catch(console.error); });
