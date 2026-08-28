import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaBoxes,
    FaBoxOpen,
    FaCalendarAlt,
    FaCheckCircle,
    FaClipboardList,
    FaExclamationTriangle,
    FaEye,
    FaFilter,
    FaLayerGroup,
    FaSearch,
    FaSyncAlt,
    FaTimes,
    FaWarehouse,
} from "react-icons/fa";
import { toast } from "react-toastify";

const API_BASE_EXISTENCIAS =
    "https://app.accionporcolombia.com/servicesPae/Inventario/Existencias/";

export const ExistenciasInventario = ({
    setSidebar,
    navegar,
}) => {
    const abrirMenu = () => setSidebar(true);

    const [vista, setVista] = useState("DETALLE");
    const [cargando, setCargando] = useState(true);
    const [cargandoForm, setCargandoForm] = useState(true);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);

    const [existencias, setExistencias] = useState([]);
    const [resumenServicio, setResumenServicio] = useState(null);
    const [bodegas, setBodegas] = useState([]);
    const [ubicaciones, setUbicaciones] = useState([]);
    const [tiposProducto, setTiposProducto] = useState([]);

    const [filtros, setFiltros] = useState({
        q: "",
        idBodega: "",
        idUbicacion: "",
        idTipoProducto: "",
        estadoVencimiento: "",
        estadoStock: "",
        soloDisponibles: true,
        incluirCeros: false,
        diasAlerta: 30,
    });

    const [modalFiltros, setModalFiltros] = useState(false);

    const [modalValidacion, setModalValidacion] = useState({
        visible: false,
        cargando: false,
        resumen: null,
        data: [],
    });

    const [modalDetalle, setModalDetalle] = useState({
        visible: false,
        existencia: null,
        movimientos: [],
    });

    const respuestaExitosa = (respuesta) =>
        respuesta?.rpta === "si" ||
        respuesta?.rpta === true;

    const formatearNumero = (valor) => {
        const numero = Number(valor ?? 0);

        return new Intl.NumberFormat("es-CO", {
            maximumFractionDigits: 3,
        }).format(numero);
    };

    const formatearFecha = (fecha) => {
        if (!fecha) {
            return "Sin fecha";
        }

        const partes = String(fecha)
            .substring(0, 10)
            .split("-");

        if (partes.length !== 3) {
            return fecha;
        }

        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    };

    const cambiarFiltro = (campo, valor) => {
        setFiltros((prev) => {
            const nuevo = {
                ...prev,
                [campo]: valor,
            };

            if (campo === "idBodega") {
                nuevo.idUbicacion = "";
            }

            return nuevo;
        });
    };

    const ubicacionesFiltradas = useMemo(() => {
        const idBodega = Number(filtros.idBodega || 0);

        if (!idBodega) {
            return [];
        }

        return ubicaciones.filter(
            (ubicacion) =>
                Number(ubicacion?.idBodega || 0) === idBodega
        );
    }, [ubicaciones, filtros.idBodega]);

    const cargarFormData = useCallback(async () => {
        setCargandoForm(true);

        try {
            const params = new URLSearchParams();
            params.set("t", Date.now());

            const respuesta = await fetch(
                `${API_BASE_EXISTENCIAS}InventarioExistenciasFormData.php?${params.toString()}`,
                {
                    method: "GET",
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                        "Cache-Control": "no-cache",
                    },
                }
            );

            const texto = await respuesta.text();

            let resultado;

            try {
                resultado = JSON.parse(texto);
            } catch {
                throw new Error(
                    texto ||
                    "El servicio devolvió una respuesta no válida."
                );
            }

            if (
                !respuesta.ok ||
                !respuestaExitosa(resultado)
            ) {
                throw new Error(
                    resultado?.error ||
                    resultado?.mensaje ||
                    "No fue posible consultar los datos del formulario."
                );
            }

            const data = resultado?.data || {};

            setBodegas(
                Array.isArray(data?.bodegas)
                    ? data.bodegas
                    : []
            );

            setUbicaciones(
                Array.isArray(data?.ubicaciones)
                    ? data.ubicaciones
                    : []
            );

            setTiposProducto(
                Array.isArray(data?.tiposProducto)
                    ? data.tiposProducto
                    : []
            );
        } catch (error) {
            console.error(
                "Error cargando form data existencias:",
                error
            );

            toast.error(
                error?.message ||
                "No fue posible cargar los filtros de existencias."
            );
        } finally {
            setCargandoForm(false);
        }
    }, []);

    const construirParametrosBase = useCallback(() => {
        const params = new URLSearchParams();

        params.set("t", Date.now());
        params.set("limite", 500);

        if (filtros.q.trim()) {
            params.set("q", filtros.q.trim());
        }

        if (filtros.idBodega) {
            params.set("idBodega", filtros.idBodega);
        }

        if (filtros.idUbicacion) {
            params.set("idUbicacion", filtros.idUbicacion);
        }

        if (filtros.idTipoProducto) {
            params.set(
                "idTipoProducto",
                filtros.idTipoProducto
            );
        }

        if (filtros.estadoVencimiento) {
            params.set(
                "estadoVencimiento",
                filtros.estadoVencimiento
            );
        }

        if (filtros.estadoStock) {
            params.set("estadoStock", filtros.estadoStock);
        }

        params.set(
            "soloDisponibles",
            filtros.soloDisponibles ? "1" : "0"
        );

        params.set(
            "incluirCeros",
            filtros.incluirCeros ? "1" : "0"
        );

        return params;
    }, [filtros]);

    const cargarExistencias = useCallback(async () => {
        setCargando(true);

        try {
            let endpoint =
                "InventarioExistenciasListar.php";
            let params = construirParametrosBase();

            if (vista === "RESUMEN") {
                endpoint =
                    "InventarioExistenciasResumenProducto.php";
            }

            if (vista === "ALERTAS") {
                endpoint =
                    "InventarioExistenciasAlertas.php";
                params = new URLSearchParams();

                params.set("t", Date.now());
                params.set("limite", 500);
                params.set(
                    "dias",
                    String(filtros.diasAlerta || 30)
                );

                if (filtros.idBodega) {
                    params.set("idBodega", filtros.idBodega);
                }
            }

            const respuesta = await fetch(
                `${API_BASE_EXISTENCIAS}${endpoint}?${params.toString()}`,
                {
                    method: "GET",
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                        "Cache-Control": "no-cache",
                    },
                }
            );

            const texto = await respuesta.text();

            let resultado;

            try {
                resultado = JSON.parse(texto);
            } catch {
                throw new Error(
                    texto ||
                    "El servicio devolvió una respuesta no válida."
                );
            }

            if (
                !respuesta.ok ||
                !respuestaExitosa(resultado)
            ) {
                throw new Error(
                    resultado?.error ||
                    resultado?.mensaje ||
                    "No fue posible consultar las existencias."
                );
            }

            setExistencias(
                Array.isArray(resultado?.data)
                    ? resultado.data
                    : []
            );

            setResumenServicio(resultado?.resumen || null);
        } catch (error) {
            console.error(
                "Error cargando existencias:",
                error
            );

            setExistencias([]);
            setResumenServicio(null);

            toast.error(
                error?.message ||
                "No fue posible cargar las existencias."
            );
        } finally {
            setCargando(false);
        }
    }, [
        vista,
        filtros.idBodega,
        filtros.diasAlerta,
        construirParametrosBase,
    ]);

    useEffect(() => {
        cargarFormData();
    }, [cargarFormData]);

    useEffect(() => {
        cargarExistencias();
    }, [cargarExistencias]);

    useEffect(() => {
        if (!modalDetalle.visible && !modalFiltros && !modalValidacion.visible) {
            return undefined;
        }

        const overflowAnterior =
            document.body.style.overflow;

        const cerrarConEscape = (event) => {
            if (event.key === "Escape") {
                cerrarModalDetalle();
                setModalFiltros(false);
                cerrarModalValidacion();
            }
        };

        document.body.style.overflow = "hidden";
        window.addEventListener(
            "keydown",
            cerrarConEscape
        );

        return () => {
            document.body.style.overflow =
                overflowAnterior;
            window.removeEventListener(
                "keydown",
                cerrarConEscape
            );
        };
    }, [modalDetalle.visible, modalFiltros, modalValidacion.visible]);

    const resumenCalculado = useMemo(() => {
        if (resumenServicio && vista !== "RESUMEN") {
            return resumenServicio;
        }

        return existencias.reduce(
            (acc, item) => {
                acc.totalRegistros += 1;
                acc.totalDisponible += Number(
                    item?.cantidadDisponible ?? 0
                );
                acc.totalReservado += Number(
                    item?.cantidadReservada ?? 0
                );
                acc.totalBloqueado += Number(
                    item?.cantidadBloqueada ?? 0
                );
                acc.totalGeneral += Number(
                    item?.cantidadTotal ?? 0
                );

                const idProducto = item?.idProducto;
                const idBodega = item?.idBodega;
                const idLote = item?.idLote;

                if (idProducto) {
                    acc.productos[idProducto] = true;
                }

                if (idBodega) {
                    acc.bodegas[idBodega] = true;
                }

                if (idLote) {
                    acc.lotes[idLote] = true;
                }

                const estado =
                    item?.estadoVencimiento ||
                    item?.estadoProximoVencimiento;

                if (estado === "VENCIDO") {
                    acc.totalVencidos += 1;
                }

                if (estado === "POR_VENCER") {
                    acc.totalPorVencer += 1;
                }

                const estadoStock = item?.estadoStock;

                if (estadoStock === "BAJO") {
                    acc.totalStockBajo += 1;
                }

                if (estadoStock === "CRITICO") {
                    acc.totalStockCritico += 1;
                }

                if (estadoStock === "SIN_STOCK") {
                    acc.totalSinStock += 1;
                }

                return acc;
            },
            {
                totalRegistros: 0,
                totalDisponible: 0,
                totalReservado: 0,
                totalBloqueado: 0,
                totalGeneral: 0,
                totalVencidos: 0,
                totalPorVencer: 0,
                totalStockBajo: 0,
                totalStockCritico: 0,
                totalSinStock: 0,
                productos: {},
                bodegas: {},
                lotes: {},
            }
        );
    }, [existencias, resumenServicio, vista]);

    const resumen = useMemo(() => {
        const productos =
            resumenCalculado.totalProductos ??
            Object.keys(resumenCalculado.productos || {})
                .length;

        const bodegas =
            resumenCalculado.totalBodegas ??
            Object.keys(resumenCalculado.bodegas || {})
                .length;

        const lotes =
            resumenCalculado.totalLotes ??
            Object.keys(resumenCalculado.lotes || {})
                .length;

        return {
            totalRegistros:
                resumenCalculado.totalRegistros ??
                existencias.length,
            totalProductos: productos,
            totalBodegas: bodegas,
            totalLotes: lotes,
            totalDisponible: Number(
                resumenCalculado.totalDisponible ?? 0
            ),
            totalReservado: Number(
                resumenCalculado.totalReservado ?? 0
            ),
            totalBloqueado: Number(
                resumenCalculado.totalBloqueado ?? 0
            ),
            totalGeneral: Number(
                resumenCalculado.totalGeneral ??
                resumenCalculado.totalDisponible ??
                0
            ),
            totalVencidos: Number(
                resumenCalculado.totalVencidos ?? 0
            ),
            totalPorVencer: Number(
                resumenCalculado.totalPorVencer ?? 0
            ),
            totalStockBajo: Number(
                resumenCalculado.totalStockBajo ?? 0
            ),
            totalStockCritico: Number(
                resumenCalculado.totalStockCritico ?? 0
            ),
            totalSinStock: Number(
                resumenCalculado.totalSinStock ?? 0
            ),
        };
    }, [resumenCalculado, existencias.length]);

    const limpiarFiltros = () => {
        setFiltros({
            q: "",
            idBodega: "",
            idUbicacion: "",
            idTipoProducto: "",
            estadoVencimiento: "",
            estadoStock: "",
            soloDisponibles: true,
            incluirCeros: false,
            diasAlerta: 30,
        });
    };

    const claseEstadoVencimiento = (estado) => {
        const valor = String(estado || "")
            .trim()
            .toUpperCase();

        if (valor === "VENCIDO") {
            return "bg-rose-50 text-rose-700 border-rose-200";
        }

        if (valor === "POR_VENCER") {
            return "bg-amber-50 text-amber-700 border-amber-200";
        }

        if (valor === "VIGENTE") {
            return "bg-emerald-50 text-emerald-700 border-emerald-200";
        }

        return "bg-slate-50 text-slate-600 border-slate-200";
    };

    const textoEstadoVencimiento = (item) => {
        return (
            item?.estadoVencimientoTexto ||
            item?.estadoProximoVencimientoTexto ||
            "Sin fecha"
        );
    };

    const abrirModalDetalle = async (existencia) => {
        const idExistencia = Number(
            existencia?.idExistencia ??
            existencia?.id ??
            0
        );

        if (!idExistencia) {
            toast.warning(
                "No se pudo identificar la existencia."
            );
            return;
        }

        setCargandoDetalle(true);
        setModalDetalle({
            visible: true,
            existencia,
            movimientos: [],
        });

        try {
            const params = new URLSearchParams();

            params.set("idExistencia", idExistencia);
            params.set("t", Date.now());

            const respuesta = await fetch(
                `${API_BASE_EXISTENCIAS}InventarioExistenciasDetalle.php?${params.toString()}`,
                {
                    method: "GET",
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                        "Cache-Control": "no-cache",
                    },
                }
            );

            const texto = await respuesta.text();

            let resultado;

            try {
                resultado = JSON.parse(texto);
            } catch {
                throw new Error(
                    texto ||
                    "El servicio devolvió una respuesta no válida."
                );
            }

            if (
                !respuesta.ok ||
                !respuestaExitosa(resultado)
            ) {
                throw new Error(
                    resultado?.error ||
                    resultado?.mensaje ||
                    "No fue posible consultar el detalle."
                );
            }

            const data = resultado?.data || {};

            setModalDetalle({
                visible: true,
                existencia:
                    data?.existencia || existencia,
                movimientos: Array.isArray(
                    data?.movimientos
                )
                    ? data.movimientos
                    : [],
            });
        } catch (error) {
            console.error(
                "Error cargando detalle de existencia:",
                error
            );

            toast.error(
                error?.message ||
                "No fue posible cargar el detalle."
            );
        } finally {
            setCargandoDetalle(false);
        }
    };

    const cerrarModalDetalle = () => {
        if (cargandoDetalle) {
            return;
        }

        setModalDetalle({
            visible: false,
            existencia: null,
            movimientos: [],
        });
    };

    const tituloVista = () => {
        if (vista === "RESUMEN") {
            return "Saldos consolidados por producto";
        }

        if (vista === "ALERTAS") {
            return "Alertas de vencimiento";
        }

        return "Existencias detalladas";
    };

    const renderEstadoVencimiento = (item) => {
        const estado =
            item?.estadoVencimiento ||
            item?.estadoProximoVencimiento;

        return (
            <span
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${claseEstadoVencimiento(
                    estado
                )}`}
            >
                {estado === "VENCIDO" ? (
                    <FaExclamationTriangle />
                ) : (
                    <FaCheckCircle />
                )}
                {textoEstadoVencimiento(item)}
            </span>
        );
    };

    const claseEstadoStock = (estado) => {
        const valor = String(estado || "")
            .trim()
            .toUpperCase();

        if (valor === "SIN_STOCK") {
            return "bg-rose-50 text-rose-700 border-rose-200";
        }

        if (valor === "CRITICO") {
            return "bg-orange-50 text-orange-700 border-orange-200";
        }

        if (valor === "BAJO") {
            return "bg-amber-50 text-amber-700 border-amber-200";
        }

        if (valor === "OK") {
            return "bg-emerald-50 text-emerald-700 border-emerald-200";
        }

        return "bg-slate-50 text-slate-600 border-slate-200";
    };

    const renderEstadoStock = (item) => (
        <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${claseEstadoStock(
                item?.estadoStock
            )}`}
        >
            {item?.alertaStock ? (
                <FaExclamationTriangle />
            ) : (
                <FaCheckCircle />
            )}
            {item?.estadoStockTexto || "Sin mínimo"}
        </span>
    );

    const escaparCsv = (valor) => {
        if (valor === null || valor === undefined) {
            return "";
        }

        const texto = String(valor)
            .replace(/\r?\n|\r/g, " ")
            .replace(/"/g, '""');

        return `"${texto}"`;
    };

    const columnasExportacion = () => {
        if (vista === "RESUMEN") {
            return [
                ["codigoProducto", "Código"],
                ["producto", "Producto"],
                ["tipoProducto", "Tipo producto"],
                ["unidad", "Unidad"],
                ["cantidadDisponible", "Disponible"],
                ["cantidadReservada", "Reservado"],
                ["cantidadBloqueada", "Bloqueado"],
                ["stockMinimo", "Stock mínimo"],
                ["estadoStockTexto", "Estado stock"],
                ["totalBodegas", "Bodegas"],
                ["totalUbicaciones", "Ubicaciones"],
                ["totalLotes", "Lotes"],
                ["proximoVencimiento", "Próximo vencimiento"],
                ["estadoProximoVencimientoTexto", "Estado vencimiento"],
            ];
        }

        return [
            ["codigoProducto", "Código"],
            ["producto", "Producto"],
            ["tipoProducto", "Tipo producto"],
            ["unidad", "Unidad"],
            ["bodega", "Bodega"],
            ["ubicacion", "Ubicación"],
            ["lote", "Lote"],
            ["cantidadDisponible", "Disponible"],
            ["cantidadReservada", "Reservado"],
            ["cantidadBloqueada", "Bloqueado"],
            ["stockMinimo", "Stock mínimo"],
            ["estadoStockTexto", "Estado stock"],
            ["fechaVencimiento", "Fecha vencimiento"],
            ["estadoVencimientoTexto", "Estado vencimiento"],
            ["ultimoMovimiento", "Último movimiento"],
        ];
    };

    const exportarExcel = () => {
        if (existencias.length === 0) {
            toast.info("No hay datos para exportar.");
            return;
        }

        /*
            Importante:
            Antes se generaba una tabla HTML con extensión .xls.
            Excel la abre, pero muestra alerta porque el contenido real
            no coincide con la extensión del archivo.

            Para evitar esa alerta sin agregar dependencias externas,
            exportamos CSV con BOM UTF-8 y separador punto y coma.
            Excel lo abre directamente y respeta tildes/ñ.
        */
        const columnas = columnasExportacion();

        const encabezado = columnas
            .map(([, tituloColumna]) => escaparCsv(tituloColumna))
            .join(";");

        const filas = existencias.map((item) =>
            columnas
                .map(([campo]) => escaparCsv(item?.[campo]))
                .join(";")
        );

        const contenido = [encabezado, ...filas].join("\r\n");

        const blob = new Blob(["\ufeff", contenido], {
            type: "text/csv;charset=utf-8;",
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const fecha = new Date().toISOString().substring(0, 10);

        link.href = url;
        link.download = `existencias_${vista.toLowerCase()}_${fecha}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success("Archivo exportado correctamente.");
    };

    const cerrarModalValidacion = () => {
        if (modalValidacion.cargando) {
            return;
        }

        setModalValidacion({
            visible: false,
            cargando: false,
            resumen: null,
            data: [],
        });
    };

    const validarMovimientos = async () => {
        setModalValidacion({
            visible: true,
            cargando: true,
            resumen: null,
            data: [],
        });

        try {
            const params = construirParametrosBase();
            params.set("limite", 1000);

            const respuesta = await fetch(
                `${API_BASE_EXISTENCIAS}InventarioExistenciasValidarMovimientos.php?${params.toString()}`,
                {
                    method: "GET",
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                        "Cache-Control": "no-cache",
                    },
                }
            );

            const texto = await respuesta.text();
            let resultado;

            try {
                resultado = JSON.parse(texto);
            } catch {
                throw new Error(texto || "El servicio devolvió una respuesta no válida.");
            }

            if (!respuesta.ok || !respuestaExitosa(resultado)) {
                throw new Error(
                    resultado?.error ||
                    resultado?.mensaje ||
                    "No fue posible validar las existencias contra movimientos."
                );
            }

            setModalValidacion({
                visible: true,
                cargando: false,
                resumen: resultado?.resumen || null,
                data: Array.isArray(resultado?.data) ? resultado.data : [],
            });
        } catch (error) {
            console.error("Error validando movimientos:", error);

            setModalValidacion({
                visible: false,
                cargando: false,
                resumen: null,
                data: [],
            });

            toast.error(
                error?.message ||
                "No fue posible validar las existencias contra movimientos."
            );
        }
    };

    return (
        <>
            <div className="w-full h-screen flex flex-col p-2 md:p-4 gap-4 bg-slate-100">
                <article className="flex-1 bg-white shadow-lg rounded-2xl flex flex-col overflow-hidden border border-slate-200">
                    <header className="px-4 py-3 md:px-5 border-b border-slate-200 bg-white">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <button
                                    type="button"
                                    onClick={abrirMenu}
                                    className="lg:hidden w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-50 transition"
                                    aria-label="Abrir menú"
                                >
                                    <IoMenu className="text-2xl" />
                                </button>

                                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                                    <FaWarehouse className="text-lg text-indigo-700" />
                                </div>

                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700">
                                        Control de inventarios
                                    </p>

                                    <h1 className="mt-0.5 text-xl md:text-2xl font-bold text-slate-900">
                                        Existencias / Saldos
                                    </h1>

                                    <p className="mt-0.5 text-xs md:text-sm text-slate-500 max-w-2xl">
                                        Saldos por producto, bodega, ubicación, lote y vencimiento.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={validarMovimientos}
                                    disabled={cargando}
                                    className="h-10 px-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-amber-100 disabled:opacity-60 transition"
                                >
                                    <FaCheckCircle />
                                    Validar
                                </button>

                                <button
                                    type="button"
                                    onClick={exportarExcel}
                                    disabled={cargando || existencias.length === 0}
                                    className="h-10 px-3 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-100 disabled:opacity-60 transition"
                                >
                                    <FaClipboardList />
                                    Exportar Excel
                                </button>

                                <button
                                    type="button"
                                    onClick={cargarExistencias}
                                    disabled={cargando}
                                    className="h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-50 disabled:opacity-60 transition"
                                >
                                    <FaSyncAlt
                                        className={
                                            cargando
                                                ? "animate-spin"
                                                : ""
                                        }
                                    />
                                    Actualizar
                                </button>
                            </div>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto">
                        <div className="p-3 md:p-5 space-y-4">
                            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-3">
                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-slate-500">
                                                Registros
                                            </p>

                                            <p className="mt-2 text-3xl font-bold text-slate-900">
                                                {
                                                    resumen.totalRegistros
                                                }
                                            </p>
                                        </div>

                                        <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center">
                                            <FaClipboardList className="text-lg text-slate-700" />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-blue-700">
                                                Productos
                                            </p>

                                            <p className="mt-2 text-3xl font-bold text-blue-800">
                                                {
                                                    resumen.totalProductos
                                                }
                                            </p>
                                        </div>

                                        <div className="w-11 h-11 rounded-xl bg-white/70 flex items-center justify-center">
                                            <FaBoxes className="text-lg text-blue-700" />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-indigo-700">
                                                Disponible
                                            </p>

                                            <p className="mt-2 text-3xl font-bold text-indigo-800">
                                                {formatearNumero(
                                                    resumen.totalDisponible
                                                )}
                                            </p>
                                        </div>

                                        <div className="w-11 h-11 rounded-xl bg-white/70 flex items-center justify-center">
                                            <FaBoxOpen className="text-lg text-indigo-700" />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-emerald-700">
                                                Bodegas
                                            </p>

                                            <p className="mt-2 text-3xl font-bold text-emerald-800">
                                                {
                                                    resumen.totalBodegas
                                                }
                                            </p>
                                        </div>

                                        <div className="w-11 h-11 rounded-xl bg-white/70 flex items-center justify-center">
                                            <FaWarehouse className="text-lg text-emerald-700" />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-amber-700">
                                                Por vencer
                                            </p>

                                            <p className="mt-2 text-3xl font-bold text-amber-800">
                                                {
                                                    resumen.totalPorVencer
                                                }
                                            </p>
                                        </div>

                                        <div className="w-11 h-11 rounded-xl bg-white/70 flex items-center justify-center">
                                            <FaCalendarAlt className="text-lg text-amber-700" />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-orange-700">
                                                Stock bajo
                                            </p>

                                            <p className="mt-2 text-3xl font-bold text-orange-800">
                                                {resumen.totalStockBajo + resumen.totalStockCritico + resumen.totalSinStock}
                                            </p>
                                        </div>

                                        <div className="w-11 h-11 rounded-xl bg-white/70 flex items-center justify-center">
                                            <FaExclamationTriangle className="text-lg text-orange-700" />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-rose-700">
                                                Vencidos
                                            </p>

                                            <p className="mt-2 text-3xl font-bold text-rose-800">
                                                {
                                                    resumen.totalVencidos
                                                }
                                            </p>
                                        </div>

                                        <div className="w-11 h-11 rounded-xl bg-white/70 flex items-center justify-center">
                                            <FaExclamationTriangle className="text-lg text-rose-700" />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4 shadow-sm">
                                <div className="flex flex-col xl:flex-row xl:items-center gap-3">
                                    <div className="relative flex-1">
                                        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                                        <input
                                            type="text"
                                            value={filtros.q}
                                            onChange={(event) =>
                                                cambiarFiltro(
                                                    "q",
                                                    event.target.value
                                                )
                                            }
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                    cargarExistencias();
                                                }
                                            }}
                                            placeholder="Buscar producto, código, lote, bodega o ubicación"
                                            className="w-full h-11 pl-11 pr-4 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                        />
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={cargarExistencias}
                                            disabled={cargando || cargandoForm}
                                            className="h-11 px-4 rounded-xl bg-blue-800 text-white font-semibold flex items-center justify-center gap-2 hover:bg-blue-900 disabled:opacity-60 transition"
                                        >
                                            <FaSearch />
                                            Buscar
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setModalFiltros(true)}
                                            className="h-11 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold flex items-center justify-center gap-2 hover:bg-slate-50 transition"
                                        >
                                            <FaFilter />
                                            Filtros
                                        </button>

                                        <button
                                            type="button"
                                            onClick={limpiarFiltros}
                                            className="h-11 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition"
                                        >
                                            Limpiar
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setVista("DETALLE")}
                                            className={`h-9 px-3 rounded-xl border text-sm font-semibold flex items-center gap-2 transition ${vista === "DETALLE"
                                                    ? "bg-blue-800 border-blue-800 text-white"
                                                    : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                                                }`}
                                        >
                                            <FaClipboardList />
                                            Detallado
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setVista("RESUMEN")}
                                            className={`h-9 px-3 rounded-xl border text-sm font-semibold flex items-center gap-2 transition ${vista === "RESUMEN"
                                                    ? "bg-blue-800 border-blue-800 text-white"
                                                    : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                                                }`}
                                        >
                                            <FaLayerGroup />
                                            Resumen
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setVista("ALERTAS")}
                                            className={`h-9 px-3 rounded-xl border text-sm font-semibold flex items-center gap-2 transition ${vista === "ALERTAS"
                                                    ? "bg-blue-800 border-blue-800 text-white"
                                                    : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                                                }`}
                                        >
                                            <FaExclamationTriangle />
                                            Alertas
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                        {filtros.idBodega && (
                                            <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                                                Bodega filtrada
                                            </span>
                                        )}

                                        {filtros.idTipoProducto && (
                                            <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                                                Tipo producto
                                            </span>
                                        )}

                                        {filtros.estadoVencimiento && (
                                            <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                                                {filtros.estadoVencimiento}
                                            </span>
                                        )}

                                        {filtros.estadoStock && (
                                            <span className="px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700">
                                                Stock: {filtros.estadoStock}
                                            </span>
                                        )}

                                        {filtros.soloDisponibles && vista !== "ALERTAS" && (
                                            <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                                                Solo disponibles
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                                    <div>
                                        <h2 className="font-bold text-slate-900">
                                            {tituloVista()}
                                        </h2>

                                        <p className="text-sm text-slate-500">
                                            {existencias.length} registro
                                            {existencias.length ===
                                                1
                                                ? ""
                                                : "s"}{" "}
                                            encontrado
                                            {existencias.length ===
                                                1
                                                ? ""
                                                : "s"}
                                        </p>
                                    </div>
                                </div>

                                {cargando || cargandoForm ? (
                                    <div className="min-h-[380px] flex flex-col items-center justify-center gap-4">
                                        <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />

                                        <p className="text-sm font-medium text-slate-500">
                                            Cargando existencias...
                                        </p>
                                    </div>
                                ) : existencias.length === 0 ? (
                                    <div className="min-h-[380px] flex flex-col items-center justify-center text-center px-6">
                                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                                            <FaBoxOpen className="text-2xl text-slate-500" />
                                        </div>

                                        <h3 className="mt-4 text-lg font-bold text-slate-800">
                                            No hay existencias para mostrar
                                        </h3>

                                        <p className="mt-1 text-sm text-slate-500 max-w-md">
                                            Ajusta los filtros o valida que ya existan movimientos finalizados de inventario.
                                        </p>
                                    </div>
                                ) : vista === "RESUMEN" ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[1180px]">
                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Producto
                                                    </th>
                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Tipo
                                                    </th>
                                                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Disponible
                                                    </th>
                                                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Reservado
                                                    </th>
                                                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Bloqueado
                                                    </th>
                                                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Bodegas
                                                    </th>
                                                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Lotes
                                                    </th>
                                                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Stock mín.
                                                    </th>
                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Estado stock
                                                    </th>
                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Próx. vencimiento
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-slate-200">
                                                {existencias.map(
                                                    (item) => (
                                                        <tr
                                                            key={
                                                                item.idProducto
                                                            }
                                                            className="hover:bg-slate-50 transition"
                                                        >
                                                            <td className="px-5 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-800 shrink-0">
                                                                        <FaBoxes />
                                                                    </div>

                                                                    <div>
                                                                        <p className="font-semibold text-slate-900">
                                                                            {
                                                                                item.producto
                                                                            }
                                                                        </p>
                                                                        <p className="text-xs text-slate-500">
                                                                            {item.codigoProducto ||
                                                                                `ID ${item.idProducto}`}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            <td className="px-5 py-4 text-sm text-slate-600">
                                                                {item.tipoProducto ||
                                                                    "Sin tipo"}
                                                            </td>
                                                            <td className="px-5 py-4 text-center">
                                                                <span className="inline-flex px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold">
                                                                    {formatearNumero(
                                                                        item.cantidadDisponible
                                                                    )}
                                                                </span>
                                                            </td>

                                                            <td className="px-5 py-4 text-center text-sm font-semibold text-slate-700">
                                                                {formatearNumero(
                                                                    item.cantidadReservada
                                                                )}
                                                            </td>

                                                            <td className="px-5 py-4 text-center text-sm font-semibold text-slate-700">
                                                                {formatearNumero(
                                                                    item.cantidadBloqueada
                                                                )}
                                                            </td>

                                                            <td className="px-5 py-4 text-center text-sm font-bold text-slate-700">
                                                                {
                                                                    item.totalBodegas
                                                                }
                                                            </td>

                                                            <td className="px-5 py-4 text-center text-sm font-bold text-slate-700">
                                                                {
                                                                    item.totalLotes
                                                                }
                                                            </td>

                                                            <td className="px-5 py-4 text-center text-sm font-bold text-slate-700">
                                                                {formatearNumero(item.stockMinimo)}
                                                            </td>

                                                            <td className="px-5 py-4">
                                                                {renderEstadoStock(item)}
                                                            </td>

                                                            <td className="px-5 py-4">
                                                                {renderEstadoVencimiento(
                                                                    item
                                                                )}

                                                                {item.proximoVencimiento && (
                                                                    <p className="mt-1 text-xs text-slate-500">
                                                                        {formatearFecha(
                                                                            item.proximoVencimiento
                                                                        )}
                                                                    </p>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    )
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[1320px]">
                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Producto
                                                    </th>
                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Bodega / Ubicación
                                                    </th>
                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Lote
                                                    </th>
                                                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Stock mín.
                                                    </th>
                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Estado stock
                                                    </th>
                                                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Disponible
                                                    </th>
                                                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Reservado
                                                    </th>
                                                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Bloqueado
                                                    </th>
                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Vencimiento
                                                    </th>
                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Último movimiento
                                                    </th>
                                                    <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Acción
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-slate-200">
                                                {existencias.map(
                                                    (item) => (
                                                        <tr
                                                            key={
                                                                item.idExistencia ||
                                                                item.id
                                                            }
                                                            className="hover:bg-slate-50 transition"
                                                        >
                                                            <td className="px-5 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                                                                        <FaBoxes />
                                                                    </div>

                                                                    <div>
                                                                        <p className="font-semibold text-slate-900 max-w-[280px] truncate">
                                                                            {
                                                                                item.producto
                                                                            }
                                                                        </p>
                                                                        <p className="text-xs text-slate-500">
                                                                            {item.codigoProducto ||
                                                                                `ID ${item.idProducto}`}{" "}
                                                                            ·{" "}
                                                                            {item.unidad ||
                                                                                "UND"}
                                                                        </p>
                                                                        <p className="text-[11px] text-slate-400">
                                                                            {item.tipoProducto ||
                                                                                "Sin tipo"}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            <td className="px-5 py-4">
                                                                <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2">
                                                                    <p className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                                                                        <FaWarehouse className="text-indigo-700" />
                                                                        {item.bodega ||
                                                                            "Sin bodega"}
                                                                    </p>

                                                                    <p className="mt-1 text-xs text-indigo-700">
                                                                        {item.ubicacion ||
                                                                            "Sin ubicación específica"}
                                                                    </p>
                                                                </div>
                                                            </td>

                                                            <td className="px-5 py-4">
                                                                {item.lote ? (
                                                                    <div>
                                                                        <p className="text-sm font-bold text-slate-800">
                                                                            {
                                                                                item.lote
                                                                            }
                                                                        </p>
                                                                        <p className="text-xs text-slate-500">
                                                                            {item.manejaLote
                                                                                ? "Maneja lote"
                                                                                : "Sin manejo lote"}
                                                                        </p>
                                                                    </div>
                                                                ) : (
                                                                    <span className="inline-flex px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold">
                                                                        Sin lote
                                                                    </span>
                                                                )}
                                                            </td>

                                                            <td className="px-5 py-4 text-center text-sm font-bold text-slate-700">
                                                                {formatearNumero(item.stockMinimo)}
                                                            </td>

                                                            <td className="px-5 py-4">
                                                                {renderEstadoStock(item)}
                                                            </td>

                                                            <td className="px-5 py-4 text-center">
                                                                <span className="inline-flex px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold">
                                                                    {formatearNumero(
                                                                        item.cantidadDisponible
                                                                    )}
                                                                </span>
                                                            </td>

                                                            <td className="px-5 py-4 text-center text-sm font-semibold text-slate-700">
                                                                {formatearNumero(
                                                                    item.cantidadReservada
                                                                )}
                                                            </td>

                                                            <td className="px-5 py-4 text-center text-sm font-semibold text-slate-700">
                                                                {formatearNumero(
                                                                    item.cantidadBloqueada
                                                                )}
                                                            </td>

                                                            <td className="px-5 py-4">
                                                                {renderEstadoVencimiento(
                                                                    item
                                                                )}

                                                                {item.fechaVencimiento && (
                                                                    <p className="mt-1 text-xs text-slate-500">
                                                                        {formatearFecha(
                                                                            item.fechaVencimiento
                                                                        )}
                                                                        {item.diasVencimiento !==
                                                                            null &&
                                                                            item.diasVencimiento !==
                                                                            undefined && (
                                                                                <>
                                                                                    {" "}
                                                                                    ·{" "}
                                                                                    {
                                                                                        item.diasVencimiento
                                                                                    }{" "}
                                                                                    día
                                                                                    {Number(
                                                                                        item.diasVencimiento
                                                                                    ) ===
                                                                                        1
                                                                                        ? ""
                                                                                        : "s"}
                                                                                </>
                                                                            )}
                                                                    </p>
                                                                )}
                                                            </td>

                                                            <td className="px-5 py-4 text-sm text-slate-600">
                                                                {item.ultimoMovimiento
                                                                    ? formatearFecha(
                                                                        item.ultimoMovimiento
                                                                    )
                                                                    : "Sin movimiento"}
                                                            </td>

                                                            <td className="px-5 py-4">
                                                                <div className="flex justify-end">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            abrirModalDetalle(
                                                                                item
                                                                            )
                                                                        }
                                                                        className="h-10 px-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 font-semibold flex items-center justify-center gap-2 hover:bg-blue-100 transition"
                                                                    >
                                                                        <FaEye />
                                                                        Ver
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </section>
                        </div>
                    </div>
                </article>
            </div>

            {modalValidacion.visible && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6">
                    <button
                        type="button"
                        aria-label="Cerrar validación"
                        onClick={cerrarModalValidacion}
                        className="absolute inset-0 bg-slate-950/60"
                    />

                    <section className="relative w-full max-w-6xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
                        <header className="px-5 py-4 border-b border-slate-200 bg-white">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                                        <FaCheckCircle />
                                    </div>

                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
                                            Validación contra movimientos
                                        </p>

                                        <h2 className="mt-1 text-lg font-bold text-slate-900">
                                            Existencias vs último saldo de movimientos
                                        </h2>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={cerrarModalValidacion}
                                    disabled={modalValidacion.cargando}
                                    className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 disabled:opacity-60 transition"
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        </header>

                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {modalValidacion.cargando ? (
                                <div className="min-h-[320px] flex flex-col items-center justify-center gap-4">
                                    <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />
                                    <p className="text-sm font-medium text-slate-500">
                                        Validando movimientos...
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                            <p className="text-sm text-slate-500 font-semibold">Registros</p>
                                            <p className="mt-2 text-2xl font-bold text-slate-900">
                                                {modalValidacion.resumen?.totalRegistros || 0}
                                            </p>
                                        </div>

                                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                                            <p className="text-sm text-emerald-700 font-semibold">Correctos</p>
                                            <p className="mt-2 text-2xl font-bold text-emerald-800">
                                                {modalValidacion.resumen?.totalOK || 0}
                                            </p>
                                        </div>

                                        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                                            <p className="text-sm text-rose-700 font-semibold">Diferencias</p>
                                            <p className="mt-2 text-2xl font-bold text-rose-800">
                                                {modalValidacion.resumen?.totalDiferencias || 0}
                                            </p>
                                        </div>

                                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                            <p className="text-sm text-amber-700 font-semibold">Sin movimientos</p>
                                            <p className="mt-2 text-2xl font-bold text-amber-800">
                                                {modalValidacion.resumen?.totalSinMovimientos || 0}
                                            </p>
                                        </div>
                                    </section>

                                    {modalValidacion.data.length === 0 ? (
                                        <div className="min-h-[220px] rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-center px-6">
                                            <FaCheckCircle className="text-3xl text-emerald-600" />
                                            <h3 className="mt-3 text-base font-bold text-slate-800">
                                                No hay datos para mostrar
                                            </h3>
                                            <p className="mt-1 text-sm text-slate-500">
                                                La validación no devolvió registros con los filtros actuales.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                                            <table className="w-full min-w-[1180px]">
                                                <thead className="bg-slate-50 border-b border-slate-200">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Producto</th>
                                                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Ubicación</th>
                                                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Lote</th>
                                                        <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Existencia</th>
                                                        <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Saldo mov.</th>
                                                        <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Diferencia</th>
                                                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Estado</th>
                                                        <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">Último movimiento</th>
                                                    </tr>
                                                </thead>

                                                <tbody className="divide-y divide-slate-200">
                                                    {modalValidacion.data.map((item) => (
                                                        <tr key={item.idExistencia} className="hover:bg-slate-50 transition">
                                                            <td className="px-4 py-3">
                                                                <p className="text-sm font-bold text-slate-900">{item.producto}</p>
                                                                <p className="text-xs text-slate-500">{item.codigoProducto}</p>
                                                            </td>

                                                            <td className="px-4 py-3 text-sm text-slate-600">
                                                                <p className="font-semibold text-slate-800">{item.bodega}</p>
                                                                <p className="text-xs text-slate-500">{item.ubicacion || "Sin ubicación"}</p>
                                                            </td>

                                                            <td className="px-4 py-3 text-sm text-slate-600">
                                                                {item.lote || "Sin lote"}
                                                            </td>

                                                            <td className="px-4 py-3 text-center text-sm font-bold text-slate-800">
                                                                {formatearNumero(item.cantidadDisponible)}
                                                            </td>

                                                            <td className="px-4 py-3 text-center text-sm font-bold text-slate-800">
                                                                {item.saldoMovimiento === null ? "Sin saldo" : formatearNumero(item.saldoMovimiento)}
                                                            </td>

                                                            <td className="px-4 py-3 text-center text-sm font-bold text-slate-800">
                                                                {item.diferencia === null ? "-" : formatearNumero(item.diferencia)}
                                                            </td>

                                                            <td className="px-4 py-3">
                                                                <span
                                                                    className={`inline-flex px-3 py-1.5 rounded-full border text-xs font-bold ${item.estadoValidacion === "OK"
                                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                            : item.estadoValidacion === "DIFERENCIA"
                                                                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                                                                : "bg-amber-50 text-amber-700 border-amber-200"
                                                                        }`}
                                                                >
                                                                    {item.estadoValidacionTexto}
                                                                </span>
                                                            </td>

                                                            <td className="px-4 py-3 text-sm text-slate-600">
                                                                <p className="font-semibold text-slate-800">
                                                                    {item.consecutivo || "Sin documento"}
                                                                </p>
                                                                <p className="text-xs text-slate-500">
                                                                    {item.tipoMovimiento || "Sin movimiento"} · {formatearFecha(item.fechaMovimiento)}
                                                                </p>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </section>
                </div>
            )}

            {modalFiltros && (
                <div className="fixed inset-0 z-[9998] flex items-center justify-center p-3 md:p-6">
                    <button
                        type="button"
                        aria-label="Cerrar filtros"
                        onClick={() => setModalFiltros(false)}
                        className="absolute inset-0 bg-slate-950/60"
                    />

                    <section className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <header className="px-5 py-4 border-b border-slate-200 bg-white">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-800 shrink-0">
                                        <FaFilter />
                                    </div>

                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                                            Filtros
                                        </p>

                                        <h2 className="mt-1 text-lg font-bold text-slate-900">
                                            Filtrar existencias
                                        </h2>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setModalFiltros(false)}
                                    className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 transition"
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        </header>

                        <div className="p-5 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Bodega
                                    </label>

                                    <select
                                        value={filtros.idBodega}
                                        onChange={(event) =>
                                            cambiarFiltro("idBodega", event.target.value)
                                        }
                                        className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                    >
                                        <option value="">Todas</option>

                                        {bodegas.map((bodega) => (
                                            <option
                                                key={bodega.idBodega || bodega.id}
                                                value={bodega.idBodega || bodega.id}
                                            >
                                                {bodega.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Ubicación
                                    </label>

                                    <select
                                        value={filtros.idUbicacion}
                                        onChange={(event) =>
                                            cambiarFiltro("idUbicacion", event.target.value)
                                        }
                                        disabled={!filtros.idBodega}
                                        className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 disabled:bg-slate-100 disabled:text-slate-500 transition"
                                    >
                                        <option value="">Todas</option>

                                        {ubicacionesFiltradas.map((ubicacion) => (
                                            <option
                                                key={ubicacion.idUbicacion || ubicacion.id}
                                                value={ubicacion.idUbicacion || ubicacion.id}
                                            >
                                                {ubicacion.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Tipo producto
                                    </label>

                                    <select
                                        value={filtros.idTipoProducto}
                                        onChange={(event) =>
                                            cambiarFiltro("idTipoProducto", event.target.value)
                                        }
                                        className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                    >
                                        <option value="">Todos</option>

                                        {tiposProducto.map((tipo) => (
                                            <option
                                                key={tipo.idTipoProducto || tipo.id}
                                                value={tipo.idTipoProducto || tipo.id}
                                            >
                                                {tipo.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Vencimiento
                                    </label>

                                    <select
                                        value={filtros.estadoVencimiento}
                                        onChange={(event) =>
                                            cambiarFiltro("estadoVencimiento", event.target.value)
                                        }
                                        disabled={vista === "ALERTAS"}
                                        className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 disabled:bg-slate-100 disabled:text-slate-500 transition"
                                    >
                                        <option value="">Todos</option>
                                        <option value="VIGENTE">Vigente</option>
                                        <option value="POR_VENCER">Por vencer</option>
                                        <option value="VENCIDO">Vencido</option>
                                        <option value="SIN_FECHA">Sin fecha</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Stock mínimo
                                    </label>

                                    <select
                                        value={filtros.estadoStock || ""}
                                        onChange={(event) =>
                                            cambiarFiltro("estadoStock", event.target.value)
                                        }
                                        className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                    >
                                        <option value="">Todos</option>
                                        <option value="OK">OK</option>
                                        <option value="BAJO">Bajo mínimo</option>
                                        <option value="CRITICO">Crítico</option>
                                        <option value="SIN_STOCK">Sin stock</option>
                                        <option value="SIN_CONFIGURAR">Sin mínimo configurado</option>
                                    </select>
                                </div>

                                {vista === "ALERTAS" && (
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Días alerta
                                        </label>

                                        <input
                                            type="number"
                                            min="1"
                                            max="365"
                                            value={filtros.diasAlerta}
                                            onChange={(event) =>
                                                cambiarFiltro("diasAlerta", event.target.value)
                                            }
                                            className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col md:flex-row md:items-center gap-4">
                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={filtros.soloDisponibles}
                                        onChange={(event) =>
                                            cambiarFiltro("soloDisponibles", event.target.checked)
                                        }
                                        disabled={vista === "ALERTAS"}
                                        className="w-4 h-4"
                                    />
                                    Solo disponibles
                                </label>

                                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={filtros.incluirCeros}
                                        onChange={(event) =>
                                            cambiarFiltro("incluirCeros", event.target.checked)
                                        }
                                        disabled={vista === "ALERTAS"}
                                        className="w-4 h-4"
                                    />
                                    Incluir ceros
                                </label>
                            </div>
                        </div>

                        <footer className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                            <button
                                type="button"
                                onClick={limpiarFiltros}
                                className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-100 transition"
                            >
                                Limpiar
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setModalFiltros(false);
                                    cargarExistencias();
                                }}
                                className="h-10 px-5 rounded-xl bg-blue-800 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-blue-900 transition"
                            >
                                <FaFilter />
                                Aplicar filtros
                            </button>
                        </footer>
                    </section>
                </div>
            )}

            {modalDetalle.visible && modalDetalle.existencia && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6">
                    <button
                        type="button"
                        aria-label="Cerrar modal"
                        onClick={cerrarModalDetalle}
                        className="absolute inset-0 bg-slate-950/60"
                    />

                    <section className="relative w-full max-w-6xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
                        <header className="px-5 py-5 border-b border-slate-200 bg-white">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                                        <FaBoxes />
                                    </div>

                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
                                            Detalle de existencia
                                        </p>

                                        <h2 className="mt-1 text-xl font-bold text-slate-900">
                                            {
                                                modalDetalle
                                                    .existencia
                                                    .producto
                                            }
                                        </h2>

                                        <p className="text-sm text-slate-500">
                                            {modalDetalle.existencia
                                                .codigoProducto ||
                                                "Sin código"}
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={cerrarModalDetalle}
                                    disabled={cargandoDetalle}
                                    className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 disabled:opacity-60 transition"
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        </header>

                        <div className="flex-1 overflow-y-auto p-5 space-y-5">
                            <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                                    <p className="text-sm text-indigo-700 font-semibold">
                                        Disponible
                                    </p>
                                    <p className="mt-2 text-2xl font-bold text-indigo-900">
                                        {formatearNumero(
                                            modalDetalle
                                                .existencia
                                                .cantidadDisponible
                                        )}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-sm text-slate-500 font-semibold">
                                        Reservado
                                    </p>
                                    <p className="mt-2 text-2xl font-bold text-slate-900">
                                        {formatearNumero(
                                            modalDetalle
                                                .existencia
                                                .cantidadReservada
                                        )}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                    <p className="text-sm text-slate-500 font-semibold">
                                        Bloqueado
                                    </p>
                                    <p className="mt-2 text-2xl font-bold text-slate-900">
                                        {formatearNumero(
                                            modalDetalle
                                                .existencia
                                                .cantidadBloqueada
                                        )}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <p className="text-sm text-slate-500 font-semibold">
                                        Vencimiento
                                    </p>
                                    <div className="mt-2">
                                        {renderEstadoVencimiento(
                                            modalDetalle.existencia
                                        )}
                                    </div>
                                </div>
                            </section>

                            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        Ubicación
                                    </p>

                                    <p className="mt-2 text-sm font-bold text-slate-900">
                                        {modalDetalle.existencia.bodega ||
                                            "Sin bodega"}
                                    </p>

                                    <p className="text-sm text-slate-500">
                                        {modalDetalle.existencia
                                            .ubicacion ||
                                            "Sin ubicación específica"}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        Lote
                                    </p>

                                    <p className="mt-2 text-sm font-bold text-slate-900">
                                        {modalDetalle.existencia.lote ||
                                            "Sin lote"}
                                    </p>

                                    <p className="text-sm text-slate-500">
                                        Fecha vencimiento:{" "}
                                        {formatearFecha(
                                            modalDetalle.existencia
                                                .fechaVencimiento
                                        )}
                                    </p>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
                                    <h3 className="font-bold text-slate-900">
                                        Últimos movimientos
                                    </h3>

                                    <p className="text-sm text-slate-500">
                                        {
                                            modalDetalle.movimientos
                                                .length
                                        }{" "}
                                        movimiento
                                        {modalDetalle.movimientos
                                            .length === 1
                                            ? ""
                                            : "s"}{" "}
                                        encontrado
                                        {modalDetalle.movimientos
                                            .length === 1
                                            ? ""
                                            : "s"}
                                    </p>
                                </div>

                                {cargandoDetalle ? (
                                    <div className="min-h-[220px] flex flex-col items-center justify-center gap-4">
                                        <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />
                                        <p className="text-sm font-medium text-slate-500">
                                            Cargando movimientos...
                                        </p>
                                    </div>
                                ) : modalDetalle.movimientos
                                    .length === 0 ? (
                                    <div className="min-h-[220px] flex flex-col items-center justify-center text-center px-6">
                                        <FaClipboardList className="text-3xl text-slate-400" />
                                        <p className="mt-3 text-sm font-semibold text-slate-600">
                                            No hay movimientos para esta existencia.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[1000px]">
                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Fecha
                                                    </th>
                                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Documento
                                                    </th>
                                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Movimiento
                                                    </th>
                                                    <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Cantidad
                                                    </th>
                                                    <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Saldo anterior
                                                    </th>
                                                    <th className="px-5 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Saldo nuevo
                                                    </th>
                                                    <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Usuario
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-slate-200">
                                                {modalDetalle.movimientos.map(
                                                    (
                                                        movimiento
                                                    ) => (
                                                        <tr
                                                            key={
                                                                movimiento.idMovimiento
                                                            }
                                                            className="hover:bg-slate-50 transition"
                                                        >
                                                            <td className="px-5 py-3 text-sm text-slate-600">
                                                                {formatearFecha(
                                                                    movimiento.fechaMovimiento
                                                                )}
                                                            </td>

                                                            <td className="px-5 py-3">
                                                                <p className="text-sm font-bold text-slate-800">
                                                                    {movimiento.consecutivo ||
                                                                        "Sin documento"}
                                                                </p>
                                                                <p className="text-xs text-slate-500">
                                                                    {movimiento.tipoDocumento ||
                                                                        movimiento.codigoTipoDocumento ||
                                                                        "Movimiento"}
                                                                </p>
                                                            </td>

                                                            <td className="px-5 py-3">
                                                                <span className="inline-flex px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold">
                                                                    {
                                                                        movimiento.tipoMovimiento
                                                                    }
                                                                </span>
                                                            </td>

                                                            <td className="px-5 py-3 text-center text-sm font-bold text-slate-800">
                                                                {formatearNumero(
                                                                    movimiento.cantidad
                                                                )}
                                                            </td>

                                                            <td className="px-5 py-3 text-center text-sm text-slate-600">
                                                                {formatearNumero(
                                                                    movimiento.saldoAnterior
                                                                )}
                                                            </td>

                                                            <td className="px-5 py-3 text-center text-sm text-slate-600">
                                                                {formatearNumero(
                                                                    movimiento.saldoNuevo
                                                                )}
                                                            </td>

                                                            <td className="px-5 py-3 text-sm text-slate-600">
                                                                {movimiento.operador ||
                                                                    movimiento.usuario ||
                                                                    "Sin usuario"}
                                                            </td>
                                                        </tr>
                                                    )
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </section>
                        </div>
                    </section>
                </div>
            )}
        </>
    );
};
