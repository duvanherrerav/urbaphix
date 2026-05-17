import { logger } from './logger';

export const pedirPermiso = async () => {

  if (!("Notification" in window)) {
    logger.info('Este navegador no soporta notificaciones');
    return;
  }

  const permiso = await Notification.requestPermission();

  if (permiso === "granted") {
    logger.info('Permisos de notificaciones concedidos');
  } else {
    logger.info('Permisos de notificaciones denegados');
  }
};