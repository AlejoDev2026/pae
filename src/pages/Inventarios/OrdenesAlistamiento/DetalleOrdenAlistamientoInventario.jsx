import React, { useEffect, useMemo, useState } from "react";
import {
    FaBoxesStacked,
    FaCircleCheck,
    FaClock,
    FaPaperPlane,
    FaUserCheck,
    FaWarehouse,
} from "react-icons/fa6";
import { toast } from "react-toastify";
import {
    ENDPOINTS_ORDENES_ALISTAMIENTO,
    formatearFechaHora,
    formatearNumero,
    obtenerCantidadAlistada,
    obtenerCantidadSolicitada,
    obtenerCodigoOrden,
    obtenerCodigoProducto,
    obtenerEstadoLogistica,
    obtenerEstadoOrden,
    obtenerIdDetalleOrden,
    obtenerIdOperador,
    obtenerIdUsuario,
    obtenerNombreOperador,
    obtenerNombreProducto,
    obtenerOrdenSeleccionada,
    solicitarOrdenesJson,
} from "./ordenesAlistamientoHelpers";
import {
    EstadoCargaOrdenes,
    EstadoLogisticaBadge,
    EstadoOrdenBadge,
    ModalConfirmacionOrden,
    PaginaOrdenesAlistamiento,
    TarjetasResumenOrdenes,
} from "./OrdenesAlistamientoUI";

