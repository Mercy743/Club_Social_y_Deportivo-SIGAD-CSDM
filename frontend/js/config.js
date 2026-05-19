// ===== CONFIGURACIÓN GLOBAL SIGAD =====
// Detecta automáticamente el entorno y construye la URL del API.

const isProduction = window.location.hostname !== 'localhost' &&
                     !window.location.hostname.match(/^192\.168\./) &&
                     !window.location.hostname.match(/^10\./) &&
                     !window.location.hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./);

const API_URL = isProduction
    ? `${window.location.protocol}//${window.location.hostname}/api`
    : `${window.location.protocol}//${window.location.hostname}:3000/api`;

console.log(`[SIGAD] API_URL: ${API_URL} (${isProduction ? 'producción' : 'desarrollo'})`);