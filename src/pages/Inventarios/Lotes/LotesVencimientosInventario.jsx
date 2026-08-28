import React, { useCallback, useEffect, useMemo, useState } from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaBan,
    FaBoxOpen,
    FaBoxes,
    FaCalendarAlt,
    FaCheckCircle,
    FaChevronLeft,
    FaChevronRight,
    FaClock,
    FaExchangeAlt,
    FaExclamationTriangle,
    FaEye,
    FaFileExcel,
    FaFilter,
    FaPowerOff,
    FaSearch,
    FaSyncAlt,
    FaTimes,
    FaWarehouse,
} from "react-icons/fa";
import { toast } from "react-toastify";

const API_BASE =
    "https://app.accionporcolombia.com/servicesPae/Inventario/Lotes/";

const FILTROS_INICIALES = {
    q: "",
    idBodega: "",
    idUbicacion: "",
    idTipoProducto: "",
    estado: "1",
    clasificacion: "",
    fechaDesde: "",
    fechaHasta: "",
    soloConExistencia: false,
};

const FILTROS_AVANZADOS_INICIALES = {
    idBodega: "",
    idUbicacion: "",
    idTipoProducto: "",
    estado: "1",
    clasificacion: "",
    fechaDesde: "",
    fechaHasta: "",
    soloConExistencia: false,
};

const respuestaExitosa = (respuesta) =>
    respuesta?.rpta === "si" || respuesta?.rpta === true;

const formatearNumero = (valor) =>
    new Intl.NumberFormat("es-CO", {
        maximumFractionDigits: 3,
    }).format(Number(valor ?? 0));

const formatearFecha = (valor, conHora = false) => {
    if (!valor) return "Sin fecha";

    const texto = String(valor);
    const fecha = conHora
        ? new Date(texto.replace(" ", "T"))
        : new Date(`${texto.substring(0, 10)}T00:00:00`);

    if (Number.isNaN(fecha.getTime())) return texto;

    return new Intl.DateTimeFormat("es-CO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        ...(conHora ? { hour: "2-digit", minute: "2-digit" } : {}),
    }).format(fecha);
};

const Modal = ({ visible, onClose, children, maxWidth = "max-w-6xl" }) => {
    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6">
            <button
                type="button"
                aria-label="Cerrar modal"
                onClick={onClose}
                className="absolute inset-0 bg-slate-950/60"
            />

            <section
                className={`relative w-full ${maxWidth} max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col`}
            >
                {children}
            </section>
        </div>
    );
};

const Tarjeta = ({ titulo, valor, icono: Icono, clases }) => (
    <div className={`rounded-2xl border p-5 shadow-sm ${clases}`}>
        <div className="flex items-center justify-between gap-3">
            <div>
                <p className="text-sm font-medium">{titulo}</p>
                <p className="mt-2 text-3xl font-bold">{valor}</p>
            </div>

            <div className="w-11 h-11 rounded-xl bg-white/70 flex items-center justify-center">
                <Icono className="text-lg" />
            </div>
        </div>
    </div>
);

const Paginacion = ({
    pagina,
    totalPaginas,
    total,
    desde,
    hasta,
    onAnterior,
    onSiguiente,
}) => (
    <footer className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <p className="text-sm text-slate-600">
            Mostrando <strong>{desde}</strong> a <strong>{hasta}</strong> de{" "}
            <strong>{total}</strong> registros
        </p>

        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={onAnterior}
                disabled={pagina <= 1}
                className="h-9 px-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold flex items-center gap-2 hover:bg-slate-100 disabled:opacity-40 transition"
            >
                <FaChevronLeft />
                Anterior
            </button>

            <span className="min-w-24 text-center text-sm font-semibold text-slate-600">
                {pagina} de {totalPaginas}
            </span>

            <button
                type="button"
                onClick={onSiguiente}
                disabled={pagina >= totalPaginas}
                className="h-9 px-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold flex items-center gap-2 hover:bg-slate-100 disabled:opacity-40 transition"
            >
                Siguiente
                <FaChevronRight />
            </button>
        </div>
    </footer>
);

