import { useCallback, useEffect, useMemo, useState } from "react";
import {
    FaClipboardCheck,
    FaPlus,
    FaSearch,
    FaFilter,
    FaSyncAlt,
    FaClock,
    FaCheckCircle,
    FaChartBar,
    FaEye,
    FaTimes,
    FaCalendarAlt,
    FaBoxes,
} from "react-icons/fa";
import { IoMenu } from "react-icons/io5";
import { toast } from "react-toastify";
import {
    API_BASE_CONTEOS,
    claseEstado,
    formatearFechaHora,
    leerRespuesta,
    respuestaExitosa,
    textoEstado,
} from "./conteosFisicosHelpers";

const FILTROS_INICIALES = {
    q: "",
    estadoProceso: "",
    tipoConteo: "",
    idBodega: "",
    fechaDesde: "",
    fechaHasta: "",
};

export default function ConteosFisicosInventario({ setSidebar, navegar }) {
    const [ordenes, setOrdenes] = useState([]);
    const [bodegas, setBodegas] = useState([]);
    const [estados, setEstados] = useState([]);
    const [tipos, setTipos] = useState([]);
    const [filtros, setFiltros] = useState(FILTROS_INICIALES);
    const [cargando, setCargando] = useState(true);
    const [modalFiltros, setModalFiltros] = useState(false);

    const filtrosActivos = useMemo(
        () =>
            Object.entries(filtros).filter(
                ([campo, valor]) =>
                    campo !== "q" && String(valor || "").trim()
            ).length,
        [filtros]
    );

    const cargarFormData = useCallback(async () => {
        try {
            const respuesta = await fetch(
                `${API_BASE_CONTEOS}InventarioOrdenesConteoFormData.php?t=${Date.now()}`,
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
                    "No fue posible cargar los filtros."
                );
            }

            const data = resultado?.data || {};
            setBodegas(Array.isArray(data.bodegas) ? data.bodegas : []);
            setEstados(Array.isArray(data.estadosOrden) ? data.estadosOrden : []);
            setTipos(Array.isArray(data.tiposConteo) ? data.tiposConteo : []);
        } catch (error) {
            toast.error(error.message);
        }
    }, []);

    const cargarOrdenes = useCallback(async () => {
        setCargando(true);

        try {
            const params = new URLSearchParams({
                t: Date.now(),
                pagina: 1,
                limite: 200,
            });

            Object.entries(filtros).forEach(([campo, valor]) => {
                if (String(valor || "").trim()) {
                    params.set(campo, String(valor).trim());
                }
            });

            const respuesta = await fetch(
                `${API_BASE_CONTEOS}InventarioOrdenesConteoListar.php?${params}`,
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
                    "No fue posible consultar las órdenes."
                );
            }

            setOrdenes(Array.isArray(resultado.data) ? resultado.data : []);
        } catch (error) {
            setOrdenes([]);
            toast.error(error.message);
        } finally {
            setCargando(false);
        }
    }, [filtros]);

    useEffect(() => {
        cargarFormData();
    }, [cargarFormData]);

    useEffect(() => {
        const temporizador = setTimeout(cargarOrdenes, 250);
        return () => clearTimeout(temporizador);
    }, [cargarOrdenes]);

    const resumen = useMemo(() => {
        const resultado = {
            total: ordenes.length,
            borradores: 0,
            programadas: 0,
            activas: 0,
            analisis: 0,
            finalizadas: 0,
        };

        ordenes.forEach((orden) => {
            const estado = orden.estadoProceso;

            if (estado === "BORRADOR") resultado.borradores++;
            if (estado === "PROGRAMADA") resultado.programadas++;
            if (["ABIERTA", "EN_CONTEO"].includes(estado)) resultado.activas++;
            if (estado === "EN_ANALISIS") resultado.analisis++;
            if (estado === "FINALIZADA") resultado.finalizadas++;
        });

        return resultado;
    }, [ordenes]);

    const abrirDetalle = (orden) => {
        localStorage.setItem(
            "inventarioOrdenConteoId",
            String(orden.idOrdenConteo || orden.id)
        );
        navegar("DetalleConteoFisicoInventario");
    };

    const tarjetas = [
        ["Órdenes", resumen.total, FaClipboardCheck, "bg-slate-50 text-slate-700 border-slate-200"],
        ["Borradores", resumen.borradores, FaClock, "bg-slate-50 text-slate-700 border-slate-200"],
        ["Programadas", resumen.programadas, FaCalendarAlt, "bg-blue-50 text-blue-700 border-blue-200"],
        ["En operación", resumen.activas, FaBoxes, "bg-amber-50 text-amber-700 border-amber-200"],
        ["En análisis", resumen.analisis, FaChartBar, "bg-violet-50 text-violet-700 border-violet-200"],
        ["Finalizadas", resumen.finalizadas, FaCheckCircle, "bg-emerald-50 text-emerald-700 border-emerald-200"],
    ];

    return (
        <>
            <div className="w-full h-screen flex flex-col p-2 md:p-4 gap-4 bg-slate-100">
                <article className="flex-1 bg-white shadow-lg rounded-2xl flex flex-col overflow-hidden border border-slate-200">
                    <header className="px-4 py-3 md:px-5 border-b border-slate-200">
                        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setSidebar(true)}
                                    className="lg:hidden h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center"
                                >
                                    <IoMenu size={23} />
                                </button>

                                <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center border border-blue-100">
                                    <FaClipboardCheck size={20} />
                                </div>

                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                        Control de inventarios
                                    </p>
                                    <h1 className="text-xl md:text-2xl font-bold text-slate-900">
                                        Conteos físicos
                                    </h1>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setModalFiltros(true)}
                                    className="h-10 px-4 rounded-xl border border-slate-200 font-semibold flex items-center gap-2"
                                >
                                    <FaFilter />
                                    Filtros
                                    {filtrosActivos > 0 && (
                                        <span className="h-5 min-w-5 px-1 rounded-full bg-blue-800 text-white text-xs flex items-center justify-center">
                                            {filtrosActivos}
                                        </span>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={cargarOrdenes}
                                    className="h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center"
                                >
                                    <FaSyncAlt className={cargando ? "animate-spin" : ""} />
                                </button>

                                <button
                                    type="button"
                                    onClick={() => navegar("CrearConteoFisicoInventario")}
                                    className="h-10 px-4 rounded-xl bg-blue-800 text-white font-semibold flex items-center gap-2"
                                >
                                    <FaPlus />
                                    Nueva orden
                                </button>
                            </div>
                        </div>
                    </header>

                    <div className="px-4 pt-4 md:px-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                        {tarjetas.map(([titulo, valor, Icono, clase]) => (
                            <div key={titulo} className={`rounded-2xl border p-4 ${clase}`}>
                                <div className="flex justify-between gap-2 text-xs font-bold uppercase">
                                    <span>{titulo}</span>
                                    <Icono />
                                </div>
                                <p className="mt-3 text-3xl font-black">{valor}</p>
                            </div>
                        ))}
                    </div>

                    <div className="px-4 py-4 md:px-5 border-b border-slate-200">
                        <div className="relative">
                            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="search"
                                value={filtros.q}
                                onChange={(e) => setFiltros((prev) => ({ ...prev, q: e.target.value }))}
                                placeholder="Buscar por código, nombre o bodega..."
                                className="w-full h-11 pl-11 pr-4 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-200"
                            />
                        </div>
                    </div>

                    <section className="flex-1 overflow-auto p-4 md:p-5 bg-slate-50/60">
                        {cargando ? (
                            <div className="min-h-64 flex flex-col items-center justify-center text-slate-500">
                                <FaSyncAlt className="animate-spin text-3xl mb-3" />
                                Consultando órdenes...
                            </div>
                        ) : ordenes.length === 0 ? (
                            <div className="min-h-64 flex flex-col items-center justify-center text-slate-500">
                                <FaClipboardCheck size={32} />
                                <p className="mt-3 font-semibold">No se encontraron órdenes.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {ordenes.map((orden) => {
                                    const avance = orden.avance || {};
                                    const porcentaje = Number(avance.porcentaje || 0);

                                    return (
                                        <article
                                            key={orden.idOrdenConteo || orden.id}
                                            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                                        >
                                            <div className="flex flex-col sm:flex-row sm:justify-between gap-4">
                                                <div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <span className="font-mono text-xs font-bold text-blue-800 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
                                                            {orden.codigo}
                                                        </span>
                                                        <span className={`text-xs font-bold border rounded-full px-2.5 py-1 ${claseEstado(orden.estadoProceso)}`}>
                                                            {textoEstado(orden.estadoProceso)}
                                                        </span>
                                                        <span className="text-xs font-bold border border-slate-200 rounded-full px-2.5 py-1 bg-slate-50">
                                                            {orden.tipoConteo}
                                                        </span>
                                                    </div>

                                                    <h2 className="mt-3 text-lg font-bold text-slate-900">
                                                        {orden.nombre}
                                                    </h2>
                                                    <p className="mt-1 text-sm text-slate-500">
                                                        Corte: {formatearFechaHora(orden.fechaCorte)}
                                                    </p>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => abrirDetalle(orden)}
                                                    className="h-10 px-4 rounded-xl bg-slate-900 text-white font-semibold flex items-center justify-center gap-2"
                                                >
                                                    <FaEye />
                                                    Ver detalle
                                                </button>
                                            </div>

                                            <div className="mt-5 flex justify-between text-sm">
                                                <span className="font-semibold text-slate-600">
                                                    {avance.conteosCompletados || 0} de {avance.totalBodegas || 0} bodegas
                                                </span>
                                                <strong>{porcentaje.toFixed(0)}%</strong>
                                            </div>

                                            <div className="mt-2 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-800 rounded-full"
                                                    style={{ width: `${Math.min(100, porcentaje)}%` }}
                                                />
                                            </div>
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
                    <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
                        <header className="px-5 py-4 border-b flex justify-between items-center">
                            <h2 className="text-lg font-bold">Filtros avanzados</h2>
                            <button
                                type="button"
                                onClick={() => setModalFiltros(false)}
                                className="h-10 w-10 rounded-xl border flex items-center justify-center"
                            >
                                <FaTimes />
                            </button>
                        </header>

                        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <select
                                value={filtros.estadoProceso}
                                onChange={(e) => setFiltros((prev) => ({ ...prev, estadoProceso: e.target.value }))}
                                className="h-11 px-3 rounded-xl border border-slate-200"
                            >
                                <option value="">Todos los estados</option>
                                {estados.map((item) => (
                                    <option key={item.valor} value={item.valor}>{item.nombre}</option>
                                ))}
                            </select>

                            <select
                                value={filtros.tipoConteo}
                                onChange={(e) => setFiltros((prev) => ({ ...prev, tipoConteo: e.target.value }))}
                                className="h-11 px-3 rounded-xl border border-slate-200"
                            >
                                <option value="">Todos los tipos</option>
                                {tipos.map((item) => (
                                    <option key={item.valor} value={item.valor}>{item.nombre}</option>
                                ))}
                            </select>

                            <select
                                value={filtros.idBodega}
                                onChange={(e) => setFiltros((prev) => ({ ...prev, idBodega: e.target.value }))}
                                className="h-11 px-3 rounded-xl border border-slate-200 md:col-span-2"
                            >
                                <option value="">Todas las bodegas</option>
                                {bodegas.map((bodega) => (
                                    <option key={bodega.id} value={bodega.id}>
                                        {bodega.codigo} - {bodega.nombre}
                                    </option>
                                ))}
                            </select>

                            <input
                                type="date"
                                value={filtros.fechaDesde}
                                onChange={(e) => setFiltros((prev) => ({ ...prev, fechaDesde: e.target.value }))}
                                className="h-11 px-3 rounded-xl border border-slate-200"
                            />

                            <input
                                type="date"
                                value={filtros.fechaHasta}
                                onChange={(e) => setFiltros((prev) => ({ ...prev, fechaHasta: e.target.value }))}
                                className="h-11 px-3 rounded-xl border border-slate-200"
                            />
                        </div>

                        <footer className="p-5 border-t bg-slate-50 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setFiltros(FILTROS_INICIALES)}
                                className="h-10 px-4 rounded-xl border bg-white font-semibold"
                            >
                                Limpiar
                            </button>
                            <button
                                type="button"
                                onClick={() => setModalFiltros(false)}
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
