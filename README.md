# 🐐 LaCabraGol - Champions League PWA

Aplicación Web Progresiva (PWA) móvil diseñada para la gestión de pronósticos, rankings, tablas de posiciones y torneos de la UEFA Champions League entre amigos.

---

## 📱 Características Móvil (100% PWA)

- **Diseño Mobile-First**: Optimizado exclusivamente para la experiencia en pantallas móviles (iOS y Android).
- **Modo Standalone**: Funciona como una app nativa en pantalla completa sin barras de navegación del navegador.
- **Soporte Notch y Safe Areas**: Integración visual fluida con barras de estado y bordes de pantalla mediante `viewport-fit=cover`.
- **Caché y Funcionamiento Offline**: Service Worker configurado con Workbox para tiempos de carga instantáneos y navegación rápida.
- **Instalación Directa**:
  - **Android / Chrome**: Botón de instalación directa integrado.
  - **iOS / Safari**: Guía interactiva paso a paso para "Agregar a Inicio".

---

## 🛠️ Requisitos Previos

- **Node.js** (v18 o superior)
- **npm** (o gestor de paquetes de tu preferencia)
- **Firebase CLI** (para despliegues): `npm install -g firebase-tools`

---

## 🚀 Instalación y Desarrollo Local

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno:**
   Copia la plantilla de entorno:
   ```bash
   cp .env.example .env
   ```

3. **Iniciar servidor de desarrollo:**
   ```bash
   npm run dev
   ```
   La aplicación estará disponible en `http://localhost:3000`.

---

## 📦 Construcción y Despliegue en Firebase Hosting

1. **Construir los archivos estáticos de la PWA:**
   ```bash
   npm run build:client
   ```
   *(Genera los archivos optimizados dentro del directorio `dist/`)*

2. **Iniciar sesión en Firebase (si no lo has hecho):**
   ```bash
   firebase login
   ```

3. **Desplegar en Firebase Hosting:**
   ```bash
   firebase deploy --only hosting
   ```
   *O para desplegar tanto Hosting como Reglas de Firestore:*
   ```bash
   firebase deploy
   ```

---

## 📁 Estructura del Proyecto

```text
├── public/                 # Favicons, iconos PWA y assets públicos
├── src/
│   ├── components/         # Componentes UI (Layout, Badges, Modales, PWA Button)
│   ├── data/               # Fixtures y datos estáticos de equipos de Champions
│   ├── hooks/              # Hooks personalizados (usePWAInstall, useLongPress, etc.)
│   ├── lib/                # Configuración de Firebase, utilidades y hápticos
│   ├── pages/              # Vistas principales (Partidos, Tabla, Ranking, Perfil, Grupo)
│   ├── App.tsx             # Componente raíz
│   └── main.tsx            # Punto de entrada y registro del Service Worker
├── firebase.json           # Configuración de Firebase Hosting y Firestore
├── firestore.rules         # Reglas de seguridad de Firestore
├── vite.config.ts          # Configuración de Vite y plugin PWA
└── package.json            # Dependencias y scripts del proyecto
```
