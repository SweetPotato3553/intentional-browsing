const {chromium}=require('./runtime.cjs');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const results=[];
fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});
const profile='https://www.xiaohongshu.com/user/profile/study123?xsec_token=test-token&source=web';
function fixture() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;padding-top:8px;font:16px Arial;background:#f7f7f7}.native-header{position:fixed;top:0;left:0;right:0;height:64px;background:white;display:flex;justify-content:center;align-items:center;z-index:2000}.native-header a{padding:15px;color:#333}.content{padding:140px 24px;min-height:1400px}.reds-tabs{display:flex;gap:24px}.reds-tab-item{padding:12px;border:0;background:white;cursor:pointer}.active{border-bottom:2px solid #e24;color:#e24}
  </style></head><body><header class="native-header"><a id="native-favorite" href="${profile}">我的收藏</a></header><main class="content"><h1>个人主页</h1><div class="reds-tabs" role="tablist"><button class="reds-tab-item active" role="tab" aria-selected="true" id="notes">笔记</button><button class="reds-tab-item" role="tab" aria-selected="false" id="saved">收藏</button></div><p id="tab-content">当前是笔记</p><button id="note-save">收藏</button></main><script>
    window.noteSaves=0;document.querySelector('#note-save').onclick=()=>window.noteSaves++;
    setTimeout(()=>document.querySelectorAll('[role=tab]').forEach(button=>button.addEventListener('click',()=>{
      document.querySelectorAll('[role=tab]').forEach(tab=>{const active=tab===button;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));});
      document.querySelector('#tab-content').textContent=button.id==='saved'?'当前是收藏':'当前是笔记';
      // Deliberately leave the URL unchanged, as in native SPA tab switches.
    })),1600);
  </script></body></html>`;
}
async function rect(page) {return page.locator('#focus-collection-setup').boundingBox();}
async function unchanged(page) {
  const value=await page.evaluate(()=>({padding:getComputedStyle(document.body).paddingTop,top:document.querySelector('.native-header').getBoundingClientRect().top,inline:document.querySelector('.native-header').style.top,variable:document.documentElement.style.getPropertyValue('--focus-toolbar-space')}));
  assert.deepEqual(value,{padding:'8px',top:0,inline:'',variable:''});
}
async function run(edition) {
  const extension=require('./runtime.cjs').inspectableExtension(path.resolve(__dirname,'..','extension'));
  const context=await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(),'still-floating-regression-')),{
    executablePath:process.env.EDGE_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,ignoreDefaultArgs:['--disable-extensions'],
    args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],viewport:{width:1366,height:900}
  });
  try {
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    const id=new URL(worker.url()).hostname;
    await worker.evaluate(theme=>chrome.storage.local.set({language:'zh_CN',...(theme?{theme}:{})}),process.env.FOCUS_TEST_THEME||null);
    await context.route('https://www.xiaohongshu.com/**',route=>route.fulfill({contentType:'text/html',body:fixture()}));
    const owner=await context.newPage();await owner.goto(`chrome-extension://${id}/xiaohongshu.html`);
    async function helper() {
      const promise=context.waitForEvent('page');
      const reply=await owner.evaluate(async()=>{const tab=await chrome.tabs.getCurrent();return chrome.runtime.sendMessage({type:'SETUP_START',site:'xiaohongshu',tabId:tab.id});});
      assert(!reply.error,JSON.stringify(reply));
      const page=await promise;await page.waitForURL('https://www.xiaohongshu.com/');
      await page.locator('#focus-collection-setup .collapse').waitFor();
      return {page,reply};
    }
    const {page,reply}=await helper();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await unchanged(page);
    assert(await page.locator('#focus-collection-setup .capture').isDisabled());
    const rejected=await owner.evaluate(async tabId=>chrome.runtime.sendMessage({type:'SETUP_CAPTURE',site:'xiaohongshu',tabId,target:'https://www.xiaohongshu.com/user/profile/forged?tab=fav'}),reply.setup.tabId);
    assert.equal(rejected.code,'setupExpired');
    results.push(`${edition}: homepage remains unsaveable; cross-tab/forged capture rejected; website layout unchanged`);

    const expanded=await rect(page);
    await page.locator('#focus-collection-setup .collapse').click();
    await page.locator('#focus-collection-setup .collapsed').waitFor();
    const compact=await rect(page);
    assert(compact.width<expanded.width*.55);
    assert(await page.locator('#focus-collection-setup .time').isVisible());
    results.push(`${edition}: collapse makes a short floating bar, retaining countdown and capture`);
    await page.locator('#native-favorite').click();await page.waitForURL(profile);
    await page.locator('#focus-collection-setup .collapsed').waitFor();
    assert(await page.locator('#focus-collection-setup .capture').isEnabled(),'Profile without tab=fav is saveable');
    results.push(`${edition}: collapsed state survives native navigation; a parameterless profile enables capture`);
    await unchanged(page);

    const grip=await page.locator('#focus-collection-setup .drag-handle').boundingBox();
    await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();
    await page.mouse.move(1340,850,{steps:8});await page.mouse.up();
    const dragged=await rect(page);
    assert(dragged.y>500 && dragged.x+dragged.width<=1354.5 && dragged.y+dragged.height<=888.5);
    await page.locator('#focus-collection-setup .drag-handle').press('ArrowLeft');
    assert(Math.abs((await rect(page)).x-(dragged.x-16))<1);
    await page.reload();await page.locator('#focus-collection-setup .collapsed').waitFor();
    await page.waitForFunction(()=>document.querySelector('#focus-collection-setup').getBoundingClientRect().top>500);
    await unchanged(page);
    results.push(`${edition}: pointer dragging, keyboard adjustment, viewport bounds, and position persistence work`);
    await page.setViewportSize({width:360,height:600});
    await page.waitForFunction(()=>{const r=document.querySelector('#focus-collection-setup').getBoundingClientRect();return r.left>=11&&r.right<=349&&r.top>=11&&r.bottom<=589;});
    await page.locator('#focus-collection-setup .collapse').click();
    await page.locator('#focus-collection-setup .instruction').filter({hasText:'已识别个人主页'}).waitFor();
    await page.waitForFunction(()=>{const r=document.querySelector('#focus-collection-setup').getBoundingClientRect();return r.left>=11&&r.right<=349&&r.top>=11&&r.bottom<=589;});
    await unchanged(page);
    results.push(`${edition}: both expanded and collapsed widgets stay inside a narrow viewport`);
    await page.setViewportSize({width:1366,height:900});
    await page.locator('#focus-collection-setup .collapse').click();
    await page.screenshot({path:path.join(__dirname,'artifacts',`${edition}-floating.png`)});
    await page.locator('#focus-collection-setup .capture').click();
    await page.waitForURL(/tab=fav/);
    await page.waitForFunction(()=>document.querySelector('#saved').getAttribute('aria-selected')==='true');
    const links=await worker.evaluate(async()=>(await chrome.storage.local.get('favoriteLinks')).favoriteLinks);
    const target=new URL(links.xiaohongshu);
    assert.equal(target.pathname,'/user/profile/study123');assert.equal(target.searchParams.get('tab'),'fav');assert.equal(target.searchParams.get('subTab'),'note');assert.equal(target.searchParams.get('xsec_token'),'test-token');
    assert.equal(await page.evaluate(()=>window.noteSaves),0,'Only profile tabs may be auto-clicked');
    assert.equal(await page.locator('#focus-collection-setup').count(),0);
    await unchanged(page);
    results.push(`${edition}: capture canonicalizes the real profile URL, preserves tokens, and opens the native Saved tab after hydration`);
    await page.locator('#notes').click();
    await page.waitForTimeout(1400);
    assert.equal(await page.locator('#notes').getAttribute('aria-selected'),'true');
    results.push(`${edition}: later user tab choices are respected after the initial saved-tab restoration`);

    const second=await helper();
    await second.page.goto('https://www.xiaohongshu.com/user/profile/spa123');
    await second.page.locator('#focus-collection-setup .capture').waitFor();
    await second.page.waitForTimeout(1700);await second.page.locator('#saved').click();
    assert.equal(second.page.url(),'https://www.xiaohongshu.com/user/profile/spa123');
    assert(await second.page.locator('#focus-collection-setup .capture').isEnabled());
    await second.page.locator('#focus-collection-setup .capture').click();
    await second.page.waitForURL('https://www.xiaohongshu.com/user/profile/spa123?tab=fav&subTab=note');
    await second.page.waitForFunction(()=>document.querySelector('#saved').getAttribute('aria-selected')==='true');
    results.push(`${edition}: clicking Saved without any URL change still saves and reopens the correct collection`);
    assert.equal(errors.length,0,errors.join('\n'));
    console.log(results.filter(line=>line.startsWith(edition)).join('\n'));
  } finally {await context.close();}
}
(async()=>{
  for(const edition of(process.argv.slice(2).length?process.argv.slice(2):['intentional-browsing']))await run(edition);
  fs.writeFileSync(path.join(__dirname,'artifacts',`floating-toolbar-${process.env.FOCUS_TEST_THEME||'zen'}.json`),JSON.stringify({status:'passed',results,scope:'Isolated Edge with mocked native tabs; no live account sign-in.'},null,2));
  console.log(`PASS: ${results.length} floating/profile checks`);
})().catch(error=>{console.error(error);process.exitCode=1;});
