let lastVibrateTime = 0;

export const canVibrate = (): boolean => {
  return typeof window !== 'undefined' && 
         typeof navigator !== 'undefined' && 
         'vibrate' in navigator && 
         typeof navigator.vibrate === 'function';
};

/**
 * Robust Haptic Vibration.
 * - On Android (Chrome/Firefox): triggers navigator.vibrate(40) for a crisp 40ms haptic tap.
 * - On iOS (Safari/WebKit): Apple deliberately blocks Web Vibration API at OS level.
 *   Safely caught so no errors or performance hits occur.
 * - Debounced slightly (50ms) so rapid onTouchStart + onClick gestures don't abort each other.
 */
export const vibrate = (pattern: number | number[] = 40): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  // Prevent restarting single-pulse vibration within 50ms (onTouchStart + onClick duplicate)
  const now = Date.now();
  if (typeof pattern === 'number' && now - lastVibrateTime < 50) {
    return true;
  }

  if ('vibrate' in navigator) {
    try {
      lastVibrateTime = now;
      return navigator.vibrate(pattern);
    } catch (e) {
      // Silently catch in case browser policy restricts vibration
      return false;
    }
  }
  return false;
};

export const vibratePop = () => vibrate(40);
export const vibrateTap = () => vibrate(40);
export const vibrateSuccess = () => vibrate([50, 60, 50]);
export const vibrateError = () => vibrate([80, 50, 80]);
export const vibrateJackpot = () => vibrate([60, 50, 60, 50, 100]);


