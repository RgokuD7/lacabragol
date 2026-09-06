import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export interface TutorialOptions {
  onComplete?: () => void;
}

let activeDriverInstance: ReturnType<typeof driver> | null = null;

export const destroyActiveTutorial = () => {
  if (activeDriverInstance) {
    try {
      activeDriverInstance.destroy();
    } catch (e) {
      console.warn("Error destroying driver instance:", e);
    }
    activeDriverInstance = null;
  }
  document.querySelectorAll('.driver-overlay, .driver-popover, #driver-dummy-element').forEach(el => el.remove());
  document.body.classList.remove('driver-active', 'driver-fade', 'driver-simple', 'driver-no-scroll');
};

export const waitForElement = (selector: string, timeout = 3000): Promise<HTMLElement | null> => {
  return new Promise((resolve) => {
    const el = document.querySelector<HTMLElement>(selector);
    if (el) return resolve(el);
    const observer = new MutationObserver(() => {
      const found = document.querySelector<HTMLElement>(selector);
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve(document.querySelector<HTMLElement>(selector));
    }, timeout);
  });
};

export const startInteractiveTutorial = async (options?: TutorialOptions) => {
  destroyActiveTutorial();

  let completed = false;
  let scrollListener: (() => void) | null = null;

  const mainEl = document.querySelector('main');

  const cleanupSync = () => {
    if (scrollListener) {
      mainEl?.removeEventListener('scroll', scrollListener);
      window.removeEventListener('scroll', scrollListener);
      window.removeEventListener('resize', scrollListener);
      scrollListener = null;
    }
  };

  const finish = () => {
    if (completed) return;
    completed = true;
    cleanupSync();
    options?.onComplete?.();
  };

  const closeOpenModals = () => {
    const closePred = document.querySelector<HTMLButtonElement>('#close-predictions-modal-btn');
    if (closePred) closePred.click();
    const closeChat = document.querySelector<HTMLButtonElement>('#close-group-chat-btn');
    if (closeChat) closeChat.click();
  };

  // Reset scroll on <main> container to guarantee natural layout coordinates from top
  if (mainEl) {
    mainEl.scrollTo({ top: 0, behavior: 'auto' });
  }
  window.scrollTo(0, 0);

  // Wait for root card target to be fully mounted in the DOM
  await waitForElement('#tutorial-first-match-card', 3000);
  // Allow two animation frames for React to finish rendering and DOM to settle
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const enforceSolidOverlayIfDummy = (element?: Element | null) => {
    if (!element || element.id === 'driver-dummy-element') {
      const overlayPath = document.querySelector<SVGPathElement>('.driver-overlay path');
      if (overlayPath) {
        overlayPath.setAttribute(
          'd',
          `M${window.innerWidth},0L0,0L0,${window.innerHeight}L${window.innerWidth},${window.innerHeight}Z`
        );
      }
    }
  };

  const driverObj = driver({
    showProgress: true,
    animate: false, // Critical: Instant accurate element transitions without stale __activeElement animation delays
    allowClose: true,
    stagePadding: 10,
    stageRadius: 8,
    popoverOffset: 12,
    nextBtnText: 'Siguiente →',
    prevBtnText: '← Anterior',
    doneBtnText: '¡Entendido!',
    progressText: 'Paso {{current}} de {{total}}',
    onPopoverRender: (popover) => {
      const ghostPopovers = document.querySelectorAll('.driver-popover:not(:last-child)');
      ghostPopovers.forEach(el => el.remove());
    },
    onHighlightStarted: (element) => {
      if (!element || element.id === 'driver-dummy-element') {
        enforceSolidOverlayIfDummy(element);
        return;
      }

      // If highlighting real element, clean up any previous dummy element
      document.getElementById('driver-dummy-element')?.remove();

      element.scrollIntoView({ behavior: 'auto', block: 'nearest' });
      requestAnimationFrame(() => {
        if (driverObj.isActive()) {
          driverObj.refresh();
        }
      });
    },
    onHighlighted: (element) => {
      if (!element || element.id === 'driver-dummy-element') {
        enforceSolidOverlayIfDummy(element);
      } else {
        requestAnimationFrame(() => {
          if (driverObj.isActive()) {
            driverObj.refresh();
          }
        });
      }
    },
    steps: [
      // Paso 1 (Bienvenida): Sin elemento (align: 'center')
      {
        popover: {
          title: '¡Bienvenido a LaCabraGol!',
          description: 'Demuestra a tus amigos quién es el que más sabe de fútbol. A continuación un pequeño tutorial.',
          align: 'center',
        },
      },
      // Paso 2 (Tarjeta - Ingresar Resultado): Elemento tarjeta del partido
      {
        element: '#tutorial-first-match-card',
        popover: {
          title: 'Tu Pronóstico',
          description: 'Aquí pones tu resultado. Tienes hasta la hora límite para ingresarlo.',
          side: 'bottom',
          align: 'center',
        },
      },
      // Paso 3 (Tarjeta - En Juego): Mismo elemento de la tarjeta
      {
        element: '#tutorial-first-match-card',
        popover: {
          title: 'Partido En Juego',
          description: 'Cuando el tiempo se agota, pasa a "En Juego". Ya no puedes apostar. Sabrás que el partido arrancó y el marcador se actualizará de vez en cuando.',
          side: 'bottom',
          align: 'center',
        },
      },
      // Paso 4 (Ver Pronósticos): Elemento botón de ver pronósticos
      {
        element: '#tutorial-group-predictions-btn',
        popover: {
          title: 'Pronósticos de Compañeros',
          description: 'Al estar en juego, puedes ver qué apostaron tus amigos.',
          side: 'bottom',
          align: 'center',
          onNextClick: () => {
            const btn = document.querySelector<HTMLButtonElement>('#tutorial-group-predictions-btn');
            if (btn) btn.click();
            setTimeout(() => {
              driverObj.moveNext();
            }, 300);
          },
        },
      },
      // Paso 5 (Reacciones y Puntos): Elemento modal de pronósticos recién abierto
      {
        element: '#tutorial-predictions-sheet',
        popover: {
          title: '¡Reacciona!',
          description: 'Si mantienes presionado el pronóstico de un compañero, podrás reaccionar con emojis. Cuando el partido termine, aquí mismo aparecerán los puntos ganados.',
          side: 'top',
          align: 'center',
          onNextClick: () => {
            const closeBtn = document.querySelector<HTMLButtonElement>('#close-predictions-modal-btn');
            if (closeBtn) closeBtn.click();
            setTimeout(() => {
              driverObj.moveNext();
            }, 300);
          },
          onPrevClick: () => {
            const closeBtn = document.querySelector<HTMLButtonElement>('#close-predictions-modal-btn');
            if (closeBtn) closeBtn.click();
            setTimeout(() => {
              driverObj.movePrevious();
            }, 300);
          },
        },
      },
      // Paso 6 (Filtros): Elemento barra de filtros y jornadas
      {
        element: '#tutorial-filters-and-rounds',
        popover: {
          title: 'Filtros y Jornadas',
          description: 'Usa estos filtros para navegar rápidamente entre los partidos disponibles y las jornadas del torneo.',
          side: 'bottom',
          align: 'center',
          onPrevClick: () => {
            const btn = document.querySelector<HTMLButtonElement>('#tutorial-group-predictions-btn');
            if (btn) btn.click();
            setTimeout(() => {
              driverObj.movePrevious();
            }, 350);
          },
        },
      },
      // Paso 7 (FAB Chat): Elemento botón flotante del chat
      {
        element: '#fab-group-chat',
        popover: {
          title: 'Chat del Grupo',
          description: '¡El fútbol se vive debatiendo! Haz clic para abrir el chat.',
          side: 'top',
          align: 'end',
          onNextClick: () => {
            const fab = document.querySelector<HTMLButtonElement>('#fab-group-chat');
            if (fab) fab.click();
            setTimeout(() => {
              driverObj.moveNext();
            }, 300);
          },
        },
      },
      // Paso 8 (Dentro del Chat): Elemento contenedor de los mensajes del chat
      {
        element: '#tutorial-chat-messages-container',
        popover: {
          title: 'Interactúa en Vivo',
          description: 'Aquí escribirás con tus amigos. Si mantienes presionado un mensaje podrás reaccionar, y con el botón lateral podrás responder rápidamente.',
          side: 'top',
          align: 'center',
          onNextClick: () => {
            const closeBtn = document.querySelector<HTMLButtonElement>('#close-group-chat-btn');
            if (closeBtn) closeBtn.click();
            setTimeout(() => {
              driverObj.moveNext();
            }, 300);
          },
          onPrevClick: () => {
            const closeBtn = document.querySelector<HTMLButtonElement>('#close-group-chat-btn');
            if (closeBtn) closeBtn.click();
            setTimeout(() => {
              driverObj.movePrevious();
            }, 300);
          },
        },
      },
      // Paso 9 (Tabla de Posiciones): Elemento tab Tabla
      {
        element: '#nav-standings',
        popover: {
          title: 'Tabla de Posiciones',
          description: 'En la Tabla revisas la clasificación en tiempo real, con la columna de puntos fija mientras navegas las estadísticas.',
          side: 'top',
          align: 'center',
          onPrevClick: () => {
            const fab = document.querySelector<HTMLButtonElement>('#fab-group-chat');
            if (fab) fab.click();
            setTimeout(() => {
              driverObj.movePrevious();
            }, 300);
          },
        },
      },
      // Paso 10 (Ranking, Grupo y Perfil): Elemento grupo de tabs
      {
        element: '#nav-group-ranking-profile',
        popover: {
          title: 'Ranking, Grupo y Perfil',
          description: 'En Ranking verás los podios. En Grupo están las reglas de tu liga, y en Perfil configuras tu apodo y eliges a tus candidatos del Podio.',
          side: 'top',
          align: 'center',
        },
      },
    ],
    onDestroyStarted: () => {
      cleanupSync();
      closeOpenModals();
      finish();
      destroyActiveTutorial();
    },
    onDestroyed: () => {
      cleanupSync();
      closeOpenModals();
      finish();
      destroyActiveTutorial();
    },
  });

  activeDriverInstance = driverObj;

  // Attach continuous synchronization to <main> scroll and window resize
  scrollListener = () => {
    if (driverObj.isActive()) {
      driverObj.refresh();
    }
  };
  mainEl?.addEventListener('scroll', scrollListener, { passive: true });
  window.addEventListener('scroll', scrollListener, { passive: true });
  window.addEventListener('resize', scrollListener, { passive: true });

  driverObj.drive();
  return driverObj;
};
