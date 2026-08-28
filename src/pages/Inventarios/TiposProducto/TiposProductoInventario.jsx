import React, { useEffect, useMemo, useState } from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaPlus,
    FaSearch,
    FaEdit,
    FaLayerGroup,
    FaSnowflake,
    FaCalendarAlt,
    FaBoxes,
    FaCheckCircle,
} from "react-icons/fa";
import { toast } from "react-toastify";

const API_BASE_TIPOS_PRODUCTO =
    "https://app.accionporcolombia.com/servicesPae/Inventario/TiposProducto/";

export const TiposProductoInventario = ({ setSidebar, navegar }) => {
    const abrirMenu = () => setSidebar(true);
    const estadoPagina = (pagina) => navegar(pagina);

    const [cargando, setCargando] = useState(false);
    const [tiposProducto, setTiposProducto] = useState([]);
    const [busqueda, setBusqueda] = useState("");

    const cargarTiposProducto = async () => {
        try {
            setCargando(true);

            const res = await fetch(
                `${API_BASE_TIPOS_PRODUCTO}InventarioTiposProductoListar.php`,
                { cache: "no-store" }
            );

            const json = await res.json();

            if (!json.rpta) {
                toast.error(json.mensaje || "No se pudieron cargar los tipos de producto");
                return;
            }

            setTiposProducto(Array.isArray(json.data) ? json.data : []);
        } catch (error) {
            console.error(error);
            toast.error("Error al consultar los tipos de producto");
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarTiposProducto();
    }, []);

    const tiposFiltrados = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();

        if (!texto) return tiposProducto;

        return tiposProducto.filter((item) => {
            const codigo = String(item.codigo || "").toLowerCase();
            const nombre = String(item.nombre || "").toLowerCase();
            const descripcion = String(item.descripcion || "").toLowerCase();

            return (
                codigo.includes(texto) ||
                nombre.includes(texto) ||
                descripcion.includes(texto)
            );
        });
    }, [tiposProducto, busqueda]);

    const totalActivos = tiposProducto.filter(
        (item) => Number(item.estado) === 1
    ).length;

    const totalLote = tiposProducto.filter(
        (item) => Number(item.manejaLote) === 1
    ).length;

    const totalFrio = tiposProducto.filter(
        (item) => Number(item.requiereBodegaFria) === 1
    ).length;

    return (
        <div className="w-full h-screen flex flex-col p-6 gap-6 bg-slate-100">
            <div className="flex items-center gap-5 lg:hidden">
                <div
                    className="p-2 rounded-lg hover:bg-gray-300 cursor-pointer"
                    onClick={abrirMenu}
                >
                    <IoMenu className="text-2xl" />
                </div>

                <h1 className="text-lg font-bold">Tipos de producto</h1>
            </div>

            <article className="flex-1 bg-white shadow-lg rounded-2xl flex flex-col overflow-hidden border border-slate-200">
                <nav className="w-full px-6 py-5 border-b border-slate-200 bg-white">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-blue-800 text-white flex items-center justify-center shadow-sm">
                                <FaLayerGroup className="text-xl" />
                            </div>

                            <div>
                                <h1 className="text-[calc(0.9rem+0.7vw)] font-bold text-slate-800">
                                    Tipos de producto
                                </h1>

                                <p className="text-sm text-slate-500">
                                    Configura las reglas base para productos con lote,
                                    vencimiento, fecha obligatoria o bodega fría.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => estadoPagina("CrearTipoProductoInventario")}
                            className="px-5 py-2.5 bg-blue-800 text-white rounded-xl hover:bg-blue-900 flex items-center justify-center gap-2 transition-all duration-300 shadow-sm font-semibold"
                        >
                            <FaPlus />
                            Nuevo tipo de producto
                        </button>
                    </div>
                </nav>

                <section className="p-6 bg-slate-50 border-b border-slate-200">
                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_210px_210px_210px] gap-4">
                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
                            <div className="relative">
                                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                                <input
                                    type="text"
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                    className="w-full h-12 rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-800"
                                    placeholder="Buscar por código, nombre o descripción..."
                                />
                            </div>
                        </div>

                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                                <FaCheckCircle />
                            </div>

                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase">
                                    Activos
                                </p>
                                <p className="text-lg font-black text-slate-800">
                                    {totalActivos}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
                                <FaBoxes />
                            </div>

                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase">
                                    Manejan lote
                                </p>
                                <p className="text-lg font-black text-slate-800">
                                    {totalLote}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
                                <FaSnowflake />
                            </div>

                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase">
                                    Bodega fría
                                </p>
                                <p className="text-lg font-black text-slate-800">
                                    {totalFrio}
                                </p>
                            </div>
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
                                            Tipo de producto
                                        </th>
                                        <th className="px-5 py-4 text-center font-bold text-slate-700">
                                            Lote
                                        </th>
                                        <th className="px-5 py-4 text-center font-bold text-slate-700">
                                            Vencimiento
                                        </th>
                                        <th className="px-5 py-4 text-center font-bold text-slate-700">
                                            Fecha venc.
                                        </th>
                                        <th className="px-5 py-4 text-center font-bold text-slate-700">
                                            Bodega fría
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
                                                colSpan="8"
                                                className="px-5 py-10 text-center text-slate-500"
                                            >
                                                Cargando tipos de producto...
                                            </td>
                                        </tr>
                                    ) : tiposFiltrados.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan="8"
                                                className="px-5 py-10 text-center text-slate-500"
                                            >
                                                No hay tipos de producto registrados.
                                            </td>
                                        </tr>
                                    ) : (
                                        tiposFiltrados.map((item) => {
                                            const activo = Number(item.estado) === 1;
                                            const manejaLote = Number(item.manejaLote) === 1;
                                            const manejaVencimiento =
                                                Number(item.manejaVencimiento) === 1;
                                            const requiereFechaVencimiento =
                                                Number(item.requiereFechaVencimiento) === 1;
                                            const requiereBodegaFria =
                                                Number(item.requiereBodegaFria) === 1;

                                            return (
                                                <tr
                                                    key={item.id}
                                                    className="hover:bg-blue-50/40 transition-colors"
                                                >
                                                    <td className="px-5 py-4 font-bold text-slate-800 align-middle">
                                                        {item.codigo || "—"}
                                                    </td>

                                                    <td className="px-5 py-4 align-middle">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center shrink-0">
                                                                <FaLayerGroup />
                                                            </div>

                                                            <div className="min-w-0">
                                                                <p className="font-semibold text-slate-700 break-words">
                                                                    {item.nombre || "Sin nombre"}
                                                                </p>

                                                                <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                                                                    {item.descripcion || "Sin descripción"}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-4 text-center align-middle">
                                                        <span
                                                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold border ${manejaLote
                                                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                                                    : "bg-slate-50 text-slate-500 border-slate-200"
                                                                }`}
                                                        >
                                                            {manejaLote ? "SÍ" : "NO"}
                                                        </span>
                                                    </td>

                                                    <td className="px-5 py-4 text-center align-middle">
                                                        <span
                                                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold border ${manejaVencimiento
                                                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                                                    : "bg-slate-50 text-slate-500 border-slate-200"
                                                                }`}
                                                        >
                                                            {manejaVencimiento ? "SÍ" : "NO"}
                                                        </span>
                                                    </td>

                                                    <td className="px-5 py-4 text-center align-middle">
                                                        <span
                                                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold border ${requiereFechaVencimiento
                                                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                                                    : "bg-slate-50 text-slate-500 border-slate-200"
                                                                }`}
                                                        >
                                                            <FaCalendarAlt />
                                                            {requiereFechaVencimiento ? "SÍ" : "NO"}
                                                        </span>
                                                    </td>

                                                    <td className="px-5 py-4 text-center align-middle">
                                                        <span
                                                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold border ${requiereBodegaFria
                                                                    ? "bg-sky-50 text-sky-700 border-sky-200"
                                                                    : "bg-slate-50 text-slate-500 border-slate-200"
                                                                }`}
                                                        >
                                                            <FaSnowflake />
                                                            {requiereBodegaFria ? "SÍ" : "NO"}
                                                        </span>
                                                    </td>

                                                    <td className="px-5 py-4 text-center align-middle">
                                                        <span
                                                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold border ${activo
                                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                    : "bg-red-50 text-red-700 border-red-200"
                                                                }`}
                                                        >
                                                            {activo ? "ACTIVO" : "INACTIVO"}
                                                        </span>
                                                    </td>

                                                    <td className="px-5 py-4 align-middle">
                                                        <div className="flex items-center justify-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    localStorage.setItem(
                                                                        "tipoProductoInventarioEditar",
                                                                        JSON.stringify(item)
                                                                    );

                                                                    estadoPagina("EditarTipoProductoInventario");
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