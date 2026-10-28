(() => {
  const defaults = Object.freeze({name: "小明", message: "大不了你就二战呗。"});
  const listeners = new Set();
  let current = defaults;
  let revision = 0;
  function normalize(value) {
    return Object.freeze({
      name: typeof value?.name === "string" && value.name.trim() ? value.name.trim().slice(0, 24) : defaults.name,
      message: typeof value?.message === "string" && value.message.trim() ? value.message.trim().slice(0, 160) : defaults.message
    });
  }
  function apply(value) {
    const next = normalize(value);
    if (next.name === current.name && next.message === current.message) return;
    current = next;
    listeners.forEach(listener => listener(current));
  }
  const ready = FocusAsync.local.get("friendNote").then(saved => {
    if (revision) return;
    const previous = saved.friendNote;
    if (previous?.name === "小明" && previous.message === "我书都翻开了，你还在给学习挑黄道吉日？") {
      apply(defaults);
      void FocusAsync.local.set({friendNote: defaults}).catch(() => {});
    } else apply(previous);
  }).catch(() => {});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.friendNote) { revision++; apply(changes.friendNote.newValue); }
  });
  globalThis.FocusFriend = Object.freeze({
    ready,
    get current() { return current; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    async set(value) {
      if (typeof value?.name !== "string" || !value.name.trim() || value.name.trim().length > 24 ||
          typeof value?.message !== "string" || !value.message.trim() || value.message.trim().length > 160) throw new RangeError("Invalid friend note");
      const next = normalize(value);
      await FocusAsync.local.set({friendNote: next});
      apply(next);
    }
  });
})();
