import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    FaArrowLeft,
    FaBarcode,
    FaBoxOpen,
    FaCheck,
    FaCheckCircle,
    FaClock,
    FaExclamationTriangle,
    FaEye,
    FaFilter,
    FaPaperPlane,
    FaPlay,
    FaSave,
    FaSearch,
    FaSyncAlt,
    FaTimes,
    FaWarehouse,
} from "react-icons/fa";

import { IoMenu } from "react-icons/io5";
import { toast } from "react-toastify";

import {
    API_BASE_CONTEOS,
    claseEstado,
    formatearFechaHora,
    formatearNumero,
    leerRespuesta,
    obtenerIdUsuario,
    respuestaExitosa,
    textoEstado,
} from "./conteosFisicosHelpers";

const obtenerModo = () =>
    localStorage.getItem("inventarioConteoModo") ===
    "ADMIN"
        ? "ADMIN"
        : "OPERATIVO";

const numeroValido = (valor) => {
    if (
        valor === "" ||
        valor === null ||
        valor === undefined
    ) {
        return null;
    }

    const numero = Number(valor);

    return Number.isFinite(numero) && numero >= 0
        ? numero
        : null;
};

export default function ConteoBodegaInventario({
    setSidebar,
    navegar,
}) {
    const modo = useMemo(obtenerModo, []);

    const idSolicitudConteo = useMemo(
        () =>
            Number(
                localStorage.getItem(
                    "inventarioSolicitudConteoId"
                ) || 0
            ),
        []
    );

    const [conteo, setConteo] = useState(null);
    const [resumen, setResumen] = useState({});
    const [detalles, setDetalles] = useState([]);
    const [ubicaciones, setUbicaciones] =
        useState([]);
    const [responsables, setResponsables] =
        useState([]);

    const [busqueda, setBusqueda] = useState("");
    const [soloPendientes, setSoloPendientes] =
        useState(false);
    const [idUbicacion, setIdUbicacion] =
        useState("");

    const [cantidades, setCantidades] = useState(
        {}
    );
    const [observaciones, setObservaciones] =
        useState({});
    const [modificados, setModificados] = useState(
        new Set()
    );

    const [cargando, setCargando] = useState(true);
    const [procesando, setProcesando] =
        useState(false);
    const [modalEnvio, setModalEnvio] =
        useState(false);
    const [observacionEnvio, setObservacionEnvio] =
        useState("");

    const buscadorRef = useRef(null);

    const modoAdministrativo = modo === "ADMIN";
    const idUsuario = obtenerIdUsuario();

    const cargarDetalle = useCallback(
        async ({ silencioso = false } = {}) => {
            if (!idSolicitudConteo) {
                toast.error(
                    "No fue posible identificar el conteo de la bodega."
                );

                navegar(
                    "DetalleConteoFisicoInventario"
                );
                return;
            }

            if (!idUsuario) {
                toast.error(
                    "No fue posible identificar el usuario."
                );
                return;
            }

            if (!silencioso) {
                setCargando(true);
            }

            try {
                const params = new URLSearchParams({
                    idSolicitudConteo,
                    idUsuario,
                    limite: 500,
                    pagina: 1,
                    t: Date.now(),
                });

                if (busqueda.trim()) {
                    params.set(
                        "q",
                        busqueda.trim()
                    );
                }

                if (soloPendientes) {
                    params.set(
                        "soloPendientes",
                        "1"
                    );
                }

                if (idUbicacion) {
                    params.set(
                        "idUbicacion",
                        idUbicacion
                    );
                }

                if (modoAdministrativo) {
                    params.set(
                        "modoAdministrativo",
                        "1"
                    );
                }

                const respuesta = await fetch(
                    `${API_BASE_CONTEOS}InventarioConteoBodegaDetalle.php?${params.toString()}`,
                    {
                        method: "GET",
                        cache: "no-store",
                        headers: {
                            Accept: "application/json",
                            "Cache-Control":
                                "no-cache",
                        },
                    }
                );

                const resultado =
                    await leerRespuesta(respuesta);

                if (
                    !respuesta.ok ||
                    !respuestaExitosa(resultado)
                ) {
                    throw new Error(
                        resultado?.error ||
                            resultado?.mensaje ||
                            "No fue posible consultar el conteo."
                    );
                }

                const data =
                    resultado?.data || {};

                const nuevosDetalles =
                    Array.isArray(data.detalles)
                        ? data.detalles
                        : [];

                setConteo(data.conteo || null);
                setResumen(data.resumen || {});
                setDetalles(nuevosDetalles);

                setUbicaciones(
                    Array.isArray(
                        data.ubicaciones
                    )
                        ? data.ubicaciones
                        : []
                );

                setResponsables(
                    Array.isArray(
                        data.responsables
                    )
                        ? data.responsables
                        : []
                );

                setCantidades((prev) => {
                    const siguiente = {
                        ...prev,
                    };

                    nuevosDetalles.forEach(
                        (detalle) => {
                            const id =
                                detalle.idDetalleConteo ||
                                detalle.id;

                            if (
                                !modificados.has(id)
                            ) {
                                siguiente[id] =
                                    detalle.conteoRealizado
                                        ? String(
                                              detalle.cantidadFisica ??
                                                  ""
                                          )
                                        : "";
                            }
                        }
                    );

                    return siguiente;
                });

                setObservaciones((prev) => {
                    const siguiente = {
                        ...prev,
                    };

                    nuevosDetalles.forEach(
                        (detalle) => {
                            const id =
                                detalle.idDetalleConteo ||
                                detalle.id;

                            if (
                                !modificados.has(id)
                            ) {
                                siguiente[id] =
                                    detalle.observacion ||
                                    "";
                            }
                        }
                    );

                    return siguiente;
                });
            } catch (error) {
                console.error(
                    "Error consultando conteo:",
                    error
                );

                toast.error(
                    error?.message ||
                        "No fue posible consultar el conteo."
                );
            } finally {
                if (!silencioso) {
                    setCargando(false);
                }
            }
        },
        [
            busqueda,
            idSolicitudConteo,
            idUbicacion,
            idUsuario,
            modificados,
            modoAdministrativo,
            navegar,
            soloPendientes,
        ]
    );

    useEffect(() => {
        const temporizador = setTimeout(() => {
            cargarDetalle();
        }, 250);

        return () =>
            clearTimeout(temporizador);
    }, [
        busqueda,
        soloPendientes,
        idUbicacion,
    ]);

    useEffect(() => {
        cargarDetalle();
        // La primera carga se realiza una sola vez.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const regresar = () => {
        if (modoAdministrativo) {
            navegar(
                "DetalleConteoFisicoInventario"
            );
            return;
        }

        navegar(
            "ConteosAsignadosInventario"
        );
    };

    const iniciarConteo = async () => {
        if (modoAdministrativo) {
            return;
        }

        setProcesando(true);

        try {
            const respuesta = await fetch(
                `${API_BASE_CONTEOS}InventarioConteoBodegaIniciar.php`,
                {
                    method: "POST",
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                        "Content-Type":
                            "application/json",
                        "Cache-Control":
                            "no-cache",
                    },
                    body: JSON.stringify({
                        idSolicitudConteo,
                        idUsuario,
                    }),
                }
            );

            const resultado =
                await leerRespuesta(respuesta);

            if (
                !respuesta.ok ||
                !respuestaExitosa(resultado)
            ) {
                throw new Error(
                    resultado?.error ||
                        resultado?.mensaje ||
                        "No fue posible iniciar el conteo."
                );
            }

            toast.success(
                resultado?.mensaje ||
                    "Conteo iniciado correctamente."
            );

            await cargarDetalle();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setProcesando(false);
        }
    };

    const cambiarCantidad = (
        idDetalle,
        valor
    ) => {
        const limpio = valor
            .replace(",", ".")
            .replace(/[^0-9.]/g, "");

        setCantidades((prev) => ({
            ...prev,
            [idDetalle]: limpio,
        }));

        setModificados((prev) => {
            const siguiente = new Set(prev);
            siguiente.add(idDetalle);
            return siguiente;
        });
    };

    const cambiarObservacion = (
        idDetalle,
        valor
    ) => {
        setObservaciones((prev) => ({
            ...prev,
            [idDetalle]: valor,
        }));

        setModificados((prev) => {
            const siguiente = new Set(prev);
            siguiente.add(idDetalle);
            return siguiente;
        });
    };

    const guardarCambios = async (
        idsEspecificos = null
    ) => {
        if (
            modoAdministrativo ||
            !conteo?.puedeEditar
        ) {
            return;
        }

        const ids = idsEspecificos
            ? idsEspecificos
            : Array.from(modificados);

        if (ids.length === 0) {
            toast.info(
                "No hay cambios pendientes por guardar."
            );
            return;
        }

        const payloadDetalles = [];

        for (const idDetalle of ids) {
            const cantidad = numeroValido(
                cantidades[idDetalle]
            );

            if (cantidad === null) {
                toast.info(
                    "Revisa las cantidades antes de guardar."
                );
                return;
            }

            payloadDetalles.push({
                idDetalleConteo:
                    Number(idDetalle),
                cantidadFisica: cantidad,
                observacion:
                    observaciones[idDetalle] ||
                    "",
            });
        }

        setProcesando(true);

        try {
            const respuesta = await fetch(
                `${API_BASE_CONTEOS}InventarioConteoBodegaGuardar.php`,
                {
                    method: "POST",
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                        "Content-Type":
                            "application/json",
                        "Cache-Control":
                            "no-cache",
                    },
                    body: JSON.stringify({
                        idSolicitudConteo,
                        idUsuario,
                        detalles:
                            payloadDetalles,
                    }),
                }
            );

            const resultado =
                await leerRespuesta(respuesta);

            if (
                !respuesta.ok ||
                !respuestaExitosa(resultado)
            ) {
                throw new Error(
                    resultado?.error ||
                        resultado?.mensaje ||
                        "No fue posible guardar el conteo."
                );
            }

            setModificados((prev) => {
                const siguiente = new Set(prev);

                ids.forEach((id) =>
                    siguiente.delete(id)
                );

                return siguiente;
            });

            toast.success(
                resultado?.mensaje ||
                    "Conteo guardado correctamente."
            );

            await cargarDetalle({
                silencioso: true,
            });
        } catch (error) {
            toast.error(error.message);
        } finally {
            setProcesando(false);
        }
    };

    const enviarConteo = async () => {
        if (
            modoAdministrativo ||
            !conteo?.puedeEnviar
        ) {
            return;
        }

        if (modificados.size > 0) {
            toast.info(
                "Guarda los cambios pendientes antes de enviar."
            );
            return;
        }

        setProcesando(true);

        try {
            const respuesta = await fetch(
                `${API_BASE_CONTEOS}InventarioConteoBodegaEnviar.php`,
                {
                    method: "POST",
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                        "Content-Type":
                            "application/json",
                        "Cache-Control":
                            "no-cache",
                    },
                    body: JSON.stringify({
                        idSolicitudConteo,
                        idUsuario,
                        confirmarBodegaVacia:
                            Number(
                                resumen.totalDetalles ||
                                    0
                            ) === 0,
                        observacion:
                            observacionEnvio.trim(),
                    }),
                }
            );

            const resultado =
                await leerRespuesta(respuesta);

            if (
                !respuesta.ok ||
                !respuestaExitosa(resultado)
            ) {
                throw new Error(
                    resultado?.error ||
                        resultado?.mensaje ||
                        "No fue posible enviar el conteo."
                );
            }

            toast.success(
                resultado?.mensaje ||
                    "Conteo enviado correctamente."
            );

            setModalEnvio(false);
            setObservacionEnvio("");

            await cargarDetalle();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setProcesando(false);
        }
    };

    const enfocarBuscador = () => {
        buscadorRef.current?.focus();
    };

    const porcentaje = Number(
        resumen.porcentajeAvance || 0
    );

    const puedeIniciar =
        !modoAdministrativo &&
        ["PENDIENTE", "DEVUELTO"].includes(
            conteo?.estadoProceso
        );

    const puedeGuardar =
        !modoAdministrativo &&
        conteo?.puedeEditar &&
        modificados.size > 0;

    const puedeEnviar =
        !modoAdministrativo &&
        conteo?.puedeEnviar &&
        modificados.size === 0;

    return (
        <>
            <div className="w-full h-screen flex flex-col p-2 md:p-4 gap-4 bg-slate-100">
                <article className="flex-1 bg-white shadow-lg rounded-2xl flex flex-col overflow-hidden border border-slate-200">
                    <header className="px-3 py-3 md:px-5 border-b border-slate-200 bg-white">
                        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
                            <div className="flex items-center gap-2 md:gap-3 min-w-0">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setSidebar(true)
                                    }
                                    className="lg:hidden h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center shrink-0"
                                >
                                    <IoMenu size={23} />
                                </button>

                                <button
                                    type="button"
                                    onClick={regresar}
                                    className="h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center shrink-0"
                                >
                                    <FaArrowLeft />
                                </button>

                                <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-800 border border-blue-100 flex items-center justify-center shrink-0">
                                    <FaWarehouse />
                                </div>

                                <div className="min-w-0">
                                    <p className="text-xs uppercase font-semibold tracking-wide text-slate-500">
                                        {modoAdministrativo
                                            ? "Consulta administrativa"
                                            : "Conteo operativo"}
                                    </p>

                                    <h1 className="text-lg md:text-2xl font-bold text-slate-900 truncate">
                                        {conteo?.bodega ||
                                            "Conteo por bodega"}
                                    </h1>

                                    <p className="text-xs md:text-sm text-slate-500 truncate">
                                        {conteo?.codigo ||
                                            "Consultando..."}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        cargarDetalle()
                                    }
                                    disabled={cargando}
                                    className="h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center disabled:opacity-50"
                                >
                                    <FaSyncAlt
                                        className={
                                            cargando
                                                ? "animate-spin"
                                                : ""
                                        }
                                    />
                                </button>

                                {puedeIniciar && (
                                    <button
                                        type="button"
                                        onClick={
                                            iniciarConteo
                                        }
                                        disabled={
                                            procesando
                                        }
                                        className="h-10 px-4 rounded-xl bg-blue-800 text-white font-semibold flex items-center gap-2 disabled:opacity-50"
                                    >
                                        <FaPlay />
                                        Iniciar
                                    </button>
                                )}

                                {puedeGuardar && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            guardarCambios()
                                        }
                                        disabled={
                                            procesando
                                        }
                                        className="h-10 px-4 rounded-xl bg-emerald-700 text-white font-semibold flex items-center gap-2 disabled:opacity-50"
                                    >
                                        <FaSave />
                                        Guardar{" "}
                                        {
                                            modificados.size
                                        }
                                    </button>
                                )}

                                {puedeEnviar && (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setModalEnvio(
                                                true
                                            )
                                        }
                                        disabled={
                                            procesando
                                        }
                                        className="h-10 px-4 rounded-xl bg-violet-700 text-white font-semibold flex items-center gap-2 disabled:opacity-50"
                                    >
                                        <FaPaperPlane />
                                        Enviar
                                    </button>
                                )}
                            </div>
                        </div>
                    </header>

                    <section className="px-3 py-3 md:px-5 border-b border-slate-200 bg-white">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-[11px] uppercase font-bold text-slate-500">
                                    Estado
                                </p>
                                <span
                                    className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${claseEstado(
                                        conteo?.estadoProceso
                                    )}`}
                                >
                                    {textoEstado(
                                        conteo?.estadoProceso
                                    )}
                                </span>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-[11px] uppercase font-bold text-slate-500">
                                    Productos
                                </p>
                                <p className="mt-1 text-2xl font-black text-slate-900">
                                    {formatearNumero(
                                        resumen.totalDetalles
                                    )}
                                </p>
                            </div>

                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                                <p className="text-[11px] uppercase font-bold text-emerald-700">
                                    Contados
                                </p>
                                <p className="mt-1 text-2xl font-black text-emerald-800">
                                    {formatearNumero(
                                        resumen.totalContados
                                    )}
                                </p>
                            </div>

                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                                <p className="text-[11px] uppercase font-bold text-amber-700">
                                    Pendientes
                                </p>
                                <p className="mt-1 text-2xl font-black text-amber-800">
                                    {formatearNumero(
                                        resumen.totalPendientes
                                    )}
                                </p>
                            </div>
                        </div>

                        <div className="mt-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-semibold text-slate-600">
                                    Avance general
                                </span>
                                <strong className="text-blue-800">
                                    {porcentaje.toFixed(
                                        0
                                    )}
                                    %
                                </strong>
                            </div>

                            <div className="mt-2 h-2.5 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-blue-800 transition-all"
                                    style={{
                                        width: `${Math.min(
                                            100,
                                            porcentaje
                                        )}%`,
                                    }}
                                />
                            </div>
                        </div>

                        {conteo?.observacionRevision && (
                            <div className="mt-3 flex gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-orange-800">
                                <FaExclamationTriangle className="mt-0.5 shrink-0" />
                                <p className="text-sm">
                                    <strong>
                                        Devuelto por administración:
                                    </strong>{" "}
                                    {
                                        conteo.observacionRevision
                                    }
                                </p>
                            </div>
                        )}

                        <div className="mt-3 grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2">
                            <div className="relative">
                                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                                <input
                                    ref={buscadorRef}
                                    type="search"
                                    value={busqueda}
                                    onChange={(event) =>
                                        setBusqueda(
                                            event.target
                                                .value
                                        )
                                    }
                                    placeholder="Producto, código, lote, ubicación o código de barras..."
                                    className="w-full h-11 pl-11 pr-12 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-blue-200"
                                />

                                <button
                                    type="button"
                                    onClick={
                                        enfocarBuscador
                                    }
                                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg text-slate-500 flex items-center justify-center"
                                    title="Usar lector"
                                >
                                    <FaBarcode />
                                </button>
                            </div>

                            <select
                                value={idUbicacion}
                                onChange={(event) =>
                                    setIdUbicacion(
                                        event.target
                                            .value
                                    )
                                }
                                className="h-11 px-3 rounded-xl border border-slate-200 bg-white"
                            >
                                <option value="">
                                    Todas las ubicaciones
                                </option>

                                {ubicaciones.map(
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
                                            {
                                                ubicacion.codigo
                                            }{" "}
                                            -{" "}
                                            {
                                                ubicacion.nombre
                                            }
                                        </option>
                                    )
                                )}
                            </select>

                            <button
                                type="button"
                                onClick={() =>
                                    setSoloPendientes(
                                        (prev) =>
                                            !prev
                                    )
                                }
                                className={`h-11 px-4 rounded-xl border font-semibold flex items-center justify-center gap-2 ${
                                    soloPendientes
                                        ? "bg-amber-50 border-amber-300 text-amber-800"
                                        : "bg-white border-slate-200 text-slate-700"
                                }`}
                            >
                                <FaFilter />
                                Pendientes
                            </button>
                        </div>
                    </section>

                    <section className="flex-1 overflow-auto p-3 md:p-5 bg-slate-50/60">
                        {cargando ? (
                            <div className="min-h-64 flex flex-col items-center justify-center text-slate-500">
                                <FaSyncAlt className="animate-spin text-3xl mb-3" />
                                Consultando productos...
                            </div>
                        ) : detalles.length === 0 ? (
                            <div className="min-h-64 flex flex-col items-center justify-center text-center text-slate-500">
                                <div className="h-16 w-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center">
                                    <FaBoxOpen size={28} />
                                </div>

                                <h2 className="mt-4 text-lg font-bold text-slate-800">
                                    No hay productos para mostrar
                                </h2>

                                <p className="mt-1 text-sm max-w-md">
                                    Revisa los filtros aplicados o confirma que la bodega esté físicamente vacía.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 md:gap-4">
                                {detalles.map(
                                    (detalle) => {
                                        const id =
                                            detalle.idDetalleConteo ||
                                            detalle.id;

                                        const modificado =
                                            modificados.has(
                                                id
                                            );

                                        return (
                                            <article
                                                key={
                                                    id
                                                }
                                                className={`rounded-2xl border bg-white p-4 md:p-5 shadow-sm ${
                                                    modificado
                                                        ? "border-blue-300 ring-2 ring-blue-100"
                                                        : detalle.conteoRealizado
                                                          ? "border-emerald-200"
                                                          : "border-slate-200"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="font-mono text-xs font-bold text-blue-800 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">
                                                                {
                                                                    detalle.codigoProducto
                                                                }
                                                            </span>

                                                            {detalle.conteoRealizado ? (
                                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                                                                    <FaCheck />
                                                                    Contado
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                                                                    <FaClock />
                                                                    Pendiente
                                                                </span>
                                                            )}
                                                        </div>

                                                        <h3 className="mt-3 text-base md:text-lg font-bold text-slate-900">
                                                            {
                                                                detalle.producto
                                                            }
                                                        </h3>

                                                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                                            <p className="text-slate-500">
                                                                <strong className="text-slate-700">
                                                                    Ubicación:
                                                                </strong>{" "}
                                                                {detalle.ubicacion ||
                                                                    "Sin ubicación"}
                                                            </p>

                                                            <p className="text-slate-500">
                                                                <strong className="text-slate-700">
                                                                    Lote:
                                                                </strong>{" "}
                                                                {detalle.lote ||
                                                                    "No aplica"}
                                                            </p>

                                                            {detalle.fechaVencimiento && (
                                                                <p className="text-slate-500">
                                                                    <strong className="text-slate-700">
                                                                        Vence:
                                                                    </strong>{" "}
                                                                    {
                                                                        detalle.fechaVencimiento
                                                                    }
                                                                </p>
                                                            )}

                                                            <p className="text-slate-500">
                                                                <strong className="text-slate-700">
                                                                    Unidad:
                                                                </strong>{" "}
                                                                {
                                                                    detalle.unidad
                                                                }
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {detalle.codigoBarras && (
                                                        <span
                                                            title={
                                                                detalle.codigoBarras
                                                            }
                                                            className="h-10 w-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0"
                                                        >
                                                            <FaBarcode />
                                                        </span>
                                                    )}
                                                </div>

                                                {detalle.cantidadSistema !==
                                                    null && (
                                                    <div className="mt-4 grid grid-cols-2 gap-2">
                                                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                                            <p className="text-xs uppercase font-bold text-slate-500">
                                                                Sistema
                                                            </p>
                                                            <p className="mt-1 text-xl font-black text-slate-900">
                                                                {formatearNumero(
                                                                    detalle.cantidadSistema
                                                                )}
                                                            </p>
                                                        </div>

                                                        {detalle.diferencia !==
                                                            null && (
                                                            <div className="rounded-xl bg-violet-50 border border-violet-200 p-3">
                                                                <p className="text-xs uppercase font-bold text-violet-700">
                                                                    Diferencia
                                                                </p>
                                                                <p className="mt-1 text-xl font-black text-violet-800">
                                                                    {formatearNumero(
                                                                        detalle.diferencia
                                                                    )}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
                                                    <label className="space-y-1.5">
                                                        <span className="text-sm font-bold text-slate-700">
                                                            Cantidad física
                                                        </span>

                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={
                                                                cantidades[
                                                                    id
                                                                ] ??
                                                                ""
                                                            }
                                                            disabled={
                                                                !conteo?.puedeEditar ||
                                                                modoAdministrativo
                                                            }
                                                            onChange={(
                                                                event
                                                            ) =>
                                                                cambiarCantidad(
                                                                    id,
                                                                    event
                                                                        .target
                                                                        .value
                                                                )
                                                            }
                                                            placeholder="0"
                                                            className="w-full h-12 px-4 rounded-xl border border-slate-300 text-xl font-black text-center outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100 disabled:text-slate-500"
                                                        />
                                                    </label>

                                                    <label className="space-y-1.5">
                                                        <span className="text-sm font-bold text-slate-700">
                                                            Observación
                                                        </span>

                                                        <input
                                                            type="text"
                                                            value={
                                                                observaciones[
                                                                    id
                                                                ] ??
                                                                ""
                                                            }
                                                            disabled={
                                                                !conteo?.puedeEditar ||
                                                                modoAdministrativo
                                                            }
                                                            onChange={(
                                                                event
                                                            ) =>
                                                                cambiarObservacion(
                                                                    id,
                                                                    event
                                                                        .target
                                                                        .value
                                                                )
                                                            }
                                                            placeholder="Opcional"
                                                            className="w-full h-12 px-4 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-100"
                                                        />
                                                    </label>
                                                </div>

                                                {conteo?.puedeEditar &&
                                                    !modoAdministrativo && (
                                                        <div className="mt-3 flex justify-end">
                                                            <button
                                                                type="button"
                                                                disabled={
                                                                    procesando ||
                                                                    !modificado
                                                                }
                                                                onClick={() =>
                                                                    guardarCambios(
                                                                        [
                                                                            id,
                                                                        ]
                                                                    )
                                                                }
                                                                className="h-10 px-4 rounded-xl bg-slate-900 text-white font-semibold flex items-center gap-2 disabled:opacity-40"
                                                            >
                                                                <FaSave />
                                                                Guardar producto
                                                            </button>
                                                        </div>
                                                    )}

                                                {detalle.observacionAnalisis && (
                                                    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-800">
                                                        <strong>
                                                            Análisis administrativo:
                                                        </strong>{" "}
                                                        {
                                                            detalle.observacionAnalisis
                                                        }
                                                    </div>
                                                )}
                                            </article>
                                        );
                                    }
                                )}
                            </div>
                        )}
                    </section>

                    {!modoAdministrativo &&
                        conteo?.puedeEditar && (
                            <footer className="md:hidden px-3 py-3 border-t border-slate-200 bg-white">
                                <button
                                    type="button"
                                    onClick={() =>
                                        guardarCambios()
                                    }
                                    disabled={
                                        !puedeGuardar ||
                                        procesando
                                    }
                                    className="w-full h-12 rounded-xl bg-emerald-700 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                                >
                                    <FaSave />
                                    Guardar cambios (
                                    {modificados.size})
                                </button>
                            </footer>
                        )}
                </article>
            </div>

            {modalEnvio && (
                <div className="fixed inset-0 z-50 bg-slate-950/50 p-4 flex items-center justify-center">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">
                                    Enviar conteo
                                </h2>

                                <p className="text-sm text-slate-500">
                                    Se enviará para revisión administrativa
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    !procesando &&
                                    setModalEnvio(
                                        false
                                    )
                                }
                                className="h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center"
                            >
                                <FaTimes />
                            </button>
                        </header>

                        <div className="p-5 space-y-4">
                            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800 flex gap-3">
                                <FaExclamationTriangle className="mt-0.5 shrink-0" />

                                <p className="text-sm">
                                    Después de enviar no podrás modificar el conteo, salvo que administración lo devuelva para corrección.
                                </p>
                            </div>

                            <label className="space-y-1.5 block">
                                <span className="text-sm font-bold text-slate-700">
                                    Observación de envío
                                </span>

                                <textarea
                                    rows={3}
                                    value={
                                        observacionEnvio
                                    }
                                    onChange={(event) =>
                                        setObservacionEnvio(
                                            event.target
                                                .value
                                        )
                                    }
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 resize-none"
                                    placeholder="Opcional"
                                />
                            </label>
                        </div>

                        <footer className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-2">
                            <button
                                type="button"
                                disabled={procesando}
                                onClick={() =>
                                    setModalEnvio(
                                        false
                                    )
                                }
                                className="h-10 px-4 rounded-xl border border-slate-200 bg-white font-semibold"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                disabled={procesando}
                                onClick={enviarConteo}
                                className="h-10 px-4 rounded-xl bg-violet-700 text-white font-semibold flex items-center gap-2 disabled:opacity-50"
                            >
                                {procesando ? (
                                    <FaSyncAlt className="animate-spin" />
                                ) : (
                                    <FaPaperPlane />
                                )}
                                Confirmar envío
                            </button>
                        </footer>
                    </div>
                </div>
            )}
        </>
    );
}
