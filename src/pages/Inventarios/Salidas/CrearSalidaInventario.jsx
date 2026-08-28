import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaArrowLeft,
    FaBarcode,
    FaBoxes,
    FaBoxOpen,
    FaCheckCircle,
    FaExclamationTriangle,
    FaMinusCircle,
    FaPlus,
    FaSave,
    FaSearch,
    FaSyncAlt,
    FaTimes,
    FaTrash,
    FaWarehouse,
} from "react-icons/fa";
import { toast } from "react-toastify";

const API_BASE_SALIDAS =
    "https://app.accionporcolombia.com/servicesPae/Inventario/Salidas/";
const API_BASE_PRODUCTOS =
    "https://app.accionporcolombia.com/servicesPae/Inventario/Productos/";

export const CrearSalidaInventario = ({ setSidebar, navegar }) => {
    const abrirMenu = () => setSidebar(true);
    const estadoPagina = useCallback((pagina) => navegar(pagina), [navegar]);

    const inputProductoRef = useRef(null);
    const inputCantidadModalRef = useRef(null);
    const inputCantidadRefs = useRef({});
    const botonLoteActivoRef = useRef(null);

    const [cargando, setCargando] = useState(true);
    const [cargandoEdicion, setCargandoEdicion] = useState(false);
    const [edicionCargada, setEdicionCargada] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [finalizando, setFinalizando] = useState(false);
    const [buscandoProducto, setBuscandoProducto] = useState(false);
    const [cargandoLotes, setCargandoLotes] = useState(false);

    const [salidaEditar, setSalidaEditar] = useState(null);
    const [tiposDocumentoSalida, setTiposDocumentoSalida] = useState([]);
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
        busqueda: "",
        lotes: [],
        loteActivoId: null,
    });

    const [modalFinalizar, setModalFinalizar] = useState(false);
    const [detalleFocusId, setDetalleFocusId] = useState(null);

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
                const json = JSON.parse(valor);
                const usuario = json?.usuario || json?.user || json?.data || json;
                const id =
                    usuario?.idUsuario ??
                    usuario?.id_usuario ??
                    usuario?.id ??
                    usuario?.userId ??
                    usuario?.idUser;

                if (id) {
                    return {
                        ...usuario,
                        idUsuario: Number(id),
                        nombre: usuario?.nombre ?? usuario?.nombreCompleto ?? "",
                        correo: usuario?.correo ?? "",
                        telefono: usuario?.telefono ?? "",
                        rol: usuario?.rol ?? null,
                        rolNombre: usuario?.rolNombre ?? "",
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

    const obtenerSalidaEditarLocal = () => {
        const valor = localStorage.getItem("salidaInventarioEditar");
        if (!valor) return null;

        try {
            return JSON.parse(valor);
        } catch {
            return null;
        }
    };

    const obtenerIdDocumentoSalida = (salida) =>
        Number(salida?.idDocumento ?? salida?.idSalida ?? salida?.id ?? 0);

    useEffect(() => {
        setSalidaEditar(obtenerSalidaEditarLocal());
    }, []);

    const idDocumentoEdicion = useMemo(
        () => obtenerIdDocumentoSalida(salidaEditar),
        [salidaEditar]
    );

    const modoEdicion = idDocumentoEdicion > 0;

    const tipoDocumentoSalida = useMemo(() => {
        const idTipo = Number(form.idTipoDocumento || 0);

        return (
            tiposDocumentoSalida.find(
                (tipo) => Number(tipo?.idTipoDocumento ?? tipo?.id ?? 0) === idTipo
            ) || null
        );
    }, [tiposDocumentoSalida, form.idTipoDocumento]);

    const permiteLoteVencido = useMemo(
        () => Number(tipoDocumentoSalida?.permiteLoteVencido ?? 0) === 1,
        [tipoDocumentoSalida]
    );

    const reglaLotesTexto = permiteLoteVencido
        ? "Este tipo de salida permite lotes vigentes y vencidos con existencia."
        : "Este tipo de salida solo permite lotes vigentes o sin fecha de vencimiento.";

    const jsonFetch = async (url, options = {}) => {
        const respuesta = await fetch(url, {
            cache: "no-store",
            headers: {
                Accept: "application/json",
                "Cache-Control": "no-cache",
                ...(options.headers || {}),
            },
            ...options,
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
                    "No fue posible completar la operación."
            );
        }

        return resultado;
    };

    const cargarFormData = useCallback(async () => {
        setCargando(true);

        try {
            const params = new URLSearchParams();
            params.set("t", Date.now());

            if (usuarioSesion?.idUsuario) {
                params.set("idUsuario", usuarioSesion.idUsuario);
            }

            const resultado = await jsonFetch(
                `${API_BASE_SALIDAS}InventarioSalidasFormData.php?${params.toString()}`
            );

            const data = resultado?.data || {};
            const tipos = Array.isArray(data?.tiposDocumento) ? data.tiposDocumento : [];
            const listaBodegas = Array.isArray(data?.bodegas) ? data.bodegas : [];
            const listaUbicaciones = Array.isArray(data?.ubicaciones)
                ? data.ubicaciones
                : [];

            setTiposDocumentoSalida(tipos);
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
                idBodega:
                    prev.idBodega ||
                    (listaBodegas[0]?.idBodega || listaBodegas[0]?.id || ""),
            }));

            setTimeout(() => inputProductoRef.current?.focus(), 250);
        } catch (error) {
            console.error("Error cargando form data:", error);
            toast.error(error?.message || "No fue posible cargar los datos de la salida.");
        } finally {
            setCargando(false);
        }
    }, [usuarioSesion?.idUsuario]);

    const cargarSalidaEditar = useCallback(async () => {
        if (!idDocumentoEdicion) return;

        setCargandoEdicion(true);

        try {
            const params = new URLSearchParams();
            params.set("idDocumento", idDocumentoEdicion);
            params.set("t", Date.now());

            const resultado = await jsonFetch(
                `${API_BASE_SALIDAS}InventarioSalidasDetalle.php?${params.toString()}`
            );

            const data = resultado?.data || {};
            const documento = data?.documento || data?.salida || {};
            const estadoProceso = String(documento?.estadoProceso || "BORRADOR")
                .trim()
                .toUpperCase();

            if (documento?.editable === false || estadoProceso !== "BORRADOR") {
                localStorage.removeItem("salidaInventarioEditar");
                toast.warning("Esta salida ya fue finalizada y no se puede editar.");
                estadoPagina("SalidasInventario");
                return;
            }

            const listaDetalles = Array.isArray(data?.detalles) ? data.detalles : [];

            const detallesMapeados = listaDetalles.map((detalle, indice) => {
                const idLote = Number(detalle?.idLote ?? 0);

                return {
                    tempId: `edit-${detalle?.idDocumentoDetalle || indice}-${Date.now()}`,
                    idDocumentoDetalle: detalle?.idDocumentoDetalle || null,
                    idProducto: Number(detalle?.idProducto ?? 0),
                    codigo: detalle?.codigoProducto || detalle?.codigo || "",
                    descripcion:
                        detalle?.descripcion ||
                        detalle?.producto ||
                        "Producto sin nombre",
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
                    idBodega:
                        detalle?.idBodega ||
                        documento?.idBodega ||
                        form.idBodega,
                    idUbicacion:
                        detalle?.idUbicacion ||
                        documento?.idUbicacion ||
                        form.idUbicacion,
                    observacion: detalle?.observacion || "",
                };
            });

            const primerDetalle = detallesMapeados[0] || {};

            setForm((prev) => ({
                ...prev,
                idTipoDocumento: documento?.idTipoDocumento || prev.idTipoDocumento,
                fechaDocumento: documento?.fechaDocumento || prev.fechaDocumento,
                idBodega: primerDetalle?.idBodega || documento?.idBodega || prev.idBodega,
                idUbicacion:
                    primerDetalle?.idUbicacion ||
                    documento?.idUbicacion ||
                    prev.idUbicacion,
                observacion: documento?.observacion ?? prev.observacion,
            }));

            setDetalles(detallesMapeados);
            setSalidaEditar(documento);
            setEdicionCargada(true);

            setTimeout(() => inputProductoRef.current?.focus(), 250);
        } catch (error) {
            console.error("Error cargando salida para edición:", error);
            toast.error(error?.message || "No fue posible cargar la salida para edición.");
        } finally {
            setCargandoEdicion(false);
        }
    }, [idDocumentoEdicion, form.idBodega, form.idUbicacion, estadoPagina]);

    useEffect(() => {
        cargarFormData();
    }, [cargarFormData]);

    useEffect(() => {
        if (
            cargando ||
            cargandoEdicion ||
            edicionCargada ||
            !idDocumentoEdicion
        ) {
            return;
        }

        cargarSalidaEditar();
    }, [
        cargando,
        cargandoEdicion,
        edicionCargada,
        idDocumentoEdicion,
        cargarSalidaEditar,
    ]);

    useEffect(() => {
        if (
            !modalProductos.visible &&
            !modalCantidad.visible &&
            !modalLotes.visible &&
            !modalFinalizar
        ) {
            return undefined;
        }

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
    }, [
        modalProductos.visible,
        modalCantidad.visible,
        modalLotes.visible,
        modalFinalizar,
    ]);

    useEffect(() => {
        if (!modalCantidad.visible) return;

        const timer = setTimeout(() => {
            inputCantidadModalRef.current?.focus();
            inputCantidadModalRef.current?.select();
        }, 120);

        return () => clearTimeout(timer);
    }, [modalCantidad.visible]);

    useEffect(() => {
        if (!detalleFocusId) return;

        const timer = setTimeout(() => {
            const input = inputCantidadRefs.current[detalleFocusId];

            if (input) {
                input.focus();
                input.select();
            }

            setDetalleFocusId(null);
        }, 150);

        return () => clearTimeout(timer);
    }, [detalleFocusId, detalles]);

    useEffect(() => {
        if (!modalLotes.visible || !modalLotes.loteActivoId) return undefined;

        const timer = setTimeout(() => {
            botonLoteActivoRef.current?.focus();
        }, 180);

        return () => clearTimeout(timer);
    }, [modalLotes.visible, modalLotes.loteActivoId, modalLotes.lotes]);

    const ubicacionesFiltradas = useMemo(() => {
        const idBodega = Number(form.idBodega || 0);

        return ubicaciones.filter(
            (ubicacion) => Number(ubicacion?.idBodega || 0) === idBodega
        );
    }, [ubicaciones, form.idBodega]);

    useEffect(() => {
        if (!form.idBodega) return;

        const existeUbicacion = ubicacionesFiltradas.some(
            (ubicacion) =>
                Number(ubicacion?.idUbicacion ?? ubicacion?.id) ===
                Number(form.idUbicacion)
        );

        if (form.idUbicacion && !existeUbicacion) {
            setForm((prev) => ({
                ...prev,
                idUbicacion: "",
            }));
        }
    }, [form.idBodega, form.idUbicacion, ubicacionesFiltradas]);

    const productoDescripcion = (producto) =>
        producto?.descripcion ||
        producto?.nombre ||
        producto?.producto ||
        "Producto sin nombre";

    const formatearNumero = (valor) => {
        const numero = Number(valor ?? 0);

        return new Intl.NumberFormat("es-CO", {
            maximumFractionDigits: 3,
        }).format(numero);
    };

    const obtenerFechaHoyISO = () => {
        const hoy = new Date();
        const anio = hoy.getFullYear();
        const mes = String(hoy.getMonth() + 1).padStart(2, "0");
        const dia = String(hoy.getDate()).padStart(2, "0");

        return `${anio}-${mes}-${dia}`;
    };

    const obtenerIdLote = (lote) =>
        Number(lote?.idLote ?? lote?.id ?? 0);

    const normalizarFechaLote = (fecha) => {
        if (!fecha || fecha === "0000-00-00") return "";
        return String(fecha).substring(0, 10);
    };

    const esLoteVigente = (lote) => {
        const fechaVencimiento = normalizarFechaLote(lote?.fechaVencimiento);
        if (!fechaVencimiento) return true;
        return fechaVencimiento >= obtenerFechaHoyISO();
    };

    const esLoteActivoAutomatico = (lote) =>
        modalLotes.loteActivoId &&
        obtenerIdLote(lote) === Number(modalLotes.loteActivoId);

    const enfocarBusquedaProducto = (delay = 120) => {
        setTimeout(() => {
            inputProductoRef.current?.focus();
            inputProductoRef.current?.select?.();
        }, delay);
    };

    const generarTempId = () =>
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const actualizarDetalle = (tempId, cambios) => {
        setDetalles((prev) =>
            prev.map((detalle) =>
                detalle.tempId === tempId
                    ? {
                          ...detalle,
                          ...cambios,
                      }
                    : detalle
            )
        );
    };

    const limpiarLotesDetalle = () => {
        setDetalles((prev) =>
            prev.map((detalle) => ({
                ...detalle,
                idLote: null,
                lote: null,
                fechaVencimiento: null,
                cantidadDisponible: null,
            }))
        );
    };

    const eliminarDetalle = (tempId) => {
        setDetalles((prev) =>
            prev.filter((detalle) => detalle.tempId !== tempId)
        );
    };

    const abrirModalCantidadProducto = (producto) => {
        const idProducto = Number(producto?.idProducto ?? producto?.id ?? 0);

        if (!idProducto) {
            toast.error("No se encontró el identificador del producto.");
            return;
        }

        setModalProductos({
            visible: false,
            resultados: [],
            busqueda: "",
        });

        setModalCantidad({
            visible: true,
            producto,
            cantidad: "1",
        });
    };

    const cerrarModalCantidad = (enfocarBusqueda = true) => {
        setModalCantidad({
            visible: false,
            producto: null,
            cantidad: "1",
        });

        if (enfocarBusqueda) enfocarBusquedaProducto();
    };

    const agregarProductoDetalle = (producto, cantidadIngresada = 1) => {
        const idProducto = Number(producto?.idProducto ?? producto?.id ?? 0);

        if (!idProducto) {
            toast.error("No se encontró el identificador del producto.");
            return null;
        }

        const cantidadFinal = Number(String(cantidadIngresada).replace(",", "."));

        if (!cantidadFinal || cantidadFinal <= 0) {
            toast.warning("La cantidad debe ser mayor a cero.");
            return null;
        }

        const manejaLote = Number(producto?.manejaLote ?? 0) === 1;
        const manejaVencimiento =
            Number(producto?.manejaVencimiento ?? 0) === 1 ||
            Number(producto?.requiereFechaVencimiento ?? 0) === 1;

        const existenteActual = detalles.find((item) => {
            const mismoProducto = Number(item.idProducto) === idProducto;
            if (!mismoProducto) return false;
            if (!manejaLote) return true;
            return !item.idLote;
        });

        const tempIdParaFocus = existenteActual?.tempId || generarTempId();

        setDetalles((prev) => {
            const existente = prev.find((item) => {
                const mismoProducto = Number(item.idProducto) === idProducto;
                if (!mismoProducto) return false;
                if (!manejaLote) return true;
                return !item.idLote;
            });

            if (existente) {
                return prev.map((item) =>
                    item.tempId === existente.tempId
                        ? {
                              ...item,
                              cantidad: Number(item.cantidad ?? 0) + cantidadFinal,
                          }
                        : item
                );
            }

            return [
                ...prev,
                {
                    tempId: tempIdParaFocus,
                    idProducto,
                    codigo: producto?.codigo || "",
                    descripcion: productoDescripcion(producto),
                    unidad: producto?.unidadBaseInventario || "UND",
                    cantidad: cantidadFinal,
                    manejaLote,
                    manejaVencimiento,
                    idLote: null,
                    lote: null,
                    fechaVencimiento: null,
                    cantidadDisponible: null,
                    idBodega: form.idBodega,
                    idUbicacion: form.idUbicacion,
                    observacion: "",
                },
            ];
        });

        setBusquedaProducto("");
        cerrarModalProductos();

        return {
            tempId: tempIdParaFocus,
            manejaLote,
            detalle: {
                tempId: tempIdParaFocus,
                idProducto,
                codigo: producto?.codigo || "",
                descripcion: productoDescripcion(producto),
                unidad: producto?.unidadBaseInventario || "UND",
                cantidad: cantidadFinal,
                manejaLote,
                manejaVencimiento,
                idLote: existenteActual?.idLote || null,
                lote: existenteActual?.lote || null,
                fechaVencimiento: existenteActual?.fechaVencimiento || null,
                cantidadDisponible: existenteActual?.cantidadDisponible ?? null,
                idBodega: form.idBodega,
                idUbicacion: form.idUbicacion,
                observacion: existenteActual?.observacion || "",
            },
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
            inputCantidadModalRef.current?.focus();
            inputCantidadModalRef.current?.select();
            return;
        }

        const resultadoAgregado = agregarProductoDetalle(producto, cantidad);
        if (!resultadoAgregado) return;

        cerrarModalCantidad(false);

        if (resultadoAgregado.manejaLote) {
            setTimeout(() => {
                abrirModalLotes(resultadoAgregado.detalle);
            }, 140);
            return;
        }

        enfocarBusquedaProducto();
    };

    const buscarProducto = async (valor = "") => {
        const busqueda = String(valor || busquedaProducto).trim();

        if (!form.idTipoDocumento) {
            toast.warning("Debe seleccionar el tipo de salida.");
            return;
        }

        if (!form.idBodega) {
            toast.warning("Debe seleccionar la bodega origen.");
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

            const resultado = await jsonFetch(
                `${API_BASE_PRODUCTOS}InventarioProductosBuscar.php?${params.toString()}`
            );

            const productos = Array.isArray(resultado?.data) ? resultado.data : [];

            if (productos.length === 0) {
                toast.warning("No se encontró ningún producto con esa búsqueda.");
                return;
            }

            const exactos = productos.filter(
                (producto) => Number(producto?.coincidenciaExacta ?? 0) === 1
            );

            if (exactos.length === 1) {
                abrirModalCantidadProducto(exactos[0]);
                return;
            }

            if (productos.length === 1) {
                abrirModalCantidadProducto(productos[0]);
                return;
            }

            setModalProductos({
                visible: true,
                resultados: productos,
                busqueda,
            });
        } catch (error) {
            console.error("Error buscando producto:", error);
            toast.error(error?.message || "No fue posible buscar el producto.");
        } finally {
            setBuscandoProducto(false);
        }
    };

    const cerrarModalProductos = () => {
        setModalProductos({
            visible: false,
            resultados: [],
            busqueda: "",
        });
    };

    const detalleLoteActivo = useMemo(() => {
        if (!modalLotes.detalleId) return null;
        return (
            detalles.find((detalle) => detalle.tempId === modalLotes.detalleId) ||
            null
        );
    }, [detalles, modalLotes.detalleId]);

    const cargarLotesProducto = async (detalle, busqueda = "") => {
        if (!detalle?.idProducto) return;

        if (!form.idTipoDocumento) {
            toast.warning("Debe seleccionar el tipo de salida.");
            return;
        }

        if (!form.idBodega) {
            toast.warning("Debe seleccionar la bodega origen.");
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

            if (form.idUbicacion) params.set("idUbicacion", form.idUbicacion);
            if (busqueda.trim()) params.set("q", busqueda.trim());

            const resultado = await jsonFetch(
                `${API_BASE_SALIDAS}InventarioSalidasLotesDisponibles.php?${params.toString()}`
            );

            const lotes = Array.isArray(resultado?.data) ? resultado.data : [];

            const lotesSeleccionables = lotes.filter(
                (lote) =>
                    Number(lote?.cantidadDisponible ?? 0) > 0 &&
                    (permiteLoteVencido || esLoteVigente(lote))
            );

            const loteActivoId =
                lotesSeleccionables.length === 1
                    ? obtenerIdLote(lotesSeleccionables[0])
                    : null;

            setModalLotes((prev) => ({
                ...prev,
                lotes,
                loteActivoId,
            }));
        } catch (error) {
            console.error("Error cargando lotes:", error);
            toast.error(
                error?.message ||
                    "No fue posible cargar los lotes disponibles del producto."
            );
        } finally {
            setCargandoLotes(false);
        }
    };

    const abrirModalLotes = (detalle) => {
        if (!detalle?.manejaLote) {
            toast.info("Este producto no requiere lote.");
            return;
        }

        setModalLotes({
            visible: true,
            detalleId: detalle.tempId,
            busqueda: "",
            lotes: [],
            loteActivoId: null,
        });

        cargarLotesProducto(detalle, "");
    };

    const cerrarModalLotes = (enfocarBusqueda = true) => {
        if (cargandoLotes) return;

        setModalLotes({
            visible: false,
            detalleId: null,
            busqueda: "",
            lotes: [],
            loteActivoId: null,
        });

        if (enfocarBusqueda) enfocarBusquedaProducto();
    };

    const seleccionarLote = (lote) => {
        if (!detalleLoteActivo) return;

        const disponible = Number(lote?.cantidadDisponible ?? 0);
        const cantidadSolicitada = Number(detalleLoteActivo?.cantidad ?? 0);

        if (disponible <= 0) {
            toast.warning("Este lote no tiene existencia disponible.");
            return;
        }

        if (!permiteLoteVencido && !esLoteVigente(lote)) {
            toast.warning("Este tipo de salida no permite seleccionar lotes vencidos.");
            return;
        }

        if (cantidadSolicitada > disponible) {
            toast.warning(
                `La cantidad solicitada (${formatearNumero(
                    cantidadSolicitada
                )}) supera la existencia disponible (${formatearNumero(disponible)}).`
            );
            return;
        }

        actualizarDetalle(detalleLoteActivo.tempId, {
            idLote: Number(lote?.idLote ?? lote?.id),
            lote,
            fechaVencimiento: lote?.fechaVencimiento,
            cantidadDisponible: disponible,
        });

        cerrarModalLotes(true);
    };

    const validarFormulario = () => {
        if (!usuarioSesion?.idUsuario) {
            toast.error("No se pudo identificar el usuario de la sesión.");
            return false;
        }

        if (!form.idTipoDocumento) {
            toast.warning("Debe seleccionar el tipo de salida.");
            return false;
        }

        if (!form.fechaDocumento) {
            toast.warning("Debe seleccionar la fecha de la salida.");
            return false;
        }

        if (!form.idBodega) {
            toast.warning("Debe seleccionar la bodega origen.");
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
                toast.warning(
                    `La cantidad de ${detalle.descripcion} debe ser mayor a cero.`
                );
                return false;
            }

            if (detalle.manejaLote && !Number(detalle.idLote || 0)) {
                toast.warning(
                    `Debe seleccionar un lote disponible para ${detalle.descripcion}.`
                );
                abrirModalLotes(detalle);
                return false;
            }

            if (
                detalle.idLote &&
                detalle.cantidadDisponible !== null &&
                cantidad > Number(detalle.cantidadDisponible)
            ) {
                toast.warning(
                    `La cantidad de ${detalle.descripcion} supera la existencia disponible del lote seleccionado.`
                );
                return false;
            }

            if (
                detalle.idLote &&
                !permiteLoteVencido &&
                detalle.lote &&
                !esLoteVigente(detalle.lote)
            ) {
                toast.warning(
                    `El lote de ${detalle.descripcion} está vencido y este tipo de salida no lo permite.`
                );
                return false;
            }
        }

        return true;
    };

    const construirPayload = () => ({
        idDocumento: modoEdicion ? idDocumentoEdicion : undefined,
        idSalida: modoEdicion ? idDocumentoEdicion : undefined,
        idUsuarioRegistro: usuarioSesion.idUsuario,
        idUsuario: usuarioSesion.idUsuario,
        idOperador: operador?.idOperador || undefined,
        idTipoDocumento: Number(form.idTipoDocumento),
        fechaDocumento: form.fechaDocumento,
        observacion: form.observacion,
        detalles: detalles.map((detalle) => ({
            idProducto: Number(detalle.idProducto),
            cantidad: Number(detalle.cantidad),
            cantidadSolicitada: Number(detalle.cantidad),
            unidad: detalle.unidad || "UND",
            idBodega: Number(form.idBodega),
            idUbicacion: form.idUbicacion ? Number(form.idUbicacion) : null,
            idLote: detalle.idLote ? Number(detalle.idLote) : null,
            observacion: detalle.observacion || "",
        })),
    });

    const guardarSalida = async ({ retornar = true, mostrarToast = true } = {}) => {
        if (!validarFormulario()) return null;

        setGuardando(true);

        try {
            const resultado = await jsonFetch(
                `${API_BASE_SALIDAS}InventarioSalidasGuardar.php`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(construirPayload()),
                }
            );

            const idGuardado = Number(
                resultado?.data?.idDocumento ??
                    resultado?.data?.idSalida ??
                    resultado?.idDocumento ??
                    resultado?.idSalida ??
                    0
            );

            if (mostrarToast) {
                toast.success(resultado?.mensaje || "Salida guardada correctamente.");
            }

            localStorage.removeItem("salidaInventarioEditar");
            localStorage.setItem(
                "salidaInventarioDetalle",
                JSON.stringify(resultado.data)
            );

            if (retornar) estadoPagina("SalidasInventario");

            return { idDocumento: idGuardado, resultado };
        } catch (error) {
            console.error("Error guardando salida:", error);
            toast.error(error?.message || "No fue posible guardar la salida.");
            return null;
        } finally {
            setGuardando(false);
        }
    };

    const finalizarSalida = async () => {
        if (!validarFormulario()) return;

        setModalFinalizar(false);
        setFinalizando(true);

        try {
            const guardado = await guardarSalida({
                retornar: false,
                mostrarToast: false,
            });

            if (!guardado?.idDocumento) {
                setFinalizando(false);
                return;
            }

            const resultado = await jsonFetch(
                `${API_BASE_SALIDAS}InventarioSalidasFinalizar.php`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        idDocumento: guardado.idDocumento,
                        idSalida: guardado.idDocumento,
                        idUsuario: usuarioSesion.idUsuario,
                        idUsuarioFinaliza: usuarioSesion.idUsuario,
                        idOperador: operador?.idOperador || undefined,
                    }),
                }
            );

            toast.success(resultado?.mensaje || "Salida finalizada correctamente.");
            localStorage.removeItem("salidaInventarioEditar");
            estadoPagina("SalidasInventario");
        } catch (error) {
            console.error("Error finalizando salida:", error);
            toast.error(error?.message || "No fue posible finalizar la salida.");
        } finally {
            setFinalizando(false);
        }
    };

    const totalCantidad = useMemo(() => {
        return detalles.reduce(
            (total, detalle) => total + Number(detalle.cantidad ?? 0),
            0
        );
    }, [detalles]);

    const volver = () => {
        localStorage.removeItem("salidaInventarioEditar");
        estadoPagina("SalidasInventario");
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

                                <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                                    <FaMinusCircle className="text-lg text-rose-700" />
                                </div>

                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-rose-700">
                                        Operación de inventarios
                                    </p>

                                    <h1 className="mt-0.5 text-xl md:text-2xl font-bold text-slate-900">
                                        {modoEdicion ? "Editar salida" : "Nueva salida"}
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
                                    onClick={() => guardarSalida()}
                                    disabled={
                                        guardando ||
                                        cargando ||
                                        cargandoEdicion ||
                                        finalizando
                                    }
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
                                        cargando ||
                                        cargandoEdicion ||
                                        finalizando ||
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
                            </div>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto">
                        <div className="p-3 md:p-4">
                            {cargando || cargandoEdicion ? (
                                <div className="min-h-[420px] flex flex-col items-center justify-center gap-4">
                                    <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />

                                    <p className="text-sm font-medium text-slate-500">
                                        {cargandoEdicion
                                            ? "Cargando salida..."
                                            : "Cargando formulario..."}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4 items-start">
                                    <aside className="space-y-4 xl:sticky xl:top-0">
                                        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                                                <h2 className="font-bold text-slate-900 text-sm">
                                                    Datos de la salida
                                                </h2>

                                                <p className="text-xs text-slate-500">
                                                    Documento y origen.
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
                                                        Tipo de salida
                                                    </label>

                                                    <select
                                                        value={form.idTipoDocumento}
                                                        onChange={(event) => {
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                idTipoDocumento:
                                                                    event.target.value,
                                                            }));
                                                            limpiarLotesDetalle();
                                                        }}
                                                        className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                                    >
                                                        <option value="">Seleccione</option>

                                                        {tiposDocumentoSalida.map((tipo) => (
                                                            <option
                                                                key={tipo.idTipoDocumento || tipo.id}
                                                                value={tipo.idTipoDocumento || tipo.id}
                                                            >
                                                                {tipo.nombre}
                                                            </option>
                                                        ))}
                                                    </select>

                                                    {tipoDocumentoSalida && (
                                                        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                                                            <p className="text-[11px] font-bold text-slate-700">
                                                                {tipoDocumentoSalida?.codigo
                                                                    ? `Código: ${tipoDocumentoSalida.codigo}`
                                                                    : "Documento de salida"}
                                                            </p>

                                                            <p className="mt-1 text-[11px] text-slate-500 leading-4">
                                                                {reglaLotesTexto}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">
                                                        Fecha salida
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
                                                        className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">
                                                        Bodega origen
                                                    </label>

                                                    <select
                                                        value={form.idBodega}
                                                        onChange={(event) => {
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                idBodega: event.target.value,
                                                                idUbicacion: "",
                                                            }));
                                                            limpiarLotesDetalle();
                                                        }}
                                                        className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
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
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">
                                                        Ubicación origen
                                                    </label>

                                                    <select
                                                        value={form.idUbicacion}
                                                        onChange={(event) => {
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                idUbicacion:
                                                                    event.target.value,
                                                            }));
                                                            limpiarLotesDetalle();
                                                        }}
                                                        className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                                    >
                                                        <option value="">
                                                            Sin ubicación específica
                                                        </option>

                                                        {ubicacionesFiltradas.map((ubicacion) => (
                                                            <option
                                                                key={ubicacion.idUbicacion || ubicacion.id}
                                                                value={
                                                                    ubicacion.idUbicacion ||
                                                                    ubicacion.id
                                                                }
                                                            >
                                                                {ubicacion.nombre}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">
                                                        Observación
                                                    </label>

                                                    <textarea
                                                        value={form.observacion}
                                                        onChange={(event) =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                observacion:
                                                                    event.target.value,
                                                            }))
                                                        }
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
                                                        {operador?.codigo ||
                                                            operador?.cargo ||
                                                            "Operador de inventario"}
                                                    </p>
                                                </div>

                                                {!operador && (
                                                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                                                        <div className="flex items-start gap-2">
                                                            <FaExclamationTriangle className="mt-0.5 text-amber-700 shrink-0" />

                                                            <p className="text-xs text-amber-800 leading-5">
                                                                No se encontró un operador activo asociado al usuario actual.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="rounded-xl border border-rose-100 bg-rose-50 p-3">
                                                    <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                                                        Resumen
                                                    </p>

                                                    <div className="mt-2 grid grid-cols-2 gap-2">
                                                        <div>
                                                            <p className="text-xs text-rose-700">
                                                                Productos
                                                            </p>
                                                            <p className="text-lg font-bold text-rose-900">
                                                                {detalles.length}
                                                            </p>
                                                        </div>

                                                        <div>
                                                            <p className="text-xs text-rose-700">
                                                                Cantidad
                                                            </p>
                                                            <p className="text-lg font-bold text-rose-900">
                                                                {formatearNumero(totalCantidad)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => guardarSalida()}
                                                    disabled={
                                                        guardando ||
                                                        cargando ||
                                                        cargandoEdicion ||
                                                        finalizando
                                                    }
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

                                                {/* <button
                                                    type="button"
                                                    onClick={() => setModalFinalizar(true)}
                                                    disabled={
                                                        guardando ||
                                                        cargando ||
                                                        cargandoEdicion ||
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
                                                </button> */}
                                            </div>
                                        </section>
                                    </aside>

                                    <div className="space-y-4">
                                        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                                                    <div>
                                                        <h2 className="font-bold text-slate-900 text-sm">
                                                            Productos de la salida
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
                                                                onChange={(event) =>
                                                                    setBusquedaProducto(
                                                                        event.target.value
                                                                    )
                                                                }
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
                                                            onClick={() => buscarProducto()}
                                                            disabled={buscandoProducto}
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
                                                            Busca un producto por nombre, código o escanea su código de barras para agregarlo a la salida.
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
                                                                        Lote
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
                                                                    <tr
                                                                        key={detalle.tempId}
                                                                        className="hover:bg-slate-50 transition"
                                                                    >
                                                                        <td className="px-3 py-3">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                                                                                    <FaBoxes />
                                                                                </div>

                                                                                <div className="min-w-0">
                                                                                    <p className="font-semibold text-sm text-slate-900 truncate max-w-[260px]">
                                                                                        {detalle.descripcion}
                                                                                    </p>

                                                                                    <p className="text-xs text-slate-500">
                                                                                        {detalle.codigo ||
                                                                                            `ID ${detalle.idProducto}`}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        </td>

                                                                        <td className="px-3 py-3 text-center">
                                                                            <input
                                                                                ref={(element) => {
                                                                                    if (element) {
                                                                                        inputCantidadRefs.current[detalle.tempId] =
                                                                                            element;
                                                                                    } else {
                                                                                        delete inputCantidadRefs.current[detalle.tempId];
                                                                                    }
                                                                                }}
                                                                                type="number"
                                                                                min="0"
                                                                                step="0.001"
                                                                                value={detalle.cantidad}
                                                                                onChange={(event) =>
                                                                                    actualizarDetalle(
                                                                                        detalle.tempId,
                                                                                        {
                                                                                            cantidad:
                                                                                                event.target.value,
                                                                                        }
                                                                                    )
                                                                                }
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
                                                                                    onClick={() =>
                                                                                        abrirModalLotes(detalle)
                                                                                    }
                                                                                    title={
                                                                                        detalle.idLote
                                                                                            ? "Cambiar lote"
                                                                                            : "Seleccionar lote"
                                                                                    }
                                                                                    className={`min-w-[150px] h-9 px-3 rounded-xl border font-semibold text-xs flex items-center justify-center gap-2 transition ${
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
                                                                                        ? detalle.lote?.lote ||
                                                                                          "Lote seleccionado"
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
                                                                                    {formatearNumero(
                                                                                        detalle.cantidadDisponible
                                                                                    )}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-xs text-slate-400">
                                                                                    Sin validar
                                                                                </span>
                                                                            )}
                                                                        </td>

                                                                        <td className="px-3 py-3">
                                                                            <input
                                                                                type="text"
                                                                                value={detalle.observacion}
                                                                                onChange={(event) =>
                                                                                    actualizarDetalle(
                                                                                        detalle.tempId,
                                                                                        {
                                                                                            observacion:
                                                                                                event.target.value,
                                                                                        }
                                                                                    )
                                                                                }
                                                                                placeholder="Opcional"
                                                                                className="w-full h-9 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                                                            />
                                                                        </td>

                                                                        <td className="px-3 py-3">
                                                                            <div className="flex justify-end">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() =>
                                                                                        eliminarDetalle(
                                                                                            detalle.tempId
                                                                                        )
                                                                                    }
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
                        onClick={cerrarModalCantidad}
                        className="absolute inset-0 bg-slate-950/60"
                    />

                    <section className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <header className="px-5 py-4 border-b border-slate-200 bg-white">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                                        <FaBoxes />
                                    </div>

                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-700">
                                            Cantidad de salida
                                        </p>

                                        <h2 className="mt-1 text-lg font-bold text-slate-900">
                                            Agregar producto
                                        </h2>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={cerrarModalCantidad}
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

                                <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="inline-flex px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold">
                                        {modalCantidad.producto?.unidadBaseInventario || "UND"}
                                    </span>

                                    {Number(modalCantidad.producto?.manejaLote) === 1 && (
                                        <span className="inline-flex px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                                            Maneja lote
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Cantidad a retirar
                                </label>

                                <input
                                    ref={inputCantidadModalRef}
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
                                onClick={cerrarModalCantidad}
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
                                        onClick={() =>
                                            abrirModalCantidadProducto(producto)
                                        }
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
                                                    Código barras:{" "}
                                                    {producto.codigoBarrasPrincipal ||
                                                        producto?.codigosBarras?.[0] ||
                                                        "Sin código"}
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

                                                    {Number(producto.manejaVencimiento) === 1 && (
                                                        <span className="inline-flex px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
                                                            Maneja vencimiento
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

            {modalLotes.visible && detalleLoteActivo && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6">
                    <button
                        type="button"
                        aria-label="Cerrar modal"
                        onClick={cerrarModalLotes}
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
                                            Lotes disponibles
                                        </p>

                                        <h2 className="mt-1 text-xl font-bold text-slate-900">
                                            {detalleLoteActivo.descripcion}
                                        </h2>

                                        <p className="text-sm text-slate-500">
                                            Selecciona un lote con existencia disponible.
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={cerrarModalLotes}
                                    disabled={cargandoLotes}
                                    className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 disabled:opacity-60 transition"
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        </header>

                        <div className="flex-1 overflow-y-auto p-5">
                            <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5">
                                <aside className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden h-fit xl:order-1">
                                    <div className="px-5 py-4 border-b border-slate-200 bg-white">
                                        <h3 className="font-bold text-slate-900">
                                            Regla de salida
                                        </h3>

                                        <p className="text-sm text-slate-500">
                                            Se aplica según el tipo de documento.
                                        </p>
                                    </div>

                                    <div className="p-5 space-y-4">
                                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                Cantidad solicitada
                                            </p>

                                            <p className="mt-1 text-2xl font-bold text-slate-900">
                                                {formatearNumero(detalleLoteActivo.cantidad)}
                                            </p>

                                            <p className="text-xs text-slate-500">
                                                {detalleLoteActivo.unidad || "UND"}
                                            </p>
                                        </div>

                                        <div
                                            className={`rounded-xl border p-4 ${
                                                permiteLoteVencido
                                                    ? "border-amber-200 bg-amber-50"
                                                    : "border-emerald-200 bg-emerald-50"
                                            }`}
                                        >
                                            <div className="flex items-start gap-2">
                                                <FaExclamationTriangle
                                                    className={`mt-0.5 shrink-0 ${
                                                        permiteLoteVencido
                                                            ? "text-amber-700"
                                                            : "text-emerald-700"
                                                    }`}
                                                />

                                                <p
                                                    className={`text-xs leading-5 ${
                                                        permiteLoteVencido
                                                            ? "text-amber-800"
                                                            : "text-emerald-800"
                                                    }`}
                                                >
                                                    {reglaLotesTexto}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </aside>

                                <div className="space-y-4 xl:order-2">
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
                                                        cargarLotesProducto(
                                                            detalleLoteActivo,
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
                                                cargarLotesProducto(
                                                    detalleLoteActivo,
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

                                    {modalLotes.loteActivoId && (
                                        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                                            <div className="flex items-start gap-3">
                                                <FaCheckCircle className="mt-0.5 text-blue-800 shrink-0" />

                                                <p className="text-sm text-blue-900 leading-6">
                                                    Hay un único lote disponible para este producto. Quedó seleccionado automáticamente; presiona Enter para asignarlo.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {cargandoLotes ? (
                                        <div className="min-h-[260px] flex flex-col items-center justify-center gap-4">
                                            <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />

                                            <p className="text-sm font-medium text-slate-500">
                                                Cargando lotes disponibles...
                                            </p>
                                        </div>
                                    ) : modalLotes.lotes.length === 0 ? (
                                        <div className="min-h-[260px] rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-center px-6">
                                            <FaBarcode className="text-3xl text-slate-400" />

                                            <h3 className="mt-4 font-bold text-slate-800">
                                                No hay lotes disponibles
                                            </h3>

                                            <p className="mt-1 text-sm text-slate-500">
                                                No se encontraron lotes con existencia para este producto.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {modalLotes.lotes.map((lote) => {
                                                const disponible = Number(
                                                    lote.cantidadDisponible ?? 0
                                                );
                                                const cantidadSolicitada = Number(
                                                    detalleLoteActivo.cantidad ?? 0
                                                );
                                                const vigente = esLoteVigente(lote);
                                                const bloqueado =
                                                    disponible <= 0 ||
                                                    cantidadSolicitada > disponible ||
                                                    (!permiteLoteVencido && !vigente);

                                                return (
                                                    <button
                                                        type="button"
                                                        key={lote.idLote || lote.id}
                                                        ref={(element) => {
                                                            if (esLoteActivoAutomatico(lote)) {
                                                                botonLoteActivoRef.current =
                                                                    element;
                                                            }
                                                        }}
                                                        onClick={() => seleccionarLote(lote)}
                                                        disabled={bloqueado}
                                                        className={`w-full text-left rounded-2xl border p-4 transition focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                                                            bloqueado
                                                                ? "border-slate-200 bg-slate-50 opacity-70 cursor-not-allowed"
                                                                : esLoteActivoAutomatico(lote)
                                                                ? "border-blue-400 bg-blue-50 shadow-sm"
                                                                : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50"
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div>
                                                                <h3 className="font-bold text-slate-900">
                                                                    {lote.lote}
                                                                </h3>

                                                                <p className="mt-1 text-sm text-slate-500">
                                                                    {lote.nombreProducto || lote.producto}
                                                                </p>

                                                                <p className="mt-1 text-xs text-slate-500">
                                                                    Disponible:{" "}
                                                                    {formatearNumero(disponible)}
                                                                </p>

                                                                {lote.ubicacion && (
                                                                    <p className="mt-1 text-xs text-slate-500">
                                                                        Ubicación: {lote.ubicacion}
                                                                    </p>
                                                                )}
                                                            </div>

                                                            <div className="text-right">
                                                                <div className="flex flex-col items-end gap-2">
                                                                    <span
                                                                        className={`inline-flex px-3 py-1.5 rounded-full border text-xs font-bold ${
                                                                            esLoteActivoAutomatico(lote)
                                                                                ? "bg-blue-100 text-blue-800 border-blue-200"
                                                                                : bloqueado
                                                                                ? "bg-slate-100 text-slate-500 border-slate-200"
                                                                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                        }`}
                                                                    >
                                                                        {esLoteActivoAutomatico(lote)
                                                                            ? "Enter para seleccionar"
                                                                            : bloqueado
                                                                            ? "No disponible"
                                                                            : "Seleccionar"}
                                                                    </span>

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
                                                                    <p className="mt-2 text-xs text-slate-500">
                                                                        Vence: {lote.fechaVencimiento}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {cantidadSolicitada > disponible && (
                                                            <p className="mt-3 text-xs font-semibold text-rose-700">
                                                                La cantidad solicitada supera la existencia disponible.
                                                            </p>
                                                        )}

                                                        {!permiteLoteVencido && !vigente && (
                                                            <p className="mt-3 text-xs font-semibold text-rose-700">
                                                                Este tipo de salida no permite lotes vencidos.
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
                                            Finalizar salida
                                        </p>

                                        <h2 className="mt-1 text-lg font-bold text-slate-900">
                                            Confirmar movimiento
                                        </h2>
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
                                    Al finalizar, el sistema descontará existencias y generará los movimientos de inventario. Después no podrás editar esta salida.
                                </p>

                                <div className="mt-4 grid grid-cols-2 gap-2">
                                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                                        <p className="text-xs text-slate-500">
                                            Productos
                                        </p>
                                        <p className="text-xl font-bold text-slate-900">
                                            {detalles.length}
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                                        <p className="text-xs text-slate-500">
                                            Cantidad
                                        </p>
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
                                        Si algún producto no tiene existencia suficiente o incumple la regla de vencimiento, la finalización será bloqueada.
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
                                onClick={finalizarSalida}
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
