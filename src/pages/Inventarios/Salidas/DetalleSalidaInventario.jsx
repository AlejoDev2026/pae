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
    FaCalendarAlt,
    FaCheckCircle,
    FaClipboardList,
    FaEdit,
    FaExclamationTriangle,
    FaEye,
    FaFileInvoice,
    FaInfoCircle,
    FaMapMarkerAlt,
    FaSave,
    FaSyncAlt,
    FaTimes,
    FaUserCheck,
    FaWarehouse,
} from "react-icons/fa";
import { toast } from "react-toastify";

const API_BASE_SALIDAS =
    "https://app.accionporcolombia.com/servicesPae/Inventario/Salidas/";

export const DetalleSalidaInventario = ({
    setSidebar,
    navegar,
}) => {
    const abrirMenu = () => setSidebar(true);
    const estadoPagina = useCallback(
        (pagina) => navegar(pagina),
        [navegar]
    );

    const consultaDetalleRef = useRef(false);

    const [cargando, setCargando] = useState(true);
    const [finalizando, setFinalizando] = useState(false);

    const [salida, setSalida] = useState(null);
    const [detalles, setDetalles] = useState([]);
    const [movimientos, setMovimientos] = useState([]);

    const [modalFinalizar, setModalFinalizar] = useState(false);
    const [modalMovimientoDetalle, setModalMovimientoDetalle] = useState({
        visible: false,
        detalle: null,
    });

    const respuestaExitosa = (respuesta) =>
        respuesta?.rpta === "si" ||
        respuesta?.rpta === true;

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

                const posibleUsuario =
                    usuario?.usuario ||
                    usuario?.user ||
                    usuario?.data ||
                    usuario;

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
                        correo: posibleUsuario?.correo ?? "",
                        rol: posibleUsuario?.rol ?? null,
                        rolNombre:
                            posibleUsuario?.rolNombre ?? "",
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

    const obtenerSalidaLocal = () => {
        const valor = localStorage.getItem(
            "salidaInventarioDetalle"
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

    const obtenerIdSalida = useCallback(() => {
        const salidaLocal = obtenerSalidaLocal();

        return Number(
            salidaLocal?.idDocumento ??
                salidaLocal?.idSalida ??
                salidaLocal?.id ??
                0
        );
    }, []);

    const cargarDetalle = useCallback(async () => {
        if (consultaDetalleRef.current) {
            return;
        }

        const idSalida = obtenerIdSalida();

        if (!idSalida) {
            toast.warning(
                "No se encontró la salida seleccionada."
            );
            estadoPagina("SalidasInventario");
            return;
        }

        consultaDetalleRef.current = true;
        setCargando(true);

        try {
            const params = new URLSearchParams();

            params.set("idDocumento", idSalida);
            params.set("idSalida", idSalida);
            params.set("t", Date.now());

            const respuesta = await fetch(
                `${API_BASE_SALIDAS}InventarioSalidasDetalle.php?${params.toString()}`,
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
                        "No fue posible consultar el detalle de la salida."
                );
            }

            const data = resultado?.data || {};

            const documento =
                data?.documento ||
                data?.salida ||
                data ||
                null;

            const listaDetalles = Array.isArray(
                data?.detalles
            )
                ? data.detalles
                : [];

            const listaMovimientos = Array.isArray(
                data?.movimientos
            )
                ? data.movimientos
                : [];

            setSalida(documento);
            setDetalles(listaDetalles);
            setMovimientos(listaMovimientos);

            localStorage.setItem(
                "salidaInventarioDetalle",
                JSON.stringify(documento)
            );
        } catch (error) {
            console.error(
                "Error consultando detalle:",
                error
            );

            toast.error(
                error?.message ||
                    "No fue posible consultar el detalle de la salida."
            );

            estadoPagina("SalidasInventario");
        } finally {
            consultaDetalleRef.current = false;
            setCargando(false);
        }
    }, [estadoPagina, obtenerIdSalida]);

    useEffect(() => {
        cargarDetalle();
    }, [cargarDetalle]);

    useEffect(() => {
        if (
            !modalFinalizar &&
            !modalMovimientoDetalle.visible
        ) {
            return undefined;
        }

        const overflowAnterior =
            document.body.style.overflow;

        const cerrarConEscape = (event) => {
            if (event.key === "Escape") {
                cerrarModalFinalizar();
                cerrarModalMovimientoDetalle();
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
    }, [modalFinalizar, modalMovimientoDetalle.visible]);

    const obtenerEstadoProceso = (item = salida) =>
        String(
            item?.estadoProceso ||
                item?.estadoProcesoTexto ||
                "BORRADOR"
        )
            .trim()
            .toUpperCase();

    const esEditable = () => {
        if (!salida) {
            return false;
        }

        if (typeof salida?.editable === "boolean") {
            return salida.editable;
        }

        return obtenerEstadoProceso() === "BORRADOR";
    };

    const esFinalizable = () => {
        if (!salida) {
            return false;
        }

        if (typeof salida?.finalizable === "boolean") {
            return salida.finalizable;
        }

        return obtenerEstadoProceso() === "BORRADOR";
    };

    const textoEstadoProceso = () => {
        const estado = obtenerEstadoProceso();

        if (estado === "FINALIZADA") {
            return "Finalizada";
        }

        if (estado === "ANULADA") {
            return "Anulada";
        }

        return "Borrador";
    };

    const claseEstadoProceso = () => {
        const estado = obtenerEstadoProceso();

        if (estado === "FINALIZADA") {
            return "bg-emerald-50 text-emerald-700 border-emerald-200";
        }

        if (estado === "ANULADA") {
            return "bg-rose-50 text-rose-700 border-rose-200";
        }

        return "bg-amber-50 text-amber-700 border-amber-200";
    };

    const iconoEstadoProceso = () => {
        const estado = obtenerEstadoProceso();

        if (estado === "FINALIZADA") {
            return <FaCheckCircle />;
        }

        return <FaExclamationTriangle />;
    };

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

        const fechaTexto = String(fecha).substring(0, 10);
        const partes = fechaTexto.split("-");

        if (partes.length !== 3) {
            return fecha;
        }

        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    };

    const formatearFechaHora = (fecha) => {
        if (!fecha) {
            return "Sin fecha";
        }

        const texto = String(fecha).trim();

        const fechaTexto = texto.substring(0, 10);
        const partes = fechaTexto.split("-");

        if (partes.length !== 3) {
            return texto;
        }

        const horaTexto = texto.includes("T")
            ? texto.split("T")[1]?.substring(0, 8)
            : texto.split(" ")[1]?.substring(0, 8);

        const fechaFormateada = `${partes[2]}/${partes[1]}/${partes[0]}`;

        if (!horaTexto) {
            return fechaFormateada;
        }

        return `${fechaFormateada} ${horaTexto}`;
    };

    const loteEstaVencido = (item) => {
        if (typeof item?.vencido === "boolean") {
            return item.vencido;
        }

        if (Number(item?.vencido ?? 0) === 1) {
            return true;
        }

        const fecha = item?.fechaVencimiento;

        if (
            !fecha ||
            String(fecha).trim() === "" ||
            fecha === "0000-00-00"
        ) {
            return false;
        }

        return String(fecha).substring(0, 10) <
            new Date().toISOString().substring(0, 10);
    };

    const totalCantidad = useMemo(() => {
        if (salida?.totalCantidad !== undefined) {
            return Number(salida.totalCantidad ?? 0);
        }

        return detalles.reduce(
            (total, detalle) =>
                total + Number(detalle?.cantidad ?? 0),
            0
        );
    }, [salida, detalles]);

    const totalProductos = useMemo(() => {
        if (salida?.totalProductos !== undefined) {
            return Number(salida.totalProductos ?? 0);
        }

        return detalles.length;
    }, [salida, detalles]);

    const totalMovimientos = useMemo(() => {
        if (salida?.totalMovimientos !== undefined) {
            return Number(salida.totalMovimientos ?? 0);
        }

        return movimientos.length;
    }, [salida, movimientos]);

    const permiteLoteVencido = Number(
        salida?.permiteLoteVencido ?? 0
    ) === 1;

    const obtenerIdDetalle = (item) =>
        Number(
            item?.idDocumentoDetalle ??
                item?.idDetalle ??
                0
        );

    const obtenerIdProducto = (item) =>
        Number(item?.idProducto ?? 0);

    const obtenerIdLote = (item) =>
        Number(item?.idLote ?? 0);

    const obtenerMovimientosDetalle = useCallback(
        (detalle) => {
            if (!detalle) {
                return [];
            }

            const idDocumentoDetalle =
                obtenerIdDetalle(detalle);
            const idProducto = obtenerIdProducto(detalle);
            const idLote = obtenerIdLote(detalle);

            return movimientos.filter((movimiento) => {
                const mismoDetalle =
                    idDocumentoDetalle > 0 &&
                    obtenerIdDetalle(movimiento) ===
                        idDocumentoDetalle;

                if (mismoDetalle) {
                    return true;
                }

                const mismoProducto =
                    idProducto > 0 &&
                    obtenerIdProducto(movimiento) ===
                        idProducto;

                const mismoLote =
                    idLote <= 0 ||
                    obtenerIdLote(movimiento) === idLote;

                return mismoProducto && mismoLote;
            });
        },
        [movimientos]
    );

    const abrirModalMovimientoDetalle = (detalle) => {
        setModalMovimientoDetalle({
            visible: true,
            detalle,
        });
    };

    const cerrarModalMovimientoDetalle = () => {
        setModalMovimientoDetalle({
            visible: false,
            detalle: null,
        });
    };

    const movimientosDetalleSeleccionado = useMemo(
        () =>
            obtenerMovimientosDetalle(
                modalMovimientoDetalle.detalle
            ),
        [
            modalMovimientoDetalle.detalle,
            obtenerMovimientosDetalle,
        ]
    );

    const volver = () => {
        estadoPagina("SalidasInventario");
    };

    const editarSalida = () => {
        if (!salida) {
            return;
        }

        if (!esEditable()) {
            toast.warning(
                "Esta salida ya fue finalizada y no se puede editar."
            );
            return;
        }

        localStorage.setItem(
            "salidaInventarioEditar",
            JSON.stringify(salida)
        );

        localStorage.setItem(
            "salidaInventarioDetalle",
            JSON.stringify(salida)
        );

        estadoPagina("CrearSalidaInventario");
    };

    const abrirModalFinalizar = () => {
        if (!esFinalizable()) {
            toast.warning(
                "Esta salida ya fue finalizada o no se puede finalizar."
            );
            return;
        }

        setModalFinalizar(true);
    };

    const cerrarModalFinalizar = () => {
        if (finalizando) {
            return;
        }

        setModalFinalizar(false);
    };

    const finalizarSalida = async () => {
        const idDocumento = Number(
            salida?.idDocumento ??
                salida?.idSalida ??
                salida?.id ??
                0
        );

        if (!idDocumento) {
            toast.error(
                "No se pudo identificar la salida para finalizar."
            );
            return;
        }

        if (!usuarioSesion?.idUsuario) {
            toast.error(
                "No se pudo identificar el usuario de la sesión."
            );
            return;
        }

        setFinalizando(true);

        try {
            const respuesta = await fetch(
                `${API_BASE_SALIDAS}InventarioSalidasFinalizar.php`,
                {
                    method: "POST",
                    cache: "no-store",
                    headers: {
                        "Content-Type":
                            "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify({
                        idDocumento,
                        idSalida: idDocumento,
                        idUsuario: usuarioSesion.idUsuario,
                        idUsuarioFinaliza:
                            usuarioSesion.idUsuario,
                        idOperador:
                            salida?.idOperador || undefined,
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
                        "No fue posible finalizar la salida."
                );
            }

            toast.success(
                resultado?.mensaje ||
                    "Salida finalizada correctamente."
            );

            cerrarModalFinalizar();

            localStorage.setItem(
                "salidaInventarioDetalle",
                JSON.stringify(resultado.data)
            );

            await cargarDetalle();
        } catch (error) {
            console.error(
                "Error finalizando salida:",
                error
            );

            toast.error(
                error?.message ||
                    "No fue posible finalizar la salida."
            );
        } finally {
            setFinalizando(false);
        }
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
                                    <FaFileInvoice className="text-lg text-rose-700" />
                                </div>

                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-rose-700">
                                        Operación de inventarios
                                    </p>

                                    <h1 className="mt-0.5 text-xl md:text-2xl font-bold text-slate-900">
                                        Detalle de salida
                                    </h1>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={volver}
                                    className="h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-slate-50 transition"
                                >
                                    <FaArrowLeft />
                                    Volver
                                </button>

                                {salida && esEditable() && (
                                    <button
                                        type="button"
                                        onClick={editarSalida}
                                        className="h-10 px-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-amber-100 transition"
                                    >
                                        <FaEdit />
                                        Editar
                                    </button>
                                )}

                                {salida && esFinalizable() && (
                                    <button
                                        type="button"
                                        onClick={abrirModalFinalizar}
                                        className="h-10 px-4 rounded-xl bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-800 transition shadow-sm"
                                    >
                                        <FaCheckCircle />
                                        Finalizar
                                    </button>
                                )}
                            </div>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto">
                        <div className="p-3 md:p-4">
                            {cargando ? (
                                <div className="min-h-[420px] flex flex-col items-center justify-center gap-4">
                                    <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />

                                    <p className="text-sm font-medium text-slate-500">
                                        Cargando detalle de salida...
                                    </p>
                                </div>
                            ) : !salida ? (
                                <div className="min-h-[420px] flex flex-col items-center justify-center text-center px-6">
                                    <FaExclamationTriangle className="text-4xl text-amber-600" />

                                    <h3 className="mt-4 text-lg font-bold text-slate-800">
                                        No se encontró la salida
                                    </h3>

                                    <button
                                        type="button"
                                        onClick={volver}
                                        className="mt-5 h-10 px-4 rounded-xl bg-blue-800 text-white text-sm font-semibold hover:bg-blue-900 transition"
                                    >
                                        Volver al listado
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4 items-start">
                                    <aside className="space-y-4 xl:sticky xl:top-0">
                                        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                                                <h2 className="font-bold text-slate-900 text-sm">
                                                    Información general
                                                </h2>

                                                <p className="text-xs text-slate-500">
                                                    Cabecera del documento.
                                                </p>
                                            </div>

                                            <div className="p-4 space-y-3">
                                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                        Consecutivo
                                                    </p>

                                                    <p className="mt-1 text-base font-bold text-slate-900">
                                                        {salida?.consecutivo ||
                                                            `SAL-${salida?.idDocumento || salida?.idSalida || salida?.id}`}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs font-bold text-slate-600 mb-1">
                                                        Estado
                                                    </p>

                                                    <span
                                                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${claseEstadoProceso()}`}
                                                    >
                                                        {iconoEstadoProceso()}
                                                        {textoEstadoProceso()}
                                                    </span>
                                                </div>

                                                <div className="rounded-xl border border-rose-100 bg-rose-50 p-3">
                                                    <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                                                        Tipo de salida
                                                    </p>

                                                    <p className="mt-1 text-sm font-bold text-rose-900">
                                                        {salida?.tipoDocumento ||
                                                            "Salida de inventario"}
                                                    </p>

                                                    <p className="text-xs text-rose-700">
                                                        {salida?.codigoTipoDocumento ||
                                                            "Documento de salida"}
                                                    </p>

                                                    <div className="mt-2 rounded-lg border border-white/70 bg-white/70 px-2.5 py-2">
                                                        <p className="text-[11px] text-rose-800 leading-4">
                                                            {permiteLoteVencido
                                                                ? "Permite lotes vencidos y vigentes con existencia."
                                                                : "Solo permite lotes vigentes o sin fecha de vencimiento."}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 gap-3">
                                                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                                                        <div className="flex items-center gap-2 text-slate-500">
                                                            <FaCalendarAlt />
                                                            <p className="text-[11px] font-bold uppercase tracking-wider">
                                                                Fecha salida
                                                            </p>
                                                        </div>

                                                        <p className="mt-1 text-sm font-bold text-slate-900">
                                                            {formatearFecha(
                                                                salida?.fechaDocumento
                                                            )}
                                                        </p>
                                                    </div>

                                                    {salida?.fechaFinalizacion && (
                                                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                                                            <div className="flex items-center gap-2 text-emerald-700">
                                                                <FaCheckCircle />
                                                                <p className="text-[11px] font-bold uppercase tracking-wider">
                                                                    Fecha de cierre
                                                                </p>
                                                            </div>

                                                            <p className="mt-1 text-sm font-bold text-emerald-800">
                                                                {formatearFechaHora(
                                                                    salida.fechaFinalizacion
                                                                )}
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                                    <div className="flex items-center gap-2 text-slate-500">
                                                        <FaUserCheck />
                                                        <p className="text-[11px] font-bold uppercase tracking-wider">
                                                            Operador
                                                        </p>
                                                    </div>

                                                    <p className="mt-1 text-sm font-bold text-slate-900">
                                                        {salida?.operador ||
                                                            salida?.nombreOperador ||
                                                            salida?.usuarioRegistro ||
                                                            "Sin operador"}
                                                    </p>

                                                    <p className="text-xs text-slate-500">
                                                        {salida?.codigoOperador ||
                                                            "Operación inventario"}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs font-bold text-slate-600 mb-1">
                                                        Observación
                                                    </p>

                                                    <div className="min-h-[70px] rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 leading-6">
                                                        {salida?.observacion ||
                                                            "Sin observación"}
                                                    </div>
                                                </div>

                                                {esEditable() ? (
                                                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                                                        <div className="flex items-start gap-2">
                                                            <FaInfoCircle className="mt-0.5 text-amber-700 shrink-0" />

                                                            <p className="text-xs text-amber-800 leading-5">
                                                                Esta salida está en borrador. Puedes editarla, agregar productos o finalizarla cuando esté completa.
                                                            </p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                                                        <div className="flex items-start gap-2">
                                                            <FaCheckCircle className="mt-0.5 text-emerald-700 shrink-0" />

                                                            <p className="text-xs text-emerald-800 leading-5">
                                                                Esta salida ya fue finalizada. Las existencias fueron descontadas y los movimientos fueron generados.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                {esEditable() && (
                                                    <button
                                                        type="button"
                                                        onClick={editarSalida}
                                                        className="w-full h-10 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-amber-100 transition"
                                                    >
                                                        <FaEdit />
                                                        Editar borrador
                                                    </button>
                                                )}

                                                {esFinalizable() && (
                                                    <button
                                                        type="button"
                                                        onClick={abrirModalFinalizar}
                                                        className="w-full h-10 rounded-xl bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-800 transition"
                                                    >
                                                        <FaSave />
                                                        Finalizar salida
                                                    </button>
                                                )}
                                            </div>
                                        </section>
                                    </aside>

                                    <div className="space-y-4">
                                        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-500">
                                                            Productos
                                                        </p>

                                                        <p className="mt-1 text-2xl font-bold text-blue-800">
                                                            {formatearNumero(
                                                                totalProductos
                                                            )}
                                                        </p>
                                                    </div>

                                                    <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
                                                        <FaBoxes className="text-lg text-blue-700" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-500">
                                                            Cantidad total
                                                        </p>

                                                        <p className="mt-1 text-2xl font-bold text-rose-700">
                                                            {formatearNumero(
                                                                totalCantidad
                                                            )}
                                                        </p>
                                                    </div>

                                                    <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center">
                                                        <FaClipboardList className="text-lg text-rose-700" />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-medium text-slate-500">
                                                            Movimientos
                                                        </p>

                                                        <p className="mt-1 text-2xl font-bold text-slate-900">
                                                            {formatearNumero(
                                                                totalMovimientos
                                                            )}
                                                        </p>
                                                    </div>

                                                    <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center">
                                                        <FaWarehouse className="text-lg text-slate-700" />
                                                    </div>
                                                </div>
                                            </div>
                                        </section>

                                        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                                                <h2 className="font-bold text-slate-900 text-sm">
                                                    Productos de la salida
                                                </h2>

                                                <p className="text-xs text-slate-500">
                                                    Cantidades, lotes, bodega y ubicación asociados.
                                                </p>
                                            </div>

                                            {detalles.length === 0 ? (
                                                <div className="min-h-[220px] flex flex-col items-center justify-center text-center px-6">
                                                    <FaBoxes className="text-3xl text-slate-400" />

                                                    <h3 className="mt-3 text-base font-bold text-slate-800">
                                                        Sin productos
                                                    </h3>
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full min-w-[980px]">
                                                        <thead className="bg-white border-b border-slate-200">
                                                            <tr>
                                                                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                                    Producto
                                                                </th>

                                                                <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                                    Cantidad
                                                                </th>

                                                                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                                    Lote
                                                                </th>

                                                                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                                    Ubicación
                                                                </th>

                                                                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                                    Observación
                                                                </th>

                                                                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                                    Movimiento
                                                                </th>
                                                            </tr>
                                                        </thead>

                                                        <tbody className="divide-y divide-slate-200">
                                                            {detalles.map(
                                                                (
                                                                    detalle
                                                                ) => (
                                                                    <tr
                                                                        key={
                                                                            detalle.idDocumentoDetalle ||
                                                                            `${detalle.idProducto}-${detalle.idLote}`
                                                                        }
                                                                        className="hover:bg-slate-50 transition"
                                                                    >
                                                                        <td className="px-4 py-3">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                                                                                    <FaBoxes />
                                                                                </div>

                                                                                <div className="min-w-0">
                                                                                    <p className="font-semibold text-sm text-slate-900 truncate max-w-[300px]">
                                                                                        {detalle.descripcion ||
                                                                                            detalle.producto ||
                                                                                            "Producto"}
                                                                                    </p>

                                                                                    <p className="text-xs text-slate-500">
                                                                                        {detalle.codigoProducto ||
                                                                                            `ID ${detalle.idProducto}`}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        </td>

                                                                        <td className="px-4 py-3 text-center">
                                                                            <span className="inline-flex items-center justify-center min-w-20 px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
                                                                                {formatearNumero(
                                                                                    detalle.cantidad ||
                                                                                        detalle.cantidadSolicitada
                                                                                )}{" "}
                                                                                {detalle.unidad ||
                                                                                    "UND"}
                                                                            </span>
                                                                        </td>

                                                                        <td className="px-4 py-3">
                                                                            {detalle.idLote ||
                                                                            detalle.lote ? (
                                                                                <div>
                                                                                    <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                                                                                        <FaBarcode />
                                                                                        {detalle.lote ||
                                                                                            "Lote seleccionado"}
                                                                                    </span>

                                                                                    {loteEstaVencido(
                                                                                        detalle
                                                                                    ) && (
                                                                                        <span className="ml-2 inline-flex px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                                                                                            Vencido
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
                                                                                </div>
                                                                            ) : (
                                                                                <span className="inline-flex px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold">
                                                                                    Sin lote
                                                                                </span>
                                                                            )}
                                                                        </td>

                                                                        <td className="px-4 py-3">
                                                                            <div className="text-sm text-slate-700">
                                                                                <p className="font-semibold">
                                                                                    {detalle.bodega ||
                                                                                        detalle.nombreBodega ||
                                                                                        `Bodega ${detalle.idBodega || ""}`}
                                                                                </p>

                                                                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                                                                    <FaMapMarkerAlt />
                                                                                    {detalle.ubicacion ||
                                                                                        detalle.nombreUbicacion ||
                                                                                        (detalle.idUbicacion
                                                                                            ? `Ubicación ${detalle.idUbicacion}`
                                                                                            : "Sin ubicación específica")}
                                                                                </p>
                                                                            </div>
                                                                        </td>

                                                                        <td className="px-4 py-3">
                                                                            <p className="text-sm text-slate-600 max-w-[280px] truncate">
                                                                                {detalle.observacion ||
                                                                                    detalle.observacionLote ||
                                                                                    "Sin observación"}
                                                                            </p>
                                                                        </td>

                                                                        <td className="px-4 py-3">
                                                                            <div className="flex justify-end">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() =>
                                                                                        abrirModalMovimientoDetalle(
                                                                                            detalle
                                                                                        )
                                                                                    }
                                                                                    className={`h-9 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                                                                                        obtenerMovimientosDetalle(
                                                                                            detalle
                                                                                        ).length > 0
                                                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                                                                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                                                                    }`}
                                                                                    title="Ver movimiento generado"
                                                                                >
                                                                                    <FaEye />
                                                                                    Ver movimiento
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
                            )}
                        </div>
                    </div>
                </article>
            </div>

            {modalMovimientoDetalle.visible &&
                modalMovimientoDetalle.detalle && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6">
                        <button
                            type="button"
                            aria-label="Cerrar modal"
                            onClick={cerrarModalMovimientoDetalle}
                            className="absolute inset-0 bg-slate-950/60"
                        />

                        <section className="relative w-full max-w-3xl max-h-[88vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
                            <header className="px-5 py-4 border-b border-slate-200 bg-white">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                                            <FaWarehouse />
                                        </div>

                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-rose-700">
                                                Movimiento del producto
                                            </p>

                                            <h2 className="mt-1 text-lg font-bold text-slate-900">
                                                {modalMovimientoDetalle.detalle
                                                    ?.descripcion ||
                                                    modalMovimientoDetalle.detalle
                                                        ?.producto ||
                                                    "Producto"}
                                            </h2>

                                            <p className="mt-1 text-sm text-slate-500">
                                                {modalMovimientoDetalle.detalle
                                                    ?.codigoProducto ||
                                                    modalMovimientoDetalle.detalle
                                                        ?.codigo ||
                                                    `ID ${
                                                        modalMovimientoDetalle
                                                            .detalle
                                                            ?.idProducto || ""
                                                    }`}
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={
                                            cerrarModalMovimientoDetalle
                                        }
                                        className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 transition"
                                    >
                                        <FaTimes />
                                    </button>
                                </div>
                            </header>

                            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <p className="text-xs text-slate-500">
                                            Cantidad salida
                                        </p>

                                        <p className="mt-1 text-lg font-bold text-slate-900">
                                            {formatearNumero(
                                                modalMovimientoDetalle
                                                    .detalle?.cantidad ||
                                                    modalMovimientoDetalle
                                                        .detalle
                                                        ?.cantidadSolicitada
                                            )}{" "}
                                            {modalMovimientoDetalle.detalle
                                                ?.unidad || "UND"}
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <p className="text-xs text-slate-500">
                                            Lote
                                        </p>

                                        <p className="mt-1 text-lg font-bold text-slate-900">
                                            {modalMovimientoDetalle.detalle
                                                ?.lote || "Sin lote"}
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                        <p className="text-xs text-slate-500">
                                            Movimientos
                                        </p>

                                        <p className="mt-1 text-lg font-bold text-slate-900">
                                            {
                                                movimientosDetalleSeleccionado.length
                                            }
                                        </p>
                                    </div>
                                </div>

                                {movimientosDetalleSeleccionado.length ===
                                0 ? (
                                    <div className="min-h-[180px] rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-center px-6">
                                        <FaInfoCircle className="text-3xl text-slate-400" />

                                        <h3 className="mt-3 text-base font-bold text-slate-800">
                                            Sin movimiento generado
                                        </h3>

                                        <p className="mt-1 text-sm text-slate-500 max-w-md">
                                            Esta salida aún está en borrador o este producto no tiene movimiento asociado.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                                        <table className="w-full min-w-[720px]">
                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                        Movimiento
                                                    </th>

                                                    <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                        Cantidad
                                                    </th>

                                                    <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                        Saldo
                                                    </th>

                                                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                                        Fecha
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-slate-200">
                                                {movimientosDetalleSeleccionado.map(
                                                    (movimiento) => (
                                                        <tr
                                                            key={
                                                                movimiento.idMovimiento ||
                                                                movimiento.id
                                                            }
                                                            className="hover:bg-slate-50 transition"
                                                        >
                                                            <td className="px-4 py-3">
                                                                <span className="inline-flex px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
                                                                    {movimiento.tipoMovimiento ||
                                                                        "SALIDA"}
                                                                </span>

                                                                <p className="mt-1 text-xs text-slate-500">
                                                                    {movimiento.observacion ||
                                                                        "Sin observación"}
                                                                </p>
                                                            </td>

                                                            <td className="px-4 py-3 text-center">
                                                                <span className="inline-flex min-w-16 justify-center px-3 py-1.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold">
                                                                    {formatearNumero(
                                                                        movimiento.cantidad
                                                                    )}
                                                                </span>
                                                            </td>

                                                            <td className="px-4 py-3 text-center">
                                                                <p className="text-xs text-slate-500">
                                                                    Antes:{" "}
                                                                    {formatearNumero(
                                                                        movimiento.saldoAnterior
                                                                    )}
                                                                </p>

                                                                <p className="text-xs font-bold text-rose-700">
                                                                    Nuevo:{" "}
                                                                    {formatearNumero(
                                                                        movimiento.saldoNuevo
                                                                    )}
                                                                </p>
                                                            </td>

                                                            <td className="px-4 py-3">
                                                                <p className="text-sm text-slate-700">
                                                                    {formatearFechaHora(
                                                                        movimiento.fechaMovimiento
                                                                    )}
                                                                </p>

                                                                <p className="text-xs text-slate-500">
                                                                    {movimiento.usuario ||
                                                                        movimiento.operador ||
                                                                        ""}
                                                                </p>
                                                            </td>
                                                        </tr>
                                                    )
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <footer className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
                                <button
                                    type="button"
                                    onClick={
                                        cerrarModalMovimientoDetalle
                                    }
                                    className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-100 transition"
                                >
                                    Cerrar
                                </button>
                            </footer>
                        </section>
                    </div>
                )}

            {modalFinalizar && salida && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6">
                    <button
                        type="button"
                        aria-label="Cerrar modal"
                        onClick={cerrarModalFinalizar}
                        className="absolute inset-0 bg-slate-950/60"
                    />

                    <section className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
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
                                            Confirmar finalización
                                        </h2>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={cerrarModalFinalizar}
                                    disabled={finalizando}
                                    className="w-9 h-9 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 disabled:opacity-60 transition"
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        </header>

                        <div className="p-5 space-y-4">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-sm font-bold text-slate-900">
                                    {salida?.consecutivo ||
                                        "Salida seleccionada"}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                    Fecha:{" "}
                                    {formatearFecha(
                                        salida?.fechaDocumento
                                    )}
                                </p>

                                <div className="mt-3 grid grid-cols-2 gap-3">
                                    <div className="rounded-xl bg-white border border-slate-200 p-3">
                                        <p className="text-xs text-slate-500">
                                            Productos
                                        </p>

                                        <p className="text-lg font-bold text-slate-900">
                                            {formatearNumero(
                                                totalProductos
                                            )}
                                        </p>
                                    </div>

                                    <div className="rounded-xl bg-white border border-slate-200 p-3">
                                        <p className="text-xs text-slate-500">
                                            Cantidad
                                        </p>

                                        <p className="text-lg font-bold text-slate-900">
                                            {formatearNumero(
                                                totalCantidad
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                <div className="flex items-start gap-3">
                                    <FaExclamationTriangle className="mt-1 text-amber-700 shrink-0" />

                                    <p className="text-sm text-amber-800 leading-6">
                                        Al finalizar, esta salida descontará existencias y generará movimientos de inventario. Después no podrá editarse. Si no hay stock suficiente, la finalización será bloqueada.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <footer className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                            <button
                                type="button"
                                onClick={cerrarModalFinalizar}
                                disabled={finalizando}
                                className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-100 disabled:opacity-60 transition"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={finalizarSalida}
                                disabled={finalizando}
                                className="h-10 px-5 rounded-xl bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-800 disabled:opacity-60 transition"
                            >
                                {finalizando ? (
                                    <FaSyncAlt className="animate-spin" />
                                ) : (
                                    <FaCheckCircle />
                                )}
                                Finalizar salida
                            </button>
                        </footer>
                    </section>
                </div>
            )}
        </>
    );
};
