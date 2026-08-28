import React, { useEffect, useMemo, useState } from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaPlus,
    FaSearch,
    FaEdit,
    FaBarcode,
    FaBoxOpen,
    FaLayerGroup,
    FaToggleOn,
    FaToggleOff,
    FaStar,
    FaRegStar,
    FaBoxes,
    FaWarehouse,
} from "react-icons/fa";
import { toast } from "react-toastify";

const API_BASE_CODIGOS =
    "https://app.accionporcolombia.com/servicesPae/Inventario/CodigosBarras/";

export const CodigosBarrasInventario = ({ setSidebar, navegar }) => {
    const abrirMenu = () => setSidebar(true);
    const estadoPagina = (pagina) => navegar(pagina);

    const [cargando, setCargando] = useState(false);
    const [cambiandoEstado, setCambiandoEstado] = useState(false);
    const [codigos, setCodigos] = useState([]);
    const [busqueda, setBusqueda] = useState("");

    const cargarCodigos = async () => {
        try {
            setCargando(true);

            const res = await fetch(
                `${API_BASE_CODIGOS}InventarioCodigosBarrasListar.php`,
                { cache: "no-store" }
            );

            const json = await res.json();

            if (!json.rpta) {
                toast.error(json.mensaje || "No se pudieron cargar los códigos de barras");
                return;
            }

            setCodigos(Array.isArray(json.data) ? json.data : []);
        } catch (error) {
            console.error(error);
            toast.error("Error al consultar los códigos de barras");
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarCodigos();
    }, []);

    const codigosFiltrados = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();

        if (!texto) return codigos;

        return codigos.filter((item) => {
            const codigoBarras = String(item.codigoBarras || "").toLowerCase();
            const tipoCodigo = String(item.tipoCodigo || "").toLowerCase();
            const codigoProducto = String(item.codigoProducto || "").toLowerCase();
            const nombreProducto = String(item.nombreProducto || "").toLowerCase();
            const grupo = String(item.codigoGrupo || "").toLowerCase();
            const categoria = String(item.categoriaProducto || "").toLowerCase();
            const tipoProducto = String(item.tipoProductoInventario || "").toLowerCase();
            const observacion = String(item.observacion || "").toLowerCase();

            return (
                codigoBarras.includes(texto) ||
                tipoCodigo.includes(texto) ||
                codigoProducto.includes(texto) ||
                nombreProducto.includes(texto) ||
                grupo.includes(texto) ||
                categoria.includes(texto) ||
                tipoProducto.includes(texto) ||
                observacion.includes(texto)
            );
        });
    }, [codigos, busqueda]);

    const cambiarEstadoCodigo = async (item) => {
        const activo = Number(item.estado) === 1;
        const nuevoEstado = activo ? 0 : 1;

        const confirmar = window.confirm(
            `¿Seguro que deseas ${nuevoEstado === 1 ? "activar" : "inactivar"} este código de barras?`
        );

        if (!confirmar) return;

        try {
            setCambiandoEstado(true);

            const res = await fetch(
                `${API_BASE_CODIGOS}InventarioCodigosBarrasCambiarEstado.php`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json; charset=utf-8",
                    },
                    body: JSON.stringify({
                        id: Number(item.id),
                        estado: nuevoEstado,
                    }),
                }
            );

            const json = await res.json();

            if (!json.rpta) {
                toast.error(json.mensaje || "No se pudo cambiar el estado");
                return;
            }

            toast.success(json.mensaje || "Estado actualizado correctamente");
            cargarCodigos();
        } catch (error) {
            console.error(error);
            toast.error("Error al cambiar el estado del código de barras");
        } finally {
            setCambiandoEstado(false);
        }
    };

    const totalActivos = codigos.filter((item) => Number(item.estado) === 1).length;
    const totalPrincipales = codigos.filter((item) => Number(item.principal) === 1).length;
    const totalProductos = new Set(codigos.map((item) => Number(item.idProducto))).size;

    return (
        <div className="w-full h-screen flex flex-col p-6 gap-6 bg-slate-100">
            <div className="flex items-center gap-5 lg:hidden">
                <div
                    className="p-2 rounded-lg hover:bg-gray-300 cursor-pointer"
                    onClick={abrirMenu}
                >
                    <IoMenu className="text-2xl" />
                </div>

                <h1 className="text-lg font-bold">Códigos de barras</h1>
            </div>

            <article className="flex-1 bg-white shadow-lg rounded-2xl flex flex-col overflow-hidden border border-slate-200">
                <nav className="w-full px-6 py-5 border-b border-slate-200 bg-white">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-blue-800 text-white flex items-center justify-center shadow-sm">
                                <FaBarcode className="text-xl" />
                            </div>

                            <div>
                                <h1 className="text-[calc(0.9rem+0.7vw)] font-bold text-slate-800">
                                    Códigos de barras
                                </h1>

                                <p className="text-sm text-slate-500">
                                    Administra códigos por producto, tipo de código y código principal.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => estadoPagina("CrearCodigoBarrasInventario")}
                            className="px-5 py-2.5 bg-blue-800 text-white rounded-xl hover:bg-blue-900 flex items-center justify-center gap-2 transition-all duration-300 shadow-sm font-semibold"
                        >
                            <FaPlus />
                            Nuevo código
                        </button>
                    </div>
                </nav>

                <section className="p-6 bg-slate-50 border-b border-slate-200">
                    <div className="grid grid-cols-1 xl:grid-cols-[1fr_220px_220px_220px] gap-4">
                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4">
                            <div className="relative">
                                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                                <input
                                    type="text"
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                    className="w-full h-12 rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-800"
                                    placeholder="Buscar por código, producto, tipo, grupo o categoría..."
                                />
                            </div>
                        </div>

                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
                                <FaBarcode />
                            </div>

                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase">
                                    Códigos
                                </p>
                                <p className="text-lg font-black text-slate-800">
                                    {codigos.length}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                                <FaWarehouse />
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
                            <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                                <FaStar />
                            </div>

                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase">
                                    Principales
                                </p>
                                <p className="text-lg font-black text-slate-800">
                                    {totalPrincipales}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                            <FaBoxOpen />
                        </div>

                        <div>
                            <p className="text-xs text-slate-400 font-bold uppercase">
                                Productos vinculados
                            </p>
                            <p className="text-sm font-semibold text-slate-700">
                                {totalProductos} productos tienen al menos un código de barras registrado.
                            </p>
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
                                            Código de barras
                                        </th>
                                        <th className="px-5 py-4 text-left font-bold text-slate-700">
                                            Producto
                                        </th>
                                        <th className="px-5 py-4 text-left font-bold text-slate-700">
                                            Clasificación
                                        </th>
                                        <th className="px-5 py-4 text-center font-bold text-slate-700">
                                            Tipo código
                                        </th>
                                        <th className="px-5 py-4 text-center font-bold text-slate-700">
                                            Principal
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
                                                colSpan="7"
                                                className="px-5 py-10 text-center text-slate-500"
                                            >
                                                Cargando códigos de barras...
                                            </td>
                                        </tr>
                                    ) : codigosFiltrados.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan="7"
                                                className="px-5 py-10 text-center text-slate-500"
                                            >
                                                No hay códigos de barras registrados.
                                            </td>
                                        </tr>
                                    ) : (
                                        codigosFiltrados.map((item) => {
                                            const activo = Number(item.estado) === 1;
                                            const principal = Number(item.principal) === 1;

                                            return (
                                                <tr
                                                    key={item.id}
                                                    className="hover:bg-blue-50/40 transition-colors"
                                                >
                                                    <td className="px-5 py-4 align-middle">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center shrink-0">
                                                                <FaBarcode />
                                                            </div>

                                                            <div className="min-w-[190px]">
                                                                <p className="font-bold text-slate-800 break-words">
                                                                    {item.codigoBarras || "Sin código"}
                                                                </p>


                                                                {item.observacion && (
                                                                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                                                                        {item.observacion}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-4 align-middle">
                                                        <div className="min-w-[230px]">
                                                            <p className="font-bold text-slate-800 break-words">
                                                                {item.nombreProducto || "Sin producto"}
                                                            </p>

                                                            <p className="text-xs text-slate-400 font-semibold mt-0.5">
                                                                Código producto: {item.codigoProducto || "—"}
                                                            </p>

                                                            {item.embalajeNombre && (
                                                                <p className="text-xs text-slate-400 mt-0.5">
                                                                    Embalaje: {item.embalajeNombre}
                                                                    {item.uniCaja ? ` / ${item.uniCaja} und.` : ""}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-4 align-middle">
                                                        <div className="min-w-[180px]">
                                                            <p className="font-semibold text-slate-700">
                                                                {item.codigoGrupo || "Sin grupo"}
                                                            </p>

                                                            <p className="text-xs text-slate-400 mt-0.5">
                                                                {item.categoriaProducto || "Sin categoría"}
                                                            </p>

                                                            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                                                                <FaLayerGroup />
                                                                {item.tipoProductoInventario || "Sin tipo inventario"}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-4 text-center align-middle">
                                                        <span className="inline-flex rounded-full px-3 py-1 text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
                                                            {item.tipoCodigo || "UNIDAD"}
                                                        </span>
                                                    </td>

                                                    <td className="px-5 py-4 text-center align-middle">
                                                        <span
                                                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold border ${principal
                                                                ? "bg-amber-50 text-amber-700 border-amber-200"
                                                                : "bg-slate-50 text-slate-500 border-slate-200"
                                                                }`}
                                                        >
                                                            {principal ? <FaStar /> : <FaRegStar />}
                                                            {principal ? "SÍ" : "NO"}
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
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    localStorage.setItem(
                                                                        "codigoBarrasInventarioEditar",
                                                                        JSON.stringify(item)
                                                                    );

                                                                    estadoPagina("EditarCodigoBarrasInventario");
                                                                }}
                                                                className="h-10 min-w-[104px] inline-flex items-center justify-center gap-2 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
                                                            >
                                                                <FaEdit />
                                                                Editar
                                                            </button>

                                                            <button
                                                                type="button"
                                                                disabled={cambiandoEstado}
                                                                onClick={() => cambiarEstadoCodigo(item)}
                                                                className={`h-10 min-w-[116px] inline-flex items-center justify-center gap-2 px-4 rounded-xl border font-semibold disabled:opacity-60 disabled:cursor-not-allowed ${activo
                                                                    ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                                                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                                                    }`}
                                                            >
                                                                {activo ? <FaToggleOff /> : <FaToggleOn />}
                                                                {activo ? "Inactivar" : "Activar"}
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