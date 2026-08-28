import React, { useState } from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaArrowLeft,
    FaSave,
    FaInfoCircle,
    FaLayerGroup,
    FaClipboardList,
    FaBoxes,
    FaCalendarAlt,
    FaSnowflake,
    FaCheckCircle,
} from "react-icons/fa";
import { toast } from "react-toastify";

const API_BASE_TIPOS_PRODUCTO =
    "https://app.accionporcolombia.com/servicesPae/Inventario/TiposProducto/";

export const CrearTipoProductoInventario = ({ setSidebar, navegar }) => {
    const abrirMenu = () => setSidebar(true);
    const estadoPagina = (pagina) => navegar(pagina);

    const [guardando, setGuardando] = useState(false);

    const [form, setForm] = useState({
        codigo: "",
        nombre: "",
        descripcion: "",
        manejaLote: 0,
        manejaVencimiento: 0,
        requiereFechaVencimiento: 0,
        requiereBodegaFria: 0,
        estado: 1,
    });

    const esActiva = Number(form.estado) === 1;
    const manejaLote = Number(form.manejaLote) === 1;
    const manejaVencimiento = Number(form.manejaVencimiento) === 1;
    const requiereFechaVencimiento =
        Number(form.requiereFechaVencimiento) === 1;
    const requiereBodegaFria = Number(form.requiereBodegaFria) === 1;

    const handleChange = (e) => {
        const { name, value } = e.target;

        const camposNumericos = [
            "manejaLote",
            "manejaVencimiento",
            "requiereFechaVencimiento",
            "requiereBodegaFria",
            "estado",
        ];

        setForm((prev) => {
            const nuevo = {
                ...prev,
                [name]:
                    name === "codigo"
                        ? value.toUpperCase()
                        : camposNumericos.includes(name)
                            ? Number(value)
                            : value,
            };

            if (name === "manejaVencimiento" && Number(value) === 0) {
                nuevo.requiereFechaVencimiento = 0;
            }

            return nuevo;
        });
    };

    const validarFormulario = () => {
        if (!form.codigo.trim()) {
            toast.warning("Debes escribir el código del tipo de producto");
            return false;
        }

        if (!form.nombre.trim()) {
            toast.warning("Debes escribir el nombre del tipo de producto");
            return false;
        }

        if (
            Number(form.requiereFechaVencimiento) === 1 &&
            Number(form.manejaVencimiento) === 0
        ) {
            toast.warning(
                "Si requiere fecha de vencimiento, debe manejar vencimiento"
            );
            return false;
        }

        return true;
    };

    const guardarTipoProducto = async (e) => {
        e.preventDefault();

        if (!validarFormulario()) return;

        try {
            setGuardando(true);

            const payload = {
                id: 0,
                codigo: form.codigo.trim().toUpperCase(),
                nombre: form.nombre.trim().toUpperCase(),
                descripcion: form.descripcion.trim(),
                manejaLote: Number(form.manejaLote),
                manejaVencimiento: Number(form.manejaVencimiento),
                requiereFechaVencimiento: Number(form.requiereFechaVencimiento),
                requiereBodegaFria: Number(form.requiereBodegaFria),
                estado: Number(form.estado),
            };

            const res = await fetch(
                `${API_BASE_TIPOS_PRODUCTO}InventarioTiposProductoGuardar.php`,
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
                toast.error(response.mensaje || "No se pudo guardar el tipo de producto");
                return;
            }

            toast.success(response.mensaje || "Tipo de producto guardado correctamente");
            estadoPagina("TiposProductoInventario");
        } catch (error) {
            console.error(error);
            toast.error("Ocurrió un error al guardar el tipo de producto");
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

                <h1 className="text-lg font-bold">Crear tipo de producto</h1>
            </div>

            <article className="flex-1 bg-white shadow-lg rounded-2xl flex flex-col overflow-hidden border border-slate-200">
                <nav className="w-full px-6 py-5 border-b border-slate-200 bg-white">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                className="h-10 w-10 flex items-center justify-center border border-slate-300 rounded-xl bg-white hover:bg-slate-100 transition-colors"
                                onClick={() => estadoPagina("TiposProductoInventario")}
                                type="button"
                            >
                                <FaArrowLeft className="text-slate-700" />
                            </button>

                            <div className="h-12 w-12 rounded-2xl bg-blue-800 text-white flex items-center justify-center shadow-sm">
                                <FaLayerGroup className="text-xl" />
                            </div>

                            <div>
                                <h1 className="text-[calc(0.9rem+0.7vw)] font-bold text-slate-800">
                                    Crear tipo de producto
                                </h1>

                                <p className="text-sm text-slate-500">
                                    Define las reglas base que aplicarán a los productos de
                                    inventario.
                                </p>
                            </div>
                        </div>

                        <button
                            className="px-5 py-2.5 bg-blue-800 text-white rounded-xl hover:bg-blue-900 flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm font-semibold"
                            onClick={guardarTipoProducto}
                            disabled={guardando}
                            type="button"
                        >
                            <FaSave />
                            <span>{guardando ? "Guardando..." : "Guardar tipo"}</span>
                        </button>
                    </div>
                </nav>

                <form
                    onSubmit={guardarTipoProducto}
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
                                                Información del tipo de producto
                                            </h2>
                                            <p className="text-sm text-slate-500">
                                                Configura identificación, control de lote, vencimiento y
                                                bodega fría.
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
                                                    <FaLayerGroup className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-700 text-sm" />

                                                    <input
                                                        type="text"
                                                        name="codigo"
                                                        value={form.codigo}
                                                        onChange={handleChange}
                                                        style={{ textTransform: "uppercase" }}
                                                        className="h-11 w-full border border-slate-300 bg-white rounded-xl pl-10 pr-3 text-sm uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                                        placeholder="EJ: PERECEDERO"
                                                    />
                                                </div>

                                                <span className="text-xs text-slate-400">
                                                    Código corto para identificar el tipo.
                                                </span>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-semibold text-slate-700">
                                                    Estado <span className="text-red-500">*</span>
                                                </label>

                                                <div className="relative">
                                                    <span
                                                        className={`absolute left-3 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full ${esActiva ? "bg-emerald-500" : "bg-red-500"
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
                                                    Controla si el tipo puede ser usado.
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-sm font-semibold text-slate-700">
                                                Nombre <span className="text-red-500">*</span>
                                            </label>

                                            <div className="relative">
                                                <FaLayerGroup className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />

                                                <input
                                                    type="text"
                                                    name="nombre"
                                                    value={form.nombre}
                                                    onChange={handleChange}
                                                    className="h-11 w-full border border-slate-300 bg-white rounded-xl pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                                    placeholder="Ej: Perecedero"
                                                />
                                            </div>

                                            <span className="text-xs text-slate-400">
                                                Nombre visible para clasificar productos.
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-semibold text-slate-700">
                                                    Maneja lote
                                                </label>

                                                <div className="relative">
                                                    <FaBoxes className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-700 text-sm" />

                                                    <select
                                                        name="manejaLote"
                                                        value={form.manejaLote}
                                                        onChange={handleChange}
                                                        className="h-11 w-full border border-slate-300 bg-white rounded-xl pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                                    >
                                                        <option value={0}>NO</option>
                                                        <option value={1}>SÍ</option>
                                                    </select>
                                                </div>

                                                <span className="text-xs text-slate-400">
                                                    Exige control por lote en inventario.
                                                </span>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-semibold text-slate-700">
                                                    Maneja vencimiento
                                                </label>

                                                <div className="relative">
                                                    <FaCalendarAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-600 text-sm" />

                                                    <select
                                                        name="manejaVencimiento"
                                                        value={form.manejaVencimiento}
                                                        onChange={handleChange}
                                                        className="h-11 w-full border border-slate-300 bg-white rounded-xl pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                                    >
                                                        <option value={0}>NO</option>
                                                        <option value={1}>SÍ</option>
                                                    </select>
                                                </div>

                                                <span className="text-xs text-slate-400">
                                                    Permite controlar fechas de vencimiento.
                                                </span>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-semibold text-slate-700">
                                                    Requiere fecha de vencimiento
                                                </label>

                                                <div className="relative">
                                                    <FaCalendarAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-600 text-sm" />

                                                    <select
                                                        name="requiereFechaVencimiento"
                                                        value={form.requiereFechaVencimiento}
                                                        onChange={handleChange}
                                                        disabled={!manejaVencimiento}
                                                        className="h-11 w-full border border-slate-300 bg-white rounded-xl pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition disabled:bg-slate-100 disabled:text-slate-400"
                                                    >
                                                        <option value={0}>NO</option>
                                                        <option value={1}>SÍ</option>
                                                    </select>
                                                </div>

                                                <span className="text-xs text-slate-400">
                                                    Solo aplica cuando maneja vencimiento.
                                                </span>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-semibold text-slate-700">
                                                    Requiere bodega fría
                                                </label>

                                                <div className="relative">
                                                    <FaSnowflake className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-600 text-sm" />

                                                    <select
                                                        name="requiereBodegaFria"
                                                        value={form.requiereBodegaFria}
                                                        onChange={handleChange}
                                                        className="h-11 w-full border border-slate-300 bg-white rounded-xl pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                                    >
                                                        <option value={0}>NO</option>
                                                        <option value={1}>SÍ</option>
                                                    </select>
                                                </div>

                                                <span className="text-xs text-slate-400">
                                                    Marca productos que deben almacenarse en frío.
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-sm font-semibold text-slate-700">
                                                Descripción interna
                                            </label>

                                            <textarea
                                                name="descripcion"
                                                value={form.descripcion}
                                                onChange={handleChange}
                                                rows={7}
                                                className="w-full border border-slate-300 bg-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition resize-none"
                                                placeholder="Describe las reglas o condiciones de este tipo de producto"
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
                                                    <FaLayerGroup className="text-xl" />
                                                </div>

                                                <div className="min-w-0">
                                                    <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">
                                                        Nuevo tipo de producto
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
                                                    Reglas
                                                </p>

                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <span
                                                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold border ${manejaLote
                                                            ? "bg-blue-50 text-blue-700 border-blue-200"
                                                            : "bg-slate-50 text-slate-500 border-slate-200"
                                                            }`}
                                                    >
                                                        <FaBoxes />
                                                        Lote {manejaLote ? "SÍ" : "NO"}
                                                    </span>

                                                    <span
                                                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold border ${manejaVencimiento
                                                            ? "bg-amber-50 text-amber-700 border-amber-200"
                                                            : "bg-slate-50 text-slate-500 border-slate-200"
                                                            }`}
                                                    >
                                                        <FaCalendarAlt />
                                                        Venc. {manejaVencimiento ? "SÍ" : "NO"}
                                                    </span>

                                                    <span
                                                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold border ${requiereFechaVencimiento
                                                            ? "bg-amber-50 text-amber-700 border-amber-200"
                                                            : "bg-slate-50 text-slate-500 border-slate-200"
                                                            }`}
                                                    >
                                                        <FaCalendarAlt />
                                                        Fecha {requiereFechaVencimiento ? "SÍ" : "NO"}
                                                    </span>

                                                    <span
                                                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold border ${requiereBodegaFria
                                                            ? "bg-sky-50 text-sky-700 border-sky-200"
                                                            : "bg-slate-50 text-slate-500 border-slate-200"
                                                            }`}
                                                    >
                                                        <FaSnowflake />
                                                        Fría {requiereBodegaFria ? "SÍ" : "NO"}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                                <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">
                                                    Estado
                                                </p>

                                                <div
                                                    className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold border ${esActiva
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                        : "bg-red-50 text-red-700 border-red-200"
                                                        }`}
                                                >
                                                    <FaCheckCircle />
                                                    {esActiva ? "ACTIVO" : "INACTIVO"}
                                                </div>
                                            </div>

                                            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                                <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">
                                                    Descripción
                                                </p>
                                                <p className="mt-1 text-sm text-slate-600 break-words line-clamp-5">
                                                    {form.descripcion || "Sin descripción registrada."}
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
                                                Crea tipos claros como{" "}
                                                <strong className="text-slate-700">PERECEDERO</strong>,{" "}
                                                <strong className="text-slate-700">REFRIGERADO</strong>,{" "}
                                                <strong className="text-slate-700">CONGELADO</strong> o{" "}
                                                <strong className="text-slate-700">ASEO</strong>. Esto
                                                facilitará la configuración posterior de productos.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </aside>
                        </div>

                        <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3 border-t border-slate-200 pt-5">
                            <button
                                type="button"
                                onClick={() => estadoPagina("TiposProductoInventario")}
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
                                {guardando ? "Guardando..." : "Guardar tipo"}
                            </button>
                        </div>
                    </div>
                </form>
            </article>
        </div>
    );
};