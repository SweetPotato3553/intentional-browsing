/* Storage and extension requests have deadlines. A stuck tab must never hold
   the worker's state queue or leave an entry page behind its initial veil. */
(() => {
  function timeout() { return Object.assign(new Error("connectionTimeout"), {code: "connectionTimeout"}); }
  function limit(operation, milliseconds = 4000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(timeout()), milliseconds);
      Promise.resolve().then(() => typeof operation === "function" ? operation() : operation).then(
        value => { clearTimeout(timer); resolve(value); },
        error => { clearTimeout(timer); reject(error); }
      );
    });
  }
  const storage = area => Object.freeze(Object.fromEntries(["get", "set", "remove"].map(method =>
    [method, argument => limit(() => chrome.storage[area][method](argument))]
  )));
  async function request(message) {
    let result;
    try { result = await limit(() => chrome.runtime.sendMessage(message), 6000); }
    catch (error) { throw error?.code ? error : timeout(); }
    if (!result || typeof result !== "object") throw timeout();
    if (result.error) throw Object.assign(new Error(result.error), {code: result.code, params: result.params});
    return result;
  }
  function notice(tabId, message) {
    // Notifications are best-effort; nobody awaits a site's acknowledgement.
    void limit(() => chrome.tabs.sendMessage(tabId, message), 500).catch(() => {});
  }
  globalThis.FocusAsync = Object.freeze({limit, request, notice, local: storage("local"), session: storage("session")});
})();
