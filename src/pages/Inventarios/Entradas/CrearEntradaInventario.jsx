import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaArrowLeft,
    FaBarcode,
    FaBoxes,
    FaBoxOpen,
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
import { SeleccionarCompraEntrada } from "./SeleccionarCompraEntrada";

const API_BASE_ENTRADAS =
    "https://app.accionporcolombia.com/servicesPae/Inventario/Entradas/";

const API_BASE_PRODUCTOS =
    "https://app.accionporcolombia.com/servicesPae/Inventario/Productos/";

const API_BASE_LOTES =
    "https://app.accionporcolombia.com/servicesPae/Inventario/Lotes/";

export const CrearEntradaInventario = ({
    setSidebar,
    navegar,
}) => {
    const abrirMenu = () => setSidebar(true);
    const estadoPagina = (pagina) => navegar(pagina);

    const inputProductoRef = useRef(null);
    const guardadoEnCurso = useRef(false);
    const inputCantidadModalRef = useRef(null);
    const inputCantidadRefs = useRef({});
    const botonLoteActivoRef = useRef(null);


    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [buscandoProducto, setBuscandoProducto] =
        useState(false);
    const [cargandoLotes, setCargandoLotes] =
        useState(false);
    const [guardandoLote, setGuardandoLote] =
        useState(false);
    const [cargandoEdicion, setCargandoEdicion] =
        useState(false);
    const [edicionCargada, setEdicionCargada] =
        useState(false);
    const [entradaEditar, setEntradaEditar] =
        useState(null);

    const [tiposDocumentoEntrada, setTiposDocumentoEntrada] =
        useState([]);
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

    const [busquedaProducto, setBusquedaProducto] =
        useState("");

    const [detalles, setDetalles] = useState([]);
    const [ordenCompra, setOrdenCompra] = useState(null);
    const [modalCompra, setModalCompra] = useState(false);

    const cargarCompra = (orden, productos) => {
        setOrdenCompra(orden);
        setDetalles(productos.map((r) => ({
            tempId: `compra-${r.id}-${Date.now()}`, idOrdenCompraDetalle: Number(r.id),
            idProducto: Number(r.producto.idProducto), codigo: r.codigo,
            descripcion: r.producto.descripcion, unidad: r.producto.unidad || "UND",
            cantidadPedida: Number(r.cantidad), cantidadPendiente: Number(r.cantidadPendiente), cantidad: 0,
            manejaLote: Number(r.producto.manejaLote) === 1, manejaVencimiento: Number(r.producto.manejaVencimiento) === 1,
            idLote: null, lote: null, fechaVencimiento: null, observacion: "",
        })));
        setModalCompra(false);
    };

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

    const [detalleFocusId, setDetalleFocusId] = useState(null);

    const [modalLotes, setModalLotes] = useState({
        visible: false,
        detalleId: null,
        busqueda: "",
        lotes: [],
        loteActivoId: null,
        modoCrear: false,
    });

    const [formLote, setFormLote] = useState({
        lote: "",
        fechaFabricacion: "",
        fechaVencimiento: "",
        observacion: "",
    });

    const respuestaExitosa = (respuesta) =>
        respuesta?.rpta === "si" ||
        respuesta?.rpta === true;

    const filtrarTiposDocumentoEntrada = (tipos = []) => {
        const normalizar = (valor) =>
            String(valor ?? "")
                .trim()
                .toUpperCase()
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "");

        return tipos.filter((tipo) => {
            const codigo = normalizar(tipo?.codigo);
            const nombre = normalizar(tipo?.nombre);
            const descripcion = normalizar(tipo?.descripcion);
            const naturaleza = normalizar(tipo?.naturaleza);
            const estado = normalizar(
                tipo?.estado ?? tipo?.activo ?? tipo?.idEstado
            );
            const afectaInventario = normalizar(
                tipo?.afectaInventario
            );

            const texto = `${codigo} ${nombre} ${descripcion}`;
            const esEntrada =
                naturaleza === "ENTRADA" ||
                naturaleza === "ENT" ||
                codigo === "ENT" ||
                codigo.includes("ENTRADA") ||
                texto.includes("ENTRADA");

            const estaActivo =
                !["0", "INACTIVO", "INACTIVA", "NO", "FALSE"].includes(
                    estado
                );

            /*
             * Algunos servicios ya filtran los tipos que afectan inventario
             * y no incluyen la propiedad. Si viene informada, debe ser activa.
             */
            const afectaExistencias =
                afectaInventario === "" ||
                ["1", "SI", "TRUE"].includes(afectaInventario);

            return (
                esEntrada &&
                estaActivo &&
                afectaExistencias
            );
        });
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

            if (!valor) {
                continue;
            }

            try {
                const usuario = JSON.parse(valor);

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
                        nombre:
                            usuario?.nombre ??
                            usuario?.nombreCompleto ??
                            "",
                        correo: usuario?.correo ?? "",
                        telefono: usuario?.telefono ?? "",
                        rol: usuario?.rol ?? null,
                        rolNombre: usuario?.rolNombre ?? "",
                    };
                }
            } catch {
                const idPlano = Number(valor);

                if (idPlano > 0) {
                    return {
                        idUsuario: idPlano,
                    };
                }
            }
        }

        return null;
    };
    const usuarioSesion = useMemo(
        () => obtenerUsuarioSesion(),
        []
    );

    const obtenerEntradaEditarLocal = () => {
        const valor = localStorage.getItem(
            "entradaInventarioEditar"
        );

        if (!valor) {
            return null;
        }

        try {
            return JSON.parse(valor);
        } catch {
            return null;
        }
    };

    const obtenerIdDocumentoEntrada = (entrada) =>
        Number(
            entrada?.idDocumento ??
            entrada?.idEntrada ??
            entrada?.id ??
            0
        );

    useEffect(() => {
        setEntradaEditar(obtenerEntradaEditarLocal());
    }, []);

    const idDocumentoEdicion = useMemo(
        () => obtenerIdDocumentoEntrada(entradaEditar),
        [entradaEditar]
    );

    const modoEdicion = idDocumentoEdicion > 0;

    const cargarFormData = useCallback(async () => {
        setCargando(true);

        try {
            const params = new URLSearchParams();

            params.set("t", Date.now());

            if (usuarioSesion?.idUsuario) {
                params.set(
                    "idUsuario",
                    usuarioSesion.idUsuario
                );
            }

            const respuesta = await fetch(
                `${API_BASE_ENTRADAS}InventarioEntradasFormData.php?${params.toString()}`,
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
                    resultado?.mensaje ||
                    resultado?.error ||
                    "No fue posible consultar los datos del formulario."
                );
            }

            const data = resultado?.data || {};

            const tipos = Array.isArray(
                data?.tiposDocumento
            )
                ? data.tiposDocumento
                : [];

            const listaBodegas = Array.isArray(
                data?.bodegas
            )
                ? data.bodegas
                : [];

            const listaUbicaciones = Array.isArray(
                data?.ubicaciones
            )
                ? data.ubicaciones
                : [];

            const tiposEntrada =
                filtrarTiposDocumentoEntrada(tipos);
            const tipoEntradaPredeterminado =
                tiposEntrada[0] || null;

            setTiposDocumentoEntrada(tiposEntrada);
            setBodegas(listaBodegas);
            setUbicaciones(listaUbicaciones);
            setOperador(data?.operador || null);

            setForm((prev) => ({
                ...prev,
                fechaDocumento:
                    prev.fechaDocumento ||
                    data?.fechaActual ||
                    new Date()
                        .toISOString()
                        .substring(0, 10),
                idTipoDocumento:
                    prev.idTipoDocumento ||
                    (tipoEntradaPredeterminado?.idTipoDocumento ||
                        tipoEntradaPredeterminado?.id ||
                        ""),
                idBodega:
                    prev.idBodega ||
                    (listaBodegas[0]?.idBodega ||
                        listaBodegas[0]?.id ||
                        ""),
            }));

            setTimeout(() => {
                inputProductoRef.current?.focus();
            }, 250);
        } catch (error) {
            console.error(
                "Error cargando form data:",
                error
            );

            toast.error(
                error?.message ||
                "No fue posible cargar los datos de la entrada."
            );
        } finally {
            setCargando(false);
        }
    }, [usuarioSesion?.idUsuario]);


    const cargarEntradaEditar = useCallback(async () => {
        if (!idDocumentoEdicion) {
            return;
        }

        setCargandoEdicion(true);

        try {
            const params = new URLSearchParams();

            params.set("idDocumento", idDocumentoEdicion);
            params.set("t", Date.now());

            const respuesta = await fetch(
                `${API_BASE_ENTRADAS}InventarioEntradasDetalle.php?${params.toString()}`,
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
                    resultado?.mensaje ||
                    resultado?.error ||
                    "No fue posible consultar la entrada para edición."
                );
            }

            const data = resultado?.data || {};
            const documento = data?.documento || data?.entrada || {};
            setOrdenCompra(documento.ordenCompra || null);
            const estadoProceso = String(
                documento?.estadoProceso || "BORRADOR"
            )
                .trim()
                .toUpperCase();

            if (
                documento?.editable === false ||
                estadoProceso !== "BORRADOR"
            ) {
                localStorage.removeItem(
                    "entradaInventarioEditar"
                );

                toast.warning(
                    "Esta entrada ya fue finalizada y no se puede editar."
                );

                estadoPagina("EntradasInventario");
                return;
            }

            const listaDetalles = Array.isArray(data?.detalles)
                ? data.detalles
                : [];

            const detallesMapeados = listaDetalles.map(
                (detalle, indice) => {
                    const idLote = Number(
                        detalle?.idLote ?? 0
                    );

                    return {
                        tempId: `edit-${detalle?.idDocumentoDetalle || indice}-${Date.now()}`,
                        idOrdenCompraDetalle: detalle.idOrdenCompraDetalle || null,
                        cantidadPedida: detalle.cantidadPedida,
                        cantidadPendiente: detalle.cantidadPendiente,
                        idDocumentoDetalle:
                            detalle?.idDocumentoDetalle || null,
                        idProducto: Number(
                            detalle?.idProducto ?? 0
                        ),
                        codigo:
                            detalle?.codigoProducto ||
                            detalle?.codigo ||
                            "",
                        descripcion:
                            detalle?.descripcion ||
                            detalle?.producto ||
                            "Producto sin nombre",
                        unidad: detalle?.unidad || "UND",
                        cantidad:
                            detalle?.cantidad ??
                            detalle?.cantidadSolicitada ??
                            0,
                        manejaLote:
                            Number(detalle?.manejaLote ?? 0) ===
                            1,
                        manejaVencimiento:
                            Number(
                                detalle?.manejaVencimiento ?? 0
                            ) === 1,
                        idLote: idLote || null,
                        lote: idLote
                            ? {
                                id: idLote,
                                idLote,
                                lote: detalle?.lote,
                                fechaFabricacion:
                                    detalle?.fechaFabricacion,
                                fechaVencimiento:
                                    detalle?.fechaVencimiento,
                                fechaIngreso:
                                    detalle?.fechaIngreso,
                            }
                            : null,
                        fechaVencimiento:
                            detalle?.fechaVencimiento || null,
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
                }
            );

            const primerDetalle = detallesMapeados[0] || {};

            setForm((prev) => ({
                ...prev,
                idTipoDocumento:
                    documento?.idTipoDocumento ||
                    prev.idTipoDocumento,
                fechaDocumento:
                    documento?.fechaDocumento ||
                    prev.fechaDocumento,
                idBodega:
                    primerDetalle?.idBodega ||
                    documento?.idBodega ||
                    prev.idBodega,
                idUbicacion:
                    primerDetalle?.idUbicacion ||
                    documento?.idUbicacion ||
                    prev.idUbicacion,
                observacion:
                    documento?.observacion ?? prev.observacion,
            }));

            setDetalles(detallesMapeados);
            setEntradaEditar(documento);
            setEdicionCargada(true);

            setTimeout(() => {
                inputProductoRef.current?.focus();
            }, 250);
        } catch (error) {
            console.error(
                "Error cargando entrada para edición:",
                error
            );

            toast.error(
                error?.message ||
                "No fue posible cargar la entrada para edición."
            );
        } finally {
            setCargandoEdicion(false);
        }
    }, [
        idDocumentoEdicion,
        form.idBodega,
        form.idUbicacion,
    ]);

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

        cargarEntradaEditar();
    }, [
        cargando,
        cargandoEdicion,
        edicionCargada,
        idDocumentoEdicion,
        cargarEntradaEditar,
    ]);

    useEffect(() => {
        if (
            !modalProductos.visible &&
            !modalCantidad.visible &&
            !modalLotes.visible
        ) {
            return undefined;
        }

        const overflowAnterior =
            document.body.style.overflow;

        const cerrarConEscape = (event) => {
            if (event.key === "Escape") {
                cerrarModalProductos();
                cerrarModalCantidad();
                cerrarModalLotes();
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
        modalProductos.visible,
        modalCantidad.visible,
        modalLotes.visible,
    ]);

    useEffect(() => {
        if (!modalCantidad.visible) {
            return;
        }

        const timer = setTimeout(() => {
            inputCantidadModalRef.current?.focus();
            inputCantidadModalRef.current?.select();
        }, 120);

        return () => clearTimeout(timer);
    }, [modalCantidad.visible]);

    useEffect(() => {
        if (!detalleFocusId) {
            return;
        }

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
        if (!modalLotes.visible || !modalLotes.loteActivoId) {
            return undefined;
        }

        const timer = setTimeout(() => {
            botonLoteActivoRef.current?.focus();
        }, 180);

        return () => clearTimeout(timer);
    }, [
        modalLotes.visible,
        modalLotes.loteActivoId,
        modalLotes.lotes,
    ]);

    const ubicacionesFiltradas = useMemo(() => {
        const idBodega = Number(form.idBodega || 0);

        return ubicaciones.filter(
            (ubicacion) =>
                Number(ubicacion?.idBodega || 0) ===
                idBodega
        );
    }, [ubicaciones, form.idBodega]);

    useEffect(() => {
        if (!form.idBodega) {
            return;
        }

        const existeUbicacion = ubicacionesFiltradas.some(
            (ubicacion) =>
                Number(
                    ubicacion?.idUbicacion ??
                    ubicacion?.id
                ) === Number(form.idUbicacion)
        );

        if (!existeUbicacion) {
            setForm((prev) => ({
                ...prev,
                idUbicacion:
                    ubicacionesFiltradas[0]
                        ?.idUbicacion ||
                    ubicacionesFiltradas[0]?.id ||
                    "",
            }));
        }
    }, [
        form.idBodega,
        form.idUbicacion,
        ubicacionesFiltradas,
    ]);

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
        if (!fecha || fecha === "0000-00-00") {
            return "";
        }

        return String(fecha).substring(0, 10);
    };

    const esLoteVigente = (lote) => {
        const fechaVencimiento = normalizarFechaLote(
            lote?.fechaVencimiento
        );

        if (!fechaVencimiento) {
            return true;
        }

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
        `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;

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

    const eliminarDetalle = (tempId) => {
        setDetalles((prev) =>
            prev.filter(
                (detalle) => detalle.tempId !== tempId
            )
        );
    };

    const abrirModalCantidadProducto = (producto) => {
        if (ordenCompra) { toast.info("Esta entrada recibe los productos de la compra seleccionada. Usa otra entrada para productos adicionales."); return; }
        const idProducto = Number(
            producto?.idProducto ?? producto?.id ?? 0
        );

        if (!idProducto) {
            toast.error(
                "No se encontró el identificador del producto."
            );
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

        if (enfocarBusqueda) {
            enfocarBusquedaProducto();
        }
    };

    const agregarProductoDetalle = (
        producto,
        cantidadIngresada = 1
    ) => {
        const idProducto = Number(
            producto?.idProducto ?? producto?.id ?? 0
        );

        if (!idProducto) {
            toast.error(
                "No se encontró el identificador del producto."
            );
            return;
        }

        const cantidadFinal = Number(
            String(cantidadIngresada).replace(",", ".")
        );

        if (!cantidadFinal || cantidadFinal <= 0) {
            toast.warning(
                "La cantidad debe ser mayor a cero."
            );
            return;
        }

        const manejaLote =
            Number(producto?.manejaLote ?? 0) === 1;

        const manejaVencimiento =
            Number(producto?.manejaVencimiento ?? 0) ===
            1 ||
            Number(
                producto?.requiereFechaVencimiento ?? 0
            ) === 1;

        const existenteActual = detalles.find((item) => {
            const mismoProducto =
                Number(item.idProducto) === idProducto;

            if (!mismoProducto) {
                return false;
            }

            if (!manejaLote) {
                return true;
            }

            return !item.idLote;
        });

        const tempIdParaFocus =
            existenteActual?.tempId || generarTempId();

        setDetalles((prev) => {
            const existente = prev.find((item) => {
                const mismoProducto =
                    Number(item.idProducto) === idProducto;

                if (!mismoProducto) {
                    return false;
                }

                if (!manejaLote) {
                    return true;
                }

                return !item.idLote;
            });

            if (existente) {
                return prev.map((item) =>
                    item.tempId === existente.tempId
                        ? {
                            ...item,
                            cantidad:
                                Number(
                                    item.cantidad ?? 0
                                ) + cantidadFinal,
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
                    descripcion:
                        productoDescripcion(producto),
                    unidad:
                        producto?.unidadBaseInventario ||
                        "UND",
                    cantidad: cantidadFinal,
                    manejaLote,
                    manejaVencimiento,
                    idLote: null,
                    lote: null,
                    fechaVencimiento: null,
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
                fechaVencimiento:
                    existenteActual?.fechaVencimiento || null,
                idBodega: form.idBodega,
                idUbicacion: form.idUbicacion,
                observacion: existenteActual?.observacion || "",
            },
        };
    };

    const confirmarCantidadProducto = () => {
        const producto = modalCantidad.producto;
        const cantidad = Number(
            String(modalCantidad.cantidad).replace(",", ".")
        );

        if (!producto) {
            toast.error(
                "No se encontró el producto seleccionado."
            );
            return;
        }

        if (!cantidad || cantidad <= 0) {
            toast.warning(
                "Ingrese una cantidad mayor a cero."
            );
            inputCantidadModalRef.current?.focus();
            inputCantidadModalRef.current?.select();
            return;
        }

        const resultadoAgregado = agregarProductoDetalle(
            producto,
            cantidad
        );

        if (!resultadoAgregado) {
            return;
        }

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
        const busqueda = String(
            valor || busquedaProducto
        ).trim();

        if (!busqueda) {
            toast.info(
                "Digite o escanee un código, nombre o código de barras."
            );
            inputProductoRef.current?.focus();
            return;
        }

        setBuscandoProducto(true);

        try {
            const params = new URLSearchParams();

            params.set("q", busqueda);
            params.set("limite", 20);
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
                    resultado?.mensaje ||
                    resultado?.error ||
                    "No fue posible buscar el producto."
                );
            }

            const productos = Array.isArray(
                resultado?.data
            )
                ? resultado.data
                : [];

            if (productos.length === 0) {
                toast.warning(
                    "No se encontró ningún producto con esa búsqueda."
                );
                return;
            }

            const exactos = productos.filter(
                (producto) =>
                    Number(
                        producto?.coincidenciaExacta ??
                        0
                    ) === 1
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
            console.error(
                "Error buscando producto:",
                error
            );

            toast.error(
                error?.message ||
                "No fue posible buscar el producto."
            );
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
        if (!modalLotes.detalleId) {
            return null;
        }

        return (
            detalles.find(
                (detalle) =>
                    detalle.tempId ===
                    modalLotes.detalleId
            ) || null
        );
    }, [detalles, modalLotes.detalleId]);

    const cargarLotesProducto = async (
        detalle,
        busqueda = ""
    ) => {
        if (!detalle?.idProducto) {
            return;
        }

        setCargandoLotes(true);

        try {
            const params = new URLSearchParams();

            params.set("idProducto", detalle.idProducto);
            params.set("estado", 1);
            params.set("limite", 100);
            params.set("t", Date.now());

            if (busqueda.trim()) {
                params.set("q", busqueda.trim());
            }

            const respuesta = await fetch(
                `${API_BASE_LOTES}InventarioLotesListar.php?${params.toString()}`,
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
                    resultado?.mensaje ||
                    resultado?.error ||
                    "No fue posible consultar los lotes."
                );
            }

            const lotes = Array.isArray(resultado?.data)
                ? resultado.data
                : [];

            const lotesVigentes = lotes.filter(esLoteVigente);

            const loteActivoId =
                lotesVigentes.length === 1
                    ? obtenerIdLote(lotesVigentes[0])
                    : null;

            setModalLotes((prev) => ({
                ...prev,
                lotes,
                loteActivoId,
            }));
        } catch (error) {
            console.error(
                "Error cargando lotes:",
                error
            );

            toast.error(
                error?.message ||
                "No fue posible cargar los lotes del producto."
            );
        } finally {
            setCargandoLotes(false);
        }
    };

    const abrirModalLotes = (detalle) => {
        if (!detalle?.manejaLote) {
            toast.info(
                "Este producto no requiere lote."
            );
            return;
        }

        setFormLote({
            lote: "",
            fechaFabricacion: "",
            fechaVencimiento: "",
            observacion: "",
        });

        setModalLotes({
            visible: true,
            detalleId: detalle.tempId,
            busqueda: "",
            lotes: [],
            loteActivoId: null,
            modoCrear: false,
        });

        cargarLotesProducto(detalle, "");
    };

    const cerrarModalLotes = (enfocarBusqueda = true) => {
        if (guardandoLote || cargandoLotes) {
            return;
        }

        setModalLotes({
            visible: false,
            detalleId: null,
            busqueda: "",
            lotes: [],
            loteActivoId: null,
            modoCrear: false,
        });

        setFormLote({
            lote: "",
            fechaFabricacion: "",
            fechaVencimiento: "",
            observacion: "",
        });

        if (enfocarBusqueda) {
            enfocarBusquedaProducto();
        }
    };

    const seleccionarLote = (lote) => {
        if (!detalleLoteActivo) {
            return;
        }

        actualizarDetalle(detalleLoteActivo.tempId, {
            idLote: Number(lote?.idLote ?? lote?.id),
            lote,
            fechaVencimiento: lote?.fechaVencimiento,
        });

        cerrarModalLotes(true);
    };

    const crearLote = async () => {
        if (!detalleLoteActivo) {
            toast.error(
                "No se encontró el producto para asociar el lote."
            );
            return;
        }

        if (!formLote.lote.trim()) {
            toast.warning(
                "Debe ingresar el número o código del lote."
            );
            return;
        }

        if (
            detalleLoteActivo.manejaVencimiento &&
            !formLote.fechaVencimiento
        ) {
            toast.warning(
                "Este producto requiere fecha de vencimiento."
            );
            return;
        }

        setGuardandoLote(true);

        try {
            const respuesta = await fetch(
                `${API_BASE_LOTES}InventarioLotesGuardar.php`,
                {
                    method: "POST",
                    cache: "no-store",
                    headers: {
                        "Content-Type":
                            "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify({
                        idProducto:
                            detalleLoteActivo.idProducto,
                        lote: formLote.lote.trim(),
                        fechaFabricacion:
                            formLote.fechaFabricacion,
                        fechaVencimiento:
                            formLote.fechaVencimiento,
                        fechaIngreso: form.fechaDocumento,
                        observacion: formLote.observacion,
                        estado: 1,
                    }),
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
                    resultado?.mensaje ||
                    resultado?.error ||
                    "No fue posible crear el lote."
                );
            }

            toast.success(
                resultado?.mensaje ||
                "Lote guardado correctamente."
            );

            seleccionarLote(resultado.data);
        } catch (error) {
            console.error("Error creando lote:", error);

            toast.error(
                error?.message ||
                "No fue posible crear el lote."
            );
        } finally {
            setGuardandoLote(false);
        }
    };

    const validarFormulario = () => {
        if (!usuarioSesion?.idUsuario) {
            toast.error(
                "No se pudo identificar el usuario de la sesión."
            );
            return false;
        }

        if (!form.idTipoDocumento) {
            toast.warning(
                "Debe seleccionar el tipo de documento de la entrada."
            );
            return false;
        }

        if (!form.fechaDocumento) {
            toast.warning(
                "Debe seleccionar la fecha de la entrada."
            );
            return false;
        }

        if (!form.idBodega) {
            toast.warning(
                "Debe seleccionar la bodega destino."
            );
            return false;
        }

        if (!form.idUbicacion) {
            toast.warning(
                "Debe seleccionar la ubicación destino."
            );
            return false;
        }

        if (detalles.length === 0) {
            toast.warning(
                "Debe agregar al menos un producto."
            );
            inputProductoRef.current?.focus();
            return false;
        }

        for (const detalle of detalles) {
            const cantidad = Number(detalle.cantidad ?? 0);
            if (ordenCompra && cantidad === 0) continue;
            if (!Number.isFinite(cantidad)) { toast.warning("La cantidad recibida no es válida."); return false; }

            if (cantidad <= 0) {
                toast.warning(
                    `La cantidad de ${detalle.descripcion} debe ser mayor a cero.`
                );
                return false;
            }

            if (
                detalle.manejaLote &&
                !Number(detalle.idLote || 0)
            ) {
                toast.warning(
                    `Debe seleccionar o crear un lote para ${detalle.descripcion}.`
                );
                return false;
            }

            if (
                detalle.manejaVencimiento &&
                detalle.manejaLote &&
                !detalle.fechaVencimiento
            ) {
                toast.warning(
                    `El lote de ${detalle.descripcion} debe tener fecha de vencimiento.`
                );
                return false;
            }
        }

        return true;
    };

    const guardarEntrada = async () => {
        if (guardadoEnCurso.current) return;
        if (ordenCompra) {
            if (!detalles.some(d => Number(d.cantidad) > 0)) { toast.warning("Ingresa al menos una cantidad recibida."); return; }
            const sumas = {};
            for (const d of detalles) {
                sumas[d.idOrdenCompraDetalle] = (sumas[d.idOrdenCompraDetalle] || 0) + Number(d.cantidad);
                if (sumas[d.idOrdenCompraDetalle] > Number(d.cantidadPendiente) + 0.0000001) { toast.warning(`La cantidad recibida de ${d.descripcion} supera el pendiente.`); return; }
            }
        }
        if (!validarFormulario()) {
            return;
        }

        guardadoEnCurso.current = true;
        setGuardando(true);

        try {
            const payload = {
                correoSesion: JSON.parse(localStorage.getItem("us") || "{}")?.correo || "",
                tokenSesion: localStorage.getItem("st") || "",
                idOrdenCompra: ordenCompra?.id || null,
                idDocumento: modoEdicion
                    ? idDocumentoEdicion
                    : undefined,
                idEntrada: modoEdicion
                    ? idDocumentoEdicion
                    : undefined,
                idUsuarioRegistro:
                    usuarioSesion.idUsuario,
                idUsuario: usuarioSesion.idUsuario,
                idOperador:
                    operador?.idOperador || undefined,
                idTipoDocumento: Number(
                    form.idTipoDocumento
                ),
                fechaDocumento: form.fechaDocumento,
                observacion: form.observacion,
                detalles: detalles.filter(d => !ordenCompra || Number(d.cantidad) !== 0).map((detalle) => ({
                    idOrdenCompraDetalle: detalle.idOrdenCompraDetalle || null,
                    idProducto: Number(
                        detalle.idProducto
                    ),
                    cantidad: Number(detalle.cantidad),
                    unidad: detalle.unidad || "UND",
                    idBodega: Number(form.idBodega),
                    idUbicacion: Number(
                        form.idUbicacion
                    ),
                    idLote: detalle.idLote
                        ? Number(detalle.idLote)
                        : null,
                    observacion:
                        detalle.observacion || "",
                })),
            };

            const respuesta = await fetch(
                `${API_BASE_ENTRADAS}InventarioEntradasGuardar.php`,
                {
                    method: "POST",
                    cache: "no-store",
                    headers: {
                        "Content-Type":
                            "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify(payload),
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
                    resultado?.mensaje ||
                    resultado?.error ||
                    "No fue posible guardar la entrada."
                );
            }

            toast.success(
                resultado?.mensaje ||
                "Entrada guardada correctamente."
            );

            localStorage.removeItem(
                "entradaInventarioEditar"
            );

            localStorage.setItem(
                "entradaInventarioDetalle",
                JSON.stringify(resultado.data)
            );

            estadoPagina("EntradasInventario");
        } catch (error) {
            console.error(
                "Error guardando entrada:",
                error
            );

            toast.error(
                error?.message ||
                "No fue posible guardar la entrada."
            );
        } finally {
            guardadoEnCurso.current = false;
            setGuardando(false);
        }
    };

    const totalCantidad = useMemo(() => {
        return detalles.reduce(
            (total, detalle) =>
                total + Number(detalle.cantidad ?? 0),
            0
        );
    }, [detalles]);

    const volver = () => {
        estadoPagina("EntradasInventario");
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
                                    className="flex w-9 h-9 rounded-xl border border-slate-200 bg-white items-center justify-center text-slate-700 hover:bg-slate-50 transition"
                                    title="Volver"
                                >
                                    <FaArrowLeft />
                                </button>

                                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                                    <FaWarehouse className="text-lg text-blue-800" />
                                </div>

                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">
                                        Operación de inventarios
                                    </p>

                                    <h1 className="mt-0.5 text-xl md:text-2xl font-bold text-slate-900">
                                        {modoEdicion
                                            ? "Editar entrada"
                                            : "Nueva entrada"}
                                    </h1>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setModalCompra(true)}
                                    disabled={cargando || guardando || cargandoEdicion || detalles.length > 0}
                                    title={detalles.length ? "Retira los productos actuales antes de seleccionar otra compra" : "Seleccionar orden de compra (opcional)"}
                                    className="h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-50 transition disabled:opacity-50"
                                >
                                    <FaBoxOpen />
                                    Orden de compra
                                </button>

                                <button
                                    type="button"
                                    onClick={guardarEntrada}
                                    disabled={guardando || cargando || cargandoEdicion}
                                    className="h-10 px-4 rounded-xl bg-blue-800 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-blue-900 disabled:opacity-60 transition shadow-sm"
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
                            </div>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto">
                        {ordenCompra && <div className="m-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                            <strong>Compra {ordenCompra.tipoDocumento} · {ordenCompra.numero}</strong> — {ordenCompra.proveedor}
                            <p>Registra la cantidad recibida y sus lotes. Las líneas en cero quedarán pendientes. Los borradores no descuentan el pendiente.</p>
                            {detalles.length === 0 && <button type="button" disabled={guardando} className="mt-2 underline" onClick={() => setOrdenCompra(null)}>Continuar como entrada manual</button>}
                        </div>}
                        <div className="p-3 md:p-4">
                            {(cargando || cargandoEdicion) ? (
                                <div className="min-h-[420px] flex flex-col items-center justify-center gap-4">
                                    <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />

                                    <p className="text-sm font-medium text-slate-500">
                                        {cargandoEdicion ? "Cargando entrada..." : "Cargando formulario..."}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4 items-start">
                                    <aside className="space-y-4 xl:sticky xl:top-0">
                                        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                                                <h2 className="font-bold text-slate-900 text-sm">
                                                    Datos de la entrada
                                                </h2>

                                                <p className="text-xs text-slate-500">
                                                    Documento y destino.
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
                                                        Tipo de documento
                                                    </label>

                                                    <select
                                                        value={form.idTipoDocumento}
                                                        onChange={(event) =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                idTipoDocumento:
                                                                    event.target.value,
                                                            }))
                                                        }
                                                        disabled={
                                                            tiposDocumentoEntrada.length === 0
                                                        }
                                                        className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 disabled:bg-slate-100 disabled:text-slate-400 transition"
                                                    >
                                                        <option value="">
                                                            Seleccione
                                                        </option>

                                                        {tiposDocumentoEntrada.map(
                                                            (tipo) => {
                                                                const idTipo =
                                                                    tipo.idTipoDocumento ||
                                                                    tipo.id;
                                                                const nombreTipo =
                                                                    tipo.nombre ||
                                                                    tipo.descripcion ||
                                                                    "Tipo de entrada";

                                                                return (
                                                                    <option
                                                                        key={idTipo}
                                                                        value={idTipo}
                                                                    >
                                                                        {nombreTipo}
                                                                        {tipo.codigo
                                                                            ? ` (${tipo.codigo})`
                                                                            : ""}
                                                                    </option>
                                                                );
                                                            }
                                                        )}
                                                    </select>

                                                    {tiposDocumentoEntrada.length === 0 && (
                                                        <p className="mt-1 text-[11px] leading-4 text-amber-700">
                                                            No hay tipos de documento de
                                                            entrada activos que afecten
                                                            inventario.
                                                        </p>
                                                    )}
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">
                                                        Fecha entrada
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
                                                        Bodega destino
                                                    </label>

                                                    <select
                                                        value={form.idBodega}
                                                        onChange={(event) =>
                                                            setForm((prev) => ({
                                                                ...prev,
                                                                idBodega:
                                                                    event.target.value,
                                                                idUbicacion: "",
                                                            }))
                                                        }
                                                        className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                                    >
                                                        <option value="">
                                                            Seleccione
                                                        </option>

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
                                                    <label className="block text-xs font-bold text-slate-600 mb-1">
                                                        Ubicación destino
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
                                                        className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                                    >
                                                        <option value="">
                                                            Seleccione
                                                        </option>

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

                                                <button
                                                    type="button"
                                                    onClick={guardarEntrada}
                                                    disabled={guardando || cargando || cargandoEdicion}
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
                                            </div>
                                        </section>
                                    </aside>

                                    <div className="space-y-4">
                                        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                                                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
                                                    <div>
                                                        <h2 className="font-bold text-slate-900 text-sm">
                                                            Productos de la entrada
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
                                                            onClick={() =>
                                                                buscarProducto()
                                                            }
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
                                                            Busca un producto por nombre, código o escanea su código de barras para agregarlo a la entrada.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                                                        <table className="w-full min-w-[940px]">
                                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                                <tr>
                                                                    <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                                        Producto
                                                                    </th>

                                                                    <th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                                        {ordenCompra ? "Recibida" : "Cantidad"}
                                                                    </th>

                                                                    <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                                        Unidad
                                                                    </th>

                                                                    <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                                        Lote
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
                                                                                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-800 shrink-0">
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
                                                                            {detalle.idOrdenCompraDetalle && <p className="mb-1 text-xs text-slate-500">Pedida: {detalle.cantidadPedida}<br />Pendiente: {detalle.cantidadPendiente}</p>}
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
                                                                                aria-label={`Cantidad recibida ${detalle.codigo}`}
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
                                                                            {detalle.idOrdenCompraDetalle && detalle.manejaLote && <button type="button" className="block mx-auto mt-1 text-xs text-blue-700 hover:underline" disabled={guardando} onClick={() => setDetalles(prev => [...prev, { ...detalle, tempId: `lote-${Date.now()}-${Math.random()}`, cantidad: 0, idLote: null, lote: null, fechaVencimiento: null }])}>Otro lote</button>}
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
                                                                                        abrirModalLotes(
                                                                                            detalle
                                                                                        )
                                                                                    }
                                                                                    title={detalle.idLote ? "Cambiar o editar lote" : "Agregar lote"}
                                                                                    className={`min-w-[150px] h-9 px-3 rounded-xl border font-semibold text-xs flex items-center justify-center gap-2 transition ${detalle.idLote
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
                                                                                    Vence:{" "}
                                                                                    {
                                                                                        detalle.fechaVencimiento
                                                                                    }
                                                                                </p>
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
                                    <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-800 shrink-0">
                                        <FaBoxes />
                                    </div>

                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                                            Cantidad de entrada
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
                                    {productoDescripcion(
                                        modalCantidad.producto
                                    )}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                    Código: {modalCantidad.producto?.codigo || "N/A"}
                                </p>

                                <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="inline-flex px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-bold">
                                        {modalCantidad.producto?.unidadBaseInventario || "UND"}
                                    </span>

                                    {Number(
                                        modalCantidad.producto?.manejaLote
                                    ) === 1 && (
                                            <span className="inline-flex px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                                                Maneja lote
                                            </span>
                                        )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Cantidad a ingresar
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
                                            Resultados para “
                                            {
                                                modalProductos.busqueda
                                            }
                                            ”
                                        </h2>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={
                                        cerrarModalProductos
                                    }
                                    className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 transition"
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        </header>

                        <div className="flex-1 overflow-y-auto p-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {modalProductos.resultados.map(
                                    (producto) => (
                                        <button
                                            type="button"
                                            key={
                                                producto.idProducto ||
                                                producto.id
                                            }
                                            onClick={() =>
                                                abrirModalCantidadProducto(
                                                    producto
                                                )
                                            }
                                            className="text-left rounded-2xl border border-slate-200 bg-white p-4 hover:border-blue-300 hover:bg-blue-50 transition"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-800 shrink-0">
                                                    <FaBoxes />
                                                </div>

                                                <div className="min-w-0">
                                                    <h3 className="font-bold text-slate-900">
                                                        {productoDescripcion(
                                                            producto
                                                        )}
                                                    </h3>

                                                    <p className="mt-1 text-sm text-slate-500">
                                                        Código:{" "}
                                                        {producto.codigo ||
                                                            "N/A"}
                                                    </p>

                                                    <p className="mt-1 text-sm text-slate-500">
                                                        Código barras:{" "}
                                                        {producto.codigoBarrasPrincipal ||
                                                            producto
                                                                ?.codigosBarras?.[0] ||
                                                            "Sin código"}
                                                    </p>

                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        <span className="inline-flex px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                                                            {producto.unidadBaseInventario ||
                                                                "UND"}
                                                        </span>

                                                        {Number(
                                                            producto.manejaLote
                                                        ) ===
                                                            1 && (
                                                                <span className="inline-flex px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                                                                    Maneja lote
                                                                </span>
                                                            )}

                                                        {Number(
                                                            producto.manejaVencimiento
                                                        ) ===
                                                            1 && (
                                                                <span className="inline-flex px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
                                                                    Maneja vencimiento
                                                                </span>
                                                            )}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    )
                                )}
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
                                            Lotes del producto
                                        </p>

                                        <h2 className="mt-1 text-xl font-bold text-slate-900">
                                            {
                                                detalleLoteActivo.descripcion
                                            }
                                        </h2>

                                        <p className="text-sm text-slate-500">
                                            Selecciona, cambia o crea un lote para este producto.
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={cerrarModalLotes}
                                    disabled={
                                        guardandoLote ||
                                        cargandoLotes
                                    }
                                    className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 disabled:opacity-60 transition"
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        </header>

                        <div className="flex-1 overflow-y-auto p-5">
                            <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5">
                                <div className="space-y-4 xl:order-2">
                                    <div className="flex flex-col md:flex-row gap-3">
                                        <div className="relative flex-1">
                                            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                                            <input
                                                type="text"
                                                value={
                                                    modalLotes.busqueda
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setModalLotes(
                                                        (
                                                            prev
                                                        ) => ({
                                                            ...prev,
                                                            busqueda:
                                                                event
                                                                    .target
                                                                    .value,
                                                        })
                                                    )
                                                }
                                                onKeyDown={(
                                                    event
                                                ) => {
                                                    if (
                                                        event.key ===
                                                        "Enter"
                                                    ) {
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
                                            disabled={
                                                cargandoLotes
                                            }
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
                                                    Hay un único lote vigente para este producto. Quedó seleccionado automáticamente; presiona Enter para asignarlo.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {cargandoLotes ? (
                                        <div className="min-h-[260px] flex flex-col items-center justify-center gap-4">
                                            <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />

                                            <p className="text-sm font-medium text-slate-500">
                                                Cargando lotes...
                                            </p>
                                        </div>
                                    ) : modalLotes.lotes
                                        .length === 0 ? (
                                        <div className="min-h-[260px] rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-center px-6">
                                            <FaBarcode className="text-3xl text-slate-400" />

                                            <h3 className="mt-4 font-bold text-slate-800">
                                                No hay lotes disponibles
                                            </h3>

                                            <p className="mt-1 text-sm text-slate-500">
                                                Crea un nuevo lote para este producto.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {modalLotes.lotes.map(
                                                (lote) => (
                                                    <button
                                                        type="button"
                                                        key={
                                                            lote.idLote ||
                                                            lote.id
                                                        }
                                                        ref={(element) => {
                                                            if (
                                                                esLoteActivoAutomatico(
                                                                    lote
                                                                )
                                                            ) {
                                                                botonLoteActivoRef.current =
                                                                    element;
                                                            }
                                                        }}
                                                        onClick={() =>
                                                            seleccionarLote(
                                                                lote
                                                            )
                                                        }
                                                        className={`w-full text-left rounded-2xl border p-4 transition focus:outline-none focus:ring-2 focus:ring-blue-300 ${esLoteActivoAutomatico(
                                                            lote
                                                        )
                                                            ? "border-blue-400 bg-blue-50 shadow-sm"
                                                            : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50"
                                                            }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div>
                                                                <h3 className="font-bold text-slate-900">
                                                                    {
                                                                        lote.lote
                                                                    }
                                                                </h3>

                                                                <p className="mt-1 text-sm text-slate-500">
                                                                    {lote.nombreProducto ||
                                                                        lote.producto}
                                                                </p>

                                                                <p className="mt-1 text-xs text-slate-500">
                                                                    Disponible:{" "}
                                                                    {formatearNumero(
                                                                        lote.cantidadDisponible
                                                                    )}
                                                                </p>
                                                            </div>

                                                            <div className="text-right">
                                                                <div className="flex flex-col items-end gap-2">
                                                                    <span
                                                                        className={`inline-flex px-3 py-1.5 rounded-full border text-xs font-bold ${esLoteActivoAutomatico(
                                                                            lote
                                                                        )
                                                                            ? "bg-blue-100 text-blue-800 border-blue-200"
                                                                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                            }`}
                                                                    >
                                                                        {esLoteActivoAutomatico(
                                                                            lote
                                                                        )
                                                                            ? "Enter para seleccionar"
                                                                            : "Seleccionar"}
                                                                    </span>

                                                                    {esLoteVigente(
                                                                        lote
                                                                    ) ? (
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
                                                                        Vence:{" "}
                                                                        {
                                                                            lote.fechaVencimiento
                                                                        }
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </button>
                                                )
                                            )}
                                        </div>
                                    )}
                                </div>

                                <aside className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden h-fit xl:order-1">
                                    <div className="px-5 py-4 border-b border-slate-200 bg-white">
                                        <h3 className="font-bold text-slate-900">
                                            Crear nuevo lote
                                        </h3>

                                        <p className="text-sm text-slate-500">
                                            Se crea asociado a este producto.
                                        </p>
                                    </div>

                                    <div className="p-5 space-y-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                Número / código lote
                                            </label>

                                            <input
                                                type="text"
                                                value={
                                                    formLote.lote
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setFormLote(
                                                        (
                                                            prev
                                                        ) => ({
                                                            ...prev,
                                                            lote: event
                                                                .target
                                                                .value,
                                                        })
                                                    )
                                                }
                                                placeholder="Ej: LT-2026-001"
                                                className="w-full h-11 px-4 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                Fecha fabricación
                                            </label>

                                            <input
                                                type="date"
                                                value={
                                                    formLote.fechaFabricacion
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setFormLote(
                                                        (
                                                            prev
                                                        ) => ({
                                                            ...prev,
                                                            fechaFabricacion:
                                                                event
                                                                    .target
                                                                    .value,
                                                        })
                                                    )
                                                }
                                                className="w-full h-11 px-4 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                Fecha vencimiento{" "}
                                                {detalleLoteActivo.manejaVencimiento && (
                                                    <span className="text-rose-600">
                                                        *
                                                    </span>
                                                )}
                                            </label>

                                            <input
                                                type="date"
                                                value={
                                                    formLote.fechaVencimiento
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setFormLote(
                                                        (
                                                            prev
                                                        ) => ({
                                                            ...prev,
                                                            fechaVencimiento:
                                                                event
                                                                    .target
                                                                    .value,
                                                        })
                                                    )
                                                }
                                                className="w-full h-11 px-4 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                                Observación
                                            </label>

                                            <textarea
                                                value={
                                                    formLote.observacion
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setFormLote(
                                                        (
                                                            prev
                                                        ) => ({
                                                            ...prev,
                                                            observacion:
                                                                event
                                                                    .target
                                                                    .value,
                                                        })
                                                    )
                                                }
                                                rows={3}
                                                placeholder="Opcional"
                                                className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition resize-none"
                                            />
                                        </div>

                                        <button
                                            type="button"
                                            onClick={crearLote}
                                            disabled={
                                                guardandoLote
                                            }
                                            className="w-full h-11 rounded-xl bg-blue-800 text-white font-semibold flex items-center justify-center gap-2 hover:bg-blue-900 disabled:opacity-60 transition"
                                        >
                                            {guardandoLote ? (
                                                <FaSyncAlt className="animate-spin" />
                                            ) : (
                                                <FaPlus />
                                            )}
                                            Crear y seleccionar
                                        </button>
                                    </div>
                                </aside>
                            </div>
                        </div>
                    </section>
                </div>
            )}
            {modalCompra && <SeleccionarCompraEntrada cerrar={() => setModalCompra(false)} seleccionar={cargarCompra} />}
        </>
    );
};
