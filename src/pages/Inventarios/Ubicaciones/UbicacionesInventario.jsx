import React, { useEffect, useMemo, useState } from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaPlus,
    FaSearch,
    FaEdit,
    FaMapMarkerAlt,
    FaWarehouse,
} from "react-icons/fa";
import { toast } from "react-toastify";

const API_BASE_INVENTARIO =
    "https://app.accionporcolombia.com/servicesPae/Inventario/";

export const UbicacionesInventario = ({ setSidebar, navegar }) => {
    const abrirMenu = () => setSidebar(true);
    const estadoPagina = (pagina, data = null) => navegar(pagina, data);

    const [cargando, setCargando] = useState(false);
    const [ubicaciones, setUbicaciones] = useState([]);
    const [busqueda, setBusqueda] = useState("");

    const cargarUbicaciones = async () => {
        try {
            setCargando(true);

            const res = await fetch(
                `${API_BASE_INVENTARIO}InventarioUbicacionesListar.php`,
                { cache: "no-store" }
            );

            const json = await res.json();

            if (!json.rpta) {
                toast.error(json.mensaje || "No se pudieron cargar las ubicaciones");
                return;
            }

            setUbicaciones(Array.isArray(json.data) ? json.data : []);
        } catch (error) {
            console.error(error);
            toast.error("Error al consultar las ubicaciones");
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarUbicaciones();
    }, []);

    const ubicacionesFiltradas = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();

        if (!texto) return ubicaciones;

        return ubicaciones.filter((item) => {
            const codigo = String(item.codigo || "").toLowerCase();
            const nombre = String(item.nombre || "").toLowerCase();
            const descripcion = String(item.descripcion || "").toLowerCase();
            const bodega = String(
                item.bodega || item.nombreBodega || item.bodegaNombre || ""
            ).toLowerCase();

            return (
                codigo.includes(texto) ||
                nombre.includes(texto) ||
                descripcion.includes(texto) ||
                bodega.includes(texto)
            );
        });
    }, [ubicaciones, busqueda]);

    return (
        <div className="w-full h-screen flex flex-col p-6 gap-6 bg-slate-100">
            <div className="flex items-center gap-5 lg:hidden">
                <div
                    className="p-2 rounded-lg hover:bg-gray-300 cursor-pointer"
                    onClick={abrirMenu}
                >
                    <IoMenu className="text-2xl" />
                </div>

                <h1 className="text-lg font-bold">Ubicaciones</h1>
            </div>

            <article className="flex-1 bg-white shadow-lg rounded-2xl flex flex-col overflow-hidden border border-slate-200">
                <nav className="w-full px-6 py-5 border-b border-slate-200 bg-white">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-blue-800 text-white flex items-center justify-center shadow-sm">
                                <FaMapMarkerAlt className="text-xl" />
                            </div>

                            <div>
                                <h1 className="text-[calc(0.9rem+0.7vw)] font-bold text-slate-800">
                                    Ubicaciones de inventario
                                </h1>

                                <p className="text-sm text-slate-500">
                                    Administra las ubicaciones asociadas a las bodegas logísticas.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => estadoPagina("CrearUbicacionInventario")}
                            className="px-5 py-2.5 bg-blue-800 text-white rounded-xl hover:bg-blue-900 flex items-center justify-center gap-2 transition-all duration-300 shadow-sm font-semibold"
                        >
                            <FaPlus />
                            Nueva ubicación
                        </button>
                    </div>
                </nav>

                <section className="p-6 bg-slate-50 border-b border-slate-200">
                    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
                        <div className="relative">
                            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                            <input
                                type="text"
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                className="w-full h-12 rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-800"
                                placeholder="Buscar por código, nombre, bodega o descripción..."
                            />
                        </div>
                    </div>
                </section>

                <section className="flex-1 overflow-auto bg-slate-50 p-6">
                    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-100 border-b border-slate-200">
                                    <tr>
                                        <th className="px-5 py-4 text-left font-bold text-slate-700">
                                            Código
                                        </th>
                                        <th className="px-5 py-4 text-left font-bold text-slate-700">
                                            Ubicación
                                        </th>
                                        <th className="px-5 py-4 text-left font-bold text-slate-700">
                                            Bodega
                                        </th>
                                        <th className="px-5 py-4 text-left font-bold text-slate-700">
                                            Descripción
                                        </th>
                                        <th className="px-5 py-4 text-center font-bold text-slate-700">
                                            Estado
                                        </th>
                                        <th className="px-5 py-4 text-center font-bold text-slate-700">
                                            Acciones
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100">
                                    {cargando ? (
                                        <tr>
                                            <td
                                                colSpan="6"
                                                className="px-5 py-10 text-center text-slate-500"
                                            >
                                                Cargando ubicaciones...
                                            </td>
                                        </tr>
                                    ) : ubicacionesFiltradas.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan="6"
                                                className="px-5 py-10 text-center text-slate-500"
                                            >
                                                No hay ubicaciones registradas.
                                            </td>
                                        </tr>
                                    ) : (
                                        ubicacionesFiltradas.map((item) => {
                                            const activa = Number(item.estado) === 1;

                                            return (
                                                <tr
                                                    key={item.id}
                                                    className="hover:bg-blue-50/40 transition-colors "
                                                >
                                                    <td className="px-5 py-4 font-bold text-slate-800">
                                                        {item.codigo || "—"}
                                                    </td>

                                                    <td className="px-5 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
                                                                |                                          <FaMapMarkerAlt />
                                                            </div>

                                                            <span className="font-semibold text-slate-700">
                                                                {item.nombre || "Sin nombre"}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-4 text-slate-600">
                                                        <div className="flex items-center gap-2">
                                                            <FaWarehouse className="text-slate-400" />
                                                            <span>
                                                                {item.bodega ||
                                                                    item.nombreBodega ||
                                                                    item.bodegaNombre ||
                                                                    "—"}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-4 text-slate-500 max-w-[360px]">
                                                        <span className="line-clamp-2">
                                                            {item.descripcion || "Sin descripción"}
                                                        </span>
                                                    </td>

                                                    <td className="px-5 py-4 text-center">
                                                        <span
                                                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold border ${activa
                                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                : "bg-red-50 text-red-700 border-red-200"
                                                                }`}
                                                        >
                                                            {activa ? "ACTIVA" : "INACTIVA"}
                                                        </span>
                                                    </td>

                                                    <td className="px-5 py-4 align-middle">
                                                        <div className="flex items-center justify-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    localStorage.setItem(
                                                                        "ubicacionInventarioEditar",
                                                                        JSON.stringify(item)
                                                                    );

                                                                    estadoPagina("EditarUbicacionInventario");
                                                                }}
                                                                className="h-10 min-w-[104px] inline-flex items-center justify-center gap-2 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
                                                            >
                                                                <FaEdit />
                                                                Editar
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            </article>
        </div>
    );
};