export default function DetalleOrdenAlistamientoInventario({
    setSidebar,
    navegar,
}) {
    const [orden, setOrden] = useState(null);
    const [detalles, setDetalles] = useState([]);
    const [asignaciones, setAsignaciones] = useState([]);
    const [envios, setEnvios] = useState([]);
    const [resumen, setResumen] = useState({});
    const [operadores, setOperadores] = useState([]);
    const [idOperador, setIdOperador] = useState("");
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState("");
    const [asignando, setAsignando] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [confirmarEnvio, setConfirmarEnvio] = useState(false);
    const [version, setVersion] = useState(0);

    const idOrden = useMemo(() => obtenerOrdenSeleccionada(), []);
    const idUsuario = useMemo(() => obtenerIdUsuario(), []);

    useEffect(() => {
        const controlador = new AbortController();

        const cargar = async () => {
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
                const [resultadoDetalle, resultadoFormData] =
                    await Promise.all([
                        solicitarOrdenesJson(
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
                        ),
                        solicitarOrdenesJson(
                            ENDPOINTS_ORDENES_ALISTAMIENTO.formData,
                            {
                                params: {
                                    idOrdenAlistamiento: idOrden,
                                    idOrden,
                                    idUsuario,
                                    t: Date.now(),
                                },
                                signal: controlador.signal,
                            }
                        ).catch((errorFormData) => {
                            if (errorFormData?.name !== "AbortError") {
                                console.error(
                                    "Error cargando operadores:",
                                    errorFormData
                                );
                            }
                            return { data: {} };
                        }),
                    ]);

                const data = resultadoDetalle?.data || {};
                const ordenData = data?.orden || data?.cabecera || data;
                const detallesData = Array.isArray(data?.detalles)
                    ? data.detalles
                    : Array.isArray(ordenData?.detalles)
                      ? ordenData.detalles
                      : [];

                setOrden(ordenData || null);
                setDetalles(detallesData);
                setAsignaciones(
                    Array.isArray(data?.asignaciones)
                        ? data.asignaciones
                        : []
                );
                setEnvios(
                    Array.isArray(data?.envios) ? data.envios : []
                );
                setResumen(data?.resumen || ordenData?.resumen || {});

                const operadoresData =
                    resultadoFormData?.data?.operadores;
                setOperadores(
                    Array.isArray(operadoresData)
                        ? operadoresData
                        : []
                );

                const operadorActual = Number(
                    ordenData?.idOperador ||
                    ordenData?.idOperadorAsignado ||
                    data?.asignaciones?.[0]?.idOperador ||
                    0
                );
                setIdOperador(
                    operadorActual ? String(operadorActual) : ""
                );
            } catch (errorConsulta) {
                if (errorConsulta?.name === "AbortError") return;

                console.error(
                    "Error consultando detalle de orden:",
                    errorConsulta
                );
                setError(
                    errorConsulta?.message ||
                    "No fue posible consultar la orden de alistamiento."
                );
            } finally {
                if (!controlador.signal.aborted) setCargando(false);
            }
        };

        cargar();
        return () => controlador.abort();
    }, [idOrden, idUsuario, version]);

    const estado = obtenerEstadoOrden(orden);
    const totalSolicitado = Number(
        resumen?.totalSolicitado ??
        resumen?.totalCantidad ??
        detalles.reduce(
            (total, item) =>
                total + obtenerCantidadSolicitada(item),
            0
        )
    );
    const totalAlistado = Number(
        resumen?.totalAlistado ??
        detalles.reduce(
            (total, item) => total + obtenerCantidadAlistada(item),
            0
        )
    );
    const totalExcedente = detalles.reduce(
        (total, item) =>
            total +
            Math.max(
                obtenerCantidadAlistada(item) -
                    obtenerCantidadSolicitada(item),
                0
            ),
        0
    );
    const totalEnviado = Number(
        resumen?.cantidadEnviada ??
            detalles.reduce(
                (total, item) =>
                    total + Number(item?.cantidadEnviada || 0),
                0
            )
    );
    const totalPendienteEnviar = detalles.reduce(
        (total, item) =>
            total +
            Math.max(
                Number(item?.cantidadAlistada || 0) -
                    Number(item?.cantidadEnviada || 0),
                0
            ),
        0
    );
    const bodegasOrden = Array.from(
        new Set(
            detalles.flatMap((detalle) =>
                (Array.isArray(detalle?.reservas)
                    ? detalle.reservas
                    : []
                )
                    .map((reserva) => reserva?.bodega)
                    .filter(Boolean)
            )
        )
    );

    const capacidades = orden?.capacidades || {};
    const puedeAsignar = Boolean(capacidades.puedeAsignar);
    const puedeReasignar = Boolean(capacidades.puedeReasignar);
    const puedeGestionarAsignacion =
        puedeAsignar || puedeReasignar;
    const puedeEnviarLogistica = Boolean(
        capacidades.puedeEnviarLogistica
    );

    const asignarOrden = async () => {
        const operadorSeleccionado = Number(idOperador || 0);
        if (!operadorSeleccionado) {
            toast.warning("Selecciona el responsable de la orden.");
            return;
        }

        if (asignando) return;
        setAsignando(true);

        try {
            const esReasignacion = puedeReasignar;
            const resultado = await solicitarOrdenesJson(
                esReasignacion
                    ? ENDPOINTS_ORDENES_ALISTAMIENTO.reasignarPendientes
                    : ENDPOINTS_ORDENES_ALISTAMIENTO.asignar,
                {
                    method: "POST",
                    body: {
                        idOrdenAlistamiento: idOrden,
                        idOrden,
                        idOperador: operadorSeleccionado,
                        versionRegistro:
                            orden?.versionRegistro ?? undefined,
                        idUsuario,
                    },
                }
            );

            toast.success(
                resultado?.mensaje ||
                (esReasignacion
                    ? "Pendientes reasignados correctamente."
                    : "Responsable asignado correctamente.")
            );
            setVersion((valor) => valor + 1);
        } catch (errorAsignacion) {
            console.error("Error asignando orden:", errorAsignacion);
            toast.error(
                errorAsignacion?.message ||
                (puedeReasignar
                    ? "No fue posible reasignar los pendientes."
                    : "No fue posible asignar la orden.")
            );
        } finally {
            setAsignando(false);
        }
    };

    const enviarLogistica = async () => {
        if (enviando) return;
        setEnviando(true);

        try {
            const resultado = await solicitarOrdenesJson(
                ENDPOINTS_ORDENES_ALISTAMIENTO.enviarLogistica,
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
                "Orden enviada a logística correctamente."
            );
            setConfirmarEnvio(false);
            setVersion((valor) => valor + 1);
        } catch (errorEnvio) {
            console.error("Error enviando orden a logística:", errorEnvio);
            toast.error(
                errorEnvio?.message ||
                "No fue posible enviar la orden a logística."
            );
        } finally {
            setEnviando(false);
        }
    };

    const tarjetas = [
        {
            titulo: "Productos",
            valor: detalles.length,
            icono: FaBoxesStacked,
            clase: "bg-slate-50 border-slate-200 text-slate-700",
        },
        {
            titulo: "Solicitado",
            valor: totalSolicitado,
            icono: FaClock,
            clase: "bg-blue-50 border-blue-200 text-blue-700",
        },
        {
            titulo: "Alistado",
            valor: totalAlistado,
            icono: FaCircleCheck,
            clase: "bg-emerald-50 border-emerald-200 text-emerald-700",
        },
        {
            titulo: "Excedente",
            valor: totalExcedente,
            icono: FaBoxesStacked,
            clase: "bg-amber-50 border-amber-200 text-amber-700",
        },
        {
            titulo: "Enviado",
            valor: totalEnviado,
            icono: FaPaperPlane,
            clase: "bg-violet-50 border-violet-200 text-violet-700",
        },
        {
            titulo: "Por enviar",
            valor: totalPendienteEnviar,
            icono: FaClock,
            clase: "bg-blue-50 border-blue-200 text-blue-800",
        },
    ];

    return (
        <>
            <PaginaOrdenesAlistamiento
                setSidebar={setSidebar}
                titulo={
                    orden
                        ? obtenerCodigoOrden(orden)
                        : "Detalle de orden"
                }
                descripcion="Revisa el consolidado, asigna el responsable y envía la orden a logística."
                onVolver={() =>
                    navegar("OrdenesAlistamientoInventario")
                }
                acciones={
                    orden ? (
                        <>
                            <EstadoOrdenBadge estado={estado} />
                            <EstadoLogisticaBadge
                                estado={obtenerEstadoLogistica(orden)}
                            />
                        </>
                    ) : null
                }
            >
                {cargando ? (
                    <EstadoCargaOrdenes texto="Consultando detalle de la orden..." />
                ) : error ? (
                    <div className="min-h-56 rounded-2xl border border-rose-200 bg-rose-50 p-6 flex flex-col items-center justify-center text-center">
                        <p className="font-black text-rose-800">
                            No fue posible consultar la orden
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
                    <div className="flex flex-col gap-5">
                        <TarjetasResumenOrdenes tarjetas={tarjetas} />

                        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <div className="px-4 py-3 md:px-5 border-b border-slate-200 bg-slate-50">
                                <h2 className="font-black text-slate-800">
                                    Datos generales
                                </h2>
                            </div>
                            <div className="p-4 md:p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                                {[
                                    [
                                        "Despacho",
                                        orden?.codigoDespacho ||
                                            orden?.despachoCodigo ||
                                            `#${orden?.idDespacho || orden?.idDespachoInforme || "-"}`,
                                    ],
                                    [
                                        "Contrato",
                                        orden?.despacho?.contrato ||
                                            orden?.contrato ||
                                            orden?.despacho?.descripcion ||
                                            orden?.descripcionDespacho ||
                                            "Sin contrato",
                                    ],
                                    [
                                        "Bodegas de reserva",
                                        bodegasOrden.length
                                            ? bodegasOrden.join(", ")
                                            : "Sin existencias reservadas",
                                    ],
                                    [
                                        "Registrada",
                                        formatearFechaHora(
                                            orden?.fechaCreacion ||
                                                orden?.fechaRegistro ||
                                                orden?.created_at
                                        ),
                                    ],
                                ].map(([titulo, valor]) => (
                                    <div
                                        key={titulo}
                                        className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                                    >
                                        <p className="text-xs font-semibold text-slate-500">
                                            {titulo}
                                        </p>
                                        <p className="mt-1 text-sm font-bold text-slate-800 break-words">
                                            {valor}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <div className="px-4 py-3 md:px-5 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
                                <FaUserCheck className="text-blue-800" />
                                <h2 className="font-black text-slate-800">
                                    Asignación de alistamiento
                                </h2>
                            </div>
                            <div className="p-4 md:p-5 grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3 items-end">
                                <label className="flex flex-col gap-1.5 text-sm font-bold text-slate-700">
                                    Responsable
                                    <select
                                        value={idOperador}
                                        onChange={(event) =>
                                            setIdOperador(event.target.value)
                                        }
                                        disabled={!puedeGestionarAsignacion || asignando || enviando}
                                        className="h-11 rounded-xl border border-slate-300 bg-white px-3 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                                    >
                                        <option value="">Seleccionar responsable</option>
                                        {operadores.map((operador) => (
                                            <option
                                                key={obtenerIdOperador(operador)}
                                                value={obtenerIdOperador(operador)}
                                            >
                                                {obtenerNombreOperador(operador)}
                                                {operador?.codigo
                                                    ? ` · ${operador.codigo}`
                                                    : ""}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <button
                                    type="button"
                                    onClick={asignarOrden}
                                    disabled={!puedeGestionarAsignacion || asignando || enviando}
                                    className="h-11 px-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-800 font-bold hover:bg-blue-100 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {asignando
                                        ? puedeReasignar
                                            ? "Reasignando..."
                                            : "Asignando..."
                                        : puedeReasignar
                                          ? "Reasignar pendientes"
                                          : "Asignar"}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setConfirmarEnvio(true)}
                                    disabled={!puedeEnviarLogistica || asignando || enviando}
                                    className="h-11 px-4 rounded-xl bg-blue-800 text-white font-bold hover:bg-blue-900 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    <FaPaperPlane /> Enviar a logística
                                </button>
                            </div>

                            {asignaciones.length > 0 ? (
                                <div className="px-4 pb-4 md:px-5 md:pb-5 flex flex-wrap gap-2">
                                    {asignaciones.map((asignacion, index) => (
                                        <span
                                            key={
                                                obtenerIdOperador(asignacion) ||
                                                index
                                            }
                                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
                                        >
                                            <FaUserCheck />
                                            {obtenerNombreOperador(asignacion)}
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                        </section>

                        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <div className="px-4 py-3 md:px-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                                <div>
                                    <h2 className="font-black text-slate-800">
                                        Productos solicitados
                                    </h2>
                                    <p className="text-sm text-slate-500">
                                        Consolidado que Inventarios debe alistar y entregar a Logística.
                                    </p>
                                </div>
                                <FaWarehouse className="text-slate-400" />
                            </div>

                            {detalles.length === 0 ? (
                                <div className="p-6 text-sm text-slate-500 text-center">
                                    La orden no tiene productos registrados.
                                </div>
                            ) : (
                                <>
                                    <div className="hidden lg:block overflow-x-auto">
                                        <table className="w-full min-w-[1250px] text-sm">
                                            <thead className="bg-white text-slate-600">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">Código</th>
                                                    <th className="px-4 py-3 text-left">Producto</th>
                                                    <th className="px-4 py-3 text-left">Presentación</th>
                                                    <th className="px-4 py-3 text-right">PAC</th>
                                                    <th className="px-4 py-3 text-right">UND</th>
                                                    <th className="px-4 py-3 text-right">Solicitado</th>
                                                    <th className="px-4 py-3 text-right">Alistado</th>
                                                    <th className="px-4 py-3 text-right">Enviado</th>
                                                    <th className="px-4 py-3 text-right">Por enviar</th>
                                                    <th className="px-4 py-3 text-right">Diferencia</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detalles.map((detalle, index) => {
                                                    const solicitado = obtenerCantidadSolicitada(detalle);
                                                    const alistado = obtenerCantidadAlistada(detalle);
                                                    const diferencia = alistado - solicitado;

                                                    return (
                                                        <tr
                                                            key={obtenerIdDetalleOrden(detalle) || `${obtenerCodigoProducto(detalle)}-${index}`}
                                                            className="border-t border-slate-100"
                                                        >
                                                            <td className="px-4 py-3 font-semibold text-slate-700">
                                                                {obtenerCodigoProducto(detalle) || "-"}
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-800">
                                                                {obtenerNombreProducto(detalle)}
                                                            </td>
                                                            <td className="px-4 py-3 text-slate-600">
                                                                {[detalle?.presentacion, detalle?.embalaje]
                                                                    .filter(Boolean)
                                                                    .join(" · ") ||
                                                                    detalle?.unidad ||
                                                                    "UND"}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-semibold">
                                                                {formatearNumero(detalle?.pacSolicitado || 0)}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-semibold">
                                                                {formatearNumero(detalle?.undSolicitado || 0)}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-bold">
                                                                {formatearNumero(solicitado)}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-bold">
                                                                {formatearNumero(alistado)}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-bold text-violet-700">
                                                                {formatearNumero(detalle?.cantidadEnviada || 0)}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-bold text-blue-800">
                                                                {formatearNumero(
                                                                    Math.max(
                                                                        alistado - Number(detalle?.cantidadEnviada || 0),
                                                                        0
                                                                    )
                                                                )}
                                                            </td>
                                                            <td className={`px-4 py-3 text-right font-black ${diferencia > 0 ? "text-amber-700" : diferencia < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                                                                {diferencia > 0 ? "+" : ""}
                                                                {formatearNumero(diferencia)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 lg:hidden">
                                        {detalles.map((detalle, index) => {
                                            const solicitado = obtenerCantidadSolicitada(detalle);
                                            const alistado = obtenerCantidadAlistada(detalle);
                                            const diferencia = alistado - solicitado;

                                            return (
                                                <article
                                                    key={obtenerIdDetalleOrden(detalle) || `${obtenerCodigoProducto(detalle)}-${index}`}
                                                    className="rounded-xl border border-slate-200 p-3"
                                                >
                                                    <p className="text-xs font-bold text-blue-800">
                                                        {obtenerCodigoProducto(detalle) || "Sin código"}
                                                    </p>
                                                    <h3 className="mt-1 font-bold text-slate-800">
                                                        {obtenerNombreProducto(detalle)}
                                                    </h3>
                                                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
                                                        <div className="rounded-lg bg-slate-50 p-2">
                                                            <p className="text-[11px] text-slate-500">Solicitado</p>
                                                            <p className="font-black">{formatearNumero(solicitado)}</p>
                                                        </div>
                                                        <div className="rounded-lg bg-slate-50 p-2">
                                                            <p className="text-[11px] text-slate-500">Alistado</p>
                                                            <p className="font-black">{formatearNumero(alistado)}</p>
                                                        </div>
                                                        <div className="rounded-lg bg-slate-50 p-2">
                                                            <p className="text-[11px] text-slate-500">Diferencia</p>
                                                            <p className={`font-black ${diferencia > 0 ? "text-amber-700" : diferencia < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                                                                {diferencia > 0 ? "+" : ""}{formatearNumero(diferencia)}
                                                            </p>
                                                        </div>
                                                        <div className="rounded-lg bg-slate-50 p-2">
                                                            <p className="text-[11px] text-slate-500">PAC / UND</p>
                                                            <p className="font-black">
                                                                {formatearNumero(detalle?.pacSolicitado || 0)} / {formatearNumero(detalle?.undSolicitado || 0)}
                                                            </p>
                                                        </div>
                                                        <div className="rounded-lg bg-slate-50 p-2">
                                                            <p className="text-[11px] text-slate-500">Enviado</p>
                                                            <p className="font-black text-violet-700">
                                                                {formatearNumero(detalle?.cantidadEnviada || 0)}
                                                            </p>
                                                        </div>
                                                        <div className="rounded-lg bg-slate-50 p-2">
                                                            <p className="text-[11px] text-slate-500">Por enviar</p>
                                                            <p className="font-black text-blue-800">
                                                                {formatearNumero(
                                                                    Math.max(
                                                                        alistado - Number(detalle?.cantidadEnviada || 0),
                                                                        0
                                                                    )
                                                                )}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </section>

                        {envios.length > 0 ? (
                            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 md:p-5">
                                <h2 className="font-black text-slate-800">
                                    Historial de envíos
                                </h2>
                                <div className="mt-3 flex flex-col gap-2">
                                    {envios.map((envio, index) => (
                                        <div
                                            key={envio?.idEnvio || index}
                                            className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
                                        >
                                            <p className="font-bold text-slate-700">
                                                {envio?.consecutivo || "Envío a logística"}
                                                {envio?.bodega ? ` · ${envio.bodega}` : ""}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {envio?.codigoDocumento || "Documento sin consecutivo"}
                                                {` · ${formatearNumero(envio?.cantidadTotal || 0)} unidades`}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">
                                                {formatearFechaHora(
                                                    envio?.fechaEnvioLogistica ||
                                                        envio?.fechaGeneracion
                                                )}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ) : null}
                    </div>
                )}
            </PaginaOrdenesAlistamiento>

            <ModalConfirmacionOrden
                visible={confirmarEnvio}
                titulo="Enviar orden a logística"
                descripcion={`Se enviarán ${formatearNumero(totalPendienteEnviar)} unidades. Se generará una salida finalizada por cada bodega involucrada y las cantidades dejarán el inventario para quedar en Logística. Esta operación no se puede editar como borrador.`}
                textoConfirmar="Enviar a logística"
                procesando={enviando}
                onConfirmar={enviarLogistica}
                onCerrar={() =>
                    !enviando && setConfirmarEnvio(false)
                }
            />
        </>
    );
}
