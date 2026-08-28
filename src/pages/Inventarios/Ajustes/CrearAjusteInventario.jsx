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
    FaArrowLeft,
    FaArrowUp,
    FaBarcode,
    FaBoxes,
    FaBoxOpen,
    FaCheckCircle,
    FaClipboardList,
    FaEdit,
    FaExclamationTriangle,
    FaEye,
    FaPlus,
    FaSave,
    FaSearch,
    FaSyncAlt,
    FaTimes,
    FaTrash,
    FaWarehouse,
} from "react-icons/fa";
import { toast } from "react-toastify";

const API_BASE_AJUSTES =
    "https://app.accionporcolombia.com/servicesPae/Inventario/Ajustes/";

const API_BASE_PRODUCTOS =
    "https://app.accionporcolombia.com/servicesPae/Inventario/Productos/";

export const CrearAjusteInventario = ({ setSidebar, navegar }) => {
    const abrirMenu = () => setSidebar(true);
    const estadoPagina = useCallback((pagina) => navegar(pagina), [navegar]);

    const inputProductoRef = useRef(null);
    const inputCantidadRef = useRef(null);

    const [cargando, setCargando] = useState(true);
    const [cargandoDocumento, setCargandoDocumento] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [finalizando, setFinalizando] = useState(false);
    const [buscandoProducto, setBuscandoProducto] = useState(false);
    const [cargandoLotes, setCargandoLotes] = useState(false);

    const [modoDetalle, setModoDetalle] = useState(false);
    const [estadoDocumento, setEstadoDocumento] = useState("BORRADOR");
    const [ajusteLocal, setAjusteLocal] = useState(null);

    const [tiposDocumento, setTiposDocumento] = useState([]);
    const [bodegas, setBodegas] = useState([]);
    const [ubicaciones, setUbicaciones] = useState([]);
    const [operador, setOperador] = useState(null);

    const [form, setForm] = useState({
        idTipoDocumento: "",
        fechaDocumento: "",
        idBodega: "",
        idUbicacion: "",
        observacion: "",
    });

    const [busquedaProducto, setBusquedaProducto] = useState("");
    const [detalles, setDetalles] = useState([]);

    const [modalProductos, setModalProductos] = useState({
        visible: false,
        resultados: [],
        busqueda: "",
    });

    const [modalCantidad, setModalCantidad] = useState({
        visible: false,
        producto: null,
        cantidad: "1",
    });

    const [modalLotes, setModalLotes] = useState({
        visible: false,
        detalleId: null,
        lotes: [],
        busqueda: "",
    });

    const [detallePendienteLote, setDetallePendienteLote] = useState(null);
    const [modalFinalizar, setModalFinalizar] = useState(false);

    const respuestaExitosa = (respuesta) =>
        respuesta?.rpta === "si" || respuesta?.rpta === true;

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
                const posibleUsuario =
                    usuario?.usuario || usuario?.user || usuario?.data || usuario;

                const id =
                    posibleUsuario?.idUsuario ??
                    posibleUsuario?.id_usuario ??
                    posibleUsuario?.id ??
                    posibleUsuario?.userId ??
                    posibleUsuario?.idUser;

                if (id) {
                    return {
                        ...posibleUsuario,
                        idUsuario: Number(id),
                        nombre:
                            posibleUsuario?.nombre ??
                            posibleUsuario?.nombreCompleto ??
                            "",
                    };
                }
            } catch {
                const idPlano = Number(valor);
                if (idPlano > 0) {
                    return { idUsuario: idPlano };
                }
            }
        }

        return null;
    };

    const usuarioSesion = useMemo(() => obtenerUsuarioSesion(), []);

    const obtenerAjusteLocal = (esVista) => {
        const llaves = esVista
            ? ["ajusteInventarioDetalle", "ajusteInventarioEditar"]
            : ["ajusteInventarioEditar", "ajusteInventarioDetalle"];

        for (const llave of llaves) {
            const valor = localStorage.getItem(llave);
            if (!valor) continue;

            try {
                const ajuste = JSON.parse(valor);
                const id = Number(
                    ajuste?.idDocumento ?? ajuste?.idAjuste ?? ajuste?.id ?? 0
                );

                if (id > 0) return ajuste;
            } catch {
                continue;
            }
        }

        return null;
    };

    useEffect(() => {
        const modo = String(
            localStorage.getItem("ajusteInventarioModo") || ""
        ).toUpperCase();

        const esVista = modo === "VER";
        setModoDetalle(esVista);

        const ajuste = obtenerAjusteLocal(esVista);
        if (ajuste) setAjusteLocal(ajuste);
    }, []);

    const idDocumento = useMemo(
        () =>
            Number(
                ajusteLocal?.idDocumento ??
                    ajusteLocal?.idAjuste ??
                    ajusteLocal?.id ??
                    0
            ),
        [ajusteLocal]
    );

    const modoEdicion = idDocumento > 0;
    const soloLectura =
        modoDetalle || (modoEdicion && estadoDocumento !== "BORRADOR");

    const tituloPantalla = soloLectura
        ? "Detalle de ajuste"
        : modoEdicion
        ? "Editar ajuste"
        : "Nuevo ajuste";

    const tipoDocumento = useMemo(() => {
        const idTipo = Number(form.idTipoDocumento || 0);
        return (
            tiposDocumento.find(
                (tipo) => Number(tipo?.idTipoDocumento ?? tipo?.id ?? 0) === idTipo
            ) || null
        );
    }, [tiposDocumento, form.idTipoDocumento]);

    const tipoAjuste = String(tipoDocumento?.tipoAjuste || "")
        .trim()
        .toUpperCase();

    const esPositivo = tipoAjuste === "POSITIVO";
    const esNegativo = tipoAjuste === "NEGATIVO";

    const ubicacionesFiltradas = useMemo(() => {
        const idBodega = Number(form.idBodega || 0);
        return ubicaciones.filter(
            (ubicacion) => Number(ubicacion?.idBodega || 0) === idBodega
        );
    }, [ubicaciones, form.idBodega]);

    const detalleActivoLotes = useMemo(() => {
        if (!modalLotes.detalleId) return null;

        if (modalLotes.detalleId === "__PENDIENTE_LOTE__") {
            return detallePendienteLote;
        }

        return detalles.find((item) => item.tempId === modalLotes.detalleId) || null;
    }, [modalLotes.detalleId, detallePendienteLote, detalles]);

    const totalCantidad = useMemo(
        () =>
            detalles.reduce(
                (total, detalle) => total + Number(detalle.cantidad ?? 0),
                0
            ),
        [detalles]
    );

    const formatearNumero = (valor) =>
        new Intl.NumberFormat("es-CO", {
            maximumFractionDigits: 3,
        }).format(Number(valor ?? 0));

    const generarTempId = () =>
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const productoDescripcion = (producto) =>
        producto?.descripcion ||
        producto?.nombre ||
        producto?.producto ||
        "Producto sin nombre";

    const obtenerIdLote = (lote) => Number(lote?.idLote ?? lote?.id ?? 0);

    const limpiarDocumentosLocales = () => {
        localStorage.removeItem("ajusteInventarioModo");
        localStorage.removeItem("ajusteInventarioEditar");
    };

    const volver = () => {
        limpiarDocumentosLocales();
        estadoPagina("AjustesInventario");
    };

    const limpiarProductosConLote = () => {
        setDetalles((prev) => {
            const cantidadConLote = prev.filter((item) => item.manejaLote).length;

            if (cantidadConLote > 0) {
                setTimeout(() => {
                    toast.info(
                        "Se retiraron los productos que manejaban lote porque cambió la bodega, ubicación o tipo de ajuste."
                    );
                }, 0);
            }

            return prev
                .filter((item) => !item.manejaLote)
                .map((item) => ({
                    ...item,
                    idLote: null,
                    lote: null,
                    fechaVencimiento: null,
                    cantidadDisponible: null,
                }));
        });
    };

    const cambiarForm = (campo, valor) => {
        if (soloLectura) return;

        setForm((prev) => {
            const nuevo = { ...prev, [campo]: valor };

            if (campo === "idBodega") {
                nuevo.idUbicacion = "";
            }

            return nuevo;
        });

        if (
            campo === "idTipoDocumento" ||
            campo === "idBodega" ||
            campo === "idUbicacion"
        ) {
            limpiarProductosConLote();
        }
    };

    const cargarFormData = useCallback(async () => {
        setCargando(true);

        try {
            const params = new URLSearchParams();
            params.set("t", Date.now());

            if (usuarioSesion?.idUsuario) {
                params.set("idUsuario", usuarioSesion.idUsuario);
            }

            const respuesta = await fetch(
                `${API_BASE_AJUSTES}InventarioAjustesFormData.php?${params.toString()}`,
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
                throw new Error(texto || "Respuesta no válida del servicio.");
            }

            if (!respuesta.ok || !respuestaExitosa(resultado)) {
                throw new Error(
                    resultado?.mensaje ||
                        resultado?.error ||
                        "No fue posible cargar el formulario."
                );
            }

            const data = resultado?.data || {};
            const tipos = Array.isArray(data?.tiposDocumento)
                ? data.tiposDocumento
                : [];
            const listaBodegas = Array.isArray(data?.bodegas) ? data.bodegas : [];
            const listaUbicaciones = Array.isArray(data?.ubicaciones)
                ? data.ubicaciones
                : [];

            setTiposDocumento(tipos);
            setBodegas(listaBodegas);
            setUbicaciones(listaUbicaciones);
            setOperador(data?.operador || null);

            setForm((prev) => ({
                ...prev,
                fechaDocumento:
                    prev.fechaDocumento ||
                    data?.fechaActual ||
                    new Date().toISOString().substring(0, 10),
                idTipoDocumento:
                    prev.idTipoDocumento ||
                    (tipos.length === 1
                        ? tipos[0]?.idTipoDocumento || tipos[0]?.id || ""
                        : ""),
                idBodega:
                    prev.idBodega ||
                    listaBodegas[0]?.idBodega ||
                    listaBodegas[0]?.id ||
                    "",
            }));

            setTimeout(() => inputProductoRef.current?.focus(), 250);
        } catch (error) {
            console.error("Error cargando form data:", error);
            toast.error(error?.message || "No fue posible cargar el formulario.");
        } finally {
            setCargando(false);
        }
    }, [usuarioSesion?.idUsuario]);

    const cargarDocumento = useCallback(async () => {
        if (!idDocumento) return;

        setCargandoDocumento(true);

        try {
            const params = new URLSearchParams();
            params.set("idDocumento", idDocumento);
            params.set("t", Date.now());

            const respuesta = await fetch(
                `${API_BASE_AJUSTES}InventarioAjustesDetalle.php?${params.toString()}`,
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
                throw new Error(texto || "Respuesta no válida del servicio.");
            }

            if (!respuesta.ok || !respuestaExitosa(resultado)) {
                throw new Error(
                    resultado?.mensaje ||
                        resultado?.error ||
                        "No fue posible consultar el ajuste."
                );
            }

            const data = resultado?.data || {};
            const documento = data?.documento || data?.ajuste || {};
            const estado = String(documento?.estadoProceso || "BORRADOR")
                .trim()
                .toUpperCase();

            setEstadoDocumento(estado);

            if (!modoDetalle && (documento?.editable === false || estado !== "BORRADOR")) {
                setModoDetalle(true);
                toast.info(
                    "Este ajuste ya fue finalizado. Se abrirá en modo solo lectura."
                );
            }

            setForm((prev) => ({
                ...prev,
                idTipoDocumento: documento?.idTipoDocumento || prev.idTipoDocumento,
                fechaDocumento: documento?.fechaDocumento || prev.fechaDocumento,
                idBodega:
                    documento?.idBodega ||
                    documento?.idBodegaOrigen ||
                    prev.idBodega,
                idUbicacion:
                    documento?.idUbicacion ||
                    documento?.idUbicacionOrigen ||
                    prev.idUbicacion,
                observacion: documento?.observacion ?? prev.observacion,
            }));

            const listaDetalles = Array.isArray(data?.detalles) ? data.detalles : [];

            setDetalles(
                listaDetalles.map((detalle, index) => {
                    const idLote = Number(detalle?.idLote ?? 0);

                    return {
                        tempId: `edit-${detalle?.idDocumentoDetalle || index}-${Date.now()}`,
                        idDocumentoDetalle: detalle?.idDocumentoDetalle || null,
                        idProducto: Number(detalle?.idProducto ?? 0),
                        codigo: detalle?.codigoProducto || detalle?.codigo || "",
                        descripcion:
                            detalle?.descripcion ||
                            detalle?.producto ||
                            "Producto sin nombre",
                        unidad: detalle?.unidad || "UND",
                        cantidad:
                            detalle?.cantidad ??
                            detalle?.cantidadSolicitada ??
                            0,
                        manejaLote: Number(detalle?.manejaLote ?? 0) === 1,
                        manejaVencimiento:
                            Number(detalle?.manejaVencimiento ?? 0) === 1,
                        idLote: idLote || null,
                        lote: idLote
                            ? {
                                  id: idLote,
                                  idLote,
                                  lote: detalle?.lote,
                                  fechaVencimiento: detalle?.fechaVencimiento,
                                  cantidadDisponible:
                                      detalle?.cantidadDisponible ?? null,
                              }
                            : null,
                        fechaVencimiento: detalle?.fechaVencimiento || null,
                        cantidadDisponible: detalle?.cantidadDisponible ?? null,
                        observacion: detalle?.observacion || "",
                    };
                })
            );
        } catch (error) {
            console.error("Error cargando ajuste:", error);
            toast.error(error?.message || "No fue posible cargar el ajuste.");
        } finally {
            setCargandoDocumento(false);
        }
    }, [idDocumento, modoDetalle]);

    useEffect(() => {
        cargarFormData();
    }, [cargarFormData]);

    useEffect(() => {
        if (!cargando && idDocumento) {
            cargarDocumento();
        }
    }, [cargando, idDocumento, cargarDocumento]);

    useEffect(() => {
        if (modalCantidad.visible) {
            setTimeout(() => {
                inputCantidadRef.current?.focus();
                inputCantidadRef.current?.select();
            }, 120);
        }
    }, [modalCantidad.visible]);

    const buscarProducto = async () => {
        if (soloLectura) {
            toast.info("Este ajuste está en modo solo lectura.");
            return;
        }

        const q = busquedaProducto.trim();

        if (!form.idTipoDocumento) {
            toast.warning("Debe seleccionar el tipo de ajuste.");
            return;
        }

        if (!form.idBodega) {
            toast.warning("Debe seleccionar la bodega.");
            return;
        }

        if (!q) {
            toast.info("Digite o escanee un producto.");
            inputProductoRef.current?.focus();
            return;
        }

        setBuscandoProducto(true);

        try {
            const params = new URLSearchParams();
            params.set("q", q);
            params.set("limite", 20);
            params.set("soloConfigurados", 1);
            params.set("t", Date.now());

            const respuesta = await fetch(
                `${API_BASE_PRODUCTOS}InventarioProductosBuscar.php?${params.toString()}`,
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
                throw new Error(texto || "Respuesta no válida del servicio.");
            }

            if (!respuesta.ok || !respuestaExitosa(resultado)) {
                throw new Error(
                    resultado?.mensaje ||
                        resultado?.error ||
                        "No fue posible buscar el producto."
                );
            }

            const productos = Array.isArray(resultado?.data) ? resultado.data : [];

            if (productos.length === 0) {
                toast.warning("No se encontró ningún producto.");
                return;
            }

            const exactos = productos.filter(
                (producto) => Number(producto?.coincidenciaExacta ?? 0) === 1
            );

            if (exactos.length === 1) {
                abrirCantidad(exactos[0]);
                return;
            }

            if (productos.length === 1) {
                abrirCantidad(productos[0]);
                return;
            }

            setModalProductos({
                visible: true,
                resultados: productos,
                busqueda: q,
            });
        } catch (error) {
            console.error("Error buscando producto:", error);
            toast.error(error?.message || "No fue posible buscar el producto.");
        } finally {
            setBuscandoProducto(false);
        }
    };

    const abrirCantidad = (producto) => {
        setModalProductos({ visible: false, resultados: [], busqueda: "" });
        setModalCantidad({
            visible: true,
            producto,
            cantidad: "1",
        });
    };

    const cerrarCantidad = () => {
        setModalCantidad({ visible: false, producto: null, cantidad: "1" });
        setTimeout(() => inputProductoRef.current?.focus(), 120);
    };

    const confirmarCantidad = () => {
        const producto = modalCantidad.producto;
        const cantidad = Number(String(modalCantidad.cantidad).replace(",", "."));

        if (!producto) return;

        if (!cantidad || cantidad <= 0) {
            toast.warning("Ingrese una cantidad mayor a cero.");
            inputCantidadRef.current?.focus();
            inputCantidadRef.current?.select();
            return;
        }

        const idProducto = Number(producto?.idProducto ?? producto?.id ?? 0);
        const manejaLote = Number(producto?.manejaLote ?? 0) === 1;
        const detalle = {
            tempId: generarTempId(),
            idProducto,
            codigo: producto?.codigo || "",
            descripcion: productoDescripcion(producto),
            unidad: producto?.unidadBaseInventario || producto?.unidad || "UND",
            cantidad,
            manejaLote,
            manejaVencimiento:
                Number(producto?.manejaVencimiento ?? 0) === 1 ||
                Number(producto?.requiereFechaVencimiento ?? 0) === 1,
            idLote: null,
            lote: null,
            fechaVencimiento: null,
            cantidadDisponible: null,
            observacion: "",
        };

        setModalCantidad({ visible: false, producto: null, cantidad: "1" });
        setBusquedaProducto("");

        if (manejaLote) {
            setDetallePendienteLote(detalle);
            setTimeout(() => abrirLotes(detalle, true), 100);
            return;
        }

        setDetalles((prev) => {
            const existe = prev.find((item) => Number(item.idProducto) === idProducto);

            if (!existe) {
                return [...prev, detalle];
            }

            return prev.map((item) =>
                item.tempId === existe.tempId
                    ? { ...item, cantidad: Number(item.cantidad ?? 0) + cantidad }
                    : item
            );
        });

        setTimeout(() => inputProductoRef.current?.focus(), 120);
    };

    const cargarLotes = async (detalle, busqueda = "") => {
        if (!detalle?.idProducto) return;

        if (!form.idTipoDocumento || !form.idBodega) {
            toast.warning("Debe seleccionar tipo de ajuste y bodega.");
            return;
        }

        setCargandoLotes(true);

        try {
            const params = new URLSearchParams();
            params.set("idProducto", detalle.idProducto);
            params.set("idBodega", form.idBodega);
            params.set("idTipoDocumento", form.idTipoDocumento);
            params.set("limite", 100);
            params.set("t", Date.now());

            if (form.idUbicacion) {
                params.set("idUbicacion", form.idUbicacion);
            }

            if (busqueda.trim()) {
                params.set("q", busqueda.trim());
            }

            const respuesta = await fetch(
                `${API_BASE_AJUSTES}InventarioAjustesLotesDisponibles.php?${params.toString()}`,
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
                throw new Error(texto || "Respuesta no válida del servicio.");
            }

            if (!respuesta.ok || !respuestaExitosa(resultado)) {
                throw new Error(
                    resultado?.mensaje ||
                        resultado?.error ||
                        "No fue posible consultar los lotes."
                );
            }

            setModalLotes((prev) => ({
                ...prev,
                lotes: Array.isArray(resultado?.data) ? resultado.data : [],
            }));
        } catch (error) {
            console.error("Error cargando lotes:", error);
            toast.error(error?.message || "No fue posible cargar lotes.");
        } finally {
            setCargandoLotes(false);
        }
    };

    const abrirLotes = (detalle, pendiente = false) => {
        if (soloLectura) {
            toast.info("Este ajuste está en modo solo lectura.");
            return;
        }

        if (!detalle?.manejaLote) {
            toast.info("Este producto no requiere lote.");
            return;
        }

        const existeEnLista = detalles.some((item) => item.tempId === detalle.tempId);

        setModalLotes({
            visible: true,
            detalleId: pendiente || !existeEnLista
                ? "__PENDIENTE_LOTE__"
                : detalle.tempId,
            lotes: [],
            busqueda: "",
        });

        if (pendiente || !existeEnLista) {
            setDetallePendienteLote(detalle);
        }

        cargarLotes(detalle, "");
    };

    const cerrarLotes = () => {
        const eraPendiente = modalLotes.detalleId === "__PENDIENTE_LOTE__";

        setModalLotes({
            visible: false,
            detalleId: null,
            lotes: [],
            busqueda: "",
        });

        if (eraPendiente) {
            setDetallePendienteLote(null);
        }

        setTimeout(() => inputProductoRef.current?.focus(), 120);
    };

    const seleccionarLote = (lote) => {
        if (!detalleActivoLotes) return;

        const cantidad = Number(detalleActivoLotes.cantidad ?? 0);
        const disponible = Number(lote?.cantidadDisponible ?? 0);

        if (esNegativo && disponible <= 0) {
            toast.warning("Este lote no tiene existencia disponible.");
            return;
        }

        if (esNegativo && cantidad > disponible) {
            toast.warning(
                `La cantidad solicitada (${formatearNumero(
                    cantidad
                )}) supera la existencia disponible (${formatearNumero(disponible)}).`
            );
            return;
        }

        const detalleConLote = {
            ...detalleActivoLotes,
            idLote: obtenerIdLote(lote),
            lote,
            fechaVencimiento: lote?.fechaVencimiento || null,
            cantidadDisponible: disponible,
        };

        if (modalLotes.detalleId === "__PENDIENTE_LOTE__") {
            setDetalles((prev) => [...prev, detalleConLote]);
            setDetallePendienteLote(null);
            toast.success("Producto agregado con lote seleccionado.");
        } else {
            setDetalles((prev) =>
                prev.map((item) =>
                    item.tempId === detalleActivoLotes.tempId ? detalleConLote : item
                )
            );
            toast.success("Lote actualizado.");
        }

        setModalLotes({
            visible: false,
            detalleId: null,
            lotes: [],
            busqueda: "",
        });

        setTimeout(() => inputProductoRef.current?.focus(), 120);
    };

    const actualizarDetalle = (tempId, cambios) => {
        if (soloLectura) return;

        setDetalles((prev) =>
            prev.map((item) =>
                item.tempId === tempId ? { ...item, ...cambios } : item
            )
        );
    };

    const validarFormulario = () => {
        if (!usuarioSesion?.idUsuario) {
            toast.error("No se pudo identificar el usuario de la sesión.");
            return false;
        }

        if (!form.idTipoDocumento) {
            toast.warning("Debe seleccionar el tipo de ajuste.");
            return false;
        }

        if (!tipoAjuste) {
            toast.warning("No se pudo determinar si el ajuste es positivo o negativo.");
            return false;
        }

        if (!form.fechaDocumento) {
            toast.warning("Debe seleccionar la fecha.");
            return false;
        }

        if (!form.idBodega) {
            toast.warning("Debe seleccionar la bodega.");
            return false;
        }

        if (detalles.length === 0) {
            toast.warning("Debe agregar al menos un producto.");
            return false;
        }

        for (const detalle of detalles) {
            const cantidad = Number(detalle.cantidad ?? 0);

            if (cantidad <= 0) {
                toast.warning(
                    `La cantidad de ${detalle.descripcion} debe ser mayor a cero.`
                );
                return false;
            }

            if (detalle.manejaLote && !Number(detalle.idLote || 0)) {
                toast.warning(`Debe seleccionar un lote para ${detalle.descripcion}.`);
                abrirLotes(detalle, false);
                return false;
            }

            if (
                esNegativo &&
                detalle.idLote &&
                detalle.cantidadDisponible !== null &&
                cantidad > Number(detalle.cantidadDisponible)
            ) {
                toast.warning(
                    `La cantidad de ${detalle.descripcion} supera la existencia disponible.`
                );
                return false;
            }
        }

        return true;
    };

    const construirPayload = () => ({
        idDocumento: modoEdicion ? idDocumento : undefined,
        idAjuste: modoEdicion ? idDocumento : undefined,
        idUsuario: usuarioSesion.idUsuario,
        idUsuarioRegistro: usuarioSesion.idUsuario,
        idOperador: operador?.idOperador || undefined,
        idTipoDocumento: Number(form.idTipoDocumento),
        fechaDocumento: form.fechaDocumento,
        idBodega: Number(form.idBodega),
        idUbicacion: form.idUbicacion ? Number(form.idUbicacion) : null,
        observacion: form.observacion,
        detalles: detalles.map((detalle) => ({
            idProducto: Number(detalle.idProducto),
            cantidad: Number(detalle.cantidad),
            cantidadSolicitada: Number(detalle.cantidad),
            unidad: detalle.unidad || "UND",
            idLote: detalle.idLote ? Number(detalle.idLote) : null,
            observacion: detalle.observacion || "",
        })),
    });

    const guardarAjuste = async ({ retornar = true, mostrarToast = true } = {}) => {
        if (soloLectura) {
            toast.info("Este ajuste está en modo solo lectura.");
            return null;
        }

        if (!validarFormulario()) return null;

        setGuardando(true);

        try {
            const respuesta = await fetch(
                `${API_BASE_AJUSTES}InventarioAjustesGuardar.php`,
                {
                    method: "POST",
                    cache: "no-store",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify(construirPayload()),
                }
            );

            const texto = await respuesta.text();
            let resultado;

            try {
                resultado = JSON.parse(texto);
            } catch {
                throw new Error(texto || "Respuesta no válida del servicio.");
            }

            if (!respuesta.ok || !respuestaExitosa(resultado)) {
                throw new Error(
                    resultado?.mensaje ||
                        resultado?.error ||
                        "No fue posible guardar el ajuste."
                );
            }

            const idGuardado = Number(
                resultado?.data?.idDocumento ??
                    resultado?.data?.idAjuste ??
                    resultado?.idDocumento ??
                    resultado?.idAjuste ??
                    0
            );

            if (mostrarToast) {
                toast.success(resultado?.mensaje || "Ajuste guardado correctamente.");
            }

            limpiarDocumentosLocales();

            if (retornar) {
                estadoPagina("AjustesInventario");
            }

            return {
                idDocumento: idGuardado,
                resultado,
            };
        } catch (error) {
            console.error("Error guardando ajuste:", error);
            toast.error(error?.message || "No fue posible guardar el ajuste.");
            return null;
        } finally {
            setGuardando(false);
        }
    };

    const finalizarAjuste = async () => {
        if (soloLectura) {
            toast.info("Este ajuste está en modo solo lectura.");
            return;
        }

        if (!validarFormulario()) return;

        setModalFinalizar(false);
        setFinalizando(true);

        try {
            const guardado = await guardarAjuste({
                retornar: false,
                mostrarToast: false,
            });

            if (!guardado?.idDocumento) {
                setFinalizando(false);
                return;
            }

            const respuesta = await fetch(
                `${API_BASE_AJUSTES}InventarioAjustesFinalizar.php`,
                {
                    method: "POST",
                    cache: "no-store",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify({
                        idDocumento: guardado.idDocumento,
                        idAjuste: guardado.idDocumento,
                        idUsuario: usuarioSesion.idUsuario,
                        idUsuarioFinaliza: usuarioSesion.idUsuario,
                        idOperador: operador?.idOperador || undefined,
                    }),
                }
            );

            const texto = await respuesta.text();
            let resultado;

            try {
                resultado = JSON.parse(texto);
            } catch {
                throw new Error(texto || "Respuesta no válida del servicio.");
            }

            if (!respuesta.ok || !respuestaExitosa(resultado)) {
                throw new Error(
                    resultado?.mensaje ||
                        resultado?.error ||
                        "No fue posible finalizar el ajuste."
                );
            }

            toast.success(resultado?.mensaje || "Ajuste finalizado correctamente.");
            limpiarDocumentosLocales();
            estadoPagina("AjustesInventario");
        } catch (error) {
            console.error("Error finalizando ajuste:", error);
            toast.error(error?.message || "No fue posible finalizar el ajuste.");
        } finally {
            setFinalizando(false);
        }
    };

    const claseTipo = esPositivo
        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
        : esNegativo
        ? "bg-rose-50 text-rose-700 border-rose-200"
        : "bg-slate-50 text-slate-600 border-slate-200";

    const iconoTipo = esPositivo ? <FaArrowUp /> : esNegativo ? <FaArrowDown /> : <FaClipboardList />;

    const cargandoVista = cargando || cargandoDocumento;

    return (
        <>
            <div className="w-full h-screen flex flex-col p-2 md:p-4 gap-4 bg-slate-100">
                <article className="flex-1 bg-white shadow-lg rounded-2xl flex flex-col overflow-hidden border border-slate-200">
                    <header className="px-4 py-3 md:px-5 border-b border-slate-200 bg-white">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={abrirMenu}
                                    className="lg:hidden w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-50 transition"
                                    aria-label="Abrir menú"
                                >
                                    <IoMenu className="text-xl" />
                                </button>

                                <button
                                    type="button"
                                    onClick={volver}
                                    className="hidden md:flex w-9 h-9 rounded-xl border border-slate-200 bg-white items-center justify-center text-slate-700 hover:bg-slate-50 transition"
                                    title="Volver"
                                >
                                    <FaArrowLeft />
                                </button>

                                <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                                    <FaClipboardList className="text-lg text-indigo-700" />
                                </div>

                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-700">
                                        Operación de inventarios
                                    </p>

                                    <h1 className="mt-0.5 text-xl md:text-2xl font-bold text-slate-900">
                                        {tituloPantalla}
                                    </h1>

                                    {soloLectura && (
                                        <div className="mt-1 inline-flex items-center gap-2 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-[11px] font-bold text-slate-600">
                                            <FaEye />
                                            Solo lectura
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={volver}
                                    className="h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-50 transition"
                                >
                                    <FaArrowLeft />
                                    Volver
                                </button>

                                {!soloLectura && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => guardarAjuste()}
                                            disabled={guardando || finalizando || cargandoVista}
                                            className="h-10 px-4 rounded-xl bg-blue-800 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-blue-900 disabled:opacity-60 transition shadow-sm"
                                        >
                                            {guardando ? (
                                                <FaSyncAlt className="animate-spin" />
                                            ) : (
                                                <FaSave />
                                            )}
                                            {modoEdicion ? "Actualizar borrador" : "Guardar borrador"}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setModalFinalizar(true)}
                                            disabled={
                                                guardando ||
                                                finalizando ||
                                                cargandoVista ||
                                                detalles.length === 0
                                            }
                                            className="h-10 px-4 rounded-xl bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-800 disabled:opacity-60 transition shadow-sm"
                                        >
                                            {finalizando ? (
                                                <FaSyncAlt className="animate-spin" />
                                            ) : (
                                                <FaCheckCircle />
                                            )}
                                            Finalizar
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto">
                        <div className="p-3 md:p-4">
                            {cargandoVista ? (
                                <div className="min-h-[420px] flex flex-col items-center justify-center gap-4">
                                    <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />
                                    <p className="text-sm font-medium text-slate-500">
                                        Cargando ajuste...
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-4 items-start">
                                    <aside className="space-y-4 xl:sticky xl:top-0">
                                        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                                                <h2 className="font-bold text-slate-900 text-sm">
                                                    Datos del ajuste
                                                </h2>
                                                <p className="text-xs text-slate-500">
                                                    Tipo, bodega y motivo.
                                                </p>
                                            </div>

                                            <div className="p-4 space-y-3">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">
                                                        Tipo de ajuste
                                                    </label>

                                                    <select
                                                        value={form.idTipoDocumento}
                                                        onChange={(event) =>
                                                            cambiarForm(
                                                                "idTipoDocumento",
                                                                event.target.value
                                                            )
                                                        }
                                                        disabled={soloLectura}
                                                        className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 disabled:bg-slate-100 disabled:text-slate-500 transition"
                                                    >
                                                        <option value="">Seleccione</option>
                                                        {tiposDocumento.map((tipo) => (
                                                            <option
                                                                key={tipo.idTipoDocumento || tipo.id}
                                                                value={tipo.idTipoDocumento || tipo.id}
                                                            >
                                                                {tipo.nombre}
                                                            </option>
                                                        ))}
                                                    </select>

                                                    <div className={`mt-2 rounded-xl border px-3 py-2 text-xs font-bold flex items-center gap-2 ${claseTipo}`}>
                                                        {iconoTipo}
                                                        {esPositivo
                                                            ? "Positivo: suma inventario"
                                                            : esNegativo
                                                            ? "Negativo: descuenta inventario"
                                                            : "Seleccione un tipo de ajuste"}
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">
                                                        Fecha
                                                    </label>
                                                    <input
                                                        type="date"
                                                        value={form.fechaDocumento}
                                                        onChange={(event) =>
                                                            cambiarForm(
                                                                "fechaDocumento",
                                                                event.target.value
                                                            )
                                                        }
                                                        disabled={soloLectura}
                                                        className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 disabled:bg-slate-100 disabled:text-slate-500 transition"
                                                    />
                                                </div>

                                                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-3 space-y-3">
                                                    <p className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-2">
                                                        <FaWarehouse />
                                                        Bodega del ajuste
                                                    </p>

                                                    <select
                                                        value={form.idBodega}
                                                        onChange={(event) =>
                                                            cambiarForm("idBodega", event.target.value)
                                                        }
                                                        disabled={soloLectura}
                                                        className="w-full h-10 px-3 rounded-xl border border-indigo-200 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 disabled:bg-slate-100 disabled:text-slate-500 transition"
                                                    >
                                                        <option value="">Seleccione bodega</option>
                                                        {bodegas.map((bodega) => (
                                                            <option
                                                                key={bodega.idBodega || bodega.id}
                                                                value={bodega.idBodega || bodega.id}
                                                            >
                                                                {bodega.nombre}
                                                            </option>
                                                        ))}
                                                    </select>

                                                    <select
                                                        value={form.idUbicacion}
                                                        onChange={(event) =>
                                                            cambiarForm(
                                                                "idUbicacion",
                                                                event.target.value
                                                            )
                                                        }
                                                        disabled={soloLectura}
                                                        className="w-full h-10 px-3 rounded-xl border border-indigo-200 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 disabled:bg-slate-100 disabled:text-slate-500 transition"
                                                    >
                                                        <option value="">Sin ubicación específica</option>
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
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">
                                                        Observación / motivo
                                                    </label>
                                                    <textarea
                                                        value={form.observacion}
                                                        onChange={(event) =>
                                                            cambiarForm("observacion", event.target.value)
                                                        }
                                                        disabled={soloLectura}
                                                        rows={3}
                                                        placeholder="Ej: sobrante, faltante, merma, deterioro, vencimiento..."
                                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 disabled:bg-slate-100 disabled:text-slate-500 transition resize-none"
                                                    />
                                                </div>

                                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                        Operador
                                                    </p>
                                                    <p className="mt-1 text-sm font-bold text-slate-900">
                                                        {operador?.nombreCompleto ||
                                                            operador?.nombre ||
                                                            usuarioSesion?.nombre ||
                                                            "No identificado"}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {operador?.codigo ||
                                                            operador?.cargo ||
                                                            "Operador de inventario"}
                                                    </p>
                                                </div>

                                                {!operador && (
                                                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                                                        <p className="text-xs text-amber-800 leading-5 flex gap-2">
                                                            <FaExclamationTriangle className="mt-0.5 shrink-0" />
                                                            No se encontró un operador activo asociado al usuario.
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                                                    <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                                                        Resumen
                                                    </p>
                                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                                        <div>
                                                            <p className="text-xs text-indigo-700">Productos</p>
                                                            <p className="text-lg font-bold text-indigo-900">
                                                                {detalles.length}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <p className="text-xs text-indigo-700">Cantidad</p>
                                                            <p className="text-lg font-bold text-indigo-900">
                                                                {formatearNumero(totalCantidad)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {!soloLectura && (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => guardarAjuste()}
                                                            disabled={guardando || finalizando}
                                                            className="w-full h-10 rounded-xl bg-blue-800 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-blue-900 disabled:opacity-60 transition shadow-sm"
                                                        >
                                                            {guardando ? (
                                                                <FaSyncAlt className="animate-spin" />
                                                            ) : (
                                                                <FaSave />
                                                            )}
                                                            {modoEdicion
                                                                ? "Actualizar borrador"
                                                                : "Guardar borrador"}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => setModalFinalizar(true)}
                                                            disabled={
                                                                guardando ||
                                                                finalizando ||
                                                                detalles.length === 0
                                                            }
                                                            className="w-full h-10 rounded-xl bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-800 disabled:opacity-60 transition shadow-sm"
                                                        >
                                                            {finalizando ? (
                                                                <FaSyncAlt className="animate-spin" />
                                                            ) : (
                                                                <FaCheckCircle />
                                                            )}
                                                            Guardar y finalizar
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </section>
                                    </aside>

                                    <div className="space-y-4">
                                        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                                                <div>
                                                    <h2 className="font-bold text-slate-900 text-sm">
                                                        Productos del ajuste
                                                    </h2>
                                                    <p className="text-xs text-slate-500">
                                                        Busca por código, nombre o pistolea el código de barras.
                                                    </p>
                                                </div>
                                                <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[11px] font-bold w-fit ${claseTipo}`}>
                                                    {iconoTipo}
                                                    {esPositivo
                                                        ? "Suma inventario"
                                                        : esNegativo
                                                        ? "Descuenta inventario"
                                                        : "Seleccione tipo"}
                                                </div>
                                            </div>

                                            <div className="p-4 space-y-4">
                                                <div className="flex flex-col md:flex-row gap-2">
                                                    <div className="relative flex-1">
                                                        <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                                        <input
                                                            ref={inputProductoRef}
                                                            type="text"
                                                            value={busquedaProducto}
                                                            onChange={(event) =>
                                                                !soloLectura &&
                                                                setBusquedaProducto(event.target.value)
                                                            }
                                                            disabled={soloLectura}
                                                            onKeyDown={(event) => {
                                                                if (
                                                                    event.key === "Enter" &&
                                                                    !soloLectura
                                                                ) {
                                                                    event.preventDefault();
                                                                    buscarProducto();
                                                                }
                                                            }}
                                                            placeholder="Código, nombre o código de barras"
                                                            className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 disabled:bg-slate-100 disabled:text-slate-500 transition"
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={buscarProducto}
                                                        disabled={buscandoProducto || soloLectura}
                                                        className="h-10 px-4 rounded-xl bg-blue-800 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-blue-900 disabled:opacity-60 transition"
                                                    >
                                                        {buscandoProducto ? (
                                                            <FaSyncAlt className="animate-spin" />
                                                        ) : (
                                                            <FaSearch />
                                                        )}
                                                        Buscar
                                                    </button>
                                                </div>

                                                {detalles.length === 0 ? (
                                                    <div className="min-h-[220px] rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-center px-6">
                                                        <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center">
                                                            <FaBoxOpen className="text-2xl text-slate-500" />
                                                        </div>
                                                        <h3 className="mt-3 text-base font-bold text-slate-800">
                                                            No hay productos agregados
                                                        </h3>
                                                        <p className="mt-1 text-sm text-slate-500 max-w-md">
                                                            Agrega productos para registrar el ajuste.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                                                        <table className="w-full min-w-[1040px]">
                                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                                <tr>
                                                                    <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Producto</th>
                                                                    <th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">Cantidad</th>
                                                                    <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Unidad</th>
                                                                    <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Lote</th>
                                                                    <th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">Disponible</th>
                                                                    <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Observación</th>
                                                                    <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">Acción</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-slate-200">
                                                                {detalles.map((detalle) => (
                                                                    <tr key={detalle.tempId} className="hover:bg-slate-50 transition">
                                                                        <td className="px-3 py-3">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                                                                                    <FaBoxes />
                                                                                </div>
                                                                                <div className="min-w-0">
                                                                                    <p className="font-semibold text-sm text-slate-900 truncate max-w-[260px]">
                                                                                        {detalle.descripcion}
                                                                                    </p>
                                                                                    <p className="text-xs text-slate-500">
                                                                                        {detalle.codigo || `ID ${detalle.idProducto}`}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        </td>
                                                                        <td className="px-3 py-3 text-center">
                                                                            <input
                                                                                type="number"
                                                                                min="0"
                                                                                step="0.001"
                                                                                value={detalle.cantidad}
                                                                                onChange={(event) =>
                                                                                    actualizarDetalle(detalle.tempId, {
                                                                                        cantidad: event.target.value,
                                                                                    })
                                                                                }
                                                                                disabled={soloLectura}
                                                                                onKeyDown={(event) => {
                                                                                    if (
                                                                                        event.key === "Enter" &&
                                                                                        detalle.manejaLote &&
                                                                                        !soloLectura
                                                                                    ) {
                                                                                        event.preventDefault();
                                                                                        abrirLotes(detalle, false);
                                                                                    }
                                                                                }}
                                                                                className="w-24 h-9 text-center rounded-xl border border-slate-300 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 disabled:bg-slate-100 disabled:text-slate-500 transition"
                                                                            />
                                                                        </td>
                                                                        <td className="px-3 py-3">
                                                                            <span className="inline-flex px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                                                                                {detalle.unidad || "UND"}
                                                                            </span>
                                                                        </td>
                                                                        <td className="px-3 py-3">
                                                                            {detalle.manejaLote ? (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => abrirLotes(detalle, false)}
                                                                                    disabled={soloLectura}
                                                                                    className={`min-w-[150px] h-9 px-3 rounded-xl border font-semibold text-xs flex items-center justify-center gap-2 transition disabled:opacity-70 ${
                                                                                        detalle.idLote
                                                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                                                                            : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                                                                    }`}
                                                                                >
                                                                                    {detalle.idLote ? (
                                                                                        <FaCheckCircle />
                                                                                    ) : (
                                                                                        <FaExclamationTriangle />
                                                                                    )}
                                                                                    {detalle.idLote
                                                                                        ? detalle.lote?.lote || "Lote seleccionado"
                                                                                        : "Seleccionar lote"}
                                                                                </button>
                                                                            ) : (
                                                                                <span className="inline-flex px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold">
                                                                                    No requiere lote
                                                                                </span>
                                                                            )}
                                                                            {detalle.fechaVencimiento && (
                                                                                <p className="mt-1 text-[11px] text-slate-500">
                                                                                    Vence: {detalle.fechaVencimiento}
                                                                                </p>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-3 py-3 text-center">
                                                                            {detalle.cantidadDisponible !== null ? (
                                                                                <span className="inline-flex px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                                                                                    {formatearNumero(detalle.cantidadDisponible)}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-xs text-slate-400">
                                                                                    {esNegativo ? "Sin validar" : "No aplica"}
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-3 py-3">
                                                                            <input
                                                                                type="text"
                                                                                value={detalle.observacion}
                                                                                onChange={(event) =>
                                                                                    actualizarDetalle(detalle.tempId, {
                                                                                        observacion: event.target.value,
                                                                                    })
                                                                                }
                                                                                disabled={soloLectura}
                                                                                placeholder="Opcional"
                                                                                className="w-full h-9 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 disabled:bg-slate-100 disabled:text-slate-500 transition"
                                                                            />
                                                                        </td>
                                                                        <td className="px-3 py-3">
                                                                            <div className="flex justify-end">
                                                                                {!soloLectura && (
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
                                                                                        className="w-9 h-9 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 flex items-center justify-center hover:bg-rose-100 transition"
                                                                                        title="Eliminar producto"
                                                                                    >
                                                                                        <FaTrash />
                                                                                    </button>
                                                                                )}
                                                                            </div>
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
                    </div>
                </article>
            </div>

            {modalCantidad.visible && modalCantidad.producto && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6">
                    <button
                        type="button"
                        aria-label="Cerrar modal"
                        onClick={cerrarCantidad}
                        className="absolute inset-0 bg-slate-950/60"
                    />
                    <section className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <header className="px-5 py-4 border-b border-slate-200 bg-white flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">
                                    Cantidad del ajuste
                                </p>
                                <h2 className="mt-1 text-lg font-bold text-slate-900">
                                    Agregar producto
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={cerrarCantidad}
                                className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 transition"
                            >
                                <FaTimes />
                            </button>
                        </header>

                        <div className="p-5 space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-sm font-bold text-slate-900">
                                    {productoDescripcion(modalCantidad.producto)}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    Código: {modalCantidad.producto?.codigo || "N/A"}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Cantidad
                                </label>
                                <input
                                    ref={inputCantidadRef}
                                    type="number"
                                    min="0"
                                    step="0.001"
                                    value={modalCantidad.cantidad}
                                    onChange={(event) =>
                                        setModalCantidad((prev) => ({
                                            ...prev,
                                            cantidad: event.target.value,
                                        }))
                                    }
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            confirmarCantidad();
                                        }
                                    }}
                                    className="w-full h-12 px-4 text-center rounded-xl border border-slate-300 bg-white text-lg font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                />
                            </div>
                        </div>

                        <footer className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                            <button
                                type="button"
                                onClick={cerrarCantidad}
                                className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-100 transition"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={confirmarCantidad}
                                className="h-10 px-5 rounded-xl bg-blue-800 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-blue-900 transition"
                            >
                                <FaPlus />
                                Continuar
                            </button>
                        </footer>
                    </section>
                </div>
            )}

            {modalProductos.visible && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6">
                    <button
                        type="button"
                        aria-label="Cerrar modal"
                        onClick={() =>
                            setModalProductos({
                                visible: false,
                                resultados: [],
                                busqueda: "",
                            })
                        }
                        className="absolute inset-0 bg-slate-950/60"
                    />
                    <section className="relative w-full max-w-4xl max-h-[88vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
                        <header className="px-5 py-5 border-b border-slate-200 bg-white flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                                    Selección de producto
                                </p>
                                <h2 className="mt-1 text-xl font-bold text-slate-900">
                                    Resultados para “{modalProductos.busqueda}”
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() =>
                                    setModalProductos({
                                        visible: false,
                                        resultados: [],
                                        busqueda: "",
                                    })
                                }
                                className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 transition"
                            >
                                <FaTimes />
                            </button>
                        </header>
                        <div className="flex-1 overflow-y-auto p-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {modalProductos.resultados.map((producto) => (
                                    <button
                                        type="button"
                                        key={producto.idProducto || producto.id}
                                        onClick={() => abrirCantidad(producto)}
                                        className="text-left rounded-2xl border border-slate-200 bg-white p-4 hover:border-blue-300 hover:bg-blue-50 transition"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-800 shrink-0">
                                                <FaBoxes />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900">
                                                    {productoDescripcion(producto)}
                                                </h3>
                                                <p className="mt-1 text-sm text-slate-500">
                                                    Código: {producto.codigo || "N/A"}
                                                </p>
                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <span className="inline-flex px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                                                        {producto.unidadBaseInventario || "UND"}
                                                    </span>
                                                    {Number(producto.manejaLote) === 1 && (
                                                        <span className="inline-flex px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                                                            Maneja lote
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {modalLotes.visible && detalleActivoLotes && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6">
                    <button
                        type="button"
                        aria-label="Cerrar modal"
                        onClick={cerrarLotes}
                        className="absolute inset-0 bg-slate-950/60"
                    />
                    <section className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
                        <header className="px-5 py-5 border-b border-slate-200 bg-white flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                                    Selección de lote
                                </p>
                                <h2 className="mt-1 text-xl font-bold text-slate-900">
                                    {detalleActivoLotes.descripcion}
                                </h2>
                                <p className="text-sm text-slate-500">
                                    {esNegativo
                                        ? "Selecciona un lote con existencia disponible."
                                        : "Selecciona el lote al que se sumará el ajuste."}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={cerrarLotes}
                                disabled={cargandoLotes}
                                className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 disabled:opacity-60 transition"
                            >
                                <FaTimes />
                            </button>
                        </header>

                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            <div className="flex flex-col md:flex-row gap-3">
                                <div className="relative flex-1">
                                    <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={modalLotes.busqueda}
                                        onChange={(event) =>
                                            setModalLotes((prev) => ({
                                                ...prev,
                                                busqueda: event.target.value,
                                            }))
                                        }
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter") {
                                                event.preventDefault();
                                                cargarLotes(
                                                    detalleActivoLotes,
                                                    modalLotes.busqueda
                                                );
                                            }
                                        }}
                                        placeholder="Buscar lote"
                                        className="w-full h-11 pl-11 pr-4 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() =>
                                        cargarLotes(
                                            detalleActivoLotes,
                                            modalLotes.busqueda
                                        )
                                    }
                                    disabled={cargandoLotes}
                                    className="h-11 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold flex items-center justify-center gap-2 hover:bg-slate-50 disabled:opacity-60 transition"
                                >
                                    {cargandoLotes ? (
                                        <FaSyncAlt className="animate-spin" />
                                    ) : (
                                        <FaSearch />
                                    )}
                                    Buscar
                                </button>
                            </div>

                            {cargandoLotes ? (
                                <div className="min-h-[260px] flex flex-col items-center justify-center gap-4">
                                    <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />
                                    <p className="text-sm font-medium text-slate-500">
                                        Cargando lotes...
                                    </p>
                                </div>
                            ) : modalLotes.lotes.length === 0 ? (
                                <div className="min-h-[260px] rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-center px-6">
                                    <FaBarcode className="text-3xl text-slate-400" />
                                    <h3 className="mt-4 font-bold text-slate-800">
                                        No hay lotes para mostrar
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-500">
                                        {esNegativo
                                            ? "No se encontraron lotes con existencia disponible."
                                            : "No se encontraron lotes activos para este producto."}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {modalLotes.lotes.map((lote) => {
                                        const disponible = Number(
                                            lote.cantidadDisponible ?? 0
                                        );
                                        const cantidad = Number(
                                            detalleActivoLotes.cantidad ?? 0
                                        );
                                        const bloqueado =
                                            esNegativo &&
                                            (disponible <= 0 || cantidad > disponible);

                                        return (
                                            <button
                                                type="button"
                                                key={lote.idLote || lote.id}
                                                onClick={() => seleccionarLote(lote)}
                                                disabled={bloqueado}
                                                className={`w-full text-left rounded-2xl border p-4 transition ${
                                                    bloqueado
                                                        ? "border-slate-200 bg-slate-50 opacity-70 cursor-not-allowed"
                                                        : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <h3 className="font-bold text-slate-900">
                                                            {lote.lote || "Sin lote"}
                                                        </h3>
                                                        <p className="mt-1 text-sm text-slate-500">
                                                            {lote.producto || lote.descripcion}
                                                        </p>
                                                        <p className="mt-1 text-xs text-slate-500">
                                                            Disponible actual:{" "}
                                                            {formatearNumero(disponible)}
                                                        </p>
                                                        {lote.fechaVencimiento && (
                                                            <p className="mt-1 text-xs text-slate-500">
                                                                Vence: {lote.fechaVencimiento}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <span
                                                        className={`inline-flex px-3 py-1.5 rounded-full border text-xs font-bold ${
                                                            bloqueado
                                                                ? "bg-slate-100 text-slate-500 border-slate-200"
                                                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                        }`}
                                                    >
                                                        {bloqueado ? "No disponible" : "Seleccionar"}
                                                    </span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            )}

            {modalFinalizar && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6">
                    <button
                        type="button"
                        aria-label="Cerrar modal"
                        onClick={() => setModalFinalizar(false)}
                        className="absolute inset-0 bg-slate-950/60"
                    />
                    <section className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <header className="px-5 py-4 border-b border-slate-200 bg-white flex items-start justify-between gap-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                                    Finalizar ajuste
                                </p>
                                <h2 className="mt-1 text-lg font-bold text-slate-900">
                                    Confirmar movimiento
                                </h2>
                            </div>
                            <button
                                type="button"
                                onClick={() => setModalFinalizar(false)}
                                className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 transition"
                            >
                                <FaTimes />
                            </button>
                        </header>

                        <div className="p-5 space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-sm text-slate-600 leading-6">
                                    Al finalizar, el sistema aplicará el ajuste al inventario. Si es positivo sumará existencias; si es negativo descontará existencias. Después no podrás editar este ajuste.
                                </p>
                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                                        <p className="text-xs text-slate-500">Productos</p>
                                        <p className="text-xl font-bold text-slate-900">
                                            {detalles.length}
                                        </p>
                                    </div>
                                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                                        <p className="text-xs text-slate-500">Cantidad</p>
                                        <p className="text-xl font-bold text-slate-900">
                                            {formatearNumero(totalCantidad)}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                                <p className="text-xs text-amber-800 leading-5 flex gap-2">
                                    <FaExclamationTriangle className="mt-0.5 shrink-0" />
                                    Si es ajuste negativo y no hay existencia suficiente, el servicio bloqueará la finalización.
                                </p>
                            </div>
                        </div>

                        <footer className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setModalFinalizar(false)}
                                className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-100 transition"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={finalizarAjuste}
                                disabled={guardando || finalizando}
                                className="h-10 px-5 rounded-xl bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-800 disabled:opacity-60 transition"
                            >
                                {guardando || finalizando ? (
                                    <FaSyncAlt className="animate-spin" />
                                ) : (
                                    <FaCheckCircle />
                                )}
                                Confirmar
                            </button>
                        </footer>
                    </section>
                </div>
            )}
        </>
    );
};
