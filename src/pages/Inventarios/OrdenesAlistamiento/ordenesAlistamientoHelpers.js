import { API_BASE } from "../../../constants";

export const API_BASE_ORDENES_ALISTAMIENTO =
    `${API_BASE}Inventario/OrdenesAlistamiento/`;

export const ENDPOINTS_ORDENES_ALISTAMIENTO = {
    generar: "InventarioOrdenesAlistamientoGenerar.php",
    listar: "InventarioOrdenesAlistamientoListar.php",
    detalle: "InventarioOrdenesAlistamientoDetalle.php",
    formData: "InventarioOrdenesAlistamientoFormData.php",
    asignar: "InventarioOrdenesAlistamientoAsignar.php",
    reasignarPendientes:
        "InventarioOrdenesAlistamientoReasignarPendientes.php",
    enviarLogistica: "InventarioOrdenesAlistamientoEnviarLogistica.php",
    misOrdenes: "InventarioOrdenesAlistamientoMisOrdenes.php",
    iniciar: "InventarioOrdenesAlistamientoIniciar.php",
    guardarAvance: "InventarioOrdenesAlistamientoGuardarAvance.php",
    finalizar: "InventarioOrdenesAlistamientoFinalizar.php",
};

export const FILTROS_ORDENES_INICIALES = {
    q: "",
    estadoProceso: "",
    fechaDesde: "",
    fechaHasta: "",
};

export const obtenerUsuarioSesion = () => {
    for (const llave of ["us", "usuario"]) {
        try {
            const valor = localStorage.getItem(llave);
            if (!valor) continue;

            const usuario = JSON.parse(valor);
            if (usuario && typeof usuario === "object") return usuario;
        } catch {
            // Continúa con la siguiente llave compatible.
        }
    }

    return null;
};

export const obtenerIdUsuario = () => {
    const usuario = obtenerUsuarioSesion();

    return Number(
        usuario?.idUsuario ||
        usuario?.id ||
        usuario?.usuario?.idUsuario ||
        usuario?.usuario?.id ||
        0
    );
};

const construirUrl = (endpoint, params = {}) => {
    const url = new URL(
        endpoint,
        API_BASE_ORDENES_ALISTAMIENTO
    );

    Object.entries(params).forEach(([campo, valor]) => {
        if (
            valor !== undefined &&
            valor !== null &&
            String(valor).trim() !== ""
        ) {
            url.searchParams.set(campo, String(valor));
        }
    });

    return url.toString();
};

export const solicitarOrdenesJson = async (
    endpoint,
    { method = "GET", params = {}, body, signal } = {}
) => {
    const token = localStorage.getItem("st") || "";
    const respuesta = await fetch(construirUrl(endpoint, params), {
        method,
        cache: "no-store",
        signal,
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Authorization: `Bearer ${token}`,
        },
        body:
            body === undefined
                ? undefined
                : typeof body === "string"
                  ? body
                  : JSON.stringify(body),
    });

    const texto = await respuesta.text();
    let resultado;

    try {
        resultado = texto ? JSON.parse(texto) : {};
    } catch {
        const error = new Error(
            "El servicio devolvió una respuesta no válida."
        );
        error.status = respuesta.status;
        throw error;
    }

    const exitosa =
        resultado?.rpta === "si" ||
        resultado?.rpta === true;

    if (!respuesta.ok || !exitosa) {
        const error = new Error(
            resultado?.mensaje ||
            resultado?.error ||
            "No fue posible completar la operación."
        );
        error.status = respuesta.status;
        error.data = resultado?.data || null;
        error.tipoError = resultado?.tipoError || "";
        throw error;
    }

    return resultado;
};

export const obtenerListaOrdenes = (resultado) => {
    if (Array.isArray(resultado?.data)) return resultado.data;

    const data = resultado?.data || {};

    for (const campo of ["ordenes", "items", "registros", "lista"]) {
        if (Array.isArray(data?.[campo])) return data[campo];
    }

    return [];
};

export const obtenerResumenOrdenes = (resultado) =>
    resultado?.resumen || resultado?.data?.resumen || {};

export const obtenerIdOrden = (orden) =>
    Number(
        orden?.idOrdenAlistamiento ||
        orden?.idOrden ||
        orden?.id ||
        0
    );

export const obtenerCodigoOrden = (orden) =>
    orden?.codigoOrden ||
    orden?.codigo ||
    (obtenerIdOrden(orden)
        ? `Orden #${obtenerIdOrden(orden)}`
        : "Orden sin código");

export const obtenerEstadoOrden = (orden) =>
    String(
        orden?.estadoProceso ||
        orden?.estadoOrden ||
        orden?.estado ||
        "SIN_ESTADO"
    )
        .trim()
        .toUpperCase();

export const obtenerEstadoLogistica = (orden) =>
    String(
        orden?.estadoLogistica ||
        orden?.estadoLogisticaCodigo ||
        "PENDIENTE"
    )
        .trim()
        .replace(/^OA_LOG_/i, "")
        .toUpperCase();

export const obtenerIdDetalleOrden = (detalle) =>
    Number(
        detalle?.idDetalleOrdenAlistamiento ||
        detalle?.idOrdenAlistamientoDetalle ||
        detalle?.idDetalle ||
        detalle?.id ||
        0
    );

