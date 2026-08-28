import React, { useEffect, useMemo, useState } from "react";
import {
    FaBoxOpen,
    FaCircleCheck,
    FaClock,
    FaFloppyDisk,
    FaMagnifyingGlass,
    FaPlay,
    FaTriangleExclamation,
    FaWarehouse,
} from "react-icons/fa6";
import { toast } from "react-toastify";
import {
    ENDPOINTS_ORDENES_ALISTAMIENTO,
    formatearFechaHora,
    formatearNumero,
    obtenerCantidadSolicitada,
    obtenerCodigoOrden,
    obtenerCodigoProducto,
    obtenerEstadoOrden,
    obtenerIdDetalleOrden,
    obtenerIdUsuario,
    obtenerNombreProducto,
    obtenerOrdenSeleccionada,
    solicitarOrdenesJson,
} from "./ordenesAlistamientoHelpers";
import {
    EstadoCargaOrdenes,
    EstadoOrdenBadge,
    ModalConfirmacionOrden,
    PaginaOrdenesAlistamiento,
    TarjetasResumenOrdenes,
} from "./OrdenesAlistamientoUI";

const obtenerReservas = (detalle) =>
    Array.isArray(detalle?.reservas) ? detalle.reservas : [];

const obtenerIdReserva = (reserva) =>
    Number(reserva?.idReserva || reserva?.id || 0);

const valorNumero = (valor) => {
    const numero = Number(String(valor ?? "0").replace(",", "."));
    return Number.isFinite(numero) ? numero : 0;
};

const obtenerCantidadReservada = (reserva) =>
    Number(
        reserva?.capacidadAlistamiento ??
        reserva?.cantidadReservada ??
        reserva?.cantidadAsignada ??
        reserva?.cantidadSolicitada ??
        0
    );

const obtenerCantidadAlistadaReserva = (reserva) =>
    Number(
        reserva?.cantidadAlistada ??
        reserva?.cantidadPreparada ??
        0
    );

const construirValoresReserva = (detalles = []) => {
    const valores = {};

    detalles.forEach((detalle) => {
        obtenerReservas(detalle).forEach((reserva) => {
            const idReserva = obtenerIdReserva(reserva);
            if (!idReserva) return;

            valores[idReserva] = {
                cantidadAlistada: String(
                    obtenerCantidadAlistadaReserva(reserva)
                ),
                observacion: String(reserva?.observacion || ""),
            };
        });
    });

    return valores;
};

