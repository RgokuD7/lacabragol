/**
 * Viewport utilities for mobile browsers.
 * Prevents horizontal layout overflow drift while preserving vertical scroll.
 * Note: Never force window.scrollTo(0, 0) on visualViewport resize, as virtual keyboards
 * trigger resize on focus/keystrokes and that causes jarring scroll jumping to the top of the page.
 */
export function initViewportFixes() {
  if (typeof window === 'undefined') return;

  // Prevent unexpected horizontal scroll drift on mobile devices
  window.addEventListener('scroll', () => {
    if (window.scrollX !== 0) {
      window.scrollTo(0, window.scrollY);
    }
  }, { passive: true });
}

