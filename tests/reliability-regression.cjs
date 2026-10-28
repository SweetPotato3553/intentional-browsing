const {chromium,browserPath}=require('./runtime.cjs');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const source=require('./runtime.cjs').inspectableExtension(path.resolve(__dirname,'..','extension')),artifacts=path.join(__dirname,'artifacts');
const extension=fs.mkdtempSync(path.join(os.tmpdir(),'still-fault-extension-'));
fs.cpSync(source,extension,{recursive:true,filter:file=>!file.split(path.sep).includes('_metadata')});
for(const file of ['bilibili.html','xiaohongshu.html','popup.html']){
  const target=path.join(extension,file);fs.writeFileSync(target,fs.readFileSync(target,'utf8').replace('<script src="theme.js" defer>','<script src="fault.js" defer></script><script src="theme.js" defer>'));
}
fs.writeFileSync(path.join(extension,'fault.js'),`(() => {
  const original=chrome.storage.local.get.bind(chrome.storage.local);
  if(location.hash==='#storage-stall'){window.storageFaultActive=true;chrome.storage.local.get=()=>new Promise(()=>{});}
  if(location.hash==='#stale-settings'){
    window.initialReads=0;
    chrome.storage.local.get=async key=>{const snapshot=await original(key);window.initialReads++;await new Promise(resolve=>setTimeout(resolve,800));return snapshot;};
  }
})();`);
fs.mkdirSync(artifacts,{recursive:true});
const results=[];
const fixture='<!doctype html><html><head><meta charset="utf-8"></head><body><header>Native header</header><main id="exploreFeeds"><h1 id="result">Visible search results</h1><a href="/explore" id="home">Home</a></main></body></html>';
(async()=>{
  const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'still-reliability-')),{
    executablePath:browserPath,headless:true,ignoreDefaultArgs:['--disable-extensions','--disable-back-forward-cache'],
    args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`]
  });
  try{
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    const id=new URL(worker.url()).hostname,entry=`chrome-extension://${id}/bilibili.html`;
    await worker.evaluate(()=>Promise.all([ensureBreakReady(),ensureSetupReady()]));
    await worker.evaluate(()=>chrome.storage.local.set({language:'zh_CN'}));
    await context.route(/^https:\/\/(?:www\.|search\.)?(?:bilibili|xiaohongshu)\.com\//,route=>route.fulfill({contentType:'text/html',body:fixture}));
    const owner=await context.newPage();await owner.goto(entry);await owner.waitForFunction(()=>document.documentElement.dataset.uiReady==='true');

    // A tab that never acknowledges notifications used to block the break queue.
    const silent=await context.newPage();await silent.goto('https://www.bilibili.com/video/BVsilent');
    await silent.waitForFunction(()=>document.documentElement.dataset.focusView==='content');
    await worker.evaluate(()=>{globalThis.restoreSend=chrome.tabs.sendMessage;chrome.tabs.sendMessage=()=>new Promise(()=>{});});
    await owner.locator('#break-link').click();await owner.locator('#break-confirm-next').click();await owner.locator('#break-minutes').fill('5');
    let started=Date.now();
    await owner.locator('#break-start').click();await owner.waitForURL('https://www.bilibili.com/');
    await owner.locator('#focus-break-timer').waitFor();
    assert(Date.now()-started<5500,`A silent existing tab must not block the Start break button (${Date.now()-started} ms)`);
    const native=owner;
    await native.evaluate(()=>{
      window.timerWrites=0;
      const fill=document.querySelector('#focus-break-timer').shadowRoot.querySelector('.fill');
      new MutationObserver(records=>window.timerWrites+=records.length).observe(fill,{attributes:true,attributeFilter:['style']});
      const target=document.querySelector('#result');let tick=0;
      window.feedStress=setInterval(()=>{for(let i=0;i<60;i++)target.className='feed-'+tick++;},10);
    });
    await native.waitForTimeout(1400);await native.evaluate(()=>clearInterval(window.feedStress));
    assert(await native.evaluate(()=>window.timerWrites<=3),'Feed mutations must not redraw the timer every frame');
    results.push('High-frequency native feed changes do not repeatedly redraw the countdown');
    started=Date.now();await native.locator('#focus-break-timer button').click();
    await native.waitForURL(entry+'?rest=ended');assert(Date.now()-started<5500,'Ending must navigate without waiting on notifications');
    assert.equal(silent.url(),'https://www.bilibili.com/video/BVsilent');
    await worker.evaluate(()=>{chrome.tabs.sendMessage=globalThis.restoreSend;});
    results.push('Non-responsive content-script notifications cannot block break start/end or leave the worker queue stuck');

    // Slow worker storage must not hide normal search results, even when the
    // native SPA reuses its former home-grid id for results.
    await worker.evaluate(()=>{globalThis.restoreSessionGet=chrome.storage.session.get;chrome.storage.session.get=key=>typeof key==='string'&&key.startsWith('break:')?new Promise(()=>{}):globalThis.restoreSessionGet(key);});
    const search=await context.newPage();started=Date.now();await search.goto('https://www.xiaohongshu.com/search_result?keyword=reliability');
    await search.waitForFunction(()=>getComputedStyle(document.querySelector('#result')).visibility==='visible',{},{timeout:1200});
    assert(Date.now()-started<2000);assert.equal(await search.locator('html').getAttribute('data-focus-home'),'false');
    await search.waitForTimeout(4300);assert.equal(await search.locator('#result').evaluate(node=>getComputedStyle(node).visibility),'visible');
    await worker.evaluate(()=>{chrome.storage.session.get=globalThis.restoreSessionGet;});
    results.push('Search content is visible before slow IPC resolves, including result grids that reuse the home-feed id');

    await context.route('https://www.xiaohongshu.com/search_result?keyword=hidden-login',route=>route.fulfill({contentType:'text/html',body:fixture.replace('</body>','<section class="login-container" style="visibility:hidden;width:300px;height:200px">登录<input></section><section class="login-box" style="width:300px;height:200px"></section></body>')}));
    const hidden=await context.newPage();await hidden.goto('https://www.xiaohongshu.com/search_result?keyword=hidden-login');
    await hidden.waitForTimeout(400);assert.equal(await hidden.locator('html').getAttribute('data-focus-view'),'content');
    assert.equal(await hidden.locator('#result').evaluate(node=>getComputedStyle(node).visibility),'visible');
    results.push('Hidden or empty native login placeholders do not trigger a full-page search veil');
    await context.route('https://www.xiaohongshu.com/search_result?keyword=closed-login',route=>route.fulfill({contentType:'text/html',body:fixture.replace('</body>','<section class="login-container" style="width:300px;height:200px">登录<input></section></body>')}));
    const closed=await context.newPage();await closed.goto('https://www.xiaohongshu.com/search_result?keyword=closed-login');
    await closed.waitForFunction(()=>document.documentElement.dataset.focusView==='login');
    await closed.locator('.login-container').evaluate(node=>node.style.visibility='hidden');
    await closed.waitForFunction(()=>document.documentElement.dataset.focusView==='content');
    assert.equal(await closed.locator('#result').evaluate(node=>getComputedStyle(node).visibility),'visible');
    await closed.locator('.login-container').evaluate(node=>node.style.visibility='visible');
    await closed.waitForFunction(()=>document.documentElement.dataset.focusView==='login');
    await closed.locator('.login-container').evaluate(node=>node.style.transform='translateX(-200vw)');
    await closed.waitForFunction(()=>document.documentElement.dataset.focusView==='content');
    results.push('Closing a login overlay releases the search veil even when the site retains the hidden dialog DOM');

    const immediate=await search.evaluate(()=>{history.pushState({},'', '/explore');return getComputedStyle(document.querySelector('#result')).visibility;});
    assert.equal(immediate,'hidden');await search.waitForURL(`chrome-extension://${id}/xiaohongshu.html`);
    results.push('SPA navigation back to a home route immediately restores the recommendation guard');

    // Settings IPC can also stall independently of the worker. The initial
    // entry-page veil must still be removed and the search form remain usable.
    const stalled=await context.newPage();const settingsStarted=Date.now();await stalled.goto(entry+'#storage-stall');
    await stalled.waitForFunction(()=>document.documentElement.dataset.uiReady==='true',{},{timeout:5500});
    assert.equal(await stalled.evaluate(()=>window.storageFaultActive),true);assert(Date.now()-settingsStarted>=3900);
    assert.equal(await stalled.locator('body').evaluate(node=>getComputedStyle(node).visibility),'visible');
    await stalled.locator('#keyword').fill('after timeout');await stalled.locator('#search-form').evaluate(form=>form.requestSubmit());
    await stalled.waitForURL(/search\.bilibili\.com\/all\?keyword=after\+timeout/);
    await stalled.locator('#result').waitFor();
    results.push('A stalled settings read has a deadline and cannot keep an entry page white or disable its search form');

    // The restored pageshow branch is exercised explicitly; actual cache
    // eligibility depends on the browser build, DevTools, and page responses.
    const restored=await context.newPage();await restored.goto('https://www.bilibili.com/video/BVrestore');
    await restored.waitForFunction(()=>document.documentElement.dataset.focusView==='content');
    const restoredId=await worker.evaluate(async()=>{const tabs=await chrome.tabs.query({url:'https://www.bilibili.com/video/BVrestore'});return tabs[0].id;});
    await worker.evaluate(({tabId})=>{FocusAsync.notice(tabId,{type:'BREAK_CHANGED',site:'bilibili',break:null,ended:true});},{tabId:restoredId});
    await restored.waitForTimeout(300);
    assert.equal(await restored.locator('html').getAttribute('data-focus-view'),'content','Ending a break must preserve a video page');
    await restored.evaluate(()=>{document.documentElement.dataset.focusView='entry';});
    await restored.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
    await restored.waitForFunction(()=>document.documentElement.dataset.focusView==='content');
    await restored.waitForTimeout(1400);assert.match(restored.url(),/BVrestore/);
    assert.equal(await restored.locator('#result').evaluate(node=>getComputedStyle(node).visibility),'visible');
    results.push('Restoring a cached document clears stale ending flags and prevents a permanent blank page or delayed unwanted redirect');

    // Search forms must unlock when the same entry document is restored.
    const repeat=await context.newPage();await repeat.goto(entry);await repeat.locator('#keyword').fill('first');
    await repeat.locator('#search-form').evaluate(form=>form.requestSubmit());await repeat.waitForURL(/keyword=first/);
    await repeat.goBack();await repeat.waitForURL(entry);await repeat.locator('#keyword').fill('second');
    await repeat.locator('#search-form').evaluate(form=>form.requestSubmit());await repeat.waitForURL(/keyword=second/);
    results.push('Back navigation leaves the entry form usable for another search');

    const recovery=await worker.evaluate(async()=>{
      const original=chrome.declarativeNetRequest.updateSessionRules;let failed=false;
      chrome.declarativeNetRequest.updateSessionRules=rules=>{if(!failed){failed=true;return Promise.reject(new Error('Injected transient failure'));}return original(rules);};
      breakReady=null;let firstFailed=false;
      try{await ensureBreakReady();}catch{firstFailed=true;}
      await ensureBreakReady();chrome.declarativeNetRequest.updateSessionRules=original;
      return firstFailed;
    });
    assert.equal(recovery,true);
    results.push('A one-time rule-restore failure is retryable and does not poison every subsequent break request');
    await worker.evaluate(()=>chrome.storage.local.set({theme:'zen',language:'zh_CN',friendNote:{name:'旧名字',message:'旧留言'}}));
    const race=await context.newPage();await race.goto(entry+'#stale-settings');
    await race.waitForFunction(()=>window.initialReads>=3);
    await worker.evaluate(()=>chrome.storage.local.set({theme:'friend',language:'en',friendNote:{name:'新名字',message:'只保留新的'}}));
    await race.waitForFunction(()=>document.documentElement.dataset.uiReady==='true');
    assert.equal(await race.locator('html').getAttribute('data-theme'),'friend');assert.equal(await race.locator('html').getAttribute('lang'),'en');
    assert.equal(await race.locator('.friend-copy').textContent(),'只保留新的');
    results.push('Delayed initial settings snapshots cannot overwrite newer theme, language, or custom-note changes from another tab');
    fs.writeFileSync(path.join(artifacts,'reliability-results.json'),JSON.stringify({status:'passed',results,scope:'Isolated Edge loads a temporary extension copy with a startup API-fault shim; websites mocked; persisted pageshow simulated explicitly.'},null,2));
    console.log(results.join('\n'));console.log(`PASS: ${results.length} failure/recovery scenarios`);
  }finally{await context.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
