import { messaging } from '../services/firebase';
import { getToken } from 'firebase/messaging';

export const obtenerToken = async () => {

  try {

    console.log("🔥 Registrando Service Worker...");

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

    // 🔥 ESTA LÍNEA ES LA SOLUCIÓN
    await navigator.serviceWorker.ready;

    console.log("✅ SW LISTO");

    const permiso = await Notification.requestPermission();

    console.log("PERMISO:", permiso);

    if (permiso !== 'granted') {
      console.log("❌ Permiso denegado");
      return;
    }

    console.log("🔥 Obteniendo token...");

    const token = await getToken(messaging, {
      vapidKey: 'BCE5cFRKgpDqkUsodPje1ZnOcbKo7TDiNExYbMMHwa-O2iyXuLSeYhWJqO3ArjCgw3AyeJ19obbh2mX8SzdpEY8',
      serviceWorkerRegistration: registration
    });

    console.log("🎯 TOKEN OBTENIDO:", token);

    return token;

  } catch (error) {
    console.log("❌ ERROR TOKEN:", error);
  }
};