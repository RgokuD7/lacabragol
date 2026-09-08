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

  // Only reset window.scrollY if window was scrolled unexpectedly by the browser
  // (We do NOT scroll to top on focusout because that interrupts user clicks on buttons like 'Guardar')
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      if (window.scrollY > 0) {
        window.scrollTo(0, 0);
      }
    });
  }

  // Initial call to ensure pristine state
  resetWindowScroll();
}
