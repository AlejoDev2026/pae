import React from "react";
import { IoClose, IoMenu } from "react-icons/io5";
import {
    FaArrowLeft,
    FaClipboardCheck,
    FaFilter,
} from "react-icons/fa6";
import {
    claseEstadoLogistica,
    claseEstadoOrden,
    formatearNumero,
    textoEstadoOrden,
} from "./ordenesAlistamientoHelpers";

export const PaginaOrdenesAlistamiento = ({
    setSidebar,
    titulo,
    descripcion,
    onVolver,
    acciones,
    children,
}) => (
    <div className="w-full h-screen min-h-0 flex flex-col gap-4 bg-slate-100 p-4 md:p-6 overflow-hidden">
        <div className="flex items-center gap-4 lg:hidden shrink-0">
            <button
                type="button"
                onClick={() => setSidebar?.(true)}
                className="h-10 w-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50"
                aria-label="Abrir menú"
            >
                <IoMenu className="text-2xl text-slate-700" />
            </button>
            <p className="text-base font-bold text-slate-800 truncate">
                {titulo}
            </p>
        </div>

        <article className="flex-1 min-h-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
            <header className="shrink-0 border-b border-slate-200 px-4 py-4 md:px-6 md:py-5 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                    {onVolver ? (
                        <button
                            type="button"
                            onClick={onVolver}
                            className="h-10 w-10 shrink-0 rounded-xl border border-slate-300 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-50"
                            aria-label="Volver"
                        >
                            <FaArrowLeft />
                        </button>
                    ) : (
                        <span className="h-10 w-10 shrink-0 rounded-xl border border-blue-100 bg-blue-50 text-blue-800 flex items-center justify-center">
                            <FaClipboardCheck />
                        </span>
                    )}

                    <div className="min-w-0">
                        <h1 className="text-xl md:text-2xl font-black text-slate-800 leading-tight">
                            {titulo}
                        </h1>
                        {descripcion ? (
                            <p className="mt-1 text-sm text-slate-500 max-w-3xl">
                                {descripcion}
                            </p>
                        ) : null}
                    </div>
                </div>

                {acciones ? (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {acciones}
                    </div>
                ) : null}
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 md:p-6">
                {children}
            </div>
        </article>
    </div>
);

export const EstadoOrdenBadge = ({ estado }) => (
    <span
        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${claseEstadoOrden(
            estado
        )}`}
    >
        {textoEstadoOrden(estado)}
    </span>
);

export const EstadoLogisticaBadge = ({ estado }) => (
    <span
        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${claseEstadoLogistica(
            estado
        )}`}
    >
        Logística: {textoEstadoOrden(estado)}
    </span>
);

export const TarjetasResumenOrdenes = ({ tarjetas = [] }) => (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {tarjetas.map((tarjeta) => {
            const Icono = tarjeta.icono || FaClipboardCheck;

            return (
                <div
                    key={tarjeta.titulo}
                    className={`rounded-2xl border p-3 md:p-4 shadow-sm ${
                        tarjeta.clase ||
                        "bg-slate-50 border-slate-200 text-slate-700"
                    }`}
                >
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs md:text-sm font-semibold">
                            {tarjeta.titulo}
                        </p>
                        <Icono className="text-base opacity-70" />
                    </div>
                    <p className="mt-2 text-xl md:text-2xl font-black">
                        {formatearNumero(tarjeta.valor)}
                    </p>
                </div>
            );
        })}
    </div>
);

export const EstadoCargaOrdenes = ({ texto = "Cargando información..." }) => (
    <div className="min-h-56 rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-center p-6 text-center text-sm font-semibold text-slate-500">
        <span className="h-5 w-5 mr-3 rounded-full border-2 border-slate-300 border-t-blue-700 animate-spin" />
        {texto}
    </div>
);

export const EstadoVacioOrdenes = ({
    titulo = "No hay órdenes para mostrar",
    descripcion = "Prueba otros filtros o actualiza la consulta.",
}) => (
    <div className="min-h-56 rounded-2xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <FaClipboardCheck className="text-4xl text-slate-300" />
        <h2 className="mt-3 text-base font-bold text-slate-700">{titulo}</h2>
        <p className="mt-1 text-sm text-slate-500">{descripcion}</p>
    </div>
);

