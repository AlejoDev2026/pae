import { useCallback, useEffect, useMemo, useState } from "react";
import {
    FaArrowLeft,
    FaClipboardCheck,
    FaSave,
    FaWarehouse,
    FaUserCheck,
    FaCalendarAlt,
    FaCheck,
    FaSyncAlt,
    FaInfoCircle,
} from "react-icons/fa";
import { IoMenu } from "react-icons/io5";
import { toast } from "react-toastify";
import {
    API_BASE_CONTEOS,
    leerRespuesta,
    obtenerIdUsuario,
    respuestaExitosa,
} from "./conteosFisicosHelpers";

const completar = (numero) => String(numero).padStart(2, "0");

const fechaParaInput = (fecha) =>
    `${fecha.getFullYear()}-${completar(fecha.getMonth() + 1)}-${completar(
        fecha.getDate()
    )}T${completar(fecha.getHours())}:${completar(fecha.getMinutes())}`;

const fechaInicial = () => {
    const fecha = new Date();
    fecha.setSeconds(0, 0);
    return fechaParaInput(fecha);
};

const FORM_INICIAL = {
    codigo: "",
    nombre: "",
    descripcion: "",
    fechaCorte: fechaInicial(),
    fechaInicio: fechaInicial(),
    fechaLimite: "",
    tipoConteo: "CIEGO",
    estadoProceso: "BORRADOR",
    observacion: "",
};

