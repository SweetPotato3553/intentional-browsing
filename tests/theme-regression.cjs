const {chromium,browserPath}=require('./runtime.cjs');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const extension=require('./runtime.cjs').inspectableExtension(path.resolve(__dirname,'..','extension')),artifacts=path.join(__dirname,'artifacts');
fs.mkdirSync(artifacts,{recursive:true});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'still-unified-theme-'));
const results=[];
const launch=()=>chromium.launchPersistentContext(profile,{
  executablePath:browserPath,headless:true,ignoreDefaultArgs:['--disable-extensions'],
  args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],viewport:{width:1366,height:900}
});
const siteFixture='<!doctype html><html data-theme="native"><style>body{margin:0;padding-top:8px;font:16px sans-serif}</style><body><header>Native site</header><main>Fixture only</main></body></html>';
async function theme(page,value){await page.waitForFunction(value=>document.documentElement.dataset.theme===value,value);}
async function select(page,value){await page.locator(`.appearance-card[data-theme-option="${value}"]`).click();await theme(page,value);}
(async()=>{
  let context=await launch();
  try{
    const errors=[];
    context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    const id=new URL(worker.url()).hostname;
    const links={bilibili:'https://space.bilibili.com/123/favlist?fid=456',xiaohongshu:'https://www.xiaohongshu.com/user/profile/shared123?tab=fav&subTab=note'};
    await worker.evaluate(links=>chrome.storage.local.set({language:'zh_CN',theme:'zen',favoriteLinks:links}),links);
    await context.route(/^https:\/\/(?:www\.|space\.|search\.)?(?:bilibili|xiaohongshu)\.com\//,route=>route.fulfill({contentType:'text/html',body:siteFixture}));
    const bili=await context.newPage(),xhs=await context.newPage(),popup=await context.newPage();
    await bili.goto(`chrome-extension://${id}/bilibili.html`);await xhs.goto(`chrome-extension://${id}/xiaohongshu.html`);
    await popup.setViewportSize({width:364,height:620});await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.waitForFunction(()=>document.documentElement.dataset.uiReady==='true');
    assert(await popup.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.body.getBoundingClientRect().height<=600),'Popup fits normal action-popup dimensions');
    await theme(bili,'zen');assert.equal(await bili.locator('h1').textContent(),'这次，想找什么？');
    assert.equal(await bili.locator('h1').evaluate(node=>getComputedStyle(node).fontWeight),'400');
    await bili.locator('#keyword').fill('统计学习');await bili.evaluate(()=>window.preserveInputToken='alive');
    await select(popup,'playful');await theme(bili,'playful');await theme(xhs,'playful');
    assert.equal(await bili.locator('h1').textContent(),'你到底要搜什么？');
    assert.equal(await bili.locator('h1').evaluate(node=>getComputedStyle(node).fontWeight),'800');
    assert.equal(await bili.locator('#keyword').inputValue(),'统计学习');assert.equal(await bili.evaluate(()=>window.preserveInputToken),'alive');
    assert.equal(await bili.locator('.mark').evaluate(node=>getComputedStyle(node,'::after').content),'"?"');
    results.push('Popup selection updates both entry pages, full copy, typography, and logo without reloading or losing input');
    await bili.screenshot({path:path.join(artifacts,'entry-playful.png')});
    await popup.screenshot({path:path.join(artifacts,'popup-playful.png')});
    await bili.locator('.appearance-trigger').click();
    await bili.locator('.appearance-dialog[open]').waitFor();
    assert.equal(await bili.locator('[data-preview="zen"] .appearance-preview-title').textContent(),'这次，想找什么？');
    assert.equal(await bili.locator('[data-preview="playful"] .appearance-preview-title').textContent(),'你到底要搜什么？');
    await bili.screenshot({path:path.join(artifacts,'style-panel.png')});
    await select(bili,'zen');await theme(popup,'zen');
    await bili.locator('.appearance-done').click();assert.equal(await bili.locator('h1').evaluate(node=>getComputedStyle(node).fontWeight),'400');
    assert.equal(await bili.locator('.mark').evaluate(node=>getComputedStyle(node,'::after').content),'none');
    const saved=await worker.evaluate(()=>chrome.storage.local.get(['favoriteLinks','language']));assert.deepEqual(saved,{favoriteLinks:links,language:'zh_CN'});
    assert.equal(await bili.locator('#favorites-link').getAttribute('href'),links.bilibili);
    results.push('Entry style panel previews both themes and switching back restores the original style while keeping favorites and language');
    await bili.screenshot({path:path.join(artifacts,'entry-zen.png')});
    await bili.locator('.language-switch [data-lang="en"]').click();
    await popup.getByRole('radio',{name:'Study or Not',exact:true}).waitFor({state:'attached'});
    await select(popup,'playful');await theme(bili,'playful');
    await bili.reload();await theme(bili,'playful');
    assert.equal(await bili.locator('html').getAttribute('lang'),'en');
    assert.notEqual(await bili.locator('h1').textContent(),'你到底要搜什么？');
    assert.equal(await popup.getByRole('radio',{name:'Study or Not',exact:true}).isChecked(),true);
    results.push('Language and theme remain independent, synchronize across views, and survive page reload');

    const started=await bili.evaluate(async()=>chrome.runtime.sendMessage({type:'BREAK_START',site:'bilibili',minutes:5}));
    assert(!started.error,JSON.stringify(started));
    const native=await context.newPage();await native.goto('https://www.bilibili.com/video/BVtheme');
    await native.locator('#focus-break-timer').waitFor();
    const helperPromise=context.waitForEvent('page');
    const setup=await xhs.evaluate(async()=>{const tab=await chrome.tabs.getCurrent();return chrome.runtime.sendMessage({type:'SETUP_START',site:'xiaohongshu',tabId:tab.id});});
    const helper=await helperPromise;await helper.waitForURL('https://www.xiaohongshu.com/');
    await helper.locator('#focus-collection-setup').waitFor();
    const before=await worker.evaluate(async()=>{const all=await chrome.storage.session.get(null);return {rest:all['break:bilibili'],setup:Object.values(all).find(item=>item?.group&&item.site==='xiaohongshu')};});
    await select(popup,'zen');
    await native.waitForFunction(()=>document.documentElement.dataset.focusTheme==='zen');
    await helper.waitForFunction(()=>document.documentElement.dataset.focusTheme==='zen');
    assert.equal(await native.locator('#focus-break-timer .timer').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(250, 249, 246)');
    assert.equal(await helper.locator('#focus-collection-setup .helper').evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(250, 249, 246)');
    assert.equal(await helper.locator('#focus-collection-setup strong').evaluate(node=>getComputedStyle(node).fontWeight),'400');
    const after=await worker.evaluate(async()=>{const all=await chrome.storage.session.get(null);return {rest:all['break:bilibili'],setup:Object.values(all).find(item=>item?.group&&item.site==='xiaohongshu')};});
    assert.deepEqual(after,before);
    assert.equal(await native.locator('html').getAttribute('data-theme'),'native');assert.equal(await helper.locator('html').getAttribute('data-theme'),'native');
    assert.equal(await helper.locator('body').evaluate(node=>getComputedStyle(node).paddingTop),'8px');
    results.push('Active rest/setup overlays switch colors and typography live without resetting either deadline or changing native page theme/layout');
    await helper.locator('#focus-collection-setup .cancel').click();await helper.waitForURL(/setup=ended/);
    await bili.evaluate(()=>chrome.runtime.sendMessage({type:'BREAK_END',site:'bilibili'}));
    await select(popup,'playful');
    assert.deepEqual((await worker.evaluate(()=>chrome.storage.local.get('favoriteLinks'))).favoriteLinks,links);
    assert.equal(errors.length,0,errors.join('\n'));
    await context.close();context=null;

    context=await launch();
    const restarted=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    const restartId=new URL(restarted.url()).hostname;
    const restored=await context.newPage();await restored.goto(`chrome-extension://${restartId}/xiaohongshu.html`);await theme(restored,'playful');
    assert.equal(await restored.locator('html').getAttribute('lang'),'en');
    assert.equal(await restored.locator('h1').evaluate(node=>getComputedStyle(node).fontWeight),'800');
    assert.equal(await restored.locator('#favorites-link').getAttribute('href'),links.xiaohongshu);
    results.push('A full browser restart restores the selected style, language, and shared favorites');
    fs.writeFileSync(path.join(artifacts,'theme-results.json'),JSON.stringify({status:'passed',results,scope:'Actual unpacked extension in isolated Edge; websites mocked; no account sign-in.'},null,2));
    console.log(results.join('\n'));console.log(`PASS: ${results.length} unified theme scenarios`);
  }finally{await context?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
