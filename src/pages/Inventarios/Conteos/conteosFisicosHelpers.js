export const API_BASE_CONTEOS =
    "https://app.accionporcolombia.com/servicesPae/Inventario/Conteos/";

export const respuestaExitosa = (respuesta) =>
    respuesta?.rpta === "si" || respuesta?.rpta === true;

export const leerRespuesta = async (respuesta) => {
    const texto = await respuesta.text();

    try {
        return JSON.parse(texto);
    } catch {
        throw new Error(
            texto || "El servicio devolvió una respuesta no válida."
        );
    }
};

export const obtenerUsuarioSesion = () => {
    for (const llave of ["us", "usuario"]) {
        try {
            const valor = localStorage.getItem(llave);
            if (!valor) continue;

            const usuario = JSON.parse(valor);
            if (usuario && typeof usuario === "object") return usuario;
        } catch {
            // Continúa con la siguiente llave.
        }
    }

    return null;
};

export const obtenerIdUsuario = () => {
    const usuario = obtenerUsuarioSesion();

    return Number(
        usuario?.id ||
        usuario?.idUsuario ||
        usuario?.usuario?.id ||
        0
    );
};

export const formatearFechaHora = (fecha) => {
    if (!fecha) return "Sin definir";

    const objeto = new Date(String(fecha).replace(" ", "T"));
    if (Number.isNaN(objeto.getTime())) return fecha;

    return new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(objeto);
};

export const formatearNumero = (valor) =>
    new Intl.NumberFormat("es-CO", {
        maximumFractionDigits: 3,
    }).format(Number(valor || 0));

export const textoEstado = (estado) =>
    String(estado || "SIN ESTADO").replaceAll("_", " ");

export const claseEstado = (estado) => {
    const clases = {
        BORRADOR: "bg-slate-100 text-slate-700 border-slate-200",
        PROGRAMADA: "bg-blue-50 text-blue-700 border-blue-200",
        ABIERTA: "bg-cyan-50 text-cyan-700 border-cyan-200",
        EN_CONTEO: "bg-amber-50 text-amber-700 border-amber-200",
        EN_ANALISIS: "bg-violet-50 text-violet-700 border-violet-200",
        FINALIZADA: "bg-emerald-50 text-emerald-700 border-emerald-200",
        ANULADA: "bg-rose-50 text-rose-700 border-rose-200",
        PENDIENTE: "bg-slate-100 text-slate-700 border-slate-200",
        EN_PROCESO: "bg-amber-50 text-amber-700 border-amber-200",
        ENVIADO: "bg-violet-50 text-violet-700 border-violet-200",
        DEVUELTO: "bg-orange-50 text-orange-700 border-orange-200",
        APROBADO: "bg-blue-50 text-blue-700 border-blue-200",
        FINALIZADO: "bg-emerald-50 text-emerald-700 border-emerald-200",
        ANULADO: "bg-rose-50 text-rose-700 border-rose-200",
    };

    return (
        clases[String(estado || "").toUpperCase()] ||
        "bg-slate-100 text-slate-700 border-slate-200"
    );
};
