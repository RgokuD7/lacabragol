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

  const companionBtn = document.querySelector('#tutorial-group-predictions-btn');
  const cardElement = document.querySelector('#tutorial-first-match-card');

  const driverObj = driver({
    showProgress: true,
    animate: true,
    allowClose: true,
    nextBtnText: 'Siguiente →',
    prevBtnText: '← Anterior',
    doneBtnText: '¡Entendido!',
    progressText: 'Paso {{current}} de {{total}}',
    steps: [
      {
        popover: {
          title: '¡Bienvenido a LaCabraGol!',
          description: '¡Bienvenido a LaCabraGol! Demuestra a tus amigos quién es el que más sabe de fútbol. A continuación un pequeño tutorial.',
          align: 'center',
        },
      },
      {
        element: cardElement ? '#tutorial-first-match-card' : undefined,
        popover: {
          title: 'Tarjeta de Partido',
          description: 'Esta es la tarjeta de partido. Aquí ingresarás tus marcadores. Los partidos pasan por 3 fases: Abierto (puedes apostar), En Vivo (bloqueado, pero ves los resultados en tiempo real) y Finalizado (verás tus puntos).',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: companionBtn ? '#tutorial-group-predictions-btn' : (cardElement ? '#tutorial-first-match-card' : undefined),
        popover: {
          title: 'Pronósticos de Compañeros',
          description: 'Podrás ver los pronósticos de tus compañeros y reaccionar a ellos manteniendo presionado.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: document.querySelector('#tutorial-filters-and-rounds') ? '#tutorial-filters-and-rounds' : undefined,
        popover: {
          title: 'Filtros y Jornadas',
          description: 'Usa estos filtros para navegar rápidamente entre los partidos disponibles y las jornadas del torneo.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: document.querySelector('#fab-group-chat') ? '#fab-group-chat' : undefined,
        popover: {
          title: 'Chat del Grupo',
          description: '¡El fútbol se vive debatiendo! Aquí está el chat del grupo. Mantén presionado un mensaje para reaccionar o usa el botón para responder.',
          side: 'top',
          align: 'end',
        },
      },
      {
        element: document.querySelector('#nav-standings') ? '#nav-standings' : undefined,
        popover: {
          title: 'Tabla de Posiciones',
          description: 'En la Tabla revisas tu posición general. Próximamente incluiremos las clasificaciones directas y playoffs.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: document.querySelector('#nav-group-ranking-profile') ? '#nav-group-ranking-profile' : undefined,
        popover: {
          title: 'Ranking, Grupo y Perfil',
          description: 'En Ranking verás los podios. En Grupo están las reglas de tu liga, y en Perfil puedes configurar tu apodo y elegir a tu Campeón.',
          side: 'top',
          align: 'center',
        },
      },
    ],
    onDestroyStarted: () => {
      finish();
      driverObj.destroy();
    },
    onDestroyed: () => {
      finish();
    }
  });

  driverObj.drive();
  return driverObj;
};
