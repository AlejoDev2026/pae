import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../constants";
import {
    IoMenu,
    IoChevronDown,
    IoChevronUp,
} from "react-icons/io5";
import {
    FaArrowLeft,
    FaFileExcel,
    FaLayerGroup,
} from "react-icons/fa6";
import { toast } from "react-toastify";
import { formatearNumero } from "../../informes";
import { ExcelFormatoTrazabilidadExporter }
    from "../../informes/exporters/ExcelFormatoTrazabilidadExporter";

const obtenerRutaKey = (ruta, index) =>
    ruta?.idRutaAgrupada ||
    ruta?.codigoRutaAgrupada ||
    ruta?.nombreRutaAgrupada ||
    `ruta_${index}`;

const construirMatrizRutaEspecialConsolidada = (ruta) => {
    const colegiosBase = Array.isArray(ruta?.colegios) ? ruta.colegios : [];

    const colegios = colegiosBase.map((colegio, index) => ({
        key: colegio?.codigoColegio || `colegio_${index}`,
        label: colegio?.nombreColegio || colegio?.codigoColegio || `Colegio ${index + 1}`,
        codigo: colegio?.codigoColegio || "",
        nombre: colegio?.nombreColegio || "",
    }));

    const mapaProductos = new Map();

    colegiosBase.forEach((colegio, colegioIndex) => {
        const colegioKey = colegio?.codigoColegio || `colegio_${colegioIndex}`;
        const productos = Array.isArray(colegio?.productos) ? colegio.productos : [];

        productos.forEach((producto, productoIndex) => {
            const productoKey =
                producto?.idProducto ||
                `${producto?.codigoProducto || ""}_${producto?.producto || ""}_${productoIndex}`;

            if (!mapaProductos.has(productoKey)) {
                mapaProductos.set(productoKey, {
                    idProducto: producto?.idProducto || null,
                    codigoProducto: producto?.codigoProducto || "",
                    producto: producto?.producto || "",
                    unidad: producto?.unidad || "",
                    cantidadesPorColegio: {},
                    totalCantidadRuta: 0,
                    totalPacRuta: 0,
                    totalUndRuta: 0,
                });
            }

            const item = mapaProductos.get(productoKey);
            const cantidad = Number(producto?.cantidad || 0);
            const pac = Number(producto?.pac || 0);
            const und = Number(producto?.und || 0);

            item.cantidadesPorColegio[colegioKey] = cantidad;
            item.totalCantidadRuta += cantidad;
            item.totalPacRuta += pac;
            item.totalUndRuta += und;
        });
    });

    const productos = Array.from(mapaProductos.values()).sort((a, b) =>
        String(a.producto || "").localeCompare(String(b.producto || ""), "es", {
            sensitivity: "base",
        })
    );

    return {
        colegios,
        productos,
    };
};