export const LotesVencimientosInventario = ({ setSidebar }) => {
    const [cargando, setCargando] = useState(true);
    const [cargandoForm, setCargandoForm] = useState(true);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);
    const [cargandoMovimientos, setCargandoMovimientos] = useState(false);
    const [procesandoEstado, setProcesandoEstado] = useState(null);

    const [lotes, setLotes] = useState([]);
    const [resumen, setResumen] = useState(null);
    const [bodegas, setBodegas] = useState([]);
    const [ubicaciones, setUbicaciones] = useState([]);
    const [tiposProducto, setTiposProducto] = useState([]);
    const [clasificaciones, setClasificaciones] = useState([]);

    const [filtros, setFiltros] = useState(FILTROS_INICIALES);
    const [filtrosModal, setFiltrosModal] = useState(
        FILTROS_AVANZADOS_INICIALES
    );

    const [modalFiltros, setModalFiltros] = useState(false);
    const [modalDetalle, setModalDetalle] = useState({
        visible: false,
        lote: null,
        existencias: [],
        movimientos: [],
    });
    const [modalMovimientos, setModalMovimientos] = useState({
        visible: false,
        lote: null,
        resumen: null,
        movimientos: [],
        pagina: 1,
        total: 0,
        totalPaginas: 1,
    });

    const [modalConfirmacion, setModalConfirmacion] = useState({
        visible: false,
        lote: null,
        nuevoEstado: null,
    });

    const [pagina, setPagina] = useState(1);
    const [limitePagina, setLimitePagina] = useState(20);

    const abrirMenu = () => setSidebar?.(true);

    const solicitar = useCallback(async (url, opciones = {}) => {
        const respuesta = await fetch(url, {
            cache: "no-store",
            headers: {
                Accept: "application/json",
                "Cache-Control": "no-cache",
                ...(opciones.headers || {}),
            },
            ...opciones,
        });

        const texto = await respuesta.text();
        let resultado;

        try {
            resultado = JSON.parse(texto);
        } catch {
            throw new Error(
                texto || "El servicio devolvió una respuesta no válida."
            );
        }

        if (!respuesta.ok || !respuestaExitosa(resultado)) {
            throw new Error(
                resultado?.error ||
                    resultado?.mensaje ||
                    "No fue posible completar la solicitud."
            );
        }

        return resultado;
    }, []);

    const construirParametros = useCallback((valores) => {
        const params = new URLSearchParams();
        params.set("t", Date.now());
        params.set("limite", 500);

        Object.entries(valores).forEach(([campo, valor]) => {
            if (campo === "soloConExistencia") {
                if (valor) params.set(campo, "1");
                return;
            }

            if (valor !== "" && valor !== null && valor !== undefined) {
                params.set(campo, String(valor).trim());
            }
        });

        return params;
    }, []);

    const cargarFormData = useCallback(async () => {
        setCargandoForm(true);

        try {
            const resultado = await solicitar(
                `${API_BASE}InventarioLotesFormData.php?t=${Date.now()}`
            );
            const data = resultado?.data || {};

            setBodegas(Array.isArray(data.bodegas) ? data.bodegas : []);
            setUbicaciones(
                Array.isArray(data.ubicaciones) ? data.ubicaciones : []
            );
            setTiposProducto(
                Array.isArray(data.tiposProducto) ? data.tiposProducto : []
            );
            setClasificaciones(
                Array.isArray(data.clasificaciones)
                    ? data.clasificaciones
                    : []
            );
        } catch (error) {
            console.error(error);
            toast.error(
                error?.message ||
                    "No fue posible cargar los filtros de lotes."
            );
        } finally {
            setCargandoForm(false);
        }
    }, [solicitar]);

    const cargarLotes = useCallback(
        async (valores = FILTROS_INICIALES, mostrarCarga = true) => {
            if (mostrarCarga) setCargando(true);

            try {
                const params = construirParametros(valores);
                const paramsResumen = new URLSearchParams();
                paramsResumen.set("t", Date.now());

                [
                    "idBodega",
                    "idUbicacion",
                    "idTipoProducto",
                    "estado",
                ].forEach((campo) => {
                    const valor = valores[campo];
                    if (valor !== "" && valor !== null && valor !== undefined) {
                        paramsResumen.set(campo, valor);
                    }
                });

                const [listado, resumenRespuesta] = await Promise.all([
                    solicitar(
                        `${API_BASE}InventarioLotesListar.php?${params.toString()}`
                    ),
                    solicitar(
                        `${API_BASE}InventarioLotesResumen.php?${paramsResumen.toString()}`
                    ),
                ]);

                const datosListado = listado?.data;
                const registros = Array.isArray(datosListado)
                    ? datosListado
                    : Array.isArray(datosListado?.lotes)
                    ? datosListado.lotes
                    : [];

                setLotes(registros);
                setResumen(resumenRespuesta?.data || null);
                setPagina(1);
            } catch (error) {
                console.error(error);
                setLotes([]);
                setResumen(null);
                toast.error(
                    error?.message ||
                        "No fue posible consultar los lotes."
                );
            } finally {
                if (mostrarCarga) setCargando(false);
            }
        },
        [construirParametros, solicitar]
    );

    useEffect(() => {
        cargarFormData();
        cargarLotes(FILTROS_INICIALES);
    }, [cargarFormData, cargarLotes]);

    useEffect(() => {
        const hayModal =
            modalFiltros ||
            modalDetalle.visible ||
            modalMovimientos.visible ||
            modalConfirmacion.visible;

        if (!hayModal) return undefined;

        const overflowAnterior = document.body.style.overflow;
        const cerrarEscape = (event) => {
            if (event.key === "Escape") {
                setModalFiltros(false);
                setModalDetalle((prev) => ({ ...prev, visible: false }));
                setModalMovimientos((prev) => ({
                    ...prev,
                    visible: false,
                }));

                if (!procesandoEstado) {
                    setModalConfirmacion({
                        visible: false,
                        lote: null,
                        nuevoEstado: null,
                    });
                }
            }
        };

        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", cerrarEscape);

        return () => {
            document.body.style.overflow = overflowAnterior;
            window.removeEventListener("keydown", cerrarEscape);
        };
    }, [
        modalFiltros,
        modalDetalle.visible,
        modalMovimientos.visible,
        modalConfirmacion.visible,
        procesandoEstado,
    ]);

    const ubicacionesFiltradas = useMemo(() => {
        const idBodega = Number(filtrosModal.idBodega || 0);
        if (!idBodega) return [];

        return ubicaciones.filter(
            (ubicacion) => Number(ubicacion.idBodega || 0) === idBodega
        );
    }, [ubicaciones, filtrosModal.idBodega]);

    const totalFiltros = useMemo(() => {
        let total = 0;
        if (filtros.idBodega) total++;
        if (filtros.idUbicacion) total++;
        if (filtros.idTipoProducto) total++;
        if (filtros.estado !== "1") total++;
        if (filtros.clasificacion) total++;
        if (filtros.fechaDesde) total++;
        if (filtros.fechaHasta) total++;
        if (filtros.soloConExistencia) total++;
        return total;
    }, [filtros]);

    const resumenSeguro = useMemo(
        () => ({
            totalLotes: Number(resumen?.totalLotes ?? lotes.length),
            activos: Number(resumen?.totalLotesActivos ?? 0),
            disponible: Number(resumen?.cantidadDisponible ?? 0),
            criticos: Number(resumen?.totalCriticos ?? 0),
            proximos: Number(resumen?.totalProximos ?? 0),
            vencidos: Number(resumen?.totalVencidos ?? 0),
            sinExistencia: Number(resumen?.totalSinExistencia ?? 0),
        }),
        [resumen, lotes.length]
    );

    const totalPaginas = Math.max(
        1,
        Math.ceil(lotes.length / limitePagina)
    );

    const lotesPaginados = useMemo(() => {
        const inicio = (pagina - 1) * limitePagina;
        return lotes.slice(inicio, inicio + limitePagina);
    }, [lotes, pagina, limitePagina]);

    useEffect(() => {
        if (pagina > totalPaginas) setPagina(totalPaginas);
    }, [pagina, totalPaginas]);

    const abrirFiltros = () => {
        const { q, ...avanzados } = filtros;
        setFiltrosModal(avanzados);
        setModalFiltros(true);
    };

    const cambiarFiltroModal = (campo, valor) => {
        setFiltrosModal((prev) => ({
            ...prev,
            [campo]: valor,
            ...(campo === "idBodega" ? { idUbicacion: "" } : {}),
        }));
    };

    const aplicarFiltros = () => {
        const nuevos = { ...filtros, ...filtrosModal };
        setFiltros(nuevos);
        setModalFiltros(false);
        cargarLotes(nuevos);
    };

    const limpiarTodo = () => {
        setFiltros(FILTROS_INICIALES);
        setFiltrosModal(FILTROS_AVANZADOS_INICIALES);
        cargarLotes(FILTROS_INICIALES);
    };

    const abrirDetalle = async (lote) => {
        const idLote = Number(lote?.idLote || lote?.id || 0);
        if (!idLote) return toast.warning("No se pudo identificar el lote.");

        setCargandoDetalle(true);
        setModalDetalle({
            visible: true,
            lote,
            existencias: [],
            movimientos: [],
        });

        try {
            const resultado = await solicitar(
                `${API_BASE}InventarioLotesDetalle.php?idLote=${idLote}&t=${Date.now()}`
            );
            const data = resultado?.data || {};

            setModalDetalle({
                visible: true,
                lote: data.lote || lote,
                existencias: Array.isArray(data.existencias)
                    ? data.existencias
                    : [],
                movimientos: Array.isArray(data.ultimosMovimientos)
                    ? data.ultimosMovimientos
                    : [],
            });
        } catch (error) {
            setModalDetalle((prev) => ({ ...prev, visible: false }));
            toast.error(
                error?.message ||
                    "No fue posible cargar el detalle del lote."
            );
        } finally {
            setCargandoDetalle(false);
        }
    };

    const cargarMovimientos = useCallback(
        async (lote, paginaConsulta = 1) => {
            const idLote = Number(lote?.idLote || lote?.id || 0);
            if (!idLote) return toast.warning("No se pudo identificar el lote.");

            setCargandoMovimientos(true);

            try {
                const resultado = await solicitar(
                    `${API_BASE}InventarioLotesMovimientos.php?idLote=${idLote}&pagina=${paginaConsulta}&limite=20&t=${Date.now()}`
                );
                const data = resultado?.data || {};

                setModalMovimientos({
                    visible: true,
                    lote: data.lote || lote,
                    resumen: data.resumen || null,
                    movimientos: Array.isArray(data.movimientos)
                        ? data.movimientos
                        : [],
                    pagina: Number(resultado?.pagina || paginaConsulta),
                    total: Number(resultado?.total || 0),
                    totalPaginas: Math.max(
                        1,
                        Number(resultado?.totalPaginas || 1)
                    ),
                });
            } catch (error) {
                setModalMovimientos((prev) => ({ ...prev, visible: false }));
                toast.error(
                    error?.message ||
                        "No fue posible cargar los movimientos."
                );
            } finally {
                setCargandoMovimientos(false);
            }
        },
        [solicitar]
    );

    const solicitarCambioEstado = (lote) => {
        const nuevoEstado = Number(lote?.estado) === 1 ? 0 : 1;

        setModalConfirmacion({
            visible: true,
            lote,
            nuevoEstado,
        });
    };

    const cerrarConfirmacion = () => {
        if (procesandoEstado) return;

        setModalConfirmacion({
            visible: false,
            lote: null,
            nuevoEstado: null,
        });
    };

    const confirmarCambioEstado = async () => {
        const lote = modalConfirmacion.lote;
        const nuevoEstado = Number(modalConfirmacion.nuevoEstado);
        const idLote = Number(lote?.idLote || lote?.id || 0);

        if (!idLote || ![0, 1].includes(nuevoEstado)) {
            toast.error("No se pudo identificar el lote o el nuevo estado.");
            cerrarConfirmacion();
            return;
        }

        setProcesandoEstado(idLote);

        try {
            const resultado = await solicitar(
                `${API_BASE}InventarioLotesCambiarEstado.php`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        idLote,
                        estado: nuevoEstado,
                        observacion:
                            nuevoEstado === 1
                                ? "Lote activado desde Lotes y vencimientos."
                                : "Lote desactivado desde Lotes y vencimientos.",
                    }),
                }
            );

            setModalConfirmacion({
                visible: false,
                lote: null,
                nuevoEstado: null,
            });

            toast.success(
                resultado?.mensaje ||
                    (nuevoEstado === 1
                        ? "Lote activado correctamente."
                        : "Lote desactivado correctamente.")
            );

            await cargarLotes(filtros, false);
        } catch (error) {
            toast.error(
                error?.message ||
                    "No fue posible cambiar el estado del lote."
            );
        } finally {
            setProcesandoEstado(null);
        }
    };

    const claseVencimiento = (valor) => {
        const estado = String(valor || "").toUpperCase();

        if (estado === "VENCIDO")
            return "bg-rose-50 text-rose-700 border-rose-200";
        if (estado === "CRITICO")
            return "bg-orange-50 text-orange-700 border-orange-200";
        if (estado === "PROXIMO")
            return "bg-amber-50 text-amber-700 border-amber-200";
        if (estado === "VIGENTE")
            return "bg-emerald-50 text-emerald-700 border-emerald-200";

        return "bg-slate-50 text-slate-600 border-slate-200";
    };

    const textoVencimiento = (valor) => {
        const estado = String(valor || "").toUpperCase();
        return (
            {
                VENCIDO: "Vencido",
                CRITICO: "Crítico",
                PROXIMO: "Próximo",
                VIGENTE: "Vigente",
            }[estado] || "Sin vencimiento"
        );
    };

    const renderVencimiento = (lote) => (
        <div>
            <span
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${claseVencimiento(
                    lote?.clasificacionVencimiento
                )}`}
            >
                {lote?.clasificacionVencimiento === "VENCIDO" ? (
                    <FaExclamationTriangle />
                ) : (
                    <FaCalendarAlt />
                )}

                {textoVencimiento(lote?.clasificacionVencimiento)}
            </span>

            <p className="mt-1 text-xs text-slate-500">
                {formatearFecha(lote?.fechaVencimiento)}
                {lote?.diasParaVencer !== null &&
                    lote?.diasParaVencer !== undefined && (
                        <>
                            {" "}
                            ·{" "}
                            {Number(lote.diasParaVencer) < 0
                                ? `hace ${Math.abs(
                                      Number(lote.diasParaVencer)
                                  )} días`
                                : `${formatearNumero(
                                      lote.diasParaVencer
                                  )} días`}
                        </>
                    )}
            </p>
        </div>
    );

    const escaparCsv = (valor) =>
        `"${String(valor ?? "")
            .replace(/\r?\n|\r/g, " ")
            .replace(/"/g, '""')}"`;

    const exportarExcel = () => {
        if (!lotes.length) return toast.info("No hay datos para exportar.");

        const columnas = [
            ["codigoProducto", "Código producto"],
            ["producto", "Producto"],
            ["tipoProducto", "Tipo producto"],
            ["lote", "Lote"],
            ["fechaFabricacion", "Fecha fabricación"],
            ["fechaVencimiento", "Fecha vencimiento"],
            ["fechaIngreso", "Fecha ingreso"],
            ["clasificacionVencimiento", "Clasificación"],
            ["diasParaVencer", "Días para vencer"],
            ["cantidadDisponible", "Disponible"],
            ["cantidadReservada", "Reservada"],
            ["cantidadBloqueada", "Bloqueada"],
            ["cantidadTotal", "Cantidad total"],
            ["estadoTexto", "Estado"],
            ["observacion", "Observación"],
        ];

        const filas = lotes.map((lote) =>
            columnas
                .map(([campo]) => {
                    if (campo === "producto") {
                        return escaparCsv(
                            lote.producto || lote.nombreProducto
                        );
                    }

                    if (campo === "cantidadTotal") {
                        return escaparCsv(
                            lote.cantidadTotal ??
                                Number(lote.cantidadDisponible || 0) +
                                    Number(lote.cantidadReservada || 0) +
                                    Number(lote.cantidadBloqueada || 0)
                        );
                    }

                    if (campo === "estadoTexto") {
                        return escaparCsv(
                            Number(lote.estado) === 1 ? "Activo" : "Inactivo"
                        );
                    }

                    return escaparCsv(lote[campo]);
                })
                .join(";")
        );

        const encabezado = columnas
            .map(([, titulo]) => escaparCsv(titulo))
            .join(";");

        const blob = new Blob(
            ["\ufeff", [encabezado, ...filas].join("\r\n")],
            { type: "text/csv;charset=utf-8;" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `lotes_vencimientos_${new Date()
            .toISOString()
            .substring(0, 10)}.csv`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success("Archivo exportado correctamente.");
    };

    const desde =
        lotes.length === 0 ? 0 : (pagina - 1) * limitePagina + 1;
    const hasta = Math.min(pagina * limitePagina, lotes.length);

    return (
        <>
            <div className="w-full h-screen flex flex-col p-2 md:p-4 gap-4 bg-slate-100">
                <article className="flex-1 bg-white shadow-lg rounded-2xl flex flex-col overflow-hidden border border-slate-200">
                    <header className="px-4 py-3 md:px-5 border-b border-slate-200 bg-white">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <button
                                    type="button"
                                    onClick={abrirMenu}
                                    className="lg:hidden w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-50 transition"
                                >
                                    <IoMenu className="text-2xl" />
                                </button>

                                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                                    <FaCalendarAlt className="text-lg text-amber-700" />
                                </div>

                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
                                        Control de inventarios
                                    </p>

                                    <h1 className="mt-0.5 text-xl md:text-2xl font-bold text-slate-900">
                                        Lotes y vencimientos
                                    </h1>

                                    <p className="mt-0.5 text-xs md:text-sm text-slate-500 max-w-2xl">
                                        Control de lotes, existencias, vencimientos y trazabilidad.
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                <button
                                    type="button"
                                    onClick={exportarExcel}
                                    disabled={cargando || lotes.length === 0}
                                    className="h-10 px-3 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-100 disabled:opacity-60 transition"
                                >
                                    <FaFileExcel />
                                    Exportar Excel
                                </button>

                                <button
                                    type="button"
                                    onClick={() => cargarLotes(filtros)}
                                    disabled={cargando}
                                    className="h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-50 disabled:opacity-60 transition"
                                >
                                    <FaSyncAlt
                                        className={cargando ? "animate-spin" : ""}
                                    />
                                    Actualizar
                                </button>
                            </div>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto">
                        <div className="p-3 md:p-5 space-y-4">
                            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-3">
                                <Tarjeta
                                    titulo="Lotes"
                                    valor={resumenSeguro.totalLotes}
                                    icono={FaBoxes}
                                    clases="border-slate-200 bg-white text-slate-900"
                                />
                                <Tarjeta
                                    titulo="Activos"
                                    valor={resumenSeguro.activos}
                                    icono={FaCheckCircle}
                                    clases="border-blue-200 bg-blue-50 text-blue-800"
                                />
                                <Tarjeta
                                    titulo="Disponible"
                                    valor={formatearNumero(
                                        resumenSeguro.disponible
                                    )}
                                    icono={FaBoxOpen}
                                    clases="border-indigo-200 bg-indigo-50 text-indigo-800"
                                />
                                <Tarjeta
                                    titulo="Críticos"
                                    valor={resumenSeguro.criticos}
                                    icono={FaExclamationTriangle}
                                    clases="border-orange-200 bg-orange-50 text-orange-800"
                                />
                                <Tarjeta
                                    titulo="Próximos"
                                    valor={resumenSeguro.proximos}
                                    icono={FaClock}
                                    clases="border-amber-200 bg-amber-50 text-amber-800"
                                />
                                <Tarjeta
                                    titulo="Vencidos"
                                    valor={resumenSeguro.vencidos}
                                    icono={FaBan}
                                    clases="border-rose-200 bg-rose-50 text-rose-800"
                                />
                                <Tarjeta
                                    titulo="Sin existencia"
                                    valor={resumenSeguro.sinExistencia}
                                    icono={FaBoxOpen}
                                    clases="border-slate-300 bg-slate-50 text-slate-800"
                                />
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4 shadow-sm">
                                <div className="flex flex-col xl:flex-row xl:items-center gap-3">
                                    <div className="relative flex-1">
                                        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                                        <input
                                            type="text"
                                            value={filtros.q}
                                            onChange={(event) =>
                                                setFiltros((prev) => ({
                                                    ...prev,
                                                    q: event.target.value,
                                                }))
                                            }
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                    cargarLotes(filtros);
                                                }
                                            }}
                                            placeholder="Buscar producto, código o lote"
                                            className="w-full h-11 pl-11 pr-4 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                        />
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => cargarLotes(filtros)}
                                            disabled={cargando || cargandoForm}
                                            className="h-11 px-4 rounded-xl bg-blue-800 text-white font-semibold flex items-center justify-center gap-2 hover:bg-blue-900 disabled:opacity-60 transition"
                                        >
                                            <FaSearch />
                                            Buscar
                                        </button>

                                        <button
                                            type="button"
                                            onClick={abrirFiltros}
                                            className="h-11 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold flex items-center justify-center gap-2 hover:bg-slate-50 transition"
                                        >
                                            <FaFilter />
                                            Filtros
                                            {totalFiltros > 0 && (
                                                <span className="min-w-5 h-5 px-1.5 rounded-full bg-blue-800 text-white text-[11px] flex items-center justify-center">
                                                    {totalFiltros}
                                                </span>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={limpiarTodo}
                                            className="h-11 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition"
                                        >
                                            Limpiar
                                        </button>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                    <div>
                                        <h2 className="font-bold text-slate-900">
                                            Lotes registrados
                                        </h2>
                                        <p className="text-sm text-slate-500">
                                            {lotes.length} registro
                                            {lotes.length === 1 ? "" : "s"}{" "}
                                            encontrado
                                            {lotes.length === 1 ? "" : "s"}
                                        </p>
                                    </div>

                                    <label className="flex items-center gap-2 text-sm text-slate-600">
                                        Mostrar
                                        <select
                                            value={limitePagina}
                                            onChange={(event) => {
                                                setLimitePagina(
                                                    Number(event.target.value)
                                                );
                                                setPagina(1);
                                            }}
                                            className="h-9 px-2 rounded-xl border border-slate-300 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                        >
                                            {[10, 20, 30, 50].map((valor) => (
                                                <option key={valor} value={valor}>
                                                    {valor}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>

                                {cargando || cargandoForm ? (
                                    <div className="min-h-[380px] flex flex-col items-center justify-center gap-4">
                                        <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />
                                        <p className="text-sm font-medium text-slate-500">
                                            Cargando lotes y vencimientos...
                                        </p>
                                    </div>
                                ) : lotes.length === 0 ? (
                                    <div className="min-h-[380px] flex flex-col items-center justify-center text-center px-6">
                                        <FaBoxOpen className="text-3xl text-slate-400" />
                                        <h3 className="mt-4 text-lg font-bold text-slate-800">
                                            No hay lotes para mostrar
                                        </h3>
                                        <p className="mt-1 text-sm text-slate-500">
                                            Ajusta los filtros o valida que existan
                                            entradas finalizadas con lotes.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[1450px]">
                                                <thead className="bg-slate-50 border-b border-slate-200">
                                                    <tr>
                                                        {[
                                                            "Producto",
                                                            "Lote",
                                                            "Tipo",
                                                            "Ingreso",
                                                            "Vencimiento",
                                                            "Disponible",
                                                            "Reservado",
                                                            "Bloqueado",
                                                            "Total",
                                                            "Estado",
                                                            "Acciones",
                                                        ].map((titulo) => (
                                                            <th
                                                                key={titulo}
                                                                className={`px-5 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 ${
                                                                    [
                                                                        "Disponible",
                                                                        "Reservado",
                                                                        "Bloqueado",
                                                                        "Total",
                                                                    ].includes(titulo)
                                                                        ? "text-center"
                                                                        : titulo === "Acciones"
                                                                        ? "text-right"
                                                                        : "text-left"
                                                                }`}
                                                            >
                                                                {titulo}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>

                                                <tbody className="divide-y divide-slate-200">
                                                    {lotesPaginados.map((lote) => (
                                                        <tr
                                                            key={
                                                                lote.idLote ||
                                                                lote.id
                                                            }
                                                            className="hover:bg-slate-50 transition"
                                                        >
                                                            <td className="px-5 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                                                                        <FaBoxes />
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-semibold text-slate-900 max-w-[300px] truncate">
                                                                            {lote.producto ||
                                                                                lote.nombreProducto}
                                                                        </p>
                                                                        <p className="text-xs text-slate-500">
                                                                            {lote.codigoProducto ||
                                                                                `ID ${lote.idProducto}`}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            <td className="px-5 py-4">
                                                                <p className="text-sm font-bold text-slate-900">
                                                                    {lote.lote}
                                                                </p>
                                                                <p className="text-xs text-slate-500">
                                                                    Fabricación:{" "}
                                                                    {formatearFecha(
                                                                        lote.fechaFabricacion
                                                                    )}
                                                                </p>
                                                            </td>

                                                            <td className="px-5 py-4 text-sm text-slate-600">
                                                                {lote.tipoProducto ||
                                                                    "Sin tipo"}
                                                            </td>

                                                            <td className="px-5 py-4 text-sm text-slate-600">
                                                                {formatearFecha(
                                                                    lote.fechaIngreso
                                                                )}
                                                            </td>

                                                            <td className="px-5 py-4">
                                                                {renderVencimiento(
                                                                    lote
                                                                )}
                                                            </td>

                                                            <td className="px-5 py-4 text-center">
                                                                <span className="inline-flex px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold">
                                                                    {formatearNumero(
                                                                        lote.cantidadDisponible
                                                                    )}
                                                                </span>
                                                            </td>

                                                            <td className="px-5 py-4 text-center text-sm font-semibold text-slate-700">
                                                                {formatearNumero(
                                                                    lote.cantidadReservada
                                                                )}
                                                            </td>

                                                            <td className="px-5 py-4 text-center text-sm font-semibold text-slate-700">
                                                                {formatearNumero(
                                                                    lote.cantidadBloqueada
                                                                )}
                                                            </td>

                                                            <td className="px-5 py-4 text-center text-sm font-bold text-slate-900">
                                                                {formatearNumero(
                                                                    lote.cantidadTotal ??
                                                                        Number(
                                                                            lote.cantidadDisponible ||
                                                                                0
                                                                        ) +
                                                                            Number(
                                                                                lote.cantidadReservada ||
                                                                                    0
                                                                            ) +
                                                                            Number(
                                                                                lote.cantidadBloqueada ||
                                                                                    0
                                                                            )
                                                                )}
                                                            </td>

                                                            <td className="px-5 py-4">
                                                                <span
                                                                    className={`inline-flex px-3 py-1.5 rounded-full border text-xs font-bold ${
                                                                        Number(
                                                                            lote.estado
                                                                        ) === 1
                                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                            : "bg-slate-100 text-slate-600 border-slate-200"
                                                                    }`}
                                                                >
                                                                    {Number(
                                                                        lote.estado
                                                                    ) === 1
                                                                        ? "Activo"
                                                                        : "Inactivo"}
                                                                </span>
                                                            </td>

                                                            <td className="px-5 py-4">
                                                                <div className="flex justify-end gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            abrirDetalle(
                                                                                lote
                                                                            )
                                                                        }
                                                                        className="h-10 px-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 font-semibold flex items-center gap-2 hover:bg-blue-100 transition"
                                                                    >
                                                                        <FaEye />
                                                                        Ver
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setModalMovimientos(
                                                                                {
                                                                                    ...modalMovimientos,
                                                                                    visible: true,
                                                                                    lote,
                                                                                }
                                                                            );
                                                                            cargarMovimientos(
                                                                                lote,
                                                                                1
                                                                            );
                                                                        }}
                                                                        className="w-10 h-10 rounded-xl border border-violet-200 bg-violet-50 text-violet-700 flex items-center justify-center hover:bg-violet-100 transition"
                                                                        title="Movimientos"
                                                                    >
                                                                        <FaExchangeAlt />
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            solicitarCambioEstado(
                                                                                lote
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            procesandoEstado ===
                                                                            Number(
                                                                                lote.idLote ||
                                                                                    lote.id
                                                                            )
                                                                        }
                                                                        className={`w-10 h-10 rounded-xl border flex items-center justify-center disabled:opacity-60 transition ${
                                                                            Number(
                                                                                lote.estado
                                                                            ) === 1
                                                                                ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                                                                : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                                                        }`}
                                                                    >
                                                                        <FaPowerOff />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        <Paginacion
                                            pagina={pagina}
                                            totalPaginas={totalPaginas}
                                            total={lotes.length}
                                            desde={desde}
                                            hasta={hasta}
                                            onAnterior={() =>
                                                setPagina((prev) =>
                                                    Math.max(1, prev - 1)
                                                )
                                            }
                                            onSiguiente={() =>
                                                setPagina((prev) =>
                                                    Math.min(
                                                        totalPaginas,
                                                        prev + 1
                                                    )
                                                )
                                            }
                                        />
                                    </>
                                )}
                            </section>
                        </div>
                    </div>
                </article>
            </div>

            <Modal
                visible={modalFiltros}
                onClose={() => setModalFiltros(false)}
                maxWidth="max-w-3xl"
            >
                <header className="px-5 py-4 border-b border-slate-200">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-800">
                                <FaFilter />
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                                    Filtros
                                </p>
                                <h2 className="mt-1 text-lg font-bold text-slate-900">
                                    Filtrar lotes y vencimientos
                                </h2>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setModalFiltros(false)}
                            className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100"
                        >
                            <FaTimes />
                        </button>
                    </div>
                </header>

                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        ["Bodega", "idBodega", bodegas],
                        ["Ubicación", "idUbicacion", ubicacionesFiltradas],
                        ["Tipo de producto", "idTipoProducto", tiposProducto],
                    ].map(([titulo, campo, opciones]) => (
                        <div key={campo}>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                {titulo}
                            </label>
                            <select
                                value={filtrosModal[campo]}
                                disabled={
                                    campo === "idUbicacion" &&
                                    !filtrosModal.idBodega
                                }
                                onChange={(event) =>
                                    cambiarFiltroModal(
                                        campo,
                                        event.target.value
                                    )
                                }
                                className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 disabled:bg-slate-100"
                            >
                                <option value="">
                                    {campo === "idTipoProducto"
                                        ? "Todos"
                                        : "Todas"}
                                </option>
                                {opciones.map((opcion) => (
                                    <option
                                        key={opcion.id}
                                        value={opcion.id}
                                    >
                                        {opcion.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ))}

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Estado
                        </label>
                        <select
                            value={filtrosModal.estado}
                            onChange={(event) =>
                                cambiarFiltroModal(
                                    "estado",
                                    event.target.value
                                )
                            }
                            className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700"
                        >
                            <option value="">Todos</option>
                            <option value="1">Activos</option>
                            <option value="0">Inactivos</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Clasificación
                        </label>
                        <select
                            value={filtrosModal.clasificacion}
                            onChange={(event) =>
                                cambiarFiltroModal(
                                    "clasificacion",
                                    event.target.value
                                )
                            }
                            className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700"
                        >
                            {(clasificaciones.length
                                ? clasificaciones
                                : [
                                      { valor: "", nombre: "TODOS" },
                                      {
                                          valor: "VENCIDO",
                                          nombre: "VENCIDOS",
                                      },
                                      {
                                          valor: "CRITICO",
                                          nombre: "CRÍTICOS",
                                      },
                                      {
                                          valor: "PROXIMO",
                                          nombre: "PRÓXIMOS",
                                      },
                                      {
                                          valor: "VIGENTE",
                                          nombre: "VIGENTES",
                                      },
                                      {
                                          valor: "SIN_VENCIMIENTO",
                                          nombre: "SIN VENCIMIENTO",
                                      },
                                      {
                                          valor: "SIN_EXISTENCIA",
                                          nombre: "SIN EXISTENCIA",
                                      },
                                  ]
                            ).map((opcion) => (
                                <option
                                    key={opcion.valor || "TODOS"}
                                    value={opcion.valor}
                                >
                                    {opcion.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    {[
                        ["Vence desde", "fechaDesde"],
                        ["Vence hasta", "fechaHasta"],
                    ].map(([titulo, campo]) => (
                        <div key={campo}>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                {titulo}
                            </label>
                            <input
                                type="date"
                                value={filtrosModal[campo]}
                                onChange={(event) =>
                                    cambiarFiltroModal(
                                        campo,
                                        event.target.value
                                    )
                                }
                                className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700"
                            />
                        </div>
                    ))}

                    <label className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <input
                            type="checkbox"
                            checked={filtrosModal.soloConExistencia}
                            onChange={(event) =>
                                cambiarFiltroModal(
                                    "soloConExistencia",
                                    event.target.checked
                                )
                            }
                            className="w-4 h-4"
                        />
                        Mostrar solamente lotes con existencia
                    </label>
                </div>

                <footer className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                    <button
                        type="button"
                        onClick={() =>
                            setFiltrosModal(
                                FILTROS_AVANZADOS_INICIALES
                            )
                        }
                        className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-100"
                    >
                        Limpiar
                    </button>

                    <button
                        type="button"
                        onClick={aplicarFiltros}
                        className="h-10 px-5 rounded-xl bg-blue-800 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-blue-900"
                    >
                        <FaFilter />
                        Aplicar filtros
                    </button>
                </footer>
            </Modal>

            <Modal
                visible={modalDetalle.visible}
                onClose={() =>
                    !cargandoDetalle &&
                    setModalDetalle((prev) => ({
                        ...prev,
                        visible: false,
                    }))
                }
            >
                <header className="px-5 py-5 border-b border-slate-200">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700">
                                <FaBoxes />
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
                                    Detalle del lote
                                </p>
                                <h2 className="mt-1 text-xl font-bold text-slate-900">
                                    {modalDetalle.lote?.producto ||
                                        modalDetalle.lote?.nombreProducto}
                                </h2>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                setModalDetalle((prev) => ({
                                    ...prev,
                                    visible: false,
                                }))
                            }
                            className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100"
                        >
                            <FaTimes />
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {cargandoDetalle ? (
                        <div className="min-h-[320px] flex flex-col items-center justify-center gap-4">
                            <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />
                            <p className="text-sm text-slate-500">
                                Cargando detalle...
                            </p>
                        </div>
                    ) : (
                        <>
                            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {[
                                    [
                                        "Disponible",
                                        modalDetalle.lote?.cantidadDisponible,
                                        "border-indigo-200 bg-indigo-50 text-indigo-900",
                                    ],
                                    [
                                        "Reservado",
                                        modalDetalle.lote?.cantidadReservada,
                                        "border-slate-200 bg-slate-50 text-slate-900",
                                    ],
                                    [
                                        "Bloqueado",
                                        modalDetalle.lote?.cantidadBloqueada,
                                        "border-slate-200 bg-slate-50 text-slate-900",
                                    ],
                                    [
                                        "Total",
                                        modalDetalle.lote?.cantidadTotal,
                                        "border-slate-200 bg-white text-slate-900",
                                    ],
                                ].map(([titulo, valor, clases]) => (
                                    <div
                                        key={titulo}
                                        className={`rounded-2xl border p-4 ${clases}`}
                                    >
                                        <p className="text-sm font-semibold">
                                            {titulo}
                                        </p>
                                        <p className="mt-2 text-2xl font-bold">
                                            {formatearNumero(valor)}
                                        </p>
                                    </div>
                                ))}
                            </section>

                            <section className="rounded-2xl border border-slate-200 overflow-hidden">
                                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
                                    <h3 className="font-bold text-slate-900">
                                        Existencias por ubicación
                                    </h3>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[850px]">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                {[
                                                    "Bodega",
                                                    "Ubicación",
                                                    "Disponible",
                                                    "Reservado",
                                                    "Bloqueado",
                                                    "Total",
                                                ].map((titulo) => (
                                                    <th
                                                        key={titulo}
                                                        className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500"
                                                    >
                                                        {titulo}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {modalDetalle.existencias.map(
                                                (item) => (
                                                    <tr
                                                        key={
                                                            item.idExistencia ||
                                                            item.id
                                                        }
                                                    >
                                                        <td className="px-5 py-3 font-semibold text-slate-900">
                                                            {item.bodega}
                                                        </td>
                                                        <td className="px-5 py-3 text-slate-600">
                                                            {item.ubicacion ||
                                                                "Sin ubicación"}
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            {formatearNumero(
                                                                item.cantidadDisponible
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            {formatearNumero(
                                                                item.cantidadReservada
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            {formatearNumero(
                                                                item.cantidadBloqueada
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3 font-bold">
                                                            {formatearNumero(
                                                                item.cantidadTotal
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </>
                    )}
                </div>
            </Modal>

            <Modal
                visible={modalMovimientos.visible}
                onClose={() =>
                    !cargandoMovimientos &&
                    setModalMovimientos((prev) => ({
                        ...prev,
                        visible: false,
                    }))
                }
            >
                <header className="px-5 py-5 border-b border-slate-200">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-700">
                                <FaExchangeAlt />
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">
                                    Trazabilidad
                                </p>
                                <h2 className="mt-1 text-xl font-bold text-slate-900">
                                    Movimientos del lote{" "}
                                    {modalMovimientos.lote?.lote}
                                </h2>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                setModalMovimientos((prev) => ({
                                    ...prev,
                                    visible: false,
                                }))
                            }
                            className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100"
                        >
                            <FaTimes />
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-5">
                    {cargandoMovimientos ? (
                        <div className="min-h-[320px] flex flex-col items-center justify-center gap-4">
                            <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />
                            <p className="text-sm text-slate-500">
                                Cargando movimientos...
                            </p>
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-slate-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[1100px]">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            {[
                                                "Fecha",
                                                "Documento",
                                                "Movimiento",
                                                "Bodega",
                                                "Ubicación",
                                                "Cantidad",
                                                "Saldo anterior",
                                                "Saldo nuevo",
                                            ].map((titulo) => (
                                                <th
                                                    key={titulo}
                                                    className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500"
                                                >
                                                    {titulo}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {modalMovimientos.movimientos.map(
                                            (item) => (
                                                <tr
                                                    key={
                                                        item.idMovimiento ||
                                                        item.id
                                                    }
                                                >
                                                    <td className="px-5 py-3 text-sm text-slate-600">
                                                        {formatearFecha(
                                                            item.fechaMovimiento,
                                                            true
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <p className="font-semibold text-slate-900">
                                                            {item.consecutivo ||
                                                                "Sin documento"}
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            {item.tipoDocumento ||
                                                                "Movimiento"}
                                                        </p>
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        {item.tipoMovimiento}
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        {item.bodega}
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        {item.ubicacion ||
                                                            "Sin ubicación"}
                                                    </td>
                                                    <td className="px-5 py-3 font-bold">
                                                        {formatearNumero(
                                                            item.cantidad
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        {formatearNumero(
                                                            item.saldoAnterior
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3 font-bold">
                                                        {formatearNumero(
                                                            item.saldoNuevo
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {modalMovimientos.total > 0 && (
                                <Paginacion
                                    pagina={modalMovimientos.pagina}
                                    totalPaginas={
                                        modalMovimientos.totalPaginas
                                    }
                                    total={modalMovimientos.total}
                                    desde={
                                        (modalMovimientos.pagina - 1) * 20 +
                                        1
                                    }
                                    hasta={Math.min(
                                        modalMovimientos.pagina * 20,
                                        modalMovimientos.total
                                    )}
                                    onAnterior={() =>
                                        cargarMovimientos(
                                            modalMovimientos.lote,
                                            Math.max(
                                                1,
                                                modalMovimientos.pagina - 1
                                            )
                                        )
                                    }
                                    onSiguiente={() =>
                                        cargarMovimientos(
                                            modalMovimientos.lote,
                                            Math.min(
                                                modalMovimientos.totalPaginas,
                                                modalMovimientos.pagina + 1
                                            )
                                        )
                                    }
                                />
                            )}
                        </div>
                    )}
                </div>
            </Modal>

            <Modal
                visible={modalConfirmacion.visible}
                onClose={cerrarConfirmacion}
                maxWidth="max-w-md"
            >
                <header className="px-5 py-4 border-b border-slate-200 bg-white">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div
                                className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${
                                    Number(modalConfirmacion.nuevoEstado) === 1
                                        ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                                        : "bg-rose-50 border-rose-100 text-rose-700"
                                }`}
                            >
                                {Number(modalConfirmacion.nuevoEstado) === 1 ? (
                                    <FaCheckCircle />
                                ) : (
                                    <FaExclamationTriangle />
                                )}
                            </div>

                            <div>
                                <p
                                    className={`text-xs font-bold uppercase tracking-[0.16em] ${
                                        Number(modalConfirmacion.nuevoEstado) ===
                                        1
                                            ? "text-emerald-700"
                                            : "text-rose-700"
                                    }`}
                                >
                                    Confirmación
                                </p>

                                <h2 className="mt-1 text-lg font-bold text-slate-900">
                                    {Number(modalConfirmacion.nuevoEstado) === 1
                                        ? "Activar lote"
                                        : "Desactivar lote"}
                                </h2>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={cerrarConfirmacion}
                            disabled={Boolean(procesandoEstado)}
                            className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 disabled:opacity-50 transition"
                            aria-label="Cerrar confirmación"
                        >
                            <FaTimes />
                        </button>
                    </div>
                </header>

                <div className="p-5">
                    <p className="text-sm leading-6 text-slate-600">
                        ¿Deseas{" "}
                        <strong className="text-slate-900">
                            {Number(modalConfirmacion.nuevoEstado) === 1
                                ? "activar"
                                : "desactivar"}
                        </strong>{" "}
                        el lote{" "}
                        <strong className="text-slate-900">
                            {modalConfirmacion.lote?.lote || "seleccionado"}
                        </strong>
                        ?
                    </p>

                    {modalConfirmacion.lote?.producto ||
                    modalConfirmacion.lote?.nombreProducto ? (
                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                Producto
                            </p>
                            <p className="mt-1 text-sm font-bold text-slate-900">
                                {modalConfirmacion.lote?.producto ||
                                    modalConfirmacion.lote?.nombreProducto}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">
                                {modalConfirmacion.lote?.codigoProducto ||
                                    "Sin código"}
                            </p>
                        </div>
                    ) : null}

                    {Number(modalConfirmacion.nuevoEstado) === 0 && (
                        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                            <FaExclamationTriangle className="mt-0.5 shrink-0" />
                            <p>
                                El lote dejará de aparecer en las consultas que
                                muestran únicamente registros activos. Sus
                                existencias y movimientos no serán eliminados.
                            </p>
                        </div>
                    )}
                </div>

                <footer className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                    <button
                        type="button"
                        onClick={cerrarConfirmacion}
                        disabled={Boolean(procesandoEstado)}
                        className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50 transition"
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        onClick={confirmarCambioEstado}
                        disabled={Boolean(procesandoEstado)}
                        className={`h-10 px-5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition ${
                            Number(modalConfirmacion.nuevoEstado) === 1
                                ? "bg-emerald-700 hover:bg-emerald-800"
                                : "bg-rose-700 hover:bg-rose-800"
                        }`}
                    >
                        {procesandoEstado ? (
                            <FaSyncAlt className="animate-spin" />
                        ) : Number(modalConfirmacion.nuevoEstado) === 1 ? (
                            <FaCheckCircle />
                        ) : (
                            <FaPowerOff />
                        )}

                        {procesandoEstado
                            ? "Procesando..."
                            : Number(modalConfirmacion.nuevoEstado) === 1
                            ? "Sí, activar"
                            : "Sí, desactivar"}
                    </button>
                </footer>
            </Modal>
        </>
    );
};

export default LotesVencimientosInventario;