export default function CrearConteoFisicoInventario({ setSidebar, navegar }) {
    const [form, setForm] = useState(FORM_INICIAL);
    const [bodegas, setBodegas] = useState([]);
    const [operadores, setOperadores] = useState([]);
    const [tipos, setTipos] = useState([]);
    const [asignaciones, setAsignaciones] = useState({});
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);

    const seleccionadas = useMemo(
        () =>
            bodegas.filter(
                (bodega) => asignaciones?.[bodega.id]?.seleccionada
            ),
        [bodegas, asignaciones]
    );

    const cargarFormData = useCallback(async () => {
        setCargando(true);

        try {
            const respuesta = await fetch(
                `${API_BASE_CONTEOS}InventarioOrdenesConteoFormData.php?t=${Date.now()}`,
                {
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                        "Cache-Control": "no-cache",
                    },
                }
            );

            const resultado = await leerRespuesta(respuesta);

            if (!respuesta.ok || !respuestaExitosa(resultado)) {
                throw new Error(
                    resultado?.error ||
                    resultado?.mensaje ||
                    "No fue posible cargar el formulario."
                );
            }

            const data = resultado?.data || {};
            const bodegasData = Array.isArray(data.bodegas) ? data.bodegas : [];

            setBodegas(bodegasData);
            setOperadores(Array.isArray(data.operadores) ? data.operadores : []);
            setTipos(Array.isArray(data.tiposConteo) ? data.tiposConteo : []);

            const iniciales = {};
            bodegasData.forEach((bodega) => {
                iniciales[bodega.id] = {
                    seleccionada: false,
                    idOperador: "",
                    responsables: [],
                };
            });
            setAsignaciones(iniciales);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        cargarFormData();
    }, [cargarFormData]);

    const cambiarForm = (campo, valor) => {
        setForm((prev) => {
            const nuevo = { ...prev, [campo]: valor };

            if (campo === "fechaCorte" && nuevo.fechaInicio < valor) {
                nuevo.fechaInicio = valor;
            }

            if (
                ["fechaCorte", "fechaInicio"].includes(campo) &&
                nuevo.fechaLimite &&
                nuevo.fechaLimite < nuevo.fechaInicio
            ) {
                nuevo.fechaLimite = nuevo.fechaInicio;
            }

            return nuevo;
        });
    };

    const cambiarAsignacion = (idBodega, cambios) => {
        setAsignaciones((prev) => ({
            ...prev,
            [idBodega]: {
                ...(prev[idBodega] || {}),
                ...cambios,
            },
        }));
    };

    const alternarBodega = (idBodega) => {
        const actual = asignaciones[idBodega] || {};
        const seleccionada = !actual.seleccionada;

        cambiarAsignacion(idBodega, {
            seleccionada,
            idOperador: seleccionada ? actual.idOperador || "" : "",
            responsables: seleccionada ? actual.responsables || [] : [],
        });
    };

    const cambiarPrincipal = (idBodega, idOperador) => {
        const actual = asignaciones[idBodega] || {};
        const responsables = new Set(actual.responsables || []);

        if (idOperador) responsables.add(Number(idOperador));

        cambiarAsignacion(idBodega, {
            idOperador,
            responsables: Array.from(responsables),
        });
    };

    const alternarResponsable = (idBodega, idOperador) => {
        const actual = asignaciones[idBodega] || {};
        const responsables = new Set(
            (actual.responsables || []).map(Number)
        );
        const id = Number(idOperador);

        if (responsables.has(id)) {
            responsables.delete(id);
        } else {
            responsables.add(id);
        }

        const principal = Number(actual.idOperador || 0);
        if (principal) responsables.add(principal);

        cambiarAsignacion(idBodega, {
            responsables: Array.from(responsables),
        });
    };

    const validar = () => {
        if (!form.nombre.trim()) {
            toast.info("Ingresa el nombre de la orden.");
            return false;
        }

        if (!form.fechaCorte || !form.fechaInicio) {
            toast.info("Define la fecha de corte y la fecha de inicio.");
            return false;
        }

        if (form.fechaInicio < form.fechaCorte) {
            toast.info("La fecha de inicio no puede ser anterior al corte.");
            return false;
        }

        if (form.fechaLimite && form.fechaLimite < form.fechaInicio) {
            toast.info("La fecha límite no puede ser anterior al inicio.");
            return false;
        }

        if (seleccionadas.length === 0) {
            toast.info("Selecciona al menos una bodega.");
            return false;
        }

        if (form.estadoProceso === "PROGRAMADA") {
            const pendiente = seleccionadas.find(
                (bodega) =>
                    !Number(asignaciones?.[bodega.id]?.idOperador || 0)
            );

            if (pendiente) {
                toast.info(
                    `Asigna un responsable principal a ${pendiente.nombre}.`
                );
                return false;
            }
        }

        if (!obtenerIdUsuario()) {
            toast.error("No fue posible identificar el usuario que registra.");
            return false;
        }

        return true;
    };

    const guardar = async () => {
        if (!validar()) return;

        setGuardando(true);

        try {
            const payload = {
                ...form,
                codigo: form.codigo.trim().toUpperCase(),
                nombre: form.nombre.trim(),
                descripcion: form.descripcion.trim(),
                fechaCorte: form.fechaCorte.replace("T", " "),
                fechaInicio: form.fechaInicio.replace("T", " "),
                fechaLimite: form.fechaLimite
                    ? form.fechaLimite.replace("T", " ")
                    : "",
                observacion: form.observacion.trim(),
                idUsuarioRegistro: obtenerIdUsuario(),
                bodegas: seleccionadas.map((bodega) => {
                    const asignacion = asignaciones[bodega.id] || {};
                    const principal = Number(asignacion.idOperador || 0);
                    const responsables = new Set(
                        (asignacion.responsables || []).map(Number)
                    );

                    if (principal) responsables.add(principal);

                    return {
                        idBodega: Number(bodega.id),
                        idOperador: principal,
                        responsables: Array.from(responsables),
                    };
                }),
            };

            const respuesta = await fetch(
                `${API_BASE_CONTEOS}InventarioOrdenesConteoCrear.php`,
                {
                    method: "POST",
                    cache: "no-store",
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                        "Cache-Control": "no-cache",
                    },
                    body: JSON.stringify(payload),
                }
            );

            const resultado = await leerRespuesta(respuesta);

            if (!respuesta.ok || !respuestaExitosa(resultado)) {
                throw new Error(
                    resultado?.error ||
                    resultado?.mensaje ||
                    "No fue posible crear la orden."
                );
            }

            const idOrden = Number(
                resultado?.data?.idOrdenConteo || resultado?.data?.id || 0
            );

            if (idOrden) {
                localStorage.setItem(
                    "inventarioOrdenConteoId",
                    String(idOrden)
                );
            }

            toast.success(resultado?.mensaje || "Orden creada correctamente.");
            navegar("DetalleConteoFisicoInventario");
        } catch (error) {
            toast.error(error.message);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="w-full h-screen flex flex-col p-2 md:p-4 gap-4 bg-slate-100">
            <article className="flex-1 bg-white shadow-lg rounded-2xl flex flex-col overflow-hidden border border-slate-200">
                <header className="px-4 py-3 md:px-5 border-b border-slate-200">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setSidebar(true)}
                                className="lg:hidden h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center"
                            >
                                <IoMenu size={23} />
                            </button>

                            <button
                                type="button"
                                onClick={() => navegar("ConteosFisicosInventario")}
                                className="h-10 w-10 rounded-xl border border-slate-200 flex items-center justify-center"
                            >
                                <FaArrowLeft />
                            </button>

                            <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center border border-blue-100">
                                <FaClipboardCheck size={20} />
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Conteos físicos
                                </p>
                                <h1 className="text-xl md:text-2xl font-bold text-slate-900">
                                    Nueva orden de conteo
                                </h1>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={guardar}
                            disabled={guardando || cargando}
                            className="h-10 px-5 rounded-xl bg-blue-800 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {guardando ? (
                                <FaSyncAlt className="animate-spin" />
                            ) : (
                                <FaSave />
                            )}
                            Guardar orden
                        </button>
                    </div>
                </header>

                <section className="flex-1 overflow-auto p-4 md:p-5 bg-slate-50/60">
                    {cargando ? (
                        <div className="min-h-64 flex flex-col items-center justify-center text-slate-500">
                            <FaSyncAlt className="animate-spin text-3xl mb-3" />
                            Cargando formulario...
                        </div>
                    ) : (
                        <div className="max-w-7xl mx-auto space-y-5">
                            <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
                                <div className="flex items-center gap-3 mb-5">
                                    <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
                                        <FaCalendarAlt />
                                    </div>
                                    <div>
                                        <h2 className="font-bold text-slate-900">
                                            Información general
                                        </h2>
                                        <p className="text-sm text-slate-500">
                                            Define el corte y el periodo de ejecución
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    <label className="space-y-1.5 md:col-span-2">
                                        <span className="text-sm font-bold text-slate-700">
                                            Nombre *
                                        </span>
                                        <input
                                            value={form.nombre}
                                            onChange={(e) => cambiarForm("nombre", e.target.value)}
                                            className="w-full h-11 px-3 rounded-xl border border-slate-200"
                                        />
                                    </label>

                                    <label className="space-y-1.5">
                                        <span className="text-sm font-bold text-slate-700">
                                            Código
                                        </span>
                                        <input
                                            value={form.codigo}
                                            onChange={(e) => cambiarForm("codigo", e.target.value)}
                                            placeholder="Automático"
                                            className="w-full h-11 px-3 rounded-xl border border-slate-200 uppercase"
                                        />
                                    </label>

                                    <label className="space-y-1.5">
                                        <span className="text-sm font-bold text-slate-700">
                                            Fecha y hora de corte *
                                        </span>
                                        <input
                                            type="datetime-local"
                                            value={form.fechaCorte}
                                            onChange={(e) => cambiarForm("fechaCorte", e.target.value)}
                                            className="w-full h-11 px-3 rounded-xl border border-slate-200"
                                        />
                                    </label>

                                    <label className="space-y-1.5">
                                        <span className="text-sm font-bold text-slate-700">
                                            Inicio *
                                        </span>
                                        <input
                                            type="datetime-local"
                                            value={form.fechaInicio}
                                            onChange={(e) => cambiarForm("fechaInicio", e.target.value)}
                                            className="w-full h-11 px-3 rounded-xl border border-slate-200"
                                        />
                                    </label>

                                    <label className="space-y-1.5">
                                        <span className="text-sm font-bold text-slate-700">
                                            Fecha límite
                                        </span>
                                        <input
                                            type="datetime-local"
                                            value={form.fechaLimite}
                                            onChange={(e) => cambiarForm("fechaLimite", e.target.value)}
                                            className="w-full h-11 px-3 rounded-xl border border-slate-200"
                                        />
                                    </label>

                                    <label className="space-y-1.5">
                                        <span className="text-sm font-bold text-slate-700">
                                            Tipo
                                        </span>
                                        <select
                                            value={form.tipoConteo}
                                            onChange={(e) => cambiarForm("tipoConteo", e.target.value)}
                                            className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white"
                                        >
                                            {tipos.map((tipo) => (
                                                <option key={tipo.valor} value={tipo.valor}>
                                                    {tipo.nombre}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="space-y-1.5">
                                        <span className="text-sm font-bold text-slate-700">
                                            Estado inicial
                                        </span>
                                        <select
                                            value={form.estadoProceso}
                                            onChange={(e) => cambiarForm("estadoProceso", e.target.value)}
                                            className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white"
                                        >
                                            <option value="BORRADOR">BORRADOR</option>
                                            <option value="PROGRAMADA">PROGRAMADA</option>
                                        </select>
                                    </label>

                                    <label className="space-y-1.5 md:col-span-2">
                                        <span className="text-sm font-bold text-slate-700">
                                            Descripción
                                        </span>
                                        <textarea
                                            rows={3}
                                            value={form.descripcion}
                                            onChange={(e) => cambiarForm("descripcion", e.target.value)}
                                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 resize-none"
                                        />
                                    </label>

                                    <label className="space-y-1.5 xl:col-span-3">
                                        <span className="text-sm font-bold text-slate-700">
                                            Observación administrativa
                                        </span>
                                        <textarea
                                            rows={2}
                                            value={form.observacion}
                                            onChange={(e) => cambiarForm("observacion", e.target.value)}
                                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 resize-none"
                                        />
                                    </label>
                                </div>

                                <div className="mt-4 flex gap-3 rounded-xl bg-blue-50 border border-blue-100 p-4 text-blue-800">
                                    <FaInfoCircle className="mt-0.5 shrink-0" />
                                    <p className="text-sm">
                                        En conteo <strong>CIEGO</strong>, el responsable no verá la existencia teórica. Los resultados solo serán visibles después del cierre administrativo.
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
                                <div className="flex items-center justify-between gap-3 mb-5">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                                            <FaWarehouse />
                                        </div>
                                        <div>
                                            <h2 className="font-bold text-slate-900">
                                                Bodegas y responsables
                                            </h2>
                                            <p className="text-sm text-slate-500">
                                                Seleccionadas: {seleccionadas.length}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                    {bodegas.map((bodega) => {
                                        const asignacion = asignaciones[bodega.id] || {};
                                        const activa = Boolean(asignacion.seleccionada);

                                        return (
                                            <article
                                                key={bodega.id}
                                                className={`rounded-2xl border p-4 ${
                                                    activa
                                                        ? "border-blue-300 bg-blue-50/40"
                                                        : "border-slate-200 bg-white"
                                                }`}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => alternarBodega(bodega.id)}
                                                    className="w-full flex items-start gap-3 text-left"
                                                >
                                                    <span
                                                        className={`mt-0.5 h-6 w-6 rounded-lg border flex items-center justify-center ${
                                                            activa
                                                                ? "bg-blue-800 border-blue-800 text-white"
                                                                : "bg-white border-slate-300 text-transparent"
                                                        }`}
                                                    >
                                                        <FaCheck size={12} />
                                                    </span>

                                                    <span>
                                                        <span className="block font-bold text-slate-900">
                                                            {bodega.nombre}
                                                        </span>
                                                        <span className="block text-xs font-mono text-slate-500">
                                                            {bodega.codigo}
                                                        </span>
                                                    </span>
                                                </button>

                                                {activa && (
                                                    <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
                                                        <label className="space-y-1.5">
                                                            <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                                                <FaUserCheck />
                                                                Responsable principal
                                                            </span>
                                                            <select
                                                                value={asignacion.idOperador || ""}
                                                                onChange={(e) =>
                                                                    cambiarPrincipal(
                                                                        bodega.id,
                                                                        e.target.value
                                                                    )
                                                                }
                                                                className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-white"
                                                            >
                                                                <option value="">Seleccionar</option>
                                                                {operadores.map((operador) => (
                                                                    <option key={operador.id} value={operador.id}>
                                                                        {operador.nombreCompleto} - {operador.cargo}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </label>

                                                        <div>
                                                            <p className="text-sm font-bold text-slate-700 mb-2">
                                                                Colaboradores adicionales
                                                            </p>
                                                            <div className="max-h-40 overflow-auto rounded-xl border border-slate-200 divide-y bg-white">
                                                                {operadores.map((operador) => {
                                                                    const activo = (asignacion.responsables || [])
                                                                        .map(Number)
                                                                        .includes(Number(operador.id));

                                                                    return (
                                                                        <button
                                                                            key={operador.id}
                                                                            type="button"
                                                                            onClick={() =>
                                                                                alternarResponsable(
                                                                                    bodega.id,
                                                                                    operador.id
                                                                                )
                                                                            }
                                                                            className="w-full px-3 py-2.5 flex justify-between gap-3 text-left hover:bg-slate-50"
                                                                        >
                                                                            <span>
                                                                                <span className="block text-sm font-semibold">
                                                                                    {operador.nombreCompleto}
                                                                                </span>
                                                                                <span className="block text-xs text-slate-500">
                                                                                    {operador.cargo}
                                                                                </span>
                                                                            </span>

                                                                            <span
                                                                                className={`h-6 w-6 rounded-lg border flex items-center justify-center ${
                                                                                    activo
                                                                                        ? "bg-blue-800 border-blue-800 text-white"
                                                                                        : "bg-white border-slate-300 text-transparent"
                                                                                }`}
                                                                            >
                                                                                <FaCheck size={12} />
                                                                            </span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </article>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </article>
        </div>
    );
}