export const obtenerCantidadSolicitada = (detalle) =>
    Number(
        detalle?.cantidadSolicitada ??
        detalle?.cantidadRequerida ??
        detalle?.cantidadOrdenada ??
        detalle?.total ??
        detalle?.cantidad ??
        0
    );

export const obtenerCantidadAlistada = (detalle) =>
    Number(
        detalle?.cantidadAlistada ??
        detalle?.cantidadPreparada ??
        detalle?.cantidadEjecutada ??
        0
    );

export const obtenerNombreProducto = (detalle) =>
    detalle?.producto ||
    detalle?.nombreProducto ||
    detalle?.descripcion ||
    "Producto sin nombre";

export const obtenerCodigoProducto = (detalle) =>
    detalle?.codigoProducto ||
    detalle?.codigo ||
    detalle?.item ||
    "";

export const obtenerNombreOperador = (valor) => {
    const operador = valor?.operador;
    const nombreOperadorObjeto =
        operador && typeof operador === "object"
            ? operador?.nombreCompleto ||
              operador?.nombreOperador ||
              operador?.nombre
            : "";

    return (
        valor?.nombreOperador ||
        nombreOperadorObjeto ||
        (typeof operador === "string" ? operador : "") ||
        valor?.nombreCompleto ||
        valor?.nombre ||
        valor?.usuarioNombre ||
        "Sin asignar"
    );
};

export const obtenerIdOperador = (valor) =>
    Number(valor?.idOperador || valor?.id || 0);

export const guardarOrdenSeleccionada = (orden) => {
    const idOrden = obtenerIdOrden(orden);
    if (!idOrden) return false;

    localStorage.setItem(
        "inventarioOrdenAlistamientoId",
        String(idOrden)
    );
    return true;
};

export const obtenerOrdenSeleccionada = () =>
    Number(
        localStorage.getItem("inventarioOrdenAlistamientoId") ||
        0
    );

export const textoEstadoOrden = (estado) =>
    String(estado || "Sin estado")
        .trim()
        .replaceAll("_", " ");

export const claseEstadoOrden = (estado) => {
    const clases = {
        BORRADOR: "bg-slate-100 text-slate-700 border-slate-200",
        GENERADA: "bg-blue-50 text-blue-700 border-blue-200",
        PENDIENTE_ASIGNACION:
            "bg-orange-50 text-orange-700 border-orange-200",
        ASIGNADA: "bg-indigo-50 text-indigo-700 border-indigo-200",
        ENVIADA_LOGISTICA:
            "bg-violet-50 text-violet-700 border-violet-200",
        EN_ALISTAMIENTO:
            "bg-amber-50 text-amber-700 border-amber-200",
        ALISTADA_CON_PENDIENTES:
            "bg-orange-50 text-orange-700 border-orange-200",
        ALISTADA_COMPLETA:
            "bg-emerald-50 text-emerald-700 border-emerald-200",
        ALISTADA: "bg-cyan-50 text-cyan-700 border-cyan-200",
        FINALIZADA:
            "bg-emerald-50 text-emerald-700 border-emerald-200",
        CANCELADA: "bg-rose-50 text-rose-700 border-rose-200",
        ANULADA: "bg-rose-50 text-rose-700 border-rose-200",
    };

    return (
        clases[String(estado || "").toUpperCase()] ||
        "bg-slate-100 text-slate-700 border-slate-200"
    );
};

export const claseEstadoLogistica = (estado) => {
    const clases = {
        PENDIENTE: "bg-slate-100 text-slate-700 border-slate-200",
        EN_LOGISTICA_PARCIAL:
            "bg-violet-50 text-violet-700 border-violet-200",
        PARCIAL: "bg-violet-50 text-violet-700 border-violet-200",
        EN_LOGISTICA:
            "bg-blue-50 text-blue-800 border-blue-200",
        CANCELADA: "bg-rose-50 text-rose-700 border-rose-200",
    };

    return (
        clases[String(estado || "").toUpperCase()] ||
        "bg-slate-100 text-slate-700 border-slate-200"
    );
};

export const formatearNumero = (valor) =>
    new Intl.NumberFormat("es-CO", {
        maximumFractionDigits: 3,
    }).format(Number(valor || 0));

export const formatearFechaHora = (valor) => {
    if (!valor) return "Sin definir";

    const fecha = new Date(String(valor).replace(" ", "T"));
    if (Number.isNaN(fecha.getTime())) return String(valor);

    return new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(fecha);
};

export const obtenerResumenDesdeOrdenes = (ordenes = []) => {
    const resumen = {
        total: ordenes.length,
        pendientes: 0,
        enProceso: 0,
        finalizadas: 0,
    };

    ordenes.forEach((orden) => {
        const estado = obtenerEstadoOrden(orden);

        if (
            ["FINALIZADA", "ALISTADA", "ALISTADA_COMPLETA"].includes(
                estado
            )
        ) {
            resumen.finalizadas += 1;
        } else if (
            ["EN_ALISTAMIENTO", "ENVIADA_LOGISTICA"].includes(estado)
        ) {
            resumen.enProceso += 1;
        } else {
            resumen.pendientes += 1;
        }
    });

    return resumen;
};
