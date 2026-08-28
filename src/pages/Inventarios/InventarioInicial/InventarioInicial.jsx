import React, { useCallback, useEffect, useMemo, useState } from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaBoxes,
    FaCheck,
    FaClipboardList,
    FaEdit,
    FaEye,
    FaPlus,
    FaSearch,
    FaSyncAlt,
    FaTimes,
    FaTrash,
    FaWarehouse,
} from "react-icons/fa";
import { toast } from "react-toastify";

const API_BASE =
    "https://app.accionporcolombia.com/servicesPae/Inventario/InventarioInicial/";

const obtenerUsuarioSesion = () => {
    const llaves = [
        "us",
        "usuario",
        "user",
        "usuarioLogueado",
        "dataUsuario",
        "sesionUsuario",
        "login",
        "authUser",
    ];

    for (const llave of llaves) {
        const valor = localStorage.getItem(llave);
        if (!valor) continue;

        try {
            const usuario = JSON.parse(valor);
            const id =
                usuario?.idUsuario ??
                usuario?.id_usuario ??
                usuario?.id ??
                usuario?.userId ??
                usuario?.idUser;

            if (id) return { ...usuario, idUsuario: Number(id) };
        } catch {
            const id = Number(valor);
            if (id > 0) return { idUsuario: id };
        }
    }

    return null;
};

const respuestaExitosa = (respuesta) =>
    respuesta?.rpta === "si" || respuesta?.rpta === true;

const consumirJson = async (url, opciones = {}) => {
    const respuesta = await fetch(url, {
        cache: "no-store",
        ...opciones,
        headers: {
            Accept: "application/json",
            "Cache-Control": "no-cache",
            ...(opciones.headers || {}),
        },
    });
    const texto = await respuesta.text();
    let resultado;

    try {
        resultado = JSON.parse(texto);
    } catch {
        throw new Error(texto || "El servicio devolvió una respuesta no válida.");
    }

    if (!respuesta.ok || !respuestaExitosa(resultado)) {
        throw new Error(
            resultado?.error ||
            resultado?.mensaje ||
            "No fue posible completar la solicitud."
        );
    }

    return resultado;
};

const claseEstado = (estado) => {
    const valor = String(estado || "").toUpperCase();

    if (valor === "FINALIZADA") {
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }

    if (valor === "ANULADA") {
        return "bg-rose-50 text-rose-700 border-rose-200";
    }

    return "bg-amber-50 text-amber-700 border-amber-200";
};

