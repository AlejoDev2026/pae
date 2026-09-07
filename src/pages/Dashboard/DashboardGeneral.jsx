import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { IoMenu } from "react-icons/io5";
import {
    FaArrowsRotate,
    FaBoxesStacked,
    FaCalendarDays,
    FaChartColumn,
    FaClock,
    FaCube,
    FaFileExcel,
    FaRoute,
    FaTriangleExclamation,
    FaXmark,
} from "react-icons/fa6";
import { API_BASE } from "../../constants";

const TABS = [
    { id: "resumen", label: "Resumen" },
    { id: "inventario", label: "Inventario" },
    { id: "despachos", label: "Despachos" },
];

const CACHE_DASHBOARD = "pae_dashboard_compacto";
const DATA_INICIAL = {
    resumenGeneral: {}, resumenJornadas: [], categorias: [], topRutas: [], topProductos: [], ultimosDespachos: [], ultimosArchivos: [],
    inventario: { resumen: {}, vencimientos: {}, alertasVencimiento: [], alertasPorBodega: [], ordenesAlistamiento: {} },
};

const leerCacheDashboard = () => {
    try {
        const cache = JSON.parse(sessionStorage.getItem(CACHE_DASHBOARD) || "null");
        return cache?.data && Date.now() - Number(cache.guardadoEn || 0) < 10 * 60 * 1000 ? cache.data : null;
    } catch {
        return null;
    }
};

const COLORS = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    sky: "border-sky-200 bg-sky-50 text-sky-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
};

const numero = (valor) => new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 }).format(Number(valor || 0));

const fecha = (valor) => {
    if (!valor) return "—";
    const fechaValor = new Date(`${String(valor).slice(0, 10)}T00:00:00`);
    return Number.isNaN(fechaValor.getTime()) ? valor : fechaValor.toLocaleDateString("es-CO");
};

const jsonSeguro = async (response) => {
    const texto = await response.text();
    try { return JSON.parse(texto); } catch { throw new Error("El servidor no devolvió información válida."); }
};

const Kpi = ({ titulo, valor, detalle, icono, color = "slate", onClick }) => {
    const contenido = (
        <>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${COLORS[color]}`}>
                {createElement(icono, { className: "text-base" })}
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p>
                <p className="mt-1 truncate text-2xl font-black text-slate-900">{valor}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{detalle}</p>
            </div>
        </>
    );

    return onClick ? (
        <button type="button" onClick={onClick} className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:shadow-md">
            {contenido}
        </button>
    ) : (
        <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">{contenido}</div>
    );
};

const Panel = ({ titulo, subtitulo, children, accion }) => (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="min-w-0"><h3 className="truncate text-sm font-black text-slate-800">{titulo}</h3><p className="truncate text-xs text-slate-500">{subtitulo}</p></div>
            {accion}
        </header>
        <div className="min-h-0 flex-1 overflow-hidden p-4">{children}</div>
    </section>
);

const BotonDetalle = ({ onClick, children = "Ver detalle" }) => (
    <button type="button" onClick={onClick} className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-100">{children}</button>
);

const Vacio = ({ texto }) => <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-sm text-slate-500">{texto}</div>;

const ListaCompacta = ({ filas, render, vacio }) => filas?.length ? <div className="divide-y divide-slate-100">{filas.map(render)}</div> : <Vacio texto={vacio} />;

const BarraMetrica = ({ titulo, valor, maximo, color, icono }) => {
    const porcentaje = Number(maximo) > 0 ? Math.max(5, Math.min((Number(valor || 0) / Number(maximo)) * 100, 100)) : 0;
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${COLORS[color]}`}>{createElement(icono, { className: "text-sm" })}</div>
                <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-slate-600">{titulo}</p><p className="text-base font-black text-slate-900">{numero(valor)}</p></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${color === "emerald" ? "bg-emerald-500" : color === "sky" ? "bg-sky-500" : color === "violet" ? "bg-violet-500" : "bg-amber-500"}`} style={{ width: `${porcentaje}%` }} /></div></div>
            </div>
        </div>
    );
};

