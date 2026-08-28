import {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    FaBoxes,
    FaCheckCircle,
    FaClipboardList,
    FaClock,
    FaExclamationTriangle,
    FaEye,
    FaFilter,
    FaPlay,
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
    estadoProceso: "",
};

const ESTADOS = [
    { valor: "", nombre: "Todos los estados" },
    { valor: "PENDIENTE", nombre: "Pendiente" },
    { valor: "EN_PROCESO", nombre: "En proceso" },
    { valor: "DEVUELTO", nombre: "Devuelto" },
    { valor: "ENVIADO", nombre: "Enviado" },
    { valor: "APROBADO", nombre: "Aprobado" },
    { valor: "FINALIZADO", nombre: "Finalizado" },
];

export default function ConteosAsignadosInventario({
    setSidebar,
    navegar,
}) {
    const [conteos, setConteos] = useState([]);
    const [operador, setOperador] = useState(null);
    const [resumen, setResumen] = useState({
        total: 0,
        pendientes: 0,
        enProceso: 0,
        enviados: 0,
        devueltos: 0,
        finalizados: 0,
    });

    const [filtros, setFiltros] = useState(
        FILTROS_INICIALES
    );

    const [cargando, setCargando] = useState(true);
    const [modalFiltros, setModalFiltros] =
        useState(false);

    const idUsuario = useMemo(
        () => obtenerIdUsuario(),
        []
    );

    const cargarConteos = useCallback(async () => {
        if (!idUsuario) {
            toast.error(
                "No fue posible identificar el usuario."
            );
            setCargando(false);
            return;
        }

        setCargando(true);

        try {
            const params = new URLSearchParams({
                idUsuario,
                pagina: 1,
                limite: 200,
                t: Date.now(),
            });

            if (filtros.q.trim()) {
                params.set("q", filtros.q.trim());
            }

            if (filtros.estadoProceso) {
                params.set(
                    "estadoProceso",
                    filtros.estadoProceso
                );
            }

            const respuesta = await fetch(
                `${API_BASE_CONTEOS}InventarioConteosAsignadosListar.php?${params.toString()}`,
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
                        "No fue posible consultar los conteos asignados."
                );
            }

            setConteos(
                Array.isArray(resultado?.data)
                    ? resultado.data
                    : []
            );

            setOperador(resultado?.operador || null);

            setResumen({
                total: Number(
                    resultado?.resumen?.total || 0
                ),
                pendientes: Number(
                    resultado?.resumen?.pendientes || 0
                ),
                enProceso: Number(
                    resultado?.resumen?.enProceso || 0
                ),
                enviados: Number(
                    resultado?.resumen?.enviados || 0
                ),
                devueltos: Number(
                    resultado?.resumen?.devueltos || 0
                ),
                finalizados: Number(
                    resultado?.resumen?.finalizados || 0
                ),
            });
        } catch (error) {
            console.error(
                "Error consultando conteos asignados:",
                error
            );

            setConteos([]);
            toast.error(
                error?.message ||
                    "No fue posible consultar los conteos."
            );
        } finally {
            setCargando(false);
        }
    }, [filtros, idUsuario]);

    useEffect(() => {
        const temporizador = setTimeout(() => {
            cargarConteos();
        }, 250);

        return () =>
            clearTimeout(temporizador);
    }, [cargarConteos]);

    const abrirConteo = (conteo) => {
        localStorage.setItem(
            "inventarioOrdenConteoId",
            String(conteo.idOrdenConteo)
        );

        localStorage.setItem(
            "inventarioSolicitudConteoId",
            String(conteo.idSolicitudConteo)
        );

        localStorage.setItem(
            "inventarioConteoModo",
            "OPERATIVO"
        );

        navegar("ConteoBodegaInventario");
    };

    const textoBoton = (conteo) => {
        if (conteo.puedeIniciar) {
            return "Iniciar";
        }

        if (conteo.puedeContinuar) {
            return "Continuar";
        }

        if (conteo.resultadoVisible) {
            return "Ver resultado";
        }

        return "Consultar";
    };

    const iconoBoton = (conteo) => {
        if (
            conteo.puedeIniciar ||
            conteo.puedeContinuar
        ) {
            return <FaPlay />;
        }

        return <FaEye />;
    };

    const tarjetas = [
        {
            titulo: "Asignados",
            valor: resumen.total,
            icono: FaClipboardList,
            clase:
                "bg-slate-50 text-slate-700 border-slate-200",
        },
        {
            titulo: "Pendientes",
            valor: resumen.pendientes,
            icono: FaClock,
            clase:
                "bg-blue-50 text-blue-700 border-blue-200",
        },
        {
            titulo: "En proceso",
            valor: resumen.enProceso,
            icono: FaBoxes,
            clase:
                "bg-amber-50 text-amber-700 border-amber-200",
        },
        {
            titulo: "Devueltos",
            valor: resumen.devueltos,
            icono: FaUndoAlt,
            clase:
                "bg-orange-50 text-orange-700 border-orange-200",
        },
        {
            titulo: "Enviados",
            valor: resumen.enviados,
            icono: FaEye,
            clase:
                "bg-violet-50 text-violet-700 border-violet-200",
        },
        {
            titulo: "Finalizados",
            valor: resumen.finalizados,
            icono: FaCheckCircle,
            clase:
                "bg-emerald-50 text-emerald-700 border-emerald-200",
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
                                    className="lg:hidden h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center shrink-0"
                                >
                                    <IoMenu size={23} />
                                </button>

                                <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-800 border border-blue-100 flex items-center justify-center shrink-0">
                                    <FaClipboardList size={20} />
                                </div>

                                <div className="min-w-0">
                                    <p className="text-xs uppercase tracking-wider font-semibold text-slate-500">
                                        Operación de inventarios
                                    </p>

                                    <h1 className="text-xl md:text-2xl font-bold text-slate-900">
                                        Mis conteos asignados
                                    </h1>

                                    <p className="text-sm text-slate-500 truncate">
                                        {operador?.nombreCompleto ||
                                            "Responsable de bodega"}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setModalFiltros(true)
                                    }
                                    className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold flex items-center gap-2"
                                >
                                    <FaFilter />
                                    Filtros
                                </button>

                                <button
                                    type="button"
                                    onClick={cargarConteos}
                                    disabled={cargando}
                                    className="h-10 w-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center disabled:opacity-50"
                                >
                                    <FaSyncAlt
                                        className={
                                            cargando
                                                ? "animate-spin"
                                                : ""
                                        }
                                    />
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
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs uppercase tracking-wide font-bold">
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
                                placeholder="Buscar orden o bodega..."
                                className="w-full h-11 pl-11 pr-4 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-200"
                            />
                        </div>
                    </div>

                    <section className="flex-1 overflow-auto p-4 md:p-5 bg-slate-50/60">
                        {cargando ? (
                            <div className="min-h-64 flex flex-col items-center justify-center text-slate-500">
                                <FaSyncAlt className="animate-spin text-3xl mb-3" />
                                <p className="font-semibold">
                                    Consultando asignaciones...
                                </p>
                            </div>
                        ) : conteos.length === 0 ? (
                            <div className="min-h-64 flex flex-col items-center justify-center text-center">
                                <div className="h-16 w-16 rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center">
                                    <FaWarehouse size={28} />
                                </div>

                                <h2 className="mt-4 text-lg font-bold text-slate-800">
                                    No tienes conteos disponibles
                                </h2>

                                <p className="mt-1 text-sm text-slate-500 max-w-md">
                                    No hay asignaciones que coincidan con los filtros seleccionados.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {conteos.map((conteo) => {
                                    const porcentaje =
                                        Number(
                                            conteo.porcentajeAvance ||
                                                0
                                        );

                                    return (
                                        <article
                                            key={
                                                conteo.idSolicitudConteo
                                            }
                                            className={`rounded-2xl border bg-white p-5 shadow-sm ${
                                                conteo.estadoProceso ===
                                                "DEVUELTO"
                                                    ? "border-orange-300"
                                                    : "border-slate-200"
                                            }`}
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="font-mono text-xs font-bold text-blue-800 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">
                                                            {
                                                                conteo.codigoOrden
                                                            }
                                                        </span>

                                                        <span
                                                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${claseEstado(
                                                                conteo.estadoProceso
                                                            )}`}
                                                        >
                                                            {textoEstado(
                                                                conteo.estadoProceso
                                                            )}
                                                        </span>

                                                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
                                                            {
                                                                conteo.tipoConteo
                                                            }
                                                        </span>
                                                    </div>

                                                    <h2 className="mt-3 text-lg font-bold text-slate-900">
                                                        {
                                                            conteo.nombreOrden
                                                        }
                                                    </h2>

                                                    <p className="mt-2 text-sm text-slate-600 flex items-center gap-2">
                                                        <FaWarehouse className="text-slate-400" />
                                                        <strong>
                                                            {
                                                                conteo.bodega
                                                            }
                                                        </strong>
                                                    </p>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        abrirConteo(
                                                            conteo
                                                        )
                                                    }
                                                    className={`h-10 px-4 rounded-xl text-white font-semibold flex items-center justify-center gap-2 shrink-0 ${
                                                        conteo.puedeIniciar ||
                                                        conteo.puedeContinuar
                                                            ? "bg-blue-800 hover:bg-blue-900"
                                                            : "bg-slate-900 hover:bg-slate-800"
                                                    }`}
                                                >
                                                    {iconoBoton(
                                                        conteo
                                                    )}
                                                    {textoBoton(
                                                        conteo
                                                    )}
                                                </button>
                                            </div>

                                            {conteo.estadoProceso ===
                                                "DEVUELTO" &&
                                                conteo.observacionRevision && (
                                                    <div className="mt-4 flex gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-orange-800">
                                                        <FaExclamationTriangle className="mt-0.5 shrink-0" />

                                                        <p className="text-sm">
                                                            <strong>
                                                                Corrección solicitada:
                                                            </strong>{" "}
                                                            {
                                                                conteo.observacionRevision
                                                            }
                                                        </p>
                                                    </div>
                                                )}

                                            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
                                                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                                    <p className="text-[11px] uppercase font-bold text-slate-500">
                                                        Inicio
                                                    </p>
                                                    <p className="mt-1 text-xs font-semibold text-slate-800">
                                                        {formatearFechaHora(
                                                            conteo.fechaInicio
                                                        )}
                                                    </p>
                                                </div>

                                                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                                    <p className="text-[11px] uppercase font-bold text-slate-500">
                                                        Límite
                                                    </p>
                                                    <p className="mt-1 text-xs font-semibold text-slate-800">
                                                        {formatearFechaHora(
                                                            conteo.fechaLimite
                                                        )}
                                                    </p>
                                                </div>

                                                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                                    <p className="text-[11px] uppercase font-bold text-slate-500">
                                                        Contados
                                                    </p>
                                                    <p className="mt-1 text-lg font-black text-slate-900">
                                                        {formatearNumero(
                                                            conteo.totalContados
                                                        )}
                                                    </p>
                                                </div>

                                                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                                    <p className="text-[11px] uppercase font-bold text-slate-500">
                                                        Pendientes
                                                    </p>
                                                    <p className="mt-1 text-lg font-black text-slate-900">
                                                        {formatearNumero(
                                                            conteo.totalPendientes
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-4">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="font-semibold text-slate-600">
                                                        Avance
                                                    </span>

                                                    <strong className="text-blue-800">
                                                        {porcentaje.toFixed(
                                                            0
                                                        )}
                                                        %
                                                    </strong>
                                                </div>

                                                <div className="mt-2 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-blue-800"
                                                        style={{
                                                            width: `${Math.min(
                                                                100,
                                                                porcentaje
                                                            )}%`,
                                                        }}
                                                    />
                                                </div>
                                            </div>

                                            {!conteo.dentroPeriodo &&
                                                !conteo.resultadoVisible && (
                                                    <p className="mt-3 text-xs font-semibold text-rose-600">
                                                        El conteo está fuera del periodo habilitado.
                                                    </p>
                                                )}
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </article>
            </div>

            {modalFiltros && (
                <div className="fixed inset-0 z-50 bg-slate-950/50 p-4 flex items-center justify-center">
                    <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
                        <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-900">
                                Filtrar conteos
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

                        <div className="p-5">
                            <label className="space-y-1.5 block">
                                <span className="text-sm font-bold text-slate-700">
                                    Estado
                                </span>

                                <select
                                    value={
                                        filtros.estadoProceso
                                    }
                                    onChange={(event) =>
                                        setFiltros((prev) => ({
                                            ...prev,
                                            estadoProceso:
                                                event.target
                                                    .value,
                                        }))
                                    }
                                    className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white"
                                >
                                    {ESTADOS.map((estado) => (
                                        <option
                                            key={
                                                estado.valor ||
                                                "TODOS"
                                            }
                                            value={
                                                estado.valor
                                            }
                                        >
                                            {estado.nombre}
                                        </option>
                                    ))}
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
                                className="h-10 px-4 rounded-xl bg-blue-800 text-white font-semibold"
                            >
                                Aplicar
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </>
    );
}