export const InventarioInicial = ({ setSidebar, navegar }) => {
    const usuario = useMemo(() => obtenerUsuarioSesion(), []);
    const [cargando, setCargando] = useState(true);
    const [procesando, setProcesando] = useState(false);
    const [documentos, setDocumentos] = useState([]);
    const [busqueda, setBusqueda] = useState("");
    const [estado, setEstado] = useState("");
    const [modalDetalle, setModalDetalle] = useState(null);
    const [cargandoDetalle, setCargandoDetalle] = useState(false);
    const [confirmacion, setConfirmacion] = useState(null);

    const cargar = useCallback(async () => {
        if (!usuario?.idUsuario) {
            toast.error("No se pudo identificar el usuario de la sesión.");
            setCargando(false);
            return;
        }

        setCargando(true);

        try {
            const params = new URLSearchParams({
                idUsuario: String(usuario.idUsuario),
                t: String(Date.now()),
            });

            if (estado) params.set("estado", estado);
            if (busqueda.trim()) params.set("q", busqueda.trim());

            const resultado = await consumirJson(
                `${API_BASE}InventarioInicialListar.php?${params}`
            );

            setDocumentos(
                Array.isArray(resultado?.data?.documentos)
                    ? resultado.data.documentos
                    : []
            );
        } catch (error) {
            console.error(error);
            toast.error(error.message);
            setDocumentos([]);
        } finally {
            setCargando(false);
        }
    }, [busqueda, estado, usuario?.idUsuario]);

    useEffect(() => {
        cargar();
    }, [cargar]);

    const resumen = useMemo(() => {
        return documentos.reduce(
            (total, item) => {
                const valor = String(item.estadoProceso || "").toUpperCase();
                total.total += 1;
                if (valor === "BORRADOR") total.borradores += 1;
                if (valor === "FINALIZADA") total.finalizados += 1;
                return total;
            },
            { total: 0, borradores: 0, finalizados: 0 }
        );
    }, [documentos]);

    const nuevo = () => {
        localStorage.removeItem("inventarioInicialEditar");
        localStorage.removeItem("inventarioInicialDetalle");
        navegar("CrearInventarioInicial");
    };

    const editar = (documento) => {
        localStorage.setItem(
            "inventarioInicialEditar",
            JSON.stringify({
                idDocumento: Number(documento.idDocumento),
            })
        );
        navegar("CrearInventarioInicial");
    };

    const verDetalle = async (documento) => {
        setCargandoDetalle(true);

        try {
            const params = new URLSearchParams({
                idDocumento: String(documento.idDocumento),
                t: String(Date.now()),
            });
            const resultado = await consumirJson(
                `${API_BASE}InventarioInicialDetalle.php?${params}`
            );
            setModalDetalle(resultado.data);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setCargandoDetalle(false);
        }
    };

    const ejecutarAccion = async () => {
        if (!confirmacion || !usuario?.idUsuario) return;

        setProcesando(true);

        try {
            const esFinalizar = confirmacion.accion === "FINALIZAR";
            const endpoint = esFinalizar
                ? "InventarioInicialFinalizar.php"
                : "InventarioInicialAnularBorrador.php";
            const resultado = await consumirJson(`${API_BASE}${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    idDocumento: Number(confirmacion.documento.idDocumento),
                    idUsuario: usuario.idUsuario,
                }),
            });

            toast.success(resultado.mensaje);
            setConfirmacion(null);
            setModalDetalle(null);
            await cargar();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setProcesando(false);
        }
    };

    return (
        <>
            <div className="w-full h-screen flex flex-col p-2 md:p-4 gap-4 bg-slate-100">
                <article className="flex-1 bg-white shadow-lg rounded-2xl flex flex-col overflow-hidden border border-slate-200">
                    <header className="px-4 py-4 md:px-5 border-b border-slate-200">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setSidebar(true)}
                                    className="lg:hidden w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center"
                                    aria-label="Abrir menú"
                                >
                                    <IoMenu className="text-xl" />
                                </button>

                                <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                                    <FaClipboardList className="text-blue-800" />
                                </div>

                                <div>
                                    <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-blue-700">
                                        Operación de inventarios
                                    </p>
                                    <h1 className="text-xl md:text-2xl font-bold text-slate-900">
                                        Inventario inicial
                                    </h1>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={nuevo}
                                className="h-10 px-4 rounded-xl bg-blue-800 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-blue-900"
                            >
                                <FaPlus />
                                Nueva carga inicial
                            </button>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto p-3 md:p-5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[
                                ["Total cargas", resumen.total, "bg-blue-50 text-blue-800"],
                                ["Borradores", resumen.borradores, "bg-amber-50 text-amber-700"],
                                ["Finalizadas", resumen.finalizados, "bg-emerald-50 text-emerald-700"],
                            ].map(([titulo, valor, clase]) => (
                                <div
                                    key={titulo}
                                    className="rounded-2xl border border-slate-200 p-4 bg-white"
                                >
                                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        {titulo}
                                    </p>
                                    <span
                                        className={`mt-2 inline-flex min-w-10 h-9 px-3 rounded-xl items-center justify-center text-lg font-bold ${clase}`}
                                    >
                                        {valor}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <section className="mt-4 rounded-2xl border border-slate-200 overflow-hidden">
                            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row gap-3">
                                <div className="relative flex-1">
                                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={busqueda}
                                        onChange={(event) => setBusqueda(event.target.value)}
                                        placeholder="Buscar por número, bodega u observación"
                                        className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-300 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-200"
                                    />
                                </div>

                                <select
                                    value={estado}
                                    onChange={(event) => setEstado(event.target.value)}
                                    className="h-10 px-3 rounded-xl border border-slate-300 bg-white text-sm"
                                >
                                    <option value="">Todos los estados</option>
                                    <option value="BORRADOR">Borrador</option>
                                    <option value="FINALIZADA">Finalizada</option>
                                    <option value="ANULADA">Anulada</option>
                                </select>

                                <button
                                    type="button"
                                    onClick={cargar}
                                    disabled={cargando}
                                    className="h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold flex items-center justify-center gap-2"
                                >
                                    <FaSyncAlt className={cargando ? "animate-spin" : ""} />
                                    Actualizar
                                </button>
                            </div>

                            {cargando ? (
                                <div className="min-h-64 flex flex-col items-center justify-center gap-3">
                                    <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />
                                    <p className="text-sm text-slate-500">Consultando cargas...</p>
                                </div>
                            ) : documentos.length === 0 ? (
                                <div className="min-h-64 flex flex-col items-center justify-center text-center p-6">
                                    <FaBoxes className="text-4xl text-slate-300" />
                                    <h2 className="mt-3 font-bold text-slate-800">
                                        No hay inventarios iniciales
                                    </h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Inicia una carga para una bodega sin movimientos.
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[920px]">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                {[
                                                    "Documento",
                                                    "Fecha de corte",
                                                    "Bodega",
                                                    "Productos",
                                                    "Cantidad total",
                                                    "Estado",
                                                    "Acciones",
                                                ].map((titulo) => (
                                                    <th
                                                        key={titulo}
                                                        className="px-4 py-3 text-left text-[11px] uppercase tracking-wider text-slate-500"
                                                    >
                                                        {titulo}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {documentos.map((documento) => {
                                                const borrador =
                                                    String(documento.estadoProceso).toUpperCase() ===
                                                    "BORRADOR";

                                                return (
                                                    <tr
                                                        key={documento.idDocumento}
                                                        className="hover:bg-slate-50"
                                                    >
                                                        <td className="px-4 py-3 font-bold text-slate-900">
                                                            INI-{String(documento.idDocumento).padStart(6, "0")}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-slate-700">
                                                            {documento.fechaDocumento}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <FaWarehouse className="text-blue-800" />
                                                                <div>
                                                                    <p className="text-sm font-semibold text-slate-900">
                                                                        {documento.nombreBodega}
                                                                    </p>
                                                                    <p className="text-xs text-slate-500">
                                                                        {documento.codigoBodega}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-slate-700">
                                                            {documento.totalProductos}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                                                            {new Intl.NumberFormat("es-CO", {
                                                                maximumFractionDigits: 3,
                                                            }).format(Number(documento.totalCantidad || 0))}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span
                                                                className={`inline-flex px-3 py-1 rounded-full border text-xs font-bold ${claseEstado(
                                                                    documento.estadoProceso
                                                                )}`}
                                                            >
                                                                {documento.estadoProceso}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => verDetalle(documento)}
                                                                    className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-100"
                                                                    title="Ver detalle"
                                                                >
                                                                    <FaEye />
                                                                </button>

                                                                {borrador && (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => editar(documento)}
                                                                            className="w-9 h-9 rounded-xl border border-blue-200 bg-blue-50 flex items-center justify-center text-blue-800 hover:bg-blue-100"
                                                                            title="Editar borrador"
                                                                        >
                                                                            <FaEdit />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                setConfirmacion({
                                                                                    accion: "FINALIZAR",
                                                                                    documento,
                                                                                })
                                                                            }
                                                                            className="w-9 h-9 rounded-xl border border-emerald-200 bg-emerald-50 flex items-center justify-center text-emerald-700 hover:bg-emerald-100"
                                                                            title="Finalizar"
                                                                        >
                                                                            <FaCheck />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() =>
                                                                                setConfirmacion({
                                                                                    accion: "ANULAR",
                                                                                    documento,
                                                                                })
                                                                            }
                                                                            className="w-9 h-9 rounded-xl border border-rose-200 bg-rose-50 flex items-center justify-center text-rose-700 hover:bg-rose-100"
                                                                            title="Anular borrador"
                                                                        >
                                                                            <FaTrash />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    </div>
                </article>
            </div>

            {(cargandoDetalle || modalDetalle) && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 md:p-6">
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-950/60"
                        onClick={() => !cargandoDetalle && setModalDetalle(null)}
                        aria-label="Cerrar"
                    />
                    <section className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                        {cargandoDetalle ? (
                            <div className="min-h-72 flex items-center justify-center">
                                <FaSyncAlt className="text-3xl text-blue-800 animate-spin" />
                            </div>
                        ) : (
                            <>
                                <header className="p-5 border-b border-slate-200 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                                            Inventario inicial
                                        </p>
                                        <h2 className="text-xl font-bold text-slate-900">
                                            INI-
                                            {String(
                                                modalDetalle?.documento?.idDocumento
                                            ).padStart(6, "0")}
                                        </h2>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setModalDetalle(null)}
                                        className="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center"
                                    >
                                        <FaTimes />
                                    </button>
                                </header>
                                <div className="p-5 overflow-y-auto">
                                    <div className="grid sm:grid-cols-3 gap-3 mb-4">
                                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                            <p className="text-xs text-slate-500">Fecha de corte</p>
                                            <p className="font-bold text-slate-900">
                                                {modalDetalle?.documento?.fechaDocumento}
                                            </p>
                                        </div>
                                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                            <p className="text-xs text-slate-500">Estado</p>
                                            <p className="font-bold text-slate-900">
                                                {modalDetalle?.documento?.estadoProceso}
                                            </p>
                                        </div>
                                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
                                            <p className="text-xs text-slate-500">Productos</p>
                                            <p className="font-bold text-slate-900">
                                                {modalDetalle?.detalles?.length || 0}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                                        <table className="w-full min-w-[760px]">
                                            <thead className="bg-slate-50">
                                                <tr>
                                                    {[
                                                        "Producto",
                                                        "Bodega / ubicación",
                                                        "Lote",
                                                        "Cantidad",
                                                    ].map((titulo) => (
                                                        <th
                                                            key={titulo}
                                                            className="px-3 py-2 text-left text-xs uppercase text-slate-500"
                                                        >
                                                            {titulo}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-200">
                                                {(modalDetalle?.detalles || []).map(
                                                    (detalle) => (
                                                        <tr key={detalle.idDocumentoDetalle}>
                                                            <td className="px-3 py-3">
                                                                <p className="font-semibold text-sm text-slate-900">
                                                                    {detalle.descripcion}
                                                                </p>
                                                                <p className="text-xs text-slate-500">
                                                                    {detalle.codigoProducto}
                                                                </p>
                                                            </td>
                                                            <td className="px-3 py-3 text-sm text-slate-700">
                                                                {detalle.nombreBodega}
                                                                <br />
                                                                <span className="text-xs text-slate-500">
                                                                    {detalle.nombreUbicacion}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-3 text-sm text-slate-700">
                                                                {detalle.lote || "No aplica"}
                                                            </td>
                                                            <td className="px-3 py-3 font-bold text-slate-900">
                                                                {detalle.cantidad} {detalle.unidad}
                                                            </td>
                                                        </tr>
                                                    )
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                    </section>
                </div>
            )}

            {confirmacion && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-950/60"
                        onClick={() => !procesando && setConfirmacion(null)}
                        aria-label="Cerrar"
                    />
                    <section className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
                        <h2 className="text-xl font-bold text-slate-900">
                            {confirmacion.accion === "FINALIZAR"
                                ? "Finalizar inventario inicial"
                                : "Anular borrador"}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            {confirmacion.accion === "FINALIZAR"
                                ? "Se crearán las existencias y los movimientos de Kardex. Después de finalizar no será posible editar esta carga."
                                : "El borrador quedará anulado y no podrá utilizarse para crear existencias."}
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setConfirmacion(null)}
                                disabled={procesando}
                                className="h-10 px-4 rounded-xl border border-slate-300 font-semibold text-slate-700"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={ejecutarAccion}
                                disabled={procesando}
                                className={`h-10 px-4 rounded-xl text-white font-semibold flex items-center gap-2 ${confirmacion.accion === "FINALIZAR"
                                        ? "bg-emerald-700"
                                        : "bg-rose-700"
                                    }`}
                            >
                                {procesando ? (
                                    <FaSyncAlt className="animate-spin" />
                                ) : confirmacion.accion === "FINALIZAR" ? (
                                    <FaCheck />
                                ) : (
                                    <FaTrash />
                                )}
                                Confirmar
                            </button>
                        </div>
                    </section>
                </div>
            )}
        </>
    );
};