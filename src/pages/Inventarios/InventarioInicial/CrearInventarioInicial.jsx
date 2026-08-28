import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaArrowLeft,
    FaBarcode,
    FaBoxes,
    FaCheckCircle,
    FaExclamationTriangle,
    FaPlus,
    FaSave,
    FaSearch,
    FaSyncAlt,
    FaTimes,
    FaTrash,
    FaWarehouse,
} from "react-icons/fa";
import { toast } from "react-toastify";

const API_BASE =
    "https://app.accionporcolombia.com/servicesPae/Inventario/InventarioInicial/";
const API_ENTRADAS =
    "https://app.accionporcolombia.com/servicesPae/Inventario/Entradas/";
const API_PRODUCTOS =
    "https://app.accionporcolombia.com/servicesPae/Inventario/Productos/";
const API_LOTES =
    "https://app.accionporcolombia.com/servicesPae/Inventario/Lotes/";

const respuestaExitosa = (respuesta) =>
    respuesta?.rpta === "si" || respuesta?.rpta === true;

const consumirJson = async (url, opciones = {}) => {
    const respuesta = await fetch(url, {
        cache: "no-store",
        ...opciones,
        headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache",
            ...(opciones.headers || {}),
        },
    });
    const texto = await respuesta.text();
    let resultado;

    try {
        resultado = JSON.parse(texto);
    } catch {
        throw new Error(texto || "El servicio devolvió una respuesta no válida.");
    }

    if (!respuesta.ok || !respuestaExitosa(resultado)) {
        throw new Error(
            resultado?.mensaje ||
            resultado?.error ||
            "No fue posible completar la solicitud."
        );
    }

    return resultado;
};

const obtenerUsuarioSesion = () => {
    const llaves = [
        "us",
        "usuario",
        "user",
        "usuarioLogueado",
        "dataUsuario",
        "sesionUsuario",
        "login",
        "authUser",
    ];

    for (const llave of llaves) {
        const valor = localStorage.getItem(llave);
        if (!valor) continue;

        try {
            const usuario = JSON.parse(valor);
            const id =
                usuario?.idUsuario ??
                usuario?.id_usuario ??
                usuario?.id ??
                usuario?.userId ??
                usuario?.idUser;
            if (id) return { ...usuario, idUsuario: Number(id) };
        } catch {
            const id = Number(valor);
            if (id > 0) return { idUsuario: id };
        }
    }

    return null;
};

const idDe = (objeto, ...campos) => {
    for (const campo of campos) {
        const valor = Number(objeto?.[campo] ?? 0);
        if (valor > 0) return valor;
    }
    return 0;
};

const booleanoDe = (valor, valorPredeterminado = false) => {
    if (valor === undefined || valor === null || valor === "") {
        return valorPredeterminado;
    }

    if (typeof valor === "boolean") return valor;
    if (typeof valor === "number") return valor === 1;

    return ["1", "TRUE", "SI", "SÍ", "ACTIVO"].includes(
        String(valor).trim().toUpperCase()
    );
};

const puedeCrearEnBodega = (bodega, modoEdicion = false) =>
    modoEdicion ||
    booleanoDe(bodega?.puedeCrearInventarioInicial, true);

const motivoBodegaNoDisponible = (bodega) => {
    const estado = String(
        bodega?.estadoInventarioInicial || ""
    ).toUpperCase();

    const motivos = {
        BORRADOR: "tiene un borrador pendiente",
        FINALIZADA: "ya tiene inventario inicial",
        CON_MOVIMIENTOS_PREVIOS: "tiene movimientos previos",
        CON_EXISTENCIAS_PREVIAS: "tiene existencias previas",
    };

    return motivos[estado] || "no disponible";
};

const hoyIso = () => {
    const hoy = new Date();
    const offset = hoy.getTimezoneOffset();
    return new Date(hoy.getTime() - offset * 60000).toISOString().slice(0, 10);
};

