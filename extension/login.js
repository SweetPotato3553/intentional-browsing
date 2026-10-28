/* Native login discovery. Keep retries bounded: server-rendered buttons may not
   have their Vue handlers yet when our document_start script first sees them. */
(() => {
  const dialogs = '.login-container,.login-modal,.login-box,.login-panel,.login-wrapper,[class*="login-modal"],[class*="login-container"],[class*="login-panel"],[class*="login-wrapper"],[role="dialog"],[aria-modal="true"],dialog';
  const loginLabel = /^(?:登录(?:\s*[\/／·]\s*注册)?|注册\s*[\/／·]\s*登录|立即登录|去登录|登\s*录|sign\s*in|log\s*in)$/i;
  let attempts = 0, lastAttempt = -Infinity;
  function visible(element) {
    const root = document.documentElement, previous = root.dataset.focusView;
    root.dataset.focusView = "content";
    try { return nativeVisible(element); }
    finally { if (previous === undefined) delete root.dataset.focusView; else root.dataset.focusView = previous; }
  }
  function nativeVisible(element) {
    if (!element?.isConnected) return false;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    for (let node = element; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      // The temporary probe excludes our own veil from computed styles.
      if (node.hidden || style.display === "none" || style.opacity === "0") return false;
      if (["hidden", "collapse"].includes(node.style.visibility) || node.matches('.hidden,.is-hidden,.invisible,.is-closed,[data-state="closed"]')) return false;
      if (["hidden", "collapse"].includes(style.visibility)) return false;
    }
    return true;
  }
  function nativeDialogs() {
    return [...document.querySelectorAll(dialogs)].filter(element => {
      if (!visible(element) || element.closest('[inert],[aria-hidden="true"]')) return false;
      const rect = element.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.right <= 0 || rect.top >= innerHeight || rect.left >= innerWidth) return false;
      const known = element.matches('.login-container,.login-modal,.login-box,.login-panel,.login-wrapper');
      const signIn = /登录|sign\s*in|log\s*in/i.test(element.textContent || "");
      const form = element.querySelector('input:not([type="hidden"]),canvas,img[src],iframe');
      if (!form || (!known && !signIn)) return false;
      if (!element.hasAttribute("data-focus-native-login")) element.setAttribute("data-focus-native-login", "");
      return true;
    });
  }
  function open(reset = false) {
    if (reset) { attempts = 0; lastAttempt = -Infinity; }
    if (nativeDialogs().length) return true;
    if (document.readyState === "loading" || attempts >= 20 || Date.now() - lastAttempt < 1200) return false;
    const candidates = document.querySelectorAll('.login-btn,.login-button,.login-entry,.reds-button,.reds-button-new,[class*="login"],button,[role="button"],a');
    const button = [...candidates].find(element => visible(element) && !element.disabled && element.getAttribute("aria-disabled") !== "true" &&
      !element.closest('[data-focus-native-login],#focus-search-guard,#focus-collection-setup') &&
      (element.matches('.login-btn,.login-button,.login-entry') || loginLabel.test((element.textContent || element.getAttribute("aria-label") || "").trim())));
    if (!button) return false;
    attempts++;
    lastAttempt = Date.now();
    button.click();
    return nativeDialogs().length > 0;
  }
  function signedIn() {
    // Feed cards also link to user profiles. Only the site's own account entry
    // is evidence of a signed-in session, never an arbitrary author card.
    return [...document.querySelectorAll('a[href*="/user/profile/"]')].some(element => visible(element) &&
      (/^(我|我的|个人中心|me|my profile)$/i.test(element.textContent.trim()) ||
       element.closest('.side-bar,.sidebar,[data-testid="user-menu"]')));
  }
  globalThis.FocusLogin = Object.freeze({nativeDialogs, open, signedIn, visible});
})();
