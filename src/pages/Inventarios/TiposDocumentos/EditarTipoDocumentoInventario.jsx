import React, { useEffect, useMemo, useState } from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaArrowLeft,
    FaSave,
    FaFileInvoice,
    FaInfoCircle,
    FaWarehouse,
    FaExchangeAlt,
    FaClipboardCheck,
} from "react-icons/fa";
import { toast } from "react-toastify";

const API_BASE_TIPOS_DOCUMENTO =
    "https://app.accionporcolombia.com/servicesPae/Inventario/TiposDocumento/";

export const EditarTipoDocumentoInventario = ({ setSidebar, navegar }) => {
    const abrirMenu = () => setSidebar(true);
    const estadoPagina = (pagina) => navegar(pagina);

    const [guardando, setGuardando] = useState(false);
    const [cargando, setCargando] = useState(true);

    const [formulario, setFormulario] = useState({
        idTipoDocumento: "",
        codigo: "",
        nombre: "",
        descripcion: "",
        naturaleza: "ENTRADA",
        tipoMovimiento: "ENTRADA",
        afectaInventario: 1,
        requiereOrigen: 0,
        requiereDestino: 1,
        permiteManual: 1,
        estado: 1,
    });

    const limpiarTexto = (valor) => String(valor || "").trim();

    const normalizarEstado = (valor) => {
        const estado = String(valor ?? "").trim().toLowerCase();

        if (
            estado === "1" ||
            estado === "activo" ||
            estado === "activa" ||
            estado === "true"
        ) {
            return 1;
        }

        return 0;
    };

    const cargarTipoDocumento = () => {
        try {
            setCargando(true);

            const dataLocal = localStorage.getItem("tipoDocumentoInventarioEditar");

            if (!dataLocal) {
                toast.warning("No se recibió el tipo de documento seleccionado");
                estadoPagina("TiposDocumentoInventario");
                return;
            }

            const item = JSON.parse(dataLocal);

            const naturaleza = String(
                item.naturaleza || item.tipoMovimiento || "ENTRADA"
            )
                .trim()
                .toUpperCase();

            setFormulario({
                idTipoDocumento: item.idTipoDocumento || item.id || "",
                codigo: item.codigo || "",
                nombre: item.nombre || "",
                descripcion: item.descripcion || "",
                naturaleza,
                tipoMovimiento: item.tipoMovimiento || naturaleza,
                afectaInventario: Number(item.afectaInventario ?? 1),
                requiereOrigen: Number(item.requiereOrigen ?? 0),
                requiereDestino: Number(item.requiereDestino ?? 0),
                permiteManual: Number(item.permiteManual ?? 1),
                estado: normalizarEstado(item.estado),
            });
        } catch (error) {
            console.error(error);
            toast.error("Error al cargar el tipo de documento seleccionado");
            estadoPagina("TiposDocumentoInventario");
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarTipoDocumento();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const cambiarCampo = (campo, valor) => {
        setFormulario((prev) => ({
            ...prev,
            [campo]: valor,
        }));
    };

    const cambiarNaturaleza = (valor) => {
        let requiereOrigen = 0;
        let requiereDestino = 0;

        if (valor === "ENTRADA") {
            requiereOrigen = 0;
            requiereDestino = 1;
        }

        if (valor === "SALIDA") {
            requiereOrigen = 1;
            requiereDestino = 0;
        }

        if (valor === "TRASLADO") {
            requiereOrigen = 1;
            requiereDestino = 1;
        }

        if (valor === "AJUSTE") {
            requiereOrigen = 0;
            requiereDestino = 0;
        }

        if (valor === "INVENTARIO_INICIAL") {
            requiereOrigen = 0;
            requiereDestino = 1;
        }

        setFormulario((prev) => ({
            ...prev,
            naturaleza: valor,
            tipoMovimiento: valor,
            requiereOrigen,
            requiereDestino,
        }));
    };

    const validarFormulario = () => {
        if (!Number(formulario.idTipoDocumento)) {
            toast.warning("No se recibió el id del tipo de documento");
            return false;
        }

        if (!limpiarTexto(formulario.codigo)) {
            toast.warning("El código del tipo de documento es obligatorio");
            return false;
        }

        if (!limpiarTexto(formulario.nombre)) {
            toast.warning("El nombre del tipo de documento es obligatorio");
            return false;
        }

        if (!limpiarTexto(formulario.naturaleza)) {
            toast.warning("Debes seleccionar la naturaleza del documento");
            return false;
        }

        return true;
    };

    const guardarTipoDocumento = async (e) => {
        e.preventDefault();

        if (!validarFormulario()) return;

        try {
            setGuardando(true);

            const payload = {
                id: Number(formulario.idTipoDocumento),
                idTipoDocumento: Number(formulario.idTipoDocumento),
                codigo: limpiarTexto(formulario.codigo).toUpperCase(),
                nombre: limpiarTexto(formulario.nombre).toUpperCase(),
                descripcion: limpiarTexto(formulario.descripcion),
                naturaleza: formulario.naturaleza,
                tipoMovimiento: formulario.tipoMovimiento,
                afectaInventario: Number(formulario.afectaInventario),
                requiereOrigen: Number(formulario.requiereOrigen),
                requiereDestino: Number(formulario.requiereDestino),
                permiteManual: Number(formulario.permiteManual),
                estado: Number(formulario.estado),
            };

            const res = await fetch(
                `${API_BASE_TIPOS_DOCUMENTO}InventarioTiposDocumentoGuardar.php`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json; charset=utf-8",
                    },
                    body: JSON.stringify(payload),
                }
            );

            const json = await res.json();

            if (!json.rpta || json.rpta === "no") {
                toast.error(json.mensaje || "No se pudo actualizar el tipo de documento");
                return;
            }

            toast.success(json.mensaje || "Tipo de documento actualizado correctamente");

            localStorage.removeItem("tipoDocumentoInventarioEditar");
            estadoPagina("TiposDocumentoInventario");
        } catch (error) {
            console.error(error);
            toast.error("Error al actualizar el tipo de documento");
        } finally {
            setGuardando(false);
        }
    };

    const naturalezaSeleccionada = useMemo(() => {
        const mapa = {
            ENTRADA: {
                titulo: "Entrada de inventario",
                descripcion:
                    "Documento usado para ingresar productos a una bodega o ubicación.",
                icono: <FaWarehouse />,
                clases: "bg-emerald-50 text-emerald-700 border-emerald-200",
            },
            SALIDA: {
                titulo: "Salida de inventario",
                descripcion:
                    "Documento usado para retirar productos desde una bodega o ubicación.",
                icono: <FaWarehouse />,
                clases: "bg-red-50 text-red-700 border-red-200",
            },
            TRASLADO: {
                titulo: "Traslado entre bodegas / ubicaciones",
                descripcion:
                    "Documento usado para mover productos desde un origen hacia un destino.",
                icono: <FaExchangeAlt />,
                clases: "bg-blue-50 text-blue-700 border-blue-200",
            },
            AJUSTE: {
                titulo: "Ajuste de inventario",
                descripcion:
                    "Documento usado para corregir saldos positivos o negativos del inventario.",
                icono: <FaClipboardCheck />,
                clases: "bg-amber-50 text-amber-700 border-amber-200",
            },
            INVENTARIO_INICIAL: {
                titulo: "Inventario inicial",
                descripcion:
                    "Documento usado para registrar los saldos iniciales del inventario.",
                icono: <FaFileInvoice />,
                clases: "bg-purple-50 text-purple-700 border-purple-200",
            },
        };

        return mapa[formulario.naturaleza] || mapa.ENTRADA;
    }, [formulario.naturaleza]);

    if (cargando) {
        return (
            <div className="w-full h-screen flex flex-col p-6 gap-6 bg-slate-100">
                <article className="flex-1 bg-white shadow-lg rounded-2xl flex items-center justify-center border border-slate-200">
                    <p className="text-sm text-slate-500">
                        Cargando tipo de documento...
                    </p>
                </article>
            </div>
        );
    }

    return (
        <div className="w-full h-screen flex flex-col p-6 gap-6 bg-slate-100">
            <div className="flex items-center gap-5 lg:hidden">
                <div
                    className="p-2 rounded-lg hover:bg-gray-300 cursor-pointer"
                    onClick={abrirMenu}
                >
                    <IoMenu className="text-2xl" />
                </div>

                <h1 className="text-lg font-bold">Editar tipo de documento</h1>
            </div>

            <article className="flex-1 bg-white shadow-lg rounded-2xl flex flex-col overflow-hidden border border-slate-200">
                <nav className="w-full px-6 py-5 border-b border-slate-200 bg-white">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={() => estadoPagina("TiposDocumentoInventario")}
                                className="h-11 w-11 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-all"
                                title="Volver"
                            >
                                <FaArrowLeft />
                            </button>

                            <div className="h-12 w-12 rounded-2xl bg-blue-800 text-white flex items-center justify-center shadow-sm">
                                <FaFileInvoice className="text-xl" />
                            </div>

                            <div>
                                <h1 className="text-[calc(0.9rem+0.7vw)] font-bold text-slate-800">
                                    Editar tipo de documento
                                </h1>

                                <p className="text-sm text-slate-500">
                                    Actualiza la configuración del documento de inventario.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={guardarTipoDocumento}
                            disabled={guardando}
                            className="px-5 py-2.5 bg-blue-800 text-white rounded-xl hover:bg-blue-900 flex items-center justify-center gap-2 transition-all duration-300 shadow-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <FaSave />
                            {guardando ? "Guardando..." : "Actualizar tipo de documento"}
                        </button>
                    </div>
                </nav>

                <section className="flex-1 overflow-auto bg-slate-50 p-6">
                    <form
                        onSubmit={guardarTipoDocumento}
                        className="grid grid-cols-1 xl:grid-cols-[1fr_370px] gap-6"
                    >
                        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-200 bg-white">
                                <h2 className="text-base font-bold text-slate-800">
                                    Información del documento
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Modifica los datos principales del tipo de documento.
                                </p>
                            </div>

                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        Código <span className="text-red-500">*</span>
                                    </label>

                                    <input
                                        type="text"
                                        value={formulario.codigo}
                                        onChange={(e) =>
                                            cambiarCampo("codigo", e.target.value.toUpperCase())
                                        }
                                        placeholder="Ej: ENT, SAL, TRAS, AJU"
                                        className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-800"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        Nombre <span className="text-red-500">*</span>
                                    </label>

                                    <input
                                        type="text"
                                        value={formulario.nombre}
                                        onChange={(e) =>
                                            cambiarCampo("nombre", e.target.value.toUpperCase())
                                        }
                                        placeholder="Ej: ENTRADA POR COMPRA"
                                        className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-800"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        Naturaleza del documento{" "}
                                        <span className="text-red-500">*</span>
                                    </label>

                                    <select
                                        value={formulario.naturaleza}
                                        onChange={(e) => cambiarNaturaleza(e.target.value)}
                                        className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-800"
                                    >
                                        <option value="ENTRADA">Entrada de inventario</option>
                                        <option value="SALIDA">Salida de inventario</option>
                                        <option value="TRASLADO">
                                            Traslado entre bodegas / ubicaciones
                                        </option>
                                        <option value="AJUSTE">Ajuste de inventario</option>
                                        <option value="INVENTARIO_INICIAL">
                                            Inventario inicial
                                        </option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        Estado
                                    </label>

                                    <select
                                        value={formulario.estado}
                                        onChange={(e) =>
                                            cambiarCampo("estado", Number(e.target.value))
                                        }
                                        className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-800"
                                    >
                                        <option value={1}>Activo</option>
                                        <option value={0}>Inactivo</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        Afecta inventario
                                    </label>

                                    <select
                                        value={formulario.afectaInventario}
                                        onChange={(e) =>
                                            cambiarCampo(
                                                "afectaInventario",
                                                Number(e.target.value)
                                            )
                                        }
                                        className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-800"
                                    >
                                        <option value={1}>Sí afecta saldos</option>
                                        <option value={0}>No afecta saldos</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        Requiere origen
                                    </label>

                                    <select
                                        value={formulario.requiereOrigen}
                                        onChange={(e) =>
                                            cambiarCampo(
                                                "requiereOrigen",
                                                Number(e.target.value)
                                            )
                                        }
                                        className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-800"
                                    >
                                        <option value={0}>No</option>
                                        <option value={1}>Sí</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        Requiere destino
                                    </label>

                                    <select
                                        value={formulario.requiereDestino}
                                        onChange={(e) =>
                                            cambiarCampo(
                                                "requiereDestino",
                                                Number(e.target.value)
                                            )
                                        }
                                        className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-800"
                                    >
                                        <option value={0}>No</option>
                                        <option value={1}>Sí</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        Permite registro manual
                                    </label>

                                    <select
                                        value={formulario.permiteManual}
                                        onChange={(e) =>
                                            cambiarCampo(
                                                "permiteManual",
                                                Number(e.target.value)
                                            )
                                        }
                                        className="w-full h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-800"
                                    >
                                        <option value={1}>Sí</option>
                                        <option value={0}>No</option>
                                    </select>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">
                                        Descripción
                                    </label>

                                    <textarea
                                        value={formulario.descripcion}
                                        onChange={(e) =>
                                            cambiarCampo("descripcion", e.target.value)
                                        }
                                        placeholder="Describe para qué se usará este tipo de documento..."
                                        rows={5}
                                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-800"
                                    />
                                </div>
                            </div>

                            <div className="px-6 py-5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row gap-3 sm:justify-end">
                                <button
                                    type="button"
                                    onClick={() => estadoPagina("TiposDocumentoInventario")}
                                    className="h-11 px-5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold flex items-center justify-center gap-2"
                                >
                                    <FaArrowLeft />
                                    Cancelar
                                </button>

                                <button
                                    type="submit"
                                    disabled={guardando}
                                    className="h-11 px-5 rounded-xl bg-blue-800 hover:bg-blue-900 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <FaSave />
                                    {guardando ? "Guardando..." : "Actualizar"}
                                </button>
                            </div>
                        </div>

                        <aside className="rounded-2xl bg-white border border-slate-200 shadow-sm h-fit xl:sticky xl:top-6 overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-200 bg-white">
                                <div className="flex items-center gap-3">
                                    <div className="h-11 w-11 rounded-xl bg-blue-800 text-white flex items-center justify-center">
                                        <FaInfoCircle />
                                    </div>

                                    <div>
                                        <h2 className="text-base font-bold text-slate-800">
                                            Resumen
                                        </h2>
                                        <p className="text-sm text-slate-500">
                                            Vista previa de la actualización.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                                    <p className="text-xs text-slate-400 font-bold uppercase">
                                        Código
                                    </p>
                                    <p className="text-lg font-black text-slate-800 mt-1 break-words">
                                        {limpiarTexto(formulario.codigo).toUpperCase() ||
                                            "SIN CÓDIGO"}
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                                    <p className="text-xs text-slate-400 font-bold uppercase">
                                        Nombre
                                    </p>
                                    <p className="text-base font-bold text-slate-800 mt-1 break-words">
                                        {limpiarTexto(formulario.nombre).toUpperCase() ||
                                            "SIN NOMBRE"}
                                    </p>
                                </div>

                                <div
                                    className={`rounded-2xl border p-4 ${naturalezaSeleccionada.clases}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-white/70 flex items-center justify-center">
                                            {naturalezaSeleccionada.icono}
                                        </div>

                                        <div>
                                            <p className="text-xs font-bold uppercase opacity-80">
                                                Naturaleza
                                            </p>
                                            <p className="text-sm font-black">
                                                {naturalezaSeleccionada.titulo}
                                            </p>
                                        </div>
                                    </div>

                                    <p className="text-xs mt-3 font-medium opacity-80">
                                        {naturalezaSeleccionada.descripcion}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                        <p className="text-[11px] text-slate-400 font-bold uppercase">
                                            Estado
                                        </p>
                                        <p
                                            className={`text-sm font-bold mt-1 ${Number(formulario.estado) === 1
                                                ? "text-emerald-700"
                                                : "text-red-700"
                                                }`}
                                        >
                                            {Number(formulario.estado) === 1
                                                ? "Activo"
                                                : "Inactivo"}
                                        </p>
                                    </div>

                                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                        <p className="text-[11px] text-slate-400 font-bold uppercase">
                                            Afecta
                                        </p>
                                        <p className="text-sm font-bold text-slate-800 mt-1">
                                            {Number(formulario.afectaInventario) === 1
                                                ? "Sí"
                                                : "No"}
                                        </p>
                                    </div>

                                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                        <p className="text-[11px] text-slate-400 font-bold uppercase">
                                            Origen
                                        </p>
                                        <p className="text-sm font-bold text-slate-800 mt-1">
                                            {Number(formulario.requiereOrigen) === 1
                                                ? "Sí"
                                                : "No"}
                                        </p>
                                    </div>

                                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                        <p className="text-[11px] text-slate-400 font-bold uppercase">
                                            Destino
                                        </p>
                                        <p className="text-sm font-bold text-slate-800 mt-1">
                                            {Number(formulario.requiereDestino) === 1
                                                ? "Sí"
                                                : "No"}
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
                                    <p className="text-xs font-bold uppercase text-blue-800">
                                        Nota
                                    </p>
                                    <p className="text-sm text-blue-900 mt-1">
                                        Los cambios aplicarán sobre los documentos futuros que usen
                                        esta configuración.
                                    </p>
                                </div>
                            </div>
                        </aside>
                    </form>
                </section>
            </article>
        </div>
    );
};