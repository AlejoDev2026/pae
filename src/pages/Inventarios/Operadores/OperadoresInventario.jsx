import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaCheckCircle,
    FaEdit,
    FaEnvelope,
    FaExclamationTriangle,
    FaIdCard,
    FaPhoneAlt,
    FaPlus,
    FaPowerOff,
    FaSearch,
    FaSyncAlt,
    FaTimes,
    FaTimesCircle,
    FaUserCheck,
    FaUserTimes,
    FaUsersCog,
} from "react-icons/fa";
import { toast } from "react-toastify";

const API_BASE_OPERADORES =
    "https://app.accionporcolombia.com/servicesPae/Inventario/Operadores/";

export const OperadoresInventario = ({
    setSidebar,
    navegar,
}) => {
    const abrirMenu = () => setSidebar(true);
    const estadoPagina = (pagina) => navegar(pagina);

    const [operadores, setOperadores] = useState([]);
    const [cargando, setCargando] = useState(true);

    const [
        actualizandoEstado,
        setActualizandoEstado,
    ] = useState(null);

    const [busqueda, setBusqueda] = useState("");

    const [
        filtroEstadoOperador,
        setFiltroEstadoOperador,
    ] = useState("TODOS");

    const [
        filtroEstadoUsuario,
        setFiltroEstadoUsuario,
    ] = useState("TODOS");

    const [
        modalConfirmacionEstado,
        setModalConfirmacionEstado,
    ] = useState({
        visible: false,
        operador: null,
        nuevoEstado: null,
    });

    const respuestaExitosa = (respuesta) =>
        respuesta?.rpta === "si" ||
        respuesta?.rpta === true;

    const cargarOperadores = useCallback(async () => {
        setCargando(true);

        try {
            const respuesta = await fetch(
                `${API_BASE_OPERADORES}InventarioOperadoresListar.php?t=${Date.now()}`,
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
                    "No fue posible consultar los operadores."
                );
            }

            setOperadores(
                Array.isArray(resultado?.data)
                    ? resultado.data
                    : []
            );
        } catch (error) {
            console.error(
                "Error cargando operadores:",
                error
            );

            setOperadores([]);

            toast.error(
                error?.message ||
                "No fue posible cargar los operadores."
            );
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        cargarOperadores();
    }, [cargarOperadores]);

    useEffect(() => {
        if (!modalConfirmacionEstado.visible) {
            return undefined;
        }

        const overflowAnterior =
            document.body.style.overflow;

        const cerrarConEscape = (event) => {
            if (event.key === "Escape") {
                cerrarModalEstado();
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
    }, [modalConfirmacionEstado.visible]);

    const operadoresFiltrados = useMemo(() => {
        const textoBusqueda = busqueda
            .trim()
            .toLowerCase();

        return operadores
            .filter((operador) => {
                const estadoOperador = Number(
                    operador?.estadoOperador ??
                    operador?.estado ??
                    0
                );

                const estadoUsuario =
                    operador?.estadoUsuario === null ||
                        operador?.estadoUsuario === undefined
                        ? null
                        : Number(
                            operador.estadoUsuario
                        );

                const coincideEstadoOperador =
                    filtroEstadoOperador ===
                    "TODOS" ||
                    (filtroEstadoOperador ===
                        "ACTIVOS" &&
                        estadoOperador === 1) ||
                    (filtroEstadoOperador ===
                        "INACTIVOS" &&
                        estadoOperador === 0);

                const coincideEstadoUsuario =
                    filtroEstadoUsuario ===
                    "TODOS" ||
                    (filtroEstadoUsuario ===
                        "ACTIVOS" &&
                        estadoUsuario === 1) ||
                    (filtroEstadoUsuario ===
                        "INACTIVOS" &&
                        estadoUsuario === 2);

                if (
                    !coincideEstadoOperador ||
                    !coincideEstadoUsuario
                ) {
                    return false;
                }

                if (!textoBusqueda) {
                    return true;
                }

                const contenido = [
                    operador?.codigo,
                    operador?.documento,
                    operador?.tipoDocumento,
                    operador?.nombre,
                    operador?.nombreCompleto,
                    operador?.correo,
                    operador?.telefono,
                    operador?.cargo,
                    operador?.observacion,
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

                return contenido.includes(
                    textoBusqueda
                );
            })
            .sort((a, b) =>
                String(
                    a?.nombreCompleto ||
                    a?.nombre ||
                    ""
                ).localeCompare(
                    String(
                        b?.nombreCompleto ||
                        b?.nombre ||
                        ""
                    ),
                    "es",
                    {
                        sensitivity: "base",
                    }
                )
            );
    }, [
        operadores,
        busqueda,
        filtroEstadoOperador,
        filtroEstadoUsuario,
    ]);

    const resumen = useMemo(() => {
        return operadores.reduce(
            (acumulado, operador) => {
                const operadorActivo =
                    Number(
                        operador?.estadoOperador ??
                        operador?.estado ??
                        0
                    ) === 1;

                const usuarioActivo =
                    Number(
                        operador?.estadoUsuario ?? 2
                    ) === 1;

                acumulado.total += 1;

                if (operadorActivo) {
                    acumulado.operadoresActivos += 1;
                } else {
                    acumulado.operadoresInactivos += 1;
                }

                if (usuarioActivo) {
                    acumulado.usuariosActivos += 1;
                } else {
                    acumulado.usuariosInactivos += 1;
                }

                return acumulado;
            },
            {
                total: 0,
                operadoresActivos: 0,
                operadoresInactivos: 0,
                usuariosActivos: 0,
                usuariosInactivos: 0,
            }
        );
    }, [operadores]);

    const crearOperador = () => {
        localStorage.removeItem(
            "operadorInventarioEditar"
        );

        estadoPagina(
            "CrearOperadorInventario"
        );
    };

    const editarOperador = (operador) => {
        localStorage.setItem(
            "operadorInventarioEditar",
            JSON.stringify(operador)
        );

        estadoPagina(
            "EditarOperadorInventario"
        );
    };

    const abrirModalEstado = (operador) => {
        const estadoActual = Number(
            operador?.estadoOperador ??
            operador?.estado ??
            0
        );

        const nuevoEstado =
            estadoActual === 1 ? 0 : 1;

        setModalConfirmacionEstado({
            visible: true,
            operador,
            nuevoEstado,
        });
    };

    const cerrarModalEstado = () => {
        if (actualizandoEstado !== null) {
            return;
        }

        setModalConfirmacionEstado({
            visible: false,
            operador: null,
            nuevoEstado: null,
        });
    };

    const confirmarCambioEstado = async () => {
        const operador =
            modalConfirmacionEstado.operador;
        const nuevoEstado =
            modalConfirmacionEstado.nuevoEstado;

        const idOperador = Number(
            operador?.idOperador ??
            operador?.id ??
            0
        );

        if (!idOperador) {
            toast.error(
                "No se encontró el identificador del operador."
            );
            cerrarModalEstado();
            return;
        }

        setActualizandoEstado(idOperador);

        try {
            const respuesta = await fetch(
                `${API_BASE_OPERADORES}InventarioOperadoresCambiarEstado.php`,
                {
                    method: "POST",
                    cache: "no-store",
                    headers: {
                        "Content-Type":
                            "application/json",
                        Accept: "application/json",
                    },
                    body: JSON.stringify({
                        idOperador,
                        id: idOperador,
                        estado: nuevoEstado,
                    }),
                }
            );

            const texto =
                await respuesta.text();

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
                    "No fue posible cambiar el estado del operador."
                );
            }

            toast.success(
                resultado?.mensaje ||
                (nuevoEstado === 1
                    ? "Operador activado correctamente."
                    : "Operador inactivado correctamente.")
            );

            cerrarModalEstado();
            await cargarOperadores();
        } catch (error) {
            console.error(
                "Error cambiando estado:",
                error
            );

            toast.error(
                error?.message ||
                "No fue posible cambiar el estado del operador."
            );
        } finally {
            setActualizandoEstado(null);
        }
    };

    const limpiarFiltros = () => {
        setBusqueda("");
        setFiltroEstadoOperador("TODOS");
        setFiltroEstadoUsuario("TODOS");
    };

    const obtenerIniciales = (nombre = "") => {
        const partes = String(nombre)
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2);

        if (partes.length === 0) {
            return "OP";
        }

        return partes
            .map((parte) =>
                parte.charAt(0)
            )
            .join("")
            .toUpperCase();
    };

    const operadorModal =
        modalConfirmacionEstado.operador;

    const nombreOperadorModal =
        operadorModal?.nombreCompleto ||
        operadorModal?.nombre ||
        operadorModal?.codigo ||
        "este operador";

    const accionModal =
        modalConfirmacionEstado.nuevoEstado === 1
            ? "activar"
            : "inactivar";

    const accionModalTexto =
        modalConfirmacionEstado.nuevoEstado === 1
            ? "Activar operador"
            : "Inactivar operador";

    const accionModalDescripcion =
        modalConfirmacionEstado.nuevoEstado === 1
            ? "El operador volverá a estar disponible para las operaciones de inventario."
            : "El operador dejará de estar disponible para las operaciones de inventario.";

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

                                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                                    <FaUsersCog className="text-xl text-blue-800" />
                                </div>

                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                                        Configuración de
                                        inventarios
                                    </p>

                                    <h1 className="mt-1 text-2xl md:text-3xl font-bold text-slate-900">
                                        Operadores
                                    </h1>

                                    <p className="mt-1 text-sm text-slate-500 max-w-3xl">
                                        Administra los
                                        usuarios autorizados y
                                        su estado
                                        independiente como
                                        operadores de
                                        inventario.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={
                                        cargarOperadores
                                    }
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
                                    onClick={crearOperador}
                                    className="h-11 px-5 rounded-xl bg-blue-800 text-white font-semibold flex items-center justify-center gap-2 hover:bg-blue-900 transition shadow-sm"
                                >
                                    <FaPlus />
                                    Nuevo operador
                                </button>
                            </div>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto">
                        <div className="p-5 md:p-7 space-y-6">
                            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-slate-500">
                                                Total
                                                operadores
                                            </p>

                                            <p className="mt-2 text-3xl font-bold text-slate-900">
                                                {
                                                    resumen.total
                                                }
                                            </p>
                                        </div>

                                        <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center">
                                            <FaUsersCog className="text-lg text-slate-700" />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-slate-500">
                                                Operadores
                                                activos
                                            </p>

                                            <p className="mt-2 text-3xl font-bold text-blue-800">
                                                {
                                                    resumen.operadoresActivos
                                                }
                                            </p>
                                        </div>

                                        <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
                                            <FaCheckCircle className="text-lg text-blue-700" />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-slate-500">
                                                Usuarios
                                                activos
                                            </p>

                                            <p className="mt-2 text-3xl font-bold text-emerald-700">
                                                {
                                                    resumen.usuariosActivos
                                                }
                                            </p>
                                        </div>

                                        <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center">
                                            <FaUserCheck className="text-lg text-emerald-700" />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-slate-500">
                                                Usuarios
                                                inactivos
                                            </p>

                                            <p className="mt-2 text-3xl font-bold text-rose-700">
                                                {
                                                    resumen.usuariosInactivos
                                                }
                                            </p>
                                        </div>

                                        <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center">
                                            <FaUserTimes className="text-lg text-rose-700" />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[1fr_220px_220px_auto] gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Buscar
                                            operador
                                        </label>

                                        <div className="relative">
                                            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                                            <input
                                                type="text"
                                                value={
                                                    busqueda
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    setBusqueda(
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                                placeholder="Nombre, documento, correo, código o cargo"
                                                className="w-full h-11 pl-11 pr-4 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Estado
                                            operador
                                        </label>

                                        <select
                                            value={
                                                filtroEstadoOperador
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                setFiltroEstadoOperador(
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            className="w-full h-11 px-4 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                        >
                                            <option value="TODOS">
                                                Todos
                                            </option>

                                            <option value="ACTIVOS">
                                                Activos
                                            </option>

                                            <option value="INACTIVOS">
                                                Inactivos
                                            </option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Estado
                                            usuario
                                        </label>

                                        <select
                                            value={
                                                filtroEstadoUsuario
                                            }
                                            onChange={(
                                                event
                                            ) =>
                                                setFiltroEstadoUsuario(
                                                    event
                                                        .target
                                                        .value
                                                )
                                            }
                                            className="w-full h-11 px-4 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                        >
                                            <option value="TODOS">
                                                Todos
                                            </option>

                                            <option value="ACTIVOS">
                                                Activos
                                            </option>

                                            <option value="INACTIVOS">
                                                Inactivos
                                            </option>
                                        </select>
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
                                        Usuarios
                                        autorizados
                                    </h2>

                                    <p className="text-sm text-slate-500">
                                        {
                                            operadoresFiltrados.length
                                        }{" "}
                                        registro
                                        {operadoresFiltrados.length ===
                                            1
                                            ? ""
                                            : "s"}{" "}
                                        encontrado
                                        {operadoresFiltrados.length ===
                                            1
                                            ? ""
                                            : "s"}
                                    </p>
                                </div>

                                {cargando ? (
                                    <div className="min-h-[340px] flex flex-col items-center justify-center gap-4">
                                        <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />

                                        <p className="text-sm font-medium text-slate-500">
                                            Cargando
                                            operadores...
                                        </p>
                                    </div>
                                ) : operadoresFiltrados.length ===
                                    0 ? (
                                    <div className="min-h-[340px] flex flex-col items-center justify-center text-center px-6">
                                        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                                            <FaUsersCog className="text-2xl text-slate-500" />
                                        </div>

                                        <h3 className="mt-4 text-lg font-bold text-slate-800">
                                            No hay
                                            operadores para
                                            mostrar
                                        </h3>

                                        <p className="mt-1 text-sm text-slate-500 max-w-md">
                                            Crea el primer
                                            operador o
                                            modifica los
                                            filtros
                                            aplicados.
                                        </p>

                                        {operadores.length ===
                                            0 && (
                                                <button
                                                    type="button"
                                                    onClick={
                                                        crearOperador
                                                    }
                                                    className="mt-5 h-11 px-5 rounded-xl bg-blue-800 text-white font-semibold flex items-center gap-2 hover:bg-blue-900 transition"
                                                >
                                                    <FaPlus />
                                                    Crear
                                                    operador
                                                </button>
                                            )}
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full min-w-[1120px]">
                                            <thead className="bg-slate-50 border-b border-slate-200">
                                                <tr>
                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Operador
                                                    </th>

                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Usuario
                                                        del
                                                        sistema
                                                    </th>

                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Identificación
                                                    </th>

                                                    <th className="px-5 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Cargo
                                                    </th>

                                                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Estado
                                                        usuario
                                                    </th>

                                                    <th className="px-5 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Estado
                                                        operador
                                                    </th>

                                                    <th className="px-5 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">
                                                        Acciones
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-slate-200">
                                                {operadoresFiltrados.map(
                                                    (
                                                        operador
                                                    ) => {
                                                        const idOperador =
                                                            Number(
                                                                operador?.idOperador ??
                                                                operador?.id ??
                                                                0
                                                            );

                                                        const operadorActivo =
                                                            Number(
                                                                operador?.estadoOperador ??
                                                                operador?.estado ??
                                                                0
                                                            ) ===
                                                            1;

                                                        const estadoOperadorTexto =
                                                            operador?.estadoOperadorTexto ||
                                                            operador?.estadoTexto ||
                                                            (operadorActivo
                                                                ? "Activo"
                                                                : "Inactivo");

                                                        const estadoUsuario =
                                                            operador?.estadoUsuario ===
                                                                null ||
                                                                operador?.estadoUsuario ===
                                                                undefined
                                                                ? null
                                                                : Number(
                                                                    operador.estadoUsuario
                                                                );

                                                        const usuarioActivo =
                                                            estadoUsuario ===
                                                            1;

                                                        const estadoUsuarioTexto =
                                                            operador?.estadoUsuarioTexto ||
                                                            (usuarioActivo
                                                                ? "Activo"
                                                                : estadoUsuario ===
                                                                    2
                                                                    ? "Inactivo"
                                                                    : "Sin estado");

                                                        const nombre =
                                                            operador?.nombreCompleto ||
                                                            operador?.nombre ||
                                                            "Usuario sin nombre";

                                                        return (
                                                            <tr
                                                                key={
                                                                    idOperador
                                                                }
                                                                className="hover:bg-slate-50 transition"
                                                            >
                                                                <td className="px-5 py-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center font-bold text-blue-800 shrink-0">
                                                                            {obtenerIniciales(
                                                                                nombre
                                                                            )}
                                                                        </div>

                                                                        <div className="min-w-0">
                                                                            <p className="font-semibold text-slate-900 truncate max-w-[230px]">
                                                                                {
                                                                                    nombre
                                                                                }
                                                                            </p>

                                                                            <p className="text-xs text-slate-500">
                                                                                {operador?.codigo ||
                                                                                    `OP-${idOperador}`}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </td>

                                                                <td className="px-5 py-4">
                                                                    <div className="space-y-1.5">
                                                                        <div className="flex items-center gap-2 text-sm text-slate-700">
                                                                            <FaEnvelope className="text-slate-400 shrink-0" />

                                                                            <span className="truncate max-w-[220px]">
                                                                                {operador?.correo ||
                                                                                    "Sin correo"}
                                                                            </span>
                                                                        </div>

                                                                        <div className="flex items-center gap-2 text-sm text-slate-500">
                                                                            <FaPhoneAlt className="text-slate-400 shrink-0" />

                                                                            <span>
                                                                                {operador?.telefono ||
                                                                                    "Sin teléfono"}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </td>

                                                                <td className="px-5 py-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <FaIdCard className="text-slate-400" />

                                                                        <div>
                                                                            <p className="text-sm font-semibold text-slate-800">
                                                                                {operador?.documento ||
                                                                                    "Sin documento"}
                                                                            </p>

                                                                            <p className="text-xs text-slate-500">
                                                                                {operador?.tipoDocumento ||
                                                                                    "CC"}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                </td>

                                                                <td className="px-5 py-4">
                                                                    <span className="inline-flex px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold">
                                                                        {operador?.cargo ||
                                                                            "OPERADOR"}
                                                                    </span>
                                                                </td>

                                                                <td className="px-5 py-4 text-center">
                                                                    <span
                                                                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${estadoUsuario ===
                                                                                null
                                                                                ? "bg-slate-100 text-slate-600 border border-slate-200"
                                                                                : usuarioActivo
                                                                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                                                                            }`}
                                                                    >
                                                                        {usuarioActivo ? (
                                                                            <FaCheckCircle />
                                                                        ) : (
                                                                            <FaTimesCircle />
                                                                        )}

                                                                        {
                                                                            estadoUsuarioTexto
                                                                        }
                                                                    </span>
                                                                </td>

                                                                <td className="px-5 py-4 text-center">
                                                                    <span
                                                                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${operadorActivo
                                                                                ? "bg-blue-50 text-blue-800 border border-blue-200"
                                                                                : "bg-slate-100 text-slate-600 border border-slate-200"
                                                                            }`}
                                                                    >
                                                                        {operadorActivo ? (
                                                                            <FaCheckCircle />
                                                                        ) : (
                                                                            <FaTimesCircle />
                                                                        )}

                                                                        {
                                                                            estadoOperadorTexto
                                                                        }
                                                                    </span>
                                                                </td>

                                                                <td className="px-5 py-4">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                editarOperador(
                                                                                    operador
                                                                                )
                                                                            }
                                                                            className="w-10 h-10 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 flex items-center justify-center hover:bg-blue-100 transition"
                                                                            title="Editar operador"
                                                                        >
                                                                            <FaEdit />
                                                                        </button>

                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                abrirModalEstado(
                                                                                    operador
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                actualizandoEstado ===
                                                                                idOperador
                                                                            }
                                                                            className={`w-10 h-10 rounded-xl border flex items-center justify-center transition disabled:opacity-60 ${operadorActivo
                                                                                    ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                                                                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                                                                }`}
                                                                            title={
                                                                                operadorActivo
                                                                                    ? "Inactivar operador"
                                                                                    : "Activar operador"
                                                                            }
                                                                        >
                                                                            {actualizandoEstado ===
                                                                                idOperador ? (
                                                                                <FaSyncAlt className="animate-spin" />
                                                                            ) : (
                                                                                <FaPowerOff />
                                                                            )}
                                                                        </button>
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

            {modalConfirmacionEstado.visible && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6">
                    <button
                        type="button"
                        aria-label="Cerrar modal"
                        onClick={cerrarModalEstado}
                        className="absolute inset-0 bg-slate-950/60"
                    />

                    <section className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <header className="px-5 py-5 border-b border-slate-200 bg-white">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${modalConfirmacionEstado.nuevoEstado ===
                                                1
                                                ? "bg-emerald-50 border-emerald-200"
                                                : "bg-rose-50 border-rose-200"
                                            }`}
                                    >
                                        {modalConfirmacionEstado.nuevoEstado ===
                                            1 ? (
                                            <FaPowerOff className="text-emerald-700 text-lg" />
                                        ) : (
                                            <FaExclamationTriangle className="text-rose-700 text-lg" />
                                        )}
                                    </div>

                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                                            Confirmación
                                        </p>

                                        <h2 className="mt-1 text-xl font-bold text-slate-900">
                                            {
                                                accionModalTexto
                                            }
                                        </h2>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={cerrarModalEstado}
                                    disabled={
                                        actualizandoEstado !==
                                        null
                                    }
                                    className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 transition disabled:opacity-60"
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        </header>

                        <div className="px-5 py-6">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-blue-800 text-lg font-bold shrink-0">
                                        {obtenerIniciales(
                                            nombreOperadorModal
                                        )}
                                    </div>

                                    <div className="min-w-0">
                                        <h3 className="font-bold text-slate-900 truncate">
                                            {
                                                nombreOperadorModal
                                            }
                                        </h3>

                                        <p className="mt-1 text-sm text-slate-500">
                                            {operadorModal?.codigo ||
                                                "Sin código"}
                                        </p>

                                        <p className="mt-1 text-sm text-slate-500">
                                            {operadorModal?.cargo ||
                                                "OPERADOR"}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-5 space-y-3">
                                <p className="text-sm text-slate-700 leading-6">
                                    ¿Estás seguro de que
                                    deseas{" "}
                                    <span className="font-bold text-slate-900">
                                        {accionModal}
                                    </span>{" "}
                                    a{" "}
                                    <span className="font-bold text-slate-900">
                                        {
                                            nombreOperadorModal
                                        }
                                    </span>
                                    ?
                                </p>

                                <p className="text-sm text-slate-500 leading-6">
                                    {
                                        accionModalDescripcion
                                    }
                                </p>

                                <div
                                    className={`rounded-xl border p-4 ${modalConfirmacionEstado.nuevoEstado ===
                                            1
                                            ? "bg-emerald-50 border-emerald-200"
                                            : "bg-amber-50 border-amber-200"
                                        }`}
                                >
                                    <p
                                        className={`text-sm font-medium ${modalConfirmacionEstado.nuevoEstado ===
                                                1
                                                ? "text-emerald-800"
                                                : "text-amber-800"
                                            }`}
                                    >
                                        {modalConfirmacionEstado.nuevoEstado ===
                                            1
                                            ? "Esta acción habilitará nuevamente al operador dentro del módulo de inventarios."
                                            : "Esta acción solo cambia el estado del operador en inventarios. No modifica el estado del usuario del sistema."}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <footer className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                            <button
                                type="button"
                                onClick={cerrarModalEstado}
                                disabled={
                                    actualizandoEstado !==
                                    null
                                }
                                className="h-11 px-5 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-100 disabled:opacity-60 transition"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={
                                    confirmarCambioEstado
                                }
                                disabled={
                                    actualizandoEstado !==
                                    null
                                }
                                className={`h-11 px-6 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition shadow-sm ${modalConfirmacionEstado.nuevoEstado ===
                                        1
                                        ? "bg-emerald-700 hover:bg-emerald-800"
                                        : "bg-rose-700 hover:bg-rose-800"
                                    }`}
                            >
                                {actualizandoEstado !==
                                    null ? (
                                    <>
                                        <FaSyncAlt className="animate-spin" />
                                        Procesando...
                                    </>
                                ) : (
                                    <>
                                        <FaPowerOff />
                                        {
                                            accionModalTexto
                                        }
                                    </>
                                )}
                            </button>
                        </footer>
                    </section>
                </div>
            )}
        </>
    );
};