import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaArrowDown,
    FaArrowUp,
    FaBarcode,
    FaBoxes,
    FaBoxOpen,
    FaCalendarAlt,
    FaChartLine,
    FaCheckCircle,
    FaClipboardList,
    FaExchangeAlt,
    FaEye,
    FaFileExcel,
    FaFilter,
    FaLayerGroup,
    FaSearch,
    FaSyncAlt,
    FaTimes,
    FaUndo,
    FaUserCog,
    FaWarehouse,
} from "react-icons/fa";
import { toast } from "react-toastify";

const API_BASE_MOVIMIENTOS =
    "https://app.accionporcolombia.com/servicesPae/Inventario/Movimientos/";

export const MovimientosInventario = ({
    setSidebar,
    navegar,
}) => {
    const abrirMenu = () => setSidebar(true);
    const scrollContainerRef = useRef(null);

    const [mostrarEncabezado, setMostrarEncabezado] = useState(true);
    const [vista, setVista] = useState("MOVIMIENTOS");
    const [cargando, setCargando] = useState(true);
    const [cargandoForm, setCargandoForm] = useState(true);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);
    const [buscandoProducto, setBuscandoProducto] = useState(false);

    const [movimientos, setMovimientos] = useState([]);
    const [resumen, setResumen] = useState(null);
    const [resumenGrupos, setResumenGrupos] = useState([]);
    const [kardex, setKardex] = useState(null);

    const [bodegas, setBodegas] = useState([]);
    const [ubicaciones, setUbicaciones] = useState([]);
    const [tiposProducto, setTiposProducto] = useState([]);
    const [tiposDocumento, setTiposDocumento] = useState([]);
    const [tiposMovimiento, setTiposMovimiento] = useState([]);
    const [naturalezas, setNaturalezas] = useState([]);
    const [estadosProceso, setEstadosProceso] = useState([]);
    const [operadores, setOperadores] = useState([]);

    const [productoBusqueda, setProductoBusqueda] = useState("");
    const [productoKardex, setProductoKardex] = useState(null);
    const [productosEncontrados, setProductosEncontrados] = useState([]);

    const [modalFiltros, setModalFiltros] = useState(false);
    const [modalProductos, setModalProductos] = useState(false);
    const [modalDetalle, setModalDetalle] = useState({
        visible: false,
        movimiento: null,
        documento: null,
        detallesDocumento: [],
        movimientosDocumento: [],
        resumenDocumento: null,
    });

    const [filtros, setFiltros] = useState({
        q: "",
        idBodega: "",
        idUbicacion: "",
        idTipoProducto: "",
        idTipoDocumento: "",
        idOperador: "",
        tipoMovimiento: "",
        naturaleza: "",
        estadoProceso: "",
        fechaDesde: "",
        fechaHasta: "",
        orden: "DESC",
        limite: 500,
        agruparPor: "TIPO_MOVIMIENTO",
    });

    const respuestaExitosa = (respuesta) =>
        respuesta?.rpta === "si" ||
        respuesta?.rpta === true;

    const formatearNumero = (valor) =>
        new Intl.NumberFormat("es-CO", {
            maximumFractionDigits: 3,
        }).format(Number(valor ?? 0));

    const formatearFecha = (fecha, conHora = false) => {
        if (!fecha) {
            return "Sin fecha";
        }

        const texto = String(fecha);
        const fechaParte = texto.substring(0, 10);
        const horaParte = texto.substring(11, 16);
        const partes = fechaParte.split("-");

        if (partes.length !== 3) {
            return texto;
        }

        const fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;

        if (conHora && horaParte) {
            return `${fechaFormateada} ${horaParte}`;
        }

        return fechaFormateada;
    };

    const escaparCsv = (valor) => {
        if (valor === null || valor === undefined) {
            return "";
        }

        const texto = String(valor)
            .replace(/\r?\n|\r/g, " ")
            .replace(/"/g, '""');

        return `"${texto}"`;
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

    const limpiarFiltros = () => {
        setFiltros({
            q: "",
            idBodega: "",
            idUbicacion: "",
            idTipoProducto: "",
            idTipoDocumento: "",
            idOperador: "",
            tipoMovimiento: "",
            naturaleza: "",
            estadoProceso: "",
            fechaDesde: "",
            fechaHasta: "",
            orden: "DESC",
            limite: 500,
            agruparPor: "TIPO_MOVIMIENTO",
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

    const construirParams = useCallback(() => {
        const params = new URLSearchParams();

        params.set("t", Date.now());
        params.set("limite", filtros.limite || 500);

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

        if (filtros.idTipoDocumento) {
            params.set(
                "idTipoDocumento",
                filtros.idTipoDocumento
            );
        }

        if (filtros.idOperador) {
            params.set("idOperador", filtros.idOperador);
        }

        if (filtros.tipoMovimiento) {
            params.set(
                "tipoMovimiento",
                filtros.tipoMovimiento
            );
        }

        if (filtros.naturaleza) {
            params.set("naturaleza", filtros.naturaleza);
        }

        if (filtros.estadoProceso) {
            params.set(
                "estadoProceso",
                filtros.estadoProceso
            );
        }

        if (filtros.fechaDesde) {
            params.set("fechaDesde", filtros.fechaDesde);
        }

        if (filtros.fechaHasta) {
            params.set("fechaHasta", filtros.fechaHasta);
        }

        if (filtros.orden) {
            params.set("orden", filtros.orden);
        }

        return params;
    }, [filtros]);

    const cargarFormData = useCallback(async () => {
        setCargandoForm(true);

        try {
            const params = new URLSearchParams();

            params.set("t", Date.now());

            const respuesta = await fetch(
                `${API_BASE_MOVIMIENTOS}InventarioMovimientosFormData.php?${params.toString()}`,
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
                        "No fue posible cargar los filtros."
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

            setTiposDocumento(
                Array.isArray(data?.tiposDocumento)
                    ? data.tiposDocumento
                    : []
            );

            setTiposMovimiento(
                Array.isArray(data?.tiposMovimiento)
                    ? data.tiposMovimiento
                    : []
            );

            setNaturalezas(
                Array.isArray(data?.naturalezas)
                    ? data.naturalezas
                    : []
            );

            setEstadosProceso(
                Array.isArray(data?.estadosProceso)
                    ? data.estadosProceso
                    : []
            );

            setOperadores(
                Array.isArray(data?.operadores)
                    ? data.operadores
                    : []
            );
        } catch (error) {
            console.error(
                "Error cargando form data movimientos:",
                error
            );

            toast.error(
                error?.message ||
                    "No fue posible cargar los filtros."
            );
        } finally {
            setCargandoForm(false);
        }
    }, []);

    const cargarMovimientos = useCallback(async () => {
        setCargando(true);

        try {
            const params = construirParams();

            const respuesta = await fetch(
                `${API_BASE_MOVIMIENTOS}InventarioMovimientosListar.php?${params.toString()}`,
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
                        "No fue posible consultar movimientos."
                );
            }

            setMovimientos(
                Array.isArray(resultado?.data)
                    ? resultado.data
                    : []
            );

            setResumen(resultado?.resumen || null);
        } catch (error) {
            console.error(
                "Error cargando movimientos:",
                error
            );

            setMovimientos([]);
            setResumen(null);

            toast.error(
                error?.message ||
                    "No fue posible consultar movimientos."
            );
        } finally {
            setCargando(false);
        }
    }, [construirParams]);

    const cargarResumen = useCallback(async () => {
        setCargando(true);

        try {
            const params = construirParams();

            params.set("agruparPor", filtros.agruparPor);

            const respuesta = await fetch(
                `${API_BASE_MOVIMIENTOS}InventarioMovimientosResumen.php?${params.toString()}`,
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
                        "No fue posible consultar el resumen."
                );
            }

            setResumenGrupos(
                Array.isArray(resultado?.data)
                    ? resultado.data
                    : []
            );

            setResumen(resultado?.resumen || null);
        } catch (error) {
            console.error(
                "Error cargando resumen movimientos:",
                error
            );

            setResumenGrupos([]);
            setResumen(null);

            toast.error(
                error?.message ||
                    "No fue posible consultar el resumen."
            );
        } finally {
            setCargando(false);
        }
    }, [construirParams, filtros.agruparPor]);

    const cargarKardex = useCallback(async () => {
        if (!productoKardex?.idProducto) {
            setKardex(null);
            setCargando(false);
            return;
        }

        setCargando(true);

        try {
            const params = construirParams();

            params.set("idProducto", productoKardex.idProducto);

            const respuesta = await fetch(
                `${API_BASE_MOVIMIENTOS}InventarioKardexProducto.php?${params.toString()}`,
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
                        "No fue posible consultar el kardex."
                );
            }

            setKardex(resultado?.data || null);
            setResumen(resultado?.data?.resumen || null);
        } catch (error) {
            console.error("Error cargando kardex:", error);

            setKardex(null);
            setResumen(null);

            toast.error(
                error?.message ||
                    "No fue posible consultar el kardex."
            );
        } finally {
            setCargando(false);
        }
    }, [construirParams, productoKardex]);

    const cargarDatos = useCallback(() => {
        if (vista === "MOVIMIENTOS") {
            cargarMovimientos();
            return;
        }

        if (vista === "RESUMEN") {
            cargarResumen();
            return;
        }

        if (vista === "KARDEX") {
            cargarKardex();
        }
    }, [
        vista,
        cargarMovimientos,
        cargarResumen,
        cargarKardex,
    ]);

    useEffect(() => {
        cargarFormData();
    }, [cargarFormData]);

    useEffect(() => {
        cargarDatos();
    }, [cargarDatos]);

    useEffect(() => {
        if (
            !modalFiltros &&
            !modalProductos &&
            !modalDetalle.visible
        ) {
            return undefined;
        }

        const overflowAnterior =
            document.body.style.overflow;

        const cerrarConEscape = (event) => {
            if (event.key === "Escape") {
                setModalFiltros(false);
                setModalProductos(false);
                cerrarModalDetalle();
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
    }, [
        modalFiltros,
        modalProductos,
        modalDetalle.visible,
    ]);

    useEffect(() => {
        const contenedor = scrollContainerRef.current;

        if (!contenedor) {
            return undefined;
        }

        let ticking = false;

        const manejarScroll = () => {
            const posicionActual = contenedor.scrollTop || 0;

            if (!ticking) {
                window.requestAnimationFrame(() => {
                    /*
                        Evitamos el "temblor" usando histéresis:
                        - Se oculta solo cuando ya bajó suficiente.
                        - Se muestra solo cuando volvió prácticamente arriba.
                        No dependemos de la dirección del scroll.
                    */
                    setMostrarEncabezado((visibleActual) => {
                        if (posicionActual > 120) {
                            return false;
                        }

                        if (posicionActual < 24) {
                            return true;
                        }

                        return visibleActual;
                    });

                    ticking = false;
                });

                ticking = true;
            }
        };

        contenedor.addEventListener("scroll", manejarScroll, {
            passive: true,
        });

        return () => {
            contenedor.removeEventListener("scroll", manejarScroll);
        };
    }, []);

    const buscarProductosKardex = async () => {
        const q = productoBusqueda.trim();

        if (!q) {
            toast.info(
                "Digite el producto que desea consultar."
            );
            return;
        }

        setBuscandoProducto(true);

        try {
            const params = new URLSearchParams();

            params.set("q", q);
            params.set("limite", 20);
            params.set("t", Date.now());

            const respuesta = await fetch(
                `${API_BASE_MOVIMIENTOS}InventarioMovimientosProductosBuscar.php?${params.toString()}`,
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
                        "No fue posible buscar productos."
                );
            }

            const productos = Array.isArray(resultado?.data)
                ? resultado.data
                : [];

            if (productos.length === 0) {
                toast.warning(
                    "No se encontraron productos con movimientos."
                );
                return;
            }

            if (productos.length === 1) {
                setProductoKardex(productos[0]);
                setProductosEncontrados([]);
                setModalProductos(false);
                setVista("KARDEX");
                return;
            }

            setProductosEncontrados(productos);
            setModalProductos(true);
        } catch (error) {
            console.error(
                "Error buscando producto kardex:",
                error
            );

            toast.error(
                error?.message ||
                    "No fue posible buscar productos."
            );
        } finally {
            setBuscandoProducto(false);
        }
    };

    const seleccionarProductoKardex = (producto) => {
        setProductoKardex(producto);
        setProductoBusqueda(
            producto?.descripcion ||
                producto?.producto ||
                ""
        );
        setProductosEncontrados([]);
        setModalProductos(false);
        setVista("KARDEX");
    };

    const verKardexDesdeMovimiento = (movimiento) => {
        const idProducto = Number(movimiento?.idProducto || 0);

        if (!idProducto) {
            toast.warning("No se pudo identificar el producto para consultar el kardex.");
            return;
        }

        const producto = {
            id: idProducto,
            idProducto,
            codigo: movimiento?.codigoProducto || "",
            codigoProducto: movimiento?.codigoProducto || "",
            descripcion: movimiento?.producto || movimiento?.descripcion || "",
            producto: movimiento?.producto || movimiento?.descripcion || "",
            unidad: movimiento?.unidad || "UND",
            tipoProducto: movimiento?.tipoProducto || "",
            manejaLote: movimiento?.manejaLote || 0,
            manejaVencimiento: movimiento?.manejaVencimiento || 0,
        };

        setProductoKardex(producto);
        setProductoBusqueda(producto.descripcion || producto.producto || "");
        setVista("KARDEX");
    };

    const abrirDetalleMovimiento = async (movimiento) => {
        const idMovimiento = Number(
            movimiento?.idMovimiento ??
                movimiento?.id ??
                0
        );

        const idDocumento = Number(
            movimiento?.idDocumento ?? 0
        );

        if (!idMovimiento && !idDocumento) {
            toast.warning(
                "No se pudo identificar el movimiento."
            );
            return;
        }

        setCargandoDetalle(true);
        setModalDetalle({
            visible: true,
            movimiento,
            documento: null,
            detallesDocumento: [],
            movimientosDocumento: [],
            resumenDocumento: null,
        });

        try {
            const params = new URLSearchParams();

            if (idMovimiento) {
                params.set("idMovimiento", idMovimiento);
            } else {
                params.set("idDocumento", idDocumento);
            }

            params.set("t", Date.now());

            const respuesta = await fetch(
                `${API_BASE_MOVIMIENTOS}InventarioMovimientosDetalle.php?${params.toString()}`,
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
                movimiento:
                    data?.movimiento ||
                    movimiento ||
                    null,
                documento: data?.documento || null,
                detallesDocumento: Array.isArray(
                    data?.detallesDocumento
                )
                    ? data.detallesDocumento
                    : [],
                movimientosDocumento: Array.isArray(
                    data?.movimientosDocumento
                )
                    ? data.movimientosDocumento
                    : [],
                resumenDocumento:
                    data?.resumenDocumento || null,
            });
        } catch (error) {
            console.error(
                "Error consultando detalle movimiento:",
                error
            );

            toast.error(
                error?.message ||
                    "No fue posible consultar el detalle."
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
            movimiento: null,
            documento: null,
            detallesDocumento: [],
            movimientosDocumento: [],
            resumenDocumento: null,
        });
    };

    const claseSentido = (sentido) => {
        const valor = String(sentido || "")
            .trim()
            .toUpperCase();

        if (valor === "ENTRADA") {
            return "bg-emerald-50 text-emerald-700 border-emerald-200";
        }

        if (valor === "SALIDA") {
            return "bg-rose-50 text-rose-700 border-rose-200";
        }

        if (valor === "TRASLADO") {
            return "bg-indigo-50 text-indigo-700 border-indigo-200";
        }

        if (valor === "RESERVA") {
            return "bg-amber-50 text-amber-700 border-amber-200";
        }

        if (valor === "LIBERACION_RESERVA") {
            return "bg-blue-50 text-blue-700 border-blue-200";
        }

        if (valor === "BLOQUEO") {
            return "bg-slate-100 text-slate-700 border-slate-300";
        }

        return "bg-slate-50 text-slate-600 border-slate-200";
    };

    const iconoSentido = (sentido) => {
        const valor = String(sentido || "")
            .trim()
            .toUpperCase();

        if (valor === "ENTRADA") {
            return <FaArrowUp />;
        }

        if (valor === "SALIDA") {
            return <FaArrowDown />;
        }

        if (valor === "TRASLADO") {
            return <FaExchangeAlt />;
        }

        if (valor === "RESERVA") {
            return <FaClipboardList />;
        }

        if (valor === "LIBERACION_RESERVA") {
            return <FaUndo />;
        }

        return <FaChartLine />;
    };

    const resumenActual = useMemo(() => {
        const base = resumen || {};

        return {
            totalMovimientos:
                base.totalMovimientos ??
                movimientos.length ??
                0,
            totalEntradas: base.totalEntradas ?? 0,
            totalSalidas: base.totalSalidas ?? 0,
            totalReservas: base.totalReservas ?? 0,
            totalProductos: base.totalProductos ?? 0,
            cantidadEntradas:
                base.cantidadEntradas ??
                base.cantidadEntrada ??
                0,
            cantidadSalidas:
                base.cantidadSalidas ??
                base.cantidadSalida ??
                0,
            cantidadReservada:
                base.cantidadReservada ??
                base.cantidadReserva ??
                0,
            saldoFinal: base.saldoFinal ?? null,
            saldoDisponibleActual:
                base.saldoDisponibleActual ?? null,
        };
    }, [resumen, movimientos.length]);

    const columnasExportacion = () => {
        if (vista === "RESUMEN") {
            return [
                ["codigo", "Código"],
                ["nombre", "Nombre"],
                ["totalMovimientos", "Movimientos"],
                ["cantidadEntrada", "Cantidad entrada"],
                ["cantidadSalida", "Cantidad salida"],
                ["cantidadReserva", "Cantidad reserva"],
                [
                    "cantidadLiberacionReserva",
                    "Liberación reserva",
                ],
                ["cantidadBloqueo", "Cantidad bloqueo"],
                ["cantidadTotal", "Cantidad total"],
            ];
        }

        return [
            ["fechaMovimiento", "Fecha movimiento"],
            ["consecutivo", "Documento"],
            ["tipoDocumento", "Tipo documento"],
            ["naturaleza", "Naturaleza"],
            ["tipoMovimiento", "Tipo movimiento"],
            ["sentidoMovimiento", "Sentido"],
            ["codigoProducto", "Código producto"],
            ["producto", "Producto"],
            ["bodega", "Bodega"],
            ["ubicacion", "Ubicación"],
            ["lote", "Lote"],
            ["cantidad", "Cantidad"],
            ["saldoAnterior", "Saldo anterior"],
            ["saldoNuevo", "Saldo nuevo"],
            ["operador", "Operador"],
            ["usuario", "Usuario"],
            ["observacion", "Observación"],
        ];
    };

    const dataExportacion = () => {
        if (vista === "RESUMEN") {
            return resumenGrupos;
        }

        if (vista === "KARDEX") {
            return kardex?.movimientos || [];
        }

        return movimientos;
    };

    const exportarCsv = () => {
        const data = dataExportacion();

        if (!data || data.length === 0) {
            toast.info("No hay datos para exportar.");
            return;
        }

        const columnas = columnasExportacion();

        const encabezado = columnas
            .map(([, titulo]) => escaparCsv(titulo))
            .join(";");

        const filas = data.map((item) =>
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
        link.download = `movimientos_${vista.toLowerCase()}_${fecha}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success("Archivo exportado correctamente.");
    };

    const tituloVista = () => {
        if (vista === "KARDEX") {
            return "Kardex por producto";
        }

        if (vista === "RESUMEN") {
            return "Resumen de movimientos";
        }

        return "Movimientos de inventario";
    };

    return (
        <>
            <div className="w-full h-screen flex flex-col p-2 md:p-4 gap-4 bg-slate-100">
                <article className="flex-1 bg-white shadow-lg rounded-2xl flex flex-col overflow-hidden border border-slate-200">
                    <header
                        className={`border-b border-slate-200 bg-white transition-[max-height,opacity] duration-300 ease-in-out overflow-hidden ${
                            mostrarEncabezado
                                ? "max-h-40 opacity-100"
                                : "max-h-0 opacity-0 border-b-0"
                        }`}
                    >
                        <div className="px-4 py-3 md:px-5">
                            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
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
                                        <FaChartLine className="text-lg text-indigo-700" />
                                    </div>

                                    <div>
                                        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-700">
                                            Control de inventarios
                                        </p>

                                        <h1 className="mt-0.5 text-xl md:text-2xl font-bold text-slate-900">
                                            Movimientos / Kardex
                                        </h1>

                                        <p className="mt-0.5 text-xs md:text-sm text-slate-500 max-w-2xl">
                                            Consulta movimientos, documentos y kardex por producto.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </header>

                    <div
                        ref={scrollContainerRef}
                        className="flex-1 overflow-y-auto"
                    >
                        <div className="p-3 md:p-5 space-y-4">
                            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <p className="text-sm font-medium text-slate-500">
                                        Movimientos
                                    </p>
                                    <p className="mt-2 text-2xl font-bold text-slate-900">
                                        {
                                            resumenActual.totalMovimientos
                                        }
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
                                    <p className="text-sm font-medium text-emerald-700">
                                        Entradas
                                    </p>
                                    <p className="mt-2 text-2xl font-bold text-emerald-800">
                                        {formatearNumero(
                                            resumenActual.cantidadEntradas
                                        )}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm">
                                    <p className="text-sm font-medium text-rose-700">
                                        Salidas
                                    </p>
                                    <p className="mt-2 text-2xl font-bold text-rose-800">
                                        {formatearNumero(
                                            resumenActual.cantidadSalidas
                                        )}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                                    <p className="text-sm font-medium text-amber-700">
                                        Reservas
                                    </p>
                                    <p className="mt-2 text-2xl font-bold text-amber-800">
                                        {formatearNumero(
                                            resumenActual.cantidadReservada
                                        )}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 shadow-sm">
                                    <p className="text-sm font-medium text-indigo-700">
                                        Productos
                                    </p>
                                    <p className="mt-2 text-2xl font-bold text-indigo-800">
                                        {
                                            resumenActual.totalProductos
                                        }
                                    </p>
                                </div>
                            </section>

                            <section className="sticky top-0 z-30 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur p-3 md:p-4 shadow-sm">
                                <div className="flex flex-col xl:flex-row xl:items-center gap-3">
                                    <div className="relative flex-1">
                                        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                                        <input
                                            type="text"
                                            value={
                                                vista ===
                                                "KARDEX"
                                                    ? productoBusqueda
                                                    : filtros.q
                                            }
                                            onChange={(
                                                event
                                            ) => {
                                                if (
                                                    vista ===
                                                    "KARDEX"
                                                ) {
                                                    setProductoBusqueda(
                                                        event.target
                                                            .value
                                                    );
                                                } else {
                                                    cambiarFiltro(
                                                        "q",
                                                        event.target
                                                            .value
                                                    );
                                                }
                                            }}
                                            onKeyDown={(
                                                event
                                            ) => {
                                                if (
                                                    event.key ===
                                                    "Enter"
                                                ) {
                                                    if (
                                                        vista ===
                                                        "KARDEX"
                                                    ) {
                                                        buscarProductosKardex();
                                                    } else {
                                                        cargarDatos();
                                                    }
                                                }
                                            }}
                                            placeholder={
                                                vista ===
                                                "KARDEX"
                                                    ? "Buscar producto para consultar kardex"
                                                    : "Buscar producto, documento, lote, bodega, operador..."
                                            }
                                            className="w-full h-11 pl-11 pr-4 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                        />
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={
                                                vista ===
                                                "KARDEX"
                                                    ? buscarProductosKardex
                                                    : cargarDatos
                                            }
                                            disabled={
                                                cargando ||
                                                buscandoProducto
                                            }
                                            className="h-11 px-4 rounded-xl bg-blue-800 text-white font-semibold flex items-center justify-center gap-2 hover:bg-blue-900 disabled:opacity-60 transition"
                                        >
                                            {buscandoProducto ? (
                                                <FaSyncAlt className="animate-spin" />
                                            ) : (
                                                <FaSearch />
                                            )}
                                            Buscar
                                        </button>

                                        <button
                                            type="button"
                                            onClick={exportarCsv}
                                            disabled={cargando}
                                            className="h-11 px-4 rounded-xl border border-emerald-400 bg-emerald-50 text-emerald-700 font-semibold flex items-center justify-center gap-2 hover:bg-emerald-100 disabled:opacity-60 transition"
                                        >
                                            <FaFileExcel />
                                            Exportar Excel
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setModalFiltros(
                                                    true
                                                )
                                            }
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
                                            onClick={() =>
                                                setVista(
                                                    "MOVIMIENTOS"
                                                )
                                            }
                                            className={`h-9 px-3 rounded-xl border text-sm font-semibold flex items-center gap-2 transition ${
                                                vista ===
                                                "MOVIMIENTOS"
                                                    ? "bg-blue-800 border-blue-800 text-white"
                                                    : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                                            }`}
                                        >
                                            <FaClipboardList />
                                            Movimientos
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setVista("KARDEX")
                                            }
                                            className={`h-9 px-3 rounded-xl border text-sm font-semibold flex items-center gap-2 transition ${
                                                vista ===
                                                "KARDEX"
                                                    ? "bg-blue-800 border-blue-800 text-white"
                                                    : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                                            }`}
                                        >
                                            <FaChartLine />
                                            Kardex
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setVista(
                                                    "RESUMEN"
                                                )
                                            }
                                            className={`h-9 px-3 rounded-xl border text-sm font-semibold flex items-center gap-2 transition ${
                                                vista ===
                                                "RESUMEN"
                                                    ? "bg-blue-800 border-blue-800 text-white"
                                                    : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
                                            }`}
                                        >
                                            <FaLayerGroup />
                                            Resumen
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                        {filtros.fechaDesde && (
                                            <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                                                Desde{" "}
                                                {formatearFecha(
                                                    filtros.fechaDesde
                                                )}
                                            </span>
                                        )}

                                        {filtros.fechaHasta && (
                                            <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                                                Hasta{" "}
                                                {formatearFecha(
                                                    filtros.fechaHasta
                                                )}
                                            </span>
                                        )}

                                        {filtros.idBodega && (
                                            <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                                                Bodega
                                            </span>
                                        )}

                                        {filtros.tipoMovimiento && (
                                            <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200">
                                                {
                                                    filtros.tipoMovimiento
                                                }
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
                                            {vista ===
                                            "MOVIMIENTOS"
                                                ? `${movimientos.length} movimiento${
                                                      movimientos.length ===
                                                      1
                                                          ? ""
                                                          : "s"
                                                  } encontrado${
                                                      movimientos.length ===
                                                      1
                                                          ? ""
                                                          : "s"
                                                  }`
                                                : vista ===
                                                  "RESUMEN"
                                                ? `${resumenGrupos.length} grupo${
                                                      resumenGrupos.length ===
                                                      1
                                                          ? ""
                                                          : "s"
                                                  } encontrado${
                                                      resumenGrupos.length ===
                                                      1
                                                          ? ""
                                                          : "s"
                                                  }`
                                                : productoKardex
                                                ? `Producto: ${
                                                      productoKardex.descripcion ||
                                                      productoKardex.producto
                                                  }`
                                                : "Seleccione un producto para consultar el kardex"}
                                        </p>
                                    </div>
                                </div>

                                {cargando || cargandoForm ? (
                                    <div className="min-h-[380px] flex flex-col items-center justify-center gap-4">
                                        <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />
                                        <p className="text-sm font-medium text-slate-500">
                                            Cargando movimientos...
                                        </p>
                                    </div>
                                ) : vista === "RESUMEN" ? (
                                    <ResumenTable
                                        data={resumenGrupos}
                                        formatearNumero={
                                            formatearNumero
                                        }
                                        formatearFecha={
                                            formatearFecha
                                        }
                                    />
                                ) : vista === "KARDEX" ? (
                                    <KardexView
                                        kardex={kardex}
                                        productoKardex={
                                            productoKardex
                                        }
                                        formatearNumero={
                                            formatearNumero
                                        }
                                        formatearFecha={
                                            formatearFecha
                                        }
                                        claseSentido={
                                            claseSentido
                                        }
                                        iconoSentido={
                                            iconoSentido
                                        }
                                        abrirDetalleMovimiento={
                                            abrirDetalleMovimiento
                                        }
                                    />
                                ) : (
                                    <MovimientosTable
                                        movimientos={movimientos}
                                        formatearNumero={
                                            formatearNumero
                                        }
                                        formatearFecha={
                                            formatearFecha
                                        }
                                        claseSentido={
                                            claseSentido
                                        }
                                        iconoSentido={
                                            iconoSentido
                                        }
                                        abrirDetalleMovimiento={
                                            abrirDetalleMovimiento
                                        }
                                        verKardexProducto={
                                            verKardexDesdeMovimiento
                                        }
                                    />
                                )}
                            </section>
                        </div>
                    </div>
                </article>
            </div>

            {modalFiltros && (
                <ModalFiltros
                    filtros={filtros}
                    cambiarFiltro={cambiarFiltro}
                    limpiarFiltros={limpiarFiltros}
                    setModalFiltros={setModalFiltros}
                    cargarDatos={cargarDatos}
                    bodegas={bodegas}
                    ubicacionesFiltradas={
                        ubicacionesFiltradas
                    }
                    tiposProducto={tiposProducto}
                    tiposDocumento={tiposDocumento}
                    tiposMovimiento={tiposMovimiento}
                    naturalezas={naturalezas}
                    estadosProceso={estadosProceso}
                    operadores={operadores}
                    vista={vista}
                />
            )}

            {modalProductos && (
                <ModalProductos
                    productos={productosEncontrados}
                    seleccionarProductoKardex={
                        seleccionarProductoKardex
                    }
                    setModalProductos={setModalProductos}
                    formatearFecha={formatearFecha}
                />
            )}

            {modalDetalle.visible && (
                <ModalDetalle
                    modalDetalle={modalDetalle}
                    cargandoDetalle={cargandoDetalle}
                    cerrarModalDetalle={cerrarModalDetalle}
                    formatearNumero={formatearNumero}
                    formatearFecha={formatearFecha}
                    claseSentido={claseSentido}
                    iconoSentido={iconoSentido}
                />
            )}
        </>
    );
};

const MovimientosTable = ({
    movimientos,
    formatearNumero,
    formatearFecha,
    claseSentido,
    iconoSentido,
    abrirDetalleMovimiento,
    verKardexProducto = null,
}) => {
    if (movimientos.length === 0) {
        return <EmptyState texto="No hay movimientos para mostrar." />;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[1320px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                            Fecha
                        </th>
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                            Documento
                        </th>
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                            Producto
                        </th>
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                            Bodega / Lote
                        </th>
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                            Movimiento
                        </th>
                        <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                            Cantidad
                        </th>
                        <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                            Saldo anterior
                        </th>
                        <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                            Saldo nuevo
                        </th>
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                            Operador
                        </th>
                        <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                            Acción
                        </th>
                    </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                    {movimientos.map((movimiento) => (
                        <tr
                            key={movimiento.idMovimiento}
                            className="hover:bg-slate-50 transition"
                        >
                            <td className="px-5 py-4 text-sm text-slate-600">
                                {formatearFecha(
                                    movimiento.fechaMovimiento,
                                    true
                                )}
                            </td>

                            <td className="px-5 py-4">
                                <p className="text-sm font-bold text-slate-900">
                                    {movimiento.consecutivo ||
                                        "Sin documento"}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {movimiento.tipoDocumento ||
                                        movimiento.codigoTipoDocumento ||
                                        "Movimiento"}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                    {movimiento.estadoProceso ||
                                        "Sin estado"}
                                </p>
                            </td>

                            <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                                        <FaBoxes />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-900 max-w-[250px] truncate">
                                            {movimiento.producto}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {movimiento.codigoProducto ||
                                                `ID ${movimiento.idProducto}`}
                                        </p>
                                    </div>
                                </div>
                            </td>

                            <td className="px-5 py-4">
                                <p className="text-sm font-bold text-slate-800">
                                    {movimiento.bodega}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {movimiento.ubicacion ||
                                        "Sin ubicación"}
                                </p>
                                <p className="text-[11px] text-slate-400">
                                    Lote:{" "}
                                    {movimiento.lote || "Sin lote"}
                                </p>
                            </td>

                            <td className="px-5 py-4">
                                <span
                                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${claseSentido(
                                        movimiento.sentidoMovimiento
                                    )}`}
                                >
                                    {iconoSentido(
                                        movimiento.sentidoMovimiento
                                    )}
                                    {movimiento.tipoMovimiento}
                                </span>
                            </td>

                            <td className="px-5 py-4 text-center text-sm font-bold text-slate-800">
                                {formatearNumero(
                                    movimiento.cantidad
                                )}
                            </td>

                            <td className="px-5 py-4 text-center text-sm text-slate-600">
                                {formatearNumero(
                                    movimiento.saldoAnterior
                                )}
                            </td>

                            <td className="px-5 py-4 text-center text-sm font-bold text-slate-900">
                                {formatearNumero(
                                    movimiento.saldoNuevo
                                )}
                            </td>

                            <td className="px-5 py-4">
                                <p className="text-sm font-semibold text-slate-800">
                                    {movimiento.operador ||
                                        movimiento.usuario ||
                                        "Sin usuario"}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {movimiento.codigoOperador ||
                                        ""}
                                </p>
                            </td>

                            <td className="px-5 py-4">
                                <div className="flex justify-end gap-2">
                                    {verKardexProducto && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                verKardexProducto(
                                                    movimiento
                                                )
                                            }
                                            className="h-10 px-3 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-800 font-semibold flex items-center justify-center gap-2 hover:bg-indigo-100 transition"
                                            title="Ver kardex del producto"
                                        >
                                            <FaChartLine />
                                            Kardex
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() =>
                                            abrirDetalleMovimiento(
                                                movimiento
                                            )
                                        }
                                        className="h-10 px-3 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 font-semibold flex items-center justify-center gap-2 hover:bg-blue-100 transition"
                                    >
                                        <FaEye />
                                        Ver
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const KardexView = ({
    kardex,
    productoKardex,
    formatearNumero,
    formatearFecha,
    claseSentido,
    iconoSentido,
    abrirDetalleMovimiento,
}) => {
    if (!productoKardex) {
        return (
            <EmptyState texto="Busca un producto en la barra superior o presiona el botón Kardex desde cualquier movimiento." />
        );
    }

    if (!kardex) {
        return (
            <EmptyState texto="No hay información de kardex para mostrar." />
        );
    }

    const movimientos = Array.isArray(kardex.movimientos)
        ? kardex.movimientos
        : [];

    const saldos = Array.isArray(kardex.saldosActuales)
        ? kardex.saldosActuales
        : [];

    return (
        <div>
            <div className="p-5 border-b border-slate-200 bg-slate-50">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Producto
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-900">
                            {kardex?.producto?.producto ||
                                productoKardex.descripcion ||
                                productoKardex.producto}
                        </p>
                        <p className="text-xs text-slate-500">
                            {kardex?.producto?.codigoProducto ||
                                productoKardex.codigoProducto ||
                                productoKardex.codigo}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">
                            Disponible actual
                        </p>
                        <p className="mt-1 text-2xl font-bold text-indigo-900">
                            {formatearNumero(
                                kardex?.resumen
                                    ?.saldoDisponibleActual
                            )}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
                            Reservado actual
                        </p>
                        <p className="mt-1 text-2xl font-bold text-amber-900">
                            {formatearNumero(
                                kardex?.resumen
                                    ?.saldoReservadoActual
                            )}
                        </p>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Movimientos
                        </p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">
                            {movimientos.length}
                        </p>
                    </div>
                </div>

                {saldos.length > 0 && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {saldos.slice(0, 6).map((saldo) => (
                            <div
                                key={saldo.idExistencia}
                                className="rounded-2xl border border-slate-200 bg-white p-4"
                            >
                                <p className="text-sm font-bold text-slate-900">
                                    {saldo.bodega}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {saldo.ubicacion ||
                                        "Sin ubicación"}{" "}
                                    · Lote:{" "}
                                    {saldo.lote || "Sin lote"}
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold">
                                        Disp:{" "}
                                        {formatearNumero(
                                            saldo.cantidadDisponible
                                        )}
                                    </span>
                                    <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                                        Res:{" "}
                                        {formatearNumero(
                                            saldo.cantidadReservada
                                        )}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <MovimientosTable
                movimientos={movimientos}
                formatearNumero={formatearNumero}
                formatearFecha={formatearFecha}
                claseSentido={claseSentido}
                iconoSentido={iconoSentido}
                abrirDetalleMovimiento={abrirDetalleMovimiento}
            />
        </div>
    );
};

const ResumenTable = ({
    data,
    formatearNumero,
    formatearFecha,
}) => {
    if (data.length === 0) {
        return <EmptyState texto="No hay resumen para mostrar." />;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                            Grupo
                        </th>
                        <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                            Movimientos
                        </th>
                        <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                            Entradas
                        </th>
                        <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                            Salidas
                        </th>
                        <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                            Reservas
                        </th>
                        <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                            Liberaciones
                        </th>
                        <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                            Bloqueos
                        </th>
                        <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                            Total
                        </th>
                    </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                    {data.map((item, index) => (
                        <tr
                            key={`${item.codigo}-${index}`}
                            className="hover:bg-slate-50 transition"
                        >
                            <td className="px-5 py-4">
                                <p className="text-sm font-bold text-slate-900">
                                    {item.nombre}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {item.fecha
                                        ? formatearFecha(item.fecha)
                                        : item.codigo}
                                </p>
                            </td>

                            <td className="px-5 py-4 text-center text-sm font-bold text-slate-800">
                                {item.totalMovimientos}
                            </td>

                            <td className="px-5 py-4 text-center text-sm text-emerald-700 font-semibold">
                                {formatearNumero(
                                    item.cantidadEntrada
                                )}
                            </td>

                            <td className="px-5 py-4 text-center text-sm text-rose-700 font-semibold">
                                {formatearNumero(
                                    item.cantidadSalida
                                )}
                            </td>

                            <td className="px-5 py-4 text-center text-sm text-amber-700 font-semibold">
                                {formatearNumero(
                                    item.cantidadReserva
                                )}
                            </td>

                            <td className="px-5 py-4 text-center text-sm text-blue-700 font-semibold">
                                {formatearNumero(
                                    item.cantidadLiberacionReserva
                                )}
                            </td>

                            <td className="px-5 py-4 text-center text-sm text-slate-700 font-semibold">
                                {formatearNumero(
                                    item.cantidadBloqueo
                                )}
                            </td>

                            <td className="px-5 py-4 text-center text-sm font-bold text-slate-900">
                                {formatearNumero(
                                    item.cantidadTotal
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const EmptyState = ({ texto }) => (
    <div className="min-h-[360px] flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <FaBoxOpen className="text-2xl text-slate-500" />
        </div>

        <h3 className="mt-4 text-lg font-bold text-slate-800">
            Sin información
        </h3>

        <p className="mt-1 text-sm text-slate-500 max-w-md">
            {texto}
        </p>
    </div>
);

const ModalFiltros = ({
    filtros,
    cambiarFiltro,
    limpiarFiltros,
    setModalFiltros,
    cargarDatos,
    bodegas,
    ubicacionesFiltradas,
    tiposProducto,
    tiposDocumento,
    tiposMovimiento,
    naturalezas,
    estadosProceso,
    operadores,
    vista,
}) => (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-3 md:p-6">
        <button
            type="button"
            aria-label="Cerrar filtros"
            onClick={() => setModalFiltros(false)}
            className="absolute inset-0 bg-slate-950/60"
        />

        <section className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
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
                                Filtrar movimientos
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

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Fecha desde
                        </label>
                        <input
                            type="date"
                            value={filtros.fechaDesde}
                            onChange={(event) =>
                                cambiarFiltro(
                                    "fechaDesde",
                                    event.target.value
                                )
                            }
                            className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Fecha hasta
                        </label>
                        <input
                            type="date"
                            value={filtros.fechaHasta}
                            onChange={(event) =>
                                cambiarFiltro(
                                    "fechaHasta",
                                    event.target.value
                                )
                            }
                            className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Orden
                        </label>
                        <select
                            value={filtros.orden}
                            onChange={(event) =>
                                cambiarFiltro(
                                    "orden",
                                    event.target.value
                                )
                            }
                            className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                        >
                            <option value="DESC">Más recientes primero</option>
                            <option value="ASC">Más antiguos primero</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Bodega
                        </label>
                        <select
                            value={filtros.idBodega}
                            onChange={(event) =>
                                cambiarFiltro(
                                    "idBodega",
                                    event.target.value
                                )
                            }
                            className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                        >
                            <option value="">Todas</option>
                            {bodegas.map((bodega) => (
                                <option
                                    key={
                                        bodega.idBodega ||
                                        bodega.id
                                    }
                                    value={
                                        bodega.idBodega ||
                                        bodega.id
                                    }
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
                                cambiarFiltro(
                                    "idUbicacion",
                                    event.target.value
                                )
                            }
                            disabled={!filtros.idBodega}
                            className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 disabled:bg-slate-100 disabled:text-slate-500 transition"
                        >
                            <option value="">Todas</option>
                            {ubicacionesFiltradas.map(
                                (ubicacion) => (
                                    <option
                                        key={
                                            ubicacion.idUbicacion ||
                                            ubicacion.id
                                        }
                                        value={
                                            ubicacion.idUbicacion ||
                                            ubicacion.id
                                        }
                                    >
                                        {ubicacion.nombre}
                                    </option>
                                )
                            )}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Tipo producto
                        </label>
                        <select
                            value={filtros.idTipoProducto}
                            onChange={(event) =>
                                cambiarFiltro(
                                    "idTipoProducto",
                                    event.target.value
                                )
                            }
                            className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                        >
                            <option value="">Todos</option>
                            {tiposProducto.map((tipo) => (
                                <option
                                    key={
                                        tipo.idTipoProducto ||
                                        tipo.id
                                    }
                                    value={
                                        tipo.idTipoProducto ||
                                        tipo.id
                                    }
                                >
                                    {tipo.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Tipo documento
                        </label>
                        <select
                            value={filtros.idTipoDocumento}
                            onChange={(event) =>
                                cambiarFiltro(
                                    "idTipoDocumento",
                                    event.target.value
                                )
                            }
                            className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                        >
                            <option value="">Todos</option>
                            {tiposDocumento.map((tipo) => (
                                <option
                                    key={
                                        tipo.idTipoDocumento ||
                                        tipo.id
                                    }
                                    value={
                                        tipo.idTipoDocumento ||
                                        tipo.id
                                    }
                                >
                                    {tipo.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Tipo movimiento
                        </label>
                        <select
                            value={filtros.tipoMovimiento}
                            onChange={(event) =>
                                cambiarFiltro(
                                    "tipoMovimiento",
                                    event.target.value
                                )
                            }
                            className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                        >
                            <option value="">Todos</option>
                            {tiposMovimiento.map((tipo) => (
                                <option
                                    key={tipo.codigo}
                                    value={tipo.codigo}
                                >
                                    {tipo.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Naturaleza
                        </label>
                        <select
                            value={filtros.naturaleza}
                            onChange={(event) =>
                                cambiarFiltro(
                                    "naturaleza",
                                    event.target.value
                                )
                            }
                            className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                        >
                            <option value="">Todas</option>
                            {naturalezas.map((item) => (
                                <option
                                    key={item.codigo}
                                    value={item.codigo}
                                >
                                    {item.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Estado proceso
                        </label>
                        <select
                            value={filtros.estadoProceso}
                            onChange={(event) =>
                                cambiarFiltro(
                                    "estadoProceso",
                                    event.target.value
                                )
                            }
                            className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                        >
                            <option value="">Todos</option>
                            {estadosProceso.map((item) => (
                                <option
                                    key={item.codigo}
                                    value={item.codigo}
                                >
                                    {item.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Operador
                        </label>
                        <select
                            value={filtros.idOperador}
                            onChange={(event) =>
                                cambiarFiltro(
                                    "idOperador",
                                    event.target.value
                                )
                            }
                            className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                        >
                            <option value="">Todos</option>
                            {operadores.map((operador) => (
                                <option
                                    key={
                                        operador.idOperador ||
                                        operador.id
                                    }
                                    value={
                                        operador.idOperador ||
                                        operador.id
                                    }
                                >
                                    {operador.nombreCompleto ||
                                        operador.nombre}
                                </option>
                            ))}
                        </select>
                    </div>

                    {vista === "RESUMEN" && (
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Agrupar por
                            </label>
                            <select
                                value={filtros.agruparPor}
                                onChange={(event) =>
                                    cambiarFiltro(
                                        "agruparPor",
                                        event.target.value
                                    )
                                }
                                className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                            >
                                <option value="TIPO_MOVIMIENTO">
                                    Tipo movimiento
                                </option>
                                <option value="DIA">Día</option>
                                <option value="BODEGA">
                                    Bodega
                                </option>
                                <option value="PRODUCTO">
                                    Producto
                                </option>
                                <option value="DOCUMENTO">
                                    Documento
                                </option>
                                <option value="NATURALEZA">
                                    Naturaleza
                                </option>
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                            Límite
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="2000"
                            value={filtros.limite}
                            onChange={(event) =>
                                cambiarFiltro(
                                    "limite",
                                    event.target.value
                                )
                            }
                            className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                        />
                    </div>
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
                        cargarDatos();
                    }}
                    className="h-10 px-5 rounded-xl bg-blue-800 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-blue-900 transition"
                >
                    <FaFilter />
                    Aplicar filtros
                </button>
            </footer>
        </section>
    </div>
);

const ModalProductos = ({
    productos,
    seleccionarProductoKardex,
    setModalProductos,
    formatearFecha,
}) => (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6">
        <button
            type="button"
            aria-label="Cerrar productos"
            onClick={() => setModalProductos(false)}
            className="absolute inset-0 bg-slate-950/60"
        />

        <section className="relative w-full max-w-4xl max-h-[88vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <header className="px-5 py-5 border-b border-slate-200 bg-white flex items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                        Selección de producto
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                        Productos con movimientos
                    </h2>
                </div>

                <button
                    type="button"
                    onClick={() => setModalProductos(false)}
                    className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 transition"
                >
                    <FaTimes />
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {productos.map((producto) => (
                        <button
                            type="button"
                            key={producto.idProducto}
                            onClick={() =>
                                seleccionarProductoKardex(
                                    producto
                                )
                            }
                            className="text-left rounded-2xl border border-slate-200 bg-white p-4 hover:border-blue-300 hover:bg-blue-50 transition"
                        >
                            <div className="flex items-start gap-3">
                                <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-800 shrink-0">
                                    <FaBoxes />
                                </div>

                                <div>
                                    <h3 className="font-bold text-slate-900">
                                        {producto.descripcion ||
                                            producto.producto}
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Código:{" "}
                                        {producto.codigoProducto ||
                                            producto.codigo ||
                                            "N/A"}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                        Último movimiento:{" "}
                                        {formatearFecha(
                                            producto.ultimoMovimiento,
                                            true
                                        )}
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <span className="inline-flex px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                                            {producto.totalMovimientos} movimientos
                                        </span>
                                        <span className="inline-flex px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold">
                                            {producto.unidad || "UND"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </section>
    </div>
);

const MovimientosDocumentoModalTable = ({
    movimientos,
    formatearNumero,
    formatearFecha,
    claseSentido,
    iconoSentido,
}) => {
    if (!movimientos || movimientos.length === 0) {
        return <EmptyState texto="No hay movimientos para este documento." />;
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[940px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Fecha
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Producto
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Bodega / Lote
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Movimiento
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Cant.
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Saldo ant.
                        </th>
                        <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Saldo nuevo
                        </th>
                        <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Operador
                        </th>
                    </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                    {movimientos.map((movimiento) => (
                        <tr
                            key={movimiento.idMovimiento}
                            className="hover:bg-slate-50 transition"
                        >
                            <td className="px-4 py-3 align-top text-xs text-slate-600 whitespace-nowrap">
                                {formatearFecha(
                                    movimiento.fechaMovimiento,
                                    true
                                )}
                            </td>

                            <td className="px-4 py-3 align-top">
                                <div className="flex items-start gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                                        <FaBoxes className="text-sm" />
                                    </div>

                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-slate-900 leading-5 max-w-[230px] truncate">
                                            {movimiento.producto}
                                        </p>
                                        <p className="text-[11px] text-slate-500">
                                            {movimiento.codigoProducto ||
                                                `ID ${movimiento.idProducto}`}
                                        </p>
                                    </div>
                                </div>
                            </td>

                            <td className="px-4 py-3 align-top">
                                <p className="text-sm font-bold text-slate-800 max-w-[160px] truncate">
                                    {movimiento.bodega || "Sin bodega"}
                                </p>
                                <p className="text-[11px] text-slate-500 max-w-[160px] truncate">
                                    {movimiento.ubicacion ||
                                        "Sin ubicación"}
                                </p>
                                <p className="text-[11px] text-slate-400 max-w-[160px] truncate">
                                    Lote: {movimiento.lote || "Sin lote"}
                                </p>
                            </td>

                            <td className="px-4 py-3 align-top">
                                <span
                                    className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-[11px] font-bold whitespace-nowrap ${claseSentido(
                                        movimiento.sentidoMovimiento
                                    )}`}
                                >
                                    {iconoSentido(
                                        movimiento.sentidoMovimiento
                                    )}
                                    {movimiento.tipoMovimiento}
                                </span>
                            </td>

                            <td className="px-4 py-3 align-top text-center text-sm font-bold text-slate-900 whitespace-nowrap">
                                {formatearNumero(movimiento.cantidad)}
                            </td>

                            <td className="px-4 py-3 align-top text-center text-sm text-slate-600 whitespace-nowrap">
                                {formatearNumero(
                                    movimiento.saldoAnterior
                                )}
                            </td>

                            <td className="px-4 py-3 align-top text-center text-sm font-bold text-slate-900 whitespace-nowrap">
                                {formatearNumero(movimiento.saldoNuevo)}
                            </td>

                            <td className="px-4 py-3 align-top">
                                <p className="text-sm font-semibold text-slate-800 max-w-[150px] truncate">
                                    {movimiento.operador ||
                                        movimiento.usuario ||
                                        "Sin usuario"}
                                </p>
                                <p className="text-[11px] text-slate-500 max-w-[150px] truncate">
                                    {movimiento.codigoOperador || ""}
                                </p>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const ModalDetalle = ({
    modalDetalle,
    cargandoDetalle,
    cerrarModalDetalle,
    formatearNumero,
    formatearFecha,
    claseSentido,
    iconoSentido,
}) => (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6">
        <button
            type="button"
            aria-label="Cerrar detalle"
            onClick={cerrarModalDetalle}
            className="absolute inset-0 bg-slate-950/60"
        />

        <section className="relative w-full max-w-6xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
            <header className="px-5 py-5 border-b border-slate-200 bg-white">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                            <FaClipboardList />
                        </div>

                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
                                Detalle de movimiento
                            </p>

                            <h2 className="mt-1 text-xl font-bold text-slate-900">
                                {modalDetalle.documento?.consecutivo ||
                                    modalDetalle.movimiento
                                        ?.consecutivo ||
                                    "Movimiento"}
                            </h2>

                            <p className="text-sm text-slate-500">
                                {modalDetalle.documento?.tipoDocumento ||
                                    modalDetalle.movimiento
                                        ?.tipoDocumento ||
                                    "Documento de inventario"}
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
                {cargandoDetalle ? (
                    <div className="min-h-[300px] flex flex-col items-center justify-center gap-4">
                        <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />
                        <p className="text-sm font-medium text-slate-500">
                            Cargando detalle...
                        </p>
                    </div>
                ) : (
                    <>
                        {modalDetalle.documento && (
                            <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        Fecha documento
                                    </p>
                                    <p className="mt-2 text-sm font-bold text-slate-900">
                                        {formatearFecha(
                                            modalDetalle.documento
                                                .fechaDocumento
                                        )}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        Estado
                                    </p>
                                    <p className="mt-2 text-sm font-bold text-slate-900">
                                        {modalDetalle.documento
                                            .estadoProceso ||
                                            "Sin estado"}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        Operador
                                    </p>
                                    <p className="mt-2 text-sm font-bold text-slate-900">
                                        {modalDetalle.documento
                                            .operador ||
                                            "Sin operador"}
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        Origen
                                    </p>
                                    <p className="mt-2 text-sm font-bold text-slate-900">
                                        {modalDetalle.documento
                                            .bodegaOrigen ||
                                            "No aplica"}
                                    </p>
                                </div>
                            </section>
                        )}

                        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
                                <h3 className="font-bold text-slate-900">
                                    Movimientos del documento
                                </h3>
                                <p className="text-sm text-slate-500">
                                    {
                                        modalDetalle.movimientosDocumento
                                            .length
                                    }{" "}
                                    movimiento
                                    {modalDetalle.movimientosDocumento
                                        .length === 1
                                        ? ""
                                        : "s"}
                                </p>
                            </div>

                            <MovimientosDocumentoModalTable
                                movimientos={
                                    modalDetalle
                                        .movimientosDocumento
                                        .length > 0
                                        ? modalDetalle.movimientosDocumento
                                        : modalDetalle.movimiento
                                        ? [modalDetalle.movimiento]
                                        : []
                                }
                                formatearNumero={formatearNumero}
                                formatearFecha={formatearFecha}
                                claseSentido={claseSentido}
                                iconoSentido={iconoSentido}
                            />
                        </section>
                    </>
                )}
            </div>
        </section>
    </div>
);
