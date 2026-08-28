import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    FaArrowLeft,
    FaBuilding,
    FaChartBar,
    FaCheck,
    FaCheckCircle,
    FaClipboardCheck,
    FaExclamationTriangle,
    FaEye,
    FaFileExcel,
    FaFilter,
    FaList,
    FaPaperPlane,
    FaSave,
    FaSearch,
    FaSyncAlt,
    FaTimes,
    FaUndoAlt,
    FaWarehouse,
} from "react-icons/fa";

import { IoMenu } from "react-icons/io5";
import { toast } from "react-toastify";

import {
    API_BASE_CONTEOS,
    claseEstado,
    formatearFechaHora,
    formatearNumero,
    leerRespuesta,
    obtenerIdUsuario,
    respuestaExitosa,
    textoEstado,
} from "./conteosFisicosHelpers";

const FILTROS_INICIALES = {
    q: "",
    idBodega: "",
    tipoDiferencia: "",
    estadoAnalisis: "",
};

const TIPOS_DIFERENCIA = [
    { valor: "", nombre: "Todos los resultados" },
    { valor: "PENDIENTE", nombre: "Pendiente" },
    {
        valor: "SIN_DIFERENCIA",
        nombre: "Sin diferencia",
    },
    { valor: "SOBRANTE", nombre: "Sobrante" },
    { valor: "FALTANTE", nombre: "Faltante" },
];

const ESTADOS_ANALISIS = [
    { valor: "", nombre: "Todos los análisis" },
    { valor: "PENDIENTE", nombre: "Pendiente" },
    { valor: "VALIDADO", nombre: "Validado" },
    { valor: "OBSERVADO", nombre: "Observado" },
    { valor: "AJUSTADO", nombre: "Ajustado" },
];

const claseResultado = (resultado) => {
    const clases = {
        PENDIENTE:
            "bg-slate-100 text-slate-700 border-slate-200",
        SIN_DIFERENCIA:
            "bg-emerald-50 text-emerald-700 border-emerald-200",
        SOBRANTE:
            "bg-blue-50 text-blue-700 border-blue-200",
        FALTANTE:
            "bg-rose-50 text-rose-700 border-rose-200",
    };

    return (
        clases[resultado] ||
        "bg-slate-100 text-slate-700 border-slate-200"
    );
};

const estadoAnalisisInicial = (detalle) =>
    detalle.estadoAnalisis || "PENDIENTE";

