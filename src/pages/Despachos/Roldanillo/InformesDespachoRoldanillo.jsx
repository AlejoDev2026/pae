import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../../constants";
import { ExcelInformeRutasEspecialesExporter } from "../../../informes/exporters/ExcelInformeRutasEspecialesExporter";
import {
    IoMenu,
    IoClose,
    IoChevronDown,
    IoChevronUp,
    IoInformationCircleOutline,
} from "react-icons/io5";
import { ExcelInformeJornadaContratoExporter } from "../../../informes/exporters/ExcelInformeJornadaContratoExporter";
import { ExcelInformeCadenaFrioExporter } from "../../../informes/exporters/ExcelInformeCadenaFrioExporter";
import {
    FaArrowLeft,
    FaRoute,
    FaClock,
    FaSchool,
    FaFileExcel,
    FaBoxesStacked,
    FaLayerGroup,
} from "react-icons/fa6";
import { toast } from "react-toastify";
import {
    InformeDespachoBuilder,
    ExcelInformeExporter,
    PdfInformeExporter,
    ESTILOS_RUTA,
    formatearNumero,
    normalizarTexto,
} from "../../../informes";

const INFORMES = [
    {
        key: "POR_RUTA",
        titulo: "Total por ruta",
        descripcion: "Consolida los productos por jornada y ruta, calculando PAC y UND según embalaje.",
        icono: FaRoute,
        color: "bg-emerald-50 border-emerald-200 text-emerald-700",
        colorActivo: "bg-emerald-600 border-emerald-600 text-white",
    },
    {
        key: "POR_JORNADA",
        titulo: "Total por jornada / contrato",
        descripcion: "Resume productos totales para AM, PM y Jornada Única.",
        icono: FaClock,
        color: "bg-sky-50 border-sky-200 text-sky-700",
        colorActivo: "bg-sky-600 border-sky-600 text-white",
    },
    {
        key: "POR_SEDE",
        titulo: "Total por sede",
        descripcion: "Consolida productos por colegio o sede.",
        icono: FaSchool,
        color: "bg-violet-50 border-violet-200 text-violet-700",
        colorActivo: "bg-violet-600 border-violet-600 text-white",
    },
    {
        key: "POR_CATEGORIA",
        titulo: "Total por categoría",
        descripcion: "Consulta los productos por ruta filtrando una categoría.",
        icono: FaBoxesStacked,
        color: "bg-amber-50 border-amber-200 text-amber-700",
        colorActivo: "bg-amber-600 border-amber-600 text-white",
    },
    {
        key: "POR_CADENA_FRIO",
        titulo: "Congelados y refrigerados",
        descripcion: "Consolida por ruta y colegio, sumando AM, PM y Jornada Única en columnas dinámicas.",
        icono: FaBoxesStacked,
        color: "bg-cyan-50 border-cyan-200 text-cyan-700",
        colorActivo: "bg-cyan-600 border-cyan-600 text-white",
    },
    {
        key: "POR_RUTAS_ESPECIALES",
        titulo: "Rutas especiales",
        descripcion:
            "Lista AM, PM y Jornada Única con las 4 rutas especiales, sus colegios asignados y el consolidado por colegio con PAC y UND.",
        icono: FaLayerGroup,
        color: "bg-indigo-50 border-indigo-200 text-indigo-700",
        colorActivo: "bg-indigo-600 border-indigo-600 text-white",
    },
];

const TooltipInfo = ({ text, activo = false }) => {
    if (!text) return null;

    return (
        <div className="relative group shrink-0">
            <div
                className={`rounded-full ${activo ? "text-white/90" : "text-slate-400"} hover:opacity-100 transition-opacity`}
            >
                <IoInformationCircleOutline className="text-base" />
            </div>

            <div className="pointer-events-none absolute right-0 top-full z-30 hidden w-72 pt-2 group-hover:block">
                <div className="rounded-xl bg-slate-900 px-3 py-2 text-xs leading-5 text-white shadow-xl">
                    {text}
                </div>
            </div>
        </div>
    );
};

