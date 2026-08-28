import React, { useEffect, useMemo, useState } from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaPlus,
    FaPen,
    FaPowerOff,
    FaRotate,
    FaWarehouse,
    FaMagnifyingGlass,
} from "react-icons/fa6";
import { toast } from "react-toastify";

const API_BASE_INVENTARIO =
    "https://app.accionporcolombia.com/servicesPae/Inventario/";

export const BodegasInventario = ({ setSidebar, navegar }) => {
    const abrirMenu = () => setSidebar(true);
    const estadoPagina = (pagina) => navegar(pagina);

    const [bodegas, setBodegas] = useState([]);
    const [q, setQ] = useState("");
    const [estado, setEstado] = useState("");
    const [cargando, setCargando] = useState(false);
    const [procesando, setProcesando] = useState(false);

    const totalActivas = useMemo(
        () => bodegas.filter((item) => Number(item.estado) === 1).length,
        [bodegas]
    );

    const totalInactivas = useMemo(
        () => bodegas.filter((item) => Number(item.estado) === 0).length,
        [bodegas]
    );

    const cargarBodegas = async () => {
        try {
            setCargando(true);

            const params = new URLSearchParams();

            if (q.trim()) params.append("q", q.trim());
            if (estado !== "") params.append("estado", estado);

            const url = `${API_BASE_INVENTARIO}InventarioBodegasListar.php${params.toString() ? `?${params.toString()}` : ""
                }`;

            const res = await fetch(url, {
                method: "GET",
                cache: "no-store",
            });

            const response = await res.json();

            if (!response.rpta) {
                toast.error(response.mensaje || "No se pudieron consultar las bodegas");
                setBodegas([]);
                return;
            }

            setBodegas(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            console.error(error);
            toast.error("Ocurrió un error al consultar las bodegas");
            setBodegas([]);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarBodegas();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const buscar = (e) => {
        e.preventDefault();
        cargarBodegas();
    };

    const limpiarFiltros = () => {
        setQ("");
        setEstado("");

        setTimeout(() => {
            cargarBodegas();
        }, 100);
    };

    const crearBodega = () => {
        estadoPagina("CrearBodegaInventario");
    };

    const editarBodega = (bodega) => {
        localStorage.setItem("idBodegaInventario", String(bodega.id));
        estadoPagina("EditarBodegaInventario");
    };

    const cambiarEstado = async (bodega) => {
        const nuevoEstado = Number(bodega.estado) === 1 ? 0 : 1;
        const accion = nuevoEstado === 1 ? "activar" : "inactivar";

        const confirmar = window.confirm(
            `¿Seguro que deseas ${accion} la bodega "${bodega.nombre}"?`
        );

        if (!confirmar) return;

        try {
            setProcesando(true);

            const res = await fetch(
                `${API_BASE_INVENTARIO}InventarioBodegasCambiarEstado.php`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json; charset=utf-8",
                    },
                    body: JSON.stringify({
                        id: Number(bodega.id),
                        estado: nuevoEstado,
                    }),
                }
            );

            const response = await res.json();

            if (!response.rpta) {
                toast.error(response.mensaje || "No se pudo cambiar el estado");
                return;
            }

            toast.success(response.mensaje || "Estado actualizado correctamente");
            cargarBodegas();
        } catch (error) {
            console.error(error);
            toast.error("Ocurrió un error al cambiar el estado");
        } finally {
            setProcesando(false);
        }
    };

    const renderEstado = (estadoBodega) => {
        const activo = Number(estadoBodega) === 1;

        return (
            <span
                className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-bold ${activo
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}
            >
                {activo ? "Activo" : "Inactivo"}
            </span>
        );
    };

    return (
        <div className="w-full h-screen flex flex-col p-6 gap-6">
            <div className="flex items-center gap-5 lg:hidden">
                <div
                    className="p-2 rounded-lg hover:bg-gray-300 cursor-pointer"
                    onClick={abrirMenu}
                >
                    <IoMenu className="text-2xl" />
                </div>

                <h1 className="text-lg font-bold">Bodegas</h1>
            </div>

            <article className="flex-1 bg-white shadow-lg rounded-lg p-6 flex flex-col overflow-hidden">
                <nav className="w-full flex flex-col gap-4 mb-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
                                <FaWarehouse className="text-xl" />
                            </div>

                            <div>
                                <h1 className="text-[calc(0.8rem+0.7vw)] font-bold text-slate-800">
                                    Bodegas
                                </h1>
                                <p className="text-sm text-slate-500">
                                    Administración de bodegas principales del inventario
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={crearBodega}
                            className="px-4 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-900 flex items-center justify-center gap-2 transition-all duration-300"
                        >
                            <FaPlus />
                            <span>Nueva bodega</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                                Total bodegas
                            </p>
                            <p className="text-lg font-bold text-slate-800 mt-1">
                                {bodegas.length}
                            </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                                Activas
                            </p>
                            <p className="text-lg font-bold text-emerald-700 mt-1">
                                {totalActivas}
                            </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                                Inactivas
                            </p>
                            <p className="text-lg font-bold text-red-700 mt-1">
                                {totalInactivas}
                            </p>
                        </div>
                    </div>

                    <form
                        onSubmit={buscar}
                        className="border border-slate-200 rounded-2xl bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm"
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                            <div className="lg:col-span-6 flex flex-col gap-1.5">
                                <label className="text-sm font-semibold text-slate-700">
                                    Buscar
                                </label>
                                <div className="relative">
                                    <FaMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
                                    <input
                                        type="text"
                                        value={q}
                                        onChange={(e) => setQ(e.target.value)}
                                        placeholder="Código, nombre o descripción..."
                                        className="h-11 w-full border border-slate-300 bg-white rounded-xl pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                    />
                                </div>
                            </div>

                            <div className="lg:col-span-3 flex flex-col gap-1.5">
                                <label className="text-sm font-semibold text-slate-700">
                                    Estado
                                </label>
                                <select
                                    value={estado}
                                    onChange={(e) => setEstado(e.target.value)}
                                    className="h-11 border border-slate-300 bg-white rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                >
                                    <option value="">Todos</option>
                                    <option value="1">Activos</option>
                                    <option value="0">Inactivos</option>
                                </select>
                            </div>

                            <div className="lg:col-span-3 flex items-end gap-2">
                                <button
                                    type="submit"
                                    disabled={cargando}
                                    className="h-11 flex-1 bg-blue-800 text-white rounded-xl hover:bg-blue-900 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                                >
                                    <FaMagnifyingGlass />
                                    <span>Buscar</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={limpiarFiltros}
                                    disabled={cargando}
                                    className="h-11 px-4 border border-slate-300 bg-white rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-60"
                                    title="Limpiar filtros"
                                >
                                    <FaRotate className={cargando ? "animate-spin" : ""} />
                                </button>
                            </div>
                        </div>
                    </form>
                </nav>

                <section className="flex-1 overflow-hidden border border-slate-200 rounded-2xl">
                    <div className="h-full overflow-auto">
                        <table className="w-full min-w-[850px] text-sm">
                            <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200">
                                <tr>
                                    <th className="text-left px-4 py-3 font-bold text-slate-600">
                                        Código
                                    </th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-600">
                                        Nombre
                                    </th>
                                    <th className="text-left px-4 py-3 font-bold text-slate-600">
                                        Descripción
                                    </th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-600">
                                        Estado
                                    </th>
                                    <th className="text-center px-4 py-3 font-bold text-slate-600">
                                        Acciones
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100">
                                {cargando ? (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-4 py-10 text-center text-slate-500"
                                        >
                                            Consultando bodegas...
                                        </td>
                                    </tr>
                                ) : bodegas.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-4 py-10 text-center text-slate-500"
                                        >
                                            No hay bodegas registradas.
                                        </td>
                                    </tr>
                                ) : (
                                    bodegas.map((bodega) => (
                                        <tr
                                            key={bodega.id}
                                            className="hover:bg-slate-50 transition-colors"
                                        >
                                            <td className="px-4 py-3 font-bold text-slate-800">
                                                {bodega.codigo}
                                            </td>

                                            <td className="px-4 py-3 text-slate-700">
                                                {bodega.nombre}
                                            </td>

                                            <td className="px-4 py-3 text-slate-500">
                                                {bodega.descripcion || "—"}
                                            </td>

                                            <td className="px-4 py-3 text-center">
                                                {renderEstado(bodega.estado)}
                                            </td>

                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => editarBodega(bodega)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors text-xs font-bold"
                                                    >
                                                        <FaPen />
                                                        Editar
                                                    </button>

                                                    <button
                                                        type="button"
                                                        disabled={procesando}
                                                        onClick={() => cambiarEstado(bodega)}
                                                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors text-xs font-bold disabled:opacity-60 ${Number(bodega.estado) === 1
                                                                ? "bg-red-50 text-red-700 hover:bg-red-100"
                                                                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                                            }`}
                                                    >
                                                        <FaPowerOff />
                                                        {Number(bodega.estado) === 1
                                                            ? "Inactivar"
                                                            : "Activar"}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </article>
        </div>
    );
};