export default function AnalisisConteoFisicoInventario({
    setSidebar,
    navegar,
}) {
    const idOrdenConteo = useMemo(
        () =>
            Number(
                localStorage.getItem(
                    "inventarioOrdenConteoId"
                ) || 0
            ),
        []
    );

    const idUsuario = useMemo(
        () => obtenerIdUsuario(),
        []
    );

    const [orden, setOrden] = useState(null);
    const [resumen, setResumen] = useState({});
    const [bodegas, setBodegas] = useState([]);
    const [consolidado, setConsolidado] =
        useState([]);
    const [detalles, setDetalles] = useState([]);

    const [filtros, setFiltros] = useState(
        FILTROS_INICIALES
    );

    const [pestana, setPestana] = useState(
        "BODEGAS"
    );

    const [estadosDetalle, setEstadosDetalle] =
        useState({});
    const [
        observacionesDetalle,
        setObservacionesDetalle,
    ] = useState({});
    const [modificados, setModificados] = useState(
        new Set()
    );

    const [cargando, setCargando] = useState(true);
    const [procesando, setProcesando] =
        useState(false);
    const [modalFiltros, setModalFiltros] =
        useState(false);

    const [modalAccion, setModalAccion] = useState({
        visible: false,
        tipo: "",
        bodega: null,
        observacion: "",
        publicarResultados: true,
    });

    const cargarAnalisis = useCallback(
        async ({ silencioso = false } = {}) => {
            if (!idOrdenConteo || !idUsuario) {
                toast.error(
                    "No fue posible identificar la orden o el usuario."
                );

                navegar(
                    "DetalleConteoFisicoInventario"
                );
                return;
            }

            if (!silencioso) {
                setCargando(true);
            }

            try {
                const params = new URLSearchParams({
                    idOrdenConteo,
                    idUsuario,
                    pagina: 1,
                    limite: 1000,
                    t: Date.now(),
                });

                Object.entries(filtros).forEach(
                    ([campo, valor]) => {
                        if (
                            String(valor || "").trim()
                        ) {
                            params.set(
                                campo,
                                String(valor).trim()
                            );
                        }
                    }
                );

                const respuesta = await fetch(
                    `${API_BASE_CONTEOS}InventarioOrdenesConteoAnalisis.php?${params.toString()}`,
                    {
                        method: "GET",
                        cache: "no-store",
                        headers: {
                            Accept: "application/json",
                            "Cache-Control":
                                "no-cache",
                        },
                    }
                );

                const resultado =
                    await leerRespuesta(respuesta);

                if (
                    !respuesta.ok ||
                    !respuestaExitosa(resultado)
                ) {
                    throw new Error(
                        resultado?.error ||
                            resultado?.mensaje ||
                            "No fue posible consultar el análisis."
                    );
                }

                const data =
                    resultado?.data || {};

                const nuevosDetalles =
                    Array.isArray(data.detalles)
                        ? data.detalles
                        : [];

                setOrden(data.orden || null);
                setResumen(data.resumen || {});

                setBodegas(
                    Array.isArray(data.bodegas)
                        ? data.bodegas
                        : []
                );

                setConsolidado(
                    Array.isArray(
                        data.consolidadoProductos
                    )
                        ? data.consolidadoProductos
                        : []
                );

                setDetalles(nuevosDetalles);

                setEstadosDetalle((prev) => {
                    const siguiente = {
                        ...prev,
                    };

                    nuevosDetalles.forEach(
                        (detalle) => {
                            if (
                                !modificados.has(
                                    detalle.idDetalleConteo
                                )
                            ) {
                                siguiente[
                                    detalle.idDetalleConteo
                                ] =
                                    estadoAnalisisInicial(
                                        detalle
                                    );
                            }
                        }
                    );

                    return siguiente;
                });

                setObservacionesDetalle(
                    (prev) => {
                        const siguiente = {
                            ...prev,
                        };

                        nuevosDetalles.forEach(
                            (detalle) => {
                                if (
                                    !modificados.has(
                                        detalle.idDetalleConteo
                                    )
                                ) {
                                    siguiente[
                                        detalle.idDetalleConteo
                                    ] =
                                        detalle.observacionAnalisis ||
                                        "";
                                }
                            }
                        );

                        return siguiente;
                    }
                );
            } catch (error) {
                console.error(
                    "Error consultando análisis:",
                    error
                );

                toast.error(
                    error?.message ||
                        "No fue posible consultar el análisis."
                );
            } finally {
                if (!silencioso) {
                    setCargando(false);
                }
            }
        },
        [
            filtros,
            idOrdenConteo,
            idUsuario,
            modificados,
            navegar,
        ]
    );

    useEffect(() => {
        const temporizador = setTimeout(() => {
            cargarAnalisis();
        }, 250);

        return () =>
            clearTimeout(temporizador);
    }, [
        filtros.q,
        filtros.idBodega,
        filtros.tipoDiferencia,
        filtros.estadoAnalisis,
    ]);

    useEffect(() => {
        cargarAnalisis();
        // Carga inicial.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const cambiarAnalisisDetalle = (
        idDetalle,
        campo,
        valor
    ) => {
        if (campo === "estado") {
            setEstadosDetalle((prev) => ({
                ...prev,
                [idDetalle]: valor,
            }));
        } else {
            setObservacionesDetalle((prev) => ({
                ...prev,
                [idDetalle]: valor,
            }));
        }

        setModificados((prev) => {
            const siguiente = new Set(prev);
            siguiente.add(idDetalle);
            return siguiente;
        });
    };

    const guardarAnalisis = async () => {
        if (modificados.size === 0) {
            toast.info(
                "No hay cambios de análisis pendientes."
            );
            return;
        }

        const payloadDetalles = [];

        for (const idDetalle of modificados) {
            const estado =
                estadosDetalle[idDetalle] ||
                "PENDIENTE";

            const observacion =
                observacionesDetalle[idDetalle] ||
                "";

            if (
                estado === "OBSERVADO" &&
                !observacion.trim()
            ) {
                toast.info(
                    "Los productos observados deben incluir una observación."
                );
                return;
            }

            payloadDetalles.push({
                idDetalleConteo:
                    Number(idDetalle),
                estadoAnalisis: estado,
                observacionAnalisis:
                    observacion.trim(),
            });
        }

        setProcesando(true);

        try {
            const respuesta = await fetch(
                `${API_BASE_CONTEOS}InventarioConteoDetalleAnalisisGuardar.php`,
                {
                    method: "POST",
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                        "Content-Type":
                            "application/json",
                        "Cache-Control":
                            "no-cache",
                    },
                    body: JSON.stringify({
                        idOrdenConteo,
                        idUsuario,
                        detalles:
                            payloadDetalles,
                    }),
                }
            );

            const resultado =
                await leerRespuesta(respuesta);

            if (
                !respuesta.ok ||
                !respuestaExitosa(resultado)
            ) {
                throw new Error(
                    resultado?.error ||
                        resultado?.mensaje ||
                        "No fue posible guardar el análisis."
                );
            }

            setModificados(new Set());

            toast.success(
                resultado?.mensaje ||
                    "Análisis guardado correctamente."
            );

            await cargarAnalisis({
                silencioso: true,
            });
        } catch (error) {
            toast.error(error.message);
        } finally {
            setProcesando(false);
        }
    };

    const validarVisibles = () => {
        const siguientesEstados = {
            ...estadosDetalle,
        };

        const siguientesObservaciones = {
            ...observacionesDetalle,
        };

        const siguientesModificados = new Set(
            modificados
        );

        detalles.forEach((detalle) => {
            if (
                detalle.estadoAnalisis === "AJUSTADO"
            ) {
                return;
            }

            siguientesEstados[
                detalle.idDetalleConteo
            ] = "VALIDADO";

            siguientesObservaciones[
                detalle.idDetalleConteo
            ] =
                siguientesObservaciones[
                    detalle.idDetalleConteo
                ] || "";

            siguientesModificados.add(
                detalle.idDetalleConteo
            );
        });

        setEstadosDetalle(siguientesEstados);

        setObservacionesDetalle(
            siguientesObservaciones
        );

        setModificados(siguientesModificados);

        toast.info(
            `${detalles.length} registros quedaron preparados como validados.`
        );
    };

    const abrirConteoBodega = (bodega) => {
        localStorage.setItem(
            "inventarioSolicitudConteoId",
            String(bodega.idSolicitudConteo)
        );

        localStorage.setItem(
            "inventarioConteoModo",
            "ADMIN"
        );

        navegar("ConteoBodegaInventario");
    };

    const abrirModalBodega = (
        tipo,
        bodega
    ) => {
        setModalAccion({
            visible: true,
            tipo,
            bodega,
            observacion: "",
            publicarResultados: true,
        });
    };

    const ejecutarAccionBodega = async () => {
        const { tipo, bodega, observacion } =
            modalAccion;

        if (!bodega) {
            return;
        }

        if (
            tipo === "DEVOLVER" &&
            !observacion.trim()
        ) {
            toast.info(
                "Indica el motivo de la devolución."
            );
            return;
        }

        const servicio =
            tipo === "DEVOLVER"
                ? "InventarioConteoBodegaDevolver.php"
                : "InventarioConteoBodegaAprobar.php";

        const payload = {
            idSolicitudConteo:
                bodega.idSolicitudConteo,
            idUsuario,
            observacion:
                observacion.trim(),
        };

        if (tipo === "APROBAR") {
            payload.confirmarDiferencias =
                Number(
                    bodega.totalDiferencias || 0
                ) > 0;
        }

        setProcesando(true);

        try {
            const respuesta = await fetch(
                `${API_BASE_CONTEOS}${servicio}`,
                {
                    method: "POST",
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                        "Content-Type":
                            "application/json",
                        "Cache-Control":
                            "no-cache",
                    },
                    body: JSON.stringify(payload),
                }
            );

            const resultado =
                await leerRespuesta(respuesta);

            if (
                !respuesta.ok ||
                !respuestaExitosa(resultado)
            ) {
                throw new Error(
                    resultado?.error ||
                        resultado?.mensaje ||
                        "No fue posible completar la acción."
                );
            }

            toast.success(
                resultado?.mensaje ||
                    "Acción realizada correctamente."
            );

            setModalAccion({
                visible: false,
                tipo: "",
                bodega: null,
                observacion: "",
                publicarResultados: true,
            });

            await cargarAnalisis({
                silencioso: true,
            });
        } catch (error) {
            toast.error(error.message);
        } finally {
            setProcesando(false);
        }
    };

    const finalizarOrden = async () => {
        setProcesando(true);

        try {
            const respuesta = await fetch(
                `${API_BASE_CONTEOS}InventarioOrdenesConteoFinalizar.php`,
                {
                    method: "POST",
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                        "Content-Type":
                            "application/json",
                        "Cache-Control":
                            "no-cache",
                    },
                    body: JSON.stringify({
                        idOrdenConteo,
                        idUsuario,
                        observacion:
                            modalAccion.observacion.trim(),
                        publicarResultados:
                            modalAccion.publicarResultados,
                    }),
                }
            );

            const resultado =
                await leerRespuesta(respuesta);

            if (
                !respuesta.ok ||
                !respuestaExitosa(resultado)
            ) {
                throw new Error(
                    resultado?.error ||
                        resultado?.mensaje ||
                        "No fue posible finalizar la orden."
                );
            }

            toast.success(
                resultado?.mensaje ||
                    "Orden finalizada correctamente."
            );

            setModalAccion({
                visible: false,
                tipo: "",
                bodega: null,
                observacion: "",
                publicarResultados: true,
            });

            await cargarAnalisis({
                silencioso: true,
            });
        } catch (error) {
            toast.error(error.message);
        } finally {
            setProcesando(false);
        }
    };

    const cambiarPublicacion = async () => {
        setProcesando(true);

        try {
            const visible =
                !Boolean(
                    orden?.mostrarResultadoBodegas
                );

            const respuesta = await fetch(
                `${API_BASE_CONTEOS}InventarioOrdenesConteoPublicarResultados.php`,
                {
                    method: "POST",
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                        "Content-Type":
                            "application/json",
                        "Cache-Control":
                            "no-cache",
                    },
                    body: JSON.stringify({
                        idOrdenConteo,
                        idUsuario,
                        visible,
                    }),
                }
            );

            const resultado =
                await leerRespuesta(respuesta);

            if (
                !respuesta.ok ||
                !respuestaExitosa(resultado)
            ) {
                throw new Error(
                    resultado?.error ||
                        resultado?.mensaje ||
                        "No fue posible actualizar la publicación."
                );
            }

            toast.success(resultado.mensaje);

            await cargarAnalisis({
                silencioso: true,
            });
        } catch (error) {
            toast.error(error.message);
        } finally {
            setProcesando(false);
        }
    };

    const exportarExcel = () => {
        const params = new URLSearchParams({
            idOrdenConteo,
            idUsuario,
            t: Date.now(),
        });

        window.open(
            `${API_BASE_CONTEOS}InventarioOrdenesConteoExportarExcel.php?${params.toString()}`,
            "_blank",
            "noopener,noreferrer"
        );
    };

    const todasAprobadas = useMemo(() => {
        if (bodegas.length === 0) {
            return false;
        }

        const aprobadas = bodegas.filter(
            (bodega) =>
                bodega.estadoProceso ===
                "APROBADO"
        ).length;

        const pendientes = bodegas.filter(
            (bodega) =>
                ![
                    "APROBADO",
                    "ANULADO",
                ].includes(
                    bodega.estadoProceso
                )
        ).length;

        return aprobadas > 0 && pendientes === 0;
    }, [bodegas]);

    const ordenEnAnalisis =
        orden?.estadoProceso === "EN_ANALISIS";

    const ordenFinalizada =
        orden?.estadoProceso === "FINALIZADA";

    const filtrosActivos = useMemo(
        () =>
            Object.values(filtros).filter(
                (valor) =>
                    String(valor || "").trim()
            ).length,
        [filtros]
    );

    const tarjetas = [
        {
            titulo: "Bodegas",
            valor: resumen.totalBodegas,
            clase:
                "bg-slate-50 text-slate-700 border-slate-200",
            icono: FaWarehouse,
        },
        {
            titulo: "Enviadas",
            valor: resumen.enviadas,
            clase:
                "bg-violet-50 text-violet-700 border-violet-200",
            icono: FaPaperPlane,
        },
        {
            titulo: "Aprobadas",
            valor: resumen.aprobadas,
            clase:
                "bg-emerald-50 text-emerald-700 border-emerald-200",
            icono: FaCheckCircle,
        },
        {
            titulo: "Diferencias",
            valor: resumen.totalDiferencias,
            clase:
                "bg-rose-50 text-rose-700 border-rose-200",
            icono: FaExclamationTriangle,
        },
        {
            titulo: "Sobrantes",
            valor: resumen.totalSobrantes,
            clase:
                "bg-blue-50 text-blue-700 border-blue-200",
            icono: FaChartBar,
        },
        {
            titulo: "Faltantes",
            valor: resumen.totalFaltantes,
            clase:
                "bg-orange-50 text-orange-700 border-orange-200",
            icono: FaUndoAlt,
        },
    ];

    return (
        <>
            <div className="w-full h-screen flex flex-col p-2 md:p-4 gap-4 bg-slate-100">
                <article className="flex-1 bg-white shadow-lg rounded-2xl flex flex-col overflow-hidden border border-slate-200">
                    <header className="px-4 py-3 md:px-5 border-b border-slate-200 bg-white">
                        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setSidebar(true)
                                    }
                                    className="lg:hidden h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center"
                                >
                                    <IoMenu size={23} />
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        navegar(
                                            "DetalleConteoFisicoInventario"
                                        )
                                    }
                                    className="h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center"
                                >
                                    <FaArrowLeft />
                                </button>

                                <div className="h-11 w-11 rounded-xl bg-violet-50 text-violet-700 border border-violet-100 flex items-center justify-center">
                                    <FaChartBar size={20} />
                                </div>

                                <div className="min-w-0">
                                    <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                                        Revisión administrativa
                                    </p>

                                    <h1 className="text-xl md:text-2xl font-bold text-slate-900 truncate">
                                        {orden?.nombre ||
                                            "Análisis de conteo"}
                                    </h1>

                                    <p className="text-sm text-slate-500">
                                        {orden?.codigo ||
                                            "Consultando..."}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setModalFiltros(true)
                                    }
                                    className="h-10 px-4 rounded-xl border border-slate-200 bg-white font-semibold flex items-center gap-2"
                                >
                                    <FaFilter />
                                    Filtros
                                    {filtrosActivos > 0 && (
                                        <span className="h-5 min-w-5 px-1 rounded-full bg-violet-700 text-white text-xs flex items-center justify-center">
                                            {filtrosActivos}
                                        </span>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={() =>
                                        cargarAnalisis()
                                    }
                                    disabled={cargando}
                                    className="h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center disabled:opacity-50"
                                >
                                    <FaSyncAlt
                                        className={
                                            cargando
                                                ? "animate-spin"
                                                : ""
                                        }
                                    />
                                </button>

                                <button
                                    type="button"
                                    onClick={exportarExcel}
                                    className="h-10 px-4 rounded-xl bg-emerald-700 text-white font-semibold flex items-center gap-2"
                                >
                                    <FaFileExcel />
                                    Exportar Excel
                                </button>

                                {ordenEnAnalisis &&
                                    todasAprobadas && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setModalAccion({
                                                    visible:
                                                        true,
                                                    tipo: "FINALIZAR",
                                                    bodega:
                                                        null,
                                                    observacion:
                                                        "",
                                                    publicarResultados:
                                                        true,
                                                })
                                            }
                                            className="h-10 px-4 rounded-xl bg-blue-800 text-white font-semibold flex items-center gap-2"
                                        >
                                            <FaCheckCircle />
                                            Finalizar
                                        </button>
                                    )}

                                {ordenFinalizada && (
                                    <button
                                        type="button"
                                        disabled={procesando}
                                        onClick={
                                            cambiarPublicacion
                                        }
                                        className={`h-10 px-4 rounded-xl text-white font-semibold flex items-center gap-2 disabled:opacity-50 ${
                                            orden.mostrarResultadoBodegas
                                                ? "bg-slate-700"
                                                : "bg-blue-800"
                                        }`}
                                    >
                                        <FaEye />
                                        {orden.mostrarResultadoBodegas
                                            ? "Ocultar resultados"
                                            : "Publicar resultados"}
                                    </button>
                                )}
                            </div>
                        </div>
                    </header>

                    <div className="px-4 pt-4 md:px-5">
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                            {tarjetas.map((tarjeta) => {
                                const Icono = tarjeta.icono;

                                return (
                                    <div
                                        key={tarjeta.titulo}
                                        className={`rounded-2xl border p-4 ${tarjeta.clase}`}
                                    >
                                        <div className="flex items-center justify-between text-xs uppercase tracking-wide font-bold">
                                            <span>
                                                {tarjeta.titulo}
                                            </span>
                                            <Icono />
                                        </div>

                                        <p className="mt-3 text-3xl font-black">
                                            {formatearNumero(
                                                tarjeta.valor
                                            )}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="px-4 py-4 md:px-5 border-b border-slate-200">
                        <div className="relative">
                            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                            <input
                                type="search"
                                value={filtros.q}
                                onChange={(event) =>
                                    setFiltros((prev) => ({
                                        ...prev,
                                        q: event.target.value,
                                    }))
                                }
                                placeholder="Buscar producto, lote, bodega o ubicación..."
                                className="w-full h-11 pl-11 pr-4 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-violet-200"
                            />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                            {[
                                {
                                    valor: "BODEGAS",
                                    nombre: "Bodegas",
                                    icono: FaBuilding,
                                },
                                {
                                    valor: "DETALLES",
                                    nombre: "Detalle de productos",
                                    icono: FaList,
                                },
                                {
                                    valor: "CONSOLIDADO",
                                    nombre: "Consolidado",
                                    icono: FaClipboardCheck,
                                },
                            ].map((item) => {
                                const Icono = item.icono;

                                return (
                                    <button
                                        key={item.valor}
                                        type="button"
                                        onClick={() =>
                                            setPestana(
                                                item.valor
                                            )
                                        }
                                        className={`h-10 px-4 rounded-xl border font-semibold flex items-center gap-2 ${
                                            pestana ===
                                            item.valor
                                                ? "bg-violet-700 border-violet-700 text-white"
                                                : "bg-white border-slate-200 text-slate-700"
                                        }`}
                                    >
                                        <Icono />
                                        {item.nombre}
                                    </button>
                                );
                            })}

                            {pestana === "DETALLES" &&
                                ordenEnAnalisis && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={
                                                validarVisibles
                                            }
                                            className="h-10 px-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold flex items-center gap-2"
                                        >
                                            <FaCheck />
                                            Validar visibles
                                        </button>

                                        <button
                                            type="button"
                                            disabled={
                                                modificados.size ===
                                                    0 ||
                                                procesando
                                            }
                                            onClick={
                                                guardarAnalisis
                                            }
                                            className="h-10 px-4 rounded-xl bg-slate-900 text-white font-semibold flex items-center gap-2 disabled:opacity-40"
                                        >
                                            <FaSave />
                                            Guardar (
                                            {
                                                modificados.size
                                            }
                                            )
                                        </button>
                                    </>
                                )}
                        </div>
                    </div>

                    <section className="flex-1 overflow-auto p-4 md:p-5 bg-slate-50/60">
                        {cargando ? (
                            <div className="min-h-64 flex flex-col items-center justify-center text-slate-500">
                                <FaSyncAlt className="animate-spin text-3xl mb-3" />
                                <p className="font-semibold">
                                    Consultando análisis...
                                </p>
                            </div>
                        ) : pestana === "BODEGAS" ? (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {bodegas.map((bodega) => (
                                    <article
                                        key={
                                            bodega.idSolicitudConteo
                                        }
                                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-mono text-xs font-bold text-blue-800 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">
                                                        {
                                                            bodega.codigoBodega
                                                        }
                                                    </span>

                                                    <span
                                                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${claseEstado(
                                                            bodega.estadoProceso
                                                        )}`}
                                                    >
                                                        {textoEstado(
                                                            bodega.estadoProceso
                                                        )}
                                                    </span>
                                                </div>

                                                <h2 className="mt-3 text-lg font-bold text-slate-900">
                                                    {
                                                        bodega.bodega
                                                    }
                                                </h2>

                                                <p className="mt-1 text-sm text-slate-500">
                                                    Responsable:{" "}
                                                    <strong className="text-slate-700">
                                                        {bodega.responsablePrincipal ||
                                                            "Sin asignar"}
                                                    </strong>
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    abrirConteoBodega(
                                                        bodega
                                                    )
                                                }
                                                className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold flex items-center justify-center gap-2"
                                            >
                                                <FaEye />
                                                Ver conteo
                                            </button>
                                        </div>

                                        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                                            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                                <p className="text-[11px] uppercase font-bold text-slate-500">
                                                    Productos
                                                </p>
                                                <p className="mt-1 text-xl font-black">
                                                    {formatearNumero(
                                                        bodega.totalDetalles
                                                    )}
                                                </p>
                                            </div>

                                            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                                                <p className="text-[11px] uppercase font-bold text-emerald-700">
                                                    Contados
                                                </p>
                                                <p className="mt-1 text-xl font-black text-emerald-800">
                                                    {formatearNumero(
                                                        bodega.totalContados
                                                    )}
                                                </p>
                                            </div>

                                            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
                                                <p className="text-[11px] uppercase font-bold text-blue-700">
                                                    Sobrantes
                                                </p>
                                                <p className="mt-1 text-xl font-black text-blue-800">
                                                    {formatearNumero(
                                                        bodega.totalSobrantes
                                                    )}
                                                </p>
                                            </div>

                                            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3">
                                                <p className="text-[11px] uppercase font-bold text-rose-700">
                                                    Faltantes
                                                </p>
                                                <p className="mt-1 text-xl font-black text-rose-800">
                                                    {formatearNumero(
                                                        bodega.totalFaltantes
                                                    )}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-4 grid grid-cols-3 gap-2">
                                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                                <p className="text-xs text-slate-500">
                                                    Sistema
                                                </p>
                                                <strong className="block mt-1 text-slate-900">
                                                    {formatearNumero(
                                                        bodega.cantidadSistema
                                                    )}
                                                </strong>
                                            </div>

                                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                                <p className="text-xs text-slate-500">
                                                    Físico
                                                </p>
                                                <strong className="block mt-1 text-slate-900">
                                                    {formatearNumero(
                                                        bodega.cantidadFisica
                                                    )}
                                                </strong>
                                            </div>

                                            <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                                                <p className="text-xs text-violet-700">
                                                    Diferencia
                                                </p>
                                                <strong className="block mt-1 text-violet-800">
                                                    {formatearNumero(
                                                        bodega.diferencia
                                                    )}
                                                </strong>
                                            </div>
                                        </div>

                                        {ordenEnAnalisis &&
                                            [
                                                "ENVIADO",
                                                "APROBADO",
                                            ].includes(
                                                bodega.estadoProceso
                                            ) && (
                                                <div className="mt-4 pt-4 border-t border-slate-200 flex flex-wrap justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            abrirModalBodega(
                                                                "DEVOLVER",
                                                                bodega
                                                            )
                                                        }
                                                        className="h-10 px-4 rounded-xl border border-orange-200 bg-orange-50 text-orange-700 font-semibold flex items-center gap-2"
                                                    >
                                                        <FaUndoAlt />
                                                        Devolver
                                                    </button>

                                                    {bodega.estadoProceso ===
                                                        "ENVIADO" && (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                abrirModalBodega(
                                                                    "APROBAR",
                                                                    bodega
                                                                )
                                                            }
                                                            className="h-10 px-4 rounded-xl bg-emerald-700 text-white font-semibold flex items-center gap-2"
                                                        >
                                                            <FaCheckCircle />
                                                            Aprobar
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                    </article>
                                ))}
                            </div>
                        ) : pestana === "DETALLES" ? (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {detalles.length ===
                                0 ? (
                                    <div className="xl:col-span-2 min-h-56 flex items-center justify-center text-slate-500">
                                        No hay detalles que coincidan con los filtros.
                                    </div>
                                ) : (
                                    detalles.map(
                                        (detalle) => {
                                            const id =
                                                detalle.idDetalleConteo;

                                            const estado =
                                                estadosDetalle[
                                                    id
                                                ] ||
                                                "PENDIENTE";

                                            const modificado =
                                                modificados.has(
                                                    id
                                                );

                                            return (
                                                <article
                                                    key={
                                                        id
                                                    }
                                                    className={`rounded-2xl border bg-white p-5 shadow-sm ${
                                                        modificado
                                                            ? "border-violet-300 ring-2 ring-violet-100"
                                                            : "border-slate-200"
                                                    }`}
                                                >
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-mono text-xs font-bold text-blue-800 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">
                                                            {
                                                                detalle.codigoProducto
                                                            }
                                                        </span>

                                                        <span
                                                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${claseResultado(
                                                                detalle.resultado
                                                            )}`}
                                                        >
                                                            {textoEstado(
                                                                detalle.resultado
                                                            )}
                                                        </span>

                                                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
                                                            {
                                                                detalle.bodega
                                                            }
                                                        </span>
                                                    </div>

                                                    <h3 className="mt-3 text-lg font-bold text-slate-900">
                                                        {
                                                            detalle.producto
                                                        }
                                                    </h3>

                                                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-500">
                                                        <p>
                                                            <strong className="text-slate-700">
                                                                Ubicación:
                                                            </strong>{" "}
                                                            {detalle.ubicacion ||
                                                                "Sin ubicación"}
                                                        </p>

                                                        <p>
                                                            <strong className="text-slate-700">
                                                                Lote:
                                                            </strong>{" "}
                                                            {detalle.lote ||
                                                                "No aplica"}
                                                        </p>
                                                    </div>

                                                    <div className="mt-4 grid grid-cols-3 gap-2">
                                                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                                            <p className="text-xs text-slate-500">
                                                                Sistema
                                                            </p>
                                                            <strong className="block mt-1 text-slate-900">
                                                                {formatearNumero(
                                                                    detalle.cantidadSistema
                                                                )}
                                                            </strong>
                                                        </div>

                                                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                                            <p className="text-xs text-slate-500">
                                                                Físico
                                                            </p>
                                                            <strong className="block mt-1 text-slate-900">
                                                                {formatearNumero(
                                                                    detalle.cantidadFisica
                                                                )}
                                                            </strong>
                                                        </div>

                                                        <div className="rounded-xl bg-violet-50 border border-violet-200 p-3">
                                                            <p className="text-xs text-violet-700">
                                                                Diferencia
                                                            </p>
                                                            <strong className="block mt-1 text-violet-800">
                                                                {formatearNumero(
                                                                    detalle.diferencia
                                                                )}
                                                            </strong>
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-[170px_1fr] gap-3">
                                                        <label className="space-y-1.5">
                                                            <span className="text-sm font-bold text-slate-700">
                                                                Estado de análisis
                                                            </span>

                                                            <select
                                                                value={
                                                                    estado
                                                                }
                                                                disabled={
                                                                    !ordenEnAnalisis ||
                                                                    estado ===
                                                                        "AJUSTADO"
                                                                }
                                                                onChange={(
                                                                    event
                                                                ) =>
                                                                    cambiarAnalisisDetalle(
                                                                        id,
                                                                        "estado",
                                                                        event
                                                                            .target
                                                                            .value
                                                                    )
                                                                }
                                                                className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white disabled:bg-slate-100"
                                                            >
                                                                <option value="PENDIENTE">
                                                                    Pendiente
                                                                </option>
                                                                <option value="VALIDADO">
                                                                    Validado
                                                                </option>
                                                                <option value="OBSERVADO">
                                                                    Observado
                                                                </option>
                                                                {estado ===
                                                                    "AJUSTADO" && (
                                                                    <option value="AJUSTADO">
                                                                        Ajustado
                                                                    </option>
                                                                )}
                                                            </select>
                                                        </label>

                                                        <label className="space-y-1.5">
                                                            <span className="text-sm font-bold text-slate-700">
                                                                Observación administrativa
                                                            </span>

                                                            <input
                                                                type="text"
                                                                value={
                                                                    observacionesDetalle[
                                                                        id
                                                                    ] ||
                                                                    ""
                                                                }
                                                                disabled={
                                                                    !ordenEnAnalisis ||
                                                                    estado ===
                                                                        "AJUSTADO"
                                                                }
                                                                onChange={(
                                                                    event
                                                                ) =>
                                                                    cambiarAnalisisDetalle(
                                                                        id,
                                                                        "observacion",
                                                                        event
                                                                            .target
                                                                            .value
                                                                    )
                                                                }
                                                                placeholder={
                                                                    estado ===
                                                                    "OBSERVADO"
                                                                        ? "Obligatoria"
                                                                        : "Opcional"
                                                                }
                                                                className="w-full h-11 px-3 rounded-xl border border-slate-200 disabled:bg-slate-100"
                                                            />
                                                        </label>
                                                    </div>
                                                </article>
                                            );
                                        }
                                    )
                                )}
                            </div>
                        ) : (
                            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[1000px]">
                                        <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
                                            <tr>
                                                <th className="px-4 py-3 text-left">
                                                    Producto
                                                </th>
                                                <th className="px-4 py-3 text-right">
                                                    Bodegas
                                                </th>
                                                <th className="px-4 py-3 text-right">
                                                    Sistema
                                                </th>
                                                <th className="px-4 py-3 text-right">
                                                    Físico
                                                </th>
                                                <th className="px-4 py-3 text-right">
                                                    Diferencia
                                                </th>
                                                <th className="px-4 py-3 text-center">
                                                    Resultado
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-slate-100">
                                            {consolidado.map(
                                                (producto) => (
                                                    <tr
                                                        key={
                                                            producto.idProducto
                                                        }
                                                        className="hover:bg-slate-50"
                                                    >
                                                        <td className="px-4 py-3">
                                                            <span className="block font-semibold text-slate-900">
                                                                {
                                                                    producto.producto
                                                                }
                                                            </span>
                                                            <span className="block text-xs font-mono text-slate-500">
                                                                {
                                                                    producto.codigoProducto
                                                                }{" "}
                                                                ·{" "}
                                                                {
                                                                    producto.unidad
                                                                }
                                                            </span>
                                                        </td>

                                                        <td className="px-4 py-3 text-right font-semibold">
                                                            {formatearNumero(
                                                                producto.totalBodegas
                                                            )}
                                                        </td>

                                                        <td className="px-4 py-3 text-right">
                                                            {formatearNumero(
                                                                producto.cantidadSistema
                                                            )}
                                                        </td>

                                                        <td className="px-4 py-3 text-right">
                                                            {formatearNumero(
                                                                producto.cantidadFisica
                                                            )}
                                                        </td>

                                                        <td className="px-4 py-3 text-right font-bold">
                                                            {formatearNumero(
                                                                producto.diferencia
                                                            )}
                                                        </td>

                                                        <td className="px-4 py-3 text-center">
                                                            <span
                                                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${claseResultado(
                                                                    producto.resultado
                                                                )}`}
                                                            >
                                                                {textoEstado(
                                                                    producto.resultado
                                                                )}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </section>
                </article>
            </div>

            {modalFiltros && (
                <div className="fixed inset-0 z-50 bg-slate-950/50 p-4 flex items-center justify-center">
                    <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-900">
                                Filtros de análisis
                            </h2>

                            <button
                                type="button"
                                onClick={() =>
                                    setModalFiltros(false)
                                }
                                className="h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center"
                            >
                                <FaTimes />
                            </button>
                        </header>

                        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <label className="space-y-1.5">
                                <span className="text-sm font-bold text-slate-700">
                                    Bodega
                                </span>

                                <select
                                    value={
                                        filtros.idBodega
                                    }
                                    onChange={(event) =>
                                        setFiltros((prev) => ({
                                            ...prev,
                                            idBodega:
                                                event.target
                                                    .value,
                                        }))
                                    }
                                    className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white"
                                >
                                    <option value="">
                                        Todas las bodegas
                                    </option>

                                    {bodegas.map((bodega) => (
                                        <option
                                            key={
                                                bodega.idBodega
                                            }
                                            value={
                                                bodega.idBodega
                                            }
                                        >
                                            {
                                                bodega.codigoBodega
                                            }{" "}
                                            -{" "}
                                            {
                                                bodega.bodega
                                            }
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="space-y-1.5">
                                <span className="text-sm font-bold text-slate-700">
                                    Resultado
                                </span>

                                <select
                                    value={
                                        filtros.tipoDiferencia
                                    }
                                    onChange={(event) =>
                                        setFiltros((prev) => ({
                                            ...prev,
                                            tipoDiferencia:
                                                event.target
                                                    .value,
                                        }))
                                    }
                                    className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white"
                                >
                                    {TIPOS_DIFERENCIA.map(
                                        (item) => (
                                            <option
                                                key={
                                                    item.valor ||
                                                    "TODOS"
                                                }
                                                value={
                                                    item.valor
                                                }
                                            >
                                                {
                                                    item.nombre
                                                }
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label className="space-y-1.5 md:col-span-2">
                                <span className="text-sm font-bold text-slate-700">
                                    Estado de análisis
                                </span>

                                <select
                                    value={
                                        filtros.estadoAnalisis
                                    }
                                    onChange={(event) =>
                                        setFiltros((prev) => ({
                                            ...prev,
                                            estadoAnalisis:
                                                event.target
                                                    .value,
                                        }))
                                    }
                                    className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white"
                                >
                                    {ESTADOS_ANALISIS.map(
                                        (item) => (
                                            <option
                                                key={
                                                    item.valor ||
                                                    "TODOS"
                                                }
                                                value={
                                                    item.valor
                                                }
                                            >
                                                {
                                                    item.nombre
                                                }
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>
                        </div>

                        <footer className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() =>
                                    setFiltros(
                                        FILTROS_INICIALES
                                    )
                                }
                                className="h-10 px-4 rounded-xl border border-slate-200 bg-white font-semibold"
                            >
                                Limpiar
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    setModalFiltros(false)
                                }
                                className="h-10 px-4 rounded-xl bg-violet-700 text-white font-semibold"
                            >
                                Aplicar
                            </button>
                        </footer>
                    </div>
                </div>
            )}

            {modalAccion.visible && (
                <div className="fixed inset-0 z-50 bg-slate-950/50 p-4 flex items-center justify-center">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">
                                    {modalAccion.tipo ===
                                    "DEVOLVER"
                                        ? "Devolver conteo"
                                        : modalAccion.tipo ===
                                            "APROBAR"
                                          ? "Aprobar conteo"
                                          : "Finalizar análisis"}
                                </h2>

                                {modalAccion.bodega && (
                                    <p className="text-sm text-slate-500">
                                        {
                                            modalAccion
                                                .bodega
                                                .bodega
                                        }
                                    </p>
                                )}
                            </div>

                            <button
                                type="button"
                                disabled={procesando}
                                onClick={() =>
                                    setModalAccion({
                                        visible:
                                            false,
                                        tipo: "",
                                        bodega:
                                            null,
                                        observacion:
                                            "",
                                        publicarResultados:
                                            true,
                                    })
                                }
                                className="h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center disabled:opacity-50"
                            >
                                <FaTimes />
                            </button>
                        </header>

                        <div className="p-5 space-y-4">
                            <div
                                className={`rounded-xl border p-4 flex gap-3 ${
                                    modalAccion.tipo ===
                                    "DEVOLVER"
                                        ? "bg-orange-50 border-orange-200 text-orange-800"
                                        : "bg-blue-50 border-blue-200 text-blue-800"
                                }`}
                            >
                                <FaExclamationTriangle className="mt-0.5 shrink-0" />

                                <p className="text-sm">
                                    {modalAccion.tipo ===
                                    "DEVOLVER"
                                        ? "La bodega podrá corregir el conteo y enviarlo nuevamente."
                                        : modalAccion.tipo ===
                                            "APROBAR"
                                          ? `Se aprobará el conteo con ${formatearNumero(
                                                modalAccion
                                                    .bodega
                                                    ?.totalDiferencias
                                            )} diferencias registradas.`
                                          : "La orden quedará cerrada y no podrá modificarse. Los ajustes de inventario se generarán en una etapa posterior."}
                                </p>
                            </div>

                            <label className="space-y-1.5 block">
                                <span className="text-sm font-bold text-slate-700">
                                    Observación
                                    {modalAccion.tipo ===
                                        "DEVOLVER" &&
                                        " *"}
                                </span>

                                <textarea
                                    rows={3}
                                    value={
                                        modalAccion.observacion
                                    }
                                    onChange={(event) =>
                                        setModalAccion(
                                            (prev) => ({
                                                ...prev,
                                                observacion:
                                                    event
                                                        .target
                                                        .value,
                                            })
                                        )
                                    }
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 resize-none"
                                />
                            </label>

                            {modalAccion.tipo ===
                                "FINALIZAR" && (
                                <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={
                                            modalAccion.publicarResultados
                                        }
                                        onChange={(event) =>
                                            setModalAccion(
                                                (prev) => ({
                                                    ...prev,
                                                    publicarResultados:
                                                        event
                                                            .target
                                                            .checked,
                                                })
                                            )
                                        }
                                        className="mt-1"
                                    />

                                    <span>
                                        <span className="block text-sm font-bold text-slate-800">
                                            Publicar resultados al finalizar
                                        </span>

                                        <span className="block mt-1 text-xs text-slate-500">
                                            Los responsables podrán consultar únicamente el resultado de su bodega.
                                        </span>
                                    </span>
                                </label>
                            )}
                        </div>

                        <footer className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
                            <button
                                type="button"
                                disabled={procesando}
                                onClick={() =>
                                    setModalAccion({
                                        visible:
                                            false,
                                        tipo: "",
                                        bodega:
                                            null,
                                        observacion:
                                            "",
                                        publicarResultados:
                                            true,
                                    })
                                }
                                className="h-10 px-4 rounded-xl border border-slate-200 bg-white font-semibold disabled:opacity-50"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                disabled={procesando}
                                onClick={
                                    modalAccion.tipo ===
                                    "FINALIZAR"
                                        ? finalizarOrden
                                        : ejecutarAccionBodega
                                }
                                className={`h-10 px-4 rounded-xl text-white font-semibold flex items-center gap-2 disabled:opacity-50 ${
                                    modalAccion.tipo ===
                                    "DEVOLVER"
                                        ? "bg-orange-600"
                                        : modalAccion.tipo ===
                                            "APROBAR"
                                          ? "bg-emerald-700"
                                          : "bg-blue-800"
                                }`}
                            >
                                {procesando ? (
                                    <FaSyncAlt className="animate-spin" />
                                ) : modalAccion.tipo ===
                                  "DEVOLVER" ? (
                                    <FaUndoAlt />
                                ) : (
                                    <FaCheckCircle />
                                )}

                                Confirmar
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </>
    );
}
