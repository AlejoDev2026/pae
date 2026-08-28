// Url base para las peticiones
// export const API_BASE = `https://gruponava.com.co/servicesPae/`;
export const API_BASE = `https://app.accionporcolombia.com/servicesPae/`;
//app.accionporcolombia.com

// Función para formatear un numero para añadir el simbolo $ y un punto cada 3 digitos
export const formatearDinero = (num) => {
  return "$" + Math.floor(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};