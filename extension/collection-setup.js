/* A short-lived, tab-scoped route to find a collection; never a site-wide unlock. */
const setupKey = tabId => `setup:${tabId}`;
const setupAlarm = group => `setup-end:${group}`;
const SETUP_LIFETIME = 3 * 60 * 1000;
const LOGIN_LIFETIME = 5 * 60 * 1000;
let setupQueue = Promise.resolve();
function serialSetup(job) {
  const task = setupQueue.then(job);
  setupQueue = task.catch(() => {});
  return task;
}
async function readSetup(tabId) { return (await FocusAsync.session.get(setupKey(tabId)))[setupKey(tabId)] ?? null; }
async function setupRecords() {
  return Object.entries(await FocusAsync.session.get(null)).filter(([key]) => key.startsWith("setup:")).map(([, state]) => state);
}
async function setupRule(state, enabled) {
  await FocusAsync.limit(() => chrome.declarativeNetRequest.updateSessionRules({removeRuleIds: [state.ruleId], addRules: enabled ? [{
    id: state.ruleId, priority: 200, action: {type: "allow"},
    condition: {tabIds: [state.tabId], regexFilter: `^https?://(www\\.)?${state.site}\\.com/`, resourceTypes: ["main_frame"]}
  }] : []}));
}
async function attachSetup(tabId, state) {
  const ids = new Set((await FocusAsync.limit(() => chrome.declarativeNetRequest.getSessionRules())).map(rule => rule.id));
  let ruleId = 10000;
  while (ids.has(ruleId) && ruleId < 20000) ruleId++;
  if (ruleId >= 20000) throw FocusSearch.failure("unexpectedError");
  const record = {...state, tabId, ruleId};
  await chrome.alarms.create(setupAlarm(record.group), {when: record.until});
  await FocusAsync.session.set({[setupKey(tabId)]: record});
  try { await setupRule(record, true); }
  catch (error) { await FocusAsync.session.remove(setupKey(tabId)); throw error; }
  return record;
}
async function endSetupGroup(group, keepTabId = null, saved = false, navigating = false) {
  try { return await finishSetupGroup(group, keepTabId, saved, navigating); }
  catch (error) { await chrome.alarms.create(setupAlarm(group), {when: Date.now() + 30000}); throw error; }
}
async function finishSetupGroup(group, keepTabId, saved, navigating) {
  const records = (await setupRecords()).filter(state => state.group === group);
  if (!records.length) return;
  await FocusAsync.limit(() => chrome.declarativeNetRequest.updateSessionRules({removeRuleIds: records.map(state => state.ruleId)}));
  await FocusAsync.session.remove(records.map(state => setupKey(state.tabId)));
  await chrome.alarms.clear(setupAlarm(group)).catch(console.error);
  // Cancel/expiry must not make a later entry visit revive an abandoned search.
  const pendingKeys = [...new Set(records.filter(state => state.purpose === "login").map(state => `tab:${state.ownerId}`))];
  if (pendingKeys.length) {
    const pending = await FocusAsync.session.get(pendingKeys).catch(() => ({}));
    const cleared = Object.fromEntries(Object.entries(pending).map(([key, value]) => [key, {...value, resume: false}]));
    if (Object.keys(cleared).length) await FocusAsync.session.set(cleared).catch(console.error);
  }
  records.filter(state => !(navigating && state.tabId === keepTabId)).forEach(state => FocusAsync.notice(state.tabId, {type: "SETUP_CHANGED", setup: null, kept: state.tabId === keepTabId || state.inherited, saved}));
  await Promise.allSettled(records.filter(state => state.tabId !== keepTabId && !state.inherited).map(async state => {
    const tab = await FocusAsync.limit(() => chrome.tabs.get(state.tabId));
    if (FocusSearch.siteFor(tab.url) !== state.site) return;
    await FocusAsync.limit(() => chrome.tabs.update(state.tabId, {url: chrome.runtime.getURL(FocusSearch.sites[state.site].entry) + (state.purpose === "login" ? "?login=ended" : "?setup=ended")}));
  }));
}
async function activeSetup(tabId) {
  const state = await readSetup(tabId);
  if (state && state.until <= Date.now()) { await endSetupGroup(state.group); return null; }
  if (state) {
    const rules = await FocusAsync.limit(() => chrome.declarativeNetRequest.getSessionRules());
    if (!rules.some(rule => rule.id === state.ruleId)) await setupRule(state, true);
    await chrome.alarms.create(setupAlarm(state.group), {when: state.until});
  }
  return state;
}
let setupReady;
function ensureSetupReady() {
  if (setupReady) return setupReady;
  setupReady = serialSetup(async () => {
    const records = await setupRecords();
    const groups = new Set();
    const liveTabs = new Set((await FocusAsync.limit(() => chrome.tabs.query({}))).map(tab => tab.id));
    for (const state of records) {
      if (state.until <= Date.now() || !liveTabs.has(state.ownerId)) { groups.add(state.group); continue; }
      if (!liveTabs.has(state.tabId)) {
        await setupRule(state, false); await FocusAsync.session.remove(setupKey(state.tabId));
      } else {
        await setupRule(state, true); await chrome.alarms.create(setupAlarm(state.group), {when: state.until});
      }
    }
    for (const group of groups) await endSetupGroup(group);
    const valid = new Set((await setupRecords()).map(state => state.ruleId));
    const stale = (await FocusAsync.limit(() => chrome.declarativeNetRequest.getSessionRules())).filter(rule => rule.id >= 10000 && rule.id < 20000 && !valid.has(rule.id));
    if (stale.length) await FocusAsync.limit(() => chrome.declarativeNetRequest.updateSessionRules({removeRuleIds: stale.map(rule => rule.id)}));
  }).catch(error => { setupReady = null; throw error; });
  return setupReady;
}
void ensureSetupReady().catch(console.error);
async function handleSetup(message, sender, extensionPage) {
  await ensureSetupReady();
  return serialSetup(async () => {
    const tabId = sender.tab?.id ?? (extensionPage ? message.tabId : undefined);
    if (!Number.isInteger(tabId)) throw FocusSearch.failure("invalidTab");
    if (message.type === "LOGIN_START") {
      if (message.site !== "xiaohongshu" || (!extensionPage && FocusSearch.siteFor(sender.url) !== "xiaohongshu")) throw FocusSearch.failure("invalidSource");
      const existing = await activeSetup(tabId);
      if (existing) {
        if (existing.purpose !== "login") throw FocusSearch.failure("unsupported");
        if (existing.quiet && !message.quiet) {
          existing.quiet = false; await FocusAsync.session.set({[setupKey(tabId)]: existing});
        }
        return {setup: existing}; // Reloads/repeated clicks never extend access.
      }
      const record = await attachSetup(tabId, {site: "xiaohongshu", purpose: "login", quiet: Boolean(message.quiet), ownerId: tabId, group: tabId, until: Date.now() + LOGIN_LIFETIME});
      try { await chrome.alarms.create(setupAlarm(record.group), {when: record.until}); }
      catch (error) { await endSetupGroup(record.group); throw error; }
      return {setup: record};
    }
    if (message.type === "SETUP_START") {
      if (!extensionPage || !FocusSearch.sites[message.site]) throw FocusSearch.failure("invalidSource");
      const existing = (await setupRecords()).find(state => state.ownerId === tabId && state.site === message.site && state.until > Date.now());
      if (existing) { await chrome.tabs.update(existing.tabId, {active: true}); return {setup: existing}; }
      const owner = await FocusAsync.limit(() => chrome.tabs.get(tabId));
      const helper = await chrome.tabs.create({url: "about:blank", active: true, openerTabId: tabId, windowId: owner.windowId});
      let record;
      try {
        record = await attachSetup(helper.id, {site: message.site, ownerId: tabId, group: helper.id, until: Date.now() + SETUP_LIFETIME});
        await chrome.alarms.create(setupAlarm(record.group), {when: record.until});
        await chrome.tabs.update(helper.id, {url: FocusSearch.sites[message.site].home});
        return {setup: record};
      } catch (error) {
        if (record) await endSetupGroup(record.group).catch(console.error);
        await chrome.tabs.remove(helper.id).catch(console.error);
        throw error;
      }
    }
    const state = await activeSetup(tabId);
    if (message.type === "GET_SETUP") return {setup: state?.site === message.site ? state : null};
    if (!state || state.site !== message.site) throw FocusSearch.failure("setupExpired");
    if (!extensionPage && FocusSearch.siteFor(sender.url) !== state.site) throw FocusSearch.failure("invalidSource");
    if (message.type === "LOGIN_FINISH") {
      if (state.purpose !== "login") throw FocusSearch.failure("unsupported");
      const key = `tab:${state.ownerId}`;
      const pending = (await FocusAsync.session.get(key))[key];
      const target = pending?.site === state.site && Date.now() - pending.created < 30 * 60 * 1000
        ? FocusSearch.pendingUrl(pending) : chrome.runtime.getURL(FocusSearch.sites[state.site].entry);
      await FocusAsync.limit(() => chrome.tabs.update(state.ownerId, {url: target, active: true}));
      await endSetupGroup(state.group, state.ownerId, false, true);
      return {ok: true};
    }
    if (message.type === "SETUP_CANCEL") { await endSetupGroup(state.group); return {ok: true}; }
    if (message.type === "SETUP_CAPTURE") {
      if (state.purpose === "login") throw FocusSearch.failure("unsupported");
      const tab = await FocusAsync.limit(() => chrome.tabs.get(tabId));
      // Read the actual browser tab URL, not a URL supplied by a page message.
      let target;
      try { target = FocusSearch.collectionTarget(state.site, tab.url); }
      catch { throw FocusSearch.failure("setupChooseCollection"); }
      const saved = (await FocusAsync.local.get("favoriteLinks")).favoriteLinks || {};
      await FocusAsync.local.set({favoriteLinks: {...saved, [state.site]: target}});
      await endSetupGroup(state.group, tabId, true);
      void FocusAsync.limit(() => chrome.runtime.sendMessage({type: "SETUP_SAVED", ownerId: state.ownerId, site: state.site, target}), 500).catch(() => {});
      if (target !== tab.url) await chrome.tabs.update(tabId, {url: target});
      return {ok: true, target};
    }
    throw FocusSearch.failure("unsupported");
  });
}
chrome.alarms.onAlarm.addListener(alarm => {
  if (!alarm.name.startsWith("setup-end:")) return;
  const group = Number(alarm.name.slice("setup-end:".length));
  ensureSetupReady().then(() => serialSetup(async () => {
    const record = (await setupRecords()).find(state => state.group === group);
    if (record?.until <= Date.now()) await endSetupGroup(group);
    else if (record) await chrome.alarms.create(setupAlarm(group), {when: record.until});
  })).catch(error => { console.error(error); void chrome.alarms.create(setupAlarm(group), {when: Date.now() + 30000}); });
});
chrome.tabs.onCreated.addListener(tab => {
  if (!Number.isInteger(tab.openerTabId)) return;
  ensureSetupReady().then(() => serialSetup(async () => {
    const parent = await activeSetup(tab.openerTabId);
    const destination = tab.pendingUrl || tab.url;
    if (parent && (!destination || destination === "about:blank" || FocusSearch.siteFor(destination) === parent.site)) {
      const state = await attachSetup(tab.id, {...parent, inherited: true});
      FocusAsync.notice(tab.id, {type: "SETUP_CHANGED", setup: state});
    }
  })).catch(console.error);
});
chrome.tabs.onRemoved.addListener(tabId => {
  ensureSetupReady().then(() => serialSetup(async () => {
    const records = await setupRecords();
    const owned = new Set(records.filter(state => state.ownerId === tabId).map(state => state.group));
    for (const group of owned) await endSetupGroup(group);
    const state = await readSetup(tabId);
    if (state) {
      await setupRule(state, false); await FocusAsync.session.remove(setupKey(tabId));
      if (!(await setupRecords()).some(item => item.group === state.group)) await chrome.alarms.clear(setupAlarm(state.group));
    }
  })).catch(console.error);
});

// A temporary exception must never follow a tab onto another website.
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (!change.url || change.url === "about:blank") return;
  ensureSetupReady().then(() => serialSetup(async () => {
    const state = await readSetup(tabId);
    if (!state || FocusSearch.siteFor(change.url) === state.site) return;
    if (!state.inherited) { await endSetupGroup(state.group, tabId); return; }
    await setupRule(state, false);
    await FocusAsync.session.remove(setupKey(tabId));
  })).catch(console.error);
});
