export const canVibrate = (): boolean => {
  try {
    return typeof window !== 'undefined' && 
           typeof navigator !== 'undefined' && 
           'vibrate' in navigator && 
           typeof navigator.vibrate === 'function';
  } catch {
    return false;
  }
};

export const vibrate = (pattern: number | number[]): boolean => {
  try {
    if (canVibrate()) {
      return navigator.vibrate(pattern);
    }
  } catch (err) {
    // Silently ignore if blocked by browser policy
  }
  return false;
};

export const vibratePop = () => vibrate(15);
export const vibrateTap = () => vibrate(10);
export const vibrateSuccess = () => vibrate([35, 45, 35]);
export const vibrateError = () => vibrate([80, 40, 80]);
export const vibrateJackpot = () => vibrate([50, 40, 50, 40, 100]);

