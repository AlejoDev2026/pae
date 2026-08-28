import React, { useEffect, useMemo, useState } from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaPlus,
    FaSearch,
    FaEdit,
    FaFileInvoice,
    FaToggleOn,
    FaToggleOff,
    FaClipboardCheck,
    FaExchangeAlt,
    FaWarehouse,
    FaExclamationTriangle,
    FaSyncAlt,
} from "react-icons/fa";
import { toast } from "react-toastify";

const API_BASE_TIPOS_DOCUMENTO =
    "https://app.accionporcolombia.com/servicesPae/Inventario/TiposDocumento/";

export const TiposDocumentoInventario = ({ setSidebar, navegar }) => {
    const abrirMenu = () => setSidebar(true);
    const estadoPagina = (pagina) => navegar(pagina);

    const [cargando, setCargando] = useState(false);
    const [cambiandoEstado, setCambiandoEstado] = useState(false);
    const [tiposDocumento, setTiposDocumento] = useState([]);
    const [busqueda, setBusqueda] = useState("");

    const cargarTiposDocumento = async () => {
        try {
            setCargando(true);

            const res = await fetch(
                `${API_BASE_TIPOS_DOCUMENTO}InventarioTiposDocumentoListar.php`,
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            const json = await res.json();

            if (!json.rpta || json.rpta === "no") {
                toast.error(
                    json.mensaje || "No se pudieron cargar los tipos de documento"
                );
                setTiposDocumento([]);
                return;
            }

            setTiposDocumento(Array.isArray(json.data) ? json.data : []);
        } catch (error) {
            console.error(error);
            toast.error("Error al consultar los tipos de documento");
            setTiposDocumento([]);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarTiposDocumento();
    }, []);

    const tiposFiltrados = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();

        if (!texto) return tiposDocumento;

        return tiposDocumento.filter((item) => {
            const codigo = String(item.codigo || "").toLowerCase();
            const nombre = String(item.nombre || "").toLowerCase();
            const descripcion = String(item.descripcion || "").toLowerCase();
            const naturaleza = String(item.naturaleza || "").toLowerCase();
            const tipoMovimiento = String(item.tipoMovimiento || "").toLowerCase();
            const estado = String(item.estadoTexto || item.estado || "").toLowerCase();

            return (
                codigo.includes(texto) ||
                nombre.includes(texto) ||
                descripcion.includes(texto) ||
                naturaleza.includes(texto) ||
                tipoMovimiento.includes(texto) ||
                estado.includes(texto)
            );
        });
    }, [tiposDocumento, busqueda]);

    const obtenerIdTipoDocumento = (item) => {
        return Number(item.idTipoDocumento || item.id || 0);
    };

    const esActivo = (estado) => {
        const valor = String(estado ?? "").trim().toLowerCase();

        return (
            valor === "1" ||
            valor === "activo" ||
            valor === "activa" ||
            valor === "true"
        );
    };

    const pintarNaturaleza = (item) => {
        const tipo = String(item.naturaleza || item.tipoMovimiento || "")
            .trim()
            .toUpperCase();

        if (tipo.includes("ENTRADA")) {
            return {
                texto: "ENTRADA",
                clases: "bg-emerald-50 text-emerald-700 border-emerald-200",
            };
        }

        if (tipo.includes("SALIDA")) {
            return {
                texto: "SALIDA",
                clases: "bg-red-50 text-red-700 border-red-200",
            };
        }

        if (tipo.includes("TRASLADO")) {
            return {
                texto: "TRASLADO",
                clases: "bg-blue-50 text-blue-700 border-blue-200",
            };
        }

        if (tipo.includes("AJUSTE")) {
            return {
                texto: "AJUSTE",
                clases: "bg-amber-50 text-amber-700 border-amber-200",
            };
        }

        if (tipo.includes("INVENTARIO")) {
            return {
                texto: "INVENTARIO INICIAL",
                clases: "bg-purple-50 text-purple-700 border-purple-200",
            };
        }

        return {
            texto: tipo || "SIN DEFINIR",
            clases: "bg-slate-50 text-slate-600 border-slate-200",
        };
    };

    const cambiarEstadoTipoDocumento = async (item) => {
        const idTipoDocumento = obtenerIdTipoDocumento(item);

        if (!idTipoDocumento) {
            toast.error("No se recibió el tipo de documento seleccionado");
            return;
        }

        const activo = esActivo(item.estado);
        const nuevoEstado = activo ? 0 : 1;

        const confirmar = window.confirm(
            `¿Seguro que deseas ${
                nuevoEstado === 1 ? "activar" : "inactivar"
            } este tipo de documento?`
        );

        if (!confirmar) return;

        try {
            setCambiandoEstado(true);

            const res = await fetch(
                `${API_BASE_TIPOS_DOCUMENTO}InventarioTiposDocumentoCambiarEstado.php`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json; charset=utf-8",
                    },
                    body: JSON.stringify({
                        idTipoDocumento,
                        estado: nuevoEstado,
                    }),
                }
            );

            const json = await res.json();

            if (!json.rpta || json.rpta === "no") {
                toast.error(json.mensaje || "No se pudo cambiar el estado");
                return;
            }

            toast.success(json.mensaje || "Estado actualizado correctamente");
            cargarTiposDocumento();
        } catch (error) {
            console.error(error);
            toast.error("Error al cambiar el estado del tipo de documento");
        } finally {
            setCambiandoEstado(false);
        }
    };

    const totalActivos = tiposDocumento.filter((item) =>
        esActivo(item.estado)
    ).length;

    const totalEntradas = tiposDocumento.filter((item) => {
        const tipo = String(item.naturaleza || item.tipoMovimiento || "")
            .trim()
            .toUpperCase();

        return tipo.includes("ENTRADA");
    }).length;

    const totalSalidas = tiposDocumento.filter((item) => {
        const tipo = String(item.naturaleza || item.tipoMovimiento || "")
            .trim()
            .toUpperCase();

        return tipo.includes("SALIDA");
    }).length;

    const totalTrasladosAjustes = tiposDocumento.filter((item) => {
        const tipo = String(item.naturaleza || item.tipoMovimiento || "")
            .trim()
            .toUpperCase();

        return tipo.includes("TRASLADO") || tipo.includes("AJUSTE");
    }).length;

    return (
        <div className="w-full h-screen flex flex-col p-6 gap-6 bg-slate-100">
            <div className="flex items-center gap-5 lg:hidden">
                <div
                    className="p-2 rounded-lg hover:bg-gray-300 cursor-pointer"
                    onClick={abrirMenu}
                >
                    <IoMenu className="text-2xl" />
                </div>

                <h1 className="text-lg font-bold">Tipos de documento</h1>
            </div>

            <article className="flex-1 bg-white shadow-lg rounded-2xl flex flex-col overflow-hidden border border-slate-200">
                <nav className="w-full px-6 py-5 border-b border-slate-200 bg-white">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-blue-800 text-white flex items-center justify-center shadow-sm">
                                <FaFileInvoice className="text-xl" />
                            </div>

                            <div>
                                <h1 className="text-[calc(0.9rem+0.7vw)] font-bold text-slate-800">
                                    Tipos de documento de inventario
                                </h1>

                                <p className="text-sm text-slate-500">
                                    Configura los documentos usados para entradas, salidas,
                                    traslados y ajustes de inventario.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => estadoPagina("CrearTipoDocumentoInventario")}
                            className="px-5 py-2.5 bg-blue-800 text-white rounded-xl hover:bg-blue-900 flex items-center justify-center gap-2 transition-all duration-300 shadow-sm font-semibold"
                        >
                            <FaPlus />
                            Nuevo tipo de documento
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
                                    placeholder="Buscar por código, nombre, naturaleza o descripción..."
                                />
                            </div>
                        </div>

                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
                                <FaFileInvoice />
                            </div>

                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase">
                                    Documentos
                                </p>
                                <p className="text-lg font-black text-slate-800">
                                    {tiposDocumento.length}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                                <FaClipboardCheck />
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
                                <FaExchangeAlt />
                            </div>

                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase">
                                    Traslados / Ajustes
                                </p>
                                <p className="text-lg font-black text-slate-800">
                                    {totalTrasladosAjustes}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                                <FaWarehouse />
                            </div>

                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase">
                                    Entradas configuradas
                                </p>
                                <p className="text-sm font-semibold text-slate-700">
                                    {totalEntradas} tipo(s) de documento para ingreso de
                                    inventario.
                                </p>
                            </div>
                        </div>

                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm px-4 py-3 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-red-50 text-red-700 flex items-center justify-center">
                                <FaExclamationTriangle />
                            </div>

                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase">
                                    Salidas configuradas
                                </p>
                                <p className="text-sm font-semibold text-slate-700">
                                    {totalSalidas} tipo(s) de documento para salida de
                                    inventario.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="flex-1 overflow-auto bg-slate-50 p-6">
                    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-200 bg-white flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h2 className="text-base font-bold text-slate-800">
                                    Listado de tipos de documento
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Total visible: {tiposFiltrados.length}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={cargarTiposDocumento}
                                disabled={cargando}
                                className="h-10 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <FaSyncAlt className={cargando ? "animate-spin" : ""} />
                                Actualizar
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm">
                                <thead className="bg-slate-100 border-b border-slate-200">
                                    <tr>
                                        <th className="px-5 py-4 text-left font-bold text-slate-700">
                                            Documento
                                        </th>
                                        <th className="px-5 py-4 text-left font-bold text-slate-700">
                                            Naturaleza
                                        </th>
                                        <th className="px-5 py-4 text-center font-bold text-slate-700">
                                            Afecta inventario
                                        </th>
                                        <th className="px-5 py-4 text-center font-bold text-slate-700">
                                            Requiere origen
                                        </th>
                                        <th className="px-5 py-4 text-center font-bold text-slate-700">
                                            Requiere destino
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
                                                Cargando tipos de documento...
                                            </td>
                                        </tr>
                                    ) : tiposFiltrados.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan="7"
                                                className="px-5 py-10 text-center text-slate-500"
                                            >
                                                No hay tipos de documento registrados.
                                            </td>
                                        </tr>
                                    ) : (
                                        tiposFiltrados.map((item) => {
                                            const idTipoDocumento = obtenerIdTipoDocumento(item);
                                            const activo = esActivo(item.estado);
                                            const naturaleza = pintarNaturaleza(item);

                                            const afectaInventario =
                                                Number(item.afectaInventario ?? 1) === 1;

                                            const requiereOrigen =
                                                Number(item.requiereOrigen ?? 0) === 1;

                                            const requiereDestino =
                                                Number(item.requiereDestino ?? 0) === 1;

                                            return (
                                                <tr
                                                    key={idTipoDocumento}
                                                    className="hover:bg-blue-50/40 transition-colors"
                                                >
                                                    <td className="px-5 py-4 align-middle">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center shrink-0">
                                                                <FaFileInvoice />
                                                            </div>

                                                            <div className="min-w-[240px]">
                                                                <p className="font-bold text-slate-800 break-words">
                                                                    {item.nombre || "Sin nombre"}
                                                                </p>

                                                                <p className="text-xs text-slate-400 font-semibold mt-0.5">
                                                                    Código: {item.codigo || "—"}
                                                                </p>

                                                                {item.descripcion && (
                                                                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                                                                        {item.descripcion}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    <td className="px-5 py-4 align-middle">
                                                        <span
                                                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold border ${naturaleza.clases}`}
                                                        >
                                                            {naturaleza.texto}
                                                        </span>
                                                    </td>

                                                    <td className="px-5 py-4 text-center align-middle">
                                                        <span
                                                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold border ${
                                                                afectaInventario
                                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                    : "bg-slate-50 text-slate-500 border-slate-200"
                                                            }`}
                                                        >
                                                            {afectaInventario ? "SÍ" : "NO"}
                                                        </span>
                                                    </td>

                                                    <td className="px-5 py-4 text-center align-middle">
                                                        <span
                                                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold border ${
                                                                requiereOrigen
                                                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                                                    : "bg-slate-50 text-slate-500 border-slate-200"
                                                            }`}
                                                        >
                                                            {requiereOrigen ? "SÍ" : "NO"}
                                                        </span>
                                                    </td>

                                                    <td className="px-5 py-4 text-center align-middle">
                                                        <span
                                                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold border ${
                                                                requiereDestino
                                                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                                                    : "bg-slate-50 text-slate-500 border-slate-200"
                                                            }`}
                                                        >
                                                            {requiereDestino ? "SÍ" : "NO"}
                                                        </span>
                                                    </td>

                                                    <td className="px-5 py-4 text-center align-middle">
                                                        <span
                                                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold border ${
                                                                activo
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
                                                                        "tipoDocumentoInventarioEditar",
                                                                        JSON.stringify(item)
                                                                    );

                                                                    estadoPagina(
                                                                        "EditarTipoDocumentoInventario"
                                                                    );
                                                                }}
                                                                className="h-10 min-w-[104px] inline-flex items-center justify-center gap-2 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold"
                                                            >
                                                                <FaEdit />
                                                                Editar
                                                            </button>

                                                            <button
                                                                type="button"
                                                                disabled={cambiandoEstado}
                                                                onClick={() =>
                                                                    cambiarEstadoTipoDocumento(item)
                                                                }
                                                                className={`h-10 min-w-[116px] inline-flex items-center justify-center gap-2 px-4 rounded-xl border font-semibold disabled:opacity-60 disabled:cursor-not-allowed ${
                                                                    activo
                                                                        ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                                                        : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                                                }`}
                                                            >
                                                                {activo ? (
                                                                    <FaToggleOff />
                                                                ) : (
                                                                    <FaToggleOn />
                                                                )}
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