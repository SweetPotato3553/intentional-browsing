const {chromium,browserPath}=require('./runtime.cjs');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const extension=path.resolve(__dirname,'../extension'),results=[];
const fixture='<!doctype html><html><head><meta charset="utf-8"></head><body><h1>Native content</h1><video></video><a target="_blank" href="https://example.com/">External</a><button class="login-btn">登录</button><div id="exploreFeeds">Feed</div></body></html>';
(async()=>{
 const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'still-release-')),{executablePath:browserPath,headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]});
 try {
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
  await worker.evaluate(()=>Promise.all([ensureBreakReady(),ensureSetupReady()]));
  const base=`chrome-extension://${new URL(worker.url()).hostname}/`;
  await context.route(/^https:\/\//,route=>route.fulfill({contentType:'text/html',body:fixture}));
  const owner=await context.newPage();await owner.goto(base+'bilibili.html');await owner.waitForFunction(()=>document.documentElement.dataset.uiReady==='true');
  const send=(type,extra={})=>owner.evaluate(async({type,extra})=>chrome.runtime.sendMessage({type,site:'bilibili',tabId:(await chrome.tabs.getCurrent()).id,...extra}),{type,extra});
  const native=await context.newPage();await native.goto('https://www.bilibili.com/');await native.waitForURL(base+'bilibili.html');
  assert.equal(await native.locator('#keyword').count(),1);results.push('DNR home redirect and entry dependencies work with HTML-only WAR');
  const outside=await context.newPage();await outside.goto('https://example.com/');
  await outside.evaluate(url=>{const f=document.createElement('iframe');f.src=url;document.body.append(f);},base+'bilibili.html');
  await outside.waitForTimeout(500);
  assert(!outside.frames().some(frame=>frame.url()===base+'bilibili.html'));results.push('frame-ancestors blocks embedding an entry page from an external website');
  await native.goto('https://www.xiaohongshu.com/explore?focus_login=1');await native.waitForURL(base+'xiaohongshu.html');
  await native.locator('.login-link').click();await native.waitForURL(/focus_login=1/);
  const login=await worker.evaluate(async()=>Object.values(await chrome.storage.session.get(null)).find(x=>x?.purpose==='login'));
  assert(login&&login.quiet&&login.until-Date.now()<=300000);
  await native.waitForFunction(()=>document.documentElement.dataset.focusView==='login');
  assert.equal(await native.locator('#exploreFeeds').evaluate(n=>getComputedStyle(n).visibility),'hidden');
  await worker.evaluate(group=>endSetupGroup(group),login.group);
  await native.waitForURL(base+'xiaohongshu.html?login=ended');
  await native.goto('https://www.xiaohongshu.com/explore?focus_login=1');await native.waitForURL(base+'xiaohongshu.html');
  results.push('Login query cannot bypass DNR; explicit entry click creates bounded tab access; cancellation revokes it');
  const valid=await owner.evaluate(()=>{
    const good=['https://space.bilibili.com/123/favlist?fid=45','https://space.bilibili.com/123/lists/45?type=season','https://www.bilibili.com/medialist/play/ml45'];
    const bad=['https://www.bilibili.com/video/BVtest','https://search.bilibili.com/all?keyword=test','https://space.bilibili.com/123'];
    return {good:good.map(v=>FocusSearch.collectionTarget('bilibili',v)),bad:bad.map(v=>{try{FocusSearch.collectionTarget('bilibili',v);return false;}catch{return true;}}),profile:FocusSearch.collectionTarget('xiaohongshu','https://www.xiaohongshu.com/user/profile/abc?xsec_token=keep')};
  });assert(valid.bad.every(Boolean));assert.equal(valid.good.length,3);assert.match(valid.profile,/tab=fav/);assert.match(valid.profile,/xsec_token=keep/);
  await owner.locator('#favorites-settings').dblclick();await owner.locator('#favorites-bilibili').fill('https://www.bilibili.com/video/BVtest');await owner.locator('#favorites-save').click();assert(await owner.locator('.favorites-dialog').evaluate(n=>n.open));await owner.locator('#favorites-cancel').click();results.push('Manual favorites reject video/search/space-home URLs and normalize supported collection links; double settings click is safe');
  async function setup(){const next=context.waitForEvent('page');const response=await send('SETUP_START');assert(!response.error,JSON.stringify(response));const page=await next;await page.waitForURL('https://www.bilibili.com/');return {page,state:response.setup};}
  for(const ending of ['cancel','expire','save','owner-close']){
    const {page,state}=await setup();const next=context.waitForEvent('page');await page.locator('a').click();const external=await next;await external.waitForURL('https://example.com/');await external.evaluate(()=>{document.body.dataset.keep='unchanged';});
    if(ending==='save'){await page.goto('https://space.bilibili.com/123/favlist?fid=45');await page.locator('#focus-collection-setup').waitFor();assert.equal(await page.locator('#focus-collection-setup').evaluate(n=>n.shadowRoot),null);await require('./runtime.cjs').closedClick(page,'.capture');}
    else if(ending==='expire'){await worker.evaluate(async state=>{await chrome.storage.session.set({[`setup:${state.tabId}`]:{...state,until:Date.now()-1}});await chrome.alarms.create(`setup-end:${state.group}`,{when:Date.now()+100});},state);}
    else if(ending==='owner-close'){await owner.close();}
    else await worker.evaluate(group=>endSetupGroup(group),state.group);
    await page.waitForTimeout(1000);assert.equal(external.url(),'https://example.com/');assert.equal(await external.locator('body').getAttribute('data-keep'),'unchanged');
    await page.close();await external.close();
  }
  results.push('External setup child is preserved on cancel, expiry, capture and owner close');
  // The owner closed above; remaining scenarios exercise worker state directly.
  const control=await context.newPage();await control.goto(base+'bilibili.html');
  const request=(type,extra={})=>control.evaluate(async({type,extra})=>chrome.runtime.sendMessage({type,site:'bilibili',tabId:(await chrome.tabs.getCurrent()).id,...extra}),{type,extra});
  const search=await context.newPage();await search.goto('https://search.bilibili.com/all?keyword=existing');
  await search.evaluate(()=>{window.pauses=0;document.querySelector('video').pause=()=>window.pauses++;});
  assert(!(await request('BREAK_START',{minutes:5})).error);await native.goto('https://www.bilibili.com/');await native.locator('#focus-break-timer').waitFor();
  await worker.evaluate(()=>{globalThis.dnr=chrome.declarativeNetRequest.updateSessionRules;chrome.declarativeNetRequest.updateSessionRules=()=>Promise.reject(new Error('Injected DNR failure'));});
  assert.equal(await native.locator('#focus-break-timer').evaluate(n=>n.shadowRoot),null);await require('./runtime.cjs').closedClick(native,'[data-i18n=timerEnd]');await native.waitForTimeout(1500);assert.equal(native.url(),'https://www.bilibili.com/');assert(await worker.evaluate(()=>readBreak('bilibili')));assert(await native.locator('#focus-break-timer').isVisible());
  await worker.evaluate(()=>{chrome.declarativeNetRequest.updateSessionRules=globalThis.dnr;});
  assert(!(await request('BREAK_END')).error);await native.waitForURL(base+'bilibili.html?rest=ended');assert.match(search.url(),/keyword=existing/);assert.equal(await search.evaluate(()=>window.pauses),0);
  results.push('Failed break end retains live state and retry UI; successful end preserves existing search and media');
  const next=context.waitForEvent('page');const r=await request('SETUP_START');const helper=await next;await helper.waitForURL('https://www.bilibili.com/');
  await worker.evaluate(async s=>{await chrome.alarms.create(`setup-end:${s.group}`,{when:Date.now()+100});},r.setup);
  await helper.waitForTimeout(800);
  const alarm=await worker.evaluate(group=>chrome.alarms.get(`setup-end:${group}`),r.setup.group);assert(alarm&&alarm.scheduledTime>=r.setup.until-5);
  await worker.evaluate(async s=>{await chrome.storage.session.set({[`setup:${s.tabId}`]:{...s,until:Date.now()-1}});globalThis.dnr=chrome.declarativeNetRequest.updateSessionRules;chrome.declarativeNetRequest.updateSessionRules=()=>Promise.reject(new Error('Injected expiry failure'));await chrome.alarms.create(`setup-end:${s.group}`,{when:Date.now()+100});},r.setup);
  await helper.waitForTimeout(800);assert(await worker.evaluate(group=>chrome.alarms.get(`setup-end:${group}`),r.setup.group));
  await worker.evaluate(async s=>{chrome.declarativeNetRequest.updateSessionRules=globalThis.dnr;await chrome.alarms.create(`setup-end:${s.group}`,{when:Date.now()+100});},r.setup);
  await helper.waitForURL(base+'bilibili.html?setup=ended');assert.equal(await worker.evaluate(id=>readSetup(id),r.setup.tabId),null);results.push('Early setup alarm re-arms; failed expiry schedules retry; retry removes permission and state');
  const tabsBefore=await worker.evaluate(async()=> (await chrome.tabs.query({})).length);
  await worker.evaluate(()=>{globalThis.dnr=chrome.declarativeNetRequest.updateSessionRules;chrome.declarativeNetRequest.updateSessionRules=rules=>rules.addRules?.some(r=>r.id>=10000)?Promise.reject(new Error('Injected setup creation failure')):globalThis.dnr(rules);});
  const rejected=await request('SETUP_START');assert(rejected.error);
  await worker.evaluate(()=>{chrome.declarativeNetRequest.updateSessionRules=globalThis.dnr;});
  assert.equal(await worker.evaluate(async()=>(await chrome.tabs.query({})).length),tabsBefore);results.push('Failed setup attachment closes the blank helper instead of leaving an orphan tab');
  const freshPage=context.waitForEvent('page');const fresh=await request('SETUP_START');const recover=await freshPage;await recover.waitForURL('https://www.bilibili.com/');
  await worker.evaluate(async s=>{await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:[s.ruleId]});await chrome.alarms.clear(`setup-end:${s.group}`);await activeSetup(s.tabId);},fresh.setup);
  assert(await worker.evaluate(async s=>(await chrome.declarativeNetRequest.getSessionRules()).some(r=>r.id===s.ruleId)&&Boolean(await chrome.alarms.get(`setup-end:${s.group}`)),fresh.setup));
  await worker.evaluate(async()=>{setupReady=null;await ensureSetupReady();});
  assert.equal((await worker.evaluate(id=>readSetup(id),fresh.setup.tabId)).until,fresh.setup.until);results.push('Lost setup rule/alarm are repaired; rerunning worker initialization preserves the original deadline');
  await recover.locator('#focus-collection-setup').waitFor();
  await worker.evaluate(()=>{globalThis.dnr=chrome.declarativeNetRequest.updateSessionRules;chrome.declarativeNetRequest.updateSessionRules=()=>Promise.reject(new Error('Injected cancel failure'));});
  await require('./runtime.cjs').closedClick(recover,'.cancel');await recover.waitForTimeout(1500);assert.equal(recover.url(),'https://www.bilibili.com/');assert(await worker.evaluate(id=>readSetup(id),fresh.setup.tabId));
  await worker.evaluate(async group=>{chrome.declarativeNetRequest.updateSessionRules=globalThis.dnr;await endSetupGroup(group);},fresh.setup.group);await recover.waitForURL(base+'bilibili.html?setup=ended');results.push('Failed setup cancellation retains the page and state until revocation succeeds');
  const hidden=await context.newPage();await hidden.goto('https://www.xiaohongshu.com/search_result?keyword=hidden');
  await hidden.evaluate(()=>{const style=document.createElement('style');style.textContent='.login-container{visibility:hidden;width:300px;height:100px}';document.head.append(style);const d=document.createElement('div');d.className='login-container';d.innerHTML='登录<input>';document.body.append(d);document.documentElement.dataset.focusView='login';});
  await hidden.waitForTimeout(500);assert.equal(await hidden.locator('html').getAttribute('data-focus-view'),'content');results.push('Stylesheet-hidden native login container cannot trap a search page behind the veil');
  fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});fs.writeFileSync(path.join(__dirname,'artifacts/release-results.json'),JSON.stringify({version:'1.0.0',results,status:'passed'},null,2));console.log(results.join('\n'));console.log(`PASS ${results.length} release scenarios`);
 }finally{await context.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
