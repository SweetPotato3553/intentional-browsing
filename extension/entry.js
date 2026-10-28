(async () => {
  const I=FocusI18n; await I.ready;
  const site=document.body.dataset.site, form=document.querySelector("#search-form"), input=document.querySelector("#keyword"), status=document.querySelector(".status");
  const tab=await FocusAsync.limit(()=>chrome.tabs.getCurrent());
  const request=(type,extra={})=>FocusAsync.request({type,tabId:tab.id,...extra});
  let statusState=null;
  function setStatus(key,params={},calm=false){statusState={key,params};status.dataset.tone=calm?"calm":"error";status.textContent=I.t(key,params);}
  function showError(error){statusState=null;status.dataset.tone="error";status.textContent=I.error(error);}
  function node(tag,html,props={}){const element=document.createElement(tag);element.innerHTML=html;Object.assign(element,props);return element;}
  I.mountLanguageControls(document.body);
  FocusAppearance.mount(document.body);
  const row=node("div",'<a id="favorites-link" href="#"><span data-i18n="favoriteAction"></span> <span aria-hidden="true">↗</span></a><button type="button" id="favorites-settings" data-i18n="favoriteSettings" data-i18n-aria="favoriteSettingsLabel"></button>',{className:"favorites-entry"});
  form.after(row);
  const link=row.querySelector("a");
  let links={...FocusSearch.defaultFavorites}, openAfterSave=false, opening=false;
  async function loadFavorites(){
    const saved=(await FocusAsync.local.get("favoriteLinks")).favoriteLinks||{};
    links={...FocusSearch.defaultFavorites};
    for(const name of Object.keys(links)) if(saved[name]){try{links[name]=FocusSearch.collectionTarget(name,saved[name]);}catch{if(name===site)setStatus("setupChooseCollection");}}
    link.href=links[site]||"#";
  }
  const favoriteDialog=node("dialog",'<h2 id="favorites-title" data-i18n="favoriteTitle"></h2><p id="favorites-help" data-i18n="favoriteHelp"></p><div class="find-collection"><button type="button" id="favorites-find"></button><p data-i18n="setupHelp"></p></div><form id="favorites-form" novalidate><label for="favorites-bilibili" data-i18n="favoriteBilibili"></label><input id="favorites-bilibili" type="url" autocomplete="off" spellcheck="false" placeholder="https://space.bilibili.com/…/favlist?fid=…"><label for="favorites-xiaohongshu" data-i18n="favoriteXiaohongshu"></label><input id="favorites-xiaohongshu" type="url" autocomplete="off" spellcheck="false" placeholder="https://www.xiaohongshu.com/user/profile/…?tab=fav&amp;subTab=note"><p class="favorites-hint" data-i18n="favoriteHint"></p><p id="favorites-error" role="status"></p><div class="break-actions"><button type="button" id="favorites-cancel" data-i18n="cancel"></button><button type="submit" id="favorites-save" data-i18n="save"></button></div></form>',{className:"break-dialog favorites-dialog"});
  favoriteDialog.setAttribute("aria-labelledby","favorites-title"); document.body.append(favoriteDialog);
  const fields={bilibili:favoriteDialog.querySelector("#favorites-bilibili"),xiaohongshu:favoriteDialog.querySelector("#favorites-xiaohongshu")};
  const favoriteError=favoriteDialog.querySelector("#favorites-error");
  const findButton=favoriteDialog.querySelector("#favorites-find");
  findButton.dataset.i18n=site==="bilibili"?"findBilibili":"findXiaohongshu";
  findButton.addEventListener("click",async()=>{
    if(findButton.disabled)return;findButton.disabled=true;favoriteError.textContent="";
    try{await request("SETUP_START",{site});favoriteError.textContent=I.t("setupOpened");}
    catch(error){favoriteError.textContent=I.error(error);}
    finally{findButton.disabled=false;}
  });
  chrome.runtime.onMessage.addListener(msg=>{
    if(msg.type==="SETUP_SAVED"&&msg.ownerId===tab.id&&msg.site===site){
      loadFavorites().then(()=>{for(const name of Object.keys(fields))fields[name].value=links[name];favoriteDialog.close();setStatus("favoriteSaved",{},true);}).catch(showError);
    }
  });
  async function settings(first=false){
    if(favoriteDialog.open)return;
    await loadFavorites();if(favoriteDialog.open)return;openAfterSave=first;
    for(const name of Object.keys(fields)){fields[name].value=links[name];fields[name].required=first&&name===site;fields[name].hidden=first&&name!==site;favoriteDialog.querySelector('label[for="favorites-'+name+'"]').hidden=first&&name!==site;}
    favoriteDialog.querySelector("h2").dataset.i18n=first?"favoriteFirstTitle":"favoriteTitle";
    favoriteDialog.querySelector("#favorites-help").dataset.i18n=first?"favoriteFirstHelp":"favoriteHelp";
    favoriteDialog.querySelector("#favorites-save").dataset.i18n=first?"saveAndOpen":"save";
    favoriteError.textContent="";I.apply(favoriteDialog);favoriteDialog.showModal();fields[site].focus();
  }
  async function navigateFavorite(){
    const target=FocusSearch.collectionTarget(site,links[site]);
    await request("SET_FAVORITE",{site,target});location.assign(target);
  }
  link.addEventListener("click",async event=>{
    event.preventDefault();if(opening)return;opening=true;
    try{await loadFavorites();if(!links[site]){await settings(true);opening=false;return;}await navigateFavorite();}
    catch(error){opening=false;showError(error);}
  });
  row.querySelector("button").addEventListener("click",()=>settings(false).catch(showError));
  favoriteDialog.querySelector("#favorites-cancel").addEventListener("click",()=>favoriteDialog.close());
  favoriteDialog.querySelector("form").addEventListener("submit",async event=>{
    event.preventDefault();const save=favoriteDialog.querySelector("#favorites-save");if(save.disabled)return;save.disabled=true;
    try{
      const saved={};
      for(const name of Object.keys(fields)){
        const value=fields[name].value.trim();
        if(openAfterSave&&name===site&&!value){fields[name].focus();throw FocusSearch.failure("invalidFavorite",{site});}
        saved[name]=value?FocusSearch.collectionTarget(name,value):"";
      }
      await FocusAsync.local.set({favoriteLinks:saved});await loadFavorites();favoriteDialog.close();
      if(openAfterSave)await navigateFavorite();else setStatus("favoriteSaved",{},true);
    }catch(error){favoriteError.textContent=I.error(error);}finally{save.disabled=false;}
  });
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==="local"&&changes.favoriteLinks)loadFavorites().catch(()=>{});});
  const restLink=node("button","",{type:"button",id:"break-link",className:"break-link"});restLink.dataset.i18n="breakLink";document.body.append(restLink);
  const restDialog=node("dialog",'<h2 id="break-title" data-i18n="breakConfirmTitle"></h2><section id="break-confirm"><p data-i18n="breakConfirmHelp"></p><div class="break-actions"><button type="button" id="break-cancel" data-i18n="breakCancel" autofocus></button><button type="button" id="break-confirm-next" data-i18n="breakConfirm"></button></div></section><section id="break-duration" hidden><p data-i18n="breakDurationHelp"></p><form id="break-form" novalidate><label class="minutes-field"><input id="break-minutes" type="number" min="1" max="180" step="1" value="15" required data-i18n-aria="minutesLabel"><span data-i18n="minutes"></span></label><p class="break-range" data-i18n="minutesRange"></p><p id="break-error" role="status"></p><div class="break-actions"><button type="button" id="break-back" data-i18n="breakBack"></button><button type="submit" id="break-start" data-i18n="breakStart"></button></div></form></section>',{id:"break-dialog",className:"break-dialog"});
  restDialog.setAttribute("aria-labelledby","break-title");document.body.append(restDialog);
  const minutes=restDialog.querySelector("#break-minutes"),breakError=restDialog.querySelector("#break-error");
  function durationStep(active){
    restDialog.querySelector("#break-confirm").hidden=active;restDialog.querySelector("#break-duration").hidden=!active;
    restDialog.querySelector("h2").dataset.i18n=active?"breakDurationTitle":"breakConfirmTitle";I.apply(restDialog);breakError.textContent="";
    if(active){minutes.focus();minutes.select();}
  }
  restLink.addEventListener("click",()=>{durationStep(false);restDialog.showModal();});
  restDialog.querySelector("#break-cancel").addEventListener("click",()=>restDialog.close());
  restDialog.querySelector("#break-confirm-next").addEventListener("click",()=>durationStep(true));
  restDialog.querySelector("#break-back").addEventListener("click",()=>{durationStep(false);restDialog.querySelector("#break-confirm-next").focus();});
  restDialog.querySelector("form").addEventListener("submit",async event=>{
    event.preventDefault();const start=restDialog.querySelector("#break-start");if(start.disabled)return;start.disabled=true;
    try{await request("BREAK_START",{site,minutes:Number(minutes.value)});location.assign(FocusSearch.sites[site].home);}
    catch(error){breakError.textContent=I.error(error);start.disabled=false;}
  });
  document.querySelector(".login-link")?.addEventListener("click", async event => {
    event.preventDefault(); const button = event.currentTarget;
    if (button.dataset.busy) return; button.dataset.busy = "true";
    try { await request("LOGIN_START", {site, quiet:true}); location.assign(button.href); }
    catch (error) { showError(error); delete button.dataset.busy; }
  });
  let submitting=false;
  form.addEventListener("submit",async event=>{
    event.preventDefault();if(submitting)return;const keyword=input.value.trim();
    if(!keyword){setStatus("emptySearch");input.focus();return;}submitting=true;
    try{await request("SET",{site,keyword});location.assign(FocusSearch.searchUrl(site,keyword));}
    catch(error){submitting=false;setStatus("searchOpenError",{error:I.error(error)});}
  });
  addEventListener("pageshow",event=>{
    submitting=false;opening=false;
    restDialog.querySelector("#break-start").disabled=false;
    findButton.disabled=false;
    if(event.persisted)loadFavorites().catch(showError);
  });
  function render(){
    document.documentElement.lang=I.language==="zh_CN"?"zh-CN":"en";document.documentElement.dataset.theme=FocusTheme;
    document.title=I.t("brand")+" · "+I.t(site==="bilibili"?"siteBilibili":"siteXiaohongshu");I.apply();
    if(FocusTheme==="friend"){
      const heading=document.querySelector("h1"), header=document.createElement("span"), avatar=document.createElement("span"), contact=document.createElement("span"), attribution=document.createElement("span"), channel=document.createElement("span"), copy=document.createElement("span");
      header.className="friend-sms-header";avatar.className="friend-avatar";avatar.setAttribute("aria-hidden","true");avatar.textContent=Array.from(FocusFriend.current.name)[0]||"?";
      contact.className="friend-contact";channel.className="friend-channel";channel.textContent=I.t("friendChannel");
      attribution.className="friend-attribution";attribution.textContent=I.t("friendAttribution",{name:FocusFriend.current.name});
      copy.className="friend-copy";copy.textContent=FocusFriend.current.message;
      contact.append(attribution,channel);header.append(avatar,contact);heading.replaceChildren(header,copy);
    }
    if(statusState)status.textContent=I.t(statusState.key,statusState.params);
  }
  I.subscribe(render);render();document.documentElement.dataset.uiReady="true";
  await loadFavorites().catch(error=>setStatus("favoriteLoadError",{error:I.error(error)}));
  if(new URLSearchParams(location.search).get("login")==="ended"){setStatus("loginEnded",{},true);return;}
  if(new URLSearchParams(location.search).get("setup")==="ended"){setStatus("setupEnded",{},true);return;}
  if(new URLSearchParams(location.search).get("rest")==="ended"){setStatus("breakEnded",{},true);return;}
  const {pending}=await request("TAKE_RESUME",{site});
  if(pending?.site===site){setStatus(pending.kind==="favorite"?"favoriteResume":"searchResume");location.replace(FocusSearch.pendingUrl(pending));}
})().catch(error=>{
  document.documentElement.dataset.uiReady="true";FocusI18n.apply();const status=document.querySelector(".status");if(status){status.textContent=FocusI18n.error(error);const reload=document.createElement("button");reload.type="button";reload.textContent=FocusI18n.t("reloadPage");reload.addEventListener("click",()=>location.reload());status.after(reload);}
});
