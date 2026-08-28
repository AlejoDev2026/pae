import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    FaArrowLeft,
    FaBoxes,
    FaCheckCircle,
    FaClipboardList,
    FaExclamationTriangle,
    FaEye,
    FaFileInvoice,
    FaFilter,
    FaMinusCircle,
    FaPlusCircle,
    FaSearch,
    FaSyncAlt,
    FaTimes,
    FaTools,
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

const ajusteYaProcesado = (detalle) =>
    Number(detalle?.ajusteGenerado || 0) === 1 ||
    Boolean(detalle?.idDocumentoDetalleAjuste);

const claseAplicacion = (detalle) => {
    if (ajusteYaProcesado(detalle)) {
        return "bg-slate-100 text-slate-700 border-slate-200";
    }

    if (detalle.aplicable) {
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }

    return "bg-rose-50 text-rose-700 border-rose-200";
};

export default function AjustesConteoFisicoInventario({
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
    const [resumenGeneral, setResumenGeneral] =
        useState({});
    const [bodegas, setBodegas] = useState([]);
    const [tiposDocumento, setTiposDocumento] =
        useState([]);
    const [
        idTipoDocumento,
        setIdTipoDocumento,
    ] = useState("");

    const [resumenPreview, setResumenPreview] =
        useState({});
    const [detallesPreview, setDetallesPreview] =
        useState([]);

    const [resumenAplicados, setResumenAplicados] =
        useState({});
    const [documentos, setDocumentos] = useState([]);
    const [movimientos, setMovimientos] =
        useState([]);

    const [idBodega, setIdBodega] = useState("");
    const [busqueda, setBusqueda] = useState("");
    const [pestana, setPestana] =
        useState("PREVISUALIZACION");

    const [cargando, setCargando] = useState(true);
    const [procesando, setProcesando] =
        useState(false);
    const [modalGenerar, setModalGenerar] =
        useState(false);
    const [observacion, setObservacion] =
        useState("");

    const cargarFormData = useCallback(async () => {
        const params = new URLSearchParams({
            idOrdenConteo,
            t: Date.now(),
        });

        const respuesta = await fetch(
            `${API_BASE_CONTEOS}InventarioOrdenesConteoAjustesFormData.php?${params.toString()}`,
            {
                method: "GET",
                cache: "no-store",
                headers: {
                    Accept: "application/json",
                    "Cache-Control": "no-cache",
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
                    "No fue posible cargar la configuración de ajustes."
            );
        }

        const data = resultado?.data || {};

        setOrden(data.orden || null);
        setResumenGeneral(data.resumen || {});

        setBodegas(
            Array.isArray(data.bodegas)
                ? data.bodegas
                : []
        );

        const tipos = Array.isArray(
            data.tiposDocumentoAjuste
        )
            ? data.tiposDocumentoAjuste
            : [];

        setTiposDocumento(tipos);

        setIdTipoDocumento((actual) => {
            if (actual) {
                return actual;
            }

            return String(
                data?.tipoDocumentoSugerido
                    ?.idTipoDocumento ||
                    tipos?.[0]?.idTipoDocumento ||
                    ""
            );
        });
    }, [idOrdenConteo]);

    const cargarPrevisualizacion =
        useCallback(async () => {
            const params = new URLSearchParams({
                idOrdenConteo,
                t: Date.now(),
            });

            if (idBodega) {
                params.set(
                    "idBodega",
                    idBodega
                );
            }

            const respuesta = await fetch(
                `${API_BASE_CONTEOS}InventarioOrdenesConteoPrevisualizarAjustes.php?${params.toString()}`,
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
                        "No fue posible previsualizar los ajustes."
                );
            }

            const data = resultado?.data || {};

            setResumenPreview(
                data.resumen || {}
            );

            setDetallesPreview(
                Array.isArray(data.detalles)
                    ? data.detalles
                    : []
            );
        }, [idBodega, idOrdenConteo]);

    const cargarAplicados = useCallback(async () => {
        const params = new URLSearchParams({
            idOrdenConteo,
            t: Date.now(),
        });

        const respuesta = await fetch(
            `${API_BASE_CONTEOS}InventarioOrdenesConteoAjustesDetalle.php?${params.toString()}`,
            {
                method: "GET",
                cache: "no-store",
                headers: {
                    Accept: "application/json",
                    "Cache-Control": "no-cache",
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
                    "No fue posible consultar los ajustes generados."
            );
        }

        const data = resultado?.data || {};

        setResumenAplicados(
            data.resumen || {}
        );

        setDocumentos(
            Array.isArray(data.documentos)
                ? data.documentos
                : []
        );

        setMovimientos(
            Array.isArray(data.detalles)
                ? data.detalles
                : []
        );
    }, [idOrdenConteo]);

    const cargarTodo = useCallback(async () => {
        if (!idOrdenConteo || !idUsuario) {
            toast.error(
                "No fue posible identificar la orden o el usuario."
            );

            navegar(
                "DetalleConteoFisicoInventario"
            );
            return;
        }

        setCargando(true);

        try {
            await cargarFormData();

            await Promise.all([
                cargarPrevisualizacion(),
                cargarAplicados(),
            ]);
        } catch (error) {
            console.error(
                "Error cargando ajustes:",
                error
            );

            toast.error(
                error?.message ||
                    "No fue posible cargar los ajustes."
            );
        } finally {
            setCargando(false);
        }
    }, [
        cargarAplicados,
        cargarFormData,
        cargarPrevisualizacion,
        idOrdenConteo,
        idUsuario,
        navegar,
    ]);

    useEffect(() => {
        cargarTodo();
    }, [cargarTodo]);

    useEffect(() => {
        if (!cargando) {
            cargarPrevisualizacion().catch(
                (error) =>
                    toast.error(error.message)
            );
        }
        // Se actualiza cuando cambia la bodega.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idBodega]);

    const detallesFiltrados = useMemo(() => {
        const texto = busqueda
            .trim()
            .toLowerCase();

        if (!texto) {
            return detallesPreview;
        }

        return detallesPreview.filter(
            (detalle) =>
                [
                    detalle.codigoProducto,
                    detalle.producto,
                    detalle.bodega,
                    detalle.codigoBodega,
                    detalle.ubicacion,
                    detalle.codigoUbicacion,
                    detalle.lote,
                ]
                    .filter(Boolean)
                    .some((valor) =>
                        String(valor)
                            .toLowerCase()
                            .includes(texto)
                    )
        );
    }, [busqueda, detallesPreview]);

    const generarAjustes = async () => {
        if (!idTipoDocumento) {
            toast.info(
                "Selecciona el tipo de documento de ajuste."
            );
            return;
        }

        if (
            Number(
                resumenPreview.bloqueados || 0
            ) > 0
        ) {
            toast.info(
                "Existen registros bloqueados. Revisa la previsualización antes de continuar."
            );
            return;
        }

        if (
            Number(
                resumenPreview.aplicables || 0
            ) === 0
        ) {
            toast.info(
                "No hay diferencias pendientes por aplicar."
            );
            return;
        }

        setProcesando(true);

        try {
            const respuesta = await fetch(
                `${API_BASE_CONTEOS}InventarioOrdenesConteoGenerarAjustes.php`,
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
                        idTipoDocumento:
                            Number(
                                idTipoDocumento
                            ),
                        confirmar: true,
                        observacion:
                            observacion.trim(),
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
                        "No fue posible generar los ajustes."
                );
            }

            toast.success(
                resultado?.mensaje ||
                    "Ajustes generados correctamente."
            );

            setModalGenerar(false);
            setObservacion("");

            await cargarTodo();
            setPestana("DOCUMENTOS");
        } catch (error) {
            toast.error(error.message);
        } finally {
            setProcesando(false);
        }
    };

    const puedeGenerar =
        Number(
            resumenPreview.aplicables || 0
        ) > 0 &&
        Number(
            resumenPreview.bloqueados || 0
        ) === 0 &&
        Boolean(idTipoDocumento);

    const tarjetas = [
        {
            titulo: "Diferencias",
            valor:
                resumenGeneral.registrosConDiferencia,
            icono: FaClipboardList,
            clase:
                "bg-slate-50 text-slate-700 border-slate-200",
        },
        {
            titulo: "Aplicables",
            valor: resumenPreview.aplicables,
            icono: FaCheckCircle,
            clase:
                "bg-emerald-50 text-emerald-700 border-emerald-200",
        },
        {
            titulo: "Bloqueados",
            valor: resumenPreview.bloqueados,
            icono: FaExclamationTriangle,
            clase:
                "bg-rose-50 text-rose-700 border-rose-200",
        },
        {
            titulo: "Sobrantes",
            valor: resumenPreview.sobrantes,
            icono: FaPlusCircle,
            clase:
                "bg-blue-50 text-blue-700 border-blue-200",
        },
        {
            titulo: "Faltantes",
            valor: resumenPreview.faltantes,
            icono: FaMinusCircle,
            clase:
                "bg-orange-50 text-orange-700 border-orange-200",
        },
        {
            titulo: "Documentos",
            valor:
                resumenAplicados.totalDocumentos,
            icono: FaFileInvoice,
            clase:
                "bg-violet-50 text-violet-700 border-violet-200",
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

                                <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center">
                                    <FaTools size={20} />
                                </div>

                                <div className="min-w-0">
                                    <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                                        Ajustes de inventario
                                    </p>

                                    <h1 className="text-xl md:text-2xl font-bold text-slate-900 truncate">
                                        {orden?.nombre ||
                                            "Diferencias del conteo"}
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
                                    onClick={cargarTodo}
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
                                    disabled={
                                        !puedeGenerar ||
                                        procesando
                                    }
                                    onClick={() =>
                                        setModalGenerar(true)
                                    }
                                    className="h-10 px-4 rounded-xl bg-amber-600 text-white font-semibold flex items-center gap-2 disabled:opacity-40"
                                >
                                    <FaTools />
                                    Generar ajustes
                                </button>
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
                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-3">
                            <div className="relative">
                                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                                <input
                                    type="search"
                                    value={busqueda}
                                    onChange={(event) =>
                                        setBusqueda(
                                            event.target
                                                .value
                                        )
                                    }
                                    placeholder="Buscar producto, bodega, ubicación o lote..."
                                    className="w-full h-11 pl-11 pr-4 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-amber-200"
                                />
                            </div>

                            <select
                                value={idBodega}
                                onChange={(event) =>
                                    setIdBodega(
                                        event.target
                                            .value
                                    )
                                }
                                className="h-11 px-3 rounded-xl border border-slate-200 bg-white"
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
                                        - {bodega.bodega}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                            {[
                                {
                                    valor:
                                        "PREVISUALIZACION",
                                    nombre:
                                        "Previsualización",
                                    icono: FaEye,
                                },
                                {
                                    valor: "DOCUMENTOS",
                                    nombre: "Documentos",
                                    icono: FaFileInvoice,
                                },
                                {
                                    valor: "MOVIMIENTOS",
                                    nombre: "Movimientos",
                                    icono: FaBoxes,
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
                                                ? "bg-amber-600 border-amber-600 text-white"
                                                : "bg-white border-slate-200 text-slate-700"
                                        }`}
                                    >
                                        <Icono />
                                        {item.nombre}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <section className="flex-1 overflow-auto p-4 md:p-5 bg-slate-50/60">
                        {cargando ? (
                            <div className="min-h-64 flex flex-col items-center justify-center text-slate-500">
                                <FaSyncAlt className="animate-spin text-3xl mb-3" />
                                <p className="font-semibold">
                                    Consultando ajustes...
                                </p>
                            </div>
                        ) : pestana ===
                          "PREVISUALIZACION" ? (
                            <>
                                {Number(
                                    resumenPreview.bloqueados ||
                                        0
                                ) > 0 && (
                                    <div className="mb-4 flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800">
                                        <FaExclamationTriangle className="mt-0.5 shrink-0" />

                                        <p className="text-sm">
                                            Hay registros bloqueados. Ningún ajuste debe generarse hasta resolverlos.
                                        </p>
                                    </div>
                                )}

                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                    {detallesFiltrados.length ===
                                    0 ? (
                                        <div className="xl:col-span-2 min-h-56 flex items-center justify-center text-slate-500">
                                            No hay diferencias para mostrar.
                                        </div>
                                    ) : (
                                        detallesFiltrados.map(
                                            (detalle) => (
                                                <article
                                                    key={
                                                        detalle.idDetalleConteo
                                                    }
                                                    className={`rounded-2xl border bg-white p-5 shadow-sm ${
                                                        detalle.aplicable
                                                            ? "border-emerald-200"
                                                            : "border-rose-200"
                                                    }`}
                                                >
                                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                                        <div>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="font-mono text-xs font-bold text-blue-800 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">
                                                                    {
                                                                        detalle.codigoProducto
                                                                    }
                                                                </span>

                                                                <span
                                                                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${claseAplicacion(
                                                                        detalle
                                                                    )}`}
                                                                >
                                                                    {ajusteYaProcesado(
                                                                        detalle
                                                                    )
                                                                        ? "PROCESADO"
                                                                        : detalle.aplicable
                                                                          ? "APLICABLE"
                                                                          : "BLOQUEADO"}
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
                                                        </div>

                                                        <span
                                                            className={`text-2xl font-black ${
                                                                Number(
                                                                    detalle.diferencia
                                                                ) >
                                                                0
                                                                    ? "text-blue-700"
                                                                    : "text-rose-700"
                                                            }`}
                                                        >
                                                            {Number(
                                                                detalle.diferencia
                                                            ) >
                                                            0
                                                                ? "+"
                                                                : ""}
                                                            {formatearNumero(
                                                                detalle.diferencia
                                                            )}
                                                        </span>
                                                    </div>

                                                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                                                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                                            <p className="text-xs text-slate-500">
                                                                Sistema al corte
                                                            </p>
                                                            <strong className="block mt-1 text-slate-900">
                                                                {formatearNumero(
                                                                    detalle.cantidadSistemaCorte
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

                                                        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                                                            <p className="text-xs text-amber-700">
                                                                Disponible actual
                                                            </p>
                                                            <strong className="block mt-1 text-amber-800">
                                                                {formatearNumero(
                                                                    detalle.cantidadDisponibleActual
                                                                )}
                                                            </strong>
                                                        </div>

                                                        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                                                            <p className="text-xs text-emerald-700">
                                                                Disponible propuesto
                                                            </p>
                                                            <strong className="block mt-1 text-emerald-800">
                                                                {formatearNumero(
                                                                    detalle.cantidadDisponiblePropuesta
                                                                )}
                                                            </strong>
                                                        </div>
                                                    </div>

                                                    {detalle.inventarioCambioDespuesCorte && (
                                                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                                            El inventario actual cambió después de la fecha de corte. Revisa los saldos antes de aplicar.
                                                        </div>
                                                    )}

                                                    {detalle.motivoBloqueo && (
                                                        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                                                            <strong>
                                                                Motivo:
                                                            </strong>{" "}
                                                            {
                                                                detalle.motivoBloqueo
                                                            }
                                                        </div>
                                                    )}
                                                </article>
                                            )
                                        )
                                    )}
                                </div>
                            </>
                        ) : pestana ===
                          "DOCUMENTOS" ? (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {documentos.length ===
                                0 ? (
                                    <div className="xl:col-span-2 min-h-56 flex items-center justify-center text-slate-500">
                                        Aún no se han generado documentos de ajuste.
                                    </div>
                                ) : (
                                    documentos.map(
                                        (documento) => (
                                            <article
                                                key={
                                                    documento.idSolicitudConteo
                                                }
                                                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                                            >
                                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                                    <div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="font-mono text-xs font-bold text-violet-700 bg-violet-50 border border-violet-100 px-2.5 py-1 rounded-lg">
                                                                {documento.consecutivo ||
                                                                    "SIN DOCUMENTO"}
                                                            </span>

                                                            <span
                                                                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${claseEstado(
                                                                    documento.estadoDocumento ||
                                                                        (documento.ajusteGenerado
                                                                            ? "FINALIZADA"
                                                                            : "PENDIENTE")
                                                                )}`}
                                                            >
                                                                {documento.ajusteGenerado
                                                                    ? textoEstado(
                                                                          documento.estadoDocumento ||
                                                                              "PROCESADO"
                                                                      )
                                                                    : "PENDIENTE"}
                                                            </span>
                                                        </div>

                                                        <h3 className="mt-3 text-lg font-bold text-slate-900">
                                                            {
                                                                documento.bodega
                                                            }
                                                        </h3>

                                                        <p className="mt-1 text-sm text-slate-500">
                                                            {documento.tipoDocumento ||
                                                                "Sin documento generado"}
                                                        </p>
                                                    </div>

                                                    <div className="text-right">
                                                        <p className="text-xs text-slate-500">
                                                            Fecha
                                                        </p>
                                                        <p className="text-sm font-semibold text-slate-800">
                                                            {formatearFechaHora(
                                                                documento.fechaFinalizacion ||
                                                                    documento.fechaDocumento
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                                                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                                        <p className="text-xs text-slate-500">
                                                            Detalles
                                                        </p>
                                                        <strong className="block mt-1 text-slate-900">
                                                            {formatearNumero(
                                                                documento.totalDetallesDocumento
                                                            )}
                                                        </strong>
                                                    </div>

                                                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                                        <p className="text-xs text-slate-500">
                                                            Movimientos
                                                        </p>
                                                        <strong className="block mt-1 text-slate-900">
                                                            {formatearNumero(
                                                                documento.totalMovimientos
                                                            )}
                                                        </strong>
                                                    </div>

                                                    <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
                                                        <p className="text-xs text-blue-700">
                                                            Positivo
                                                        </p>
                                                        <strong className="block mt-1 text-blue-800">
                                                            {formatearNumero(
                                                                documento.totalPositivo
                                                            )}
                                                        </strong>
                                                    </div>

                                                    <div className="rounded-xl bg-rose-50 border border-rose-200 p-3">
                                                        <p className="text-xs text-rose-700">
                                                            Negativo
                                                        </p>
                                                        <strong className="block mt-1 text-rose-800">
                                                            {formatearNumero(
                                                                documento.totalNegativo
                                                            )}
                                                        </strong>
                                                    </div>
                                                </div>
                                            </article>
                                        )
                                    )
                                )}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[1200px]">
                                        <thead className="bg-slate-100 text-slate-600 text-xs uppercase">
                                            <tr>
                                                <th className="px-4 py-3 text-left">
                                                    Producto
                                                </th>
                                                <th className="px-4 py-3 text-left">
                                                    Bodega / ubicación
                                                </th>
                                                <th className="px-4 py-3 text-left">
                                                    Documento
                                                </th>
                                                <th className="px-4 py-3 text-left">
                                                    Movimiento
                                                </th>
                                                <th className="px-4 py-3 text-right">
                                                    Ajuste
                                                </th>
                                                <th className="px-4 py-3 text-right">
                                                    Saldo anterior
                                                </th>
                                                <th className="px-4 py-3 text-right">
                                                    Saldo nuevo
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody className="divide-y divide-slate-100">
                                            {movimientos.map(
                                                (movimiento) => (
                                                    <tr
                                                        key={`${movimiento.idDetalleConteo}-${movimiento.idMovimiento || "P"}`}
                                                        className="hover:bg-slate-50"
                                                    >
                                                        <td className="px-4 py-3">
                                                            <span className="block font-semibold text-slate-900">
                                                                {
                                                                    movimiento.producto
                                                                }
                                                            </span>
                                                            <span className="block text-xs font-mono text-slate-500">
                                                                {
                                                                    movimiento.codigoProducto
                                                                }{" "}
                                                                ·{" "}
                                                                {movimiento.lote ||
                                                                    "Sin lote"}
                                                            </span>
                                                        </td>

                                                        <td className="px-4 py-3">
                                                            <span className="block text-sm font-semibold text-slate-800">
                                                                {
                                                                    movimiento.bodega
                                                                }
                                                            </span>
                                                            <span className="block text-xs text-slate-500">
                                                                {movimiento.ubicacion ||
                                                                    "Sin ubicación"}
                                                            </span>
                                                        </td>

                                                        <td className="px-4 py-3 font-mono text-xs">
                                                            {
                                                                movimiento.consecutivo
                                                            }
                                                        </td>

                                                        <td className="px-4 py-3 text-sm font-semibold">
                                                            {textoEstado(
                                                                movimiento.tipoMovimiento
                                                            )}
                                                        </td>

                                                        <td className="px-4 py-3 text-right font-bold">
                                                            {formatearNumero(
                                                                movimiento.cantidadAjuste
                                                            )}
                                                        </td>

                                                        <td className="px-4 py-3 text-right">
                                                            {formatearNumero(
                                                                movimiento.saldoAnterior
                                                            )}
                                                        </td>

                                                        <td className="px-4 py-3 text-right font-bold text-emerald-700">
                                                            {formatearNumero(
                                                                movimiento.saldoNuevo
                                                            )}
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

            {modalGenerar && (
                <div className="fixed inset-0 z-50 bg-slate-950/50 p-4 flex items-center justify-center">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">
                                    Generar ajustes
                                </h2>

                                <p className="text-sm text-slate-500">
                                    Esta acción modifica las existencias
                                </p>
                            </div>

                            <button
                                type="button"
                                disabled={procesando}
                                onClick={() =>
                                    setModalGenerar(false)
                                }
                                className="h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center disabled:opacity-50"
                            >
                                <FaTimes />
                            </button>
                        </header>

                        <div className="p-5 space-y-4">
                            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 flex gap-3">
                                <FaExclamationTriangle className="mt-0.5 shrink-0" />

                                <p className="text-sm">
                                    Se crearán documentos y movimientos por bodega, y se actualizará la cantidad disponible. La operación se ejecutará dentro de una transacción.
                                </p>
                            </div>

                            <label className="space-y-1.5 block">
                                <span className="text-sm font-bold text-slate-700">
                                    Tipo de documento
                                </span>

                                <select
                                    value={
                                        idTipoDocumento
                                    }
                                    onChange={(event) =>
                                        setIdTipoDocumento(
                                            event.target
                                                .value
                                        )
                                    }
                                    className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white"
                                >
                                    <option value="">
                                        Seleccionar
                                    </option>

                                    {tiposDocumento.map(
                                        (tipo) => (
                                            <option
                                                key={
                                                    tipo.idTipoDocumento
                                                }
                                                value={
                                                    tipo.idTipoDocumento
                                                }
                                            >
                                                {
                                                    tipo.codigo
                                                }{" "}
                                                -{" "}
                                                {
                                                    tipo.nombre
                                                }
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label className="space-y-1.5 block">
                                <span className="text-sm font-bold text-slate-700">
                                    Observación
                                </span>

                                <textarea
                                    rows={3}
                                    value={observacion}
                                    onChange={(event) =>
                                        setObservacion(
                                            event.target
                                                .value
                                        )
                                    }
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 resize-none"
                                    placeholder="Opcional"
                                />
                            </label>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                                    <p className="text-xs text-blue-700">
                                        Sobrante
                                    </p>

                                    <strong className="block mt-1 text-blue-800">
                                        {formatearNumero(
                                            resumenPreview.cantidadSobrante
                                        )}
                                    </strong>
                                </div>

                                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                                    <p className="text-xs text-rose-700">
                                        Faltante
                                    </p>

                                    <strong className="block mt-1 text-rose-800">
                                        {formatearNumero(
                                            resumenPreview.cantidadFaltante
                                        )}
                                    </strong>
                                </div>
                            </div>
                        </div>

                        <footer className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
                            <button
                                type="button"
                                disabled={procesando}
                                onClick={() =>
                                    setModalGenerar(false)
                                }
                                className="h-10 px-4 rounded-xl border border-slate-200 bg-white font-semibold disabled:opacity-50"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                disabled={procesando}
                                onClick={generarAjustes}
                                className="h-10 px-4 rounded-xl bg-amber-600 text-white font-semibold flex items-center gap-2 disabled:opacity-50"
                            >
                                {procesando ? (
                                    <FaSyncAlt className="animate-spin" />
                                ) : (
                                    <FaTools />
                                )}

                                Confirmar y aplicar
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </>
    );
}