export const CrearInventarioInicial = ({ setSidebar, navegar }) => {
    const usuario = useMemo(() => obtenerUsuarioSesion(), []);
    const inputBusquedaRef = useRef(null);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [buscando, setBuscando] = useState(false);
    const [creandoLote, setCreandoLote] = useState(false);
    const [tipoDocumento, setTipoDocumento] = useState(null);
    const [operador, setOperador] = useState(null);
    const [bodegas, setBodegas] = useState([]);
    const [ubicaciones, setUbicaciones] = useState([]);
    const [form, setForm] = useState({
        fechaDocumento: hoyIso(),
        idBodega: "",
        idUbicacion: "",
        observacion: "",
    });
    const [detalles, setDetalles] = useState([]);
    const [busqueda, setBusqueda] = useState("");
    const [modalProductos, setModalProductos] = useState({
        visible: false,
        resultados: [],
    });
    const [modalCantidad, setModalCantidad] = useState({
        visible: false,
        producto: null,
        cantidad: "1",
    });
    const [modalLote, setModalLote] = useState({
        visible: false,
        detalleId: null,
        lotes: [],
        cargando: false,
    });
    const [formLote, setFormLote] = useState({
        lote: "",
        fechaFabricacion: "",
        fechaVencimiento: "",
        observacion: "",
    });

    const datoEdicion = useMemo(() => {
        try {
            return JSON.parse(localStorage.getItem("inventarioInicialEditar"));
        } catch {
            return null;
        }
    }, []);
    const idDocumento = Number(datoEdicion?.idDocumento || 0);
    const modoEdicion = idDocumento > 0;

    const ubicacionesBodega = useMemo(
        () =>
            ubicaciones.filter(
                (item) =>
                    idDe(item, "idBodega") === Number(form.idBodega)
            ),
        [form.idBodega, ubicaciones]
    );

    const bodegasDisponibles = useMemo(
        () =>
            bodegas.filter((item) =>
                puedeCrearEnBodega(item, modoEdicion)
            ),
        [bodegas, modoEdicion]
    );

    const bodegaSeleccionada = useMemo(
        () =>
            bodegas.find(
                (item) =>
                    idDe(item, "idBodega", "id") === Number(form.idBodega)
            ) || null,
        [bodegas, form.idBodega]
    );

    const totalCantidad = useMemo(
        () =>
            detalles.reduce(
                (total, detalle) => total + Number(detalle.cantidad || 0),
                0
            ),
        [detalles]
    );

    const cargarDetalle = useCallback(async () => {
        if (!idDocumento) return;

        const params = new URLSearchParams({
            idDocumento: String(idDocumento),
            t: String(Date.now()),
        });
        const resultado = await consumirJson(
            `${API_BASE}InventarioInicialDetalle.php?${params}`
        );
        const documento = resultado?.data?.documento || {};

        if (
            documento.editable === false ||
            String(documento.estadoProceso).toUpperCase() !== "BORRADOR"
        ) {
            localStorage.removeItem("inventarioInicialEditar");
            toast.warning("Esta carga ya no se puede editar.");
            navegar("InventarioInicial");
            return;
        }

        const lista = Array.isArray(resultado?.data?.detalles)
            ? resultado.data.detalles
            : [];
        const primerDetalle = lista[0] || {};

        setForm({
            fechaDocumento: documento.fechaDocumento || hoyIso(),
            idBodega: String(primerDetalle.idBodega || ""),
            idUbicacion: String(primerDetalle.idUbicacion || ""),
            observacion: documento.observacion || "",
        });
        setDetalles(
            lista.map((detalle) => ({
                tempId: `edit-${detalle.idDocumentoDetalle}`,
                idProducto: Number(detalle.idProducto),
                codigo: detalle.codigoProducto || "",
                descripcion: detalle.descripcion || "Producto",
                unidad: detalle.unidad || "UND",
                cantidad: detalle.cantidad,
                manejaLote: Number(detalle.manejaLote || 0) === 1,
                manejaVencimiento:
                    Number(detalle.manejaVencimiento || 0) === 1,
                idLote: Number(detalle.idLote || 0) || null,
                lote: detalle.idLote
                    ? {
                        idLote: Number(detalle.idLote),
                        lote: detalle.lote,
                        fechaVencimiento: detalle.fechaVencimiento,
                    }
                    : null,
                idUbicacion: Number(detalle.idUbicacion),
                observacion: detalle.observacion || "",
            }))
        );
    }, [idDocumento, navegar]);

    const cargarFormulario = useCallback(async () => {
        if (!usuario?.idUsuario) {
            toast.error("No se pudo identificar el usuario de la sesión.");
            setCargando(false);
            return;
        }

        setCargando(true);

        try {
            const params = new URLSearchParams({
                idUsuario: String(usuario.idUsuario),
                t: String(Date.now()),
            });
            const resultado = await consumirJson(
                `${API_BASE}InventarioInicialFormData.php?${params}`
            );
            const data = resultado.data || {};
            let listaBodegas = Array.isArray(data.bodegas)
                ? data.bodegas
                : [];
            let listaUbicaciones = Array.isArray(data.ubicaciones)
                ? data.ubicaciones
                : [];

            /*
             * Las bodegas y ubicaciones pertenecen al mismo catálogo que ya
             * utiliza Entradas. Si el servicio especializado no las devuelve,
             * se recuperan del FormData existente sin perder el documento ni
             * las validaciones propias del inventario inicial.
             */
            if (
                listaBodegas.length === 0 ||
                listaUbicaciones.length === 0
            ) {
                const catalogos = await consumirJson(
                    `${API_ENTRADAS}InventarioEntradasFormData.php?t=${Date.now()}`
                );
                const dataCatalogos = catalogos?.data || {};

                if (listaBodegas.length === 0) {
                    listaBodegas = Array.isArray(dataCatalogos.bodegas)
                        ? dataCatalogos.bodegas
                        : [];
                }

                if (listaUbicaciones.length === 0) {
                    listaUbicaciones = Array.isArray(
                        dataCatalogos.ubicaciones
                    )
                        ? dataCatalogos.ubicaciones
                        : [];
                }
            }

            setTipoDocumento(data.tipoDocumento || null);
            setOperador(data.operador || null);
            setBodegas(listaBodegas);
            setUbicaciones(listaUbicaciones);

            if (modoEdicion) {
                await cargarDetalle();
            } else {
                const disponibles = listaBodegas.filter((item) =>
                    puedeCrearEnBodega(item)
                );
                const bodega = disponibles[0] || listaBodegas[0];
                const idBodega = idDe(bodega, "idBodega", "id");
                const ubicacion = listaUbicaciones.find(
                    (item) =>
                        idDe(item, "idBodega") === idBodega
                );
                setForm((prev) => ({
                    ...prev,
                    fechaDocumento: data.fechaActual || prev.fechaDocumento,
                    idBodega: idBodega ? String(idBodega) : "",
                    idUbicacion: ubicacion
                        ? String(idDe(ubicacion, "idUbicacion", "id"))
                        : "",
                }));
            }
        } catch (error) {
            console.error(error);
            toast.error(error.message);
        } finally {
            setCargando(false);
            setTimeout(() => inputBusquedaRef.current?.focus(), 150);
        }
    }, [cargarDetalle, modoEdicion, usuario?.idUsuario]);

    useEffect(() => {
        cargarFormulario();
    }, [cargarFormulario]);

    useEffect(() => {
        if (!form.idBodega) return;
        const existe = ubicacionesBodega.some(
            (item) => Number(item.idUbicacion) === Number(form.idUbicacion)
        );

        if (!existe) {
            setForm((prev) => ({
                ...prev,
                idUbicacion: ubicacionesBodega[0]
                    ? String(ubicacionesBodega[0].idUbicacion)
                    : "",
            }));
        }
    }, [form.idBodega, form.idUbicacion, ubicacionesBodega]);

    const abrirCantidad = (producto) => {
        setModalProductos({ visible: false, resultados: [] });
        setModalCantidad({ visible: true, producto, cantidad: "1" });
    };

    const buscarProducto = async () => {
        const q = busqueda.trim();
        if (!q) {
            toast.info("Digite o escanee un código, nombre o código de barras.");
            inputBusquedaRef.current?.focus();
            return;
        }

        setBuscando(true);

        try {
            const params = new URLSearchParams({
                q,
                limite: "20",
                t: String(Date.now()),
            });
            const resultado = await consumirJson(
                `${API_PRODUCTOS}InventarioProductosBuscar.php?${params}`
            );
            const productos = Array.isArray(resultado.data) ? resultado.data : [];

            if (productos.length === 0) {
                toast.warning("No se encontraron productos.");
            } else if (productos.length === 1) {
                abrirCantidad(productos[0]);
            } else {
                setModalProductos({ visible: true, resultados: productos });
            }
        } catch (error) {
            toast.error(error.message);
        } finally {
            setBuscando(false);
        }
    };

    const confirmarCantidad = () => {
        const producto = modalCantidad.producto;
        const cantidad = Number(
            String(modalCantidad.cantidad || "").replace(",", ".")
        );
        const idProducto = idDe(producto, "idProducto", "id");

        if (!idProducto || cantidad <= 0) {
            toast.warning("La cantidad debe ser mayor que cero.");
            return;
        }

        const manejaLote = Number(producto?.manejaLote || 0) === 1;
        const manejaVencimiento =
            Number(
                producto?.manejaVencimiento ??
                producto?.requiereFechaVencimiento ??
                0
            ) === 1;
        const existente = detalles.find(
            (item) =>
                Number(item.idProducto) === idProducto &&
                !item.idLote &&
                !manejaLote
        );

        if (existente) {
            setDetalles((prev) =>
                prev.map((item) =>
                    item.tempId === existente.tempId
                        ? {
                            ...item,
                            cantidad: Number(item.cantidad) + cantidad,
                        }
                        : item
                )
            );
            setModalCantidad({ visible: false, producto: null, cantidad: "1" });
            setBusqueda("");
            return;
        }

        const detalle = {
            tempId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            idProducto,
            codigo: producto.codigo || producto.codigoInterno || "",
            descripcion:
                producto.descripcion ||
                producto.nombre ||
                producto.producto ||
                "Producto",
            unidad: producto.unidadBaseInventario || "UND",
            cantidad,
            manejaLote,
            manejaVencimiento,
            idLote: null,
            lote: null,
            idUbicacion: Number(form.idUbicacion),
            observacion: "",
        };

        setDetalles((prev) => [...prev, detalle]);
        setModalCantidad({ visible: false, producto: null, cantidad: "1" });
        setBusqueda("");

        if (manejaLote) {
            setTimeout(() => abrirLotes(detalle), 100);
        } else {
            setTimeout(() => inputBusquedaRef.current?.focus(), 100);
        }
    };

    const abrirLotes = async (detalle) => {
        setFormLote({
            lote: "",
            fechaFabricacion: "",
            fechaVencimiento: "",
            observacion: "",
        });
        setModalLote({
            visible: true,
            detalleId: detalle.tempId,
            lotes: [],
            cargando: true,
        });

        try {
            const params = new URLSearchParams({
                idProducto: String(detalle.idProducto),
                estado: "1",
                limite: "100",
                t: String(Date.now()),
            });
            const resultado = await consumirJson(
                `${API_LOTES}InventarioLotesListar.php?${params}`
            );
            setModalLote((prev) => ({
                ...prev,
                lotes: Array.isArray(resultado.data) ? resultado.data : [],
                cargando: false,
            }));
        } catch (error) {
            toast.error(error.message);
            setModalLote((prev) => ({ ...prev, cargando: false }));
        }
    };

    const seleccionarLote = (lote) => {
        setDetalles((prev) =>
            prev.map((detalle) =>
                detalle.tempId === modalLote.detalleId
                    ? {
                        ...detalle,
                        idLote: idDe(lote, "idLote", "id"),
                        lote,
                    }
                    : detalle
            )
        );
        setModalLote({ visible: false, detalleId: null, lotes: [], cargando: false });
        setTimeout(() => inputBusquedaRef.current?.focus(), 100);
    };

    const crearLote = async () => {
        const detalle = detalles.find(
            (item) => item.tempId === modalLote.detalleId
        );

        if (!detalle || !formLote.lote.trim()) {
            toast.warning("Ingrese el número o código del lote.");
            return;
        }

        if (detalle.manejaVencimiento && !formLote.fechaVencimiento) {
            toast.warning("Este producto requiere fecha de vencimiento.");
            return;
        }

        setCreandoLote(true);

        try {
            const resultado = await consumirJson(
                `${API_LOTES}InventarioLotesGuardar.php`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        idProducto: detalle.idProducto,
                        lote: formLote.lote.trim(),
                        fechaFabricacion: formLote.fechaFabricacion,
                        fechaVencimiento: formLote.fechaVencimiento,
                        fechaIngreso: form.fechaDocumento,
                        observacion: formLote.observacion,
                        estado: 1,
                    }),
                }
            );
            toast.success(resultado.mensaje);
            seleccionarLote(resultado.data);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setCreandoLote(false);
        }
    };

    const actualizarDetalle = (tempId, cambios) => {
        setDetalles((prev) =>
            prev.map((detalle) =>
                detalle.tempId === tempId ? { ...detalle, ...cambios } : detalle
            )
        );
    };

    const validar = () => {
        if (!usuario?.idUsuario) {
            toast.error("No se pudo identificar el usuario.");
            return false;
        }
        if (!form.fechaDocumento || !form.idBodega || !form.idUbicacion) {
            toast.warning("Complete fecha de corte, bodega y ubicación.");
            return false;
        }
        if (
            !puedeCrearEnBodega(
                bodegaSeleccionada,
                modoEdicion
            )
        ) {
            toast.warning("La bodega no está disponible para inventario inicial.");
            return false;
        }
        if (detalles.length === 0) {
            toast.warning("Agregue al menos un producto.");
            return false;
        }

        const claves = new Set();

        for (const detalle of detalles) {
            if (Number(detalle.cantidad) <= 0) {
                toast.warning(`La cantidad de ${detalle.descripcion} debe ser mayor a cero.`);
                return false;
            }
            if (detalle.manejaLote && !detalle.idLote) {
                toast.warning(`Seleccione un lote para ${detalle.descripcion}.`);
                return false;
            }
            const clave = [
                detalle.idProducto,
                detalle.idUbicacion || form.idUbicacion,
                detalle.idLote || 0,
            ].join("|");
            if (claves.has(clave)) {
                toast.warning(
                    `El producto ${detalle.descripcion} está repetido con la misma ubicación y lote.`
                );
                return false;
            }
            claves.add(clave);
        }

        return true;
    };

    const guardar = async () => {
        if (!validar()) return;
        setGuardando(true);

        try {
            const resultado = await consumirJson(
                `${API_BASE}InventarioInicialGuardar.php`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        idDocumento: modoEdicion ? idDocumento : undefined,
                        idUsuario: usuario.idUsuario,
                        fechaDocumento: form.fechaDocumento,
                        idBodega: Number(form.idBodega),
                        idUbicacion: Number(form.idUbicacion),
                        observacion: form.observacion,
                        detalles: detalles.map((detalle) => ({
                            idProducto: Number(detalle.idProducto),
                            cantidad: Number(detalle.cantidad),
                            idBodega: Number(form.idBodega),
                            idUbicacion: Number(
                                detalle.idUbicacion || form.idUbicacion
                            ),
                            idLote: detalle.idLote
                                ? Number(detalle.idLote)
                                : null,
                            observacion: detalle.observacion || "",
                        })),
                    }),
                }
            );
            toast.success(resultado.mensaje);
            localStorage.removeItem("inventarioInicialEditar");
            navegar("InventarioInicial");
        } catch (error) {
            toast.error(error.message);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <>
            <div className="w-full h-screen flex flex-col p-2 md:p-4 bg-slate-100">
                <article className="flex-1 bg-white shadow-lg rounded-2xl flex flex-col overflow-hidden border border-slate-200">
                    <header className="px-4 py-3 md:px-5 border-b border-slate-200">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setSidebar(true)}
                                    className="lg:hidden w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center"
                                >
                                    <IoMenu />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navegar("InventarioInicial")}
                                    className="hidden md:flex w-9 h-9 rounded-xl border border-slate-200 items-center justify-center"
                                >
                                    <FaArrowLeft />
                                </button>
                                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                                    <FaWarehouse className="text-blue-800" />
                                </div>
                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">
                                        Saldo de apertura
                                    </p>
                                    <h1 className="text-xl md:text-2xl font-bold text-slate-900">
                                        {modoEdicion
                                            ? "Editar inventario inicial"
                                            : "Nuevo inventario inicial"}
                                    </h1>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => navegar("InventarioInicial")}
                                    className="h-10 px-3 rounded-xl border border-slate-300 font-semibold text-slate-700 flex items-center gap-2"
                                >
                                    <FaArrowLeft />
                                    Volver
                                </button>
                                <button
                                    type="button"
                                    onClick={guardar}
                                    disabled={guardando || cargando}
                                    className="h-10 px-4 rounded-xl bg-blue-800 text-white font-semibold flex items-center gap-2 disabled:opacity-60"
                                >
                                    {guardando ? (
                                        <FaSyncAlt className="animate-spin" />
                                    ) : (
                                        <FaSave />
                                    )}
                                    Guardar borrador
                                </button>
                            </div>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto p-3 md:p-4">
                        {cargando ? (
                            <div className="min-h-[420px] flex flex-col items-center justify-center gap-3">
                                <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />
                                <p className="text-sm text-slate-500">
                                    Cargando formulario...
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-[330px_1fr] gap-4 items-start">
                                <aside className="space-y-4 xl:sticky xl:top-0">
                                    <section className="rounded-2xl border border-slate-200 overflow-hidden">
                                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                                            <h2 className="font-bold text-slate-900">
                                                Datos de la carga
                                            </h2>
                                            <p className="text-xs text-slate-500">
                                                Documento fijo y bodega de apertura.
                                            </p>
                                        </div>
                                        <div className="p-4 space-y-3">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 mb-1">
                                                    Tipo de documento
                                                </label>
                                                <div className="h-10 px-3 rounded-xl bg-blue-50 border border-blue-200 flex items-center text-sm font-bold text-blue-800">
                                                    {tipoDocumento?.nombre ||
                                                        "Inventario inicial"}
                                                    <span className="ml-2 text-xs font-normal">
                                                        ({tipoDocumento?.codigo || "INV_INICIAL"})
                                                    </span>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 mb-1">
                                                    Fecha de corte
                                                </label>
                                                <input
                                                    type="date"
                                                    value={form.fechaDocumento}
                                                    onChange={(event) =>
                                                        setForm((prev) => ({
                                                            ...prev,
                                                            fechaDocumento:
                                                                event.target.value,
                                                        }))
                                                    }
                                                    className="w-full h-10 px-3 rounded-xl border border-slate-300"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 mb-1">
                                                    Bodega
                                                </label>
                                                <select
                                                    value={form.idBodega}
                                                    disabled={
                                                        modoEdicion ||
                                                        detalles.length > 0
                                                    }
                                                    onChange={(event) =>
                                                        setForm((prev) => ({
                                                            ...prev,
                                                            idBodega:
                                                                event.target.value,
                                                            idUbicacion: "",
                                                        }))
                                                    }
                                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white disabled:bg-slate-100"
                                                >
                                                    <option value="">
                                                        Seleccione
                                                    </option>
                                                    {bodegas.map((item) => {
                                                        const idBodega = idDe(
                                                            item,
                                                            "idBodega",
                                                            "id"
                                                        );
                                                        const disponible =
                                                            puedeCrearEnBodega(
                                                                item,
                                                                modoEdicion
                                                            );

                                                        return (
                                                            <option
                                                                key={idBodega}
                                                                value={idBodega}
                                                                disabled={!disponible}
                                                            >
                                                                {item.nombre}
                                                                {!disponible
                                                                    ? ` — ${motivoBodegaNoDisponible(
                                                                        item
                                                                    )}`
                                                                    : ""}
                                                            </option>
                                                        );
                                                    })}
                                                </select>
                                                {bodegas.length === 0 && (
                                                    <p className="mt-1 text-[11px] text-red-700">
                                                        No se encontraron bodegas
                                                        activas.
                                                    </p>
                                                )}
                                                {bodegas.length > 0 &&
                                                    bodegasDisponibles.length ===
                                                    0 &&
                                                    !modoEdicion && (
                                                        <p className="mt-1 text-[11px] leading-4 text-amber-700">
                                                            Las bodegas fueron
                                                            consultadas, pero
                                                            ninguna está
                                                            disponible para una
                                                            carga inicial. Revise
                                                            el motivo mostrado en
                                                            cada opción.
                                                        </p>
                                                    )}
                                                {detalles.length > 0 && (
                                                    <p className="mt-1 text-[11px] text-amber-700">
                                                        Para cambiar la bodega,
                                                        elimine primero los productos.
                                                    </p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 mb-1">
                                                    Ubicación predeterminada
                                                </label>
                                                <select
                                                    value={form.idUbicacion}
                                                    onChange={(event) =>
                                                        setForm((prev) => ({
                                                            ...prev,
                                                            idUbicacion:
                                                                event.target.value,
                                                        }))
                                                    }
                                                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white"
                                                >
                                                    <option value="">
                                                        Seleccione
                                                    </option>
                                                    {ubicacionesBodega.map(
                                                        (item) => {
                                                            const idUbicacion =
                                                                idDe(
                                                                    item,
                                                                    "idUbicacion",
                                                                    "id"
                                                                );

                                                            return (
                                                                <option
                                                                    key={
                                                                        idUbicacion
                                                                    }
                                                                    value={
                                                                        idUbicacion
                                                                    }
                                                                >
                                                                    {item.nombre}
                                                                </option>
                                                            );
                                                        }
                                                    )}
                                                </select>
                                                {form.idBodega &&
                                                    ubicacionesBodega.length ===
                                                    0 && (
                                                        <p className="mt-1 text-[11px] text-red-700">
                                                            La bodega seleccionada
                                                            no tiene ubicaciones
                                                            activas.
                                                        </p>
                                                    )}
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-600 mb-1">
                                                    Observación
                                                </label>
                                                <textarea
                                                    rows={3}
                                                    value={form.observacion}
                                                    onChange={(event) =>
                                                        setForm((prev) => ({
                                                            ...prev,
                                                            observacion:
                                                                event.target.value,
                                                        }))
                                                    }
                                                    placeholder="Ej: Conteo de apertura validado el..."
                                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 resize-none"
                                                />
                                            </div>

                                            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                                <p className="text-xs text-slate-500">
                                                    Operador administrativo
                                                </p>
                                                <p className="font-bold text-sm text-slate-900">
                                                    {operador?.nombreCompleto ||
                                                        operador?.nombre ||
                                                        usuario?.nombre ||
                                                        "Identificado por sesión"}
                                                </p>
                                            </div>

                                            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex gap-2">
                                                <FaExclamationTriangle className="text-amber-700 mt-0.5 shrink-0" />
                                                <p className="text-xs leading-5 text-amber-800">
                                                    Al finalizar, la carga no se
                                                    puede editar. Las correcciones
                                                    posteriores se hacen mediante
                                                    Ajustes.
                                                </p>
                                            </div>
                                        </div>
                                    </section>
                                </aside>

                                <div className="space-y-4">
                                    <section className="rounded-2xl border border-slate-200 overflow-hidden">
                                        <div className="p-4 bg-slate-50 border-b border-slate-200">
                                            <h2 className="font-bold text-slate-900">
                                                Agregar productos existentes
                                            </h2>
                                            <p className="text-xs text-slate-500">
                                                Busca por código, nombre o código
                                                de barras.
                                            </p>
                                            <div className="mt-3 flex gap-2">
                                                <div className="relative flex-1">
                                                    <FaBarcode className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-800" />
                                                    <input
                                                        ref={inputBusquedaRef}
                                                        value={busqueda}
                                                        onChange={(event) =>
                                                            setBusqueda(
                                                                event.target.value
                                                            )
                                                        }
                                                        onKeyDown={(event) => {
                                                            if (
                                                                event.key === "Enter"
                                                            ) {
                                                                event.preventDefault();
                                                                buscarProducto();
                                                            }
                                                        }}
                                                        placeholder="Digite o escanee el producto"
                                                        className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-200"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={buscarProducto}
                                                    disabled={
                                                        buscando ||
                                                        !form.idBodega ||
                                                        !form.idUbicacion
                                                    }
                                                    className="h-11 px-4 rounded-xl bg-blue-800 text-white font-semibold flex items-center gap-2 disabled:opacity-50"
                                                >
                                                    {buscando ? (
                                                        <FaSyncAlt className="animate-spin" />
                                                    ) : (
                                                        <FaSearch />
                                                    )}
                                                    Buscar
                                                </button>
                                            </div>
                                        </div>

                                        <div className="p-4">
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                <span className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-800 text-xs font-bold">
                                                    Productos: {detalles.length}
                                                </span>
                                                <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold">
                                                    Cantidad total:{" "}
                                                    {new Intl.NumberFormat("es-CO", {
                                                        maximumFractionDigits: 3,
                                                    }).format(totalCantidad)}
                                                </span>
                                            </div>

                                            {detalles.length === 0 ? (
                                                <div className="min-h-64 flex flex-col items-center justify-center text-center">
                                                    <FaBoxes className="text-4xl text-slate-300" />
                                                    <p className="mt-3 font-bold text-slate-800">
                                                        Aún no hay productos
                                                    </p>
                                                    <p className="text-sm text-slate-500">
                                                        Registra las existencias
                                                        físicas contadas en la bodega.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                                    <table className="w-full min-w-[960px]">
                                                        <thead className="bg-slate-50">
                                                            <tr>
                                                                {[
                                                                    "Producto",
                                                                    "Cantidad",
                                                                    "Ubicación",
                                                                    "Lote",
                                                                    "Observación",
                                                                    "",
                                                                ].map((titulo, indice) => (
                                                                    <th
                                                                        key={`${titulo}-${indice}`}
                                                                        className="px-3 py-2 text-left text-[11px] uppercase text-slate-500"
                                                                    >
                                                                        {titulo}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-200">
                                                            {detalles.map((detalle) => (
                                                                <tr key={detalle.tempId}>
                                                                    <td className="px-3 py-3">
                                                                        <p className="font-semibold text-sm text-slate-900 max-w-[250px]">
                                                                            {detalle.descripcion}
                                                                        </p>
                                                                        <p className="text-xs text-slate-500">
                                                                            {detalle.codigo ||
                                                                                `ID ${detalle.idProducto}`}{" "}
                                                                            · {detalle.unidad}
                                                                        </p>
                                                                    </td>
                                                                    <td className="px-3 py-3">
                                                                        <input
                                                                            type="number"
                                                                            min="0.001"
                                                                            step="0.001"
                                                                            value={detalle.cantidad}
                                                                            onChange={(event) =>
                                                                                actualizarDetalle(
                                                                                    detalle.tempId,
                                                                                    {
                                                                                        cantidad:
                                                                                            event
                                                                                                .target
                                                                                                .value,
                                                                                    }
                                                                                )
                                                                            }
                                                                            className="w-24 h-9 px-2 text-center rounded-xl border border-slate-300"
                                                                        />
                                                                    </td>
                                                                    <td className="px-3 py-3">
                                                                        <select
                                                                            value={
                                                                                detalle.idUbicacion ||
                                                                                form.idUbicacion
                                                                            }
                                                                            onChange={(event) =>
                                                                                actualizarDetalle(
                                                                                    detalle.tempId,
                                                                                    {
                                                                                        idUbicacion:
                                                                                            Number(
                                                                                                event
                                                                                                    .target
                                                                                                    .value
                                                                                            ),
                                                                                    }
                                                                                )
                                                                            }
                                                                            className="h-9 px-2 rounded-xl border border-slate-300 bg-white text-sm"
                                                                        >
                                                                            {ubicacionesBodega.map(
                                                                                (item) => (
                                                                                    <option
                                                                                        key={
                                                                                            item.idUbicacion
                                                                                        }
                                                                                        value={
                                                                                            item.idUbicacion
                                                                                        }
                                                                                    >
                                                                                        {item.nombre}
                                                                                    </option>
                                                                                )
                                                                            )}
                                                                        </select>
                                                                    </td>
                                                                    <td className="px-3 py-3">
                                                                        {detalle.manejaLote ? (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    abrirLotes(
                                                                                        detalle
                                                                                    )
                                                                                }
                                                                                className={`h-9 px-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${detalle.idLote
                                                                                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                                                                        : "bg-amber-50 border-amber-200 text-amber-700"
                                                                                    }`}
                                                                            >
                                                                                {detalle.idLote ? (
                                                                                    <FaCheckCircle />
                                                                                ) : (
                                                                                    <FaExclamationTriangle />
                                                                                )}
                                                                                {detalle.lote
                                                                                    ?.lote ||
                                                                                    "Seleccionar lote"}
                                                                            </button>
                                                                        ) : (
                                                                            <span className="text-xs text-slate-500">
                                                                                No aplica
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-3 py-3">
                                                                        <input
                                                                            value={
                                                                                detalle.observacion
                                                                            }
                                                                            onChange={(event) =>
                                                                                actualizarDetalle(
                                                                                    detalle.tempId,
                                                                                    {
                                                                                        observacion:
                                                                                            event
                                                                                                .target
                                                                                                .value,
                                                                                    }
                                                                                )
                                                                            }
                                                                            placeholder="Opcional"
                                                                            className="w-full h-9 px-3 rounded-xl border border-slate-300"
                                                                        />
                                                                    </td>
                                                                    <td className="px-3 py-3">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                setDetalles((prev) =>
                                                                                    prev.filter(
                                                                                        (item) =>
                                                                                            item.tempId !==
                                                                                            detalle.tempId
                                                                                    )
                                                                                )
                                                                            }
                                                                            className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-center"
                                                                        >
                                                                            <FaTrash />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </section>
                                </div>
                            </div>
                        )}
                    </div>
                </article>
            </div>

            {modalProductos.visible && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-950/60"
                        onClick={() =>
                            setModalProductos({ visible: false, resultados: [] })
                        }
                        aria-label="Cerrar"
                    />
                    <section className="relative w-full max-w-3xl max-h-[85vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                        <header className="p-5 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">
                                    Seleccionar producto
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Se encontraron varias coincidencias.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    setModalProductos({
                                        visible: false,
                                        resultados: [],
                                    })
                                }
                                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center"
                            >
                                <FaTimes />
                            </button>
                        </header>
                        <div className="p-5 overflow-y-auto space-y-2">
                            {modalProductos.resultados.map((producto) => (
                                <button
                                    type="button"
                                    key={idDe(producto, "idProducto", "id")}
                                    onClick={() => abrirCantidad(producto)}
                                    className="w-full p-4 rounded-xl border border-slate-200 text-left hover:bg-blue-50 hover:border-blue-200"
                                >
                                    <p className="font-bold text-slate-900">
                                        {producto.descripcion ||
                                            producto.nombre ||
                                            producto.producto}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                        {producto.codigo ||
                                            producto.codigoInterno ||
                                            `ID ${idDe(
                                                producto,
                                                "idProducto",
                                                "id"
                                            )}`}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </section>
                </div>
            )}

            {modalCantidad.visible && modalCantidad.producto && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-950/60"
                        onClick={() =>
                            setModalCantidad({
                                visible: false,
                                producto: null,
                                cantidad: "1",
                            })
                        }
                        aria-label="Cerrar"
                    />
                    <section className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
                        <h2 className="text-xl font-bold text-slate-900">
                            Cantidad física
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                            {modalCantidad.producto.descripcion ||
                                modalCantidad.producto.nombre ||
                                modalCantidad.producto.producto}
                        </p>
                        <label className="block mt-5 text-sm font-bold text-slate-700">
                            Cantidad contada
                        </label>
                        <input
                            autoFocus
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={modalCantidad.cantidad}
                            onChange={(event) =>
                                setModalCantidad((prev) => ({
                                    ...prev,
                                    cantidad: event.target.value,
                                }))
                            }
                            onKeyDown={(event) => {
                                if (event.key === "Enter") confirmarCantidad();
                            }}
                            className="mt-2 w-full h-12 px-4 rounded-xl border border-slate-300 text-lg font-bold"
                        />
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() =>
                                    setModalCantidad({
                                        visible: false,
                                        producto: null,
                                        cantidad: "1",
                                    })
                                }
                                className="h-10 px-4 rounded-xl border border-slate-300 font-semibold"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={confirmarCantidad}
                                className="h-10 px-4 rounded-xl bg-blue-800 text-white font-semibold flex items-center gap-2"
                            >
                                <FaPlus />
                                Agregar
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {modalLote.visible && (
                <div className="fixed inset-0 z-[10001] flex items-center justify-center p-3 md:p-6">
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-950/60"
                        onClick={() =>
                            setModalLote({
                                visible: false,
                                detalleId: null,
                                lotes: [],
                                cargando: false,
                            })
                        }
                        aria-label="Cerrar"
                    />
                    <section className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                        <header className="p-5 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">
                                    Seleccionar o crear lote
                                </h2>
                                <p className="text-sm text-slate-500">
                                    El lote quedará asociado al saldo inicial.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    setModalLote({
                                        visible: false,
                                        detalleId: null,
                                        lotes: [],
                                        cargando: false,
                                    })
                                }
                                className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center"
                            >
                                <FaTimes />
                            </button>
                        </header>
                        <div className="p-5 overflow-y-auto grid lg:grid-cols-2 gap-5">
                            <div>
                                <h3 className="font-bold text-slate-900">
                                    Lotes existentes
                                </h3>
                                <div className="mt-3 space-y-2">
                                    {modalLote.cargando ? (
                                        <div className="min-h-40 flex items-center justify-center">
                                            <FaSyncAlt className="text-2xl text-blue-800 animate-spin" />
                                        </div>
                                    ) : modalLote.lotes.length === 0 ? (
                                        <p className="p-4 rounded-xl bg-slate-50 text-sm text-slate-500">
                                            No hay lotes existentes para este producto.
                                        </p>
                                    ) : (
                                        modalLote.lotes.map((lote) => (
                                            <button
                                                type="button"
                                                key={idDe(lote, "idLote", "id")}
                                                onClick={() => seleccionarLote(lote)}
                                                className="w-full p-4 rounded-xl border border-slate-200 text-left hover:bg-emerald-50 hover:border-emerald-200"
                                            >
                                                <p className="font-bold text-slate-900">
                                                    {lote.lote}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    Vence:{" "}
                                                    {lote.fechaVencimiento ||
                                                        "No definida"}
                                                </p>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                                <h3 className="font-bold text-slate-900">
                                    Crear nuevo lote
                                </h3>
                                <div className="mt-3 space-y-3">
                                    <input
                                        value={formLote.lote}
                                        onChange={(event) =>
                                            setFormLote((prev) => ({
                                                ...prev,
                                                lote: event.target.value,
                                            }))
                                        }
                                        placeholder="Número o código del lote"
                                        className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white"
                                    />
                                    <div className="grid sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-bold text-slate-600">
                                                Fabricación
                                            </label>
                                            <input
                                                type="date"
                                                value={formLote.fechaFabricacion}
                                                onChange={(event) =>
                                                    setFormLote((prev) => ({
                                                        ...prev,
                                                        fechaFabricacion:
                                                            event.target.value,
                                                    }))
                                                }
                                                className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-600">
                                                Vencimiento
                                            </label>
                                            <input
                                                type="date"
                                                value={formLote.fechaVencimiento}
                                                onChange={(event) =>
                                                    setFormLote((prev) => ({
                                                        ...prev,
                                                        fechaVencimiento:
                                                            event.target.value,
                                                    }))
                                                }
                                                className="mt-1 w-full h-10 px-3 rounded-xl border border-slate-300 bg-white"
                                            />
                                        </div>
                                    </div>
                                    <textarea
                                        rows={3}
                                        value={formLote.observacion}
                                        onChange={(event) =>
                                            setFormLote((prev) => ({
                                                ...prev,
                                                observacion: event.target.value,
                                            }))
                                        }
                                        placeholder="Observación opcional"
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white resize-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={crearLote}
                                        disabled={creandoLote}
                                        className="w-full h-11 rounded-xl bg-blue-800 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
                                    >
                                        {creandoLote ? (
                                            <FaSyncAlt className="animate-spin" />
                                        ) : (
                                            <FaPlus />
                                        )}
                                        Crear y seleccionar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>
            )}
        </>
    );
};