export const InformeRutaTranzabilidad = ({
    setSidebar,
    navegar,
    idDespacho,
    idCategoria = 21,
    data: externalData = null,
}) => {
    const abrirMenu = () => setSidebar?.(true);
    const estadoPagina = (pagina) => navegar?.(pagina);

    const [loadingInterno, setLoadingInterno] = useState(false);
    const [error, setError] = useState("");
    const [dataInterna, setDataInterna] = useState(null);
    const [rutasAbiertas, setRutasAbiertas] = useState({});

    const usaDataExterna = !!externalData;
    const data = usaDataExterna ? externalData : dataInterna;
    const loading = usaDataExterna ? false : loadingInterno;

    const idDespachoResuelto = useMemo(() => {
        if (idDespacho) return idDespacho;

        try {
            const idGuardado = localStorage.getItem("idDespachoDetalle");
            return idGuardado ? Number(idGuardado) : null;
        } catch {
            return null;
        }
    }, [idDespacho]);

    const rutas = data?.rutas || [];
    const resumen = data?.resumen || {};
    const despacho = data?.despacho || null;

    const totalRutas = resumen?.totalRutas || 0;
    const totalProductos = resumen?.totalProductos || 0;
    const totalCantidad = resumen?.totalCantidad || 0;
    const totalPac = resumen?.totalPac || 0;
    const totalUnd = resumen?.totalUnd || 0;

    const toggleRuta = (rutaKey) => {
        setRutasAbiertas((prev) => ({
            ...prev,
            [rutaKey]: !prev[rutaKey],
        }));
    };

    useEffect(() => {
        if (usaDataExterna) return;

        if (!idDespachoResuelto) {
            setDataInterna(null);
            setError("No se encontró el id del despacho para consultar este informe.");
            return;
        }

        let activo = true;

        const cargarInforme = async () => {
            try {
                setLoadingInterno(true);
                setError("");

                const url = `${API_BASE}Despachos/DespachosGetInformeRutaEspecialConsolidado.php?idDespacho=${idDespachoResuelto}&idCategoria=${idCategoria}`;

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
                console.log(response);
                if (!response.ok) {
                    throw new Error(
                        response?.mensaje ||
                        "No fue posible cargar el Informe Ruta Tranzabilidad."
                    );
                }

                if (!activo) return;

                setDataInterna(response);

                const estadoInicial = {};
                (response?.rutas || []).forEach((ruta, index) => {
                    const rutaKey = obtenerRutaKey(ruta, index);
                    estadoInicial[rutaKey] = index === 0;
                });

                setRutasAbiertas(estadoInicial);
            } catch (err) {
                if (!activo) return;
                setDataInterna(null);
                setError(
                    err?.message ||
                    "Ocurrió un error al consultar el Informe Ruta Tranzabilidad."
                );
            } finally {
                if (activo) {
                    setLoadingInterno(false);
                }
            }
        };

        cargarInforme();

        return () => {
            activo = false;
        };
    }, [idDespachoResuelto, idCategoria, usaDataExterna]);

    const resumenInformeActivo = useMemo(() => {
        return {
            titulo: "Informe Ruta Tranzabilidad",
            descripcion:
                "Visualiza el consolidado final por ruta especial con colegios en columnas, y totales por producto.",
        };
    }, []);

    const exportData = useMemo(() => {
        if (!despacho || !rutas.length) return null;

        return {
            tipo: "POR_RUTA_FORMATO",
            despacho,
            jornadas: [],
            rutas: rutas.map((ruta, index) => ({
                idRuta:
                    ruta?.idRutaAgrupada ||
                    ruta?.codigoRutaAgrupada ||
                    `ruta_${index}`,
                ruta:
                    ruta?.descripcionRutaAgrupada?.trim() ||
                    ruta?.nombreRutaAgrupada ||
                    ruta?.codigoRutaAgrupada ||
                    `Ruta especial ${index + 1}`,
                totalRuta: Number(ruta?.resumen?.totalCantidad || 0),
                totalPac: Number(ruta?.resumen?.totalPac || 0),
                totalUnd: Number(ruta?.resumen?.totalUnd || 0),
                productos: (ruta?.productos || []).map((item, itemIndex) => ({
                    idProducto: item?.idProducto || itemIndex + 1,
                    producto: item?.producto || "",
                    unidadCobertura: item?.unidad || "",
                    total: Number(item?.cantidad || 0),
                    pac: Number(item?.pac || 0),
                    und: Number(item?.und || 0),
                })),
            })),
            resumen: {
                totalJornadas: 0,
                totalRutas: Number(totalRutas || 0),
                totalProductos: Number(totalProductos || 0),
                totalCantidad: Number(totalCantidad || 0),
                totalPac: Number(totalPac || 0),
                totalUnd: Number(totalUnd || 0),
            },
        };
    }, [
        despacho,
        rutas,
        totalRutas,
        totalProductos,
        totalCantidad,
        totalPac,
        totalUnd,
    ]);

    const exportarExcel = async () => {
        try {
            if (!rutas.length) {
                toast.info("No hay información disponible para exportar.");
                return;
            }

            const dataExport = {
                despacho,
                rutas: rutas.map((ruta) => {
                    const nombreRuta =
                        ruta?.descripcionRutaAgrupada?.trim() ||
                        ruta?.nombreRutaAgrupada ||
                        ruta?.codigoRutaAgrupada ||
                        "Ruta especial";

                    const matriz = construirMatrizRutaEspecialConsolidada(ruta);

                    return {
                        ruta: nombreRuta,
                        colegios: matriz.colegios,
                        productos: matriz.productos.map((prod) => ({
                            ...prod,
                            lotes: "",
                        })),
                    };
                }),
            };

            await ExcelFormatoTrazabilidadExporter.exportar({
                data: dataExport,
            });

            toast.success("Excel exportado correctamente");
        } catch (error) {
            console.error("Error exportando Excel:", error);
            toast.error(error?.message || "No se pudo exportar el Excel");
        }
    };
    const renderInforme = () => {
        if (loading) {
            return (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                    Cargando Informe Ruta Tranzabilidad...
                </div>
            );
        }

        if (error) {
            return (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            );
        }

        if (!rutas.length) {
            return (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                    No hay información consolidada para las rutas especiales.
                </div>
            );
        }

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-sm text-slate-500">Rutas</p>
                        <p className="text-2xl font-bold text-slate-800">
                            {formatearNumero(totalRutas)}
                        </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-sm text-slate-500">Productos</p>
                        <p className="text-2xl font-bold text-slate-800">
                            {formatearNumero(totalProductos)}
                        </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-sm text-slate-500">Cantidad total</p>
                        <p className="text-2xl font-bold text-slate-800">
                            {formatearNumero(totalCantidad)}
                        </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-sm text-slate-500">PAC total</p>
                        <p className="text-2xl font-bold text-slate-800">
                            {formatearNumero(totalPac)}
                        </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-sm text-slate-500">UND total</p>
                        <p className="text-2xl font-bold text-slate-800">
                            {formatearNumero(totalUnd)}
                        </p>
                    </div>
                </div>

                {rutas.map((ruta, rutaIndex) => {
                    const rutaKey = obtenerRutaKey(ruta, rutaIndex);
                    const rutaAbierta = !!rutasAbiertas[rutaKey];
                    const nombreRutaVisual =
                        ruta.descripcionRutaAgrupada?.trim() ||
                        ruta.nombreRutaAgrupada ||
                        "Ruta especial";

                    const matriz = construirMatrizRutaEspecialConsolidada(ruta);
                    const colegios = matriz.colegios;
                    const productos = matriz.productos;

                    return (
                        <div
                            key={rutaKey}
                            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                        >
                            <button
                                type="button"
                                onClick={() => toggleRuta(rutaKey)}
                                className="w-full px-5 py-4 flex items-center justify-between gap-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                            >
                                <div className="text-left flex items-start gap-4">
                                    <div className="mt-1 p-2 rounded-xl border border-slate-200 bg-white text-slate-600">
                                        <FaLayerGroup />
                                    </div>

                                    <div>
                                        <h4 className="text-lg font-semibold text-slate-800">
                                            {nombreRutaVisual}
                                        </h4>
                                        <p className="text-sm text-slate-500 mt-1">
                                            {formatearNumero(colegios.length)} colegio(s) ·{" "}
                                            {formatearNumero(productos.length)} producto(s)
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="rounded-xl px-3 py-2 border border-slate-200 bg-white min-w-[90px]">
                                        <p className="text-[11px] text-slate-500">Total</p>
                                        <p className="font-bold text-slate-800">
                                            {formatearNumero(ruta?.resumen?.totalCantidad || 0)}
                                        </p>
                                    </div>

                                    <div className="rounded-xl px-3 py-2 border border-slate-200 bg-white min-w-[90px]">
                                        <p className="text-[11px] text-slate-500">PAC</p>
                                        <p className="font-bold text-slate-800">
                                            {formatearNumero(ruta?.resumen?.totalPac || 0)}
                                        </p>
                                    </div>

                                    <div className="rounded-xl px-3 py-2 border border-slate-200 bg-white min-w-[90px]">
                                        <p className="text-[11px] text-slate-500">UND</p>
                                        <p className="font-bold text-slate-800">
                                            {formatearNumero(ruta?.resumen?.totalUnd || 0)}
                                        </p>
                                    </div>

                                    <div className="rounded-xl px-3 py-2 border border-slate-200 bg-white text-slate-600">
                                        {rutaAbierta ? <IoChevronUp /> : <IoChevronDown />}
                                    </div>
                                </div>
                            </button>

                            {rutaAbierta && (
                                <div className="p-5 overflow-x-auto">
                                    {!productos.length ? (
                                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                                            No hay productos consolidados para esta ruta.
                                        </div>
                                    ) : (
                                        <table className="min-w-full text-sm border-separate border-spacing-0">
                                            <thead>
                                                <tr>
                                                    <th className="sticky left-0 z-10 bg-slate-100 px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-200">
                                                        Producto
                                                    </th>
                                                    <th className="bg-slate-100 px-4 py-3 text-left font-semibold text-slate-700 border-b border-slate-200">
                                                        Unidad
                                                    </th>

                                                    {colegios.map((colegio) => (
                                                        <th
                                                            key={colegio.key}
                                                            title={colegio.label}
                                                            className="bg-slate-100 border-b border-slate-200 align-bottom px-0 py-2"
                                                        >
                                                            <div className="h-44 w-12 mx-auto flex items-end justify-center overflow-hidden">
                                                                <div
                                                                    className="text-[11px] font-semibold text-slate-700 leading-[1] break-all text-center"
                                                                    style={{
                                                                        writingMode: "vertical-rl",
                                                                        transform: "rotate(180deg)",
                                                                        whiteSpace: "normal",
                                                                        wordBreak: "break-all",
                                                                        overflowWrap: "anywhere",
                                                                    }}
                                                                >
                                                                    {`${colegio.codigo} - ${colegio.nombre}`}
                                                                </div>
                                                            </div>
                                                        </th>
                                                    ))}

                                                    <th className="bg-slate-100 px-4 py-3 text-center font-semibold text-slate-700 border-b border-slate-200 whitespace-nowrap">
                                                        Total
                                                    </th>
                                                    <th className="bg-slate-100 px-4 py-3 text-center font-semibold text-slate-700 border-b border-slate-200 whitespace-nowrap">
                                                        PAC
                                                    </th>
                                                    <th className="bg-slate-100 px-4 py-3 text-center font-semibold text-slate-700 border-b border-slate-200 whitespace-nowrap">
                                                        UND
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {productos.map((producto) => (
                                                    <tr key={`${rutaKey}_${producto.idProducto}_${producto.codigoProducto}`}>
                                                        <td className="sticky left-0 bg-white px-4 py-3 border-b border-slate-100 text-slate-800 font-medium whitespace-nowrap">
                                                            {producto.producto}
                                                        </td>
                                                        <td className="px-4 py-3 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                                                            {producto.unidad || "-"}
                                                        </td>

                                                        {colegios.map((colegio) => (
                                                            <td
                                                                key={`${producto.idProducto}_${colegio.key}`}
                                                                className="px-4 py-3 border-b border-slate-100 text-center text-slate-700 whitespace-nowrap"
                                                            >
                                                                {formatearNumero(
                                                                    producto?.cantidadesPorColegio?.[colegio.key] || 0
                                                                )}
                                                            </td>
                                                        ))}

                                                        <td className="px-4 py-3 border-b border-slate-100 text-center font-semibold text-slate-800 whitespace-nowrap">
                                                            {formatearNumero(producto.totalCantidadRuta || 0)}
                                                        </td>
                                                        <td className="px-4 py-3 border-b border-slate-100 text-center font-semibold text-slate-800 whitespace-nowrap">
                                                            {formatearNumero(producto.totalPacRuta || 0)}
                                                        </td>
                                                        <td className="px-4 py-3 border-b border-slate-100 text-center font-semibold text-slate-800 whitespace-nowrap">
                                                            {formatearNumero(producto.totalUndRuta || 0)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="w-full h-screen flex flex-col p-4 md:p-6 gap-4 md:gap-6 min-h-0">
            <div className="flex items-center gap-5 lg:hidden">
                <div
                    className="p-2 rounded-lg hover:bg-gray-300 cursor-pointer"
                    onClick={abrirMenu}
                >
                    <IoMenu className="text-2xl" />
                </div>

                <h1 className="text-lg font-bold">Informes del despacho</h1>
            </div>

            <article className="flex-1 min-h-0 bg-white shadow-lg rounded-lg p-4 md:p-6 flex flex-col overflow-hidden">
                <nav className="w-full flex items-center justify-between mb-4 md:mb-6 gap-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <button
                            className="p-2 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                            onClick={() => estadoPagina("InformesHome")}
                            type="button"
                        >
                            <FaArrowLeft className="text-slate-700" />
                        </button>

                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-lg md:text-xl font-bold text-slate-800">
                                    Informes del despacho
                                </h1>
                                <span className="text-slate-400">/</span>
                                <span className="text-lg md:text-xl font-semibold text-slate-700">
                                    {despacho?.codigo || "Sin código"}
                                </span>
                            </div>
                            <p className="text-sm text-slate-500">
                                {despacho?.descripcion || "Sin descripción"}
                            </p>
                        </div>
                    </div>
                </nav>

                <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pr-1 flex flex-col gap-4 md:gap-6">
                    <section className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm shrink-0">
                        <div className="px-4 md:px-5 py-4 border-b bg-slate-50 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-bold text-slate-800">
                                        {resumenInformeActivo.titulo}
                                    </h2>
                                </div>
                                <p className="text-sm text-slate-500 mt-1">
                                    {resumenInformeActivo.descripcion}
                                </p>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={exportarExcel}
                                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-2"
                                >
                                    <FaFileExcel />
                                    <span>Exportar Excel</span>
                                </button>
                            </div>
                        </div>

                        <div className="p-4 md:p-5">{renderInforme()}</div>
                    </section>
                </div>
            </article>
        </div>
    );
};

export default InformeRutaTranzabilidad;