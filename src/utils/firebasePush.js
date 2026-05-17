import { messaging } from '../services/firebase';
import { getToken } from 'firebase/messaging';
import { logger } from './logger';

export const obtenerToken = async () => {

  try {

    logger.info('Registrando Service Worker de notificaciones');

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    // 🔥 ESTA LÍNEA ES LA SOLUCIÓN
    await navigator.serviceWorker.ready;

    logger.info('Service Worker de notificaciones listo');

    const permiso = await Notification.requestPermission();

    logger.info('Permiso de notificaciones resuelto', { permiso });

    if (permiso !== 'granted') {
      logger.info('Permiso de notificaciones denegado');
      return;
    }

    logger.info('Solicitando token de notificaciones');

    const token = await getToken(messaging, {
      vapidKey: 'BCE5cFRKgpDqkUsodPje1ZnOcbKo7TDiNExYbMMHwa-O2iyXuLSeYhWJqO3ArjCgw3AyeJ19obbh2mX8SzdpEY8',
      serviceWorkerRegistration: registration
    });

    logger.info('Token de notificaciones obtenido');

    return token;

  } catch (error) {
    logger.error('No se pudo obtener token de notificaciones', error);
  }
};