export const canVibrate = () => typeof navigator !== 'undefined' && 'vibrate' in navigator;

export const vibratePop = () => {
  if (canVibrate()) navigator.vibrate([50]);
};

export const vibrateTap = () => {
  if (canVibrate()) navigator.vibrate([20]);
};

export const vibrateSuccess = () => {
  if (canVibrate()) navigator.vibrate([50, 50, 50]);
};

export const vibrateError = () => {
  if (canVibrate()) navigator.vibrate([200, 100, 200]);
};

export const vibrateJackpot = () => {
  if (canVibrate()) navigator.vibrate([100, 50, 100, 50, 100]);
};
