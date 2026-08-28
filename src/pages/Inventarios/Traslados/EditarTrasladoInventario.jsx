import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaArrowLeft,
    FaBarcode,
    FaBoxes,
    FaBoxOpen,
    FaCheckCircle,
    FaExchangeAlt,
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

const API_BASE_TRASLADOS =
    "https://app.accionporcolombia.com/servicesPae/Inventario/Traslados/";

const API_BASE_PRODUCTOS =
    "https://app.accionporcolombia.com/servicesPae/Inventario/Productos/";

export const EditarTrasladoInventario = ({ setSidebar, navegar }) => {
    const abrirMenu = () => setSidebar(true);
    const estadoPagina = useCallback((pagina) => navegar(pagina), [navegar]);

    const inputProductoRef = useRef(null);
    const inputCantidadRef = useRef(null);

    const [cargando, setCargando] = useState(true);
    const [cargandoEdicion, setCargandoEdicion] = useState(false);
    const [edicionCargada, setEdicionCargada] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [finalizando, setFinalizando] = useState(false);
    const [buscandoProducto, setBuscandoProducto] = useState(false);
    const [cargandoLotes, setCargandoLotes] = useState(false);

    const [tiposDocumento, setTiposDocumento] = useState([]);
    const [bodegas, setBodegas] = useState([]);
    const [ubicaciones, setUbicaciones] = useState([]);
    const [operador, setOperador] = useState(null);
    const [trasladoEditar, setTrasladoEditar] = useState(null);

    const [form, setForm] = useState({
        idTipoDocumento: "",
        fechaDocumento: "",
        idBodegaOrigen: "",
        idUbicacionOrigen: "",
        idBodegaDestino: "",
        idUbicacionDestino: "",
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
        busqueda: "",
        lotes: [],
    });

    const [detallePendienteLote, setDetallePendienteLote] =
        useState(null);

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
                const posibleUsuario = usuario?.usuario || usuario?.user || usuario?.data || usuario;
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
                        nombre: posibleUsuario?.nombre ?? posibleUsuario?.nombreCompleto ?? "",
                        correo: posibleUsuario?.correo ?? "",
                    };
                }
            } catch {
                const idPlano = Number(valor);
                if (idPlano > 0) return { idUsuario: idPlano };
            }
        }

        return null;
    };

    const usuarioSesion = useMemo(() => obtenerUsuarioSesion(), []);

    const obtenerTrasladoEditarLocal = () => {
        const valor = localStorage.getItem("trasladoInventarioEditar");
        if (!valor) return null;
        try {
            return JSON.parse(valor);
        } catch {
            return null;
        }
    };

    useEffect(() => {
        const trasladoLocal = obtenerTrasladoEditarLocal();

        if (!trasladoLocal) {
            toast.warning(
                "No se encontró el traslado seleccionado para editar. Vuelve al listado y presiona Editar nuevamente."
            );

            estadoPagina("TrasladosInventario");
            return;
        }

        setTrasladoEditar(trasladoLocal);
    }, [estadoPagina]);

    const idDocumentoEdicion = useMemo(() => {
        return Number(
            trasladoEditar?.idDocumento ??
            trasladoEditar?.idTraslado ??
            trasladoEditar?.id ??
            0
        );
    }, [trasladoEditar]);

    const modoEdicion = idDocumentoEdicion > 0;

    const ubicacionesOrigen = useMemo(() => {
        const idBodega = Number(form.idBodegaOrigen || 0);
        return ubicaciones.filter((u) => Number(u?.idBodega || 0) === idBodega);
    }, [ubicaciones, form.idBodegaOrigen]);

    const ubicacionesDestino = useMemo(() => {
        const idBodega = Number(form.idBodegaDestino || 0);
        return ubicaciones.filter((u) => Number(u?.idBodega || 0) === idBodega);
    }, [ubicaciones, form.idBodegaDestino]);

    const origenDestinoIguales = useMemo(() => {
        const bo = Number(form.idBodegaOrigen || 0);
        const bd = Number(form.idBodegaDestino || 0);
        const uo = Number(form.idUbicacionOrigen || 0);
        const ud = Number(form.idUbicacionDestino || 0);

        return bo > 0 && bd > 0 && bo === bd && uo === ud;
    }, [form.idBodegaOrigen, form.idBodegaDestino, form.idUbicacionOrigen, form.idUbicacionDestino]);

    const totalCantidad = useMemo(() => {
        return detalles.reduce((total, item) => total + Number(item.cantidad || 0), 0);
    }, [detalles]);

    const detalleLoteActivo = useMemo(() => {
        if (!modalLotes.detalleId) return null;

        if (modalLotes.detalleId === "__PENDIENTE_LOTE__") {
            return detallePendienteLote;
        }

        return detalles.find((d) => d.tempId === modalLotes.detalleId) || null;
    }, [detalles, modalLotes.detalleId, detallePendienteLote]);

    const formatearNumero = (valor) => {
        return new Intl.NumberFormat("es-CO", {
            maximumFractionDigits: 3,
        }).format(Number(valor ?? 0));
    };

    const productoDescripcion = (producto) =>
        producto?.descripcion || producto?.nombre || producto?.producto || "Producto sin nombre";

    const generarTempId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const obtenerIdLote = (lote) => Number(lote?.idLote ?? lote?.id ?? 0);

    const normalizarFecha = (fecha) => {
        if (!fecha || fecha === "0000-00-00") return "";
        return String(fecha).substring(0, 10);
    };

    const esLoteVigente = (lote) => {
        const fecha = normalizarFecha(lote?.fechaVencimiento);
        if (!fecha) return true;
        return fecha >= new Date().toISOString().substring(0, 10);
    };

    const enfocarBusquedaProducto = (delay = 120) => {
        setTimeout(() => {
            inputProductoRef.current?.focus();
            inputProductoRef.current?.select?.();
        }, delay);
    };

    const limpiarLotesDetalle = () => {
        setDetalles((prev) => {
            const productosConLote = prev.filter(
                (item) => item.manejaLote
            ).length;

            if (productosConLote > 0) {
                setTimeout(() => {
                    toast.info(
                        "Se retiraron los productos que requerían lote porque cambió el origen. Debes agregarlos nuevamente seleccionando lote disponible."
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

    const cargarFormData = useCallback(async () => {
        setCargando(true);

        try {
            const params = new URLSearchParams();
            params.set("t", Date.now());
            if (usuarioSesion?.idUsuario) params.set("idUsuario", usuarioSesion.idUsuario);

            const respuesta = await fetch(
                `${API_BASE_TRASLADOS}InventarioTrasladosFormData.php?${params.toString()}`,
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
                    resultado?.mensaje ||
                    resultado?.error ||
                    "No fue posible consultar los datos del formulario."
                );
            }

            const data = resultado?.data || {};
            const tipos = Array.isArray(data?.tiposDocumento) ? data.tiposDocumento : [];
            const listaBodegas = Array.isArray(data?.bodegas) ? data.bodegas : [];
            const listaUbicaciones = Array.isArray(data?.ubicaciones) ? data.ubicaciones : [];

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
                    (tipos.length === 1 ? tipos[0]?.idTipoDocumento || tipos[0]?.id || "" : ""),
                idBodegaOrigen:
                    prev.idBodegaOrigen ||
                    (listaBodegas[0]?.idBodega || listaBodegas[0]?.id || ""),
            }));

            enfocarBusquedaProducto(250);
        } catch (error) {
            console.error("Error cargando form data:", error);
            toast.error(error?.message || "No fue posible cargar los datos del traslado.");
        } finally {
            setCargando(false);
        }
    }, [usuarioSesion?.idUsuario]);

    const cargarTrasladoEditar = useCallback(async () => {
        if (!idDocumentoEdicion) return;

        setCargandoEdicion(true);

        try {
            const params = new URLSearchParams();
            params.set("idDocumento", idDocumentoEdicion);
            params.set("t", Date.now());

            const respuesta = await fetch(
                `${API_BASE_TRASLADOS}InventarioTrasladosDetalle.php?${params.toString()}`,
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
                    resultado?.mensaje ||
                    resultado?.error ||
                    "No fue posible consultar el traslado para edición."
                );
            }

            const data = resultado?.data || {};
            const documento = data?.documento || data?.traslado || {};
            const estadoProceso = String(documento?.estadoProceso || "BORRADOR").toUpperCase();

            if (documento?.editable === false || estadoProceso !== "BORRADOR") {
                localStorage.removeItem("trasladoInventarioEditar");
                toast.warning("Este traslado ya fue finalizado y no se puede editar.");
                estadoPagina("TrasladosInventario");
                return;
            }

            const listaDetalles = Array.isArray(data?.detalles) ? data.detalles : [];

            const detallesMapeados = listaDetalles.map((detalle, index) => {
                const idLote = Number(detalle?.idLote ?? 0);

                return {
                    tempId: `edit-${detalle?.idDocumentoDetalle || index}-${Date.now()}`,
                    idDocumentoDetalle: detalle?.idDocumentoDetalle || null,
                    idProducto: Number(detalle?.idProducto ?? 0),
                    codigo: detalle?.codigoProducto || detalle?.codigo || "",
                    descripcion: detalle?.descripcion || detalle?.producto || "Producto sin nombre",
                    unidad: detalle?.unidad || "UND",
                    cantidad: detalle?.cantidad ?? detalle?.cantidadSolicitada ?? 0,
                    manejaLote: Number(detalle?.manejaLote ?? 0) === 1,
                    manejaVencimiento: Number(detalle?.manejaVencimiento ?? 0) === 1,
                    idLote: idLote || null,
                    lote: idLote
                        ? {
                            id: idLote,
                            idLote,
                            lote: detalle?.lote,
                            fechaFabricacion: detalle?.fechaFabricacion,
                            fechaVencimiento: detalle?.fechaVencimiento,
                            fechaIngreso: detalle?.fechaIngreso,
                            cantidadDisponible: detalle?.cantidadDisponible,
                            vencido: detalle?.vencido,
                        }
                        : null,
                    fechaVencimiento: detalle?.fechaVencimiento || null,
                    cantidadDisponible: detalle?.cantidadDisponible ?? null,
                    observacion: detalle?.observacion || "",
                };
            });

            setForm((prev) => ({
                ...prev,
                idTipoDocumento: documento?.idTipoDocumento || prev.idTipoDocumento,
                fechaDocumento: documento?.fechaDocumento || prev.fechaDocumento,
                idBodegaOrigen: documento?.idBodegaOrigen || prev.idBodegaOrigen,
                idUbicacionOrigen: documento?.idUbicacionOrigen || prev.idUbicacionOrigen,
                idBodegaDestino: documento?.idBodegaDestino || prev.idBodegaDestino,
                idUbicacionDestino: documento?.idUbicacionDestino || prev.idUbicacionDestino,
                observacion: documento?.observacion ?? prev.observacion,
            }));

            setDetalles(detallesMapeados);
            setTrasladoEditar(documento);
            setEdicionCargada(true);
            enfocarBusquedaProducto(250);
        } catch (error) {
            console.error("Error cargando traslado para edición:", error);
            toast.error(error?.message || "No fue posible cargar el traslado para edición.");
        } finally {
            setCargandoEdicion(false);
        }
    }, [idDocumentoEdicion, estadoPagina]);

    useEffect(() => {
        cargarFormData();
    }, [cargarFormData]);

    useEffect(() => {
        if (cargando || cargandoEdicion || edicionCargada || !idDocumentoEdicion) return;
        cargarTrasladoEditar();
    }, [cargando, cargandoEdicion, edicionCargada, idDocumentoEdicion, cargarTrasladoEditar]);

    useEffect(() => {
        const hayModal =
            modalProductos.visible ||
            modalCantidad.visible ||
            modalLotes.visible ||
            modalFinalizar;

        if (!hayModal) return undefined;

        const overflowAnterior = document.body.style.overflow;

        const cerrarConEscape = (event) => {
            if (event.key === "Escape") {
                cerrarModalProductos();
                cerrarModalCantidad();
                cerrarModalLotes();
                setModalFinalizar(false);
            }
        };

        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", cerrarConEscape);

        return () => {
            document.body.style.overflow = overflowAnterior;
            window.removeEventListener("keydown", cerrarConEscape);
        };
    }, [modalProductos.visible, modalCantidad.visible, modalLotes.visible, modalFinalizar]);

    useEffect(() => {
        if (!modalCantidad.visible) return;
        const timer = setTimeout(() => {
            inputCantidadRef.current?.focus();
            inputCantidadRef.current?.select();
        }, 120);
        return () => clearTimeout(timer);
    }, [modalCantidad.visible]);

    const cambiarForm = (campo, valor) => {
        setForm((prev) => {
            const siguiente = {
                ...prev,
                [campo]: valor,
            };

            if (campo === "idBodegaOrigen") {
                siguiente.idUbicacionOrigen = "";
            }

            if (campo === "idBodegaDestino") {
                siguiente.idUbicacionDestino = "";
            }

            return siguiente;
        });

        if (campo === "idBodegaOrigen" || campo === "idUbicacionOrigen") {
            limpiarLotesDetalle();
        }
    };

    const cerrarModalProductos = () => {
        setModalProductos({ visible: false, resultados: [], busqueda: "" });
    };

    const cerrarModalCantidad = (enfocar = true) => {
        setModalCantidad({ visible: false, producto: null, cantidad: "1" });
        if (enfocar) enfocarBusquedaProducto();
    };

    const cerrarModalLotes = (enfocar = true) => {
        if (cargandoLotes) return;

        const eraPendiente =
            modalLotes.detalleId === "__PENDIENTE_LOTE__";

        setModalLotes({
            visible: false,
            detalleId: null,
            busqueda: "",
            lotes: [],
        });

        if (eraPendiente) {
            setDetallePendienteLote(null);
        }

        if (enfocar) enfocarBusquedaProducto();
    };

    const buscarProducto = async () => {
        const busqueda = busquedaProducto.trim();

        if (!form.idTipoDocumento) {
            toast.warning("Debe seleccionar el tipo de traslado.");
            return;
        }

        if (!form.idBodegaOrigen) {
            toast.warning("Debe seleccionar la bodega origen.");
            return;
        }

        if (!form.idBodegaDestino) {
            toast.warning("Debe seleccionar la bodega destino.");
            return;
        }

        if (origenDestinoIguales) {
            toast.warning("El origen y el destino no pueden ser iguales.");
            return;
        }

        if (!busqueda) {
            toast.info("Digite o escanee un código, nombre o código de barras.");
            inputProductoRef.current?.focus();
            return;
        }

        setBuscandoProducto(true);

        try {
            const params = new URLSearchParams();
            params.set("q", busqueda);
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
                throw new Error(texto || "El servicio devolvió una respuesta no válida.");
            }

            if (!respuesta.ok || !respuestaExitosa(resultado)) {
                throw new Error(resultado?.mensaje || resultado?.error || "No fue posible buscar el producto.");
            }

            const productos = Array.isArray(resultado?.data) ? resultado.data : [];

            if (productos.length === 0) {
                toast.warning("No se encontró ningún producto con esa búsqueda.");
                return;
            }

            const exactos = productos.filter((p) => Number(p?.coincidenciaExacta ?? 0) === 1);

            if (exactos.length === 1) {
                abrirModalCantidadProducto(exactos[0]);
                return;
            }

            if (productos.length === 1) {
                abrirModalCantidadProducto(productos[0]);
                return;
            }

            setModalProductos({ visible: true, resultados: productos, busqueda });
        } catch (error) {
            console.error("Error buscando producto:", error);
            toast.error(error?.message || "No fue posible buscar el producto.");
        } finally {
            setBuscandoProducto(false);
        }
    };

    const abrirModalCantidadProducto = (producto) => {
        const idProducto = Number(producto?.idProducto ?? producto?.id ?? 0);

        if (!idProducto) {
            toast.error("No se encontró el identificador del producto.");
            return;
        }

        setModalProductos({ visible: false, resultados: [], busqueda: "" });
        setModalCantidad({ visible: true, producto, cantidad: "1" });
    };

    const agregarProductoDetalle = (producto, cantidadIngresada) => {
        const idProducto = Number(producto?.idProducto ?? producto?.id ?? 0);
        const cantidad = Number(String(cantidadIngresada).replace(",", "."));

        if (!idProducto) {
            toast.error("No se encontró el identificador del producto.");
            return null;
        }

        if (!cantidad || cantidad <= 0) {
            toast.warning("La cantidad debe ser mayor a cero.");
            return null;
        }

        const manejaLote = Number(producto?.manejaLote ?? 0) === 1;
        const manejaVencimiento =
            Number(producto?.manejaVencimiento ?? 0) === 1 ||
            Number(producto?.requiereFechaVencimiento ?? 0) === 1;

        const nuevoDetalle = {
            tempId: generarTempId(),
            idProducto,
            codigo: producto?.codigo || "",
            descripcion: productoDescripcion(producto),
            unidad: producto?.unidadBaseInventario || "UND",
            cantidad,
            manejaLote,
            manejaVencimiento,
            idLote: null,
            lote: null,
            fechaVencimiento: null,
            cantidadDisponible: null,
            observacion: "",
        };

        /*
            Regla importante de traslados:
            si el producto maneja lote, todavía NO se agrega a la tabla.
            Primero debe seleccionarse un lote disponible en origen.
            Si el usuario cierra el modal de lotes, el producto queda descartado.
        */
        if (manejaLote) {
            return {
                manejaLote: true,
                detalle: nuevoDetalle,
                pendienteLote: true,
            };
        }

        const existente = detalles.find(
            (item) => Number(item.idProducto) === idProducto
        );

        if (existente) {
            const nuevaCantidad =
                Number(existente.cantidad ?? 0) + cantidad;

            setDetalles((prev) =>
                prev.map((item) =>
                    item.tempId === existente.tempId
                        ? {
                            ...item,
                            cantidad: nuevaCantidad,
                        }
                        : item
                )
            );

            return {
                manejaLote: false,
                detalle: {
                    ...existente,
                    cantidad: nuevaCantidad,
                },
            };
        }

        setDetalles((prev) => [...prev, nuevoDetalle]);

        return {
            manejaLote: false,
            detalle: nuevoDetalle,
        };
    };

    const confirmarCantidadProducto = () => {
        const producto = modalCantidad.producto;
        const cantidad = Number(String(modalCantidad.cantidad).replace(",", "."));

        if (!producto) {
            toast.error("No se encontró el producto seleccionado.");
            return;
        }

        if (!cantidad || cantidad <= 0) {
            toast.warning("Ingrese una cantidad mayor a cero.");
            inputCantidadRef.current?.focus();
            inputCantidadRef.current?.select();
            return;
        }

        const agregado = agregarProductoDetalle(producto, cantidad);
        if (!agregado) return;

        setBusquedaProducto("");
        cerrarModalCantidad(false);

        if (agregado.manejaLote) {
            setDetallePendienteLote(agregado.detalle);

            setTimeout(() => abrirModalLotes(agregado.detalle), 140);
            return;
        }

        enfocarBusquedaProducto();
    };

    const actualizarDetalle = (tempId, cambios) => {
        setDetalles((prev) =>
            prev.map((item) =>
                item.tempId === tempId
                    ? {
                        ...item,
                        ...cambios,
                    }
                    : item
            )
        );
    };

    const eliminarDetalle = (tempId) => {
        setDetalles((prev) => prev.filter((item) => item.tempId !== tempId));
    };

    const abrirModalLotes = (detalle) => {
        if (!detalle?.manejaLote) {
            toast.info("Este producto no requiere lote.");
            return;
        }

        if (!form.idBodegaOrigen) {
            toast.warning("Debe seleccionar la bodega origen.");
            return;
        }

        const existeEnLista = detalles.some(
            (item) => item.tempId === detalle.tempId
        );

        if (!existeEnLista) {
            setDetallePendienteLote(detalle);
        }

        setModalLotes({
            visible: true,
            detalleId: existeEnLista
                ? detalle.tempId
                : "__PENDIENTE_LOTE__",
            busqueda: "",
            lotes: [],
        });

        cargarLotesProducto(detalle, "");
    };

    const cargarLotesProducto = async (detalle, busqueda = "") => {
        if (!detalle?.idProducto) return;

        if (!form.idTipoDocumento) {
            toast.warning("Debe seleccionar el tipo de traslado.");
            return;
        }

        if (!form.idBodegaOrigen) {
            toast.warning("Debe seleccionar la bodega origen.");
            return;
        }

        setCargandoLotes(true);

        try {
            const params = new URLSearchParams();
            params.set("idProducto", detalle.idProducto);
            params.set("idBodegaOrigen", form.idBodegaOrigen);
            params.set("idTipoDocumento", form.idTipoDocumento);
            params.set("limite", 100);
            params.set("t", Date.now());

            if (form.idUbicacionOrigen) params.set("idUbicacionOrigen", form.idUbicacionOrigen);
            if (busqueda.trim()) params.set("q", busqueda.trim());

            const respuesta = await fetch(
                `${API_BASE_TRASLADOS}InventarioTrasladosLotesDisponibles.php?${params.toString()}`,
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
                throw new Error(resultado?.mensaje || resultado?.error || "No fue posible consultar los lotes disponibles.");
            }

            const lotes = Array.isArray(resultado?.data) ? resultado.data : [];
            setModalLotes((prev) => ({ ...prev, lotes }));
        } catch (error) {
            console.error("Error cargando lotes:", error);
            toast.error(error?.message || "No fue posible cargar los lotes disponibles del producto.");
        } finally {
            setCargandoLotes(false);
        }
    };

    const seleccionarLote = (lote) => {
        if (!detalleLoteActivo) return;

        const disponible = Number(lote?.cantidadDisponible ?? 0);
        const cantidad = Number(detalleLoteActivo?.cantidad ?? 0);

        if (disponible <= 0) {
            toast.warning("Este lote no tiene existencia disponible.");
            return;
        }

        if (cantidad > disponible) {
            toast.warning(
                `La cantidad solicitada (${formatearNumero(cantidad)}) supera la existencia disponible (${formatearNumero(disponible)}).`
            );
            return;
        }

        const detalleConLote = {
            ...detalleLoteActivo,
            idLote: Number(lote?.idLote ?? lote?.id),
            lote,
            fechaVencimiento: lote?.fechaVencimiento,
            cantidadDisponible: disponible,
        };

        if (modalLotes.detalleId === "__PENDIENTE_LOTE__") {
            setDetalles((prev) => [...prev, detalleConLote]);
            setDetallePendienteLote(null);
            toast.success("Producto agregado con lote seleccionado.");
        } else {
            actualizarDetalle(detalleLoteActivo.tempId, {
                idLote: Number(lote?.idLote ?? lote?.id),
                lote,
                fechaVencimiento: lote?.fechaVencimiento,
                cantidadDisponible: disponible,
            });

            toast.success("Lote actualizado.");
        }

        cerrarModalLotes(true);
    };

    const validarFormulario = () => {
        if (!usuarioSesion?.idUsuario) {
            toast.error("No se pudo identificar el usuario de la sesión.");
            return false;
        }

        if (!form.idTipoDocumento) {
            toast.warning("Debe seleccionar el tipo de traslado.");
            return false;
        }

        if (!form.fechaDocumento) {
            toast.warning("Debe seleccionar la fecha del traslado.");
            return false;
        }

        if (!form.idBodegaOrigen) {
            toast.warning("Debe seleccionar la bodega origen.");
            return false;
        }

        if (!form.idBodegaDestino) {
            toast.warning("Debe seleccionar la bodega destino.");
            return false;
        }

        if (origenDestinoIguales) {
            toast.warning("El origen y el destino no pueden ser iguales.");
            return false;
        }

        if (detalles.length === 0) {
            toast.warning("Debe agregar al menos un producto.");
            inputProductoRef.current?.focus();
            return false;
        }

        for (const detalle of detalles) {
            const cantidad = Number(detalle.cantidad ?? 0);

            if (cantidad <= 0) {
                toast.warning(`La cantidad de ${detalle.descripcion} debe ser mayor a cero.`);
                return false;
            }

            if (detalle.manejaLote && !Number(detalle.idLote || 0)) {
                toast.warning(`Debe seleccionar un lote disponible para ${detalle.descripcion}.`);
                abrirModalLotes(detalle);
                return false;
            }

            if (
                detalle.idLote &&
                detalle.cantidadDisponible !== null &&
                cantidad > Number(detalle.cantidadDisponible)
            ) {
                toast.warning(`La cantidad de ${detalle.descripcion} supera la existencia disponible del lote seleccionado.`);
                return false;
            }
        }

        return true;
    };

    const construirPayload = () => ({
        idDocumento: modoEdicion ? idDocumentoEdicion : undefined,
        idTraslado: modoEdicion ? idDocumentoEdicion : undefined,
        idUsuarioRegistro: usuarioSesion.idUsuario,
        idUsuario: usuarioSesion.idUsuario,
        idOperador: operador?.idOperador || undefined,
        idTipoDocumento: Number(form.idTipoDocumento),
        fechaDocumento: form.fechaDocumento,
        idBodegaOrigen: Number(form.idBodegaOrigen),
        idUbicacionOrigen: form.idUbicacionOrigen ? Number(form.idUbicacionOrigen) : null,
        idBodegaDestino: Number(form.idBodegaDestino),
        idUbicacionDestino: form.idUbicacionDestino ? Number(form.idUbicacionDestino) : null,
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

    const guardarTraslado = async ({ retornar = true, mostrarToast = true } = {}) => {
        if (!validarFormulario()) return null;

        setGuardando(true);

        try {
            const respuesta = await fetch(`${API_BASE_TRASLADOS}InventarioTrasladosGuardar.php`, {
                method: "POST",
                cache: "no-store",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(construirPayload()),
            });

            const texto = await respuesta.text();
            let resultado;

            try {
                resultado = JSON.parse(texto);
            } catch {
                throw new Error(texto || "El servicio devolvió una respuesta no válida.");
            }

            if (!respuesta.ok || !respuestaExitosa(resultado)) {
                throw new Error(resultado?.mensaje || resultado?.error || "No fue posible guardar el traslado.");
            }

            const idGuardado = Number(
                resultado?.data?.idDocumento ??
                resultado?.data?.idTraslado ??
                resultado?.idDocumento ??
                resultado?.idTraslado ??
                0
            );

            if (mostrarToast) toast.success(resultado?.mensaje || "Traslado guardado correctamente.");

            localStorage.removeItem("trasladoInventarioEditar");
            localStorage.setItem("trasladoInventarioDetalle", JSON.stringify(resultado.data));

            if (retornar) estadoPagina("TrasladosInventario");

            return { idDocumento: idGuardado, resultado };
        } catch (error) {
            console.error("Error guardando traslado:", error);
            toast.error(error?.message || "No fue posible guardar el traslado.");
            return null;
        } finally {
            setGuardando(false);
        }
    };

    const finalizarTraslado = async () => {
        if (!validarFormulario()) return;

        setModalFinalizar(false);
        setFinalizando(true);

        try {
            const guardado = await guardarTraslado({ retornar: false, mostrarToast: false });

            if (!guardado?.idDocumento) {
                setFinalizando(false);
                return;
            }

            const respuesta = await fetch(`${API_BASE_TRASLADOS}InventarioTrasladosFinalizar.php`, {
                method: "POST",
                cache: "no-store",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    idDocumento: guardado.idDocumento,
                    idTraslado: guardado.idDocumento,
                    idUsuario: usuarioSesion.idUsuario,
                    idUsuarioFinaliza: usuarioSesion.idUsuario,
                    idOperador: operador?.idOperador || undefined,
                }),
            });

            const texto = await respuesta.text();
            let resultado;

            try {
                resultado = JSON.parse(texto);
            } catch {
                throw new Error(texto || "El servicio devolvió una respuesta no válida.");
            }

            if (!respuesta.ok || !respuestaExitosa(resultado)) {
                throw new Error(resultado?.mensaje || resultado?.error || "No fue posible finalizar el traslado.");
            }

            toast.success(resultado?.mensaje || "Traslado finalizado correctamente.");
            localStorage.removeItem("trasladoInventarioEditar");
            estadoPagina("TrasladosInventario");
        } catch (error) {
            console.error("Error finalizando traslado:", error);
            toast.error(error?.message || "No fue posible finalizar el traslado.");
        } finally {
            setFinalizando(false);
        }
    };

    const volver = () => {
        localStorage.removeItem("trasladoInventarioEditar");
        estadoPagina("TrasladosInventario");
    };

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

                                <div className="w-10 h-10 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0">
                                    <FaExchangeAlt className="text-lg text-violet-700" />
                                </div>

                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-700">
                                        Operación de inventarios
                                    </p>

                                    <h1 className="mt-0.5 text-xl md:text-2xl font-bold text-slate-900">
                                        {modoEdicion ? "Editar traslado" : "Nuevo traslado"}
                                    </h1>
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

                                <button
                                    type="button"
                                    onClick={() => guardarTraslado()}
                                    disabled={guardando || cargando || cargandoEdicion || finalizando}
                                    className="h-10 px-4 rounded-xl bg-blue-800 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-blue-900 disabled:opacity-60 transition shadow-sm"
                                >
                                    {guardando ? <FaSyncAlt className="animate-spin" /> : <FaSave />}
                                    {modoEdicion ? "Actualizar borrador" : "Guardar borrador"}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setModalFinalizar(true)}
                                    disabled={guardando || cargando || cargandoEdicion || finalizando || detalles.length === 0}
                                    className="h-10 px-4 rounded-xl bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-800 disabled:opacity-60 transition shadow-sm"
                                >
                                    {finalizando ? <FaSyncAlt className="animate-spin" /> : <FaCheckCircle />}
                                    Finalizar
                                </button>
                            </div>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto">
                        <div className="p-3 md:p-4">
                            {cargando || cargandoEdicion ? (
                                <div className="min-h-[420px] flex flex-col items-center justify-center gap-4">
                                    <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />

                                    <p className="text-sm font-medium text-slate-500">
                                        {cargandoEdicion ? "Cargando traslado..." : "Cargando formulario..."}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 xl:grid-cols-[340px_1fr] gap-4 items-start">
                                    <aside className="space-y-4 xl:sticky xl:top-0">
                                        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                                                <h2 className="font-bold text-slate-900 text-sm">
                                                    Datos del traslado
                                                </h2>

                                                <p className="text-xs text-slate-500">
                                                    Documento, origen y destino.
                                                </p>

                                                {modoEdicion && (
                                                    <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[11px] font-bold text-amber-700">
                                                        <FaExclamationTriangle />
                                                        Editando borrador
                                                    </div>
                                                )}
                                            </div>

                                            <div className="p-4 space-y-3">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">
                                                        Tipo de traslado
                                                    </label>

                                                    <select
                                                        value={form.idTipoDocumento}
                                                        onChange={(event) => cambiarForm("idTipoDocumento", event.target.value)}
                                                        className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
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
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">
                                                        Fecha traslado
                                                    </label>

                                                    <input
                                                        type="date"
                                                        value={form.fechaDocumento}
                                                        onChange={(event) => cambiarForm("fechaDocumento", event.target.value)}
                                                        className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                                    />
                                                </div>

                                                <div className="rounded-2xl border border-rose-100 bg-rose-50 p-3 space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <FaWarehouse className="text-rose-700" />
                                                        <p className="text-xs font-bold uppercase tracking-wider text-rose-700">
                                                            Origen
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-bold text-rose-700 mb-1">
                                                            Bodega origen
                                                        </label>

                                                        <select
                                                            value={form.idBodegaOrigen}
                                                            onChange={(event) => cambiarForm("idBodegaOrigen", event.target.value)}
                                                            className="w-full h-10 px-3 rounded-xl border border-rose-200 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-400 transition"
                                                        >
                                                            <option value="">Seleccione</option>

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
                                                        <label className="block text-xs font-bold text-rose-700 mb-1">
                                                            Ubicación origen
                                                        </label>

                                                        <select
                                                            value={form.idUbicacionOrigen}
                                                            onChange={(event) => cambiarForm("idUbicacionOrigen", event.target.value)}
                                                            className="w-full h-10 px-3 rounded-xl border border-rose-200 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-rose-100 focus:border-rose-400 transition"
                                                        >
                                                            <option value="">Sin ubicación específica</option>

                                                            {ubicacionesOrigen.map((ubicacion) => (
                                                                <option
                                                                    key={ubicacion.idUbicacion || ubicacion.id}
                                                                    value={ubicacion.idUbicacion || ubicacion.id}
                                                                >
                                                                    {ubicacion.nombre}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-3 space-y-3">
                                                    <div className="flex items-center gap-2">
                                                        <FaWarehouse className="text-emerald-700" />
                                                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                                                            Destino
                                                        </p>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-bold text-emerald-700 mb-1">
                                                            Bodega destino
                                                        </label>

                                                        <select
                                                            value={form.idBodegaDestino}
                                                            onChange={(event) => cambiarForm("idBodegaDestino", event.target.value)}
                                                            className="w-full h-10 px-3 rounded-xl border border-emerald-200 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 transition"
                                                        >
                                                            <option value="">Seleccione</option>

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
                                                        <label className="block text-xs font-bold text-emerald-700 mb-1">
                                                            Ubicación destino
                                                        </label>

                                                        <select
                                                            value={form.idUbicacionDestino}
                                                            onChange={(event) => cambiarForm("idUbicacionDestino", event.target.value)}
                                                            className="w-full h-10 px-3 rounded-xl border border-emerald-200 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 transition"
                                                        >
                                                            <option value="">Sin ubicación específica</option>

                                                            {ubicacionesDestino.map((ubicacion) => (
                                                                <option
                                                                    key={ubicacion.idUbicacion || ubicacion.id}
                                                                    value={ubicacion.idUbicacion || ubicacion.id}
                                                                >
                                                                    {ubicacion.nombre}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                {origenDestinoIguales && (
                                                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                                                        <div className="flex items-start gap-2">
                                                            <FaExclamationTriangle className="mt-0.5 text-rose-700 shrink-0" />
                                                            <p className="text-xs text-rose-800 leading-5">
                                                                El origen y el destino no pueden ser iguales.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">
                                                        Observación
                                                    </label>

                                                    <textarea
                                                        value={form.observacion}
                                                        onChange={(event) => cambiarForm("observacion", event.target.value)}
                                                        rows={2}
                                                        placeholder="Opcional"
                                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition resize-none"
                                                    />
                                                </div>

                                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                        Operador
                                                    </p>

                                                    <p className="mt-1 text-sm font-bold text-slate-900 leading-5">
                                                        {operador?.nombreCompleto ||
                                                            operador?.nombre ||
                                                            usuarioSesion?.nombre ||
                                                            "No identificado"}
                                                    </p>

                                                    <p className="text-xs text-slate-500">
                                                        {operador?.codigo || operador?.cargo || "Operador de inventario"}
                                                    </p>
                                                </div>

                                                <div className="rounded-xl border border-violet-100 bg-violet-50 p-3">
                                                    <p className="text-[11px] font-bold uppercase tracking-wider text-violet-700">
                                                        Resumen
                                                    </p>

                                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                                        <div>
                                                            <p className="text-xs text-violet-700">Productos</p>
                                                            <p className="text-lg font-bold text-violet-900">
                                                                {detalles.length}
                                                            </p>
                                                        </div>

                                                        <div>
                                                            <p className="text-xs text-violet-700">Cantidad</p>
                                                            <p className="text-lg font-bold text-violet-900">
                                                                {formatearNumero(totalCantidad)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => guardarTraslado()}
                                                    disabled={guardando || cargando || cargandoEdicion || finalizando}
                                                    className="w-full h-10 rounded-xl bg-blue-800 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-blue-900 disabled:opacity-60 transition shadow-sm"
                                                >
                                                    {guardando ? <FaSyncAlt className="animate-spin" /> : <FaSave />}
                                                    {modoEdicion ? "Actualizar borrador" : "Guardar borrador"}
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => setModalFinalizar(true)}
                                                    disabled={guardando || cargando || cargandoEdicion || finalizando || detalles.length === 0}
                                                    className="w-full h-10 rounded-xl bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-800 disabled:opacity-60 transition shadow-sm"
                                                >
                                                    {finalizando ? <FaSyncAlt className="animate-spin" /> : <FaCheckCircle />}
                                                    Guardar y finalizar
                                                </button>
                                            </div>
                                        </section>
                                    </aside>

                                    <div className="space-y-4">
                                        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                                                    <div>
                                                        <h2 className="font-bold text-slate-900 text-sm">
                                                            Productos del traslado
                                                        </h2>
                                                        <p className="text-xs text-slate-500">
                                                            Busca por código, nombre o pistolea el código de barras.
                                                        </p>
                                                    </div>

                                                    <div className="inline-flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-100 px-3 py-1.5 text-[11px] font-bold text-blue-800 w-fit">
                                                        <FaBarcode />
                                                        Compatible con lectora
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-4 space-y-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">
                                                        Buscar producto
                                                    </label>

                                                    <div className="flex flex-col md:flex-row gap-2">
                                                        <div className="relative flex-1">
                                                            <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />

                                                            <input
                                                                ref={inputProductoRef}
                                                                type="text"
                                                                value={busquedaProducto}
                                                                onChange={(event) => setBusquedaProducto(event.target.value)}
                                                                onKeyDown={(event) => {
                                                                    if (event.key === "Enter") {
                                                                        event.preventDefault();
                                                                        buscarProducto();
                                                                    }
                                                                }}
                                                                placeholder="Código, nombre o código de barras"
                                                                className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                                            />
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={buscarProducto}
                                                            disabled={buscandoProducto}
                                                            className="h-10 px-4 rounded-xl bg-blue-800 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-blue-900 disabled:opacity-60 transition"
                                                        >
                                                            {buscandoProducto ? <FaSyncAlt className="animate-spin" /> : <FaSearch />}
                                                            Buscar
                                                        </button>
                                                    </div>
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
                                                            Busca un producto por nombre, código o escanea su código de barras para agregarlo al traslado.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                                                        <table className="w-full min-w-[1040px]">
                                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                                <tr>
                                                                    <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                                        Producto
                                                                    </th>
                                                                    <th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                                        Cantidad
                                                                    </th>
                                                                    <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                                        Unidad
                                                                    </th>
                                                                    <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                                        Lote origen
                                                                    </th>
                                                                    <th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                                        Disponible
                                                                    </th>
                                                                    <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                                        Observación
                                                                    </th>
                                                                    <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                                        Acción
                                                                    </th>
                                                                </tr>
                                                            </thead>

                                                            <tbody className="divide-y divide-slate-200">
                                                                {detalles.map((detalle) => (
                                                                    <tr key={detalle.tempId} className="hover:bg-slate-50 transition">
                                                                        <td className="px-3 py-3">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-9 h-9 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-700 shrink-0">
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
                                                                                onKeyDown={(event) => {
                                                                                    if (
                                                                                        event.key === "Enter" &&
                                                                                        detalle.manejaLote
                                                                                    ) {
                                                                                        event.preventDefault();
                                                                                        abrirModalLotes(detalle);
                                                                                    }
                                                                                }}
                                                                                className="w-24 h-9 text-center rounded-xl border border-slate-300 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
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
                                                                                    onClick={() => abrirModalLotes(detalle)}
                                                                                    className={`min-w-[150px] h-9 px-3 rounded-xl border font-semibold text-xs flex items-center justify-center gap-2 transition ${detalle.idLote
                                                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                                                                            : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                                                                        }`}
                                                                                >
                                                                                    {detalle.idLote ? <FaCheckCircle /> : <FaExclamationTriangle />}
                                                                                    {detalle.idLote ? detalle.lote?.lote || "Lote seleccionado" : "Seleccionar lote"}
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
                                                                                <span className="text-xs text-slate-400">Sin validar</span>
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
                                                                                placeholder="Opcional"
                                                                                className="w-full h-9 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                                                            />
                                                                        </td>

                                                                        <td className="px-3 py-3">
                                                                            <div className="flex justify-end">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => eliminarDetalle(detalle.tempId)}
                                                                                    className="w-9 h-9 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 flex items-center justify-center hover:bg-rose-100 transition"
                                                                                    title="Eliminar producto"
                                                                                >
                                                                                    <FaTrash />
                                                                                </button>
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
                        onClick={() => cerrarModalCantidad()}
                        className="absolute inset-0 bg-slate-950/60"
                    />

                    <section className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <header className="px-5 py-4 border-b border-slate-200 bg-white">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-700 shrink-0">
                                        <FaBoxes />
                                    </div>

                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">
                                            Cantidad a trasladar
                                        </p>
                                        <h2 className="mt-1 text-lg font-bold text-slate-900">
                                            Agregar producto
                                        </h2>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => cerrarModalCantidad()}
                                    className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 transition"
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        </header>

                        <div className="p-5 space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-sm font-bold text-slate-900 leading-5">
                                    {productoDescripcion(modalCantidad.producto)}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    Código: {modalCantidad.producto?.codigo || "N/A"}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Cantidad a trasladar
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
                                            confirmarCantidadProducto();
                                        }
                                    }}
                                    className="w-full h-12 px-4 text-center rounded-xl border border-slate-300 bg-white text-lg font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                />
                            </div>
                        </div>

                        <footer className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => cerrarModalCantidad()}
                                className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-100 transition"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={confirmarCantidadProducto}
                                className="h-10 px-5 rounded-xl bg-blue-800 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-blue-900 transition"
                            >
                                <FaPlus />
                                Agregar
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
                        onClick={cerrarModalProductos}
                        className="absolute inset-0 bg-slate-950/60"
                    />

                    <section className="relative w-full max-w-4xl max-h-[88vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
                        <header className="px-5 py-5 border-b border-slate-200 bg-white">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-800">
                                        <FaSearch />
                                    </div>

                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                                            Selección de producto
                                        </p>
                                        <h2 className="mt-1 text-xl font-bold text-slate-900">
                                            Resultados para “{modalProductos.busqueda}”
                                        </h2>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={cerrarModalProductos}
                                    className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 transition"
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        </header>

                        <div className="flex-1 overflow-y-auto p-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {modalProductos.resultados.map((producto) => (
                                    <button
                                        type="button"
                                        key={producto.idProducto || producto.id}
                                        onClick={() => abrirModalCantidadProducto(producto)}
                                        className="text-left rounded-2xl border border-slate-200 bg-white p-4 hover:border-blue-300 hover:bg-blue-50 transition"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-800 shrink-0">
                                                <FaBoxes />
                                            </div>

                                            <div className="min-w-0">
                                                <h3 className="font-bold text-slate-900">
                                                    {productoDescripcion(producto)}
                                                </h3>
                                                <p className="mt-1 text-sm text-slate-500">
                                                    Código: {producto.codigo || "N/A"}
                                                </p>
                                                <p className="mt-1 text-sm text-slate-500">
                                                    Código barras: {producto.codigoBarrasPrincipal || producto?.codigosBarras?.[0] || "Sin código"}
                                                </p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {modalLotes.visible && detalleLoteActivo && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6">
                    <button
                        type="button"
                        aria-label="Cerrar modal"
                        onClick={() => cerrarModalLotes()}
                        className="absolute inset-0 bg-slate-950/60"
                    />

                    <section className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
                        <header className="px-5 py-5 border-b border-slate-200 bg-white">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-700">
                                        <FaBarcode />
                                    </div>

                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                                            Lotes disponibles en origen
                                        </p>
                                        <h2 className="mt-1 text-xl font-bold text-slate-900">
                                            {detalleLoteActivo.descripcion}
                                        </h2>
                                        <p className="text-sm text-slate-500">
                                            Selecciona un lote con existencia disponible en la bodega origen.
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => cerrarModalLotes()}
                                    disabled={cargandoLotes}
                                    className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 disabled:opacity-60 transition"
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        </header>

                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            <div className="grid grid-cols-1 xl:grid-cols-[330px_1fr] gap-5">
                                <aside className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden h-fit">
                                    <div className="px-5 py-4 border-b border-slate-200 bg-white">
                                        <h3 className="font-bold text-slate-900">Datos del movimiento</h3>
                                        <p className="text-sm text-slate-500">Se mueve el mismo lote hacia el destino.</p>
                                    </div>

                                    <div className="p-5 space-y-4">
                                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                Cantidad solicitada
                                            </p>
                                            <p className="mt-1 text-2xl font-bold text-slate-900">
                                                {formatearNumero(detalleLoteActivo.cantidad)}
                                            </p>
                                            <p className="text-xs text-slate-500">{detalleLoteActivo.unidad || "UND"}</p>
                                        </div>

                                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                            <div className="flex items-start gap-2">
                                                <FaExchangeAlt className="mt-0.5 text-emerald-700 shrink-0" />
                                                <p className="text-xs leading-5 text-emerald-800">
                                                    Al finalizar se descontará del origen y se sumará al destino.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </aside>

                                <div className="space-y-4">
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
                                                        cargarLotesProducto(detalleLoteActivo, modalLotes.busqueda);
                                                    }
                                                }}
                                                placeholder="Buscar lote"
                                                className="w-full h-11 pl-11 pr-4 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => cargarLotesProducto(detalleLoteActivo, modalLotes.busqueda)}
                                            disabled={cargandoLotes}
                                            className="h-11 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold flex items-center justify-center gap-2 hover:bg-slate-50 disabled:opacity-60 transition"
                                        >
                                            {cargandoLotes ? <FaSyncAlt className="animate-spin" /> : <FaSearch />}
                                            Buscar
                                        </button>
                                    </div>

                                    {cargandoLotes ? (
                                        <div className="min-h-[260px] flex flex-col items-center justify-center gap-4">
                                            <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />
                                            <p className="text-sm font-medium text-slate-500">Cargando lotes disponibles...</p>
                                        </div>
                                    ) : modalLotes.lotes.length === 0 ? (
                                        <div className="min-h-[260px] rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-center px-6">
                                            <FaBarcode className="text-3xl text-slate-400" />
                                            <h3 className="mt-4 font-bold text-slate-800">No hay lotes disponibles</h3>
                                            <p className="mt-1 text-sm text-slate-500">
                                                No se encontraron lotes con existencia en el origen seleccionado.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {modalLotes.lotes.map((lote) => {
                                                const disponible = Number(lote.cantidadDisponible ?? 0);
                                                const cantidadSolicitada = Number(detalleLoteActivo.cantidad ?? 0);
                                                const vigente = esLoteVigente(lote);
                                                const bloqueado = disponible <= 0 || cantidadSolicitada > disponible;

                                                return (
                                                    <button
                                                        type="button"
                                                        key={lote.idLote || lote.id}
                                                        onClick={() => seleccionarLote(lote)}
                                                        disabled={bloqueado}
                                                        className={`w-full text-left rounded-2xl border p-4 transition focus:outline-none focus:ring-2 focus:ring-blue-300 ${bloqueado
                                                                ? "border-slate-200 bg-slate-50 opacity-70 cursor-not-allowed"
                                                                : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50"
                                                            }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div>
                                                                <h3 className="font-bold text-slate-900">{lote.lote}</h3>
                                                                <p className="mt-1 text-sm text-slate-500">{lote.producto || lote.descripcion}</p>
                                                                <p className="mt-1 text-xs text-slate-500">
                                                                    Disponible: {formatearNumero(disponible)}
                                                                </p>
                                                                {lote.ubicacion && (
                                                                    <p className="mt-1 text-xs text-slate-500">
                                                                        Ubicación origen: {lote.ubicacion}
                                                                    </p>
                                                                )}
                                                            </div>

                                                            <div className="text-right">
                                                                <span
                                                                    className={`inline-flex px-3 py-1.5 rounded-full border text-xs font-bold ${bloqueado
                                                                            ? "bg-slate-100 text-slate-500 border-slate-200"
                                                                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                        }`}
                                                                >
                                                                    {bloqueado ? "No disponible" : "Seleccionar"}
                                                                </span>

                                                                <div className="mt-2">
                                                                    {vigente ? (
                                                                        <span className="inline-flex px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                                                                            Vigente
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                                                                            Vencido
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                {lote.fechaVencimiento && (
                                                                    <p className="mt-2 text-xs text-slate-500">Vence: {lote.fechaVencimiento}</p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {cantidadSolicitada > disponible && (
                                                            <p className="mt-3 text-xs font-semibold text-rose-700">
                                                                La cantidad solicitada supera la existencia disponible.
                                                            </p>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
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
                        <header className="px-5 py-4 border-b border-slate-200 bg-white">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                                        <FaCheckCircle />
                                    </div>

                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                                            Finalizar traslado
                                        </p>
                                        <h2 className="mt-1 text-lg font-bold text-slate-900">Confirmar movimiento</h2>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setModalFinalizar(false)}
                                    className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 transition"
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        </header>

                        <div className="p-5 space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-sm text-slate-600 leading-6">
                                    Al finalizar, el sistema descontará existencias del origen, sumará existencias al destino y generará los movimientos de inventario. Después no podrás editar este traslado.
                                </p>

                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                                        <p className="text-xs text-slate-500">Productos</p>
                                        <p className="text-xl font-bold text-slate-900">{detalles.length}</p>
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
                                <div className="flex items-start gap-2">
                                    <FaExclamationTriangle className="mt-0.5 text-amber-700 shrink-0" />
                                    <p className="text-xs text-amber-800 leading-5">
                                        Si algún producto no tiene existencia suficiente en origen, la finalización será bloqueada.
                                    </p>
                                </div>
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
                                onClick={finalizarTraslado}
                                disabled={guardando || finalizando}
                                className="h-10 px-5 rounded-xl bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-800 disabled:opacity-60 transition"
                            >
                                {guardando || finalizando ? <FaSyncAlt className="animate-spin" /> : <FaCheckCircle />}
                                Confirmar
                            </button>
                        </footer>
                    </section>
                </div>
            )}
        </>
    );
};