const Modal = ({ abierto, titulo, subtitulo, onClose, children }) => {
    useEffect(() => {
        if (!abierto) return undefined;
        const cerrarEscape = (evento) => { if (evento.key === "Escape") onClose(); };
        window.addEventListener("keydown", cerrarEscape);
        return () => window.removeEventListener("keydown", cerrarEscape);
    }, [abierto, onClose]);

    if (!abierto) return null;
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6">
            <button type="button" className="absolute inset-0 bg-slate-950/60" onClick={onClose} aria-label="Cerrar modal" />
            <section className="relative flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
                    <div><h2 className="text-lg font-black text-slate-900">{titulo}</h2><p className="mt-1 text-sm text-slate-500">{subtitulo}</p></div>
                    <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"><FaXmark /></button>
                </header>
                <div className="overflow-y-auto p-5">{children}</div>
            </section>
        </div>
    );
};

const Tabla = ({ columnas, filas, vacio = "No hay información disponible." }) => (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr>{columnas.map((columna) => <th key={columna.key} className={`px-4 py-3 ${columna.align === "right" ? "text-right" : "text-left"}`}>{columna.label}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
                {filas?.length ? filas.map((fila, index) => <tr key={fila.id || fila.idLote || `${index}`} className="hover:bg-slate-50">{columnas.map((columna) => <td key={columna.key} className={`px-4 py-3 ${columna.align === "right" ? "text-right" : "text-left"}`}>{columna.render ? columna.render(fila) : fila[columna.key]}</td>)}</tr>) : <tr><td colSpan={columnas.length} className="p-8 text-center text-slate-500">{vacio}</td></tr>}
            </tbody>
        </table>
    </div>
);

export const DashboardGeneral = ({ setSidebar, navegar }) => {
    const cacheInicial = useMemo(() => leerCacheDashboard(), []);
    const hoy = useMemo(() => new Date(), []);
    const desde = useMemo(() => { const valor = new Date(); valor.setDate(valor.getDate() - 30); return valor; }, []);
    const [fechaInicio, setFechaInicio] = useState(desde.toISOString().slice(0, 10));
    const [fechaFin, setFechaFin] = useState(hoy.toISOString().slice(0, 10));
    const [tab, setTab] = useState("resumen");
    const [modal, setModal] = useState(null);
    const [loading, setLoading] = useState(!cacheInicial);
    const [error, setError] = useState("");
    const requestRef = useRef(null);
    const primeraCargaRef = useRef(true);
    const [data, setData] = useState(cacheInicial || DATA_INICIAL);

    const cargar = async (usarFechas = true) => {
        requestRef.current?.abort();
        const controller = new AbortController();
        requestRef.current = controller;
        const timeout = window.setTimeout(() => controller.abort(), primeraCargaRef.current ? 60000 : 30000);
        if (!cacheInicial || !primeraCargaRef.current) setLoading(true);
        setError("");
        try {
            const parametros = new URLSearchParams();
            parametros.set("compacto", "1");
            if (usarFechas && fechaInicio && fechaFin) { parametros.set("fechaInicio", fechaInicio); parametros.set("fechaFin", fechaFin); }
            const base = API_BASE.replace(/\/+$/, "");
            const response = await fetch(`${base}/Dashboard/DashboardGetResumen.php?${parametros}`, { signal: controller.signal, cache: "no-store" });
            const resultado = await jsonSeguro(response);
            if (!response.ok || !resultado?.ok) throw new Error(resultado?.mensaje || "No fue posible cargar el dashboard.");
            const nuevosDatos = {
                resumenGeneral: resultado.resumenGeneral || {},
                resumenJornadas: Array.isArray(resultado.resumenJornadas) ? resultado.resumenJornadas : [],
                categorias: Array.isArray(resultado.categorias) ? resultado.categorias : [],
                topRutas: Array.isArray(resultado.topRutas) ? resultado.topRutas : [],
                topProductos: Array.isArray(resultado.topProductos) ? resultado.topProductos : [],
                ultimosDespachos: Array.isArray(resultado.ultimosDespachos) ? resultado.ultimosDespachos : [],
                ultimosArchivos: Array.isArray(resultado.ultimosArchivos) ? resultado.ultimosArchivos : [],
                inventario: {
                    resumen: resultado.inventario?.resumen || {}, vencimientos: resultado.inventario?.vencimientos || {},
                    alertasVencimiento: Array.isArray(resultado.inventario?.alertasVencimiento) ? resultado.inventario.alertasVencimiento : [],
                    alertasPorBodega: Array.isArray(resultado.inventario?.alertasPorBodega) ? resultado.inventario.alertasPorBodega : [],
                    ordenesAlistamiento: resultado.inventario?.ordenesAlistamiento || {},
                },
            };
            setData(nuevosDatos);
            sessionStorage.setItem(CACHE_DASHBOARD, JSON.stringify({ data: nuevosDatos, guardadoEn: Date.now() }));
        } catch (err) {
            const tieneDatosVisibles = Object.keys(data.resumenGeneral || {}).length > 0 || Object.keys(data.inventario?.resumen || {}).length > 0;
            if (!tieneDatosVisibles) {
                if (err?.name === "AbortError") setError("La consulta tardó demasiado. Intenta actualizar nuevamente.");
                else setError(err?.message || "No fue posible cargar el dashboard.");
            } else {
                toast.warning("Se mantienen los últimos indicadores disponibles porque la actualización tardó demasiado.");
            }
            if (err?.name !== "AbortError" && !tieneDatosVisibles) toast.error(err?.message || "No fue posible cargar el dashboard.");
        } finally { window.clearTimeout(timeout); primeraCargaRef.current = false; setLoading(false); }
    };

    useEffect(() => {
        cargar(true);
        return () => requestRef.current?.abort();
        // La carga inicial conserva el rango predeterminado; los cambios se aplican con el botón Actualizar.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const despacho = data.resumenGeneral || {};
    const inventario = data.inventario?.resumen || {};
    const vencimientos = data.inventario?.vencimientos || {};
    const ordenes = data.inventario?.ordenesAlistamiento || {};
    const alertas = data.inventario?.alertasVencimiento || [];

    const kpis = tab === "despachos" ? [
        ["Despachos", despacho.totalDespachos, "Registros consolidados", FaBoxesStacked, "emerald", "despachos"],
        ["Rutas", despacho.totalRutas, "Rutas encontradas", FaRoute, "sky", "despachos"],
        ["Productos", despacho.totalProductos, "Productos diferentes", FaCube, "violet", "despachos"],
        ["Cantidad", despacho.totalCantidad, "Volumen consolidado", FaChartColumn, "amber", "despachos"],
    ] : tab === "inventario" ? [
        ["Disponible", inventario.cantidadDisponible, `${numero(inventario.porcentajeDisponible)}% del total`, FaBoxesStacked, "emerald", "existencias"],
        ["Reservado", inventario.cantidadReservada, "Comprometido", FaClock, "sky", "ordenes"],
        ["Bloqueado", inventario.cantidadBloqueada, "No disponible", FaTriangleExclamation, "amber", "existencias"],
        ["Bajo mínimo", inventario.productosBajoMinimo, `${numero(inventario.productosSinExistencia)} sin existencia`, FaCube, "rose", "existencias"],
    ] : [
        ["Disponible", inventario.cantidadDisponible, `${numero(inventario.porcentajeDisponible)}% del inventario`, FaBoxesStacked, "emerald", "existencias"],
        ["Vencidos", vencimientos.lotesVencidos, `${numero(vencimientos.cantidadVencida)} unidades`, FaTriangleExclamation, "rose", "vencimientos"],
        ["Vencen en 30 días", vencimientos.lotesCriticos, `${numero(vencimientos.productosCriticos)} productos`, FaClock, "amber", "vencimientos"],
        ["Órdenes pendientes", ordenes.conPendientes, `${numero(ordenes.enAlistamiento)} en proceso`, FaBoxesStacked, "violet", "ordenes"],
    ];

    const abrirDesdeKpi = (tipo) => {
        if (tipo === "existencias") navegar?.("ExistenciasInventario");
        else setModal(tipo);
    };

    return (
        <div className="h-full w-full overflow-y-auto bg-slate-100 lg:overflow-hidden">
            <div className="flex min-h-full flex-col gap-3 p-3 md:p-4 lg:h-full lg:min-h-0">
                <header className="shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex items-center gap-3">
                            <button type="button" onClick={() => setSidebar?.(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 lg:hidden"><IoMenu /></button>
                            <div><h1 className="text-xl font-black text-slate-900">Dashboard</h1><p className="text-xs text-slate-500">Vista ejecutiva de inventario y despachos</p></div>
                            <nav className="ml-2 hidden rounded-xl bg-slate-100 p-1 sm:flex">{TABS.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`rounded-lg px-4 py-2 text-xs font-bold transition ${tab === item.id ? "bg-white text-blue-800 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{item.label}</button>)}</nav>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3"><FaCalendarDays className="text-slate-400" /><input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-28 bg-transparent text-xs outline-none" /></div>
                            <div className="flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3"><input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="w-28 bg-transparent text-xs outline-none" /></div>
                            <button type="button" onClick={() => cargar(true)} disabled={loading} className="flex h-9 items-center gap-2 rounded-xl bg-blue-800 px-4 text-xs font-bold text-white disabled:opacity-60"><FaArrowsRotate className={loading ? "animate-spin" : ""} />Actualizar</button>
                        </div>
                        <nav className="flex rounded-xl bg-slate-100 p-1 sm:hidden">{TABS.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`flex-1 rounded-lg px-3 py-2 text-xs font-bold ${tab === item.id ? "bg-white text-blue-800 shadow-sm" : "text-slate-500"}`}>{item.label}</button>)}</nav>
                    </div>
                </header>

                {loading ? <div className="flex min-h-72 flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500"><FaArrowsRotate className="mr-2 animate-spin" />Cargando indicadores…</div> : error ? <div className="flex min-h-72 flex-1 flex-col items-center justify-center rounded-2xl border border-red-200 bg-white p-6 text-center"><FaTriangleExclamation className="mb-3 text-2xl text-red-500" /><p className="font-bold text-slate-800">No se pudo cargar el dashboard</p><p className="mt-1 text-sm text-slate-500">{error}</p><button type="button" onClick={() => cargar(true)} className="mt-4 rounded-xl bg-blue-800 px-4 py-2 text-sm font-bold text-white">Reintentar</button></div> : <>
                    <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {kpis.map(([titulo, valor, detalle, icono, color, destino]) => <Kpi key={titulo} titulo={titulo} valor={numero(valor)} detalle={detalle} icono={icono} color={color} onClick={() => abrirDesdeKpi(destino)} />)}
                    </div>

                    <main key={tab} className={`grid min-h-0 flex-1 grid-cols-1 gap-3 ${tab === "despachos" ? "lg:grid-cols-[1.35fr_0.65fr]" : tab === "inventario" ? "lg:grid-cols-[1.3fr_0.7fr]" : "lg:grid-cols-[1.2fr_0.8fr]"}`}>
                        {tab === "despachos" ? <>
                            <Panel titulo="Últimos despachos" subtitulo="Actividad reciente del módulo" accion={<BotonDetalle onClick={() => setModal("despachos")} />}>
                                <ListaCompacta filas={data.ultimosDespachos.slice(0, 8)} vacio="No hay despachos para mostrar." render={(fila, index) => <div key={`despacho-${fila.id || index}`} className="group flex items-center gap-3 py-2.5"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-800 to-cyan-600 text-xs font-black text-white shadow-sm">{String(index + 1).padStart(2, "0")}</div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-black text-slate-800">{fila.codigo || `Despacho #${fila.id}`}</p><span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 md:inline">{fila.tipoPeriodo || "Periodo"}</span></div><div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500"><span>{fecha(fila.fechaDespacho)}</span><span>{numero(fila.totalRutas)} rutas</span><span>{numero(fila.totalProductos)} productos</span></div></div><div className="text-right"><p className="text-sm font-black text-slate-900">{numero(fila.totalCantidad)}</p><p className="text-[10px] uppercase tracking-wide text-slate-400">cantidad</p></div></div>} />
                            </Panel>
                            <Panel titulo="Consolidado del periodo" subtitulo="Lectura rápida de la operación">
                                <div className="flex h-full flex-col justify-between gap-2">
                                    <BarraMetrica titulo="Archivos procesados" valor={despacho.totalArchivos} maximo={Math.max(Number(despacho.totalArchivos || 0), Number(despacho.totalColegios || 0))} color="sky" icono={FaFileExcel} />
                                    <BarraMetrica titulo="Colegios impactados" valor={despacho.totalColegios} maximo={Math.max(Number(despacho.totalArchivos || 0), Number(despacho.totalColegios || 0))} color="emerald" icono={FaBoxesStacked} />
                                    <BarraMetrica titulo="Cobertura total" valor={despacho.totalCoberturaRuta} maximo={Math.max(Number(despacho.totalCoberturaRuta || 0), Number(despacho.totalCajasPacas || 0))} color="violet" icono={FaChartColumn} />
                                    <BarraMetrica titulo="PAC / Cajas" valor={despacho.totalCajasPacas} maximo={Math.max(Number(despacho.totalCoberturaRuta || 0), Number(despacho.totalCajasPacas || 0))} color="amber" icono={FaBoxesStacked} />
                                    <button type="button" onClick={() => setModal("despachos")} className="mt-1 flex h-10 items-center justify-center rounded-xl bg-slate-900 text-xs font-bold text-white hover:bg-blue-900">Abrir detalle del periodo</button>
                                </div>
                            </Panel>
                        </> : tab === "inventario" ? <>
                            <Panel titulo="Vencimientos prioritarios" subtitulo="Existencia disponible hasta 60 días" accion={<BotonDetalle onClick={() => setModal("vencimientos")} />}>
                                <ListaCompacta filas={alertas.slice(0, 7)} vacio="No hay alertas de vencimiento." render={(fila, index) => <div key={fila.idLote || index} className="flex items-center gap-3 py-2.5"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black text-white shadow-sm ${Number(fila.diasParaVencer) < 0 ? "bg-gradient-to-br from-red-700 to-rose-500" : "bg-gradient-to-br from-amber-600 to-orange-400"}`}>{String(index + 1).padStart(2, "0")}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-800">{fila.producto}</p><p className="mt-1 truncate text-[11px] text-slate-500">Lote {fila.lote} · {fila.bodega}</p></div><div className="text-right"><p className={`text-xs font-black ${Number(fila.diasParaVencer) < 0 ? "text-red-600" : "text-amber-600"}`}>{Number(fila.diasParaVencer) < 0 ? `${Math.abs(fila.diasParaVencer)} días vencido` : `${fila.diasParaVencer} días`}</p><p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">{numero(fila.cantidadDisponible)} disponibles</p></div></div>} />
                            </Panel>
                            <Panel titulo="Alertas por bodega" subtitulo="Vencidos y próximos a vencer" accion={<BotonDetalle onClick={() => setModal("bodegas")} />}>
                                <div className="flex h-full flex-col justify-between gap-2">{data.inventario.alertasPorBodega.slice(0, 5).map((fila, index) => <BarraMetrica key={fila.idBodega || index} titulo={fila.bodega} valor={Number(fila.lotesVencidos || 0) + Number(fila.lotesPorVencer || 0)} maximo={Math.max(...data.inventario.alertasPorBodega.map((item) => Number(item.lotesVencidos || 0) + Number(item.lotesPorVencer || 0)), 1)} color={Number(fila.lotesVencidos || 0) > 0 ? "amber" : "emerald"} icono={FaBoxesStacked} />)}{!data.inventario.alertasPorBodega.length && <Vacio texto="No hay alertas por bodega." />}<button type="button" onClick={() => setModal("bodegas")} className="mt-1 flex h-10 items-center justify-center rounded-xl bg-slate-900 text-xs font-bold text-white hover:bg-blue-900">Analizar todas las bodegas</button></div>
                            </Panel>
                        </> : <>
                            <Panel titulo="Alertas que requieren atención" subtitulo="Vencimientos y disponibilidad" accion={<BotonDetalle onClick={() => setModal("vencimientos")} />}>
                                <ListaCompacta filas={alertas.slice(0, 7)} vacio="No hay alertas urgentes." render={(fila, index) => <div key={fila.idLote || index} className="flex items-center gap-3 py-2.5"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${fila.clasificacion === "VENCIDO" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}><FaTriangleExclamation /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-800">{fila.producto}</p><p className="mt-1 truncate text-[11px] text-slate-500">{fila.bodega} · Lote {fila.lote}</p></div><div className="text-right"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${fila.clasificacion === "VENCIDO" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{fila.clasificacion}</span><p className="mt-1.5 text-[10px] text-slate-400">{numero(fila.cantidadDisponible)} unidades</p></div></div>} />
                            </Panel>
                            <Panel titulo="Operación del día" subtitulo="Alistamiento y despachos" accion={<BotonDetalle onClick={() => setModal("ordenes")} />}>
                                <div className="flex h-full flex-col justify-between gap-2">
                                    <BarraMetrica titulo="Por asignar" valor={ordenes.pendientesAsignacion} maximo={ordenes.total} color="amber" icono={FaClock} />
                                    <BarraMetrica titulo="Asignadas" valor={ordenes.asignadas} maximo={ordenes.total} color="sky" icono={FaBoxesStacked} />
                                    <BarraMetrica titulo="En proceso" valor={ordenes.enAlistamiento} maximo={ordenes.total} color="violet" icono={FaArrowsRotate} />
                                    <BarraMetrica titulo="En logística" valor={ordenes.enLogistica} maximo={ordenes.total} color="emerald" icono={FaRoute} />
                                    <button type="button" onClick={() => setModal("ordenes")} className="mt-1 flex h-10 items-center justify-center rounded-xl bg-slate-900 text-xs font-bold text-white hover:bg-blue-900">Gestionar órdenes de alistamiento</button>
                                </div>
                            </Panel>
                        </>}
                    </main>
                </>}
            </div>

            <Modal abierto={modal === "vencimientos"} titulo="Lotes vencidos y próximos a vencer" subtitulo="Existencias disponibles con vencimiento hasta 60 días" onClose={() => setModal(null)}>
                <Tabla columnas={[
                    { key: "producto", label: "Producto", render: (fila) => <div><p className="font-bold">{fila.producto}</p><p className="text-xs text-slate-500">{fila.codigo} · Lote {fila.lote}</p></div> },
                    { key: "bodega", label: "Bodega", render: (fila) => <div><p>{fila.bodega}</p><p className="text-xs text-slate-500">{fila.ubicacion || "Sin ubicación"}</p></div> },
                    { key: "fecha", label: "Vencimiento", render: (fila) => <div><p>{fecha(fila.fechaVencimiento)}</p><p className={Number(fila.diasParaVencer) < 0 ? "text-xs font-bold text-red-600" : "text-xs font-bold text-amber-600"}>{Number(fila.diasParaVencer) < 0 ? `${Math.abs(fila.diasParaVencer)} días vencido` : `${fila.diasParaVencer} días`}</p></div> },
                    { key: "cantidad", label: "Disponible", align: "right", render: (fila) => numero(fila.cantidadDisponible) },
                ]} filas={alertas} />
                <button type="button" onClick={() => { setModal(null); navegar?.("LotesVencimientosInventario"); }} className="mt-4 rounded-xl bg-blue-800 px-4 py-2 text-sm font-bold text-white">Abrir módulo de lotes</button>
            </Modal>

            <Modal abierto={modal === "bodegas"} titulo="Alertas por bodega" subtitulo="Concentración de mercancía vencida o próxima a vencer" onClose={() => setModal(null)}>
                <Tabla columnas={[
                    { key: "bodega", label: "Bodega" },
                    { key: "vencidos", label: "Lotes vencidos", align: "right", render: (fila) => numero(fila.lotesVencidos) },
                    { key: "proximos", label: "Por vencer", align: "right", render: (fila) => numero(fila.lotesPorVencer) },
                    { key: "cantidad", label: "Cantidad comprometida", align: "right", render: (fila) => numero(fila.cantidadComprometida) },
                ]} filas={data.inventario.alertasPorBodega} />
            </Modal>

            <Modal abierto={modal === "ordenes"} titulo="Órdenes de alistamiento" subtitulo="Estado consolidado de la operación" onClose={() => setModal(null)}>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[["Total", ordenes.total], ["Por asignar", ordenes.pendientesAsignacion], ["Asignadas", ordenes.asignadas], ["En proceso", ordenes.enAlistamiento], ["Con pendientes", ordenes.conPendientes], ["Completas", ordenes.completas], ["En logística", ordenes.enLogistica]].map(([titulo, valor]) => <div key={titulo} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs text-slate-500">{titulo}</p><p className="mt-1 text-2xl font-black text-slate-900">{numero(valor)}</p></div>)}</div>
                <button type="button" onClick={() => { setModal(null); navegar?.("OrdenesAlistamientoInventario"); }} className="mt-4 rounded-xl bg-blue-800 px-4 py-2 text-sm font-bold text-white">Abrir órdenes</button>
            </Modal>

            <Modal abierto={modal === "despachos"} titulo="Detalle de despachos" subtitulo="Rutas, productos y actividad reciente" onClose={() => setModal(null)}>
                <Tabla columnas={[{ key: "codigo", label: "Despacho" }, { key: "fecha", label: "Fecha", render: (fila) => fecha(fila.fechaDespacho) }, { key: "rutas", label: "Rutas", align: "right", render: (fila) => numero(fila.totalRutas) }, { key: "productos", label: "Productos", align: "right", render: (fila) => numero(fila.totalProductos) }, { key: "cantidad", label: "Cantidad", align: "right", render: (fila) => numero(fila.totalCantidad) }]} filas={data.ultimosDespachos} />
            </Modal>
        </div>
    );
};