export const BotonFiltrosOrdenes = ({ cantidad = 0, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-bold text-sm flex items-center gap-2"
    >
        <FaFilter />
        Filtros
        {cantidad > 0 ? (
            <span className="min-w-5 h-5 px-1 rounded-full bg-blue-800 text-white text-[11px] flex items-center justify-center">
                {cantidad}
            </span>
        ) : null}
    </button>
);

export const ModalFiltrosOrdenes = ({
    visible,
    filtros,
    estados = [],
    onChange,
    onLimpiar,
    onCerrar,
}) => {
    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-950/55 p-3 md:p-6 flex items-center justify-center">
            <div className="w-full max-w-xl max-h-[92vh] rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col">
                <header className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-black text-slate-800">
                            Filtros de órdenes
                        </h2>
                        <p className="text-sm text-slate-500">
                            Ajusta el estado y el rango de fechas.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onCerrar}
                        className="h-9 w-9 rounded-xl border border-slate-300 flex items-center justify-center hover:bg-slate-50"
                        aria-label="Cerrar filtros"
                    >
                        <IoClose />
                    </button>
                </header>

                <div className="p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="md:col-span-2 flex flex-col gap-1.5 text-sm font-bold text-slate-700">
                        Estado
                        <select
                            value={filtros.estadoProceso}
                            onChange={(event) =>
                                onChange(
                                    "estadoProceso",
                                    event.target.value
                                )
                            }
                            className="h-11 rounded-xl border border-slate-300 bg-white px-3 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="">Todos los estados</option>
                            {estados.map((estado) => {
                                const valor =
                                    typeof estado === "string"
                                        ? estado
                                        : estado?.valor ||
                                          estado?.codigo ||
                                          estado?.estado ||
                                          "";
                                const nombre =
                                    typeof estado === "string"
                                        ? textoEstadoOrden(estado)
                                        : estado?.nombre ||
                                          estado?.texto ||
                                          textoEstadoOrden(valor);

                                return valor ? (
                                    <option key={valor} value={valor}>
                                        {nombre}
                                    </option>
                                ) : null;
                            })}
                        </select>
                    </label>

                    <label className="flex flex-col gap-1.5 text-sm font-bold text-slate-700">
                        Desde
                        <input
                            type="date"
                            value={filtros.fechaDesde}
                            onChange={(event) =>
                                onChange("fechaDesde", event.target.value)
                            }
                            className="h-11 rounded-xl border border-slate-300 px-3 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                        />
                    </label>

                    <label className="flex flex-col gap-1.5 text-sm font-bold text-slate-700">
                        Hasta
                        <input
                            type="date"
                            value={filtros.fechaHasta}
                            onChange={(event) =>
                                onChange("fechaHasta", event.target.value)
                            }
                            className="h-11 rounded-xl border border-slate-300 px-3 font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                        />
                    </label>
                </div>

                <footer className="px-5 py-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                    <button
                        type="button"
                        onClick={onLimpiar}
                        className="h-11 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50"
                    >
                        Limpiar
                    </button>
                    <button
                        type="button"
                        onClick={onCerrar}
                        className="h-11 px-4 rounded-xl bg-blue-800 text-white font-bold hover:bg-blue-900"
                    >
                        Aplicar filtros
                    </button>
                </footer>
            </div>
        </div>
    );
};

export const ModalConfirmacionOrden = ({
    visible,
    titulo,
    descripcion,
    textoConfirmar = "Confirmar",
    procesando = false,
    onConfirmar,
    onCerrar,
}) => {
    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-[110] bg-slate-950/55 p-3 flex items-center justify-center">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
                <div className="p-5">
                    <h2 className="text-lg font-black text-slate-800">
                        {titulo}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                        {descripcion}
                    </p>
                </div>
                <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCerrar}
                        disabled={procesando}
                        className="h-11 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-60"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onConfirmar}
                        disabled={procesando}
                        className="h-11 px-4 rounded-xl bg-blue-800 text-white font-bold hover:bg-blue-900 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {procesando ? "Procesando..." : textoConfirmar}
                    </button>
                </div>
            </div>
        </div>
    );
};
