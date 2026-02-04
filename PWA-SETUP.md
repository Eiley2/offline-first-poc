# PWA (Progressive Web App) Setup

## ✅ Implementación Completada

La aplicación ahora funciona como una PWA completa con capacidades offline.

## 🎯 Características

### Service Worker
- **Cache automático**: Todos los assets estáticos (JS, CSS, HTML, imágenes) se cachean automáticamente
- **Estrategias de cache**:
  - **CacheFirst**: Para fuentes de Google (fonts.googleapis.com y fonts.gstatic.com)
  - **NetworkFirst**: Para llamadas API (con timeout de 10s y fallback a cache)
- **Actualización automática**: El service worker se actualiza automáticamente cuando hay cambios

### Manifest
- **Instalable**: La app se puede instalar en el dispositivo como una aplicación nativa
- **Standalone mode**: Se abre como app independiente (sin barra de navegador)
- **Iconos**: Configurados para Android, iOS y desktop (192x192 y 512x512)

## 📱 Cómo Instalar la PWA

### En Chrome/Edge (Desktop)
1. Abre la aplicación en el navegador
2. Busca el ícono de instalación (➕) en la barra de direcciones
3. Click en "Instalar"

### En Chrome (Android)
1. Abre la aplicación en Chrome
2. Toca el menú (⋮) > "Añadir a pantalla de inicio"
3. Confirma la instalación

### En Safari (iOS)
1. Abre la aplicación en Safari
2. Toca el botón de compartir (□↑)
3. Selecciona "Añadir a pantalla de inicio"

## 🔧 Desarrollo

### Probar en desarrollo
El Service Worker está habilitado en modo desarrollo:
```bash
bun dev
```

### Build para producción
```bash
bun run build
bun run preview
```

## 📦 Archivos Generados

El plugin `vite-plugin-pwa` genera automáticamente:
- `sw.js` - El Service Worker
- `workbox-*.js` - Librerías de Workbox para gestión de cache
- `manifest.webmanifest` - Manifest generado desde la configuración

## 🎨 Notificaciones

La aplicación muestra notificaciones para:
- ✅ **App lista offline**: Cuando el service worker ha cacheado todo
- 🔄 **Actualización disponible**: Cuando hay una nueva versión

## 🛠️ Configuración

La configuración se encuentra en `vite.config.ts`:
- `registerType: 'autoUpdate'` - Actualiza automáticamente sin preguntar
- Cache de assets estáticos
- Runtime caching para APIs y fuentes externas

## 📝 Notas

- El Service Worker solo funciona en HTTPS (o localhost)
- Los cambios en el Service Worker pueden tardar en reflejarse (usa Ctrl+Shift+R para forzar recarga)
- En DevTools > Application > Service Workers puedes ver el estado y desregistrar si es necesario
