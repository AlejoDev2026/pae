import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../../constants";
import { IoMenu } from "react-icons/io5";
import { FaArrowLeft, FaChevronDown, FaChevronUp, FaFileExcel } from "react-icons/fa";
import { toast } from "react-toastify";

const TIPO_ARCHIVO_CONFIG = {
    AM: {
        label: "AM",
        color: "bg-emerald-50 border-emerald-200 text-emerald-700",
        orden: 1,
    },
    PM: {
        label: "PM",
        color: "bg-sky-50 border-sky-200 text-sky-700",
        orden: 2,
    },
    JORNADA_UNICA: {
        label: "Jornada Única",
        color: "bg-violet-50 border-violet-200 text-violet-700",
        orden: 3,
    },
};

const normalizarTipoArchivo = (valor) => {
    return String(valor || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
};

const obtenerConfigTipoArchivo = (tipoArchivo) => {
    const key = normalizarTipoArchivo(tipoArchivo);

    if (TIPO_ARCHIVO_CONFIG[key]) {
        return {
            key,
            ...TIPO_ARCHIVO_CONFIG[key],
        };
    }

    return {
        key: key || "SIN_JORNADA",
        label: key ? key.replace(/_/g, " ") : "Sin jornada",
        color: "bg-slate-50 border-slate-200 text-slate-700",
        orden: 99,
    };
};

const formatearNumero = (valor) => {
    const numero = Number(valor ?? 0);
    if (!Number.isFinite(numero)) return "0";

    return numero.toLocaleString("es-CO", {
        minimumFractionDigits: numero % 1 !== 0 ? 2 : 0,
        maximumFractionDigits: 2,
    });
};

const formatearFechaStorage = (valor) => {
    if (!valor) return "";

    const texto = String(valor).trim();
    if (!texto) return "";

    if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
        return texto;
    }

    const fecha = new Date(texto);
    if (Number.isNaN(fecha.getTime())) return "";

    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, "0");
    const day = String(fecha.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const formatearFechaVisual = (valor) => {
    if (!valor) return "";

    const texto = String(valor).trim();
    if (!texto) return "";

    const fecha = new Date(
        /^\d{4}-\d{2}-\d{2}$/.test(texto) ? `${texto}T00:00:00` : texto
    );

    if (Number.isNaN(fecha.getTime())) return texto;

    return new Intl.DateTimeFormat("es-CO", {
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(fecha);
};

const guardarFechasConsumoStorage = (despacho) => {
    if (!despacho) return;

    const desdeCruda =
        despacho?.fechaConsumoDesde ||
        despacho?.fechaconsumodesde ||
        "";

    const hastaCruda =
        despacho?.fechaConsumoHasta ||
        despacho?.fechaconsumohasta ||
        "";

    const desde = formatearFechaStorage(desdeCruda);
    const hasta = formatearFechaStorage(hastaCruda);

    if (desde) {
        localStorage.setItem("fechaconsumodesde", desde);
    }

    if (hasta) {
        localStorage.setItem("fechaconsumohasta", hasta);
    }
};

const obtenerColorEstado = (estado) => {
    const codigo = estado?.codigo?.toUpperCase?.() || "";
    const nombre = estado?.nombre?.toUpperCase?.() || "";

    if (codigo.includes("ACTIVO") || nombre.includes("ACTIVO")) return "bg-emerald-500";
    if (codigo.includes("ERROR") || nombre.includes("ERROR")) return "bg-red-500";
    if (codigo.includes("PROCESANDO") || nombre.includes("PROCESANDO")) return "bg-amber-500";
    return "bg-slate-500";
};

const contarResumenTipo = (archivos = []) => {
    let totalRutas = 0;
    let totalDetalles = 0;

    archivos.forEach((archivo) => {
        const rutas = Array.isArray(archivo?.rutas) ? archivo.rutas : [];
        totalRutas += rutas.length;

        rutas.forEach((ruta) => {
            totalDetalles += Array.isArray(ruta?.detalles) ? ruta.detalles.length : 0;
        });
    });

    return {
        totalArchivos: archivos.length,
        totalRutas,
        totalDetalles,
    };
};

const construirMatrizRuta = (ruta) => {
    const detalles = Array.isArray(ruta?.detalles) ? ruta.detalles : [];

    const colegiosMap = new Map();
    const productosMap = new Map();

    detalles.forEach((detalle) => {
        const idColegio = detalle?.colegio?.idColegio ?? `sin-${detalle?.colegio?.nombre || ""}`;
        const nombreColegio = [detalle?.colegio?.codigo, detalle?.colegio?.nombre]
            .filter(Boolean)
            .join(" - ");

        if (!colegiosMap.has(idColegio)) {
            colegiosMap.set(idColegio, {
                idColegio,
                nombre: nombreColegio || "Sin colegio",
            });
        }

        const consecutivo = detalle?.consecutivo ?? "";

        const producto =
            detalle?.productoExcel ||
            detalle?.producto?.descripcion ||
            "Sin producto";

        const unidadCobertura =
            detalle?.unidadCoberturaExcel ||
            detalle?.unidadCobertura ||
            "";

        const keyProducto = `${consecutivo}||${producto}||${unidadCobertura}`;

        if (!productosMap.has(keyProducto)) {
            productosMap.set(keyProducto, {
                consecutivo,
                producto,
                unidadCobertura,
                cantidadesPorColegio: {},
                totalCoberturaRuta: Number(detalle?.totalCoberturaRuta ?? 0),
                cajasPacas: Number(detalle?.cajasPacas ?? 0),
                unidades: Number(detalle?.unidades ?? 0),
                observacion: detalle?.observacion || "",
            });
        }

        const fila = productosMap.get(keyProducto);
        fila.cantidadesPorColegio[idColegio] = Number(detalle?.cantidad ?? 0);
    });

    const colegios = Array.from(colegiosMap.values());

    const filas = Array.from(productosMap.values()).sort((a, b) => {
        const ca = Number(a.consecutivo || 0);
        const cb = Number(b.consecutivo || 0);
        return ca - cb;
    });

    return { colegios, filas };
};

const construirJornadasDinamicas = (archivosPorTipo = {}) => {
    const jornadasMap = new Map();

    if (Array.isArray(archivosPorTipo)) {
        archivosPorTipo.forEach((archivo) => {
            const tipoArchivo = archivo?.tipoArchivo || archivo?.tipo || "SIN_JORNADA";
            const config = obtenerConfigTipoArchivo(tipoArchivo);

            if (!jornadasMap.has(config.key)) {
                jornadasMap.set(config.key, {
                    ...config,
                    archivos: [],
                });
            }

            jornadasMap.get(config.key).archivos.push(archivo);
        });
    } else {
        Object.entries(archivosPorTipo || {}).forEach(([tipoArchivo, archivos]) => {
            const config = obtenerConfigTipoArchivo(tipoArchivo);

            jornadasMap.set(config.key, {
                ...config,
                archivos: Array.isArray(archivos) ? archivos : [],
            });
        });
    }

    return Array.from(jornadasMap.values()).sort((a, b) => {
        if (a.orden === b.orden) return a.label.localeCompare(b.label, "es");
        return a.orden - b.orden;
    });
};

export const DetalleDespachoRoldanillo = ({ setSidebar, navegar }) => {
    const abrirMenu = () => setSidebar(true);
    const estadoPagina = (pagina) => navegar(pagina);

    const [loading, setLoading] = useState(false);
    const [detalle, setDetalle] = useState(null);
    const [seccionesAbiertas, setSeccionesAbiertas] = useState({});
    const [archivosAbiertos, setArchivosAbiertos] = useState({});
    const [rutasAbiertas, setRutasAbiertas] = useState({});

    const idDespacho = localStorage.getItem("idDespachoDetalle");

    const jornadas = useMemo(() => {
        return construirJornadasDinamicas(detalle?.archivos || {});
    }, [detalle]);

    const irAInformes = () => {
        if (!idDespacho) {
            toast.warning("No se encontró el despacho para consultar informes");
            return;
        }

        localStorage.setItem("idDespachoInforme", idDespacho);
        estadoPagina("InformesHomeRoldanillo");
    };

    const obtenerDetalle = async () => {
        if (!idDespacho) {
            toast.error("No se encontró el despacho seleccionado");
            estadoPagina("Despachos");
            return;
        }

        try {
            setLoading(true);

            const url = `${API_BASE}Despachos/DespachosGetDetalle.php?idDespacho=${idDespacho}`;
            const res = await fetch(url, {
                method: "GET",
                cache: "no-store",
                headers: {
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    Pragma: "no-cache",
                    Expires: "0",
                },
            });

            const response = await res.json();

            if (response.rpta !== "si") {
                toast.error(response.mensaje || "No se pudo consultar el detalle del despacho");
                setDetalle(null);
                return;
            }

            const data = response.data || null;
            const jornadasDetectadas = construirJornadasDinamicas(data?.archivos || {});

            setDetalle(data);
            guardarFechasConsumoStorage(data?.despacho);

            const nuevasSeccionesAbiertas = {};
            const nuevosArchivosAbiertos = {};
            const nuevasRutasAbiertas = {};

            jornadasDetectadas.forEach((jornada) => {
                nuevasSeccionesAbiertas[jornada.key] = false;

                (jornada.archivos || []).forEach((archivo) => {
                    nuevosArchivosAbiertos[`archivo-${archivo.idDespachoArchivo}`] = false;

                    (archivo.rutas || []).forEach((ruta) => {
                        nuevasRutasAbiertas[`ruta-${archivo.idDespachoArchivo}-${ruta.idRuta ?? "sinruta"}`] = false;
                    });
                });
            });

            setSeccionesAbiertas(nuevasSeccionesAbiertas);
            setArchivosAbiertos(nuevosArchivosAbiertos);
            setRutasAbiertas(nuevasRutasAbiertas);
        } catch (error) {
            console.error("Error al consultar detalle del despacho:", error);
            toast.error("Ocurrió un error al consultar el detalle del despacho");
            setDetalle(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        obtenerDetalle();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const resumenGeneral = useMemo(() => {
        let totalArchivos = 0;
        let totalRutas = 0;
        let totalDetalles = 0;

        jornadas.forEach((jornada) => {
            const resumen = contarResumenTipo(jornada.archivos || []);
            totalArchivos += resumen.totalArchivos;
            totalRutas += resumen.totalRutas;
            totalDetalles += resumen.totalDetalles;
        });

        return {
            totalArchivos,
            totalRutas,
            totalDetalles,
        };
    }, [jornadas]);

    const fechaDespachoVisual = useMemo(
        () => formatearFechaVisual(detalle?.despacho?.fechaDespacho),
        [detalle]
    );

    const fechaConsumoDesdeVisual = useMemo(
        () => formatearFechaVisual(detalle?.despacho?.fechaConsumoDesde),
        [detalle]
    );

    const fechaConsumoHastaVisual = useMemo(
        () => formatearFechaVisual(detalle?.despacho?.fechaConsumoHasta),
        [detalle]
    );

    const toggleSeccion = (tipo) => {
        setSeccionesAbiertas((prev) => ({
            ...prev,
            [tipo]: !prev[tipo],
        }));
    };

    const toggleArchivo = (idDespachoArchivo) => {
        const key = `archivo-${idDespachoArchivo}`;
        setArchivosAbiertos((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const toggleRuta = (idDespachoArchivo, idRuta) => {
        const key = `ruta-${idDespachoArchivo}-${idRuta ?? "sinruta"}`;
        setRutasAbiertas((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const renderTablaMatrizRuta = (ruta) => {
        const { colegios, filas } = construirMatrizRuta(ruta);

        if (!filas.length) {
            return (
                <div className="text-sm text-slate-500 py-4">
                    No hay detalles para esta ruta.
                </div>
            );
        }

        return (
            <div className="w-full overflow-x-auto border border-slate-200 rounded-xl">
                <table className="min-w-max w-full text-sm border-separate border-spacing-0">
                    <thead>
                        <tr>
                            <th
                                colSpan={3}
                                className="bg-slate-200 text-slate-900 font-bold text-lg px-4 py-4 border-b border-r border-slate-300 text-center"
                            >
                                {ruta?.nombreRuta || "Sin ruta"}
                            </th>

                            {colegios.map((colegio) => (
                                <th
                                    key={`head-${colegio.idColegio}`}
                                    className="bg-slate-200 text-slate-900 font-semibold px-3 py-4 border-b border-r border-slate-300 text-center whitespace-normal"
                                >
                                    <div className="[writing-mode:vertical-rl] rotate-180 mx-auto text-sm leading-5 h-[180px] flex items-center justify-center">
                                        {colegio.nombre}
                                    </div>
                                </th>
                            ))}

                            <th className="bg-slate-200 text-slate-900 font-semibold px-3 py-4 border-b border-r border-slate-300 text-center min-w-[70px]">
                                <div className="[writing-mode:vertical-rl] rotate-180 mx-auto text-sm leading-5 h-[180px] flex items-center justify-center">
                                    TOTAL COBERTURA RUTA
                                </div>
                            </th>

                            <th className="bg-slate-200 text-slate-900 font-semibold px-3 py-4 border-b border-r border-slate-300 text-center min-w-[70px]">
                                <div className="[writing-mode:vertical-rl] rotate-180 mx-auto text-sm leading-5 h-[180px] flex items-center justify-center">
                                    CAJAS / PACAS
                                </div>
                            </th>

                            <th className="bg-slate-200 text-slate-900 font-semibold px-3 py-4 border-b border-slate-300 text-center min-w-[70px]">
                                <div className="[writing-mode:vertical-rl] rotate-180 mx-auto text-sm leading-5 h-[180px] flex items-center justify-center">
                                    UNIDADES
                                </div>
                            </th>
                        </tr>

                        <tr className="bg-slate-100 text-slate-800">
                            <th className="px-2 py-2 border-b border-r border-slate-300 text-center min-w-[50px]">N°</th>
                            <th className="px-3 py-2 border-b border-r border-slate-300 text-left min-w-[260px]">PRODUCTO</th>
                            <th className="px-3 py-2 border-b border-r border-slate-300 text-center min-w-[120px]">
                                UNIDAD / COBERTURA
                            </th>

                            {colegios.map((colegio) => (
                                <th
                                    key={`sub-${colegio.idColegio}`}
                                    className="px-3 py-2 border-b border-r border-slate-300 text-center"
                                >
                                    &nbsp;
                                </th>
                            ))}

                            <th className="px-3 py-2 border-b border-r border-slate-300 text-center">&nbsp;</th>
                            <th className="px-3 py-2 border-b border-r border-slate-300 text-center">&nbsp;</th>
                            <th className="px-3 py-2 border-b border-slate-300 text-center">&nbsp;</th>
                        </tr>
                    </thead>

                    <tbody>
                        {filas.map((fila, index) => (
                            <tr
                                key={`${fila.consecutivo}-${fila.producto}-${fila.unidadCobertura}`}
                                className="hover:bg-slate-50"
                            >
                                <td className="px-2 py-2 border-b border-r border-slate-200 text-center">
                                    {fila.consecutivo || index + 1}
                                </td>

                                <td className="px-3 py-2 border-b border-r border-slate-200">
                                    {fila.producto} / {fila.unidadCobertura || ""}
                                </td>

                                <td className="px-3 py-2 border-b border-r border-slate-200 text-center">
                                    {fila.unidadCobertura || ""}
                                </td>

                                {colegios.map((colegio) => (
                                    <td
                                        key={`val-${fila.consecutivo}-${colegio.idColegio}`}
                                        className="px-3 py-2 border-b border-r border-slate-200 text-right"
                                    >
                                        {formatearNumero(fila.cantidadesPorColegio[colegio.idColegio] ?? 0)}
                                    </td>
                                ))}

                                <td className="px-3 py-2 border-b border-r border-slate-200 text-right font-medium">
                                    {formatearNumero(fila.totalCoberturaRuta)}
                                </td>

                                <td className="px-3 py-2 border-b border-r border-slate-200 text-right">
                                    {formatearNumero(fila.cajasPacas)}
                                </td>

                                <td className="px-3 py-2 border-b border-slate-200 text-right">
                                    {formatearNumero(fila.unidades)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const renderRutas = (archivo) => {
        const rutas = Array.isArray(archivo?.rutas) ? archivo.rutas : [];

        if (!rutas.length) {
            return (
                <div className="text-sm text-slate-500 mt-3">
                    Este archivo no tiene rutas registradas.
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-3 mt-4">
                {rutas.map((ruta) => {
                    const rutaKey = `ruta-${archivo.idDespachoArchivo}-${ruta.idRuta ?? "sinruta"}`;
                    const abierta = !!rutasAbiertas[rutaKey];
                    const totalDetallesRuta = Array.isArray(ruta.detalles) ? ruta.detalles.length : 0;

                    return (
                        <div key={rutaKey} className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                            <button
                                type="button"
                                onClick={() => toggleRuta(archivo.idDespachoArchivo, ruta.idRuta)}
                                className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between gap-4"
                            >
                                <div className="text-left">
                                    <div className="font-semibold text-slate-800">
                                        {ruta.nombreRuta || "Sin ruta"}
                                    </div>
                                    <div className="text-sm text-slate-500">
                                        Detalles: {totalDetallesRuta}
                                    </div>
                                </div>

                                <div className="text-slate-500">
                                    {abierta ? <FaChevronUp /> : <FaChevronDown />}
                                </div>
                            </button>

                            {abierta && (
                                <div className="p-4">
                                    {renderTablaMatrizRuta(ruta)}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderArchivosPorJornada = (jornada) => {
        const archivos = Array.isArray(jornada.archivos) ? jornada.archivos : [];
        const abierta = !!seccionesAbiertas[jornada.key];
        const resumen = contarResumenTipo(archivos);

        return (
            <section key={jornada.key} className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                <button
                    type="button"
                    onClick={() => toggleSeccion(jornada.key)}
                    className={`w-full px-5 py-4 border-b flex items-center justify-between gap-4 ${jornada.color}`}
                >
                    <div className="text-left">
                        <h2 className="text-lg font-bold">{jornada.label}</h2>
                        <p className="text-sm opacity-90">
                            Archivos: {resumen.totalArchivos} | Rutas: {resumen.totalRutas} | Detalles: {resumen.totalDetalles}
                        </p>
                    </div>

                    <div>
                        {abierta ? <FaChevronUp /> : <FaChevronDown />}
                    </div>
                </button>

                {abierta && (
                    <div className="p-5">
                        {archivos.length === 0 ? (
                            <div className="text-slate-500 text-sm">
                                No hay archivos cargados para {jornada.label}.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {archivos.map((archivo) => {
                                    const archivoKey = `archivo-${archivo.idDespachoArchivo}`;
                                    const archivoAbierto = !!archivosAbiertos[archivoKey];
                                    const totalDetallesArchivo = (archivo.rutas || []).reduce(
                                        (acc, ruta) => acc + ((ruta.detalles || []).length),
                                        0
                                    );

                                    return (
                                        <div
                                            key={archivo.idDespachoArchivo}
                                            className="border border-slate-200 rounded-2xl overflow-hidden"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => toggleArchivo(archivo.idDespachoArchivo)}
                                                className="w-full px-4 py-4 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between gap-4"
                                            >
                                                <div className="flex items-start gap-3 text-left min-w-0">
                                                    <FaFileExcel className="text-emerald-600 mt-1 shrink-0" />

                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-slate-800 break-all">
                                                            {archivo.nombreArchivo || "Sin nombre"}
                                                        </div>
                                                        <div className="text-sm text-slate-500 mt-1">
                                                            Hojas: {archivo.hojasDetectadas || 0} | Rutas detectadas: {archivo.rutasDetectadas || 0} | Detalles: {totalDetallesArchivo}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="text-slate-500 shrink-0">
                                                    {archivoAbierto ? <FaChevronUp /> : <FaChevronDown />}
                                                </div>
                                            </button>

                                            {archivoAbierto && (
                                                <div className="px-4 pb-4">
                                                    {renderRutas(archivo)}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </section>
        );
    };

    return (
        <div className="w-full h-screen flex flex-col p-4 md:p-6 gap-4 md:gap-6">
            <div className="flex items-center gap-5 lg:hidden">
                <div
                    className="p-2 rounded-lg hover:bg-gray-300 cursor-pointer"
                    onClick={abrirMenu}
                >
                    <IoMenu className="text-2xl" />
                </div>

                <h1 className="text-lg font-bold">
                    Detalle del despacho roldanillo
                </h1>
            </div>

            <article className="flex-1 bg-white shadow-lg rounded-lg p-4 md:p-6 flex flex-col overflow-hidden">
                <nav className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            className="p-2 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                            onClick={() => estadoPagina("DespachosRoldanillo")}
                            type="button"
                        >
                            <FaArrowLeft className="text-slate-700" />
                        </button>

                        <h1 className="text-[calc(0.8rem+0.7vw)] font-bold">
                            Detalle del despacho roldanillo
                        </h1>
                    </div>

                    <button
                        type="button"
                        onClick={irAInformes}
                        className="w-full sm:w-auto px-4 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-900 transition-colors"
                    >
                        Ver informes
                    </button>
                </nav>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center text-slate-500">
                        Cargando detalle del despacho...
                    </div>
                ) : !detalle ? (
                    <div className="flex-1 flex items-center justify-center text-slate-500">
                        No se encontró información del despacho.
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto no-scrollbar pr-1 flex flex-col gap-6">
                        <section className="border border-slate-200 rounded-2xl p-4 md:p-5 bg-slate-50">
                            <div className="w-full bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm flex flex-col gap-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                    <div>
                                        <h1 className="text-xl font-bold text-slate-800">
                                            {detalle?.despacho?.codigo}
                                        </h1>
                                        <p className="text-sm text-slate-500">
                                            Detalle del despacho
                                        </p>
                                    </div>

                                    <div className="inline-flex items-center gap-2 text-xs bg-slate-100 px-3 py-1 rounded-full w-fit">
                                        <span className={`w-2 h-2 rounded-full ${obtenerColorEstado(detalle?.despacho?.estado)}`}></span>
                                        {detalle?.despacho?.estado?.nombre || "Sin estado"}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                                    <div className="bg-slate-50 border border-gray-200 rounded-xl px-4 py-3">
                                        <p className="text-xs text-slate-500">Fecha despacho</p>
                                        <p className="font-bold">
                                            {fechaDespachoVisual || detalle?.despacho?.fechaDespacho || ""}
                                        </p>
                                    </div>

                                    <div className="bg-slate-50 border border-gray-200 rounded-xl px-4 py-3">
                                        <p className="text-xs text-slate-500">Periodo</p>
                                        <p className="font-bold">
                                            {detalle?.despacho?.tipoPeriodo}
                                        </p>
                                    </div>

                                    <div className="bg-slate-50 border border-gray-200 rounded-xl px-4 py-3">
                                        <p className="text-xs text-slate-500">Consumo desde</p>
                                        <p className="font-bold">
                                            {fechaConsumoDesdeVisual || detalle?.despacho?.fechaConsumoDesde || ""}
                                        </p>
                                    </div>

                                    <div className="bg-slate-50 border border-gray-200 rounded-xl px-4 py-3">
                                        <p className="text-xs text-slate-500">Consumo hasta</p>
                                        <p className="font-bold">
                                            {fechaConsumoHastaVisual || detalle?.despacho?.fechaConsumoHasta || ""}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 md:col-span-2">
                                        <p className="text-xs text-blue-600 font-semibold">
                                            CONTRATO
                                        </p>
                                        <p className="font-bold text-blue-900 break-words">
                                            {detalle?.despacho?.contrato || "—"}
                                        </p>
                                    </div>

                                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                                        <p className="text-xs text-slate-500">Resumen</p>
                                        <p className="font-bold text-slate-800">
                                            {resumenGeneral.totalArchivos} archivos
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {resumenGeneral.totalRutas} rutas | {resumenGeneral.totalDetalles} detalles
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <div className="flex flex-col gap-5">
                            {jornadas.length === 0 ? (
                                <div className="border border-dashed border-slate-300 rounded-2xl bg-slate-50 p-6 text-center text-slate-500">
                                    Este despacho no tiene archivos registrados.
                                </div>
                            ) : (
                                jornadas.map((jornada) => renderArchivosPorJornada(jornada))
                            )}
                        </div>
                    </div>
                )}
            </article>
        </div>
    );
};
