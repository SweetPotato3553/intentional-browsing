const {chromium,browserPath}=require('./runtime.cjs');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const extension=path.resolve(__dirname,'..','extension'),artifacts=path.join(__dirname,'artifacts');
fs.mkdirSync(artifacts,{recursive:true});
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'still-friend-note-')),results=[];
const sample='大不了你就二战呗。';
const launch=()=>chromium.launchPersistentContext(profile,{executablePath:browserPath,headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`],viewport:{width:1366,height:900}});
async function waitTheme(page,value){await page.waitForFunction(value=>document.documentElement.dataset.theme===value,value);}
async function note(page,name,message){await page.waitForFunction(({name,message})=>document.querySelector('.friend-attribution')?.textContent.includes(name)&&document.querySelector('.friend-copy')?.textContent===message,{name,message});}
(async()=>{
  let context=await launch();
  try{
    const errors=[];context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
    const id=new URL(worker.url()).hostname;
    const links={bilibili:'https://space.bilibili.com/123/favlist?fid=456',xiaohongshu:'https://www.xiaohongshu.com/user/profile/friend123?tab=fav&subTab=note'};
    await worker.evaluate(links=>chrome.storage.local.set({theme:'zen',language:'zh_CN',favoriteLinks:links}),links);
    const bili=await context.newPage(),xhs=await context.newPage(),popup=await context.newPage();
    await bili.goto(`chrome-extension://${id}/bilibili.html`);await xhs.goto(`chrome-extension://${id}/xiaohongshu.html`);
    await popup.setViewportSize({width:364,height:620});await popup.goto(`chrome-extension://${id}/popup.html`);
    await popup.locator('[data-theme-option="friend"]').click();await waitTheme(bili,'friend');await waitTheme(xhs,'friend');
    await note(bili,'小明',sample);await note(xhs,'小明',sample);
    assert.equal(await popup.locator('.friend-name').inputValue(),'小明');assert.equal(await popup.locator('.friend-message').inputValue(),sample);
    await bili.reload();await note(bili,'小明',sample);
    results.push('Third style opens with one fixed example, editable name/message, and the requested attribution layout');
    await worker.evaluate(()=>chrome.storage.local.set({friendNote:{name:'小明',message:'我书都翻开了，你还在给学习挑黄道吉日？'}}));
    await bili.reload();await note(bili,'小明',sample);
    await bili.waitForFunction(()=>FocusFriend.current.message==='大不了你就二战呗。');
    results.push('The previous shipped example migrates to the new default text without requiring a settings reset');

    await bili.locator('#keyword').fill('复习统计学');
    const first={name:'阿飞',message:'我都翻开书了，你的搜索词还在放假？'};
    await popup.locator('.friend-name').fill(first.name);await popup.locator('.friend-message').fill(first.message);await popup.locator('.friend-save').click();
    await note(bili,first.name,first.message);await note(xhs,first.name,first.message);
    assert.equal(await bili.locator('#keyword').inputValue(),'复习统计学');
    const settings=await worker.evaluate(()=>chrome.storage.local.get(['friendNote','favoriteLinks','theme','language']));
    assert.deepEqual(settings,{friendNote:first,favoriteLinks:links,theme:'friend',language:'zh_CN'});
    results.push('Saving in the popup updates both platform pages without changing search input, favorites, theme, or language');

    await popup.locator('.friend-name').fill('未保存的草稿');
    await bili.locator('.appearance-trigger').click();
    const second={name:'小林',message:'同桌都开工了，你的键盘还在热身？'};
    await bili.locator('.friend-name').fill(second.name);await bili.locator('.friend-message').fill(second.message);await bili.locator('.appearance-done').click();
    await bili.locator('.appearance-dialog').waitFor({state:'hidden'});await note(xhs,second.name,second.message);
    assert.equal(await popup.locator('.friend-name').inputValue(),'未保存的草稿');
    await popup.reload();await popup.locator('.appearance-friend-editor').waitFor();assert.equal(await popup.locator('.friend-name').inputValue(),second.name);
    results.push('Done saves edited fields; cross-page updates preserve an editor’s unsaved draft');

    await popup.locator('.friend-message').fill('   ');await popup.locator('.friend-save').click();
    await popup.locator('.friend-save-status').filter({hasText:'写个名字'}).waitFor();
    assert.deepEqual((await worker.evaluate(()=>chrome.storage.local.get('friendNote'))).friendNote,second);
    results.push('Blank notes are rejected while the previous saved message remains intact');

    const literal={name:'<阿飞>',message:'<img src=x onerror="window.noteExecuted=1">\n{site}：我先学了！'};
    await popup.locator('.friend-name').fill(literal.name);await popup.locator('.friend-message').fill(literal.message);await popup.locator('.friend-save').click();
    await note(bili,literal.name,literal.message);
    assert.equal(await bili.locator('h1 img').count(),0);assert.equal(await bili.evaluate(()=>window.noteExecuted),undefined);
    await bili.locator('.language-switch [data-lang="en"]').click();await note(xhs,literal.name,literal.message);
    await bili.reload();await note(bili,literal.name,literal.message);
    assert.equal(await bili.locator('html').getAttribute('lang'),'en');
    results.push('Names, markup-like text, placeholders, and newlines render literally and stay unchanged across language switches and reloads');

    for(const theme of ['zen','playful']){
      await popup.locator(`[data-theme-option="${theme}"]`).click();await waitTheme(bili,theme);
      assert.equal(await popup.locator('.appearance-friend-editor').isVisible(),false);
    }
    await popup.locator('[data-theme-option="friend"]').click();await note(bili,literal.name,literal.message);
    await bili.locator('.language-switch [data-lang="zh_CN"]').click();
    await popup.locator('.friend-name').fill('小明');await popup.locator('.friend-message').fill(sample);await popup.locator('.friend-save').click();
    await note(bili,'小明',sample);await bili.locator('#keyword').fill('');
    await bili.screenshot({path:path.join(artifacts,'friend-entry.png')});
    await bili.locator('.appearance-trigger').click();await bili.screenshot({path:path.join(artifacts,'friend-panel.png')});await bili.locator('.appearance-done').click();
    await bili.setViewportSize({width:360,height:740});
    assert(await bili.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Friend entry fits a narrow viewport');
    assert(await popup.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.body.getBoundingClientRect().height<=600),'Friend editor fits a normal popup scroll area');
    results.push('Switching to other styles preserves the fixed note; entry and editor remain usable at narrow widths');
    assert.equal(errors.length,0,errors.join('\n'));
    await context.close();context=null;context=await launch();
    const resumed=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const resumedId=new URL(resumed.url()).hostname;
    const restored=await context.newPage();await restored.goto(`chrome-extension://${resumedId}/xiaohongshu.html`);await note(restored,'小明',sample);
    assert.equal(await restored.locator('#favorites-link').getAttribute('href'),links.xiaohongshu);
    results.push('The selected friend style, fixed note, and shared favorites survive a full browser restart');
    fs.writeFileSync(path.join(artifacts,'friend-results.json'),JSON.stringify({status:'passed',results,scope:'Actual unpacked extension in isolated Edge; no external accounts.'},null,2));
    console.log(results.join('\n'));console.log(`PASS: ${results.length} friend-note scenarios`);
  }finally{await context?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
