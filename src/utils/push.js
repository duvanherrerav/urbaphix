export const pedirPermiso = async () => {

  if (!("Notification" in window)) {
    console.log("Este navegador no soporta notificaciones");
    return;
  }

  const permiso = await Notification.requestPermission();

  if (permiso === "granted") {
    console.log("Permisos concedidos 🔥");
  } else {
    console.log("Permisos denegados ❌");
  }
};