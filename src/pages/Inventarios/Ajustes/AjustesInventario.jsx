import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaArrowDown,
    FaArrowUp,
    FaBoxes,
    FaCalendarAlt,
    FaCheckCircle,
    FaClipboardList,
    FaEdit,
    FaExclamationTriangle,
    FaEye,
    FaFileInvoice,
    FaPlus,
    FaSearch,
    FaSyncAlt,
    FaTimes,
    FaUserCheck,
    FaWarehouse,
} from "react-icons/fa";
import { toast } from "react-toastify";

const API_BASE_AJUSTES =
    "https://app.accionporcolombia.com/servicesPae/Inventario/Ajustes/";

export const AjustesInventario = ({
    setSidebar,
    navegar,
}) => {
    const abrirMenu = () => setSidebar(true);
    const estadoPagina = (pagina) => navegar(pagina);

    const [ajustes, setAjustes] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [finalizando, setFinalizando] = useState(false);

    const [busqueda, setBusqueda] = useState("");
    const [fechaDesde, setFechaDesde] = useState("");
    const [fechaHasta, setFechaHasta] = useState("");
    const [estadoProcesoFiltro, setEstadoProcesoFiltro] =
        useState("");
    const [tipoAjusteFiltro, setTipoAjusteFiltro] =
        useState("");

    const [modalFinalizar, setModalFinalizar] = useState({
        visible: false,
        ajuste: null,
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
                        telefono: posibleUsuario?.telefono ?? "",
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

    const cargarAjustes = useCallback(async () => {
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

            if (busqueda.trim()) {
                params.set("q", busqueda.trim());
            }

            if (fechaDesde) {
                params.set("fechaDesde", fechaDesde);
            }

            if (fechaHasta) {
                params.set("fechaHasta", fechaHasta);
            }

            if (estadoProcesoFiltro) {
                params.set(
                    "estadoProceso",
                    estadoProcesoFiltro
                );
            }

            if (tipoAjusteFiltro) {
                params.set(
                    "tipoAjuste",
                    tipoAjusteFiltro
                );
            }

            const respuesta = await fetch(
                `${API_BASE_AJUSTES}InventarioAjustesListar.php?${params.toString()}`,
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
                        "No fue posible consultar los ajustes."
                );
            }

            setAjustes(
                Array.isArray(resultado?.data)
                    ? resultado.data
                    : []
            );
        } catch (error) {
            console.error(
                "Error cargando ajustes:",
                error
            );

            setAjustes([]);

            toast.error(
                error?.message ||
                    "No fue posible cargar los ajustes de inventario."
            );
        } finally {
            setCargando(false);
        }
    }, [
        usuarioSesion?.idUsuario,
        busqueda,
        fechaDesde,
        fechaHasta,
        estadoProcesoFiltro,
        tipoAjusteFiltro,
    ]);

    useEffect(() => {
        cargarAjustes();
    }, [cargarAjustes]);

    useEffect(() => {
        if (!modalFinalizar.visible) {
            return undefined;
        }

        const overflowAnterior =
            document.body.style.overflow;

        const cerrarConEscape = (event) => {
            if (event.key === "Escape") {
                cerrarModalFinalizar();
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
    }, [modalFinalizar.visible]);

    const obtenerEstadoProceso = (ajuste) =>
        String(
            ajuste?.estadoProceso ||
                ajuste?.estadoProcesoTexto ||
                "BORRADOR"
        )
            .trim()
            .toUpperCase();

    const obtenerTipoAjuste = (ajuste) =>
        String(ajuste?.tipoAjuste || "")
            .trim()
            .toUpperCase();

    const esAjusteEditable = (ajuste) => {
        if (typeof ajuste?.editable === "boolean") {
            return ajuste.editable;
        }

        return obtenerEstadoProceso(ajuste) === "BORRADOR";
    };

    const esAjusteFinalizable = (ajuste) => {
        if (typeof ajuste?.finalizable === "boolean") {
            return ajuste.finalizable;
        }

        return obtenerEstadoProceso(ajuste) === "BORRADOR";
    };

    const textoEstadoProceso = (ajuste) => {
        const estado = obtenerEstadoProceso(ajuste);

        if (estado === "FINALIZADA") {
            return "Finalizado";
        }

        if (estado === "ANULADA") {
            return "Anulado";
        }

        return "Borrador";
    };

    const claseEstadoProceso = (ajuste) => {
        const estado = obtenerEstadoProceso(ajuste);

        if (estado === "FINALIZADA") {
            return "bg-emerald-50 text-emerald-700 border-emerald-200";
        }

        if (estado === "ANULADA") {
            return "bg-rose-50 text-rose-700 border-rose-200";
        }

        return "bg-amber-50 text-amber-700 border-amber-200";
    };

    const textoTipoAjuste = (ajuste) => {
        const tipo = obtenerTipoAjuste(ajuste);

        if (tipo === "POSITIVO") {
            return "Positivo";
        }

        if (tipo === "NEGATIVO") {
            return "Negativo";
        }

        return "Sin definir";
    };

    const claseTipoAjuste = (ajuste) => {
        const tipo = obtenerTipoAjuste(ajuste);

        if (tipo === "POSITIVO") {
            return "bg-emerald-50 text-emerald-700 border-emerald-200";
        }

        if (tipo === "NEGATIVO") {
            return "bg-rose-50 text-rose-700 border-rose-200";
        }

        return "bg-slate-50 text-slate-600 border-slate-200";
    };

    const iconoTipoAjuste = (ajuste) => {
        const tipo = obtenerTipoAjuste(ajuste);

        if (tipo === "POSITIVO") {
            return <FaArrowUp />;
        }

        if (tipo === "NEGATIVO") {
            return <FaArrowDown />;
        }

        return <FaClipboardList />;
    };

    const resumen = useMemo(() => {
        return ajustes.reduce(
            (acumulado, ajuste) => {
                acumulado.totalAjustes += 1;
                acumulado.totalProductos += Number(
                    ajuste?.totalProductos ?? 0
                );
                acumulado.totalCantidad += Number(
                    ajuste?.totalCantidad ?? 0
                );

                const estado = obtenerEstadoProceso(ajuste);
                const tipo = obtenerTipoAjuste(ajuste);

                if (estado === "BORRADOR") {
                    acumulado.totalBorradores += 1;
                }

                if (estado === "FINALIZADA") {
                    acumulado.totalFinalizados += 1;
                }

                if (tipo === "POSITIVO") {
                    acumulado.totalPositivos += 1;
                }

                if (tipo === "NEGATIVO") {
                    acumulado.totalNegativos += 1;
                }

                return acumulado;
            },
            {
                totalAjustes: 0,
                totalBorradores: 0,
                totalFinalizados: 0,
                totalPositivos: 0,
                totalNegativos: 0,
                totalProductos: 0,
                totalCantidad: 0,
            }
        );
    }, [ajustes]);

    const nuevoAjuste = () => {
        localStorage.removeItem(
            "ajusteInventarioDetalle"
        );
        localStorage.removeItem(
            "ajusteInventarioEditar"
        );
        localStorage.removeItem(
            "ajusteInventarioModo"
        );

        estadoPagina("CrearAjusteInventario");
    };

    const verDetalle = (ajuste) => {
        localStorage.removeItem(
            "ajusteInventarioEditar"
        );

        localStorage.setItem(
            "ajusteInventarioModo",
            "VER"
        );

        localStorage.setItem(
            "ajusteInventarioDetalle",
            JSON.stringify(ajuste)
        );

        estadoPagina("CrearAjusteInventario");
    };

    const editarAjuste = (ajuste) => {
        if (!esAjusteEditable(ajuste)) {
            toast.warning(
                "Este ajuste ya fue finalizado y solo se puede consultar."
            );

            verDetalle(ajuste);
            return;
        }

        localStorage.setItem(
            "ajusteInventarioModo",
            "EDITAR"
        );

        localStorage.setItem(
            "ajusteInventarioEditar",
            JSON.stringify(ajuste)
        );

        localStorage.setItem(
            "ajusteInventarioDetalle",
            JSON.stringify(ajuste)
        );

        estadoPagina("CrearAjusteInventario");
    };

    const abrirModalFinalizar = (ajuste) => {
        if (!esAjusteFinalizable(ajuste)) {
            toast.warning(
                "Este ajuste ya fue finalizado o no se puede finalizar."
            );
            return;
        }

        setModalFinalizar({
            visible: true,
            ajuste,
        });
    };

    const cerrarModalFinalizar = () => {
        if (finalizando) {
            return;
        }

        setModalFinalizar({
            visible: false,
            ajuste: null,
        });
    };

    const finalizarAjuste = async () => {
        const ajuste = modalFinalizar.ajuste;

        const idDocumento = Number(
            ajuste?.idDocumento ??
                ajuste?.idAjuste ??
                ajuste?.id ??
                0
        );

        if (!idDocumento) {
            toast.error(
                "No se pudo identificar el ajuste para finalizar."
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
                `${API_BASE_AJUSTES}InventarioAjustesFinalizar.php`,
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
                        idAjuste: idDocumento,
                        idUsuario: usuarioSesion.idUsuario,
                        idUsuarioFinaliza:
                            usuarioSesion.idUsuario,
                        idOperador:
                            ajuste?.idOperador || undefined,
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
                        "No fue posible finalizar el ajuste."
                );
            }

            toast.success(
                resultado?.mensaje ||
                    "Ajuste finalizado correctamente."
            );

            cerrarModalFinalizar();
            await cargarAjustes();
        } catch (error) {
            console.error(
                "Error finalizando ajuste:",
                error
            );

            toast.error(
                error?.message ||
                    "No fue posible finalizar el ajuste."
            );
        } finally {
            setFinalizando(false);
        }
    };

    const limpiarFiltros = () => {
        setBusqueda("");
        setFechaDesde("");
        setFechaHasta("");
        setEstadoProcesoFiltro("");
        setTipoAjusteFiltro("");
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

        const partes = String(fecha)
            .substring(0, 10)
            .split("-");

        if (partes.length !== 3) {
            return fecha;
        }

        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    };

    const textoUbicacion = (ajuste) => {
        if (ajuste?.ubicacion) {
            return ajuste.ubicacion;
        }

        if (ajuste?.idUbicacion) {
            return `Ubicación ${ajuste.idUbicacion}`;
        }

        return "Sin ubicación específica";
    };

    return (
        <>
            <div className="w-full h-screen flex flex-col p-3 md:p-6 gap-6 bg-slate-100">
                <article className="flex-1 bg-white shadow-lg rounded-2xl flex flex-col overflow-hidden border border-slate-200">
                    <header className="px-5 py-5 md:px-7 border-b border-slate-200 bg-white">
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

                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                                    <FaClipboardList className="text-xl text-indigo-700" />
                                </div>

                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700">
                                        Operación de inventarios
                                    </p>

                                    <h1 className="mt-1 text-2xl md:text-3xl font-bold text-slate-900">
                                        Ajustes de inventario
                                    </h1>

                                    <p className="mt-1 text-sm text-slate-500 max-w-3xl">
                                        Gestiona ajustes positivos o negativos por sobrantes, faltantes, mermas, deterioros, vencimientos o correcciones de inventario.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={cargarAjustes}
                                    disabled={cargando}
                                    className="h-11 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold flex items-center justify-center gap-2 hover:bg-slate-50 disabled:opacity-60 transition"
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

                                <button
                                    type="button"
                                    onClick={nuevoAjuste}
                                    className="h-11 px-5 rounded-xl bg-blue-800 text-white font-semibold flex items-center justify-center gap-2 hover:bg-blue-900 transition shadow-sm"
                                >
                                    <FaPlus />
                                    Nuevo ajuste
                                </button>
                            </div>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto">
                        <div className="p-5 md:p-7 space-y-6">
                            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-slate-500">
                                                Ajustes
                                            </p>

                                            <p className="mt-2 text-3xl font-bold text-slate-900">
                                                {
                                                    resumen.totalAjustes
                                                }
                                            </p>
                                        </div>

                                        <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center">
                                            <FaFileInvoice className="text-lg text-slate-700" />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-amber-700">
                                                Borradores
                                            </p>

                                            <p className="mt-2 text-3xl font-bold text-amber-800">
                                                {
                                                    resumen.totalBorradores
                                                }
                                            </p>
                                        </div>

                                        <div className="w-11 h-11 rounded-xl bg-white/70 flex items-center justify-center">
                                            <FaEdit className="text-lg text-amber-700" />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-emerald-700">
                                                Finalizados
                                            </p>

                                            <p className="mt-2 text-3xl font-bold text-emerald-800">
                                                {
                                                    resumen.totalFinalizados
                                                }
                                            </p>
                                        </div>

                                        <div className="w-11 h-11 rounded-xl bg-white/70 flex items-center justify-center">
                                            <FaCheckCircle className="text-lg text-emerald-700" />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-emerald-700">
                                                Positivos
                                            </p>

                                            <p className="mt-2 text-3xl font-bold text-emerald-800">
                                                {
                                                    resumen.totalPositivos
                                                }
                                            </p>
                                        </div>

                                        <div className="w-11 h-11 rounded-xl bg-white/70 flex items-center justify-center">
                                            <FaArrowUp className="text-lg text-emerald-700" />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-rose-700">
                                                Negativos
                                            </p>

                                            <p className="mt-2 text-3xl font-bold text-rose-800">
                                                {
                                                    resumen.totalNegativos
                                                }
                                            </p>
                                        </div>

                                        <div className="w-11 h-11 rounded-xl bg-white/70 flex items-center justify-center">
                                            <FaArrowDown className="text-lg text-rose-700" />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-slate-500">
                                                Cantidad
                                            </p>

                                            <p className="mt-2 text-3xl font-bold text-indigo-700">
                                                {formatearNumero(
                                                    resumen.totalCantidad
                                                )}
                                            </p>
                                        </div>

                                        <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center">
                                            <FaBoxes className="text-lg text-indigo-700" />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_160px_160px_170px_170px_auto] gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Buscar ajuste
                                        </label>

                                        <div className="relative">
                                            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                                            <input
                                                type="text"
                                                value={busqueda}
                                                onChange={(
                                                    event
                                                ) =>
                                                    setBusqueda(
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                                placeholder="Consecutivo, bodega, operador, tipo u observación"
                                                className="w-full h-11 pl-11 pr-4 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Estado
                                        </label>

                                        <select
                                            value={
                                                estadoProcesoFiltro
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                setEstadoProcesoFiltro(
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            className="w-full h-11 px-4 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                        >
                                            <option value="">
                                                Todos
                                            </option>
                                            <option value="BORRADOR">
                                                Borrador
                                            </option>
                                            <option value="FINALIZADA">
                                                Finalizado
                                            </option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Tipo ajuste
                                        </label>

                                        <select
                                            value={
                                                tipoAjusteFiltro
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                setTipoAjusteFiltro(
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            className="w-full h-11 px-4 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                        >
                                            <option value="">
                                                Todos
                                            </option>
                                            <option value="POSITIVO">
                                                Positivo
                                            </option>
                                            <option value="NEGATIVO">
                                                Negativo
                                            </option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Fecha desde
                                        </label>

                                        <input
                                            type="date"
                                            value={fechaDesde}
                                            onChange={(
                                                event
                                            ) =>
                                                setFechaDesde(
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            className="w-full h-11 px-4 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Fecha hasta
                                        </label>

                                        <input
                                            type="date"
                                            value={fechaHasta}
                                            onChange={(
                                                event
                                            ) =>
                                                setFechaHasta(
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            className="w-full h-11 px-4 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                        />
                                    </div>

                                    <div className="flex items-end">
                                        <button
                                            type="button"
                                            onClick={
                                                limpiarFiltros
                                            }
                                            className="w-full xl:w-auto h-11 px-5 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition"
                                        >
                                            Limpiar
                                        </button>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-200">
                                    <h2 className="font-bold text-slate-900">
                                        Historial de ajustes
                                    </h2>

                                    <p className="text-sm text-slate-500">
                                        {ajustes.length} registro
                                        {ajustes.length === 1
                                            ? ""
                                            : "s"}{" "}
                                        encontrado
                                        {ajustes.length === 1
                                            ? ""
                                            : "s"}
                                    </p>
                                </div>

                                {cargando ? (
                                    <div className="min-h-[340px] flex flex-col items-center justify-center gap-4">
                                        <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />

                                        <p className="text-sm font-medium text-slate-500">
                                            Cargando ajustes...
                                        </p>
                                    </div>
                                ) : ajustes.length === 0 ? (
                                    <div className="min-h-[340px] flex flex-col items-center justify-center text-center px-6">
                                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                                            <FaWarehouse className="text-2xl text-slate-500" />
                                        </div>

                                        <h3 className="mt-4 text-lg font-bold text-slate-800">
                                            No hay ajustes para mostrar
                                        </h3>

                                        <p className="mt-1 text-sm text-slate-500 max-w-md">
                                            Crea un nuevo ajuste o modifica los filtros aplicados.
                                        </p>

                                        <button
                                            type="button"
                                            onClick={nuevoAjuste}
                                            className="mt-5 h-11 px-5 rounded-xl bg-blue-800 text-white font-semibold flex items-center gap-2 hover:bg-blue-900 transition"
                                        >
                                            <FaPlus />
                                            Crear ajuste
                                        </button>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[1320px]">
                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Ajuste
                                                    </th>

                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Fecha
                                                    </th>

                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Estado
                                                    </th>

                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Tipo
                                                    </th>

                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Bodega / Ubicación
                                                    </th>

                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Operador
                                                    </th>

                                                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Productos
                                                    </th>

                                                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Cantidad
                                                    </th>

                                                    <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Acciones
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-slate-200">
                                                {ajustes.map(
                                                    (ajuste) => {
                                                        const idAjuste =
                                                            Number(
                                                                ajuste?.idAjuste ??
                                                                    ajuste?.idDocumento ??
                                                                    ajuste?.id ??
                                                                    0
                                                            );

                                                        const editable =
                                                            esAjusteEditable(
                                                                ajuste
                                                            );

                                                        const finalizable =
                                                            esAjusteFinalizable(
                                                                ajuste
                                                            );

                                                        const tipo =
                                                            obtenerTipoAjuste(
                                                                ajuste
                                                            );

                                                        return (
                                                            <tr
                                                                key={
                                                                    idAjuste
                                                                }
                                                                className="hover:bg-slate-50 transition"
                                                            >
                                                                <td className="px-5 py-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div
                                                                            className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${
                                                                                tipo ===
                                                                                "POSITIVO"
                                                                                    ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                                                                                    : tipo ===
                                                                                      "NEGATIVO"
                                                                                    ? "bg-rose-50 border-rose-100 text-rose-700"
                                                                                    : "bg-indigo-50 border-indigo-100 text-indigo-700"
                                                                            }`}
                                                                        >
                                                                            {iconoTipoAjuste(
                                                                                ajuste
                                                                            )}
                                                                        </div>

                                                                        <div>
                                                                            <p className="font-semibold text-slate-900">
                                                                                {ajuste?.consecutivo ||
                                                                                    `AJU-${idAjuste}`}
                                                                            </p>

                                                                            <p className="text-xs text-slate-500">
                                                                                {ajuste?.tipoDocumento ||
                                                                                    "Ajuste de inventario"}
                                                                            </p>

                                                                            <p className="text-[11px] text-slate-400">
                                                                                {ajuste?.codigoTipoDocumento ||
                                                                                    ajuste?.tipoOrigen ||
                                                                                    "MANUAL"}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </td>

                                                                <td className="px-5 py-4">
                                                                    <div className="flex items-center gap-2 text-sm text-slate-700">
                                                                        <FaCalendarAlt className="text-slate-400" />
                                                                        {formatearFecha(
                                                                            ajuste?.fechaDocumento
                                                                        )}
                                                                    </div>
                                                                </td>

                                                                <td className="px-5 py-4">
                                                                    <span
                                                                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${claseEstadoProceso(
                                                                            ajuste
                                                                        )}`}
                                                                    >
                                                                        {obtenerEstadoProceso(
                                                                            ajuste
                                                                        ) ===
                                                                        "FINALIZADA" ? (
                                                                            <FaCheckCircle />
                                                                        ) : (
                                                                            <FaExclamationTriangle />
                                                                        )}
                                                                        {textoEstadoProceso(
                                                                            ajuste
                                                                        )}
                                                                    </span>

                                                                    {ajuste?.fechaFinalizacion && (
                                                                        <p className="mt-1 text-xs text-slate-500">
                                                                            Cierre:{" "}
                                                                            {formatearFecha(
                                                                                ajuste.fechaFinalizacion
                                                                            )}
                                                                        </p>
                                                                    )}
                                                                </td>

                                                                <td className="px-5 py-4">
                                                                    <span
                                                                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${claseTipoAjuste(
                                                                            ajuste
                                                                        )}`}
                                                                    >
                                                                        {iconoTipoAjuste(
                                                                            ajuste
                                                                        )}
                                                                        {textoTipoAjuste(
                                                                            ajuste
                                                                        )}
                                                                    </span>
                                                                </td>

                                                                <td className="px-5 py-4">
                                                                    <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2">
                                                                        <p className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                                                                            <FaWarehouse className="text-indigo-700" />
                                                                            {ajuste?.bodega ||
                                                                                ajuste?.codigoBodega ||
                                                                                "Sin bodega"}
                                                                        </p>

                                                                        <p className="mt-1 text-xs text-indigo-700">
                                                                            {textoUbicacion(
                                                                                ajuste
                                                                            )}
                                                                        </p>
                                                                    </div>
                                                                </td>

                                                                <td className="px-5 py-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <FaUserCheck className="text-slate-400" />

                                                                        <div>
                                                                            <p className="text-sm font-semibold text-slate-800">
                                                                                {ajuste?.operador ||
                                                                                    ajuste?.nombreOperador ||
                                                                                    ajuste?.usuarioRegistro ||
                                                                                    "Sin operador"}
                                                                            </p>

                                                                            <p className="text-xs text-slate-500">
                                                                                {ajuste?.codigoOperador ||
                                                                                    "Operación inventario"}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </td>

                                                                <td className="px-5 py-4 text-center">
                                                                    <span className="inline-flex items-center justify-center min-w-12 px-3 py-1.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold">
                                                                        {Number(
                                                                            ajuste?.totalProductos ??
                                                                                0
                                                                        )}
                                                                    </span>
                                                                </td>

                                                                <td className="px-5 py-4 text-center">
                                                                    <span className="inline-flex items-center justify-center min-w-16 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold">
                                                                        {formatearNumero(
                                                                            ajuste?.totalCantidad
                                                                        )}
                                                                    </span>
                                                                </td>

                                                                <td className="px-5 py-4">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                verDetalle(
                                                                                    ajuste
                                                                                )
                                                                            }
                                                                            className="h-10 px-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 font-semibold flex items-center justify-center gap-2 hover:bg-blue-100 transition"
                                                                            title="Ver detalle"
                                                                        >
                                                                            <FaEye />
                                                                            Ver
                                                                        </button>

                                                                        {editable && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    editarAjuste(
                                                                                        ajuste
                                                                                    )
                                                                                }
                                                                                className="h-10 px-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 font-semibold flex items-center justify-center gap-2 hover:bg-amber-100 transition"
                                                                                title="Editar borrador"
                                                                            >
                                                                                <FaEdit />
                                                                                Editar
                                                                            </button>
                                                                        )}

                                                                        {finalizable && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() =>
                                                                                    abrirModalFinalizar(
                                                                                        ajuste
                                                                                    )
                                                                                }
                                                                                className="h-10 px-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold flex items-center justify-center gap-2 hover:bg-emerald-100 transition"
                                                                                title="Finalizar ajuste"
                                                                            >
                                                                                <FaCheckCircle />
                                                                                Finalizar
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    }
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

            {modalFinalizar.visible && (
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
                                            Finalizar ajuste
                                        </p>

                                        <h2 className="mt-1 text-lg font-bold text-slate-900">
                                            Confirmar finalización
                                        </h2>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={
                                        cerrarModalFinalizar
                                    }
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
                                    {modalFinalizar.ajuste
                                        ?.consecutivo ||
                                        "Ajuste seleccionado"}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                    Tipo documento:{" "}
                                    {modalFinalizar.ajuste
                                        ?.tipoDocumento ||
                                        "Ajuste de inventario"}
                                </p>

                                <div className="mt-3">
                                    <span
                                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${claseTipoAjuste(
                                            modalFinalizar.ajuste
                                        )}`}
                                    >
                                        {iconoTipoAjuste(
                                            modalFinalizar.ajuste
                                        )}
                                        {textoTipoAjuste(
                                            modalFinalizar.ajuste
                                        )}
                                    </span>
                                </div>

                                <p className="mt-3 text-xs text-slate-500">
                                    Fecha:{" "}
                                    {formatearFecha(
                                        modalFinalizar.ajuste
                                            ?.fechaDocumento
                                    )}
                                </p>

                                <div className="mt-4 rounded-xl bg-indigo-50 border border-indigo-100 p-3">
                                    <p className="text-xs font-bold text-indigo-700">
                                        Bodega
                                    </p>
                                    <p className="mt-1 text-sm font-bold text-indigo-900">
                                        {modalFinalizar.ajuste
                                            ?.bodega ||
                                            "Bodega seleccionada"}
                                    </p>
                                    <p className="text-xs text-indigo-700">
                                        {textoUbicacion(
                                            modalFinalizar.ajuste
                                        )}
                                    </p>
                                </div>

                                <div className="mt-3 grid grid-cols-2 gap-3">
                                    <div className="rounded-xl bg-white border border-slate-200 p-3">
                                        <p className="text-xs text-slate-500">
                                            Productos
                                        </p>
                                        <p className="text-lg font-bold text-slate-900">
                                            {Number(
                                                modalFinalizar
                                                    .ajuste
                                                    ?.totalProductos ??
                                                    0
                                            )}
                                        </p>
                                    </div>

                                    <div className="rounded-xl bg-white border border-slate-200 p-3">
                                        <p className="text-xs text-slate-500">
                                            Cantidad
                                        </p>
                                        <p className="text-lg font-bold text-slate-900">
                                            {formatearNumero(
                                                modalFinalizar
                                                    .ajuste
                                                    ?.totalCantidad
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                <div className="flex items-start gap-3">
                                    <FaExclamationTriangle className="mt-1 text-amber-700 shrink-0" />

                                    <p className="text-sm text-amber-800 leading-6">
                                        Al finalizar, el sistema aplicará el ajuste al inventario. Si es positivo sumará existencias; si es negativo descontará existencias. Después no podrá editarse.
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
                                onClick={finalizarAjuste}
                                disabled={finalizando}
                                className="h-10 px-5 rounded-xl bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-emerald-800 disabled:opacity-60 transition"
                            >
                                {finalizando ? (
                                    <FaSyncAlt className="animate-spin" />
                                ) : (
                                    <FaCheckCircle />
                                )}
                                Finalizar ajuste
                            </button>
                        </footer>
                    </section>
                </div>
            )}
        </>
    );
};
