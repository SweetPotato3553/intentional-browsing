const {chromium}=require('./runtime.cjs');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const base = path.resolve(__dirname, '..');
const LOGIN = 'https://www.xiaohongshu.com/explore?focus_login=1';
const results = [];
fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});
function fixture(mode) {
  const content = mode === 'hydration'
    ? `<div class="reds-button-new" style="padding:12px">登录</div><script>
       setTimeout(() => document.querySelector('.reds-button-new').addEventListener('click', () => {
         if (document.querySelector('[role=dialog]')) return;
         const dialog = document.createElement('section'); dialog.setAttribute('role','dialog');
         dialog.className='auth-card'; dialog.innerHTML='<h2>登录小红书</h2><input placeholder="手机号">';
         document.body.append(dialog);
       }), 1600);</script>`
    : mode === 'renamed'
    ? '<section class="v4-login-container-panel"><h2>登录小红书</h2><input placeholder="手机号"></section>'
    : '<div class="new-account-entry">账号入口</div><a href="/user/profile/author123">推荐作者</a>';
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#fff;font:16px sans-serif}.auth-card,.v4-login-container-panel{position:fixed;left:40%;top:35%;width:300px;height:220px;background:white;border:1px solid #aaa;padding:30px;z-index:5000}
    #exploreFeeds{margin-top:250px;padding:40px;background:#eee}.new-account-entry{padding:15px}
  </style></head><body>${content}<div id="exploreFeeds">Mock recommendations</div></body></html>`;
}
async function closedClick(page, key) {
  const client = await page.context().newCDPSession(page);
  try {
    await client.send('DOM.enable');
    const {root} = await client.send('DOM.getDocument', {depth:-1, pierce:true});
    function find(node) {
      const attrs = node.attributes || [];
      if (attrs.some((attr,index) => attr === 'data-i18n' && attrs[index+1] === key)) return node;
      for (const child of [...(node.children || []), ...(node.shadowRoots || [])]) {
        const found = find(child); if (found) return found;
      }
    }
    const node = find(root);
    assert(node, `Closed-shadow action exists: ${key}`);
    const {object} = await client.send('DOM.resolveNode', {backendNodeId:node.backendNodeId});
    await client.send('Runtime.callFunctionOn', {objectId:object.objectId, functionDeclaration:'function(){this.click()}', returnByValue:true});
  } finally { await client.detach(); }
}
async function run(edition) {
  const extension = require('./runtime.cjs').inspectableExtension(path.join(base, 'extension'));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'still-login-regression-'));
  const context = await chromium.launchPersistentContext(profile, {
    executablePath:process.env.EDGE_EXECUTABLE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless:true, ignoreDefaultArgs:['--disable-extensions'],
    args:[`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--no-first-run'],
    viewport:{width:1366,height:900}
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', {timeout:20000});
    const id = new URL(worker.url()).hostname;
    const entry = `chrome-extension://${id}/xiaohongshu.html`;
    await worker.evaluate(theme => chrome.storage.local.set({language:'zh_CN',...(theme ? {theme} : {})}), process.env.FOCUS_TEST_THEME || null);
    let mode = 'hydration';
    await context.route('https://www.xiaohongshu.com/**', route => route.fulfill({contentType:'text/html', body:fixture(mode)}));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(entry); await page.locator(".login-link").click(); await page.waitForURL(LOGIN);
    await page.locator('[role=dialog]').waitFor({timeout:12000});
    assert.equal(await page.locator('[role=dialog] input').evaluate(node => getComputedStyle(node).visibility), 'visible');
    assert.equal(await page.locator('#exploreFeeds').evaluate(node => getComputedStyle(node).visibility), 'hidden');
    results.push(`${edition}: native login opens after delayed hydration; dialog visible and feed hidden`);
    await page.screenshot({path:path.join(__dirname,'artifacts', `${edition}-native.png`)});

    mode='renamed'; await page.goto(entry); await page.locator(".login-link").click(); await page.waitForURL(LOGIN);
    await page.locator('[data-focus-native-login]').waitFor();
    assert.equal(await page.locator('input').evaluate(node => getComputedStyle(node).visibility), 'visible');
    results.push(`${edition}: renamed login container is discovered and unmasked`);

    mode='unknown'; await page.goto(entry); await page.locator(".login-link").click(); await page.waitForURL(LOGIN);
    await page.waitForFunction(() => document.documentElement.dataset.focusView === 'login');
    await page.waitForTimeout(1400);
    assert.equal(page.url(), LOGIN, 'An author profile must not be treated as the current account');
    const tabId = await worker.evaluate(async () => (await chrome.tabs.query({url:'https://www.xiaohongshu.com/*'}))[0].id);
    async function state() {
      return worker.evaluate(async tabId => (await chrome.storage.session.get(`setup:${tabId}`))[`setup:${tabId}`], tabId);
    }
    async function fallback() {
      await page.waitForFunction(() => document.documentElement.dataset.focusView === 'login');
      await page.locator('#focus-search-guard').waitFor({state:'attached'});
      await closedClick(page, 'loginFallback');
      await page.waitForFunction(() => document.documentElement.dataset.focusSetup === 'active');
      await page.locator('#focus-collection-setup').waitFor();
      assert.equal((await state()).purpose, 'login');
    }
    async function noLoginRules() {
      const rules = await worker.evaluate(() => chrome.declarativeNetRequest.getSessionRules());
      assert(!rules.some(rule => rule.id >= 10000 && rule.id < 20000), 'All temporary tab rules must be removed');
      assert(!await state(), 'Login storage must be removed');
    }
    await fallback();
    const first = await state();
    assert(first.until - Date.now() > 290000 && first.until - Date.now() <= 300000);
    assert.equal(await page.locator('#exploreFeeds').evaluate(node => getComputedStyle(node).visibility), 'visible');
    assert.match(await page.locator('#focus-collection-setup .time-label').textContent(), /登录/);
    assert.match(await page.locator('#focus-collection-setup .time').textContent(), /^0[45]:\d\d$/);
    await page.reload();
    await page.waitForFunction(() => document.documentElement.dataset.focusSetup === 'active');
    assert.equal((await state()).until, first.until, 'Reload must not extend access');
    const unrelated=await context.newPage(); await unrelated.goto('https://www.xiaohongshu.com/');
    await unrelated.waitForURL(entry);
    results.push(`${edition}: 5-minute fallback shows native site/countdown; reload does not extend it; unrelated home tab remains blocked`);
    await page.screenshot({path:path.join(__dirname,'artifacts', `${edition}-fallback.png`)});

    for (const kind of ['search','favorite']) {
      if (kind === 'favorite') { await page.goto(entry); await page.locator(".login-link").click(); await page.waitForURL(LOGIN); await fallback(); }
      const pending = kind === 'favorite'
        ? {site:'xiaohongshu',kind:'favorite',target:'https://www.xiaohongshu.com/user/profile/test123?tab=fav'}
        : {site:'xiaohongshu',keyword:'login regression'};
      await worker.evaluate(({tabId,pending}) => chrome.storage.session.set({[`tab:${tabId}`]:{...pending,created:Date.now(),resume:true}}), {tabId,pending});
      await page.locator('#focus-collection-setup .capture').click();
      await page.waitForURL(kind === 'favorite' ? /\/user\/profile\/test123\?tab=fav/ : /\/search_result\?keyword=login\+regression/);
      await noLoginRules();
      results.push(`${edition}: completing fallback resumes original ${kind} and revokes access`);
    }
    await page.goto(entry); await page.locator(".login-link").click(); await page.waitForURL(LOGIN); await fallback();
    await page.locator('#focus-collection-setup .cancel').click();
    await page.waitForURL(entry+'?login=ended'); await noLoginRules();
    results.push(`${edition}: cancellation returns to the quiet entry and revokes access`);

    await page.goto(entry); await page.locator(".login-link").click(); await page.waitForURL(LOGIN); await fallback();
    await worker.evaluate(async tabId => {
      const key=`setup:${tabId}`, data=(await chrome.storage.session.get(key))[key];
      await chrome.storage.session.set({[key]:{...data,until:Date.now()-1}});
      await chrome.alarms.create(`setup-end:${data.group}`, {when:Date.now()+100});
    }, tabId);
    await page.waitForURL(entry+'?login=ended', {timeout:10000}); await noLoginRules();
    const pendingAfterExpiry = await worker.evaluate(async tabId => (await chrome.storage.session.get(`tab:${tabId}`))[`tab:${tabId}`], tabId);
    assert.equal(pendingAfterExpiry.resume, false, 'Expiry clears automatic resume for later visits too');
    await page.waitForTimeout(500);
    assert.equal(page.url(), entry+'?login=ended', 'Expiry must not automatically resume a stale pending search');
    results.push(`${edition}: worker alarm expires access without relying on the content timer`);

    await page.goto(entry); await page.locator(".login-link").click(); await page.waitForURL(LOGIN); await fallback();
    const childPromise=context.waitForEvent('page'); await page.evaluate(() => window.open('about:blank'));
    const child=await childPromise;
    await page.waitForTimeout(300);
    await child.goto('https://www.xiaohongshu.com/');
    await child.waitForFunction(() => document.documentElement.dataset.focusSetup === 'active');
    await page.close();
    await child.waitForURL(entry); await noLoginRules();
    results.push(`${edition}: child tab inherits the same deadline; closing the owner revokes the entire group`);

    const owner=unrelated;
    const helperPromise=context.waitForEvent('page');
    const setup=await owner.evaluate(async () => {
      const tab=await chrome.tabs.getCurrent();
      return chrome.runtime.sendMessage({type:'SETUP_START',site:'xiaohongshu',tabId:tab.id});
    });
    assert(!setup.error, JSON.stringify(setup));
    const helper=await helperPromise;
    await helper.waitForFunction(() => document.documentElement.dataset.focusSetup === 'active');
    assert(setup.setup.until-Date.now()>170000 && setup.setup.until-Date.now()<=180000, 'Collection setup remains 3 minutes');
    await helper.goto('https://www.xiaohongshu.com/user/profile/study123?tab=fav&subTab=note');
    await helper.locator('#focus-collection-setup .capture').click();
    await helper.waitForFunction(() => !document.querySelector('#focus-collection-setup'));
    const favorites=await worker.evaluate(async () => (await chrome.storage.local.get('favoriteLinks')).favoriteLinks);
    assert.equal(favorites.xiaohongshu, 'https://www.xiaohongshu.com/user/profile/study123?tab=fav&subTab=note');
    assert.equal(errors.length,0, errors.join('\n'));
    results.push(`${edition}: existing 3-minute collection setup still captures favorites; no page errors`);
    console.log(results.filter(line => line.startsWith(edition)).join('\n'));
  } finally { await context.close(); }
}
(async () => {
  for (const edition of (process.argv.slice(2).length ? process.argv.slice(2) : ['intentional-browsing'])) await run(edition);
  fs.writeFileSync(path.join(__dirname,'artifacts',`native-login-${process.env.FOCUS_TEST_THEME||'zen'}.json`), JSON.stringify({status:'passed',results,limitation:'Local fixtures in isolated Edge; no real account sign-in was performed.'},null,2));
  console.log(`PASS: ${results.length} login/collection checks`);
})().catch(error => { console.error(error); process.exitCode=1; });
