(() => {
  const I = FocusI18n;
  const names = {zen: "appearanceZenName", playful: "appearancePlayfulName", friend: "appearanceFriendName"};
  const descriptions = {zen: "appearanceZenDescription", playful: "appearancePlayfulDescription", friend: "appearanceFriendDescription"};
  function mount(parent, {inline = false} = {}) {
    if (parent.querySelector(".appearance-picker")) return;
    const container = document.createElement(inline ? "section" : "dialog");
    container.className = `appearance-picker ${inline ? "appearance-inline" : "appearance-dialog"}`;
    container.innerHTML = `<h2 data-i18n="${inline ? "appearanceInlineHeading" : "appearanceHeading"}"></h2><p class="appearance-help" data-i18n="appearanceHelp"></p><fieldset class="appearance-cards"><legend class="appearance-sr" data-i18n="appearanceInlineHeading"></legend>${Object.keys(names).map(theme => `<label class="appearance-card" data-theme-option="${theme}"><input type="radio" name="browsing-style" value="${theme}"><span class="appearance-card-head"><span data-i18n="${names[theme]}"></span><span class="appearance-check" aria-hidden="true">✓</span></span><span class="appearance-preview" data-preview="${theme}"><span class="appearance-preview-title"></span><span class="appearance-preview-line"></span></span><span class="appearance-description" data-i18n="${descriptions[theme]}"></span></label>`).join("")}</fieldset><form class="appearance-friend-editor" hidden><label class="friend-field"><span data-i18n="friendNameLabel"></span><input class="friend-name" type="text" maxlength="24" required autocomplete="off" data-i18n-aria="friendNameLabel"></label><label class="friend-field"><span data-i18n="friendMessageLabel"></span><textarea class="friend-message" maxlength="160" rows="3" required data-i18n-aria="friendMessageLabel"></textarea></label><p class="friend-editor-help" data-i18n="friendEditorHelp"></p><div class="friend-save-row"><button type="submit" class="friend-save" data-i18n="friendSave"></button><span class="friend-save-status" role="status"></span></div></form><p class="appearance-error" role="status"></p>${inline ? "" : '<div class="appearance-actions"><button type="button" class="appearance-done" data-i18n="appearanceDone"></button></div>'}`;
    const editor = container.querySelector(".appearance-friend-editor"), nameField = editor.querySelector(".friend-name"), messageField = editor.querySelector(".friend-message");
    const saveButton = editor.querySelector(".friend-save"), saveStatus = editor.querySelector(".friend-save-status");
    let dirty = false, saving = false;
    nameField.addEventListener("input", () => { dirty = true; saveStatus.textContent = ""; });
    messageField.addEventListener("input", () => { dirty = true; saveStatus.textContent = ""; });
    async function saveNote() {
      if (saving) return false;
      if (!nameField.value.trim() || !messageField.value.trim()) { saveStatus.textContent = I.t("friendEmpty"); return false; }
      if (!editor.reportValidity()) return false;
      saving = true; saveButton.disabled = true;
      try {
        await FocusFriend.set({name: nameField.value, message: messageField.value});
        dirty = false; render(); saveStatus.textContent = I.t("friendSaved");
        return true;
      } catch { saveStatus.textContent = I.t("friendSaveError"); return false; }
      finally { saving = false; saveButton.disabled = false; }
    }
    editor.addEventListener("submit", event => { event.preventDefault(); saveNote(); });
    let trigger;
    if (!inline) {
      trigger = document.createElement("button");
      trigger.type = "button"; trigger.className = "appearance-trigger"; trigger.dataset.i18n = "appearanceAction";
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.addEventListener("click", () => container.showModal());
      parent.append(trigger);
      container.querySelector(".appearance-done").addEventListener("click", async () => {
        if (dirty && !(await saveNote())) return;
        container.close();
      });
      const closeSafely = async () => { if (!dirty || await saveNote()) container.close(); };
      container.addEventListener("cancel", event => { event.preventDefault(); void closeSafely(); });
      container.addEventListener("click", event => {
        if (event.target !== container) return;
        const rect = container.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) void closeSafely();
      });
    }
    parent.append(container);
    const cards = container.querySelector("fieldset"), error = container.querySelector(".appearance-error");
    for (const input of cards.querySelectorAll("input")) input.addEventListener("change", async () => {
      if (!input.checked) return;
      cards.disabled = true; error.textContent = "";
      try { await FocusThemes.set(input.value); }
      catch { render(); error.textContent = I.t("appearanceSaveError"); }
      finally { cards.disabled = false; }
    });
    function render() {
      I.apply(container);
      editor.hidden = FocusThemes.current !== "friend";
      if (!dirty) { nameField.value = FocusFriend.current.name; messageField.value = FocusFriend.current.message; }
      if (trigger) trigger.textContent = I.t("appearanceAction");
      container.setAttribute("aria-label", I.t(inline ? "appearanceInlineHeading" : "appearanceHeading"));
      for (const input of cards.querySelectorAll("input")) {
        input.checked = input.value === FocusThemes.current;
        input.setAttribute("aria-label", I.t(names[input.value]));
      }
      for (const preview of container.querySelectorAll("[data-preview]")) {
        preview.querySelector(".appearance-preview-title").textContent = I.t("headline", {}, preview.dataset.preview);
      }
    }
    I.subscribe(render); render();
  }
  globalThis.FocusAppearance = Object.freeze({mount});
})();