export default function AlistarOrdenInventario({
    setSidebar,
    navegar,
}) {
    const [orden, setOrden] = useState(null);
    const [detalles, setDetalles] = useState([]);
    const [valoresReserva, setValoresReserva] = useState({});
    const [busqueda, setBusqueda] = useState("");
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [errorOperacion, setErrorOperacion] = useState("");
    const [iniciando, setIniciando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [finalizando, setFinalizando] = useState(false);
    const [confirmarFinalizacion, setConfirmarFinalizacion] =
        useState(false);
    const [cambiosPendientes, setCambiosPendientes] = useState(false);
    const [version, setVersion] = useState(0);

    const idOrden = useMemo(() => obtenerOrdenSeleccionada(), []);
    const idUsuario = useMemo(() => obtenerIdUsuario(), []);

    useEffect(() => {
        const controlador = new AbortController();

        const cargarDetalle = async () => {
            if (!idOrden || !idUsuario) {
                setError(
                    !idOrden
                        ? "No se encontró la orden seleccionada."
                        : "No fue posible identificar el usuario de la sesión."
                );
                setCargando(false);
                return;
            }

            setCargando(true);
            setError("");

            try {
                const resultado = await solicitarOrdenesJson(
                    ENDPOINTS_ORDENES_ALISTAMIENTO.detalle,
                    {
                        params: {
                            idOrdenAlistamiento: idOrden,
                            idOrden,
                            idUsuario,
                            t: Date.now(),
                        },
                        signal: controlador.signal,
                    }
                );

                const data = resultado?.data || {};
                const ordenData = data?.orden || data?.cabecera || data;
                const detallesData = Array.isArray(data?.detalles)
                    ? data.detalles
                    : Array.isArray(ordenData?.detalles)
                      ? ordenData.detalles
                      : [];

                setOrden(ordenData || null);
                setDetalles(detallesData);
                setValoresReserva(
                    construirValoresReserva(detallesData)
                );
                setCambiosPendientes(false);
                setErrorOperacion("");
            } catch (errorConsulta) {
                if (errorConsulta?.name === "AbortError") return;

                console.error(
                    "Error consultando orden operativa:",
                    errorConsulta
                );
                setError(
                    errorConsulta?.message ||
                    "No fue posible consultar la orden asignada."
                );
            } finally {
                if (!controlador.signal.aborted) setCargando(false);
            }
        };

        cargarDetalle();
        return () => controlador.abort();
    }, [idOrden, idUsuario, version]);

    const capacidades = orden?.capacidades || {};
    const estado = obtenerEstadoOrden(orden);
    const puedeIniciar = Boolean(
        capacidades?.puedeIniciar ??
        orden?.puedeIniciar ??
        ["ASIGNADA", "ENVIADA_LOGISTICA"].includes(estado)
    );
    const puedeGuardar = Boolean(
        capacidades?.puedeGuardarAvance ??
        orden?.puedeGuardarAvance ??
        orden?.puedeGuardar ??
        estado === "EN_ALISTAMIENTO"
    );
    const puedeFinalizar = Boolean(
        capacidades?.puedeFinalizar ??
        orden?.puedeFinalizar ??
        estado === "EN_ALISTAMIENTO"
    );
    const soloLectura = !puedeGuardar;

    const detallesFiltrados = useMemo(() => {
        const termino = busqueda.trim().toLocaleLowerCase("es");
        if (!termino) return detalles;

        return detalles.filter((detalle) => {
            const reservas = obtenerReservas(detalle);
            const textos = [
                obtenerCodigoProducto(detalle),
                obtenerNombreProducto(detalle),
                detalle?.unidad,
                detalle?.unidadCobertura,
                ...reservas.flatMap((reserva) => [
                    reserva?.bodega,
                    reserva?.ubicacion,
                    reserva?.lote,
                ]),
            ];

            return textos.some((texto) =>
                String(texto || "")
                    .toLocaleLowerCase("es")
                    .includes(termino)
            );
        });
    }, [busqueda, detalles]);

    const cantidadAlistadaProducto = (detalle) =>
        obtenerReservas(detalle).reduce((total, reserva) => {
            const idReserva = obtenerIdReserva(reserva);
            return (
                total +
                valorNumero(
                    valoresReserva?.[idReserva]?.cantidadAlistada ??
                        obtenerCantidadAlistadaReserva(reserva)
                )
            );
        }, 0);

    const totalSolicitado = detalles.reduce(
        (total, detalle) =>
            total + obtenerCantidadSolicitada(detalle),
        0
    );
    const totalAlistado = detalles.reduce(
        (total, detalle) =>
            total + cantidadAlistadaProducto(detalle),
        0
    );
    const totalExcedente = detalles.reduce((total, detalle) => {
        const diferencia =
            cantidadAlistadaProducto(detalle) -
            obtenerCantidadSolicitada(detalle);
        return total + Math.max(diferencia, 0);
    }, 0);
    const productosCompletos = detalles.filter(
        (detalle) =>
            cantidadAlistadaProducto(detalle) >=
            obtenerCantidadSolicitada(detalle)
    ).length;

    const cambiarReserva = (idReserva, campo, valor) => {
        if (soloLectura) return;

        setValoresReserva((actual) => ({
            ...actual,
            [idReserva]: {
                ...(actual[idReserva] || {}),
                [campo]: valor,
            },
        }));
        setCambiosPendientes(true);
        setErrorOperacion("");
    };

    const construirReservasPayload = () => {
        const reservas = [];

        detalles.forEach((detalle) => {
            obtenerReservas(detalle).forEach((reserva) => {
                const idReserva = obtenerIdReserva(reserva);
                if (!idReserva) return;

                const cantidadAlistada = valorNumero(
                    valoresReserva?.[idReserva]?.cantidadAlistada
                );
                const observacion = String(
                    valoresReserva?.[idReserva]?.observacion || ""
                ).trim();

                reservas.push({
                    idReserva,
                    cantidadAlistada,
                    observacion,
                });
            });
        });

        return reservas;
    };

    const validarReservas = () => {
        const reservas = construirReservasPayload();
        if (!reservas.length) {
            toast.warning(
                "La orden no tiene reservas físicas disponibles para registrar."
            );
            return null;
        }

        const invalida = reservas.find(
            (reserva) =>
                !Number.isFinite(reserva.cantidadAlistada) ||
                reserva.cantidadAlistada < 0
        );

        if (invalida) {
            toast.warning(
                "Las cantidades alistadas deben ser números iguales o mayores a cero."
            );
            return null;
        }

        return reservas;
    };

    const iniciarOrden = async () => {
        if (!puedeIniciar || iniciando) return;
        setIniciando(true);
        setErrorOperacion("");

        try {
            const resultado = await solicitarOrdenesJson(
                ENDPOINTS_ORDENES_ALISTAMIENTO.iniciar,
                {
                    method: "POST",
                    body: {
                        idOrdenAlistamiento: idOrden,
                        idOrden,
                        versionRegistro:
                            orden?.versionRegistro ?? undefined,
                        idUsuario,
                    },
                }
            );

            toast.success(
                resultado?.mensaje ||
                "Alistamiento iniciado correctamente."
            );
            setVersion((valor) => valor + 1);
        } catch (errorInicio) {
            console.error("Error iniciando alistamiento:", errorInicio);
            const mensaje =
                errorInicio?.message ||
                "No fue posible iniciar el alistamiento.";
            setErrorOperacion(mensaje);
            toast.error(mensaje);
        } finally {
            setIniciando(false);
        }
    };

    const guardarAvance = async ({ mostrarToast = true } = {}) => {
        if (!puedeGuardar || guardando) return false;

        const reservas = validarReservas();
        if (!reservas) return false;

        setGuardando(true);
        setErrorOperacion("");

        try {
            const resultado = await solicitarOrdenesJson(
                ENDPOINTS_ORDENES_ALISTAMIENTO.guardarAvance,
                {
                    method: "POST",
                    body: {
                        idOrdenAlistamiento: idOrden,
                        idOrden,
                        versionRegistro:
                            orden?.versionRegistro ?? undefined,
                        idUsuario,
                        reservas,
                    },
                }
            );

            if (mostrarToast) {
                toast.success(
                    resultado?.mensaje ||
                    "Avance guardado correctamente."
                );
            }

            const dataActualizada = resultado?.data || {};
            const ordenActualizada =
                dataActualizada?.orden || dataActualizada;
            const detallesActualizados = Array.isArray(
                dataActualizada?.detalles
            )
                ? dataActualizada.detalles
                : Array.isArray(ordenActualizada?.detalles)
                  ? ordenActualizada.detalles
                  : [];
            if (ordenActualizada?.versionRegistro !== undefined) {
                setOrden((ordenActual) => ({
                    ...ordenActual,
                    ...ordenActualizada,
                }));
            }
            if (detallesActualizados.length) {
                setDetalles(detallesActualizados);
                setValoresReserva(
                    construirValoresReserva(detallesActualizados)
                );
            }

            setCambiosPendientes(false);
            return resultado;
        } catch (errorGuardado) {
            console.error("Error guardando avance:", errorGuardado);

            const mensaje =
                errorGuardado?.tipoError ===
                "stock_adicional_insuficiente"
                    ? errorGuardado.message ||
                      "No hay existencia adicional suficiente para registrar el excedente."
                    : errorGuardado?.message ||
                      "No fue posible guardar el avance.";

            setErrorOperacion(mensaje);
            toast.error(mensaje);
            return false;
        } finally {
            setGuardando(false);
        }
    };

    const finalizarOrden = async () => {
        if (!puedeFinalizar || finalizando) return;
        setFinalizando(true);
        setErrorOperacion("");

        try {
            let versionParaFinalizar = orden?.versionRegistro;

            if (cambiosPendientes) {
                const guardado = await guardarAvance({
                    mostrarToast: false,
                });
                if (!guardado) return;

                const dataGuardada = guardado?.data || {};
                const ordenGuardada =
                    dataGuardada?.orden || dataGuardada;
                versionParaFinalizar =
                    ordenGuardada?.versionRegistro ??
                    versionParaFinalizar;
            }

            const resultado = await solicitarOrdenesJson(
                ENDPOINTS_ORDENES_ALISTAMIENTO.finalizar,
                {
                    method: "POST",
                    body: {
                        idOrdenAlistamiento: idOrden,
                        idOrden,
                        versionRegistro: versionParaFinalizar,
                        idUsuario,
                    },
                }
            );

            toast.success(
                resultado?.mensaje ||
                "Alistamiento finalizado correctamente."
            );
            setConfirmarFinalizacion(false);
            setVersion((valor) => valor + 1);
        } catch (errorFinalizacion) {
            console.error(
                "Error finalizando alistamiento:",
                errorFinalizacion
            );
            const mensaje =
                errorFinalizacion?.message ||
                "No fue posible finalizar el alistamiento.";
            setErrorOperacion(mensaje);
            toast.error(mensaje);
        } finally {
            setFinalizando(false);
        }
    };

    const acciones = orden ? (
        <>
            <EstadoOrdenBadge estado={estado} />
            {puedeIniciar ? (
                <button
                    type="button"
                    onClick={iniciarOrden}
                    disabled={iniciando}
                    className="h-10 px-4 rounded-xl bg-blue-800 text-white font-bold text-sm hover:bg-blue-900 disabled:opacity-60 flex items-center gap-2"
                >
                    <FaPlay />
                    {iniciando ? "Iniciando..." : "Iniciar"}
                </button>
            ) : null}
        </>
    ) : null;

    return (
        <>
            <PaginaOrdenesAlistamiento
                setSidebar={setSidebar}
                titulo={
                    orden
                        ? obtenerCodigoOrden(orden)
                        : "Alistar orden"
                }
                descripcion="Registra el total acumulado preparado en cada reserva física. Conserva lo ya alistado y puedes superar lo solicitado si existe inventario adicional."
                onVolver={() =>
                    navegar("MisOrdenesAlistamientoInventario")
                }
                acciones={acciones}
            >
                {cargando ? (
                    <EstadoCargaOrdenes texto="Preparando la orden de alistamiento..." />
                ) : error ? (
                    <div className="min-h-56 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center flex flex-col items-center justify-center">
                        <p className="font-black text-rose-800">
                            No fue posible abrir la orden
                        </p>
                        <p className="mt-2 text-sm text-rose-700">
                            {error}
                        </p>
                        <button
                            type="button"
                            onClick={() => setVersion((valor) => valor + 1)}
                            className="mt-4 h-10 px-4 rounded-xl bg-rose-700 text-white font-bold"
                        >
                            Reintentar
                        </button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 md:gap-5 pb-24">
                        <TarjetasResumenOrdenes
                            tarjetas={[
                                {
                                    titulo: "Productos",
                                    valor: detalles.length,
                                    icono: FaBoxOpen,
                                    clase: "bg-slate-50 border-slate-200 text-slate-700",
                                },
                                {
                                    titulo: "Completos",
                                    valor: productosCompletos,
                                    icono: FaCircleCheck,
                                    clase: "bg-emerald-50 border-emerald-200 text-emerald-700",
                                },
                                {
                                    titulo: "Solicitado",
                                    valor: totalSolicitado,
                                    icono: FaClock,
                                    clase: "bg-blue-50 border-blue-200 text-blue-700",
                                },
                                {
                                    titulo: "Excedente",
                                    valor: totalExcedente,
                                    icono: FaTriangleExclamation,
                                    clase: "bg-amber-50 border-amber-200 text-amber-700",
                                },
                            ]}
                        />

                        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-3">
                                <label className="relative flex-1">
                                    <FaMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="search"
                                        value={busqueda}
                                        onChange={(event) =>
                                            setBusqueda(event.target.value)
                                        }
                                        placeholder="Buscar producto, código, bodega, ubicación o lote..."
                                        className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-300 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                                    />
                                </label>
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 h-11 flex items-center justify-between md:justify-start gap-3 text-sm">
                                    <span className="text-slate-500">Alistado</span>
                                    <strong className="text-slate-800">
                                        {formatearNumero(totalAlistado)}
                                    </strong>
                                </div>
                            </div>
                        </section>

                        {errorOperacion ? (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 flex items-start gap-3 text-sm text-rose-800">
                                <FaTriangleExclamation className="mt-0.5 shrink-0" />
                                <p>{errorOperacion}</p>
                            </div>
                        ) : null}

                        {detallesFiltrados.length === 0 ? (
                            <div className="min-h-48 rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center p-6 text-center text-sm text-slate-500">
                                No hay productos que coincidan con la búsqueda.
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {detallesFiltrados.map((detalle, detalleIndex) => {
                                    const solicitado = obtenerCantidadSolicitada(detalle);
                                    const alistado = cantidadAlistadaProducto(detalle);
                                    const diferencia = alistado - solicitado;
                                    const reservas = obtenerReservas(detalle);

                                    return (
                                        <section
                                            key={obtenerIdDetalleOrden(detalle) || `${obtenerCodigoProducto(detalle)}-${detalleIndex}`}
                                            className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                                        >
                                            <header className="px-4 py-4 md:px-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">
                                                        {obtenerCodigoProducto(detalle) || "Sin código"}
                                                    </p>
                                                    <h2 className="mt-1 font-black text-slate-800">
                                                        {obtenerNombreProducto(detalle)}
                                                    </h2>
                                                     <p className="mt-1 text-xs text-slate-500">
                                                         {[detalle?.presentacion, detalle?.embalaje]
                                                             .filter(Boolean)
                                                             .join(" · ") ||
                                                             detalle?.unidad ||
                                                             "UND"}
                                                     </p>
                                                </div>

                                                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                                                     <span className="rounded-full border border-blue-200 bg-blue-50 text-blue-800 px-3 py-1.5">
                                                         Solicitado {formatearNumero(solicitado)}
                                                     </span>
                                                     <span className="rounded-full border border-slate-200 bg-slate-50 text-slate-700 px-3 py-1.5">
                                                         PAC {formatearNumero(detalle?.pacSolicitado || 0)} · UND {formatearNumero(detalle?.undSolicitado || 0)}
                                                     </span>
                                                    {diferencia > 0 ? (
                                                        <span className="rounded-full border border-amber-200 bg-amber-50 text-amber-800 px-3 py-1.5">
                                                            Excedente +{formatearNumero(diferencia)}
                                                        </span>
                                                    ) : diferencia < 0 ? (
                                                        <span className="rounded-full border border-rose-200 bg-rose-50 text-rose-800 px-3 py-1.5">
                                                            Pendiente {formatearNumero(Math.abs(diferencia))}
                                                        </span>
                                                    ) : (
                                                        <span className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 px-3 py-1.5">
                                                            Completo
                                                        </span>
                                                    )}
                                                </div>
                                            </header>

                                            {reservas.length === 0 ? (
                                                <div className="p-4 md:p-5 flex items-start gap-3 text-sm text-amber-800 bg-amber-50">
                                                    <FaTriangleExclamation className="mt-0.5 shrink-0" />
                                                    Este producto no tiene una reserva física disponible para registrar el alistamiento.
                                                </div>
                                            ) : (
                                                <div className="p-4 md:p-5 grid grid-cols-1 xl:grid-cols-2 gap-3">
                                                    {reservas.map((reserva, reservaIndex) => {
                                                        const idReserva = obtenerIdReserva(reserva);
                                                        const reservada = obtenerCantidadReservada(reserva);
                                                        const cantidad = valorNumero(
                                                            valoresReserva?.[idReserva]?.cantidadAlistada
                                                        );
                                                        const adicional = Math.max(cantidad - reservada, 0);

                                                        return (
                                                            <article
                                                                key={idReserva || reservaIndex}
                                                                className="rounded-2xl border border-slate-200 p-4"
                                                            >
                                                                <div className="flex items-start gap-3">
                                                                    <span className="h-9 w-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                                                                        <FaWarehouse />
                                                                    </span>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="font-bold text-slate-800">
                                                                            {reserva?.bodega || "Bodega sin nombre"}
                                                                        </p>
                                                                        <p className="mt-1 text-xs text-slate-500">
                                                                            {reserva?.ubicacion || "Sin ubicación"}
                                                                            {reserva?.lote ? ` · Lote ${reserva.lote}` : " · Sin lote"}
                                                                        </p>
                                                                        {reserva?.vencimiento || reserva?.fechaVencimiento ? (
                                                                            <p className="mt-1 text-xs text-slate-500">
                                                                                Vence: {formatearFechaHora(reserva?.vencimiento || reserva?.fechaVencimiento)}
                                                                            </p>
                                                                        ) : null}
                                                                    </div>
                                                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                                                                         Capacidad {formatearNumero(reservada)}
                                                                     </span>
                                                                </div>

                                                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-[170px_1fr] gap-3">
                                                                    <label className="flex flex-col gap-1.5 text-sm font-bold text-slate-700">
                                                                         Total alistado acumulado
                                                                        <input
                                                                            type="number"
                                                                            min="0"
                                                                            step="0.001"
                                                                            inputMode="decimal"
                                                                            value={valoresReserva?.[idReserva]?.cantidadAlistada ?? "0"}
                                                                            onChange={(event) => cambiarReserva(idReserva, "cantidadAlistada", event.target.value)}
                                                                            disabled={soloLectura || !idReserva}
                                                                            className="h-11 rounded-xl border border-slate-300 px-3 text-right font-black outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                                                         />
                                                                         <span className="text-[11px] font-normal text-slate-500">
                                                                             Registrado: {formatearNumero(obtenerCantidadAlistadaReserva(reserva))}
                                                                             {Number(reserva?.cantidadEnviada || 0) > 0
                                                                                 ? ` · Enviado: ${formatearNumero(reserva.cantidadEnviada)}`
                                                                                 : ""}
                                                                         </span>
                                                                     </label>

                                                                    <label className="flex flex-col gap-1.5 text-sm font-bold text-slate-700">
                                                                        Observación
                                                                        <input
                                                                            type="text"
                                                                            value={valoresReserva?.[idReserva]?.observacion ?? ""}
                                                                            onChange={(event) => cambiarReserva(idReserva, "observacion", event.target.value)}
                                                                            disabled={soloLectura || !idReserva}
                                                                            placeholder="Opcional"
                                                                            className="h-11 rounded-xl border border-slate-300 px-3 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                                                        />
                                                                    </label>
                                                                </div>

                                                                {adicional > 0 ? (
                                                                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                                                                         Excedente por respaldar: +{formatearNumero(adicional)}. El servidor validará el stock y podrá distribuirlo entre existencias disponibles.
                                                                     </div>
                                                                ) : null}
                                                            </article>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </section>
                                    );
                                })}
                            </div>
                        )}

                        <div className="sticky bottom-0 z-20 rounded-2xl border border-slate-200 bg-white/95 backdrop-blur shadow-lg p-3 md:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="text-sm text-slate-600">
                                <p className="font-bold text-slate-800">
                                    {cambiosPendientes
                                        ? "Hay cambios sin guardar"
                                        : "Avance sincronizado"}
                                </p>
                                <p className="text-xs">
                                    {orden?.fechaActualizacion || orden?.updated_at
                                        ? `Última actualización: ${formatearFechaHora(orden?.fechaActualizacion || orden?.updated_at)}`
                                        : "El backend valida disponibilidad y concurrencia."}
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2">
                                {puedeGuardar ? (
                                    <button
                                        type="button"
                                        onClick={() => guardarAvance()}
                                        disabled={guardando || finalizando || !cambiosPendientes}
                                        className="h-11 px-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 font-bold hover:bg-blue-100 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        <FaFloppyDisk />
                                        {guardando ? "Guardando..." : "Guardar avance"}
                                    </button>
                                ) : null}

                                {puedeFinalizar ? (
                                    <button
                                        type="button"
                                        onClick={() => setConfirmarFinalizacion(true)}
                                        disabled={guardando || finalizando}
                                        className="h-11 px-4 rounded-xl bg-blue-800 text-white font-bold hover:bg-blue-900 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        <FaCircleCheck /> Finalizar
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    </div>
                )}
            </PaginaOrdenesAlistamiento>

            <ModalConfirmacionOrden
                visible={confirmarFinalizacion}
                titulo="Finalizar alistamiento"
                descripcion="Se guardarán los cambios pendientes y el backend validará las existencias, incluidas las cantidades excedentes. Después de finalizar no podrás editar la orden."
                textoConfirmar="Finalizar alistamiento"
                procesando={finalizando || guardando}
                onConfirmar={finalizarOrden}
                onCerrar={() =>
                    !finalizando &&
                    !guardando &&
                    setConfirmarFinalizacion(false)
                }
            />
        </>
    );
}
