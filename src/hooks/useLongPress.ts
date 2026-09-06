import { vibratePop } from '../lib/haptics';
import React, { useCallback, useRef, useState } from 'react';

interface UseLongPressOptions {
  onLongPress: (e: React.TouchEvent | React.MouseEvent, pos: {x: number, y: number}) => void;
  onClick?: (e: React.TouchEvent | React.MouseEvent) => void;
  ms?: number;
}

export function useLongPress({ onLongPress, onClick, ms = 400 }: UseLongPressOptions) {
  const [longPressTriggered, setLongPressTriggered] = useState(false);
  const timeout = useRef<NodeJS.Timeout>();
  const target = useRef<EventTarget>();
  const startPos = useRef<{x: number, y: number}>({x: 0, y: 0});

  const start = useCallback(
    (event: React.TouchEvent | React.MouseEvent) => {
      if (event.target) {
        event.target.addEventListener("contextmenu", preventDefault, { passive: false });
        target.current = event.target;
      }
      
      let x = 0, y = 0;
      if ('touches' in event) {
        x = event.touches[0].clientX;
        y = event.touches[0].clientY;
      } else {
        x = (event as React.MouseEvent).clientX;
        y = (event as React.MouseEvent).clientY;
      }
      startPos.current = { x, y };

      setLongPressTriggered(false);
      timeout.current = setTimeout(() => {
        vibratePop();
        onLongPress(event, startPos.current);
        setLongPressTriggered(true);
      }, ms);
    },
    [onLongPress, ms]
  );

  const clear = useCallback(
    (event: React.TouchEvent | React.MouseEvent, shouldTriggerClick = true) => {
      timeout.current && clearTimeout(timeout.current);
      if (shouldTriggerClick && !longPressTriggered && onClick) {
        onClick(event);
      }
      setLongPressTriggered(false);
      if (target.current) {
        target.current.removeEventListener("contextmenu", preventDefault);
      }
    },
    [longPressTriggered, onClick]
  );
  
  const move = useCallback(
    (event: React.TouchEvent | React.MouseEvent) => {
      let x = 0, y = 0;
      if ('touches' in event) {
        x = event.touches[0].clientX;
        y = event.touches[0].clientY;
      } else {
        x = (event as React.MouseEvent).clientX;
        y = (event as React.MouseEvent).clientY;
      }
      
      // Calculate distance moved
      const dx = Math.abs(x - startPos.current.x);
      const dy = Math.abs(y - startPos.current.y);
      
      // If moved more than 10 pixels, cancel long press
      if (dx > 10 || dy > 10) {
        timeout.current && clearTimeout(timeout.current);
      }
    },
    []
  );

  return {
    onMouseDown: (e: React.MouseEvent) => start(e),
    onTouchStart: (e: React.TouchEvent) => start(e),
    onMouseUp: (e: React.MouseEvent) => clear(e),
    onMouseLeave: (e: React.MouseEvent) => clear(e, false),
    onTouchEnd: (e: React.TouchEvent) => clear(e),
    onTouchMove: (e: React.TouchEvent) => move(e),
    onMouseMove: (e: React.MouseEvent) => move(e)
  };
}

const preventDefault = (e: Event) => {
  e.preventDefault();
};
