/* Move/collapse our own widget only. Never change the website's layout. */
(() => {
  const key = "floatingToolbarPlacement";
  let host, shadow, observer, controller, dragging, dirty = false;
  let placement = {x: .5, y: 0, collapsed: false};
  const clamp = (value, max) => Math.max(12, Math.min(value, Math.max(12, max)));
  function position(left, top) {
    if (!host?.isConnected) return;
    const rect = host.getBoundingClientRect();
    for (const [name, value] of [["left", `${clamp(left, innerWidth - rect.width - 12)}px`], ["top", `${clamp(top, innerHeight - rect.height - 12)}px`]]) {
      if (host.style.getPropertyValue(name) !== value) host.style.setProperty(name, value, "important");
    }
  }
  function fit() {
    if (!host?.isConnected || dragging) return;
    const rect = host.getBoundingClientRect();
    position(12 + placement.x * Math.max(0, innerWidth - rect.width - 24), 12 + placement.y * Math.max(0, innerHeight - rect.height - 24));
  }
  function remember() {
    const rect = host.getBoundingClientRect();
    placement.x = Math.max(0, Math.min(1, (rect.left - 12) / Math.max(1, innerWidth - rect.width - 24)));
    placement.y = Math.max(0, Math.min(1, (rect.top - 12) / Math.max(1, innerHeight - rect.height - 24)));
    dirty = true;
    FocusAsync.local.set({[key]: {...placement}}).catch(() => {});
  }
  function collapsed() {
    shadow.querySelector(".helper").classList.toggle("collapsed", placement.collapsed);
    host.style.setProperty("width", placement.collapsed ? "max-content" : "780px", "important");
    const button = shadow.querySelector(".collapse");
    button.dataset.i18n = placement.collapsed ? "setupExpand" : "setupCollapse";
    button.textContent = FocusI18n.t(button.dataset.i18n);
    button.setAttribute("aria-expanded", String(!placement.collapsed));
  }
  function clear() {
    observer?.disconnect(); controller?.abort();
    host = shadow = dragging = null;
  }
  function expand() {
    if (!host || !placement.collapsed) return;
    placement.collapsed = false; collapsed(); fit(); remember();
  }
  function mount(element, root) {
    if (host === element) return;
    clear(); host = element; shadow = root; dirty = false;
    controller = new AbortController();
    const options = {signal: controller.signal};
    host.style.setProperty("transform", "none", "important");
    collapsed(); fit();
    for (const handle of [shadow.querySelector(".drag-handle"), shadow.querySelector(".copy")]) {
      handle.addEventListener("pointerdown", event => {
        if (event.button !== 0) return;
        event.preventDefault();
        const rect = host.getBoundingClientRect();
        dragging = {x: event.clientX, y: event.clientY, left: rect.left, top: rect.top};
        handle.setPointerCapture(event.pointerId);
      }, options);
      handle.addEventListener("pointermove", event => {
        if (dragging) position(dragging.left + event.clientX - dragging.x, dragging.top + event.clientY - dragging.y);
      }, options);
      const end = () => { if (dragging) { dragging = null; remember(); } };
      handle.addEventListener("pointerup", end, options);
      handle.addEventListener("pointercancel", end, options);
      handle.addEventListener("lostpointercapture", end, options);
    }
    shadow.querySelector(".drag-handle").addEventListener("keydown", event => {
      const direction = {ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1]}[event.key];
      if (!direction) return;
      event.preventDefault();
      const rect = host.getBoundingClientRect(), step = event.shiftKey ? 48 : 16;
      position(rect.left + direction[0] * step, rect.top + direction[1] * step); remember();
    }, options);
    shadow.querySelector(".collapse").addEventListener("click", () => {
      const before = host.getBoundingClientRect();
      placement.collapsed = !placement.collapsed;
      collapsed();
      const after = host.getBoundingClientRect();
      position(before.right - after.width, before.top); remember();
    }, options);
    addEventListener("resize", fit, options);
    observer = new ResizeObserver(fit); observer.observe(host);
    const mounted = host;
    FocusAsync.local.get(key).then(saved => {
      if (host !== mounted || dirty) return;
      const value = saved[key];
      if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) {
        placement = {x: Math.max(0, Math.min(1, value.x)), y: Math.max(0, Math.min(1, value.y)), collapsed: value.collapsed === true};
        collapsed(); fit();
      }
    }).catch(() => {});
  }
  globalThis.FocusFloatingToolbar = Object.freeze({mount, clear, expand});
})();
