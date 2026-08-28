import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import {
    FaArrowRotateRight,
    FaBoxesStacked,
    FaCircleCheck,
    FaClock,
    FaEye,
    FaMagnifyingGlass,
    FaUserGear,
} from "react-icons/fa6";
import { toast } from "react-toastify";
import {
    ENDPOINTS_ORDENES_ALISTAMIENTO,
    FILTROS_ORDENES_INICIALES,
    formatearFechaHora,
    formatearNumero,
    guardarOrdenSeleccionada,
    obtenerCodigoOrden,
    obtenerEstadoLogistica,
    obtenerEstadoOrden,
    obtenerIdUsuario,
    obtenerListaOrdenes,
    obtenerNombreOperador,
    obtenerResumenDesdeOrdenes,
    obtenerResumenOrdenes,
    solicitarOrdenesJson,
} from "./ordenesAlistamientoHelpers";
import {
    BotonFiltrosOrdenes,
    EstadoCargaOrdenes,
    EstadoLogisticaBadge,
    EstadoOrdenBadge,
    EstadoVacioOrdenes,
    ModalFiltrosOrdenes,
    PaginaOrdenesAlistamiento,
    TarjetasResumenOrdenes,
} from "./OrdenesAlistamientoUI";

const obtenerCodigoDespacho = (orden) =>
    orden?.codigoDespacho ||
    orden?.despachoCodigo ||
    orden?.codigoDespachoInforme ||
    (orden?.idDespacho || orden?.idDespachoInforme
        ? `Despacho #${orden?.idDespacho || orden?.idDespachoInforme}`
        : "Sin despacho");

const obtenerFechaOrden = (orden) =>
    orden?.fechaCreacion ||
    orden?.fechaRegistro ||
    orden?.created_at ||
    orden?.fechaOrden ||
    "";

const obtenerTotalProductos = (orden) =>
    Number(
        orden?.totalProductos ||
        orden?.cantidadProductos ||
        orden?.resumen?.totalProductos ||
        0
    );

const obtenerTotalSolicitado = (orden) =>
    Number(
        orden?.totalSolicitado ||
        orden?.cantidadSolicitada ||
        orden?.resumen?.totalSolicitado ||
        orden?.resumen?.totalCantidad ||
        0
    );

