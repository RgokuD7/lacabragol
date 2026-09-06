import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export interface TutorialOptions {
  onComplete?: () => void;
}

export const startInteractiveTutorial = (options?: TutorialOptions) => {
  let completed = false;
  const finish = () => {
    if (completed) return;
    completed = true;
    options?.onComplete?.();
  };

  const closeOpenModals = () => {
    const closePred = document.querySelector<HTMLButtonElement>('#close-predictions-modal-btn');
    if (closePred) closePred.click();
    const closeChat = document.querySelector<HTMLButtonElement>('#close-group-chat-btn');
    if (closeChat) closeChat.click();
  };

  const driverObj = driver({
    showProgress: true,
    animate: true,
    allowClose: true,
    nextBtnText: 'Siguiente →',
    prevBtnText: '← Anterior',
    doneBtnText: '¡Entendido!',
    progressText: 'Paso {{current}} de {{total}}',
    onPopoverRender: (popover) => {
      const ghostPopovers = document.querySelectorAll('.driver-popover:not(:last-child)');
      ghostPopovers.forEach(el => el.remove());
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
      closeOpenModals();
      finish();
      driverObj.destroy();
    },
    onDestroyed: () => {
      closeOpenModals();
      finish();
    },
  });

  driverObj.drive();
  return driverObj;
};
