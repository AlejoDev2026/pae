import React, { useEffect, useState } from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaArrowLeft,
    FaSave,
    FaTag,
    FaInfoCircle,
    FaClipboardList,
    FaCheckCircle,
    FaTimesCircle,
} from "react-icons/fa";
import { FaWarehouse } from "react-icons/fa6";
import { toast } from "react-toastify";

const API_BASE_INVENTARIO =
    "https://app.accionporcolombia.com/servicesPae/Inventario/";

export const EditarBodegaInventario = ({ setSidebar, navegar }) => {
    const abrirMenu = () => setSidebar(true);
    const estadoPagina = (pagina) => navegar(pagina);

    const [cargando, setCargando] = useState(false);
    const [guardando, setGuardando] = useState(false);

    const [form, setForm] = useState({
        id: 0,
        codigo: "",
        nombre: "",
        descripcion: "",
        estado: 1,
    });

    const idBodega = localStorage.getItem("idBodegaInventario");
    const esActiva = Number(form.estado) === 1;

    const handleChange = (e) => {
        const { name, value } = e.target;

        setForm((prev) => ({
            ...prev,
            [name]:
                name === "codigo"
                    ? value.toUpperCase()
                    : name === "estado"
                    ? Number(value)
                    : value,
        }));
    };

    const cargarBodega = async () => {
        if (!idBodega) {
            toast.warning("No se encontró la bodega seleccionada");
            estadoPagina("BodegasInventario");
            return;
        }

        try {
            setCargando(true);

            const params = new URLSearchParams();
            params.append("id", String(idBodega));

            const res = await fetch(
                `${API_BASE_INVENTARIO}InventarioBodegasListar.php?${params.toString()}`,
                {
                    method: "GET",
                    cache: "no-store",
                }
            );

            const response = await res.json();

            if (!response.rpta) {
                toast.error(response.mensaje || "No se pudo consultar la bodega");
                estadoPagina("BodegasInventario");
                return;
            }

            const data = Array.isArray(response.data) ? response.data : [];

            const bodega =
                data.find((item) => Number(item.id) === Number(idBodega)) ||
                data[0];

            if (!bodega) {
                toast.warning("No se encontró información de la bodega");
                estadoPagina("BodegasInventario");
                return;
            }

            setForm({
                id: Number(bodega.id || 0),
                codigo: bodega.codigo || "",
                nombre: bodega.nombre || "",
                descripcion: bodega.descripcion || "",
                estado: Number(bodega.estado ?? 1),
            });
        } catch (error) {
            console.error(error);
            toast.error("Ocurrió un error al consultar la bodega");
            estadoPagina("BodegasInventario");
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarBodega();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const validarFormulario = () => {
        if (!form.id) {
            toast.warning("No se encontró la bodega seleccionada");
            return false;
        }

        if (!form.codigo.trim()) {
            toast.warning("Debes escribir el código de la bodega");
            return false;
        }

        if (!form.nombre.trim()) {
            toast.warning("Debes escribir el nombre de la bodega");
            return false;
        }

        return true;
    };

    const actualizarBodega = async (e) => {
        e.preventDefault();

        if (!validarFormulario()) return;

        try {
            setGuardando(true);

            const payload = {
                id: Number(form.id),
                codigo: form.codigo.trim().toUpperCase(),
                nombre: form.nombre.trim(),
                descripcion: form.descripcion.trim(),
                estado: Number(form.estado),
            };

            const res = await fetch(
                `${API_BASE_INVENTARIO}InventarioBodegasGuardar.php`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json; charset=utf-8",
                    },
                    body: JSON.stringify(payload),
                }
            );

            const response = await res.json();

            if (!response.rpta) {
                toast.error(response.mensaje || "No se pudo actualizar la bodega");
                return;
            }

            toast.success(response.mensaje || "Bodega actualizada correctamente");
            localStorage.removeItem("idBodegaInventario");
            estadoPagina("BodegasInventario");
        } catch (error) {
            console.error(error);
            toast.error("Ocurrió un error al actualizar la bodega");
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="w-full h-screen flex flex-col p-6 gap-6 bg-slate-100">
            <div className="flex items-center gap-5 lg:hidden">
                <div
                    className="p-2 rounded-lg hover:bg-gray-300 cursor-pointer"
                    onClick={abrirMenu}
                >
                    <IoMenu className="text-2xl" />
                </div>

                <h1 className="text-lg font-bold">Editar bodega</h1>
            </div>

            <article className="flex-1 bg-white shadow-lg rounded-2xl flex flex-col overflow-hidden border border-slate-200">
                <nav className="w-full px-6 py-5 border-b border-slate-200 bg-white">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                className="h-10 w-10 flex items-center justify-center border border-slate-300 rounded-xl bg-white hover:bg-slate-100 transition-colors"
                                onClick={() => estadoPagina("BodegasInventario")}
                                type="button"
                            >
                                <FaArrowLeft className="text-slate-700" />
                            </button>

                            <div className="h-12 w-12 rounded-2xl bg-blue-800 text-white flex items-center justify-center shadow-sm">
                                <FaWarehouse className="text-xl" />
                            </div>

                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-[calc(0.9rem+0.7vw)] font-bold text-slate-800">
                                        Editar bodega
                                    </h1>

                                    <span
                                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${
                                            esActiva
                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                : "bg-red-50 text-red-700 border-red-200"
                                        }`}
                                    >
                                        {esActiva ? <FaCheckCircle /> : <FaTimesCircle />}
                                        {esActiva ? "Activa" : "Inactiva"}
                                    </span>
                                </div>

                                <p className="text-sm text-slate-500">
                                    Ajusta la información base de esta bodega logística.
                                </p>
                            </div>
                        </div>

                        <button
                            className="px-5 py-2.5 bg-blue-800 text-white rounded-xl hover:bg-blue-900 flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm font-semibold"
                            onClick={actualizarBodega}
                            disabled={guardando || cargando}
                            type="button"
                        >
                            <FaSave />
                            <span>{guardando ? "Guardando..." : "Guardar cambios"}</span>
                        </button>
                    </div>
                </nav>

                {cargando ? (
                    <div className="flex-1 flex items-center justify-center bg-slate-50">
                        <div className="text-center bg-white border border-slate-200 rounded-2xl px-10 py-8 shadow-sm">
                            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-800 rounded-full animate-spin mx-auto mb-4"></div>
                            <p className="text-sm font-semibold text-slate-700">
                                Consultando información de la bodega...
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                                Un momento, estamos cargando los datos.
                            </p>
                        </div>
                    </div>
                ) : (
                    <form
                        onSubmit={actualizarBodega}
                        className="flex-1 overflow-y-auto no-scrollbar bg-slate-50"
                    >
                        <div className="p-6">
                            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
                                <section className="min-w-0">
                                    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
                                                <FaClipboardList />
                                            </div>

                                            <div>
                                                <h2 className="text-base lg:text-lg font-bold text-slate-800">
                                                    Información de la bodega
                                                </h2>
                                                <p className="text-sm text-slate-500">
                                                    Actualiza los datos principales de esta bodega.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="p-5 space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-sm font-semibold text-slate-700">
                                                        Código <span className="text-red-500">*</span>
                                                    </label>

                                                    <div className="relative">
                                                        <FaTag className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-700 text-sm" />

                                                        <input
                                                            type="text"
                                                            name="codigo"
                                                            value={form.codigo}
                                                            onChange={handleChange}
                                                            style={{ textTransform: "uppercase" }}
                                                            className="h-11 w-full border border-slate-300 bg-white rounded-xl pl-10 pr-3 text-sm uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                                            placeholder="EJ: BOD-SECO"
                                                        />
                                                    </div>

                                                    <span className="text-xs text-slate-400">
                                                        Código corto de identificación.
                                                    </span>
                                                </div>

                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-sm font-semibold text-slate-700">
                                                        Estado <span className="text-red-500">*</span>
                                                    </label>

                                                    <div className="relative">
                                                        <span
                                                            className={`absolute left-3 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full ${
                                                                esActiva
                                                                    ? "bg-emerald-500"
                                                                    : "bg-red-500"
                                                            }`}
                                                        ></span>

                                                        <select
                                                            name="estado"
                                                            value={form.estado}
                                                            onChange={handleChange}
                                                            className="h-11 w-full border border-slate-300 bg-white rounded-xl pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                                        >
                                                            <option value={1}>ACTIVO</option>
                                                            <option value={0}>INACTIVO</option>
                                                        </select>
                                                    </div>

                                                    <span className="text-xs text-slate-400">
                                                        Controla si la bodega puede usarse.
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-semibold text-slate-700">
                                                    Nombre <span className="text-red-500">*</span>
                                                </label>

                                                <div className="relative">
                                                    <FaWarehouse className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />

                                                    <input
                                                        type="text"
                                                        name="nombre"
                                                        value={form.nombre}
                                                        onChange={handleChange}
                                                        className="h-11 w-full border border-slate-300 bg-white rounded-xl pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                                        placeholder="Ej: Bodega principal"
                                                    />
                                                </div>

                                                <span className="text-xs text-slate-400">
                                                    Nombre visible para el equipo logístico.
                                                </span>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-semibold text-slate-700">
                                                    Descripción interna
                                                </label>

                                                <textarea
                                                    name="descripcion"
                                                    value={form.descripcion}
                                                    onChange={handleChange}
                                                    rows={9}
                                                    className="w-full border border-slate-300 bg-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition resize-none"
                                                    placeholder="Describe el uso, ubicación o detalle operativo de la bodega"
                                                />

                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-slate-400">
                                                    <span>Campo opcional para observaciones internas.</span>
                                                    <span>{form.descripcion.length} caracteres</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <aside className="min-w-0">
                                    <div className="sticky top-0 space-y-5">
                                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                                            <div className="h-1.5 bg-blue-800"></div>

                                            <div className="p-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-800 flex items-center justify-center">
                                                        <FaWarehouse className="text-xl" />
                                                    </div>

                                                    <div className="min-w-0">
                                                        <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">
                                                            Bodega seleccionada
                                                        </p>

                                                        <h2 className="text-xl font-bold text-slate-800 break-words">
                                                            {form.codigo || "—"}
                                                        </h2>
                                                    </div>
                                                </div>

                                                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                                    <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">
                                                        Nombre
                                                    </p>
                                                    <p className="mt-1 text-sm font-semibold text-slate-800 break-words">
                                                        {form.nombre || "Sin nombre"}
                                                    </p>
                                                </div>

                                                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                                    <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">
                                                        Estado actual
                                                    </p>

                                                    <div
                                                        className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold border ${
                                                            esActiva
                                                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                                : "bg-red-50 text-red-700 border-red-200"
                                                        }`}
                                                    >
                                                        {esActiva ? <FaCheckCircle /> : <FaTimesCircle />}
                                                        {esActiva ? "ACTIVA" : "INACTIVA"}
                                                    </div>
                                                </div>

                                                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                                    <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">
                                                        Descripción
                                                    </p>
                                                    <p className="mt-1 text-sm text-slate-600 break-words line-clamp-5">
                                                        {form.descripcion ||
                                                            "Sin descripción registrada."}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                                            <div className="h-1.5 bg-amber-400"></div>

                                            <div className="p-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                                                        <FaInfoCircle />
                                                    </div>

                                                    <h3 className="text-base font-bold text-slate-800">
                                                        Recomendación
                                                    </h3>
                                                </div>

                                                <p className="mt-3 text-sm text-slate-500 leading-relaxed">
                                                    Usa códigos cortos y claros como{" "}
                                                    <strong className="text-slate-700">
                                                        BOD-SECO
                                                    </strong>
                                                    ,{" "}
                                                    <strong className="text-slate-700">
                                                        BOD-FRIA
                                                    </strong>{" "}
                                                    o{" "}
                                                    <strong className="text-slate-700">
                                                        BOD-PRINCIPAL
                                                    </strong>
                                                    .
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </aside>
                            </div>

                            <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3 border-t border-slate-200 pt-5">
                                <button
                                    type="button"
                                    onClick={() => estadoPagina("BodegasInventario")}
                                    className="px-5 py-2.5 border border-slate-300 rounded-xl bg-white hover:bg-slate-100 transition-colors font-semibold text-slate-700"
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="submit"
                                    disabled={guardando}
                                    className="px-5 py-2.5 bg-blue-800 text-white rounded-xl hover:bg-blue-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold shadow-sm"
                                >
                                    <FaSave />
                                    {guardando ? "Guardando..." : "Actualizar bodega"}
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </article>
        </div>
    );
};