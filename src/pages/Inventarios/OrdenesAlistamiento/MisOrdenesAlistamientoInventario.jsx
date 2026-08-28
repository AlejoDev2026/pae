import React, { useEffect, useMemo, useState } from "react";
import {
    FaArrowRotateRight,
    FaBoxesStacked,
    FaCircleCheck,
    FaClock,
    FaEye,
    FaMagnifyingGlass,
    FaPlay,
    FaUserCheck,
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

const obtenerTotales = (orden) =>
    orden?.totales || orden?.resumen || {};

const textoAccion = (orden) => {
    const capacidades = orden?.capacidades || {};
    if (capacidades?.puedeIniciar || orden?.puedeIniciar) return "Iniciar";
    if (
        capacidades?.puedeGuardarAvance ||
        orden?.puedeContinuar ||
        obtenerEstadoOrden(orden) === "EN_ALISTAMIENTO"
    ) {
        return "Continuar";
    }
    return "Consultar";
};

export default function MisOrdenesAlistamientoInventario({
    setSidebar,
    navegar,
}) {
    const [ordenes, setOrdenes] = useState([]);
    const [operador, setOperador] = useState(null);
    const [resumenServicio, setResumenServicio] = useState({});
    const [estados, setEstados] = useState([]);
    const [filtros, setFiltros] = useState(
        FILTROS_ORDENES_INICIALES
    );
    const [modalFiltros, setModalFiltros] = useState(false);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [version, setVersion] = useState(0);
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

    useEffect(() => {
        const controlador = new AbortController();

        solicitarOrdenesJson(
            ENDPOINTS_ORDENES_ALISTAMIENTO.formData,
            {
                params: { idUsuario, t: Date.now() },
                signal: controlador.signal,
            }
        )
            .then((resultado) => {
                const data = resultado?.data || {};
                setEstados(
                    Array.isArray(data?.estadosOrden)
                        ? data.estadosOrden
                        : Array.isArray(data?.estados)
                          ? data.estados
                          : []
                );
            })
            .catch((errorFormData) => {
                if (errorFormData?.name !== "AbortError") {
                    console.error(
                        "Error cargando filtros de mis órdenes:",
                        errorFormData
                    );
                }
            });

        return () => controlador.abort();
    }, [idUsuario]);

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
                    ENDPOINTS_ORDENES_ALISTAMIENTO.misOrdenes,
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
                setOperador(
                    resultado?.operador ||
                    resultado?.data?.operador ||
                    null
                );
            } catch (errorConsulta) {
                if (errorConsulta?.name === "AbortError") return;

                console.error("Error consultando mis órdenes:", errorConsulta);
                setOrdenes([]);
                setResumenServicio({});
                setPaginacion({ pagina, totalPaginas: 0, total: 0 });
                setError(
                    errorConsulta?.message ||
                    "No fue posible consultar tus órdenes de alistamiento."
                );
            } finally {
                if (!controlador.signal.aborted) setCargando(false);
            }
        }, 250);

        return () => {
            clearTimeout(temporizador);
            controlador.abort();
        };
    }, [filtros, idUsuario, pagina, version]);

    const calculado = useMemo(
        () => obtenerResumenDesdeOrdenes(ordenes),
        [ordenes]
    );
    const resumen = {
        total: Number(
            resumenServicio?.total ||
            resumenServicio?.totalOrdenes ||
            calculado.total
        ),
        pendientes: Number(
            resumenServicio?.pendientes ??
            (resumenServicio?.asignadas !== undefined
                ? Number(resumenServicio?.asignadas || 0) +
                  Number(resumenServicio?.alistadasConPendientes || 0)
                : undefined) ??
            calculado.pendientes
        ),
        enProceso: Number(
            resumenServicio?.enProceso ??
            resumenServicio?.enAlistamiento ??
            calculado.enProceso
        ),
        finalizadas: Number(
            resumenServicio?.finalizadas ??
            resumenServicio?.alistadasCompletas ??
            calculado.finalizadas
        ),
    };

    const abrirOrden = (orden) => {
        if (!guardarOrdenSeleccionada(orden)) {
            toast.error("La orden seleccionada no tiene un identificador válido.");
            return;
        }

        navegar("AlistarOrdenInventario");
    };

    const cambiarFiltro = (campo, valor) => {
        setPagina(1);
        setFiltros((actual) => ({ ...actual, [campo]: valor }));
    };

    return (
        <>
            <PaginaOrdenesAlistamiento
                setSidebar={setSidebar}
                titulo="Mis órdenes de alistamiento"
                descripcion="Inicia, continúa o consulta las órdenes asignadas a tu usuario."
                acciones={
                    <button
                        type="button"
                        onClick={() => setVersion((valor) => valor + 1)}
                        disabled={cargando}
                        className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50 disabled:opacity-60 flex items-center gap-2"
                    >
                        <FaArrowRotateRight
                            className={cargando ? "animate-spin" : ""}
                        />
                        Actualizar
                    </button>
                }
            >
                <div className="flex flex-col gap-4 md:gap-5">
                    {operador ? (
                        <section className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3">
                            <span className="h-10 w-10 rounded-xl bg-white border border-blue-200 text-blue-800 flex items-center justify-center shrink-0">
                                <FaUserCheck />
                            </span>
                            <div className="min-w-0">
                                <p className="text-xs font-bold uppercase tracking-wide text-blue-700">
                                    Operador identificado
                                </p>
                                <p className="font-black text-blue-900 truncate">
                                    {obtenerNombreOperador(operador)}
                                </p>
                            </div>
                        </section>
                    ) : null}

                    <TarjetasResumenOrdenes
                        tarjetas={[
                            {
                                titulo: "Asignadas",
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
                                icono: FaPlay,
                                clase: "bg-amber-50 border-amber-200 text-amber-700",
                            },
                            {
                                titulo: "Finalizadas",
                                valor: resumen.finalizadas,
                                icono: FaCircleCheck,
                                clase: "bg-emerald-50 border-emerald-200 text-emerald-700",
                            },
                        ]}
                    />

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
                                    placeholder="Buscar por orden, despacho o producto..."
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
                                <EstadoCargaOrdenes texto="Consultando tus órdenes..." />
                            ) : error ? (
                                <div className="min-h-48 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center flex flex-col items-center justify-center">
                                    <p className="font-black text-rose-800">
                                        No fue posible cargar tus órdenes
                                    </p>
                                    <p className="mt-2 text-sm text-rose-700">
                                        {error}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setVersion((valor) => valor + 1)}
                                        className="mt-4 h-10 px-4 rounded-xl bg-rose-700 text-white font-bold"
                                    >
                                        Reintentar
                                    </button>
                                </div>
                            ) : ordenes.length === 0 ? (
                                <EstadoVacioOrdenes
                                    titulo="No tienes órdenes asignadas"
                                    descripcion="Cuando Inventarios te asigne una orden, aparecerá en este listado."
                                />
                            ) : (
                                <>
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {ordenes.map((orden) => {
                                        const totales = obtenerTotales(orden);
                                        const accion = textoAccion(orden);
                                        const esAccionOperativa =
                                            accion !== "Consultar";

                                        return (
                                            <article
                                                key={obtenerCodigoOrden(orden)}
                                                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">
                                                            {orden?.codigoDespacho ||
                                                                orden?.despachoCodigo ||
                                                                `Despacho #${orden?.idDespacho || orden?.idDespachoInforme || "-"}`}
                                                        </p>
                                                        <h2 className="mt-1 font-black text-slate-800 truncate">
                                                            {obtenerCodigoOrden(orden)}
                                                        </h2>
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

                                                <p className="mt-2 text-sm text-slate-500 line-clamp-2">
                                                    {orden?.despacho?.contrato ||
                                                        orden?.contrato ||
                                                        orden?.despacho?.descripcion ||
                                                        orden?.descripcionDespacho ||
                                                        "Sin descripción del despacho"}
                                                </p>

                                                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                                                    <div className="rounded-xl bg-slate-50 p-2">
                                                        <p className="text-[11px] text-slate-500">Productos</p>
                                                        <p className="font-black text-slate-800">
                                                            {formatearNumero(
                                                                totales?.totalProductos ||
                                                                    orden?.totalProductos ||
                                                                    0
                                                            )}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-xl bg-slate-50 p-2">
                                                        <p className="text-[11px] text-slate-500">Solicitado</p>
                                                        <p className="font-black text-slate-800">
                                                            {formatearNumero(
                                                                totales?.cantidadSolicitada ??
                                                                    totales?.totalSolicitado ??
                                                                    totales?.totalCantidad ??
                                                                    0
                                                            )}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-xl bg-slate-50 p-2">
                                                        <p className="text-[11px] text-slate-500">Alistado</p>
                                                        <p className="font-black text-slate-800">
                                                            {formatearNumero(
                                                                totales?.cantidadAlistada ??
                                                                    totales?.totalAlistado ??
                                                                    0
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>

                                                <p className="mt-3 text-xs text-slate-500">
                                                    {formatearFechaHora(
                                                        orden?.fechaEnvioLogistica ||
                                                            orden?.fechaCreacion ||
                                                            orden?.created_at
                                                    )}
                                                </p>

                                                <button
                                                    type="button"
                                                    onClick={() => abrirOrden(orden)}
                                                    className={`mt-4 h-11 w-full rounded-xl font-bold flex items-center justify-center gap-2 ${
                                                        esAccionOperativa
                                                            ? "bg-blue-800 text-white hover:bg-blue-900"
                                                            : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                                    }`}
                                                >
                                                    {esAccionOperativa ? (
                                                        <FaPlay />
                                                    ) : (
                                                        <FaEye />
                                                    )}
                                                    {accion}
                                                </button>
                                            </article>
                                        );
                                    })}
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
