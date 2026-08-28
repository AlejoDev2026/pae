import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaArrowRight,
    FaBoxes,
    FaCalendarAlt,
    FaCheckCircle,
    FaEdit,
    FaExclamationTriangle,
    FaEye,
    FaFileInvoice,
    FaMinusCircle,
    FaPlus,
    FaSearch,
    FaSyncAlt,
    FaTimes,
    FaUserCheck,
    FaWarehouse,
} from "react-icons/fa";
import { toast } from "react-toastify";

const API_BASE_SALIDAS =
    "https://app.accionporcolombia.com/servicesPae/Inventario/Salidas/";

export const SalidasInventario = ({
    setSidebar,
    navegar,
}) => {
    const abrirMenu = () => setSidebar(true);
    const estadoPagina = (pagina) => navegar(pagina);

    const [salidas, setSalidas] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [finalizando, setFinalizando] = useState(false);

    const [busqueda, setBusqueda] = useState("");
    const [fechaDesde, setFechaDesde] = useState("");
    const [fechaHasta, setFechaHasta] = useState("");
    const [estadoProcesoFiltro, setEstadoProcesoFiltro] =
        useState("");

    const [modalFinalizar, setModalFinalizar] = useState({
        visible: false,
        salida: null,
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

    const cargarSalidas = useCallback(async () => {
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

            const respuesta = await fetch(
                `${API_BASE_SALIDAS}InventarioSalidasListar.php?${params.toString()}`,
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
                        "No fue posible consultar las salidas."
                );
            }

            setSalidas(
                Array.isArray(resultado?.data)
                    ? resultado.data
                    : []
            );
        } catch (error) {
            console.error(
                "Error cargando salidas:",
                error
            );

            setSalidas([]);

            toast.error(
                error?.message ||
                    "No fue posible cargar las salidas de inventario."
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
    ]);

    useEffect(() => {
        cargarSalidas();
    }, [cargarSalidas]);

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

    const obtenerEstadoProceso = (salida) =>
        String(
            salida?.estadoProceso ||
                salida?.estadoProcesoTexto ||
                "BORRADOR"
        )
            .trim()
            .toUpperCase();

    const esSalidaEditable = (salida) => {
        if (typeof salida?.editable === "boolean") {
            return salida.editable;
        }

        return obtenerEstadoProceso(salida) === "BORRADOR";
    };

    const esSalidaFinalizable = (salida) => {
        if (typeof salida?.finalizable === "boolean") {
            return salida.finalizable;
        }

        return obtenerEstadoProceso(salida) === "BORRADOR";
    };

    const textoEstadoProceso = (salida) => {
        const estado = obtenerEstadoProceso(salida);

        if (estado === "FINALIZADA") {
            return "Finalizada";
        }

        if (estado === "ANULADA") {
            return "Anulada";
        }

        return "Borrador";
    };

    const claseEstadoProceso = (salida) => {
        const estado = obtenerEstadoProceso(salida);

        if (estado === "FINALIZADA") {
            return "bg-emerald-50 text-emerald-700 border-emerald-200";
        }

        if (estado === "ANULADA") {
            return "bg-rose-50 text-rose-700 border-rose-200";
        }

        return "bg-amber-50 text-amber-700 border-amber-200";
    };

    const resumen = useMemo(() => {
        return salidas.reduce(
            (acumulado, salida) => {
                acumulado.totalSalidas += 1;
                acumulado.totalProductos += Number(
                    salida?.totalProductos ?? 0
                );
                acumulado.totalCantidad += Number(
                    salida?.totalCantidad ?? 0
                );

                const estado = obtenerEstadoProceso(salida);

                if (estado === "BORRADOR") {
                    acumulado.totalBorradores += 1;
                }

                if (estado === "FINALIZADA") {
                    acumulado.totalFinalizadas += 1;
                }

                return acumulado;
            },
            {
                totalSalidas: 0,
                totalBorradores: 0,
                totalFinalizadas: 0,
                totalProductos: 0,
                totalCantidad: 0,
            }
        );
    }, [salidas]);

    const nuevaSalida = () => {
        localStorage.removeItem("salidaInventarioDetalle");
        localStorage.removeItem("salidaInventarioEditar");

        estadoPagina("CrearSalidaInventario");
    };

    const verDetalle = (salida) => {
        localStorage.setItem(
            "salidaInventarioDetalle",
            JSON.stringify(salida)
        );

        estadoPagina("DetalleSalidaInventario");
    };

    const editarSalida = (salida) => {
        if (!esSalidaEditable(salida)) {
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

    const abrirModalFinalizar = (salida) => {
        if (!esSalidaFinalizable(salida)) {
            toast.warning(
                "Esta salida ya fue finalizada o no se puede finalizar."
            );
            return;
        }

        setModalFinalizar({
            visible: true,
            salida,
        });
    };

    const cerrarModalFinalizar = () => {
        if (finalizando) {
            return;
        }

        setModalFinalizar({
            visible: false,
            salida: null,
        });
    };

    const finalizarSalida = async () => {
        const salida = modalFinalizar.salida;

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
            await cargarSalidas();
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

    const limpiarFiltros = () => {
        setBusqueda("");
        setFechaDesde("");
        setFechaHasta("");
        setEstadoProcesoFiltro("");
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

                                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                                    <FaMinusCircle className="text-xl text-rose-700" />
                                </div>

                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-700">
                                        Operación de inventarios
                                    </p>

                                    <h1 className="mt-1 text-2xl md:text-3xl font-bold text-slate-900">
                                        Salidas de inventario
                                    </h1>

                                    <p className="mt-1 text-sm text-slate-500 max-w-3xl">
                                        Gestiona salidas en borrador, finaliza egresos de mercancía y controla productos, lotes, existencias y movimientos.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={cargarSalidas}
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
                                    onClick={nuevaSalida}
                                    className="h-11 px-5 rounded-xl bg-blue-800 text-white font-semibold flex items-center justify-center gap-2 hover:bg-blue-900 transition shadow-sm"
                                >
                                    <FaPlus />
                                    Nueva salida
                                </button>
                            </div>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto">
                        <div className="p-5 md:p-7 space-y-6">
                            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-slate-500">
                                                Salidas
                                            </p>

                                            <p className="mt-2 text-3xl font-bold text-slate-900">
                                                {resumen.totalSalidas}
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
                                                Finalizadas
                                            </p>

                                            <p className="mt-2 text-3xl font-bold text-emerald-800">
                                                {
                                                    resumen.totalFinalizadas
                                                }
                                            </p>
                                        </div>

                                        <div className="w-11 h-11 rounded-xl bg-white/70 flex items-center justify-center">
                                            <FaCheckCircle className="text-lg text-emerald-700" />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-slate-500">
                                                Productos
                                            </p>

                                            <p className="mt-2 text-3xl font-bold text-blue-800">
                                                {
                                                    resumen.totalProductos
                                                }
                                            </p>
                                        </div>

                                        <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
                                            <FaBoxes className="text-lg text-blue-700" />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-slate-500">
                                                Cantidad
                                            </p>

                                            <p className="mt-2 text-3xl font-bold text-rose-700">
                                                {formatearNumero(
                                                    resumen.totalCantidad
                                                )}
                                            </p>
                                        </div>

                                        <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center">
                                            <FaArrowRight className="text-lg text-rose-700" />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_180px_180px_180px_auto] gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Buscar salida
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
                                                placeholder="Consecutivo, tipo, usuario, operador u observación"
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
                                                Finalizada
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
                                        Historial de salidas
                                    </h2>

                                    <p className="text-sm text-slate-500">
                                        {salidas.length} registro
                                        {salidas.length === 1
                                            ? ""
                                            : "s"}{" "}
                                        encontrado
                                        {salidas.length === 1
                                            ? ""
                                            : "s"}
                                    </p>
                                </div>

                                {cargando ? (
                                    <div className="min-h-[340px] flex flex-col items-center justify-center gap-4">
                                        <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />

                                        <p className="text-sm font-medium text-slate-500">
                                            Cargando salidas...
                                        </p>
                                    </div>
                                ) : salidas.length === 0 ? (
                                    <div className="min-h-[340px] flex flex-col items-center justify-center text-center px-6">
                                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                                            <FaWarehouse className="text-2xl text-slate-500" />
                                        </div>

                                        <h3 className="mt-4 text-lg font-bold text-slate-800">
                                            No hay salidas para mostrar
                                        </h3>

                                        <p className="mt-1 text-sm text-slate-500 max-w-md">
                                            Crea una nueva salida o modifica los filtros aplicados.
                                        </p>

                                        <button
                                            type="button"
                                            onClick={nuevaSalida}
                                            className="mt-5 h-11 px-5 rounded-xl bg-blue-800 text-white font-semibold flex items-center gap-2 hover:bg-blue-900 transition"
                                        >
                                            <FaPlus />
                                            Crear salida
                                        </button>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[1240px]">
                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Salida
                                                    </th>

                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Fecha
                                                    </th>

                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Estado
                                                    </th>

                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Tipo salida
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
                                                {salidas.map(
                                                    (
                                                        salida
                                                    ) => {
                                                        const idSalida =
                                                            Number(
                                                                salida?.idSalida ??
                                                                    salida?.idDocumento ??
                                                                    salida?.id ??
                                                                    0
                                                            );

                                                        const editable =
                                                            esSalidaEditable(
                                                                salida
                                                            );

                                                        const finalizable =
                                                            esSalidaFinalizable(
                                                                salida
                                                            );

                                                        return (
                                                            <tr
                                                                key={
                                                                    idSalida
                                                                }
                                                                className="hover:bg-slate-50 transition"
                                                            >
                                                                <td className="px-5 py-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                                                                            <FaMinusCircle />
                                                                        </div>

                                                                        <div>
                                                                            <p className="font-semibold text-slate-900">
                                                                                {salida?.consecutivo ||
                                                                                    `SAL-${idSalida}`}
                                                                            </p>

                                                                            <p className="text-xs text-slate-500">
                                                                                {salida?.tipoOrigen ||
                                                                                    "MANUAL"}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </td>

                                                                <td className="px-5 py-4">
                                                                    <div className="flex items-center gap-2 text-sm text-slate-700">
                                                                        <FaCalendarAlt className="text-slate-400" />
                                                                        {formatearFecha(
                                                                            salida?.fechaDocumento
                                                                        )}
                                                                    </div>
                                                                </td>

                                                                <td className="px-5 py-4">
                                                                    <span
                                                                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold ${claseEstadoProceso(
                                                                            salida
                                                                        )}`}
                                                                    >
                                                                        {obtenerEstadoProceso(
                                                                            salida
                                                                        ) ===
                                                                        "FINALIZADA" ? (
                                                                            <FaCheckCircle />
                                                                        ) : (
                                                                            <FaExclamationTriangle />
                                                                        )}
                                                                        {textoEstadoProceso(
                                                                            salida
                                                                        )}
                                                                    </span>

                                                                    {salida?.fechaFinalizacion && (
                                                                        <p className="mt-1 text-xs text-slate-500">
                                                                            Cierre:{" "}
                                                                            {formatearFecha(
                                                                                salida.fechaFinalizacion
                                                                            )}
                                                                        </p>
                                                                    )}
                                                                </td>

                                                                <td className="px-5 py-4">
                                                                    <p className="text-sm font-semibold text-slate-800">
                                                                        {salida?.tipoDocumento ||
                                                                            salida?.nombreTipoDocumento ||
                                                                            "Salida de inventario"}
                                                                    </p>

                                                                    <p className="text-xs text-slate-500">
                                                                        {salida?.codigoTipoDocumento ||
                                                                            salida?.naturaleza ||
                                                                            ""}
                                                                    </p>

                                                                    {Number(
                                                                        salida?.permiteLoteVencido ??
                                                                            0
                                                                    ) ===
                                                                        1 && (
                                                                        <span className="mt-1 inline-flex px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                                                                            Permite vencidos
                                                                        </span>
                                                                    )}
                                                                </td>

                                                                <td className="px-5 py-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <FaUserCheck className="text-slate-400" />

                                                                        <div>
                                                                            <p className="text-sm font-semibold text-slate-800">
                                                                                {salida?.operador ||
                                                                                    salida?.nombreOperador ||
                                                                                    salida?.nombreUsuario ||
                                                                                    "Sin operador"}
                                                                            </p>

                                                                            <p className="text-xs text-slate-500">
                                                                                {salida?.codigoOperador ||
                                                                                    salida?.documentoOperador ||
                                                                                    salida?.correoUsuario ||
                                                                                    ""}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </td>

                                                                <td className="px-5 py-4 text-center">
                                                                    <span className="inline-flex items-center justify-center min-w-12 px-3 py-1.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-xs font-bold">
                                                                        {Number(
                                                                            salida?.totalProductos ??
                                                                                0
                                                                        )}
                                                                    </span>
                                                                </td>

                                                                <td className="px-5 py-4 text-center">
                                                                    <span className="inline-flex items-center justify-center min-w-16 px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
                                                                        {formatearNumero(
                                                                            salida?.totalCantidad
                                                                        )}
                                                                    </span>
                                                                </td>

                                                                <td className="px-5 py-4">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                verDetalle(
                                                                                    salida
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
                                                                                    editarSalida(
                                                                                        salida
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
                                                                                        salida
                                                                                    )
                                                                                }
                                                                                className="h-10 px-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold flex items-center justify-center gap-2 hover:bg-emerald-100 transition"
                                                                                title="Finalizar salida"
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
                                            Finalizar salida
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
                                    {modalFinalizar.salida
                                        ?.consecutivo ||
                                        "Salida seleccionada"}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                    Tipo:{" "}
                                    {modalFinalizar.salida
                                        ?.tipoDocumento ||
                                        "Salida de inventario"}
                                </p>

                                <p className="mt-1 text-xs text-slate-500">
                                    Fecha:{" "}
                                    {formatearFecha(
                                        modalFinalizar.salida
                                            ?.fechaDocumento
                                    )}
                                </p>

                                <div className="mt-3 grid grid-cols-2 gap-3">
                                    <div className="rounded-xl bg-white border border-slate-200 p-3">
                                        <p className="text-xs text-slate-500">
                                            Productos
                                        </p>
                                        <p className="text-lg font-bold text-slate-900">
                                            {Number(
                                                modalFinalizar
                                                    .salida
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
                                                    .salida
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
                                        Al finalizar, esta salida descontará existencias y generará movimientos de inventario. Después no podrá editarse. Si no hay stock suficiente, el sistema bloqueará la finalización.
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
