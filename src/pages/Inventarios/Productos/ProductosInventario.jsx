import React, { useEffect, useMemo, useState } from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaPlus,
    FaSearch,
    FaEdit,
    FaBoxOpen,
    FaBoxes,
    FaLayerGroup,
    FaWarehouse,
    FaToggleOn,
    FaToggleOff,
    FaExclamationTriangle,
    FaBarcode,
} from "react-icons/fa";
import { toast } from "react-toastify";

const API_BASE_PRODUCTOS =
    "https://app.accionporcolombia.com/servicesPae/Inventario/Productos/";

export const ProductosInventario = ({ setSidebar, navegar }) => {
    const abrirMenu = () => setSidebar(true);
    const estadoPagina = (pagina) => navegar(pagina);

    const [cargando, setCargando] = useState(false);
    const [cambiandoEstado, setCambiandoEstado] = useState(false);
    const [productos, setProductos] = useState([]);
    const [busqueda, setBusqueda] = useState("");

    const cargarProductos = async () => {
        try {
            setCargando(true);

            const res = await fetch(
                `${API_BASE_PRODUCTOS}InventarioProductosListar.php`,
                { cache: "no-store" }
            );

            const json = await res.json();

            if (!json.rpta) {
                toast.error(json.mensaje || "No se pudieron cargar los productos");
                return;
            }

            setProductos(Array.isArray(json.data) ? json.data : []);
        } catch (error) {
            console.error(error);
            toast.error("Error al consultar los productos");
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarProductos();
    }, []);

    const productosFiltrados = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();

        if (!texto) return productos;

        return productos.filter((item) => {
            const codigo = String(item.codigo || "").toLowerCase();
            const nombre = String(item.nombreProducto || "").toLowerCase();
            const categoria = String(item.categoriaProducto || "").toLowerCase();
            const grupo = String(item.codigoGrupo || "").toLowerCase();
            const tipo = String(item.tipoProductoInventario || "").toLowerCase();
            const unidad = String(item.unidadBaseInventario || "").toLowerCase();
            const observacionProducto = String(
                item.observacionProducto || ""
            ).toLowerCase();
            const observacionInventario = String(
                item.observacionInventario || ""
            ).toLowerCase();

            return (
                codigo.includes(texto) ||
                nombre.includes(texto) ||
                categoria.includes(texto) ||
                grupo.includes(texto) ||
                tipo.includes(texto) ||
                unidad.includes(texto) ||
                observacionProducto.includes(texto) ||
                observacionInventario.includes(texto)
            );
        });
    }, [productos, busqueda]);

    const formatearNumero = (valor) => {
        if (valor === null || valor === undefined || valor === "") return "—";

        const numero = Number(valor);

        if (Number.isNaN(numero)) return valor;

        return numero.toLocaleString("es-CO", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        });
    };

    const cambiarEstadoProducto = async (item) => {
        const estadoActual = Number(item.estadoProducto) === 1;
        const nuevoEstado = estadoActual ? 0 : 1;

        const confirmar = window.confirm(
            `¿Seguro que deseas ${nuevoEstado === 1 ? "activar" : "inactivar"
            } este producto?`
        );

        if (!confirmar) return;

        try {
            setCambiandoEstado(true);

            const res = await fetch(
                `${API_BASE_PRODUCTOS}InventarioProductosCambiarEstado.php`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json; charset=utf-8",
                    },
                    body: JSON.stringify({
                        idProducto: Number(item.idProducto),
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
            cargarProductos();
        } catch (error) {
            console.error(error);
            toast.error("Error al cambiar el estado del producto");
        } finally {
            setCambiandoEstado(false);
        }
    };

    const totalActivos = productos.filter(
        (item) => Number(item.estadoProducto) === 1
    ).length;

    const totalConfigurados = productos.filter(
        (item) => Number(item.configuradoInventario) === 1
    ).length;

    const totalConLote = productos.filter(
        (item) => Number(item.manejaLote) === 1
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

                <h1 className="text-lg font-bold">Productos</h1>
            </div>

            <article className="flex-1 bg-white shadow-lg rounded-2xl flex flex-col overflow-hidden border border-slate-200">
                <nav className="w-full px-6 py-5 border-b border-slate-200 bg-white">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-blue-800 text-white flex items-center justify-center shadow-sm">
                                <FaBoxOpen className="text-xl" />
                            </div>

                            <div>
                                <h1 className="text-[calc(0.9rem+0.7vw)] font-bold text-slate-800">
                                    Productos
                                </h1>

                                <p className="text-sm text-slate-500">
                                    Administra productos del catálogo y su configuración de
                                    inventario.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => estadoPagina("CrearProductoInventario")}
                            className="px-5 py-2.5 bg-blue-800 text-white rounded-xl hover:bg-blue-900 flex items-center justify-center gap-2 transition-all duration-300 shadow-sm font-semibold"
                        >
                            <FaPlus />
                            Nuevo producto
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
                                    placeholder="Buscar por código, producto, grupo, categoría, tipo o unidad..."
                                />
                            </div>
                        </div>

                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
                                <FaBoxes />
                            </div>

                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase">
                                    Productos
                                </p>
                                <p className="text-lg font-black text-slate-800">
                                    {productos.length}
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
                                <FaExclamationTriangle />
                            </div>

                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase">
                                    Con lote
                                </p>
                                <p className="text-lg font-black text-slate-800">
                                    {totalConLote}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                                <FaLayerGroup />
                            </div>

                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase">
                                    Configurados para inventario
                                </p>
                                <p className="text-sm font-semibold text-slate-700">
                                    {totalConfigurados} de {productos.length} productos tienen
                                    configuración de inventario.
                                </p>
                            </div>
                        </div>

                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
                                <FaBarcode />
                            </div>

                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase">
                                    Siguiente paso
                                </p>
                                <p className="text-sm font-semibold text-slate-700">
                                    Después de productos se gestionarán los códigos de barras.
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
                                            Producto
                                        </th>
                                        <th className="px-5 py-4 text-left font-bold text-slate-700">
                                            Grupo / Categoría
                                        </th>
                                        <th className="px-5 py-4 text-left font-bold text-slate-700">
                                            Tipo inventario
                                        </th>
                                        <th className="px-5 py-4 text-center font-bold text-slate-700">
                                            Lote
                                        </th>
                                        <th className="px-5 py-4 text-center font-bold text-slate-700">
                                            Venc.
                                        </th>
                                        <th className="px-5 py-4 text-center font-bold text-slate-700">
                                            Stock mín.
                                        </th>
                                        <th className="px-5 py-4 text-center font-bold text-slate-700">
                                            Unidad
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
                                                colSpan="9"
                                                className="px-5 py-10 text-center text-slate-500"
                                            >
                                                Cargando productos...
                                            </td>
                                        </tr>
                                    ) : productosFiltrados.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan="9"
                                                className="px-5 py-10 text-center text-slate-500"
                                            >
                                                No hay productos registrados.
                                            </td>
                                        </tr>
                                    ) : (
                                        productosFiltrados.map((item) => {
                                            const activo = Number(item.estadoProducto) === 1;
                                            const configurado =
                                                Number(item.configuradoInventario) === 1;
                                            const manejaLote = Number(item.manejaLote) === 1;
                                            const manejaVencimiento =
                                                Number(item.manejaVencimiento) === 1;

                                            return (
                                                <tr
                                                    key={item.idProducto}
                                                    className="hover:bg-blue-50/40 transition-colors"
                                                >
                                                    <td className="px-5 py-4 align-middle">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center shrink-0">
                                                                <FaBoxOpen />
                                                            </div>

                                                            <div className="min-w-[230px]">
                                                                <p className="font-bold text-slate-800 break-words">
                                                                    {item.nombreProducto || "Sin nombre"}
                                                                </p>

                                                                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                                                                    Código: {item.codigo || "—"}
                                                                </p>

                                                                {item.embalajeNombre && (
                                                                    <p className="text-xs text-slate-400 mt-0.5">
                                                                        Embalaje: {item.embalajeNombre}
                                                                        {item.uniCaja
                                                                            ? ` / ${item.uniCaja} und.`
                                                                            : ""}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-4 align-middle">
                                                        <div className="min-w-[170px]">
                                                            <p className="font-semibold text-slate-700">
                                                                {item.codigoGrupo || "Sin grupo"}
                                                            </p>

                                                            <p className="text-xs text-slate-400 mt-0.5">
                                                                {item.categoriaProducto || "Sin categoría"}
                                                            </p>
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-4 align-middle">
                                                        {configurado ? (
                                                            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                                                                <FaLayerGroup />
                                                                {item.tipoProductoInventario ||
                                                                    "Sin tipo asignado"}
                                                            </div>
                                                        ) : (
                                                            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                                                                <FaExclamationTriangle />
                                                                Sin configurar
                                                            </div>
                                                        )}
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

                                                    <td className="px-5 py-4 text-center align-middle font-semibold text-slate-700">
                                                        {formatearNumero(item.stockMinimo)}
                                                    </td>

                                                    <td className="px-5 py-4 text-center align-middle">
                                                        <span className="inline-flex rounded-full px-3 py-1 text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
                                                            {item.unidadBaseInventario || "UND"}
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
                                                                        "productoInventarioEditar",
                                                                        JSON.stringify(item)
                                                                    );

                                                                    estadoPagina("EditarProductoInventario");
                                                                }}
                                                                className="h-10 min-w-[104px] inline-flex items-center justify-center gap-2 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
                                                            >
                                                                <FaEdit />
                                                                Editar
                                                            </button>

                                                            <button
                                                                type="button"
                                                                disabled={cambiandoEstado}
                                                                onClick={() => cambiarEstadoProducto(item)}
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