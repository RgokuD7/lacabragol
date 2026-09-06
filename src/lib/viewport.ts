/**
 * Fixes mobile browser / virtual keyboard viewport displacement.
 * On mobile browsers (iOS Safari, Android Chrome), when an input focuses,
 * the browser scrolls the window up to reveal the virtual keyboard.
 * When the keyboard is dismissed, the browser often fails to reset window.scrollY,
 * leaving a black/empty space at the bottom and pushing the app header off-screen.
 */
export function initViewportFixes() {
  if (typeof window === 'undefined') return;

  const resetWindowScroll = () => {
    if (window.scrollY !== 0 || window.scrollX !== 0) {
      window.scrollTo(0, 0);
    }
    if (document.body && document.body.scrollTop !== 0) {
      document.body.scrollTop = 0;
    }
    if (document.documentElement && document.documentElement.scrollTop !== 0) {
      document.documentElement.scrollTop = 0;
    }
  };

  // 1. Immediately reset if the window scroll changes
  window.addEventListener('scroll', resetWindowScroll, { passive: true });

  // 2. When any input / textarea / editable element blurs, reset scroll
  window.addEventListener('focusout', (e) => {
    const target = e.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) {
      // Run multiple passes to match keyboard slide-down animation timing
      setTimeout(resetWindowScroll, 50);
      setTimeout(resetWindowScroll, 150);
      setTimeout(resetWindowScroll, 300);
    }
  });

  // 3. VisualViewport API integration for modern mobile browsers
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      // When keyboard dismisses, visualViewport height expands back
      if (window.visualViewport && window.visualViewport.height >= window.innerHeight - 50) {
        resetWindowScroll();
      }
    });

    window.visualViewport.addEventListener('scroll', () => {
      if (window.scrollY !== 0) {
        resetWindowScroll();
      }
    });
  }

  // Initial call to ensure pristine state
  resetWindowScroll();
}
