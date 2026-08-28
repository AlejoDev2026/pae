import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../constants";
import { IoMenu } from "react-icons/io5";
import {
    FaArrowLeft,
    FaBoxesStacked,
    FaRoute,
    FaSchool,
    FaFileExcel,
    FaClock,
    FaLayerGroup,
    FaChartColumn,
    FaCube,
    FaTriangleExclamation,
    FaArrowsRotate,
    FaCalendarDays,
} from "react-icons/fa6";
import { toast } from "react-toastify";

const JOURNEY_ORDER = ["AM", "PM", "JORNADA_UNICA"];

const JOURNEY_LABELS = {
    AM: "AM",
    PM: "PM",
    JORNADA_UNICA: "Jornada Única",
};

const BLOCK_COLORS = {
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    sky: "bg-sky-50 border-sky-200 text-sky-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    violet: "bg-violet-50 border-violet-200 text-violet-700",
    rose: "bg-rose-50 border-rose-200 text-rose-700",
    slate: "bg-slate-50 border-slate-200 text-slate-700",
};

const formatearNumero = (valor) => {
    const numero = Number(valor || 0);
    return new Intl.NumberFormat("es-CO").format(numero);
};

const formatearFecha = (fecha) => {
    if (!fecha) return "—";
    const d = new Date(`${fecha}T00:00:00`);
    if (Number.isNaN(d.getTime())) return fecha;
    return d.toLocaleDateString("es-CO", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
};

const formatearFechaHora = (fecha) => {
    if (!fecha) return "—";
    const d = new Date(fecha);
    if (Number.isNaN(d.getTime())) return fecha;
    return d.toLocaleString("es-CO", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const obtenerPorcentaje = (valor, maximo) => {
    const v = Number(valor || 0);
    const m = Number(maximo || 0);
    if (!m || m <= 0) return 0;
    return Math.min((v / m) * 100, 100);
};

const CardKPI = ({ titulo, valor, subtitulo, icono: Icono, color = "slate" }) => (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 md:p-5 h-full">
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <p className="text-sm font-medium text-slate-500">{titulo}</p>
                <h3 className="mt-2 text-2xl md:text-3xl font-bold text-slate-800 leading-none break-words">
                    {valor}
                </h3>
                <p className="mt-2 text-xs md:text-sm text-slate-500">{subtitulo}</p>
            </div>

            <div
                className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${BLOCK_COLORS[color]}`}
            >
                <Icono className="text-lg" />
            </div>
        </div>
    </div>
);

const SectionCard = ({
    titulo,
    subtitulo,
    icono: Icono,
    color = "slate",
    children,
    acciones = null,
}) => (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-full">
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
                <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${BLOCK_COLORS[color]}`}
                >
                    <Icono className="text-base" />
                </div>
                <div className="min-w-0">
                    <h3 className="text-base md:text-lg font-semibold text-slate-800">
                        {titulo}
                    </h3>
                    {subtitulo ? (
                        <p className="text-sm text-slate-500 mt-1">{subtitulo}</p>
                    ) : null}
                </div>
            </div>

            {acciones ? <div className="shrink-0">{acciones}</div> : null}
        </div>

        <div className="p-5">{children}</div>
    </div>
);

const JourneyMiniCard = ({ item }) => (
    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
        <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-700">
                {JOURNEY_LABELS[item.jornada] || item.jornada}
            </p>
            <span className="text-xs px-2 py-1 rounded-full bg-white border border-slate-200 text-slate-500">
                {formatearNumero(item.totalArchivos)} archivos
            </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
                <p className="text-slate-500">Rutas</p>
                <p className="font-semibold text-slate-800">{formatearNumero(item.totalRutas)}</p>
            </div>
            <div>
                <p className="text-slate-500">Productos</p>
                <p className="font-semibold text-slate-800">
                    {formatearNumero(item.totalProductos)}
                </p>
            </div>
            <div>
                <p className="text-slate-500">Cantidad</p>
                <p className="font-semibold text-slate-800">
                    {formatearNumero(item.totalCantidad)}
                </p>
            </div>
            <div>
                <p className="text-slate-500">Cobertura</p>
                <p className="font-semibold text-slate-800">
                    {formatearNumero(item.totalCoberturaRuta)}
                </p>
            </div>
            <div>
                <p className="text-slate-500">PAC / Cajas</p>
                <p className="font-semibold text-slate-800">
                    {formatearNumero(item.totalCajasPacas)}
                </p>
            </div>
            <div>
                <p className="text-slate-500">Unidades</p>
                <p className="font-semibold text-slate-800">
                    {formatearNumero(item.totalUnidades)}
                </p>
            </div>
        </div>
    </div>
);

const TablaSimple = ({ columnas = [], filas = [], vacio = "Sin información disponible." }) => (
    <div className="overflow-x-auto w-full">
        <table className="w-full min-w-[720px] text-sm">
            <thead>
                <tr className="border-b border-slate-200">
                    {columnas.map((col) => (
                        <th
                            key={col.key}
                            className={`px-3 py-3 text-left font-semibold text-slate-600 whitespace-nowrap ${
                                col.align === "right" ? "text-right" : ""
                            }`}
                        >
                            {col.label}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {filas.length ? (
                    filas.map((fila, index) => (
                        <tr
                            key={fila.id || fila.codigo || fila.nombreRuta || fila.descripcion || index}
                            className="border-b border-slate-100 last:border-b-0"
                        >
                            {columnas.map((col) => (
                                <td
                                    key={col.key}
                                    className={`px-3 py-3 text-slate-700 align-top ${
                                        col.align === "right" ? "text-right" : ""
                                    }`}
                                >
                                    {col.render ? col.render(fila) : fila[col.key] ?? "—"}
                                </td>
                            ))}
                        </tr>
                    ))
                ) : (
                    <tr>
                        <td
                            colSpan={columnas.length}
                            className="px-3 py-6 text-center text-slate-500"
                        >
                            {vacio}
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
    </div>
);

const BarraHorizontal = ({
    items = [],
    valueKey = "totalCantidad",
    labelKey = "nombre",
    emptyText = "Sin datos.",
}) => {
    const maximo = useMemo(() => {
        if (!items.length) return 0;
        return Math.max(...items.map((item) => Number(item[valueKey] || 0)));
    }, [items, valueKey]);

    if (!items.length) {
        return <div className="text-sm text-slate-500">{emptyText}</div>;
    }

    return (
        <div className="space-y-4">
            {items.map((item, index) => {
                const valor = Number(item[valueKey] || 0);
                const porcentaje = obtenerPorcentaje(valor, maximo);

                return (
                    <div key={`${item[labelKey]}-${index}`}>
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                            <p className="text-sm font-medium text-slate-700 truncate">
                                {item[labelKey] || "Sin nombre"}
                            </p>
                            <p className="text-sm font-semibold text-slate-800 shrink-0">
                                {formatearNumero(valor)}
                            </p>
                        </div>

                        <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{ width: `${porcentaje}%` }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export const DashboardGeneral = ({ setSidebar, navegar }) => {
    const abrirMenu = () => setSidebar?.(true);
    const volver = () => navegar?.("despachos");

    const hoy = new Date();
    const hace30 = new Date();
    hace30.setDate(hoy.getDate() - 30);

    const [fechaInicio, setFechaInicio] = useState(hace30.toISOString().slice(0, 10));
    const [fechaFin, setFechaFin] = useState(hoy.toISOString().slice(0, 10));
    const [loading, setLoading] = useState(false);

    const [dashboard, setDashboard] = useState({
        resumenGeneral: {},
        resumenJornadas: [],
        categorias: [],
        topRutas: [],
        topProductos: [],
        ultimosDespachos: [],
        ultimosArchivos: [],
    });

    const intentarJson = async (resp) => {
        const raw = await resp.text();

        try {
            return JSON.parse(raw);
        } catch (error) {
            console.error("Respuesta no JSON:", raw);
            throw new Error(
                raw?.trim()
                    ? `El backend no devolvió JSON válido. Respuesta: ${raw.slice(0, 180)}`
                    : "No se recibió respuesta válida del servidor."
            );
        }
    };

    const construirUrls = (params) => {
        const base = (API_BASE || "").replace(/\/+$/, "");
        const query = params.toString() ? `?${params.toString()}` : "";
        const urls = [];

        if (base) {
            urls.push(`${base}/Dashboard/DashboardGetResumen.php${query}`);
            urls.push(`${base}/Despachos/DashboardGetResumen.php${query}`);
        }

        urls.push(`https://gruponava.com.co/servicesPae/Dashboard/DashboardGetResumen.php${query}`);
        urls.push(`https://gruponava.com.co/servicesPae/Despachos/DashboardGetResumen.php${query}`);

        return [...new Set(urls)];
    };

    const cargarDashboard = async (usarFechas = true) => {
        try {
            setLoading(true);

            const params = new URLSearchParams();
            if (usarFechas && fechaInicio && fechaFin) {
                params.append("fechaInicio", fechaInicio);
                params.append("fechaFin", fechaFin);
            }

            const urls = construirUrls(params);

            let ultimoError = null;
            let data = null;

            for (const url of urls) {
                try {
                    const resp = await fetch(url, {
                        method: "GET",
                        headers: {
                            Accept: "application/json",
                        },
                    });

                    const json = await intentarJson(resp);

                    if (!resp.ok || !json?.ok) {
                        throw new Error(
                            json?.mensaje || `Error HTTP ${resp.status} al consultar dashboard.`
                        );
                    }

                    data = json;
                    break;
                } catch (error) {
                    console.error(`Falló URL: ${url}`, error);
                    ultimoError = error;
                }
            }

            if (!data) {
                throw ultimoError || new Error("No fue posible cargar el dashboard.");
            }

            setDashboard({
                resumenGeneral: data.resumenGeneral || {},
                resumenJornadas: Array.isArray(data.resumenJornadas) ? data.resumenJornadas : [],
                categorias: Array.isArray(data.categorias) ? data.categorias : [],
                topRutas: Array.isArray(data.topRutas) ? data.topRutas : [],
                topProductos: Array.isArray(data.topProductos) ? data.topProductos : [],
                ultimosDespachos: Array.isArray(data.ultimosDespachos) ? data.ultimosDespachos : [],
                ultimosArchivos: Array.isArray(data.ultimosArchivos) ? data.ultimosArchivos : [],
            });
        } catch (error) {
            console.error("Error cargando dashboard:", error);
            toast.error(error.message || "Error cargando el dashboard.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cargarDashboard(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const resumen = dashboard.resumenGeneral || {};

    const jornadasOrdenadas = useMemo(() => {
        const jornadas = Array.isArray(dashboard.resumenJornadas) ? dashboard.resumenJornadas : [];
        return [...jornadas].sort((a, b) => {
            const ia = JOURNEY_ORDER.indexOf(a.jornada);
            const ib = JOURNEY_ORDER.indexOf(b.jornada);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });
    }, [dashboard.resumenJornadas]);

    const alertas = useMemo(() => {
        const archivosConError = (dashboard.ultimosArchivos || []).filter(
            (item) => item.mensajeError && String(item.mensajeError).trim() !== ""
        ).length;

        const despachosSinRutas = (dashboard.ultimosDespachos || []).filter(
            (item) => Number(item.totalRutas || 0) === 0
        ).length;

        const productosSinCategoria = (dashboard.categorias || []).find(
            (item) => !item.nombre || item.nombre === "Sin categoría"
        );

        return [
            {
                titulo: "Archivos con novedad",
                valor: archivosConError,
                detalle: archivosConError
                    ? "Revisar los últimos archivos cargados"
                    : "Sin novedades recientes",
            },
            {
                titulo: "Despachos sin rutas",
                valor: despachosSinRutas,
                detalle: despachosSinRutas
                    ? "Hay despachos recientes pendientes por validar"
                    : "Todos los últimos despachos tienen rutas",
            },
            {
                titulo: "Productos sin categoría",
                valor: productosSinCategoria ? productosSinCategoria.totalProductos : 0,
                detalle: productosSinCategoria
                    ? "Existen productos pendientes de clasificar"
                    : "Clasificación de categorías al día",
            },
            {
                titulo: "Última actualización",
                valor: dashboard.ultimosArchivos?.[0]?.created_at
                    ? formatearFechaHora(dashboard.ultimosArchivos[0].created_at)
                    : "—",
                detalle: "Tomado del último archivo procesado",
            },
        ];
    }, [dashboard.ultimosArchivos, dashboard.ultimosDespachos, dashboard.categorias]);

    return (
        <div className="h-full w-full overflow-y-auto overflow-x-hidden bg-slate-50">
            <div className="w-full max-w-none px-4 md:px-6 py-4 md:py-6 space-y-6 pb-10">
                <div className="w-full bg-white border border-slate-200 rounded-2xl shadow-sm px-4 py-4 md:px-6 md:py-5">
                    <div className="flex flex-col 2xl:flex-row 2xl:items-center 2xl:justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                            <button
                                type="button"
                                onClick={abrirMenu}
                                className="lg:hidden w-11 h-11 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center shrink-0"
                            >
                                <IoMenu className="text-xl" />
                            </button>

                            {/* <button
                                type="button"
                                onClick={volver}
                                className="hidden md:flex w-11 h-11 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 items-center justify-center shrink-0"
                            >
                                <FaArrowLeft className="text-base" />
                            </button> */}

                            <div className="min-w-0">
                                <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
                                    Dashboard General
                                </h1>
                                <p className="text-sm md:text-base text-slate-500 mt-1">
                                    Resumen consolidado de despachos, rutas, productos, categorías y cobertura.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 w-full 2xl:w-auto">
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 min-w-[180px]">
                                <FaCalendarDays className="text-slate-500 shrink-0" />
                                <input
                                    type="date"
                                    value={fechaInicio}
                                    onChange={(e) => setFechaInicio(e.target.value)}
                                    className="bg-transparent text-sm text-slate-700 outline-none w-full"
                                />
                            </div>

                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 min-w-[180px]">
                                <FaCalendarDays className="text-slate-500 shrink-0" />
                                <input
                                    type="date"
                                    value={fechaFin}
                                    onChange={(e) => setFechaFin(e.target.value)}
                                    className="bg-transparent text-sm text-slate-700 outline-none w-full"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={() => cargarDashboard(true)}
                                disabled={loading}
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold w-full"
                            >
                                Aplicar filtro
                            </button>

                            <button
                                type="button"
                                onClick={() => cargarDashboard(false)}
                                disabled={loading}
                                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold flex items-center justify-center gap-2 w-full"
                            >
                                <FaArrowsRotate className={loading ? "animate-spin" : ""} />
                                General
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="w-full bg-white border border-slate-200 rounded-2xl shadow-sm p-10 text-center text-slate-500">
                        Cargando dashboard...
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
                            <CardKPI titulo="Despachos" valor={formatearNumero(resumen.totalDespachos)} subtitulo="Registros consolidados" icono={FaBoxesStacked} color="emerald" />
                            <CardKPI titulo="Archivos cargados" valor={formatearNumero(resumen.totalArchivos)} subtitulo="Archivos procesados" icono={FaFileExcel} color="sky" />
                            <CardKPI titulo="Rutas" valor={formatearNumero(resumen.totalRutas)} subtitulo="Rutas encontradas" icono={FaRoute} color="amber" />
                            <CardKPI titulo="Productos" valor={formatearNumero(resumen.totalProductos)} subtitulo="Productos distintos" icono={FaCube} color="violet" />
                            <CardKPI titulo="Sedes / Colegios" valor={formatearNumero(Number(resumen.totalSedes || 0) || Number(resumen.totalColegios || 0))} subtitulo="Puntos impactados" icono={FaSchool} color="slate" />
                            <CardKPI titulo="Cantidad total" valor={formatearNumero(resumen.totalCantidad)} subtitulo="Suma general cargada" icono={FaChartColumn} color="emerald" />
                            <CardKPI titulo="Cobertura total" valor={formatearNumero(resumen.totalCoberturaRuta)} subtitulo="Cobertura consolidada" icono={FaLayerGroup} color="sky" />
                            <CardKPI titulo="PAC / UND" valor={`${formatearNumero(resumen.totalCajasPacas)} / ${formatearNumero(resumen.totalUnidades)}`} subtitulo="PAC o cajas y unidades" icono={FaBoxesStacked} color="amber" />
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 w-full">
                            <div className="xl:col-span-2 min-w-0">
                                <SectionCard titulo="Comportamiento por jornada" subtitulo="Distribución general por AM, PM y Jornada Única" icono={FaClock} color="sky">
                                    <BarraHorizontal
                                        items={jornadasOrdenadas.map((item) => ({
                                            ...item,
                                            nombre: JOURNEY_LABELS[item.jornada] || item.jornada,
                                        }))}
                                        valueKey="totalCantidad"
                                        labelKey="nombre"
                                        emptyText="No hay datos por jornada."
                                    />
                                </SectionCard>
                            </div>

                            <div className="min-w-0">
                                <SectionCard titulo="Resumen rápido por jornada" subtitulo="Lectura operativa" icono={FaClock} color="sky">
                                    <div className="space-y-3">
                                        {jornadasOrdenadas.length ? (
                                            jornadasOrdenadas.map((item) => (
                                                <JourneyMiniCard key={item.jornada} item={item} />
                                            ))
                                        ) : (
                                            <p className="text-sm text-slate-500">
                                                No hay información por jornada.
                                            </p>
                                        )}
                                    </div>
                                </SectionCard>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full">
                            <div className="min-w-0">
                                <SectionCard titulo="Top rutas" subtitulo="Rutas con mayor volumen consolidado" icono={FaRoute} color="emerald">
                                    <TablaSimple
                                        columnas={[
                                            {
                                                key: "nombreRuta",
                                                label: "Ruta",
                                                render: (fila) => (
                                                    <div>
                                                        <p className="font-semibold text-slate-800">{fila.nombreRuta || "—"}</p>
                                                        <p className="text-xs text-slate-500">Orden: {fila.ordenRuta ?? "—"}</p>
                                                    </div>
                                                ),
                                            },
                                            { key: "totalProductos", label: "Productos", align: "right", render: (fila) => formatearNumero(fila.totalProductos) },
                                            { key: "totalCantidad", label: "Cantidad", align: "right", render: (fila) => formatearNumero(fila.totalCantidad) },
                                            { key: "totalCoberturaRuta", label: "Cobertura", align: "right", render: (fila) => formatearNumero(fila.totalCoberturaRuta) },
                                            { key: "totalUnidades", label: "Unidades", align: "right", render: (fila) => formatearNumero(fila.totalUnidades) },
                                        ]}
                                        filas={dashboard.topRutas}
                                        vacio="No hay rutas para mostrar."
                                    />
                                </SectionCard>
                            </div>

                            <div className="min-w-0">
                                <SectionCard titulo="Top productos" subtitulo="Productos con mayor movimiento" icono={FaCube} color="violet">
                                    <TablaSimple
                                        columnas={[
                                            {
                                                key: "descripcion",
                                                label: "Producto",
                                                render: (fila) => (
                                                    <div>
                                                        <p className="font-semibold text-slate-800">{fila.descripcion || "—"}</p>
                                                        <p className="text-xs text-slate-500">Código: {fila.codigo || "—"}</p>
                                                    </div>
                                                ),
                                            },
                                            { key: "totalRutas", label: "Rutas", align: "right", render: (fila) => formatearNumero(fila.totalRutas) },
                                            { key: "totalCantidad", label: "Cantidad", align: "right", render: (fila) => formatearNumero(fila.totalCantidad) },
                                            { key: "totalCajasPacas", label: "PAC / Cajas", align: "right", render: (fila) => formatearNumero(fila.totalCajasPacas) },
                                            { key: "totalUnidades", label: "Unidades", align: "right", render: (fila) => formatearNumero(fila.totalUnidades) },
                                        ]}
                                        filas={dashboard.topProductos}
                                        vacio="No hay productos para mostrar."
                                    />
                                </SectionCard>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full">
                            <div className="min-w-0">
                                <SectionCard titulo="Resumen por categoría" subtitulo="Participación de categorías en el volumen general" icono={FaLayerGroup} color="amber">
                                    <div className="space-y-5">
                                        <BarraHorizontal
                                            items={(dashboard.categorias || []).slice(0, 8).map((item) => ({
                                                ...item,
                                                nombre: item.nombre || "Sin categoría",
                                            }))}
                                            valueKey="totalCantidad"
                                            labelKey="nombre"
                                            emptyText="No hay categorías disponibles."
                                        />

                                        <div className="pt-2">
                                            <TablaSimple
                                                columnas={[
                                                    { key: "nombre", label: "Categoría", render: (fila) => fila.nombre || "Sin categoría" },
                                                    { key: "totalProductos", label: "Productos", align: "right", render: (fila) => formatearNumero(fila.totalProductos) },
                                                    { key: "totalCantidad", label: "Cantidad", align: "right", render: (fila) => formatearNumero(fila.totalCantidad) },
                                                ]}
                                                filas={(dashboard.categorias || []).slice(0, 6)}
                                                vacio="No hay categorías para mostrar."
                                            />
                                        </div>
                                    </div>
                                </SectionCard>
                            </div>

                            <div className="min-w-0">
                                <SectionCard titulo="Estado del sistema" subtitulo="Validaciones rápidas y novedades recientes" icono={FaTriangleExclamation} color="rose">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {alertas.map((item, index) => (
                                            <div
                                                key={`${item.titulo}-${index}`}
                                                className="border border-slate-200 rounded-xl p-4 bg-slate-50"
                                            >
                                                <p className="text-sm text-slate-500">{item.titulo}</p>
                                                <p className="mt-2 text-xl font-bold text-slate-800 break-words">
                                                    {typeof item.valor === "number" ? formatearNumero(item.valor) : item.valor}
                                                </p>
                                                <p className="mt-2 text-sm text-slate-500">{item.detalle}</p>
                                            </div>
                                        ))}
                                    </div>
                                </SectionCard>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 w-full">
                            <div className="min-w-0">
                                <SectionCard titulo="Últimos despachos" subtitulo="Actividad reciente del módulo" icono={FaBoxesStacked} color="slate">
                                    <TablaSimple
                                        columnas={[
                                            {
                                                key: "codigo",
                                                label: "Despacho",
                                                render: (fila) => (
                                                    <div>
                                                        <p className="font-semibold text-slate-800">{fila.codigo || `Despacho #${fila.id}`}</p>
                                                        <p className="text-xs text-slate-500">{formatearFecha(fila.fechaDespacho)}</p>
                                                    </div>
                                                ),
                                            },
                                            { key: "tipoPeriodo", label: "Periodo", render: (fila) => fila.tipoPeriodo || "—" },
                                            { key: "totalRutas", label: "Rutas", align: "right", render: (fila) => formatearNumero(fila.totalRutas) },
                                            { key: "totalProductos", label: "Productos", align: "right", render: (fila) => formatearNumero(fila.totalProductos) },
                                            { key: "totalCantidad", label: "Cantidad", align: "right", render: (fila) => formatearNumero(fila.totalCantidad) },
                                        ]}
                                        filas={dashboard.ultimosDespachos}
                                        vacio="No hay despachos recientes."
                                    />
                                </SectionCard>
                            </div>

                            <div className="min-w-0">
                                <SectionCard titulo="Últimos archivos cargados" subtitulo="Control de los archivos procesados recientemente" icono={FaFileExcel} color="sky">
                                    <TablaSimple
                                        columnas={[
                                            {
                                                key: "nombreArchivo",
                                                label: "Archivo",
                                                render: (fila) => (
                                                    <div>
                                                        <p className="font-semibold text-slate-800 break-all">{fila.nombreArchivo || "—"}</p>
                                                        <p className="text-xs text-slate-500">
                                                            {fila.codigoDespacho || `Despacho #${fila.idDespacho}`}
                                                        </p>
                                                    </div>
                                                ),
                                            },
                                            { key: "tipoArchivo", label: "Jornada", render: (fila) => JOURNEY_LABELS[fila.tipoArchivo] || fila.tipoArchivo || "—" },
                                            { key: "rutasDetectadas", label: "Rutas", align: "right", render: (fila) => formatearNumero(fila.rutasDetectadas) },
                                            { key: "created_at", label: "Fecha", render: (fila) => formatearFechaHora(fila.created_at) },
                                        ]}
                                        filas={dashboard.ultimosArchivos}
                                        vacio="No hay archivos recientes."
                                    />
                                </SectionCard>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};