const ModalCategorias = ({
    abierto,
    onClose,
    categorias,
    onSeleccionar,
    categoriaSeleccionada,
}) => {
    if (!abierto) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">
                            Seleccionar categoría
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                            Elige la categoría para consultar el consolidado por ruta.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg border border-slate-300 hover:bg-slate-100 transition-colors"
                    >
                        <IoClose className="text-xl text-slate-700" />
                    </button>
                </div>

                <div className="p-5 max-h-[70vh] overflow-y-auto">
                    {categorias.length === 0 ? (
                        <div className="text-sm text-slate-500">
                            No hay categorías disponibles en este despacho.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {categorias.map((categoria) => {
                                const activa =
                                    normalizarTexto(categoriaSeleccionada) === categoria.key;

                                return (
                                    <button
                                        key={categoria.key}
                                        type="button"
                                        onClick={() => onSeleccionar(categoria.nombre)}
                                        className={`text-left border rounded-xl p-4 transition-all ${activa
                                            ? "bg-amber-600 border-amber-600 text-white"
                                            : "bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50 text-slate-800"
                                            }`}
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="font-semibold">{categoria.nombre}</p>
                                                <p
                                                    className={`text-sm mt-1 ${activa ? "text-white/90" : "text-slate-500"
                                                        }`}
                                                >
                                                    Ver productos por ruta
                                                </p>
                                            </div>
                                            <FaBoxesStacked className="text-lg shrink-0" />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="px-5 py-4 border-t border-slate-200 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

const construirMatrizRutaEspecial = (ruta) => {
    const colegiosBase = Array.isArray(ruta?.colegios) ? ruta.colegios : [];

    const colegios = colegiosBase.map((colegio, index) => ({
        key: colegio?.codigoColegio || `colegio_${index}`,
        label: colegio?.nombreColegio || colegio?.codigoColegio || `Colegio ${index + 1}`,
        codigo: colegio?.codigoColegio || "",
        nombre: colegio?.nombreColegio || "",
        direccion: colegio?.direccion || "",
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
                    pacPorColegio: {},
                    undPorColegio: {},
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
            item.pacPorColegio[colegioKey] = pac;
            item.undPorColegio[colegioKey] = und;
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

const formatearFechaConsumoLarga = (valor) => {
    if (!valor) return "";

    const texto = String(valor).trim();
    if (!texto) return "";

    const fecha = new Date(
        /^\d{4}-\d{2}-\d{2}$/.test(texto) ? `${texto}T00:00:00` : texto
    );

    if (Number.isNaN(fecha.getTime())) {
        return texto;
    }

    return new Intl.DateTimeFormat("es-CO", {
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(fecha);
};

const construirTextoFechaConsumo = () => {
    const fechaDesdeRaw = localStorage.getItem("fechaconsumodesde");
    const fechaHastaRaw = localStorage.getItem("fechaconsumohasta");
    console.log('desde', fechaDesdeRaw);
    console.log('hasta', fechaHastaRaw);
    const fechaDesde = formatearFechaConsumoLarga(fechaDesdeRaw);
    const fechaHasta = formatearFechaConsumoLarga(fechaHastaRaw);

    if (fechaDesde && fechaHasta) {
        return `Fecha de consumo: ${fechaDesde} al ${fechaHasta}`;
    }

    if (fechaDesde) {
        return `Fecha de consumo: ${fechaDesde}`;
    }

    if (fechaHasta) {
        return `Fecha de consumo: ${fechaHasta}`;
    }

    return "";
};

const construirDespachoConDatosVisuales = ({
    despachoBase,
    detalleDespacho,
    contratoVisual,
    fechaConsumoTexto,
}) => {
    const base = despachoBase || {};

    return {
        ...base,
        contrato:
            contratoVisual ||
            base?.contrato ||
            detalleDespacho?.contrato ||
            "",
        descripcion:
            contratoVisual ||
            base?.descripcion ||
            detalleDespacho?.contrato ||
            detalleDespacho?.descripcion ||
            "",
        fechaContrato:
            fechaConsumoTexto ||
            base?.fechaContrato ||
            "",
    };
};






export const InformesDespachoRoldanillo = ({ setSidebar, navegar }) => {
    const abrirMenu = () => setSidebar?.(true);
    const estadoPagina = (pagina) => navegar?.(pagina);
    const idDespacho = localStorage.getItem("idDespachoDetalle");

    const obtenerTipoInicial = () => {
        const tipoGuardado =
            localStorage.getItem("tipoInformeInicial") ||
            localStorage.getItem("tipoInformeSeleccionado");

        const existe = INFORMES.some((item) => item.key === tipoGuardado);

        return existe ? tipoGuardado : "POR_RUTA";
    };

    const [informeActivo, setInformeActivo] = useState(obtenerTipoInicial);
    const [loading, setLoading] = useState(false);
    const [detalleDespacho, setDetalleDespacho] = useState(null);

    const [loadingRutaFormato, setLoadingRutaFormato] = useState(false);
    const [informeRutaFormato, setInformeRutaFormato] = useState(null);
    const [rutasAbiertas, setRutasAbiertas] = useState({});

    const [modalCategoriasOpen, setModalCategoriasOpen] = useState(false);
    const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("");

    const [modalCadenaFrioOpen, setModalCadenaFrioOpen] = useState(false);
    const [categoriaCadenaFrioSeleccionada, setCategoriaCadenaFrioSeleccionada] = useState("");
    const [loadingCadenaFrio, setLoadingCadenaFrio] = useState(false);
    const [informeCadenaFrio, setInformeCadenaFrio] = useState(null);
    const [rutasCadenaFrioAbiertas, setRutasCadenaFrioAbiertas] = useState({});

    const [loadingRutasEspeciales, setLoadingRutasEspeciales] = useState(false);
    const [informeRutasEspeciales, setInformeRutasEspeciales] = useState(null);
    const [jornadasEspecialesAbiertas, setJornadasEspecialesAbiertas] = useState({});
    const [rutasEspecialesAbiertas, setRutasEspecialesAbiertas] = useState({});

    const [loadingJornadaContrato, setLoadingJornadaContrato] = useState(false);
    const [informeJornadaContrato, setInformeJornadaContrato] = useState(null);

    useEffect(() => {
        const obtenerInformeJornadaContrato = async () => {
            if (!idDespacho) return;

            try {
                setLoadingJornadaContrato(true);

                const url = `${API_BASE}Despachos/DespachosGetInformeJornadaContrato.php?idDespacho=${idDespacho}&tipo=TOTAL_JORNADA_CONTRATO`;
                console.log('url', url);

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
                    toast.error(
                        response.mensaje || "No se pudo consultar el informe total jornada / contrato"
                    );
                    setInformeJornadaContrato(null);
                    return;
                }

                setInformeJornadaContrato(response.data || null);
            } catch (error) {
                console.error("Error al consultar informe jornada / contrato:", error);
                toast.error("Ocurrió un error al consultar el informe total jornada / contrato");
                setInformeJornadaContrato(null);
            } finally {
                setLoadingJornadaContrato(false);
            }
        };

        obtenerInformeJornadaContrato();
    }, [idDespacho]);

    useEffect(() => {
        const obtenerDetalle = async () => {
            if (!idDespacho) {
                toast.error("No se encontró el despacho seleccionado");
                navegar?.("Despachos");
                return;
            }

            try {
                setLoading(true);

                const url = `${API_BASE}Despachos/DespachosGetDetalle.php?idDespacho=${idDespacho}`;
                console.log('url', url);

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
                    toast.error(response.mensaje || "No se pudo consultar el despacho");
                    setDetalleDespacho(null);
                    return;
                }

                setDetalleDespacho(response.data || null);
            } catch (error) {
                console.error("Error al consultar informes del despacho:", error);
                toast.error("Ocurrió un error al consultar los informes del despacho");
                setDetalleDespacho(null);
            } finally {
                setLoading(false);
            }
        };

        obtenerDetalle();
    }, [idDespacho, navegar]);

    useEffect(() => {
        const obtenerInformeRutaFormato = async () => {
            if (!idDespacho) return;

            try {
                setLoadingRutaFormato(true);

                const url = `${API_BASE}Despachos/Roldanillo/DespachosGetInformeRutaAgrupadaFormato.php?idDespacho=${idDespacho}&tipo=POR_RUTA`;
                console.log('url', url);

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
                    toast.error(response.mensaje || "No se pudo consultar el informe por ruta");
                    setInformeRutaFormato(null);
                    return;
                }

                setInformeRutaFormato(response.data || null);
            } catch (error) {
                console.error("Error al consultar informe ruta formato:", error);
                toast.error("Ocurrió un error al consultar el informe total por ruta");
                setInformeRutaFormato(null);
            } finally {
                setLoadingRutaFormato(false);
            }
        };

        obtenerInformeRutaFormato();
    }, [idDespacho]);

    useEffect(() => {
        const rutas = informeRutaFormato?.rutas || [];
        if (!rutas.length) {
            setRutasAbiertas({});
            return;
        }

        const estadoInicial = {};
        rutas.forEach((ruta, index) => {
            estadoInicial[ruta.idRuta] = index === 0;
        });
        setRutasAbiertas(estadoInicial);
    }, [informeRutaFormato]);

    const toggleRutaAbierta = (idRuta) => {
        setRutasAbiertas((prev) => ({
            ...prev,
            [idRuta]: !prev[idRuta],
        }));
    };

    const builder = useMemo(() => new InformeDespachoBuilder(detalleDespacho), [detalleDespacho]);

    const despacho = useMemo(() => {
        if (informeActivo === "POR_RUTA" && informeRutaFormato?.despacho) {
            return informeRutaFormato.despacho;
        }
        if (informeActivo === "POR_RUTAS_ESPECIALES" && informeRutasEspeciales?.despacho) {
            return informeRutasEspeciales.despacho;
        }
        return builder.construirResumenDespacho();
    }, [builder, informeActivo, informeRutaFormato, informeRutasEspeciales]);

    const fechaConsumoTexto = construirTextoFechaConsumo();

    const contratoVisual = useMemo(() => {
        return (
            detalleDespacho?.contrato ||
            despacho?.contrato ||
            detalleDespacho?.descripcion ||
            despacho?.descripcion ||
            ""
        );
    }, [detalleDespacho, despacho]);

    const despachoVisual = useMemo(() => {
        return construirDespachoConDatosVisuales({
            despachoBase: despacho,
            detalleDespacho,
            contratoVisual,
            fechaConsumoTexto,
        });
    }, [despacho, detalleDespacho, contratoVisual, fechaConsumoTexto]);



    const categoriasDisponibles = useMemo(
        () => builder.obtenerCategoriasDisponibles(),
        [builder]
    );

    const categoriasCadenaFrioDisponibles = useMemo(() => {
        return categoriasDisponibles.filter((item) => {
            const nombre = normalizarTexto(item?.nombre || "");
            return nombre.includes("CONGELADO") || nombre.includes("REFRIGERADO");
        });
    }, [categoriasDisponibles]);

    useEffect(() => {
        if (!categoriasDisponibles.length) {
            setCategoriaSeleccionada("");
            return;
        }

        const existeCategoriaSeleccionada = categoriasDisponibles.some(
            (item) => item.key === normalizarTexto(categoriaSeleccionada)
        );

        if (!existeCategoriaSeleccionada) {
            setCategoriaSeleccionada(categoriasDisponibles[0]?.nombre || "");
        }
    }, [categoriasDisponibles, categoriaSeleccionada]);

    useEffect(() => {
        if (!categoriasCadenaFrioDisponibles.length) {
            setCategoriaCadenaFrioSeleccionada("");
            return;
        }

        const existeCategoriaSeleccionada = categoriasCadenaFrioDisponibles.some(
            (item) => item.nombre === categoriaCadenaFrioSeleccionada
        );

        if (!existeCategoriaSeleccionada) {
            setCategoriaCadenaFrioSeleccionada(
                categoriasCadenaFrioDisponibles[0]?.nombre || ""
            );
        }
    }, [categoriasCadenaFrioDisponibles, categoriaCadenaFrioSeleccionada]);

    useEffect(() => {
        const tipoGuardado =
            localStorage.getItem("tipoInformeInicial") ||
            localStorage.getItem("tipoInformeSeleccionado");

        if (!tipoGuardado) return;

        if (tipoGuardado === "POR_CATEGORIA") {
            if (!categoriasDisponibles.length) return;
            setInformeActivo("POR_CATEGORIA");
            setModalCategoriasOpen(true);
            localStorage.removeItem("tipoInformeInicial");
            localStorage.removeItem("tipoInformeSeleccionado");
            return;
        }

        if (tipoGuardado === "POR_CADENA_FRIO") {
            if (!categoriasCadenaFrioDisponibles.length) return;
            setInformeActivo("POR_CADENA_FRIO");
            setModalCadenaFrioOpen(true);
            localStorage.removeItem("tipoInformeInicial");
            localStorage.removeItem("tipoInformeSeleccionado");
            return;
        }

        if (INFORMES.some((item) => item.key === tipoGuardado)) {
            setInformeActivo(tipoGuardado);
            localStorage.removeItem("tipoInformeInicial");
            localStorage.removeItem("tipoInformeSeleccionado");
        }
    }, [categoriasDisponibles, categoriasCadenaFrioDisponibles]);

    const resumenInformeActivo = useMemo(() => {
        switch (informeActivo) {
            case "POR_RUTA":
                return {
                    titulo: "Informe total por ruta",
                    descripcion:
                        "Visualiza el consolidado total por ruta, calculando PAC y UND según el embalaje configurado para cada producto.",
                };
            case "POR_JORNADA":
                return {
                    titulo: "Informe total por jornada",
                    descripcion: "Resume los productos por jornada: AM, PM y Jornada Única.",
                };
            case "POR_SEDE":
                return {
                    titulo: "Informe total por sede",
                    descripcion: "Muestra el consolidado de productos agrupado por sede o colegio.",
                };
            case "POR_CATEGORIA":
                return {
                    titulo: "Informe por categoría y ruta",
                    descripcion: categoriaSeleccionada
                        ? `Visualiza el consolidado por ruta filtrado para la categoría: ${categoriaSeleccionada}.`
                        : "Selecciona una categoría para visualizar el informe.",
                };
            case "POR_CADENA_FRIO":
                return {
                    titulo: "Informe consolidado de congelados y refrigerados",
                    descripcion: categoriaCadenaFrioSeleccionada
                        ? `Visualiza el consolidado por ruta y colegio para la categoría: ${categoriaCadenaFrioSeleccionada}.`
                        : "Selecciona una categoría para consultar el consolidado especial por ruta y colegio.",
                };
            case "POR_RUTAS_ESPECIALES":
                return {
                    titulo: "Informe de rutas especiales",
                    descripcion:
                        "Visualiza AM, PM y Jornada Única con las 4 rutas especiales, usando la misma vista de productos por filas y colegios por columnas.",
                };
            default:
                return {
                    titulo: "Informes del despacho",
                    descripcion: "",
                };
        }
    }, [informeActivo, categoriaSeleccionada, categoriaCadenaFrioSeleccionada]);

    const informePorJornada = useMemo(() => {
        if (informeJornadaContrato) return informeJornadaContrato;
        return { productos: [], resumen: {} };
    }, [informeJornadaContrato]);

    const informePorSede = useMemo(() => builder.construirInformePorSede(), [builder]);

    const informePorCategoriaYRuta = useMemo(
        () => builder.construirInformePorCategoriaYRuta(categoriaSeleccionada),
        [builder, categoriaSeleccionada]
    );

    useEffect(() => {
        const obtenerInformeCadenaFrio = async () => {
            if (!idDespacho || !categoriaCadenaFrioSeleccionada || informeActivo !== "POR_CADENA_FRIO") {
                return;
            }

            try {
                setLoadingCadenaFrio(true);

                const url = `${API_BASE}Despachos/Roldanillo/DespachosGetInformeRutaCategoriaColegio.php?idDespacho=${idDespacho}&idCategoria=21`;
                console.log('url', url);

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

                if (!response.ok) {
                    toast.error(
                        response.mensaje || "No se pudo consultar el informe de congelados y refrigerados"
                    );
                    setInformeCadenaFrio(null);
                    return;
                }

                setInformeCadenaFrio(response);
            } catch (error) {
                console.error("Error al consultar informe cadena de frío:", error);
                toast.error("Ocurrió un error al consultar el informe especial");
                setInformeCadenaFrio(null);
            } finally {
                setLoadingCadenaFrio(false);
            }
        };

        obtenerInformeCadenaFrio();
    }, [
        idDespacho,
        informeActivo,
        categoriaCadenaFrioSeleccionada,
        categoriasCadenaFrioDisponibles,
    ]);

    useEffect(() => {
        const rutas = informeCadenaFrio?.rutas || [];
        if (!rutas.length) {
            setRutasCadenaFrioAbiertas({});
            return;
        }

        const estadoInicial = {};
        rutas.forEach((ruta, index) => {
            const key = ruta.idRuta || ruta.ruta || `ruta_${index}`;
            estadoInicial[key] = index === 0;
        });

        setRutasCadenaFrioAbiertas(estadoInicial);
    }, [informeCadenaFrio]);

    const toggleRutaCadenaFrioAbierta = (rutaKey) => {
        setRutasCadenaFrioAbiertas((prev) => ({
            ...prev,
            [rutaKey]: !prev[rutaKey],
        }));
    };

    useEffect(() => {
        const obtenerInformeRutasEspeciales = async () => {
            if (!idDespacho || informeActivo !== "POR_RUTAS_ESPECIALES") return;

            try {
                setLoadingRutasEspeciales(true);

                const url = `${API_BASE}Despachos/DespachosGetInformeRutasAgrupadas.php?idDespacho=${idDespacho}&idCategoria=21`;
                console.log('url', url);

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

                if (!response.ok) {
                    toast.error(
                        response.mensaje || "No se pudo consultar el informe de rutas especiales"
                    );
                    setInformeRutasEspeciales(null);
                    return;
                }

                setInformeRutasEspeciales(response);
            } catch (error) {
                console.error("Error al consultar informe rutas especiales:", error);
                toast.error("Ocurrió un error al consultar el informe de rutas especiales");
                setInformeRutasEspeciales(null);
            } finally {
                setLoadingRutasEspeciales(false);
            }
        };

        obtenerInformeRutasEspeciales();
    }, [idDespacho, informeActivo]);

    useEffect(() => {
        const jornadas = informeRutasEspeciales?.jornadas || [];
        if (!jornadas.length) {
            setJornadasEspecialesAbiertas({});
            setRutasEspecialesAbiertas({});
            return;
        }

        const jornadasInit = {};
        const rutasInit = {};

        jornadas.forEach((jornada, jornadaIndex) => {
            const jornadaKey = jornada.jornada || `jornada_${jornadaIndex}`;
            jornadasInit[jornadaKey] = true;

            (jornada.rutas || []).forEach((ruta, rutaIndex) => {
                const rutaKey = `${jornadaKey}__${ruta.idRutaAgrupada || ruta.codigoRutaAgrupada || rutaIndex}`;
                rutasInit[rutaKey] = rutaIndex === 0;
            });
        });

        setJornadasEspecialesAbiertas(jornadasInit);
        setRutasEspecialesAbiertas(rutasInit);
    }, [informeRutasEspeciales]);

    const toggleJornadaEspecialAbierta = (jornadaKey) => {
        setJornadasEspecialesAbiertas((prev) => ({
            ...prev,
            [jornadaKey]: !prev[jornadaKey],
        }));
    };

    const toggleRutaEspecialAbierta = (rutaKey) => {
        setRutasEspecialesAbiertas((prev) => ({
            ...prev,
            [rutaKey]: !prev[rutaKey],
        }));
    };

    const seleccionarInforme = (key) => {
        if (key === "POR_CATEGORIA") {
            if (!categoriasDisponibles.length) {
                toast.info("Este despacho no tiene categorías disponibles");
                return;
            }

            setModalCategoriasOpen(true);
            return;
        }

        if (key === "POR_CADENA_FRIO") {
            if (!categoriasCadenaFrioDisponibles.length) {
                toast.info("No hay categorías configuradas para congelados o refrigerados");
                return;
            }

            setModalCadenaFrioOpen(true);
            return;
        }

        setInformeActivo(key);
    };

    const manejarSeleccionCategoria = (categoria) => {
        setCategoriaSeleccionada(categoria);
        setInformeActivo("POR_CATEGORIA");
        setModalCategoriasOpen(false);
    };

    const manejarSeleccionCategoriaCadenaFrio = (categoria) => {
        setCategoriaCadenaFrioSeleccionada(categoria);
        setInformeActivo("POR_CADENA_FRIO");
        setModalCadenaFrioOpen(false);
    };

    const construirPaqueteExportacionRutaFormato = () => ({
        tipo: "POR_RUTA_FORMATO",
        despacho: construirDespachoConDatosVisuales({
            despachoBase: informeRutaFormato?.despacho || despacho,
            detalleDespacho,
            contratoVisual,
            fechaConsumoTexto,
        }),
        jornadas: informeRutaFormato?.jornadas || [],
        rutas: informeRutaFormato?.rutas || [],
        resumen: informeRutaFormato?.resumen || {},
    });

    const obtenerPaqueteExportacionJornada = async () => {
        if (!idDespacho) {
            throw new Error("No se encontró el despacho seleccionado");
        }

        const url = `${API_BASE}Despachos/DespachosGetInformeJornadaContrato.php?idDespacho=${idDespacho}&tipo=TOTAL_JORNADA_CONTRATO`;
        console.log('url', url);
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
            throw new Error(
                response.mensaje || "No se pudo consultar el informe total jornada / contrato"
            );
        }

        return {
            tipo: "POR_JORNADA_CONTRATO",
            despacho: construirDespachoConDatosVisuales({
                despachoBase: response?.data?.despacho || despacho,
                detalleDespacho,
                contratoVisual,
                fechaConsumoTexto,
            }),
            productos: response?.data?.productos || [],
            resumen: response?.data?.resumen || {},
        };
    };

    const obtenerPaqueteExportacionCategoria = async () => {
        if (!idDespacho) {
            throw new Error("No se encontró el despacho seleccionado");
        }

        if (!categoriaSeleccionada) {
            throw new Error("Debes seleccionar una categoría");
        }

        const url = `${API_BASE}Despachos/DespachosGetInformeRutaFormato.php?idDespacho=${idDespacho}&tipo=POR_CATEGORIA&categoria=${encodeURIComponent(categoriaSeleccionada)}`;
        console.log('url', url);

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
            throw new Error(response.mensaje || "No se pudo consultar el informe por categoría");
        }

        return {
            tipo: "POR_CATEGORIA",
            despacho: construirDespachoConDatosVisuales({
                despachoBase: response?.data?.despacho || despacho,
                detalleDespacho,
                contratoVisual,
                fechaConsumoTexto,
            }),
            categoria: response?.data?.categoria || categoriaSeleccionada,
            jornadas: response?.data?.jornadas || [],
            rutas: response?.data?.rutas || [],
            resumen: response?.data?.resumen || {},
        };
    };

    const exportarExcel = async () => {
        try {
            let exportData = null;

            if (informeActivo === "POR_CADENA_FRIO") {
                if (!informeCadenaFrio) {
                    toast.info("No hay información para exportar");
                    return;
                }

                await ExcelInformeCadenaFrioExporter.exportar({
                    data: informeCadenaFrio,
                    despacho: despachoVisual,
                });

                return;
            }
            if (informeActivo === "POR_RUTAS_ESPECIALES") {
                if (!informeRutasEspeciales) {
                    toast.info("No hay información para exportar");
                    return;
                }

                await ExcelInformeRutasEspecialesExporter.exportar({
                    data: informeRutasEspeciales,
                    despacho: despachoVisual,
                });

                toast.success("Excel exportado correctamente");
                return;
            }
            if (informeActivo === "POR_RUTA") {
                exportData = construirPaqueteExportacionRutaFormato();

                await ExcelInformeExporter.exportar({
                    exportData,
                    despacho: exportData.despacho,
                    categoriaSeleccionada,
                });

                toast.success("Excel exportado correctamente");
                return;
            }

            if (informeActivo === "POR_JORNADA") {
                exportData = await obtenerPaqueteExportacionJornada();

                await ExcelInformeJornadaContratoExporter.exportar({
                    exportData,
                    despacho: exportData.despacho,
                });

                toast.success("Excel exportado correctamente");
                return;
            }

            if (informeActivo === "POR_SEDE") {
                exportData = {
                    tipo: "POR_SEDE",
                    data: informePorSede,
                };
            }

            if (informeActivo === "POR_CATEGORIA") {
                exportData = await obtenerPaqueteExportacionCategoria();
            }

            if (!exportData) {
                toast.info("No hay información disponible para exportar.");
                return;
            }

            await ExcelInformeExporter.exportar({
                exportData,
                despacho: despachoVisual,
                categoriaSeleccionada,
            });

            toast.success("Excel exportado correctamente");
        } catch (error) {
            console.error("Error exportando Excel:", error);
            toast.error(error.message || "No se pudo exportar el Excel");
        }
    };

    const exportarPDF = async () => {
        try {
            let exportData = null;

            if (informeActivo === "POR_RUTA") {
                exportData = construirPaqueteExportacionRutaFormato();

                PdfInformeExporter.exportar({
                    exportData,
                    despacho: exportData.despacho,
                    categoriaSeleccionada,
                    formatearNumero,
                });

                toast.success("PDF exportado correctamente");
                return;
            }

            if (informeActivo === "POR_JORNADA") {
                exportData = {
                    tipo: "POR_JORNADA",
                    productos: informePorJornada?.productos || [],
                    resumen: informePorJornada?.resumen || {},
                };
            }

            if (informeActivo === "POR_SEDE") {
                exportData = {
                    tipo: "POR_SEDE",
                    data: informePorSede,
                };
            }

            if (informeActivo === "POR_CATEGORIA") {
                exportData = await obtenerPaqueteExportacionCategoria();
            }

            if (informeActivo === "POR_CADENA_FRIO" || informeActivo === "POR_RUTAS_ESPECIALES") {
                toast.info("La exportación de este informe especial se habilitará en el siguiente ajuste");
                return;
            }

            if (!exportData) {
                toast.info("No hay información disponible para exportar.");
                return;
            }

            PdfInformeExporter.exportar({
                exportData,
                despacho,
                categoriaSeleccionada,
                formatearNumero,
            });

            toast.success("PDF exportado correctamente");
        } catch (error) {
            console.error("Error exportando PDF:", error);
            toast.error(error.message || "No se pudo exportar el PDF");
        }
    };

    const renderTarjetasCompactas = () => {
        return (
            <section className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-2 shrink-0">
                {INFORMES.map((item) => {
                    const Icono = item.icono;
                    const activo = informeActivo === item.key;

                    return (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => seleccionarInforme(item.key)}
                            className={`border rounded-xl px-3 py-3 text-left transition-all duration-200 shadow-sm hover:shadow-md min-h-[76px] ${activo ? item.colorActivo : item.color
                                }`}
                        >
                            <div className="flex items-start justify-between gap-3 h-full">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start gap-2 min-w-0">
                                        <p className="text-sm font-semibold leading-5 break-words line-clamp-2">
                                            {item.titulo}
                                        </p>
                                        <TooltipInfo text={item.descripcion} activo={activo} />
                                    </div>
                                </div>

                                <div className={`${activo ? "text-white" : "text-current"} text-base shrink-0 mt-0.5`}>
                                    <Icono />
                                </div>
                            </div>
                        </button>
                    );
                })}
            </section>
        );
    };

    const renderBloquesPorRutaBuilder = (
        data,
        totales,
        color = "emerald",
        mensajeVacio = "No hay información disponible."
    ) => {
        const totalRutas = totales?.totalRutas || 0;
        const totalProductos = totales?.totalProductos || 0;
        const totalCantidad = totales?.totalCantidad || 0;
        const estilos = ESTILOS_RUTA[color] || ESTILOS_RUTA.emerald;

        return (
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-sm text-slate-500">Rutas</p>
                        <p className="text-2xl font-bold text-slate-800">
                            {formatearNumero(totalRutas)}
                        </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-sm text-slate-500">Productos globales</p>
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
                        <p className="text-sm text-slate-500">Modalidades</p>
                        <p className="text-2xl font-bold text-slate-800">3</p>
                    </div>
                </div>

                {data.length === 0 ? (
                    <div className="text-sm text-slate-500">{mensajeVacio}</div>
                ) : (
                    <div className="flex flex-col gap-5">
                        {data.map((bloqueRuta) => (
                            <section
                                key={bloqueRuta.ruta}
                                className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm"
                            >
                                <div
                                    className={`px-5 py-4 border-b ${estilos.header} flex flex-col md:flex-row md:items-center md:justify-between gap-3`}
                                >
                                    <div>
                                        <h3 className={`text-lg font-bold ${estilos.title}`}>
                                            {bloqueRuta.ruta}
                                        </h3>
                                        <p className={`text-sm ${estilos.subtitle}`}>
                                            Productos a alistar para esta ruta
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        <div className={`bg-white border ${estilos.boxBorder} rounded-xl px-3 py-2`}>
                                            <p className="text-xs text-slate-500">AM</p>
                                            <p className="font-bold text-slate-800">
                                                {formatearNumero(bloqueRuta.totalAm)}
                                            </p>
                                        </div>

                                        <div className={`bg-white border ${estilos.boxBorder} rounded-xl px-3 py-2`}>
                                            <p className="text-xs text-slate-500">PM</p>
                                            <p className="font-bold text-slate-800">
                                                {formatearNumero(bloqueRuta.totalPm)}
                                            </p>
                                        </div>

                                        <div className={`bg-white border ${estilos.boxBorder} rounded-xl px-3 py-2`}>
                                            <p className="text-xs text-slate-500">Jornada Única</p>
                                            <p className="font-bold text-slate-800">
                                                {formatearNumero(bloqueRuta.totalUnica)}
                                            </p>
                                        </div>

                                        <div className={`bg-white border ${estilos.boxBorder} rounded-xl px-3 py-2`}>
                                            <p className="text-xs text-slate-500">Total</p>
                                            <p className="font-bold text-slate-800">
                                                {formatearNumero(bloqueRuta.totalRuta)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-5">
                                    <div className="w-full overflow-x-auto border border-slate-200 rounded-xl">
                                        <table className="min-w-full text-sm">
                                            <thead className="bg-slate-100 text-slate-800">
                                                <tr>
                                                    <th className="px-4 py-3 text-left border-b border-slate-200">
                                                        Producto
                                                    </th>
                                                    <th className="px-4 py-3 text-left border-b border-slate-200">
                                                        Unidad / Cobertura
                                                    </th>
                                                    <th className="px-4 py-3 text-right border-b border-slate-200">
                                                        AM
                                                    </th>
                                                    <th className="px-4 py-3 text-right border-b border-slate-200">
                                                        PM
                                                    </th>
                                                    <th className="px-4 py-3 text-right border-b border-slate-200">
                                                        Jornada Única
                                                    </th>
                                                    <th className="px-4 py-3 text-right border-b border-slate-200">
                                                        Total
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {bloqueRuta.productos.map((item) => (
                                                    <tr
                                                        key={`${bloqueRuta.ruta}-${item.producto}-${item.unidadCobertura}`}
                                                        className="hover:bg-slate-50"
                                                    >
                                                        <td className="px-4 py-3 border-b border-slate-100 font-medium">
                                                            {item.producto}
                                                        </td>

                                                        <td className="px-4 py-3 border-b border-slate-100">
                                                            {item.unidadCobertura || "-"}
                                                        </td>

                                                        <td className="px-4 py-3 border-b border-slate-100 text-right">
                                                            {formatearNumero(item.am)}
                                                        </td>

                                                        <td className="px-4 py-3 border-b border-slate-100 text-right">
                                                            {formatearNumero(item.pm)}
                                                        </td>

                                                        <td className="px-4 py-3 border-b border-slate-100 text-right">
                                                            {formatearNumero(item.unica)}
                                                        </td>

                                                        <td className="px-4 py-3 border-b border-slate-100 text-right font-bold text-slate-800">
                                                            {formatearNumero(item.total)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>

                                            <tfoot>
                                                <tr className="bg-slate-50">
                                                    <td
                                                        colSpan={2}
                                                        className="px-4 py-3 border-t border-slate-200 font-bold text-slate-800"
                                                    >
                                                        Total {bloqueRuta.ruta}
                                                    </td>

                                                    <td className="px-4 py-3 border-t border-slate-200 text-right font-bold text-slate-800">
                                                        {formatearNumero(bloqueRuta.totalAm)}
                                                    </td>

                                                    <td className="px-4 py-3 border-t border-slate-200 text-right font-bold text-slate-800">
                                                        {formatearNumero(bloqueRuta.totalPm)}
                                                    </td>

                                                    <td className="px-4 py-3 border-t border-slate-200 text-right font-bold text-slate-800">
                                                        {formatearNumero(bloqueRuta.totalUnica)}
                                                    </td>

                                                    <td className="px-4 py-3 border-t border-slate-200 text-right font-bold text-slate-800">
                                                        {formatearNumero(bloqueRuta.totalRuta)}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    const renderInformeRutaFormato = () => {
        const rutas = informeRutaFormato?.rutas || [];
        const resumen = informeRutaFormato?.resumen || {};

        const totalJornadas = resumen?.totalJornadas || 0;
        const totalRutas = resumen?.totalRutas || 0;
        const totalProductos = resumen?.totalProductos || 0;
        const totalCantidad = resumen?.totalCantidad || 0;
        const totalPac = resumen?.totalPac || 0;
        const totalUnd = resumen?.totalUnd || 0;

        if (loadingRutaFormato) {
            return (
                <div className="flex items-center justify-center py-10 text-slate-500">
                    Cargando informe total por ruta...
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-sm text-slate-500">Jornadas</p>
                        <p className="text-2xl font-bold text-slate-800">
                            {formatearNumero(totalJornadas)}
                        </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-sm text-slate-500">Rutas</p>
                        <p className="text-2xl font-bold text-slate-800">
                            {formatearNumero(totalRutas)}
                        </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-sm text-slate-500">Productos globales</p>
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

                {rutas.length === 0 ? (
                    <div className="text-sm text-slate-500">
                        No hay información para el informe por ruta.
                    </div>
                ) : (
                    <div className="flex flex-col gap-5">
                        {rutas.map((ruta) => {
                            const abierta = !!rutasAbiertas[ruta.idRuta];

                            return (
                                <article
                                    key={ruta.idRuta}
                                    className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm"
                                >
                                    <button
                                        type="button"
                                        onClick={() => toggleRutaAbierta(ruta.idRuta)}
                                        className="w-full px-5 py-4 bg-slate-50 border-b flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 text-left hover:bg-slate-100 transition-colors"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="mt-1 p-2 rounded-xl border border-slate-200 bg-white text-slate-600">
                                                <FaRoute />
                                            </div>

                                            <div>
                                                <h3 className="text-lg font-bold text-slate-800">
                                                    {ruta.ruta}
                                                </h3>
                                                <p className="text-sm text-slate-500 mt-1">
                                                    Productos consolidados para esta ruta (todas las jornadas)
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap">
                                            <div className="rounded-xl px-3 py-2 border border-slate-200 bg-white min-w-[95px]">
                                                <p className="text-xs text-slate-500">Cantidad</p>
                                                <p className="font-bold text-slate-800">
                                                    {formatearNumero(ruta.totalRuta)}
                                                </p>
                                            </div>

                                            <div className="rounded-xl px-3 py-2 border border-slate-200 bg-white min-w-[95px]">
                                                <p className="text-xs text-slate-500">PAC</p>
                                                <p className="font-bold text-slate-800">
                                                    {formatearNumero(ruta.totalPac)}
                                                </p>
                                            </div>

                                            <div className="rounded-xl px-3 py-2 border border-slate-200 bg-white min-w-[95px]">
                                                <p className="text-xs text-slate-500">UND</p>
                                                <p className="font-bold text-slate-800">
                                                    {formatearNumero(ruta.totalUnd)}
                                                </p>
                                            </div>

                                            <div className="rounded-xl px-3 py-2 border border-slate-200 bg-white text-slate-600">
                                                {abierta ? (
                                                    <IoChevronUp className="text-xl" />
                                                ) : (
                                                    <IoChevronDown className="text-xl" />
                                                )}
                                            </div>
                                        </div>
                                    </button>

                                    {abierta && (
                                        <div className="p-5">
                                            {!(ruta.productos || []).length ? (
                                                <div className="text-sm text-slate-500">
                                                    No hay productos registrados en esta ruta.
                                                </div>
                                            ) : (
                                                <div className="w-full overflow-x-auto border border-slate-200 rounded-xl">
                                                    <table className="min-w-full text-sm">
                                                        <thead className="bg-slate-100 text-slate-800">
                                                            <tr>
                                                                <th className="px-4 py-3 text-left border-b border-slate-200">
                                                                    Producto
                                                                </th>
                                                                <th className="px-4 py-3 text-left border-b border-slate-200">
                                                                    Unidad / Cobertura
                                                                </th>
                                                                <th className="px-4 py-3 text-right border-b border-slate-200">
                                                                    Total
                                                                </th>
                                                                <th className="px-4 py-3 text-right border-b border-slate-200">
                                                                    PAC
                                                                </th>
                                                                <th className="px-4 py-3 text-right border-b border-slate-200">
                                                                    UND
                                                                </th>
                                                            </tr>
                                                        </thead>

                                                        <tbody>
                                                            {(ruta.productos || []).map((item) => (
                                                                <tr
                                                                    key={`${ruta.idRuta}-${item.idProducto}`}
                                                                    className="hover:bg-slate-50"
                                                                >
                                                                    <td className="px-4 py-3 border-b border-slate-100 font-medium">
                                                                        {item.producto}
                                                                    </td>

                                                                    <td className="px-4 py-3 border-b border-slate-100">
                                                                        {item.unidadCobertura || "-"}
                                                                    </td>

                                                                    <td className="px-4 py-3 border-b border-slate-100 text-right">
                                                                        {formatearNumero(item.total)}
                                                                    </td>

                                                                    <td className="px-4 py-3 border-b border-slate-100 text-right">
                                                                        {formatearNumero(item.pac)}
                                                                    </td>

                                                                    <td className="px-4 py-3 border-b border-slate-100 text-right">
                                                                        {formatearNumero(item.und)}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>

                                                        <tfoot>
                                                            <tr className="bg-slate-50">
                                                                <td
                                                                    colSpan={2}
                                                                    className="px-4 py-3 border-t border-slate-200 font-bold text-slate-800"
                                                                >
                                                                    Total {ruta.ruta}
                                                                </td>

                                                                <td className="px-4 py-3 border-t border-slate-200 text-right font-bold text-slate-800">
                                                                    {formatearNumero(ruta.totalRuta)}
                                                                </td>

                                                                <td className="px-4 py-3 border-t border-slate-200 text-right font-bold text-slate-800">
                                                                    {formatearNumero(ruta.totalPac)}
                                                                </td>

                                                                <td className="px-4 py-3 border-t border-slate-200 text-right font-bold text-slate-800">
                                                                    {formatearNumero(ruta.totalUnd)}
                                                                </td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    const renderInformeCadenaFrio = () => {
        if (loadingCadenaFrio) {
            return (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                    Cargando informe de congelados y refrigerados...
                </div>
            );
        }

        const rutas = informeCadenaFrio?.rutas || [];

        if (!rutas.length) {
            return (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                    No hay información consolidada para esta categoría.
                </div>
            );
        }

        return (
            <div className="space-y-6">
                {rutas.map((ruta, rutaIndex) => {
                    const rutaKey = ruta.idRuta || ruta.ruta || `ruta_${rutaIndex}`;
                    const abierta = !!rutasCadenaFrioAbiertas[rutaKey];
                    const colegios = Array.isArray(ruta.colegios) ? ruta.colegios : [];
                    const productos = Array.isArray(ruta.productos) ? ruta.productos : [];

                    return (
                        <div
                            key={rutaKey}
                            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                        >
                            <button
                                type="button"
                                onClick={() => toggleRutaCadenaFrioAbierta(rutaKey)}
                                className="w-full px-5 py-4 flex items-center justify-between gap-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                            >
                                <div className="text-left">
                                    <h3 className="text-lg font-semibold text-slate-800">
                                        {ruta.ruta}
                                    </h3>
                                    <p className="text-sm text-slate-500 mt-1">
                                        {colegios.length} colegio(s) · {productos.length} producto(s)
                                    </p>
                                </div>

                                <div className="text-slate-500 text-lg">
                                    {abierta ? <IoChevronUp /> : <IoChevronDown />}
                                </div>
                            </button>

                            {abierta && (
                                <div className="p-5 overflow-x-auto">
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
                                                        key={colegio}
                                                        className="bg-slate-100 px-4 py-3 text-center font-semibold text-slate-700 border-b border-slate-200 whitespace-nowrap"
                                                    >
                                                        {colegio}
                                                    </th>
                                                ))}

                                                <th className="bg-slate-100 px-4 py-3 text-center font-semibold text-slate-700 border-b border-slate-200 whitespace-nowrap">
                                                    Total cobertura ruta
                                                </th>
                                                <th className="bg-slate-100 px-4 py-3 text-center font-semibold text-slate-700 border-b border-slate-200 whitespace-nowrap">
                                                    Lotes
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {productos.map((producto) => (
                                                <tr key={producto.idProducto}>
                                                    <td className="sticky left-0 bg-white px-4 py-3 border-b border-slate-100 text-slate-800 font-medium whitespace-nowrap">
                                                        {producto.producto}
                                                    </td>
                                                    <td className="px-4 py-3 border-b border-slate-100 text-slate-600 whitespace-nowrap">
                                                        {producto.unidad || "-"}
                                                    </td>

                                                    {colegios.map((colegio) => (
                                                        <td
                                                            key={`${producto.idProducto}_${colegio}`}
                                                            className="px-4 py-3 border-b border-slate-100 text-center text-slate-700 whitespace-nowrap"
                                                        >
                                                            {formatearNumero(
                                                                producto?.cantidadesPorColegio?.[colegio] || 0
                                                            )}
                                                        </td>
                                                    ))}

                                                    <td className="px-4 py-3 border-b border-slate-100 text-center font-semibold text-slate-800 whitespace-nowrap">
                                                        {formatearNumero(producto.totalCoberturaRuta || 0)}
                                                    </td>
                                                    <td className="px-4 py-3 border-b border-slate-100 text-center text-slate-500 whitespace-nowrap">
                                                        {producto.lotes || ""}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderInformeRutasEspeciales = () => {
        if (loadingRutasEspeciales) {
            return (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                    Cargando informe de rutas especiales...
                </div>
            );
        }

        const jornadas = informeRutasEspeciales?.jornadas || [];
        const resumen = informeRutasEspeciales?.resumen || {};

        if (!jornadas.length) {
            return (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                    No hay información consolidada para las rutas especiales.
                </div>
            );
        }

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-sm text-slate-500">Jornadas</p>
                        <p className="text-2xl font-bold text-slate-800">
                            {formatearNumero(resumen.totalJornadas || 0)}
                        </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-sm text-slate-500">Rutas</p>
                        <p className="text-2xl font-bold text-slate-800">
                            {formatearNumero(resumen.totalRutas || 0)}
                        </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-sm text-slate-500">Colegios</p>
                        <p className="text-2xl font-bold text-slate-800">
                            {formatearNumero(resumen.totalColegios || 0)}
                        </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-sm text-slate-500">Productos</p>
                        <p className="text-2xl font-bold text-slate-800">
                            {formatearNumero(resumen.totalProductos || 0)}
                        </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-sm text-slate-500">PAC total</p>
                        <p className="text-2xl font-bold text-slate-800">
                            {formatearNumero(resumen.totalPac || 0)}
                        </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <p className="text-sm text-slate-500">UND total</p>
                        <p className="text-2xl font-bold text-slate-800">
                            {formatearNumero(resumen.totalUnd || 0)}
                        </p>
                    </div>
                </div>

                {jornadas.map((jornada, jornadaIndex) => {
                    const jornadaKey = jornada.jornada || `jornada_${jornadaIndex}`;
                    const jornadaAbierta = !!jornadasEspecialesAbiertas[jornadaKey];
                    const rutas = Array.isArray(jornada.rutas) ? jornada.rutas : [];

                    return (
                        <section
                            key={jornadaKey}
                            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                        >
                            <button
                                type="button"
                                onClick={() => toggleJornadaEspecialAbierta(jornadaKey)}
                                className="w-full px-5 py-4 flex items-center justify-between gap-4 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                            >
                                <div className="text-left">
                                    <h3 className="text-lg font-bold text-indigo-800">
                                        Jornada {jornada.jornada}
                                    </h3>
                                    <p className="text-sm text-indigo-700/80 mt-1">
                                        {formatearNumero(jornada?.resumen?.totalRutas || 0)} ruta(s) ·{" "}
                                        {formatearNumero(jornada?.resumen?.totalColegios || 0)} colegio(s) ·{" "}
                                        {formatearNumero(jornada?.resumen?.totalProductos || 0)} producto(s)
                                    </p>
                                </div>

                                <div className="text-indigo-700 text-lg">
                                    {jornadaAbierta ? <IoChevronUp /> : <IoChevronDown />}
                                </div>
                            </button>

                            {jornadaAbierta && (
                                <div className="p-5 space-y-6">
                                    {!rutas.length ? (
                                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">
                                            No hay rutas configuradas o datos para esta jornada.
                                        </div>
                                    ) : (
                                        rutas.map((ruta, rutaIndex) => {
                                            const rutaAccordionKey = `${jornadaKey}__${ruta.idRutaAgrupada || ruta.codigoRutaAgrupada || rutaIndex}`;
                                            const rutaAbierta = !!rutasEspecialesAbiertas[rutaAccordionKey];
                                            const nombreRutaVisual =
                                                ruta.descripcionRutaAgrupada?.trim() ||
                                                ruta.nombreRutaAgrupada ||
                                                "Ruta especial";

                                            const matriz = construirMatrizRutaEspecial(ruta);
                                            const colegios = matriz.colegios;
                                            const productos = matriz.productos;

                                            return (
                                                <div
                                                    key={rutaAccordionKey}
                                                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleRutaEspecialAbierta(rutaAccordionKey)}
                                                        className="w-full px-5 py-4 flex items-center justify-between gap-4 bg-slate-50 hover:bg-slate-100 transition-colors"
                                                    >
                                                        <div className="text-left">
                                                            <h4 className="text-lg font-semibold text-slate-800">
                                                                {nombreRutaVisual}
                                                            </h4>
                                                            <p className="text-sm text-slate-500 mt-1">
                                                                {formatearNumero(colegios.length)} colegio(s) ·{" "}
                                                                {formatearNumero(productos.length)} producto(s)
                                                            </p>
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
                                                                    No hay productos consolidados para esta ruta en esta jornada.
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
                                                                                    title={`${colegio.codigo} ${colegio.nombre}${colegio.direccion ? ` - ${colegio.direccion}` : ""}`}
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
                                                                            <tr key={`${rutaAccordionKey}_${producto.idProducto}_${producto.codigoProducto}`}>
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
                                        })
                                    )}
                                </div>
                            )}
                        </section>
                    );
                })}
            </div>
        );
    };

    const renderContenidoInforme = () => {
        if (informeActivo === "POR_RUTA") {
            return renderInformeRutaFormato();
        }

        if (informeActivo === "POR_JORNADA") {
            const productos = Array.isArray(informePorJornada?.productos)
                ? informePorJornada.productos
                : [];
            const resumen = informePorJornada?.resumen || {};

            return (
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <p className="text-sm text-slate-500">Productos globales</p>
                            <p className="text-2xl font-bold text-slate-800">
                                {formatearNumero(resumen.totalProductos || 0)}
                            </p>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <p className="text-sm text-slate-500">Cantidad total</p>
                            <p className="text-2xl font-bold text-slate-800">
                                {formatearNumero(resumen.totalCantidad || 0)}
                            </p>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <p className="text-sm text-slate-500">PAC total</p>
                            <p className="text-2xl font-bold text-slate-800">
                                {formatearNumero(resumen.totalPac || 0)}
                            </p>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <p className="text-sm text-slate-500">UND total</p>
                            <p className="text-2xl font-bold text-slate-800">
                                {formatearNumero(resumen.totalUnd || 0)}
                            </p>
                        </div>
                    </div>

                    <section className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                        <div className="px-5 py-4 border-b bg-sky-50">
                            <h3 className="text-lg font-bold text-sky-800">
                                Total jornada / contrato
                            </h3>
                            <p className="text-sm text-sky-700 mt-1">
                                Consolidado general por producto usando código, presentación, total, PAC y UND.
                            </p>
                        </div>

                        <div className="p-5">
                            {productos.length === 0 ? (
                                <div className="text-sm text-slate-500">
                                    No hay productos para mostrar en el informe total jornada / contrato.
                                </div>
                            ) : (
                                <div className="w-full overflow-x-auto border border-slate-200 rounded-xl">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-slate-100 text-slate-800">
                                            <tr>
                                                <th className="px-4 py-3 text-left border-b border-slate-200">
                                                    Código
                                                </th>
                                                <th className="px-4 py-3 text-left border-b border-slate-200">
                                                    Producto
                                                </th>
                                                <th className="px-4 py-3 text-left border-b border-slate-200">
                                                    Presentación
                                                </th>
                                                <th className="px-4 py-3 text-right border-b border-slate-200">
                                                    Total
                                                </th>
                                                <th className="px-4 py-3 text-right border-b border-slate-200">
                                                    PAC
                                                </th>
                                                <th className="px-4 py-3 text-right border-b border-slate-200">
                                                    UND
                                                </th>
                                            </tr>
                                        </thead>

                                        <tbody>
                                            {productos.map((item) => (
                                                <tr
                                                    key={`${item.idProducto}-${item.codigo}`}
                                                    className="hover:bg-slate-50"
                                                >
                                                    <td className="px-4 py-3 border-b border-slate-100 font-medium">
                                                        {item.codigo || "-"}
                                                    </td>

                                                    <td className="px-4 py-3 border-b border-slate-100">
                                                        {item.producto}
                                                    </td>

                                                    <td className="px-4 py-3 border-b border-slate-100">
                                                        {item.unidadCobertura || "-"}
                                                    </td>

                                                    <td className="px-4 py-3 border-b border-slate-100 text-right">
                                                        {formatearNumero(item.total || 0)}
                                                    </td>

                                                    <td className="px-4 py-3 border-b border-slate-100 text-right">
                                                        {formatearNumero(item.pac || item.observacionPac || 0)}
                                                    </td>

                                                    <td className="px-4 py-3 border-b border-slate-100 text-right">
                                                        {formatearNumero(item.und || item.observacionUnd || 0)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>

                                        <tfoot>
                                            <tr className="bg-slate-50">
                                                <td
                                                    colSpan={3}
                                                    className="px-4 py-3 border-t border-slate-200 font-bold text-slate-800"
                                                >
                                                    Totales globales
                                                </td>

                                                <td className="px-4 py-3 border-t border-slate-200 text-right font-bold text-slate-800">
                                                    {formatearNumero(resumen.totalCantidad || 0)}
                                                </td>

                                                <td className="px-4 py-3 border-t border-slate-200 text-right font-bold text-slate-800">
                                                    {formatearNumero(resumen.totalPac || 0)}
                                                </td>

                                                <td className="px-4 py-3 border-t border-slate-200 text-right font-bold text-slate-800">
                                                    {formatearNumero(resumen.totalUnd || 0)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            );
        }

        if (informeActivo === "POR_SEDE") {
            const data = informePorSede?.data || [];
            const totalSedes = informePorSede?.resumen?.totalSedes || 0;
            const totalProductos = informePorSede?.resumen?.totalProductos || 0;
            const totalCantidad = informePorSede?.resumen?.totalCantidad || 0;

            return (
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <p className="text-sm text-slate-500">Sedes</p>
                            <p className="text-2xl font-bold text-slate-800">
                                {formatearNumero(totalSedes)}
                            </p>
                        </div>

                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <p className="text-sm text-slate-500">Productos globales</p>
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
                    </div>

                    <div className="w-full overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="min-w-full text-sm">
                            <thead className="bg-slate-100 text-slate-800">
                                <tr>
                                    <th className="px-4 py-3 text-left border-b border-slate-200">
                                        Sede
                                    </th>
                                    <th className="px-4 py-3 text-right border-b border-slate-200">
                                        Productos
                                    </th>
                                    <th className="px-4 py-3 text-right border-b border-slate-200">
                                        Cantidad total
                                    </th>
                                    <th className="px-4 py-3 text-left border-b border-slate-200">
                                        Jornadas
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {data.map((item) => (
                                    <tr key={item.sede} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 border-b border-slate-100 font-medium">
                                            {item.sede}
                                        </td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-right">
                                            {formatearNumero(item.productos)}
                                        </td>
                                        <td className="px-4 py-3 border-b border-slate-100 text-right">
                                            {formatearNumero(item.cantidad)}
                                        </td>
                                        <td className="px-4 py-3 border-b border-slate-100">
                                            {item.jornadas || "-"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }

        if (informeActivo === "POR_CATEGORIA") {
            const data = informePorCategoriaYRuta?.rutas || [];

            return renderBloquesPorRutaBuilder(
                data,
                informePorCategoriaYRuta?.resumen,
                "amber",
                categoriaSeleccionada
                    ? `No hay información para la categoría ${categoriaSeleccionada}.`
                    : "Selecciona una categoría para visualizar el informe."
            );
        }

        if (informeActivo === "POR_CADENA_FRIO") {
            return renderInformeCadenaFrio();
        }

        if (informeActivo === "POR_RUTAS_ESPECIALES") {
            return renderInformeRutasEspeciales();
        }

        return null;
    };

    const loadingGeneral =
        loading ||
        (informeActivo === "POR_RUTA" && loadingRutaFormato) ||
        (informeActivo === "POR_JORNADA" && loadingJornadaContrato) ||
        (informeActivo === "POR_RUTAS_ESPECIALES" && loadingRutasEspeciales) ||
        false;

    return (
        <>
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
                                onClick={() => estadoPagina("InformesHomeRoldanillo")}
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
                                        {despachoVisual?.codigo || "Sin código"}
                                    </span>
                                </div>

                                <div className="mt-1 flex flex-col gap-0.5">
                                    <p className="text-sm text-slate-500">
                                        {despachoVisual?.contrato || "Sin contrato"}
                                    </p>

                                    {fechaConsumoTexto ? (
                                        <p className="text-sm text-slate-500">
                                            {fechaConsumoTexto}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </nav>

                    <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pr-1 flex flex-col gap-4 md:gap-6">
                        {loadingGeneral ? (
                            <div className="flex-1 flex items-center justify-center text-slate-500">
                                Cargando informes del despacho...
                            </div>
                        ) : (
                            <>
                                <section className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm shrink-0">
                                    <div className="px-4 md:px-5 py-4 border-b bg-slate-50 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-lg font-bold text-slate-800">
                                                    {resumenInformeActivo.titulo}
                                                </h2>
                                                <TooltipInfo text={resumenInformeActivo.descripcion} />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap">
                                            {informeActivo === "POR_CATEGORIA" && (
                                                <button
                                                    type="button"
                                                    onClick={() => setModalCategoriasOpen(true)}
                                                    className="px-4 py-2 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-50 transition-colors flex items-center gap-2"
                                                >
                                                    <FaBoxesStacked />
                                                    <span>
                                                        {categoriaSeleccionada
                                                            ? `Categoría: ${categoriaSeleccionada}`
                                                            : "Seleccionar categoría"}
                                                    </span>
                                                </button>
                                            )}

                                            {informeActivo === "POR_CADENA_FRIO" && (
                                                <button
                                                    type="button"
                                                    onClick={() => setModalCadenaFrioOpen(true)}
                                                    className="px-4 py-2 border border-cyan-300 text-cyan-700 rounded-lg hover:bg-cyan-50 transition-colors flex items-center gap-2"
                                                >
                                                    <FaBoxesStacked />
                                                    <span>
                                                        {categoriaCadenaFrioSeleccionada
                                                            ? `Categoría: ${categoriaCadenaFrioSeleccionada}`
                                                            : "Seleccionar categoría"}
                                                    </span>
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={exportarExcel}
                                                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-2"
                                            >
                                                <FaFileExcel />
                                                <span>Exportar Excel</span>
                                            </button>

                                            {/* <button
                                                type="button"
                                                onClick={exportarPDF}
                                                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-2"
                                            >
                                                <FaFilePdf />
                                                <span>Exportar PDF</span>
                                            </button> */}
                                        </div>
                                    </div>

                                    <div className="p-4 md:p-5">{renderContenidoInforme()}</div>
                                </section>
                            </>
                        )}
                    </div>
                </article>
            </div>

            <ModalCategorias
                abierto={modalCategoriasOpen}
                onClose={() => setModalCategoriasOpen(false)}
                categorias={categoriasDisponibles}
                onSeleccionar={manejarSeleccionCategoria}
                categoriaSeleccionada={categoriaSeleccionada}
            />

            <ModalCategorias
                abierto={modalCadenaFrioOpen}
                onClose={() => setModalCadenaFrioOpen(false)}
                categorias={categoriasCadenaFrioDisponibles}
                onSeleccionar={manejarSeleccionCategoriaCadenaFrio}
                categoriaSeleccionada={categoriaCadenaFrioSeleccionada}
            />
        </>
    );
};

export default InformesDespachoRoldanillo;