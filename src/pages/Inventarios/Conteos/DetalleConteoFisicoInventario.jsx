import { useCallback, useEffect, useMemo, useState } from "react";
import {
    FaArrowLeft,
    FaClipboardCheck,
    FaSyncAlt,
    FaWarehouse,
    FaCalendarAlt,
    FaUserCheck,
    FaCheckCircle,
    FaClock,
    FaEye,
    FaPlay,
    FaChartBar,
    FaFileExcel,
    FaTools,
    FaTimes,
    FaExclamationTriangle,
    FaHistory,
    FaBoxes,
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

export default function DetalleConteoFisicoInventario({ setSidebar, navegar }) {
    const [orden, setOrden] = useState(null);
    const [resumen, setResumen] = useState({});
    const [conteos, setConteos] = useState([]);
    const [historial, setHistorial] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [procesando, setProcesando] = useState(false);
    const [confirmar, setConfirmar] = useState(false);

    const idOrdenConteo = useMemo(
        () =>
            Number(
                localStorage.getItem("inventarioOrdenConteoId") || 0
            ),
        []
    );

    const cargarDetalle = useCallback(async () => {
        if (!idOrdenConteo) {
            toast.error("No fue posible identificar la orden.");
            navegar("ConteosFisicosInventario");
            return;
        }

        setCargando(true);

        try {
            const params = new URLSearchParams({
                idOrdenConteo,
                t: Date.now(),
            });

            const respuesta = await fetch(
                `${API_BASE_CONTEOS}InventarioOrdenesConteoDetalle.php?${params}`,
                {
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                        "Cache-Control": "no-cache",
                    },
                }
            );

            const resultado = await leerRespuesta(respuesta);

            if (!respuesta.ok || !respuestaExitosa(resultado)) {
                throw new Error(
                    resultado?.error ||
                    resultado?.mensaje ||
                    "No fue posible consultar la orden."
                );
            }

            const data = resultado?.data || {};
            setOrden(data.orden || null);
            setResumen(data.resumen || {});
            setConteos(
                Array.isArray(data.conteosBodega)
                    ? data.conteosBodega
                    : []
            );
            setHistorial(
                Array.isArray(data.historial)
                    ? data.historial
                    : []
            );
        } catch (error) {
            toast.error(error.message);
        } finally {
            setCargando(false);
        }
    }, [idOrdenConteo, navegar]);

    useEffect(() => {
        cargarDetalle();
    }, [cargarDetalle]);

    const abrirOrden = async () => {
        const idUsuario = obtenerIdUsuario();

        if (!idUsuario) {
            toast.error("No fue posible identificar el usuario.");
            return;
        }

        setProcesando(true);

        try {
            const respuesta = await fetch(
                `${API_BASE_CONTEOS}InventarioOrdenesConteoAbrir.php`,
                {
                    method: "POST",
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    body: JSON.stringify({
                        idOrdenConteo,
                        idUsuario,
                        forzarApertura: false,
                    }),
                }
            );

            const resultado = await leerRespuesta(respuesta);

            if (!respuesta.ok || !respuestaExitosa(resultado)) {
                throw new Error(
                    resultado?.error ||
                    resultado?.mensaje ||
                    "No fue posible abrir la orden."
                );
            }

            toast.success(resultado?.mensaje || "Orden abierta correctamente.");
            setConfirmar(false);
            await cargarDetalle();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setProcesando(false);
        }
    };

    const verConteo = (conteo) => {
        localStorage.setItem(
            "inventarioSolicitudConteoId",
            String(conteo.idSolicitudConteo || conteo.id)
        );
        navegar("ConteoBodegaInventario");
    };

    const irAnalisis = () => {
        navegar("AnalisisConteoFisicoInventario");
    };

    const irAjustes = () => {
        navegar("AjustesConteoFisicoInventario");
    };

    const exportarExcel = () => {
        const idUsuario = obtenerIdUsuario();

        if (!idUsuario) {
            toast.error("No fue posible identificar el usuario administrativo.");
            return;
        }

        if (orden?.estadoProceso !== "FINALIZADA") {
            toast.info("La exportación estará disponible al finalizar el análisis.");
            return;
        }

        const params = new URLSearchParams({
            idOrdenConteo,
            idUsuario,
            t: Date.now(),
        });

        window.open(
            `${API_BASE_CONTEOS}InventarioOrdenesConteoExportarExcel.php?${params}`,
            "_blank",
            "noopener,noreferrer"
        );
    };

    const puedeAbrir = ["BORRADOR", "PROGRAMADA"].includes(
        orden?.estadoProceso
    );
    const puedeAnalizar = ["EN_ANALISIS", "FINALIZADA"].includes(
        orden?.estadoProceso
    );
    const finalizada = orden?.estadoProceso === "FINALIZADA";
    const porcentajeGeneral = Number(
        resumen?.porcentajeAvanceGeneral || 0
    );

    const tarjetas = [
        ["Bodegas", resumen.totalBodegas, FaWarehouse, "bg-slate-50 text-slate-700 border-slate-200"],
        ["Pendientes", resumen.pendientes, FaClock, "bg-slate-50 text-slate-700 border-slate-200"],
        ["En proceso", resumen.enProceso, FaBoxes, "bg-amber-50 text-amber-700 border-amber-200"],
        ["Enviados", resumen.enviados, FaUserCheck, "bg-violet-50 text-violet-700 border-violet-200"],
        ["Con diferencia", resumen.totalConDiferencia, FaExclamationTriangle, "bg-rose-50 text-rose-700 border-rose-200"],
        ["Finalizados", resumen.finalizados, FaCheckCircle, "bg-emerald-50 text-emerald-700 border-emerald-200"],
    ];

    return (
        <>
            <div className="w-full h-screen flex flex-col p-2 md:p-4 gap-4 bg-slate-100">
                <article className="flex-1 bg-white shadow-lg rounded-2xl flex flex-col overflow-hidden border border-slate-200">
                    <header className="px-4 py-3 md:px-5 border-b border-slate-200">
                        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <button
                                    type="button"
                                    onClick={() => setSidebar(true)}
                                    className="lg:hidden h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center"
                                >
                                    <IoMenu size={23} />
                                </button>

                                <button
                                    type="button"
                                    onClick={() => navegar("ConteosFisicosInventario")}
                                    className="h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center"
                                >
                                    <FaArrowLeft />
                                </button>

                                <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center border border-blue-100">
                                    <FaClipboardCheck size={20} />
                                </div>

                                <div className="min-w-0">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        Detalle de orden
                                    </p>
                                    <h1 className="text-xl md:text-2xl font-bold text-slate-900 truncate">
                                        {orden?.nombre || "Conteo físico"}
                                    </h1>
                                    <p className="text-sm text-slate-500">
                                        {orden?.codigo || "Consultando..."}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={cargarDetalle}
                                    className="h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center"
                                >
                                    <FaSyncAlt className={cargando ? "animate-spin" : ""} />
                                </button>

                                {puedeAbrir && (
                                    <button
                                        type="button"
                                        onClick={() => setConfirmar(true)}
                                        className="h-10 px-4 rounded-xl bg-blue-800 text-white font-semibold flex items-center gap-2"
                                    >
                                        <FaPlay />
                                        Abrir orden
                                    </button>
                                )}

                                {puedeAnalizar && (
                                    <button
                                        type="button"
                                        onClick={irAnalisis}
                                        className="h-10 px-4 rounded-xl bg-violet-700 text-white font-semibold flex items-center gap-2"
                                    >
                                        <FaChartBar />
                                        Análisis
                                    </button>
                                )}

                                {finalizada && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={exportarExcel}
                                            className="h-10 px-4 rounded-xl bg-emerald-700 text-white font-semibold flex items-center gap-2"
                                        >
                                            <FaFileExcel />
                                            Exportar Excel
                                        </button>

                                        <button
                                            type="button"
                                            onClick={irAjustes}
                                            className="h-10 px-4 rounded-xl bg-amber-600 text-white font-semibold flex items-center gap-2"
                                        >
                                            <FaTools />
                                            Ajustes
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </header>

                    <section className="flex-1 overflow-auto p-4 md:p-5 bg-slate-50/60">
                        {cargando ? (
                            <div className="min-h-64 flex flex-col items-center justify-center text-slate-500">
                                <FaSyncAlt className="animate-spin text-3xl mb-3" />
                                Consultando orden...
                            </div>
                        ) : !orden ? (
                            <div className="min-h-64 flex items-center justify-center text-slate-500">
                                No fue posible cargar la orden.
                            </div>
                        ) : (
                            <div className="max-w-7xl mx-auto space-y-5">
                                <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
                                    <div className="flex flex-col lg:flex-row lg:justify-between gap-4">
                                        <div>
                                            <div className="flex flex-wrap gap-2">
                                                <span className={`text-xs font-bold border rounded-full px-3 py-1.5 ${claseEstado(orden.estadoProceso)}`}>
                                                    {textoEstado(orden.estadoProceso)}
                                                </span>
                                                <span className="text-xs font-bold border border-slate-200 rounded-full px-3 py-1.5 bg-slate-50">
                                                    {orden.tipoConteo}
                                                </span>
                                                {Number(orden.mostrarResultadoBodegas || 0) === 1 && (
                                                    <span className="text-xs font-bold border border-emerald-200 rounded-full px-3 py-1.5 bg-emerald-50 text-emerald-700">
                                                        Resultados publicados
                                                    </span>
                                                )}
                                            </div>

                                            <p className="mt-3 text-sm text-slate-600">
                                                {orden.descripcion || "Sin descripción"}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:min-w-[600px]">
                                            <div className="rounded-xl bg-slate-50 border p-3">
                                                <p className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
                                                    <FaCalendarAlt /> Corte
                                                </p>
                                                <p className="mt-1 text-sm font-semibold">
                                                    {formatearFechaHora(orden.fechaCorte)}
                                                </p>
                                            </div>
                                            <div className="rounded-xl bg-slate-50 border p-3">
                                                <p className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
                                                    <FaPlay /> Inicio
                                                </p>
                                                <p className="mt-1 text-sm font-semibold">
                                                    {formatearFechaHora(orden.fechaInicio)}
                                                </p>
                                            </div>
                                            <div className="rounded-xl bg-slate-50 border p-3">
                                                <p className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
                                                    <FaClock /> Límite
                                                </p>
                                                <p className="mt-1 text-sm font-semibold">
                                                    {formatearFechaHora(orden.fechaLimite)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                                    {tarjetas.map(([titulo, valor, Icono, clase]) => (
                                        <div key={titulo} className={`rounded-2xl border p-4 ${clase}`}>
                                            <div className="flex justify-between text-xs font-bold uppercase">
                                                <span>{titulo}</span>
                                                <Icono />
                                            </div>
                                            <p className="mt-3 text-3xl font-black">
                                                {formatearNumero(valor)}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
                                    <div className="flex justify-between gap-3">
                                        <div>
                                            <h2 className="font-bold text-slate-900">
                                                Avance general
                                            </h2>
                                            <p className="text-sm text-slate-500">
                                                {formatearNumero(resumen.totalContados)} de{" "}
                                                {formatearNumero(resumen.totalProductos)} productos
                                            </p>
                                        </div>
                                        <strong className="text-2xl text-blue-800">
                                            {porcentajeGeneral.toFixed(0)}%
                                        </strong>
                                    </div>

                                    <div className="mt-3 h-3 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-blue-800 rounded-full"
                                            style={{ width: `${Math.min(100, porcentajeGeneral)}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                                    <header className="px-5 py-4 border-b">
                                        <h2 className="font-bold text-slate-900">
                                            Conteos por bodega
                                        </h2>
                                        <p className="text-sm text-slate-500">
                                            Estado, responsables y avance individual
                                        </p>
                                    </header>

                                    <div className="p-4 md:p-5 grid grid-cols-1 xl:grid-cols-2 gap-4">
                                        {conteos.map((conteo) => {
                                            const avance = conteo.avance || {};
                                            const porcentaje = Number(avance.porcentaje || 0);

                                            return (
                                                <article
                                                    key={conteo.idSolicitudConteo || conteo.id}
                                                    className="rounded-2xl border border-slate-200 p-5"
                                                >
                                                    <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
                                                        <div>
                                                            <div className="flex flex-wrap gap-2">
                                                                <span className="font-mono text-xs font-bold text-blue-800 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">
                                                                    {conteo.codigoBodega}
                                                                </span>
                                                                <span className={`text-xs font-bold border rounded-full px-2.5 py-1 ${claseEstado(conteo.estadoProceso)}`}>
                                                                    {textoEstado(conteo.estadoProceso)}
                                                                </span>
                                                            </div>
                                                            <h3 className="mt-3 text-lg font-bold">
                                                                {conteo.bodega}
                                                            </h3>
                                                            <p className="mt-1 text-sm text-slate-500">
                                                                Principal:{" "}
                                                                <strong>{conteo.operadorPrincipal || "Sin asignar"}</strong>
                                                            </p>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() => verConteo(conteo)}
                                                            className="h-10 px-4 rounded-xl border border-slate-200 font-semibold flex items-center justify-center gap-2"
                                                        >
                                                            <FaEye />
                                                            Ver conteo
                                                        </button>
                                                    </div>

                                                    <div className="mt-4 flex justify-between text-sm">
                                                        <span className="font-semibold text-slate-600">
                                                            {avance.totalContados || 0} de {avance.totalProductos || 0}
                                                        </span>
                                                        <strong>{porcentaje.toFixed(0)}%</strong>
                                                    </div>

                                                    <div className="mt-2 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-blue-800 rounded-full"
                                                            style={{ width: `${Math.min(100, porcentaje)}%` }}
                                                        />
                                                    </div>

                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                        {(conteo.responsables || []).map((responsable) => (
                                                            <span
                                                                key={responsable.idResponsableConteo || responsable.id}
                                                                className="text-xs font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full"
                                                            >
                                                                {responsable.nombreCompleto}
                                                                {Number(responsable.esPrincipal) === 1 && " · Principal"}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                                    <header className="px-5 py-4 border-b flex items-center gap-3">
                                        <FaHistory />
                                        <div>
                                            <h2 className="font-bold text-slate-900">Historial</h2>
                                            <p className="text-sm text-slate-500">Últimos cambios</p>
                                        </div>
                                    </header>

                                    <div className="divide-y">
                                        {historial.length === 0 ? (
                                            <p className="p-5 text-sm text-slate-500">
                                                No hay eventos registrados.
                                            </p>
                                        ) : (
                                            historial.slice(0, 10).map((evento) => (
                                                <div
                                                    key={evento.idHistorial || evento.id}
                                                    className="p-4 md:px-5"
                                                >
                                                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                                                        <p className="font-semibold text-slate-800">
                                                            {evento.descripcion || textoEstado(evento.accion)}
                                                        </p>
                                                        <span className="text-xs text-slate-500">
                                                            {formatearFechaHora(evento.created_at)}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-sm text-slate-500">
                                                        {evento.usuario || evento.operador || "Sistema"}
                                                    </p>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                </article>
            </div>

            {confirmar && (
                <div className="fixed inset-0 z-50 bg-slate-950/50 p-4 flex items-center justify-center">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
                        <header className="px-5 py-4 border-b flex items-center justify-between">
                            <h2 className="text-lg font-bold">Abrir orden de conteo</h2>
                            <button
                                type="button"
                                onClick={() => !procesando && setConfirmar(false)}
                                className="h-10 w-10 rounded-xl border flex items-center justify-center"
                            >
                                <FaTimes />
                            </button>
                        </header>

                        <div className="p-5">
                            <div className="flex gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4 text-amber-800">
                                <FaExclamationTriangle className="mt-0.5 shrink-0" />
                                <p className="text-sm">
                                    Al abrir la orden se generará la fotografía del inventario para cada bodega. Realiza esta acción cuando el inventario esté listo para el corte.
                                </p>
                            </div>
                        </div>

                        <footer className="p-5 border-t bg-slate-50 flex justify-end gap-2">
                            <button
                                type="button"
                                disabled={procesando}
                                onClick={() => setConfirmar(false)}
                                className="h-10 px-4 rounded-xl border bg-white font-semibold"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={procesando}
                                onClick={abrirOrden}
                                className="h-10 px-4 rounded-xl bg-blue-800 text-white font-semibold flex items-center gap-2 disabled:opacity-50"
                            >
                                {procesando ? (
                                    <FaSyncAlt className="animate-spin" />
                                ) : (
                                    <FaPlay />
                                )}
                                Confirmar apertura
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </>
    );
}