export default function OrdenesAlistamientoInventario({
    setSidebar,
    navegar,
}) {
    const [ordenes, setOrdenes] = useState([]);
    const [estados, setEstados] = useState([]);
    const [resumenServicio, setResumenServicio] = useState({});
    const [filtros, setFiltros] = useState(
        FILTROS_ORDENES_INICIALES
    );
    const [modalFiltros, setModalFiltros] = useState(false);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [versionConsulta, setVersionConsulta] = useState(0);
    const [pagina, setPagina] = useState(1);
    const [paginacion, setPaginacion] = useState({
        pagina: 1,
        totalPaginas: 0,
        total: 0,
    });

    const idUsuario = useMemo(() => obtenerIdUsuario(), []);

    const filtrosActivos = useMemo(
        () =>
            Object.entries(filtros).filter(
                ([campo, valor]) =>
                    campo !== "q" && String(valor || "").trim()
            ).length,
        [filtros]
    );

    const cargarFormData = useCallback(async (signal) => {
        try {
            const resultado = await solicitarOrdenesJson(
                ENDPOINTS_ORDENES_ALISTAMIENTO.formData,
                {
                    params: {
                        idUsuario,
                        t: Date.now(),
                    },
                    signal,
                }
            );

            const data = resultado?.data || {};
            setEstados(
                Array.isArray(data?.estadosOrden)
                    ? data.estadosOrden
                    : Array.isArray(data?.estados)
                      ? data.estados
                      : []
            );
        } catch (errorCarga) {
            if (errorCarga?.name !== "AbortError") {
                console.error(
                    "Error cargando filtros de órdenes:",
                    errorCarga
                );
            }
        }
    }, [idUsuario]);

    useEffect(() => {
        const controlador = new AbortController();
        cargarFormData(controlador.signal);
        return () => controlador.abort();
    }, [cargarFormData]);

    useEffect(() => {
        const controlador = new AbortController();
        const temporizador = setTimeout(async () => {
            if (!idUsuario) {
                setError("No fue posible identificar el usuario de la sesión.");
                setCargando(false);
                return;
            }

            setCargando(true);
            setError("");

            try {
                const resultado = await solicitarOrdenesJson(
                    ENDPOINTS_ORDENES_ALISTAMIENTO.listar,
                    {
                        params: {
                            idUsuario,
                            pagina,
                            limite: 50,
                            ...filtros,
                            t: Date.now(),
                        },
                        signal: controlador.signal,
                    }
                );

                setOrdenes(obtenerListaOrdenes(resultado));
                setResumenServicio(obtenerResumenOrdenes(resultado));
                setPaginacion(
                    resultado?.data?.paginacion || {
                        pagina,
                        totalPaginas: 0,
                        total: 0,
                    }
                );
            } catch (errorConsulta) {
                if (errorConsulta?.name === "AbortError") return;

                console.error(
                    "Error consultando órdenes de alistamiento:",
                    errorConsulta
                );
                setOrdenes([]);
                setResumenServicio({});
                setPaginacion({ pagina, totalPaginas: 0, total: 0 });
                setError(
                    errorConsulta?.message ||
                    "No fue posible consultar las órdenes de alistamiento."
                );
            } finally {
                if (!controlador.signal.aborted) setCargando(false);
            }
        }, 250);

        return () => {
            clearTimeout(temporizador);
            controlador.abort();
        };
    }, [filtros, idUsuario, pagina, versionConsulta]);

    const resumenCalculado = useMemo(
        () => obtenerResumenDesdeOrdenes(ordenes),
        [ordenes]
    );

    const resumen = {
        total: Number(
            resumenServicio?.total ||
            resumenServicio?.totalOrdenes ||
            resumenCalculado.total
        ),
        pendientes: Number(
            resumenServicio?.pendientes ??
            resumenServicio?.totalPendientes ??
            (resumenServicio?.pendientesAsignacion !== undefined
                ? Number(resumenServicio?.pendientesAsignacion || 0) +
                  Number(resumenServicio?.asignadas || 0) +
                  Number(resumenServicio?.alistadasConPendientes || 0)
                : undefined) ??
            resumenCalculado.pendientes
        ),
        enProceso: Number(
            resumenServicio?.enProceso ??
            resumenServicio?.totalEnProceso ??
            resumenServicio?.enAlistamiento ??
            resumenCalculado.enProceso
        ),
        finalizadas: Number(
            resumenServicio?.finalizadas ??
            resumenServicio?.totalFinalizadas ??
            resumenServicio?.alistadasCompletas ??
            resumenCalculado.finalizadas
        ),
    };

    const abrirDetalle = (orden) => {
        if (!guardarOrdenSeleccionada(orden)) {
            toast.error("La orden seleccionada no tiene un identificador válido.");
            return;
        }

        navegar("DetalleOrdenAlistamientoInventario");
    };

    const cambiarFiltro = (campo, valor) => {
        setPagina(1);
        setFiltros((actual) => ({
            ...actual,
            [campo]: valor,
        }));
    };

    const tarjetas = [
        {
            titulo: "Órdenes",
            valor: resumen.total,
            icono: FaBoxesStacked,
            clase: "bg-slate-50 border-slate-200 text-slate-700",
        },
        {
            titulo: "Pendientes",
            valor: resumen.pendientes,
            icono: FaClock,
            clase: "bg-orange-50 border-orange-200 text-orange-700",
        },
        {
            titulo: "En proceso",
            valor: resumen.enProceso,
            icono: FaUserGear,
            clase: "bg-amber-50 border-amber-200 text-amber-700",
        },
        {
            titulo: "Finalizadas",
            valor: resumen.finalizadas,
            icono: FaCircleCheck,
            clase: "bg-emerald-50 border-emerald-200 text-emerald-700",
        },
    ];

    return (
        <>
            <PaginaOrdenesAlistamiento
                setSidebar={setSidebar}
                titulo="Órdenes de alistamiento"
                descripcion="Consulta, asigna y envía a logística las órdenes generadas desde el consolidado del despacho."
                acciones={
                    <>
                        <button
                            type="button"
                            onClick={() =>
                                navegar("MisOrdenesAlistamientoInventario")
                            }
                            className="h-10 px-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 font-bold text-sm hover:bg-blue-100"
                        >
                            Mis órdenes
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                setVersionConsulta((valor) => valor + 1)
                            }
                            disabled={cargando}
                            className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50 disabled:opacity-60 flex items-center gap-2"
                        >
                            <FaArrowRotateRight
                                className={cargando ? "animate-spin" : ""}
                            />
                            Actualizar
                        </button>
                    </>
                }
            >
                <div className="flex flex-col gap-4 md:gap-5">
                    <TarjetasResumenOrdenes tarjetas={tarjetas} />

                    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <div className="p-4 md:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center gap-3">
                            <label className="relative flex-1">
                                <FaMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="search"
                                    value={filtros.q}
                                    onChange={(event) =>
                                        cambiarFiltro("q", event.target.value)
                                    }
                                    placeholder="Buscar por orden, despacho, contrato o responsable..."
                                    className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-300 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                                />
                            </label>

                            <BotonFiltrosOrdenes
                                cantidad={filtrosActivos}
                                onClick={() => setModalFiltros(true)}
                            />
                        </div>

                        <div className="p-4 md:p-5">
                            {cargando ? (
                                <EstadoCargaOrdenes texto="Consultando órdenes de alistamiento..." />
                            ) : error ? (
                                <div className="min-h-48 rounded-2xl border border-rose-200 bg-rose-50 p-6 flex flex-col items-center justify-center text-center">
                                    <p className="font-bold text-rose-800">
                                        No fue posible cargar las órdenes
                                    </p>
                                    <p className="mt-1 text-sm text-rose-700">
                                        {error}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setVersionConsulta(
                                                (valor) => valor + 1
                                            )
                                        }
                                        className="mt-4 h-10 px-4 rounded-xl bg-rose-700 text-white font-bold text-sm hover:bg-rose-800"
                                    >
                                        Reintentar
                                    </button>
                                </div>
                            ) : ordenes.length === 0 ? (
                                <EstadoVacioOrdenes />
                            ) : (
                                <>
                                    <div className="hidden xl:block overflow-x-auto rounded-xl border border-slate-200">
                                        <table className="w-full min-w-[1100px] text-sm">
                                            <thead className="bg-slate-100 text-slate-700">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">Orden</th>
                                                    <th className="px-4 py-3 text-left">Despacho</th>
                                                    <th className="px-4 py-3 text-left">Responsable</th>
                                                    <th className="px-4 py-3 text-right">Productos</th>
                                                    <th className="px-4 py-3 text-right">Solicitado</th>
                                                    <th className="px-4 py-3 text-left">Estado</th>
                                                    <th className="px-4 py-3 text-left">Logística</th>
                                                    <th className="px-4 py-3 text-left">Registro</th>
                                                    <th className="px-4 py-3 text-right">Acción</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {ordenes.map((orden) => (
                                                    <tr
                                                        key={obtenerCodigoOrden(orden)}
                                                        className="border-t border-slate-100 hover:bg-slate-50"
                                                    >
                                                        <td className="px-4 py-3 font-bold text-slate-800">
                                                            {obtenerCodigoOrden(orden)}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <p className="font-semibold text-slate-700">
                                                                {obtenerCodigoDespacho(orden)}
                                                            </p>
                                                            <p className="text-xs text-slate-500 max-w-56 truncate">
                                                                {orden?.despacho?.contrato ||
                                                                    orden?.contrato ||
                                                                    orden?.despacho?.descripcion ||
                                                                    orden?.descripcionDespacho ||
                                                                    "Sin contrato"}
                                                            </p>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            {obtenerNombreOperador(orden)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            {formatearNumero(
                                                                obtenerTotalProductos(orden)
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-semibold">
                                                            {formatearNumero(
                                                                obtenerTotalSolicitado(orden)
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <EstadoOrdenBadge
                                                                estado={obtenerEstadoOrden(orden)}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <EstadoLogisticaBadge
                                                                estado={obtenerEstadoLogistica(orden)}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600">
                                                            {formatearFechaHora(
                                                                obtenerFechaOrden(orden)
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <button
                                                                type="button"
                                                                onClick={() => abrirDetalle(orden)}
                                                                className="h-9 px-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 font-bold hover:bg-blue-100 inline-flex items-center gap-2"
                                                            >
                                                                <FaEye /> Ver
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 xl:hidden">
                                        {ordenes.map((orden) => (
                                            <article
                                                key={obtenerCodigoOrden(orden)}
                                                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <h3 className="font-black text-slate-800 truncate">
                                                            {obtenerCodigoOrden(orden)}
                                                        </h3>
                                                        <p className="mt-1 text-sm text-slate-500 truncate">
                                                            {obtenerCodigoDespacho(orden)}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1.5">
                                                        <EstadoOrdenBadge
                                                            estado={obtenerEstadoOrden(orden)}
                                                        />
                                                        <EstadoLogisticaBadge
                                                            estado={obtenerEstadoLogistica(orden)}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                                                    <div className="rounded-xl bg-slate-50 p-3">
                                                        <p className="text-xs text-slate-500">Productos</p>
                                                        <p className="mt-1 font-black text-slate-800">
                                                            {formatearNumero(
                                                                obtenerTotalProductos(orden)
                                                            )}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-xl bg-slate-50 p-3">
                                                        <p className="text-xs text-slate-500">Solicitado</p>
                                                        <p className="mt-1 font-black text-slate-800">
                                                            {formatearNumero(
                                                                obtenerTotalSolicitado(orden)
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="mt-3 text-sm text-slate-600">
                                                    <p>
                                                        <span className="font-semibold">Responsable:</span>{" "}
                                                        {obtenerNombreOperador(orden)}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {formatearFechaHora(
                                                            obtenerFechaOrden(orden)
                                                        )}
                                                    </p>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => abrirDetalle(orden)}
                                                    className="mt-4 w-full h-10 rounded-xl bg-blue-800 text-white font-bold hover:bg-blue-900 flex items-center justify-center gap-2"
                                                >
                                                    <FaEye /> Ver detalle
                                                </button>
                                            </article>
                                        ))}
                                    </div>
                                    {Number(paginacion?.totalPaginas || 0) > 1 ? (
                                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
                                            <p className="text-sm text-slate-500">
                                                Página {Number(paginacion?.pagina || pagina)} de {Number(paginacion?.totalPaginas || 1)}
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setPagina((actual) => Math.max(actual - 1, 1))}
                                                    disabled={cargando || pagina <= 1}
                                                    className="h-10 px-4 rounded-xl border border-slate-300 bg-white font-bold text-slate-700 disabled:opacity-50"
                                                >
                                                    Anterior
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setPagina((actual) => Math.min(actual + 1, Number(paginacion?.totalPaginas || actual + 1)))}
                                                    disabled={cargando || pagina >= Number(paginacion?.totalPaginas || 0)}
                                                    className="h-10 px-4 rounded-xl bg-blue-800 text-white font-bold disabled:opacity-50"
                                                >
                                                    Siguiente
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}
                                </>
                            )}
                        </div>
                    </section>
                </div>
            </PaginaOrdenesAlistamiento>

            <ModalFiltrosOrdenes
                visible={modalFiltros}
                filtros={filtros}
                estados={estados}
                onChange={cambiarFiltro}
                onLimpiar={() => {
                    setPagina(1);
                    setFiltros(FILTROS_ORDENES_INICIALES);
                }}
                onCerrar={() => setModalFiltros(false)}
            />
        </>
    );
}
