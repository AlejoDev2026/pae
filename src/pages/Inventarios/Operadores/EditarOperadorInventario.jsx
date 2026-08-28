import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaArrowLeft,
    FaCheckCircle,
    FaEnvelope,
    FaExclamationCircle,
    FaIdBadge,
    FaIdCard,
    FaPhoneAlt,
    FaSave,
    FaSearch,
    FaSyncAlt,
    FaTimes,
    FaUserCheck,
    FaUserClock,
    FaUserEdit,
    FaUsers,
    FaUsersCog,
} from "react-icons/fa";
import { toast } from "react-toastify";

const API_BASE_OPERADORES =
    "https://app.accionporcolombia.com/servicesPae/Inventario/Operadores/";

const FORMULARIO_INICIAL = {
    idOperador: "",
    idUsuario: "",
    codigo: "",
    tipoDocumento: "CC",
    documento: "",
    cargo: "OPERADOR",
    observacion: "",
    estado: "1",
};

export const EditarOperadorInventario = ({
    setSidebar,
    navegar,
}) => {
    const abrirMenu = () => setSidebar(true);
    const estadoPagina = (pagina) => navegar(pagina);


    const [formulario, setFormulario] = useState(
        FORMULARIO_INICIAL
    );

    const [operadorOriginal, setOperadorOriginal] =
        useState(null);

    const [usuarios, setUsuarios] = useState([]);
    const [cargandoPagina, setCargandoPagina] =
        useState(true);
    const [cargandoUsuarios, setCargandoUsuarios] =
        useState(false);
    const [guardando, setGuardando] = useState(false);
    const [errorUsuarios, setErrorUsuarios] =
        useState("");

    const [modalUsuarios, setModalUsuarios] =
        useState(false);
    const [busquedaUsuario, setBusquedaUsuario] =
        useState("");

    const respuestaExitosa = (respuesta) =>
        respuesta?.rpta === "si" ||
        respuesta?.rpta === true;

    const normalizarOperador = (operador) => ({
        idOperador: String(
            operador?.idOperador ??
            operador?.id ??
            ""
        ),
        idUsuario: String(
            operador?.idUsuario ?? ""
        ),
        codigo: String(
            operador?.codigo ?? ""
        ).toUpperCase(),
        tipoDocumento: String(
            operador?.tipoDocumento ?? "CC"
        ).toUpperCase(),
        documento: String(
            operador?.documento ?? ""
        ).toUpperCase(),
        cargo: String(
            operador?.cargo ?? "OPERADOR"
        ).toUpperCase(),
        observacion: String(
            operador?.observacion ?? ""
        ),
        estado: String(
            Number(operador?.estado ?? 1)
        ),
    });

    const obtenerOperadorGuardado = () => {
        try {
            const contenido = localStorage.getItem(
                "operadorInventarioEditar"
            );

            if (!contenido) {
                return null;
            }

            const operador = JSON.parse(contenido);

            const idOperador = Number(
                operador?.idOperador ??
                operador?.id ??
                0
            );

            if (!idOperador) {
                return null;
            }

            return operador;
        } catch (error) {
            console.error(
                "Error leyendo operador:",
                error
            );

            return null;
        }
    };

    const cargarDetalleOperador = async (
        idOperador
    ) => {
        const respuesta = await fetch(
            `${API_BASE_OPERADORES}InventarioOperadoresListar.php?idOperador=${idOperador}&t=${Date.now()}`,
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
                "No fue posible consultar el operador."
            );
        }

        const listado = Array.isArray(
            resultado?.data
        )
            ? resultado.data
            : [];

        if (listado.length === 0) {
            throw new Error(
                "No se encontró el operador seleccionado."
            );
        }

        return listado[0];
    };

    const cargarUsuarios = useCallback(
        async (idUsuarioActual = 0) => {
            setCargandoUsuarios(true);
            setErrorUsuarios("");

            try {
                const parametros = new URLSearchParams({
                    soloActivos: "1",
                    disponibles: "1",
                    incluirIdUsuario: String(
                        idUsuarioActual || 0
                    ),
                    t: String(Date.now()),
                });

                const respuesta = await fetch(
                    `${API_BASE_OPERADORES}InventarioUsuariosListar.php?${parametros.toString()}`,
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
                        "El servicio de usuarios devolvió una respuesta no válida."
                    );
                }

                if (
                    !respuesta.ok ||
                    !respuestaExitosa(resultado)
                ) {
                    throw new Error(
                        resultado?.mensaje ||
                        resultado?.error ||
                        "No fue posible consultar los usuarios."
                    );
                }

                const listado = Array.isArray(
                    resultado?.data
                )
                    ? resultado.data
                    : [];

                const usuariosPermitidos = listado
                    .filter((usuario) => {
                        const idUsuario = Number(
                            usuario?.idUsuario ?? 0
                        );

                        const usuarioActivo =
                            Number(
                                usuario?.estado ?? 0
                            ) === 1;

                        const vinculado =
                            Number(
                                usuario?.vinculadoOperador ??
                                0
                            ) === 1;

                        const esUsuarioActual =
                            idUsuario ===
                            Number(
                                idUsuarioActual || 0
                            );

                        return (
                            usuarioActivo &&
                            (!vinculado ||
                                esUsuarioActual)
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

                setUsuarios(usuariosPermitidos);
            } catch (error) {
                console.error(
                    "Error cargando usuarios:",
                    error
                );

                setUsuarios([]);

                setErrorUsuarios(
                    error?.message ||
                    "No fue posible cargar los usuarios disponibles."
                );

                toast.error(
                    error?.message ||
                    "No fue posible cargar los usuarios disponibles."
                );
            } finally {
                setCargandoUsuarios(false);
            }
        },
        []
    );

    useEffect(() => {
        const inicializar = async () => {
            const operadorGuardado =
                obtenerOperadorGuardado();

            if (!operadorGuardado) {
                toast.error(
                    "No se recibió el operador seleccionado."
                );

                estadoPagina(
                    "OperadoresInventario"
                );

                return;
            }

            const idOperador = Number(
                operadorGuardado?.idOperador ??
                operadorGuardado?.id ??
                0
            );

            let operadorActual =
                operadorGuardado;

            setOperadorOriginal(
                operadorGuardado
            );

            setFormulario(
                normalizarOperador(
                    operadorGuardado
                )
            );

            try {
                const operadorConsultado =
                    await cargarDetalleOperador(
                        idOperador
                    );

                operadorActual =
                    operadorConsultado;

                setOperadorOriginal(
                    operadorConsultado
                );

                setFormulario(
                    normalizarOperador(
                        operadorConsultado
                    )
                );
            } catch (error) {
                console.error(
                    "Error actualizando detalle:",
                    error
                );

                toast.warning(
                    "Se cargaron los datos guardados localmente porque no fue posible actualizar el detalle."
                );
            }

            await cargarUsuarios(
                Number(
                    operadorActual?.idUsuario ??
                    operadorGuardado?.idUsuario ??
                    0
                )
            );

            setCargandoPagina(false);
        };

        inicializar();
    }, [cargarUsuarios]);

    useEffect(() => {
        if (!modalUsuarios) {
            return undefined;
        }

        const cerrarConEscape = (event) => {
            if (event.key === "Escape") {
                setModalUsuarios(false);
            }
        };

        const overflowAnterior =
            document.body.style.overflow;

        document.body.style.overflow =
            "hidden";

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
    }, [modalUsuarios]);

    const usuarioOriginal = useMemo(() => {
        if (!operadorOriginal) {
            return null;
        }

        return {
            idUsuario: Number(
                operadorOriginal?.idUsuario ?? 0
            ),
            nombre:
                operadorOriginal?.nombreCompleto ||
                operadorOriginal?.nombre ||
                "",
            nombreCompleto:
                operadorOriginal?.nombreCompleto ||
                operadorOriginal?.nombre ||
                "",
            correo:
                operadorOriginal?.correo || "",
            telefono:
                operadorOriginal?.telefono || "",
            documento:
                operadorOriginal?.documento || "",
            tipoDocumento:
                operadorOriginal?.tipoDocumento ||
                "CC",
            estado: Number(
                operadorOriginal?.estadoUsuario ?? 1
            ),
        };
    }, [operadorOriginal]);

    const usuarioSeleccionado = useMemo(() => {
        const idUsuarioSeleccionado = Number(
            formulario.idUsuario || 0
        );

        const usuarioEncontrado =
            usuarios.find(
                (usuario) =>
                    Number(
                        usuario?.idUsuario ?? 0
                    ) ===
                    idUsuarioSeleccionado
            );

        if (usuarioEncontrado) {
            return usuarioEncontrado;
        }

        if (
            usuarioOriginal &&
            Number(
                usuarioOriginal.idUsuario
            ) === idUsuarioSeleccionado
        ) {
            return usuarioOriginal;
        }

        return null;
    }, [
        usuarios,
        formulario.idUsuario,
        usuarioOriginal,
    ]);

    const usuariosFiltrados = useMemo(() => {
        const texto = busquedaUsuario
            .trim()
            .toLowerCase();

        if (!texto) {
            return usuarios;
        }

        return usuarios.filter((usuario) => {
            const contenido = [
                usuario?.idUsuario,
                usuario?.nombre,
                usuario?.nombreCompleto,
                usuario?.correo,
                usuario?.telefono,
                usuario?.documento,
                usuario?.tipoDocumento,
                usuario?.usuario,
            ]
                .filter(
                    (valor) =>
                        valor !== null &&
                        valor !== undefined &&
                        valor !== ""
                )
                .join(" ")
                .toLowerCase();

            return contenido.includes(texto);
        });
    }, [usuarios, busquedaUsuario]);

    const nombreUsuarioSeleccionado =
        usuarioSeleccionado?.nombreCompleto ||
        usuarioSeleccionado?.nombre ||
        "";

    const usuarioActivo =
        Number(
            usuarioSeleccionado?.estado ?? 1
        ) === 1;

    const cambiarCampo = (event) => {
        const { name, value } =
            event.target;

        let nuevoValor = value;

        if (
            [
                "codigo",
                "tipoDocumento",
                "documento",
                "cargo",
            ].includes(name)
        ) {
            nuevoValor =
                value.toUpperCase();
        }

        setFormulario((anterior) => ({
            ...anterior,
            [name]: nuevoValor,
        }));
    };

    const abrirModalUsuarios = () => {
        setBusquedaUsuario("");
        setModalUsuarios(true);
    };

    const cerrarModalUsuarios = () => {
        setModalUsuarios(false);
        setBusquedaUsuario("");
    };

    const seleccionarUsuario = (usuario) => {
        const idUsuario = Number(
            usuario?.idUsuario ?? 0
        );

        if (!idUsuario) {
            toast.warning(
                "El usuario seleccionado no tiene un identificador válido."
            );

            return;
        }

        setFormulario((anterior) => ({
            ...anterior,
            idUsuario: String(idUsuario),

            tipoDocumento: String(
                usuario?.tipoDocumento ||
                anterior.tipoDocumento ||
                "CC"
            ).toUpperCase(),

            documento:
                String(
                    usuario?.documento || ""
                ).trim() !== ""
                    ? String(
                        usuario.documento
                    ).toUpperCase()
                    : anterior.documento,
        }));

        cerrarModalUsuarios();
    };

    const validarFormulario = () => {
        if (!formulario.idOperador) {
            toast.error(
                "No se encontró el identificador del operador."
            );

            return false;
        }

        if (!formulario.idUsuario) {
            toast.warning(
                "Debe seleccionar un usuario del sistema."
            );

            return false;
        }

        if (
            !formulario.tipoDocumento.trim()
        ) {
            toast.warning(
                "Debe seleccionar el tipo de documento."
            );

            return false;
        }

        if (!formulario.documento.trim()) {
            toast.warning(
                "Debe ingresar el documento del operador."
            );

            return false;
        }

        if (!formulario.cargo.trim()) {
            toast.warning(
                "Debe ingresar el cargo o función dentro del inventario."
            );

            return false;
        }

        return true;
    };

    const guardarOperador = async (event) => {
        event.preventDefault();

        if (!validarFormulario()) {
            return;
        }

        setGuardando(true);

        try {
            const idOperador = Number(
                formulario.idOperador
            );

            const payload = {
                idOperador,
                id: idOperador,

                idUsuario: Number(
                    formulario.idUsuario
                ),

                codigo: formulario.codigo
                    .trim()
                    .toUpperCase(),

                tipoDocumento:
                    formulario.tipoDocumento
                        .trim()
                        .toUpperCase(),

                documento:
                    formulario.documento
                        .trim()
                        .toUpperCase(),

                cargo: formulario.cargo
                    .trim()
                    .toUpperCase(),

                observacion:
                    formulario.observacion.trim(),

                estado: Number(
                    formulario.estado
                ),
            };

            const respuesta = await fetch(
                `${API_BASE_OPERADORES}InventarioOperadoresGuardar.php`,
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
                    "No fue posible actualizar el operador."
                );
            }

            toast.success(
                resultado?.mensaje ||
                "Operador actualizado correctamente."
            );

            localStorage.removeItem(
                "operadorInventarioEditar"
            );

            estadoPagina(
                "OperadoresInventario"
            );
        } catch (error) {
            console.error(
                "Error actualizando operador:",
                error
            );

            toast.error(
                error?.message ||
                "No fue posible actualizar el operador."
            );
        } finally {
            setGuardando(false);
        }
    };

    const volver = () => {
        localStorage.removeItem(
            "operadorInventarioEditar"
        );

        estadoPagina(
            "OperadoresInventario"
        );
    };

    const obtenerIniciales = (
        nombre = ""
    ) => {
        const partes = String(nombre)
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2);

        if (partes.length === 0) {
            return "US";
        }

        return partes
            .map((parte) =>
                parte.charAt(0)
            )
            .join("")
            .toUpperCase();
    };

    if (cargandoPagina) {
        return (
            <div className="w-full h-screen flex items-center justify-center bg-slate-100">
                <div className="flex flex-col items-center gap-4">
                    <FaSyncAlt className="text-4xl text-blue-800 animate-spin" />

                    <p className="text-sm font-semibold text-slate-600">
                        Cargando operador...
                    </p>
                </div>
            </div>
        );
    }

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

                                <button
                                    type="button"
                                    onClick={volver}
                                    className="w-10 h-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-50 transition"
                                    title="Volver"
                                >
                                    <FaArrowLeft />
                                </button>

                                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                                    <FaUserEdit className="text-xl text-blue-800" />
                                </div>

                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                                        Configuración de inventarios
                                    </p>

                                    <h1 className="mt-1 text-2xl md:text-3xl font-bold text-slate-900">
                                        Editar operador
                                    </h1>

                                    <p className="mt-1 text-sm text-slate-500 max-w-3xl">
                                        Actualiza el usuario vinculado, su identificación y su función dentro del módulo.
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={volver}
                                className="h-11 px-5 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold flex items-center justify-center gap-2 hover:bg-slate-50 transition"
                            >
                                <FaArrowLeft />
                                Volver
                            </button>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto">
                        <form
                            onSubmit={guardarOperador}
                            className="p-5 md:p-7"
                        >
                            <div className="grid grid-cols-1 xl:grid-cols-[1fr_370px] gap-6 items-start">
                                <div className="space-y-6">
                                    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                                    <FaUserCheck className="text-blue-800" />
                                                </div>

                                                <div>
                                                    <h2 className="font-bold text-slate-900">
                                                        Usuario del sistema
                                                    </h2>

                                                    <p className="text-sm text-slate-500">
                                                        Usuario relacionado con el acceso y la trazabilidad del inventario.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-5 md:p-6">
                                            {errorUsuarios && (
                                                <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4">
                                                    <div className="flex items-start gap-3">
                                                        <FaExclamationCircle className="mt-0.5 text-rose-600 shrink-0" />

                                                        <div className="flex-1">
                                                            <p className="font-semibold text-rose-800">
                                                                No fue posible cargar los usuarios
                                                            </p>

                                                            <p className="mt-1 text-sm text-rose-700">
                                                                {errorUsuarios}
                                                            </p>

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    cargarUsuarios(
                                                                        Number(
                                                                            formulario.idUsuario ||
                                                                            0
                                                                        )
                                                                    )
                                                                }
                                                                className="mt-3 h-9 px-4 rounded-lg border border-rose-300 bg-white text-rose-700 text-sm font-semibold flex items-center gap-2 hover:bg-rose-100 transition"
                                                            >
                                                                <FaSyncAlt />
                                                                Reintentar
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {usuarioSeleccionado ? (
                                                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
                                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                                                        <div className="flex items-center gap-4 min-w-0">
                                                            <div className="w-16 h-16 rounded-2xl bg-white border border-blue-200 flex items-center justify-center text-blue-800 text-xl font-bold shrink-0">
                                                                {obtenerIniciales(
                                                                    nombreUsuarioSeleccionado
                                                                )}
                                                            </div>

                                                            <div className="min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <h3 className="font-bold text-slate-900 truncate">
                                                                        {nombreUsuarioSeleccionado ||
                                                                            `Usuario #${usuarioSeleccionado.idUsuario}`}
                                                                    </h3>

                                                                    <span
                                                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${usuarioActivo
                                                                                ? "bg-emerald-100 text-emerald-700"
                                                                                : "bg-amber-100 text-amber-700"
                                                                            }`}
                                                                    >
                                                                        {usuarioActivo ? (
                                                                            <FaCheckCircle />
                                                                        ) : (
                                                                            <FaUserClock />
                                                                        )}

                                                                        {usuarioActivo
                                                                            ? "Usuario activo"
                                                                            : "Usuario inactivo"}
                                                                    </span>
                                                                </div>

                                                                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
                                                                    <span className="flex items-center gap-2">
                                                                        <FaEnvelope className="text-slate-400" />

                                                                        {usuarioSeleccionado.correo ||
                                                                            "Sin correo"}
                                                                    </span>

                                                                    <span className="flex items-center gap-2">
                                                                        <FaPhoneAlt className="text-slate-400" />

                                                                        {usuarioSeleccionado.telefono ||
                                                                            "Sin teléfono"}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={abrirModalUsuarios}
                                                            disabled={
                                                                cargandoUsuarios
                                                            }
                                                            className="h-10 px-4 rounded-xl border border-blue-300 bg-white text-blue-800 font-semibold flex items-center justify-center gap-2 hover:bg-blue-100 disabled:opacity-60 transition"
                                                        >
                                                            {cargandoUsuarios ? (
                                                                <FaSyncAlt className="animate-spin" />
                                                            ) : (
                                                                <FaUserEdit />
                                                            )}

                                                            Cambiar usuario
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6">
                                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center">
                                                                <FaUsers className="text-xl text-slate-500" />
                                                            </div>

                                                            <div>
                                                                <h3 className="font-bold text-slate-800">
                                                                    Usuario no encontrado
                                                                </h3>

                                                                <p className="mt-1 text-sm text-slate-500">
                                                                    Selecciona un usuario válido para continuar.
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={abrirModalUsuarios}
                                                            className="h-11 px-5 rounded-xl bg-blue-800 text-white font-semibold flex items-center justify-center gap-2 hover:bg-blue-900 transition"
                                                        >
                                                            <FaUsers />
                                                            Seleccionar usuario
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </section>

                                    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center">
                                                    <FaIdBadge className="text-slate-700" />
                                                </div>

                                                <div>
                                                    <h2 className="font-bold text-slate-900">
                                                        Información del operador
                                                    </h2>

                                                    <p className="text-sm text-slate-500">
                                                        Actualiza su identificación y función dentro del inventario.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-5 md:p-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                <div>
                                                    <label
                                                        htmlFor="codigo"
                                                        className="block text-sm font-semibold text-slate-700 mb-2"
                                                    >
                                                        Código
                                                    </label>

                                                    <input
                                                        id="codigo"
                                                        name="codigo"
                                                        type="text"
                                                        value={
                                                            formulario.codigo
                                                        }
                                                        onChange={cambiarCampo}
                                                        maxLength={50}
                                                        className="w-full h-11 px-4 rounded-xl border border-slate-300 bg-white text-slate-800 uppercase outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                                    />
                                                </div>

                                                <div>
                                                    <label
                                                        htmlFor="cargo"
                                                        className="block text-sm font-semibold text-slate-700 mb-2"
                                                    >
                                                        Cargo o función{" "}
                                                        <span className="text-rose-600">
                                                            *
                                                        </span>
                                                    </label>

                                                    <input
                                                        id="cargo"
                                                        name="cargo"
                                                        type="text"
                                                        value={
                                                            formulario.cargo
                                                        }
                                                        onChange={cambiarCampo}
                                                        maxLength={80}
                                                        placeholder="Ej. BODEGUERO"
                                                        className="w-full h-11 px-4 rounded-xl border border-slate-300 bg-white text-slate-800 uppercase outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                                    />
                                                </div>

                                                <div>
                                                    <label
                                                        htmlFor="tipoDocumento"
                                                        className="block text-sm font-semibold text-slate-700 mb-2"
                                                    >
                                                        Tipo de documento{" "}
                                                        <span className="text-rose-600">
                                                            *
                                                        </span>
                                                    </label>

                                                    <select
                                                        id="tipoDocumento"
                                                        name="tipoDocumento"
                                                        value={
                                                            formulario.tipoDocumento
                                                        }
                                                        onChange={cambiarCampo}
                                                        className="w-full h-11 px-4 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                                    >
                                                        <option value="CC">
                                                            Cédula de ciudadanía
                                                        </option>

                                                        <option value="CE">
                                                            Cédula de extranjería
                                                        </option>

                                                        <option value="TI">
                                                            Tarjeta de identidad
                                                        </option>

                                                        <option value="NIT">
                                                            NIT
                                                        </option>

                                                        <option value="PASAPORTE">
                                                            Pasaporte
                                                        </option>
                                                    </select>
                                                </div>

                                                <div>
                                                    <label
                                                        htmlFor="documento"
                                                        className="block text-sm font-semibold text-slate-700 mb-2"
                                                    >
                                                        Número de documento{" "}
                                                        <span className="text-rose-600">
                                                            *
                                                        </span>
                                                    </label>

                                                    <div className="relative">
                                                        <FaIdCard className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                                                        <input
                                                            id="documento"
                                                            name="documento"
                                                            type="text"
                                                            value={
                                                                formulario.documento
                                                            }
                                                            onChange={cambiarCampo}
                                                            maxLength={50}
                                                            className="w-full h-11 pl-11 pr-4 rounded-xl border border-slate-300 bg-white text-slate-800 uppercase outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <label
                                                        htmlFor="estado"
                                                        className="block text-sm font-semibold text-slate-700 mb-2"
                                                    >
                                                        Estado del operador
                                                    </label>

                                                    <select
                                                        id="estado"
                                                        name="estado"
                                                        value={
                                                            formulario.estado
                                                        }
                                                        onChange={cambiarCampo}
                                                        className="w-full h-11 px-4 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                                    >
                                                        <option value="1">
                                                            Activo
                                                        </option>

                                                        <option value="0">
                                                            Inactivo
                                                        </option>
                                                    </select>
                                                </div>

                                                <div className="md:col-span-2">
                                                    <label
                                                        htmlFor="observacion"
                                                        className="block text-sm font-semibold text-slate-700 mb-2"
                                                    >
                                                        Observación
                                                    </label>

                                                    <textarea
                                                        id="observacion"
                                                        name="observacion"
                                                        value={
                                                            formulario.observacion
                                                        }
                                                        onChange={cambiarCampo}
                                                        rows={4}
                                                        maxLength={500}
                                                        placeholder="Información adicional sobre el operador..."
                                                        className="w-full px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-800 resize-none outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                                    />

                                                    <div className="mt-2 flex justify-end">
                                                        <span className="text-xs text-slate-400">
                                                            {
                                                                formulario
                                                                    .observacion
                                                                    .length
                                                            }
                                                            /500
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={volver}
                                            disabled={guardando}
                                            className="h-11 px-5 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-50 disabled:opacity-60 transition"
                                        >
                                            Cancelar
                                        </button>

                                        <button
                                            type="submit"
                                            disabled={
                                                guardando ||
                                                !formulario.idUsuario
                                            }
                                            className="h-11 px-6 rounded-xl bg-blue-800 text-white font-semibold flex items-center justify-center gap-2 hover:bg-blue-900 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-sm"
                                        >
                                            {guardando ? (
                                                <>
                                                    <FaSyncAlt className="animate-spin" />
                                                    Actualizando...
                                                </>
                                            ) : (
                                                <>
                                                    <FaSave />
                                                    Guardar cambios
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <aside className="xl:sticky xl:top-0 space-y-5">
                                    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                                        <div className="px-5 py-4 bg-blue-800">
                                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-100">
                                                Resumen
                                            </p>

                                            <h2 className="mt-1 text-lg font-bold text-white">
                                                Operador seleccionado
                                            </h2>
                                        </div>

                                        <div className="p-5">
                                            <div className="flex flex-col items-center text-center">
                                                <div className="w-20 h-20 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-2xl font-bold text-blue-800">
                                                    {usuarioSeleccionado ? (
                                                        obtenerIniciales(
                                                            nombreUsuarioSeleccionado
                                                        )
                                                    ) : (
                                                        <FaUsersCog />
                                                    )}
                                                </div>

                                                <h3 className="mt-4 font-bold text-slate-900">
                                                    {nombreUsuarioSeleccionado ||
                                                        "Usuario sin seleccionar"}
                                                </h3>

                                                <p className="mt-1 text-sm text-slate-500 break-all">
                                                    {usuarioSeleccionado?.correo ||
                                                        "Sin correo registrado"}
                                                </p>
                                            </div>

                                            <div className="mt-6 space-y-4">
                                                <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                                                    <span className="text-sm text-slate-500">
                                                        Código
                                                    </span>

                                                    <span className="text-sm font-semibold text-slate-800 text-right">
                                                        {formulario.codigo ||
                                                            "Sin código"}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                                                    <span className="text-sm text-slate-500">
                                                        Documento
                                                    </span>

                                                    <span className="text-sm font-semibold text-slate-800 text-right">
                                                        {formulario.documento
                                                            ? `${formulario.tipoDocumento} ${formulario.documento}`
                                                            : "Sin registrar"}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                                                    <span className="text-sm text-slate-500">
                                                        Cargo
                                                    </span>

                                                    <span className="text-sm font-semibold text-slate-800 text-right">
                                                        {formulario.cargo ||
                                                            "Sin definir"}
                                                    </span>
                                                </div>

                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="text-sm text-slate-500">
                                                        Estado
                                                    </span>

                                                    <span
                                                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${Number(
                                                            formulario.estado
                                                        ) === 1
                                                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                                : "bg-slate-100 text-slate-600 border border-slate-200"
                                                            }`}
                                                    >
                                                        <FaCheckCircle />

                                                        {Number(
                                                            formulario.estado
                                                        ) === 1
                                                            ? "Activo"
                                                            : "Inactivo"}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                </aside>
                            </div>
                        </form>
                    </div>
                </article>
            </div>

            {modalUsuarios && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6">
                    <button
                        type="button"
                        aria-label="Cerrar modal"
                        onClick={cerrarModalUsuarios}
                        className="absolute inset-0 bg-slate-950/60"
                    />

                    <section className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
                        <header className="px-5 py-5 md:px-6 border-b border-slate-200 bg-white">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                                        <FaUsers className="text-lg text-blue-800" />
                                    </div>

                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">
                                            Usuarios del sistema
                                        </p>

                                        <h2 className="mt-1 text-xl font-bold text-slate-900">
                                            Cambiar usuario
                                        </h2>

                                        <p className="mt-1 text-sm text-slate-500">
                                            Selecciona el usuario que quedará vinculado al operador.
                                        </p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={cerrarModalUsuarios}
                                    className="w-10 h-10 rounded-xl border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 transition"
                                >
                                    <FaTimes />
                                </button>
                            </div>
                        </header>

                        <div className="px-5 py-4 md:px-6 border-b border-slate-200 bg-slate-50">
                            <div className="flex flex-col md:flex-row md:items-end gap-3">
                                <div className="flex-1">
                                    <label
                                        htmlFor="buscarUsuarioModalEditar"
                                        className="block text-sm font-semibold text-slate-700 mb-2"
                                    >
                                        Buscar usuario
                                    </label>

                                    <div className="relative">
                                        <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                                        <input
                                            id="buscarUsuarioModalEditar"
                                            type="text"
                                            value={busquedaUsuario}
                                            onChange={(event) =>
                                                setBusquedaUsuario(
                                                    event.target.value
                                                )
                                            }
                                            autoFocus
                                            placeholder="Nombre, correo, teléfono o documento..."
                                            className="w-full h-11 pl-11 pr-4 rounded-xl border border-slate-300 bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-700 transition"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        cargarUsuarios(
                                            Number(
                                                formulario.idUsuario ||
                                                0
                                            )
                                        )
                                    }
                                    disabled={cargandoUsuarios}
                                    className="h-11 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold flex items-center justify-center gap-2 hover:bg-slate-100 disabled:opacity-60 transition"
                                >
                                    <FaSyncAlt
                                        className={
                                            cargandoUsuarios
                                                ? "animate-spin"
                                                : ""
                                        }
                                    />

                                    Actualizar
                                </button>
                            </div>

                            <p className="mt-3 text-sm text-slate-500">
                                {usuariosFiltrados.length} usuario
                                {usuariosFiltrados.length === 1
                                    ? ""
                                    : "s"}{" "}
                                disponible
                                {usuariosFiltrados.length === 1
                                    ? ""
                                    : "s"}
                            </p>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 md:p-6">
                            {cargandoUsuarios ? (
                                <div className="min-h-[320px] flex flex-col items-center justify-center gap-4">
                                    <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />

                                    <p className="text-sm font-medium text-slate-500">
                                        Cargando usuarios...
                                    </p>
                                </div>
                            ) : usuariosFiltrados.length === 0 ? (
                                <div className="min-h-[320px] flex flex-col items-center justify-center text-center">
                                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                                        <FaUsers className="text-2xl text-slate-500" />
                                    </div>

                                    <h3 className="mt-4 text-lg font-bold text-slate-800">
                                        No hay usuarios disponibles
                                    </h3>

                                    <p className="mt-1 text-sm text-slate-500 max-w-md">
                                        No hay usuarios activos disponibles o la búsqueda no coincide.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {usuariosFiltrados.map(
                                        (usuario) => {
                                            const nombre =
                                                usuario?.nombreCompleto ||
                                                usuario?.nombre ||
                                                `Usuario #${usuario.idUsuario}`;

                                            const seleccionado =
                                                Number(
                                                    formulario.idUsuario ||
                                                    0
                                                ) ===
                                                Number(
                                                    usuario?.idUsuario ||
                                                    0
                                                );

                                            return (
                                                <button
                                                    key={
                                                        usuario.idUsuario
                                                    }
                                                    type="button"
                                                    onClick={() =>
                                                        seleccionarUsuario(
                                                            usuario
                                                        )
                                                    }
                                                    className={`w-full text-left rounded-2xl border p-4 transition ${seleccionado
                                                            ? "border-blue-700 bg-blue-50 ring-2 ring-blue-100"
                                                            : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/40"
                                                        }`}
                                                >
                                                    <div className="flex items-start gap-4">
                                                        <div
                                                            className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold shrink-0 ${seleccionado
                                                                    ? "bg-blue-800 text-white"
                                                                    : "bg-slate-100 text-slate-700"
                                                                }`}
                                                        >
                                                            {obtenerIniciales(
                                                                nombre
                                                            )}
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="min-w-0">
                                                                    <h3 className="font-bold text-slate-900 truncate">
                                                                        {nombre}
                                                                    </h3>

                                                                    <p className="mt-0.5 text-xs text-slate-500">
                                                                        ID usuario:{" "}
                                                                        {
                                                                            usuario.idUsuario
                                                                        }
                                                                    </p>
                                                                </div>

                                                                {seleccionado && (
                                                                    <FaCheckCircle className="text-blue-700 shrink-0" />
                                                                )}
                                                            </div>

                                                            <div className="mt-3 space-y-2">
                                                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                                                    <FaEnvelope className="text-slate-400" />

                                                                    <span className="truncate">
                                                                        {usuario?.correo ||
                                                                            "Sin correo registrado"}
                                                                    </span>
                                                                </div>

                                                                <div className="flex items-center gap-2 text-sm text-slate-600">
                                                                    <FaPhoneAlt className="text-slate-400" />

                                                                    <span>
                                                                        {usuario?.telefono ||
                                                                            "Sin teléfono registrado"}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div className="mt-4 flex items-center justify-between gap-3">
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                                                                    <FaCheckCircle />
                                                                    Usuario activo
                                                                </span>

                                                                <span className="text-xs font-bold text-blue-800">
                                                                    {seleccionado
                                                                        ? "Seleccionado"
                                                                        : "Seleccionar"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        }
                                    )}
                                </div>
                            )}
                        </div>

                        <footer className="px-5 py-4 md:px-6 border-t border-slate-200 bg-slate-50 flex justify-end">
                            <button
                                type="button"
                                onClick={cerrarModalUsuarios}
                                className="h-10 px-5 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-100 transition"
                            >
                                Cerrar
                            </button>
                        </footer>
                    </section>
                </div>
            )}
        </>
    );


};
