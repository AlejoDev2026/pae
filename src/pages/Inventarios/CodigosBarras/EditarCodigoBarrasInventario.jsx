import React, { useEffect, useMemo, useState } from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaArrowLeft,
    FaSave,
    FaBarcode,
    FaBoxOpen,
    FaClipboardList,
    FaLayerGroup,
    FaInfoCircle,
    FaStar,
    FaRegStar,
    FaCheckCircle,
    FaBoxes,
    FaSearch,
    FaTimes,
    FaCheck,
} from "react-icons/fa";
import { toast } from "react-toastify";

const API_BASE_CODIGOS =
    "https://app.accionporcolombia.com/servicesPae/Inventario/CodigosBarras/";

export const EditarCodigoBarrasInventario = ({ setSidebar, navegar, data }) => {
    const abrirMenu = () => setSidebar(true);
    const estadoPagina = (pagina) => navegar(pagina);

    const dataLocal = (() => {
        try {
            return JSON.parse(localStorage.getItem("codigoBarrasInventarioEditar"));
        } catch {
            return null;
        }
    })();

    const codigoEditar = data || dataLocal;

    const [guardando, setGuardando] = useState(false);
    const [cargandoData, setCargandoData] = useState(false);

    const [productos, setProductos] = useState([]);
    const [tiposCodigo, setTiposCodigo] = useState([]);

    const [modalProductos, setModalProductos] = useState(false);
    const [busquedaProducto, setBusquedaProducto] = useState("");

    const [form, setForm] = useState({
        id: codigoEditar?.id || "",
        idProducto: codigoEditar?.idProducto || "",
        codigoBarras: codigoEditar?.codigoBarras || "",
        tipoCodigo: codigoEditar?.tipoCodigo || "UNIDAD",
        principal: Number(codigoEditar?.principal ?? 0),
        observacion: codigoEditar?.observacion || "",
        estado: Number(codigoEditar?.estado ?? 1),
    });

    const productoSeleccionado = useMemo(() => {
        return productos.find(
            (item) => Number(item.id) === Number(form.idProducto)
        );
    }, [productos, form.idProducto]);

    const productoVista = productoSeleccionado || {
        id: codigoEditar?.idProducto,
        codigo: codigoEditar?.codigoProducto,
        nombreProducto: codigoEditar?.nombreProducto,
        codigoGrupo: codigoEditar?.codigoGrupo,
        categoriaProducto: codigoEditar?.categoriaProducto,
        tipoProductoInventario: codigoEditar?.tipoProductoInventario,
        embalajeNombre: codigoEditar?.embalajeNombre,
        uniCaja: codigoEditar?.uniCaja,
    };

    const productosFiltrados = useMemo(() => {
        const texto = busquedaProducto.trim().toLowerCase();

        if (!texto) return productos;

        return productos.filter((item) => {
            const codigo = String(item.codigo || "").toLowerCase();
            const nombre = String(item.nombreProducto || "").toLowerCase();
            const grupo = String(item.codigoGrupo || "").toLowerCase();
            const categoria = String(item.categoriaProducto || "").toLowerCase();
            const tipo = String(item.tipoProductoInventario || "").toLowerCase();
            const embalaje = String(item.embalajeNombre || "").toLowerCase();

            return (
                codigo.includes(texto) ||
                nombre.includes(texto) ||
                grupo.includes(texto) ||
                categoria.includes(texto) ||
                tipo.includes(texto) ||
                embalaje.includes(texto)
            );
        });
    }, [productos, busquedaProducto]);

    const esActivo = Number(form.estado) === 1;
    const esPrincipal = Number(form.principal) === 1;

    const cargarDataFormulario = async () => {
        try {
            setCargandoData(true);

            const res = await fetch(
                `${API_BASE_CODIGOS}InventarioCodigosBarrasFormData.php`,
                { cache: "no-store" }
            );

            const json = await res.json();

            if (!json.rpta) {
                toast.error(
                    json.mensaje || "No se pudieron cargar los datos del formulario"
                );
                return;
            }

            setProductos(Array.isArray(json.data?.productos) ? json.data.productos : []);
            setTiposCodigo(
                Array.isArray(json.data?.tiposCodigo) ? json.data.tiposCodigo : []
            );
        } catch (error) {
            console.error(error);
            toast.error("Error al cargar los datos del formulario");
        } finally {
            setCargandoData(false);
        }
    };

    useEffect(() => {
        if (!codigoEditar?.id) {
            toast.warning("No se recibió el código de barras seleccionado");
            estadoPagina("CodigosBarrasInventario");
            return;
        }

        cargarDataFormulario();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;

        const camposNumericos = ["principal", "estado"];

        setForm((prev) => ({
            ...prev,
            [name]:
                name === "tipoCodigo"
                    ? value.toUpperCase()
                    : camposNumericos.includes(name)
                        ? Number(value)
                        : value,
        }));
    };

    const seleccionarProducto = (producto) => {
        setForm((prev) => ({
            ...prev,
            idProducto: Number(producto.id),
        }));

        setModalProductos(false);
        setBusquedaProducto("");
    };

    const validarFormulario = () => {
        if (!form.id) {
            toast.warning("No se encontró el ID del código de barras");
            return false;
        }

        if (!form.idProducto) {
            toast.warning("Debes seleccionar un producto");
            return false;
        }

        if (!form.codigoBarras.trim()) {
            toast.warning("Debes escribir el código de barras");
            return false;
        }

        if (!form.tipoCodigo.trim()) {
            toast.warning("Debes seleccionar el tipo de código");
            return false;
        }

        return true;
    };

    const guardarCodigo = async (e) => {
        e.preventDefault();

        if (!validarFormulario()) return;

        try {
            setGuardando(true);

            const payload = {
                id: Number(form.id),
                idProducto: Number(form.idProducto),
                codigoBarras: form.codigoBarras.trim(),
                tipoCodigo: form.tipoCodigo.trim().toUpperCase(),
                principal: Number(form.principal),
                observacion: form.observacion.trim(),
                estado: Number(form.estado),
            };

            const res = await fetch(
                `${API_BASE_CODIGOS}InventarioCodigosBarrasGuardar.php`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json; charset=utf-8",
                    },
                    body: JSON.stringify(payload),
                }
            );

            const json = await res.json();

            if (!json.rpta) {
                toast.error(json.mensaje || "No se pudo actualizar el código de barras");
                return;
            }

            localStorage.removeItem("codigoBarrasInventarioEditar");
            toast.success(json.mensaje || "Código de barras actualizado correctamente");
            estadoPagina("CodigosBarrasInventario");
        } catch (error) {
            console.error(error);
            toast.error("Ocurrió un error al actualizar el código de barras");
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

                <h1 className="text-lg font-bold">Editar código de barras</h1>
            </div>

            <article className="flex-1 bg-white shadow-lg rounded-2xl flex flex-col overflow-hidden border border-slate-200">
                <nav className="w-full px-6 py-5 border-b border-slate-200 bg-white">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={() => estadoPagina("CodigosBarrasInventario")}
                                className="h-10 w-10 flex items-center justify-center border border-slate-300 rounded-xl bg-white hover:bg-slate-100 transition-colors"
                            >
                                <FaArrowLeft className="text-slate-700" />
                            </button>

                            <div className="h-12 w-12 rounded-2xl bg-blue-800 text-white flex items-center justify-center shadow-sm">
                                <FaBarcode className="text-xl" />
                            </div>

                            <div>
                                <h1 className="text-[calc(0.9rem+0.7vw)] font-bold text-slate-800">
                                    Editar código de barras
                                </h1>

                                <p className="text-sm text-slate-500">
                                    Actualiza el producto asociado y la información del código.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={guardarCodigo}
                            disabled={guardando || cargandoData}
                            className="px-5 py-2.5 bg-blue-800 text-white rounded-xl hover:bg-blue-900 flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm font-semibold"
                        >
                            <FaSave />
                            {guardando ? "Guardando..." : "Guardar cambios"}
                        </button>
                    </div>
                </nav>

                <form
                    onSubmit={guardarCodigo}
                    className="flex-1 overflow-y-auto no-scrollbar bg-slate-50"
                >
                    <div className="p-6">
                        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_390px] gap-6 items-start">
                            <section className="min-w-0">
                                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
                                            <FaClipboardList />
                                        </div>

                                        <div>
                                            <h2 className="text-base lg:text-lg font-bold text-slate-800">
                                                Información del código
                                            </h2>
                                            <p className="text-sm text-slate-500">
                                                Modifica el producto asociado, el código, tipo y estado.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-5 space-y-4">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-sm font-semibold text-slate-700">
                                                Producto <span className="text-red-500">*</span>
                                            </label>

                                            <div className="rounded-2xl border border-slate-300 bg-white p-4">
                                                {form.idProducto ? (
                                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                                        <div className="flex items-start gap-3">
                                                            <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center shrink-0">
                                                                <FaBoxOpen />
                                                            </div>

                                                            <div>
                                                                <p className="font-bold text-slate-800">
                                                                    {productoVista?.nombreProducto ||
                                                                        "Producto seleccionado"}
                                                                </p>

                                                                <p className="text-xs text-slate-500 mt-0.5">
                                                                    Código: {productoVista?.codigo || "—"}
                                                                </p>

                                                                <p className="text-xs text-slate-400 mt-0.5">
                                                                    {productoVista?.codigoGrupo || "Sin grupo"} ·{" "}
                                                                    {productoVista?.categoriaProducto ||
                                                                        "Sin categoría"} ·{" "}
                                                                    {productoVista?.tipoProductoInventario ||
                                                                        "Sin tipo inventario"}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() => setModalProductos(true)}
                                                            className="h-10 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold inline-flex items-center justify-center gap-2"
                                                        >
                                                            <FaSearch />
                                                            Cambiar
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => setModalProductos(true)}
                                                        disabled={cargandoData}
                                                        className="w-full h-12 rounded-xl border border-dashed border-blue-300 bg-blue-50/60 hover:bg-blue-50 text-blue-800 font-semibold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                                    >
                                                        <FaSearch />
                                                        {cargandoData
                                                            ? "Cargando productos..."
                                                            : "Buscar y seleccionar producto"}
                                                    </button>
                                                )}
                                            </div>

                                            <span className="text-xs text-slate-400">
                                                Puedes cambiar el producto asociado desde el modal.
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-semibold text-slate-700">
                                                    Código de barras <span className="text-red-500">*</span>
                                                </label>

                                                <div className="relative">
                                                    <FaBarcode className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-700 text-sm" />

                                                    <input
                                                        type="text"
                                                        name="codigoBarras"
                                                        value={form.codigoBarras}
                                                        onChange={handleChange}
                                                        className="h-11 w-full border border-slate-300 bg-white rounded-xl pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                                        placeholder="Ej: 7701234567890"
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-semibold text-slate-700">
                                                    Tipo de código <span className="text-red-500">*</span>
                                                </label>

                                                <div className="relative">
                                                    <FaBoxes className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />

                                                    <select
                                                        name="tipoCodigo"
                                                        value={form.tipoCodigo}
                                                        onChange={handleChange}
                                                        disabled={cargandoData}
                                                        className="h-11 w-full border border-slate-300 bg-white rounded-xl pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition disabled:bg-slate-100 disabled:text-slate-400"
                                                    >
                                                        {tiposCodigo.length === 0 ? (
                                                            <option value="UNIDAD">UNIDAD</option>
                                                        ) : (
                                                            tiposCodigo.map((item) => (
                                                                <option key={item.codigo} value={item.codigo}>
                                                                    {item.nombre || item.codigo}
                                                                </option>
                                                            ))
                                                        )}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-semibold text-slate-700">
                                                    Código principal
                                                </label>

                                                <div className="relative">
                                                    {esPrincipal ? (
                                                        <FaStar className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-600 text-sm" />
                                                    ) : (
                                                        <FaRegStar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />
                                                    )}

                                                    <select
                                                        name="principal"
                                                        value={form.principal}
                                                        onChange={handleChange}
                                                        className="h-11 w-full border border-slate-300 bg-white rounded-xl pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                                    >
                                                        <option value={0}>NO</option>
                                                        <option value={1}>SÍ</option>
                                                    </select>
                                                </div>

                                                <span className="text-xs text-slate-400">
                                                    Si se marca como principal, reemplaza el principal
                                                    actual del producto.
                                                </span>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-semibold text-slate-700">
                                                    Estado <span className="text-red-500">*</span>
                                                </label>

                                                <div className="relative">
                                                    <span
                                                        className={`absolute left-3 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full ${esActivo ? "bg-emerald-500" : "bg-red-500"
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
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-sm font-semibold text-slate-700">
                                                Observación
                                            </label>

                                            <textarea
                                                name="observacion"
                                                value={form.observacion}
                                                onChange={handleChange}
                                                rows={6}
                                                className="w-full border border-slate-300 bg-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition resize-none"
                                                placeholder="Observaciones internas del código de barras"
                                            />

                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-slate-400">
                                                <span>Campo opcional para información interna.</span>
                                                <span>{form.observacion.length} caracteres</span>
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
                                                    <FaBarcode className="text-xl" />
                                                </div>

                                                <div className="min-w-0">
                                                    <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">
                                                        Código seleccionado
                                                    </p>

                                                    <h2 className="text-xl font-bold text-slate-800 break-words">
                                                        {form.codigoBarras || "—"}
                                                    </h2>
                                                </div>
                                            </div>

                                            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                                <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">
                                                    Producto
                                                </p>

                                                <p className="mt-1 text-sm font-semibold text-slate-800 break-words">
                                                    {productoVista?.nombreProducto ||
                                                        "Sin producto seleccionado"}
                                                </p>

                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {productoVista?.codigo
                                                        ? `Código: ${productoVista.codigo}`
                                                        : "Seleccione un producto para ver su detalle"}
                                                </p>
                                            </div>

                                            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                                <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">
                                                    Detalle del código
                                                </p>

                                                <div className="mt-3 flex flex-wrap gap-2">
                                                    <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold border bg-slate-50 text-slate-700 border-slate-200">
                                                        <FaBoxes />
                                                        {form.tipoCodigo || "UNIDAD"}
                                                    </span>

                                                    <span
                                                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold border ${esPrincipal
                                                            ? "bg-amber-50 text-amber-700 border-amber-200"
                                                            : "bg-slate-50 text-slate-500 border-slate-200"
                                                            }`}
                                                    >
                                                        {esPrincipal ? <FaStar /> : <FaRegStar />}
                                                        Principal {esPrincipal ? "SÍ" : "NO"}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                                <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">
                                                    Estado
                                                </p>

                                                <div
                                                    className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold border ${esActivo
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                        : "bg-red-50 text-red-700 border-red-200"
                                                        }`}
                                                >
                                                    <FaCheckCircle />
                                                    {esActivo ? "ACTIVO" : "INACTIVO"}
                                                </div>
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
                                                Si cambias el producto asociado, valida si el código debe
                                                quedar como principal para ese nuevo producto.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </aside>
                        </div>

                        <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3 border-t border-slate-200 pt-5">
                            <button
                                type="button"
                                onClick={() => estadoPagina("CodigosBarrasInventario")}
                                className="px-5 py-2.5 border border-slate-300 rounded-xl bg-white hover:bg-slate-100 transition-colors font-semibold text-slate-700"
                            >
                                Cancelar
                            </button>

                            <button
                                type="submit"
                                disabled={guardando || cargandoData}
                                className="px-5 py-2.5 bg-blue-800 text-white rounded-xl hover:bg-blue-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold shadow-sm"
                            >
                                <FaSave />
                                {guardando ? "Guardando..." : "Guardar cambios"}
                            </button>
                        </div>
                    </div>
                </form>
            </article>

            {modalProductos && (
                <div className="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center p-4">
                    <div className="w-full max-w-5xl max-h-[88vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
                        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
                                    <FaBoxOpen />
                                </div>

                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">
                                        Seleccionar producto
                                    </h2>
                                    <p className="text-sm text-slate-500">
                                        Busca por código, nombre, grupo, categoría o tipo.
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setModalProductos(false);
                                    setBusquedaProducto("");
                                }}
                                className="h-10 w-10 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center"
                            >
                                <FaTimes className="text-slate-600" />
                            </button>
                        </div>

                        <div className="p-5 border-b border-slate-200 bg-slate-50">
                            <div className="relative">
                                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />

                                <input
                                    type="text"
                                    value={busquedaProducto}
                                    onChange={(e) => setBusquedaProducto(e.target.value)}
                                    autoFocus
                                    className="w-full h-12 rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-800"
                                    placeholder="Buscar producto..."
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 bg-white">
                            {productosFiltrados.length === 0 ? (
                                <div className="py-12 text-center text-slate-500">
                                    No se encontraron productos.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {productosFiltrados.map((item) => {
                                        const seleccionado =
                                            Number(item.id) === Number(form.idProducto);

                                        const requiereFrio =
                                            String(item.tipoProductoInventario || "")
                                                .toLowerCase()
                                                .includes("frio") ||
                                            String(item.tipoProductoInventario || "")
                                                .toLowerCase()
                                                .includes("frío") ||
                                            String(item.tipoProductoInventario || "")
                                                .toLowerCase()
                                                .includes("congelado") ||
                                            String(item.tipoProductoInventario || "")
                                                .toLowerCase()
                                                .includes("refrigerado");

                                        return (
                                            <button
                                                type="button"
                                                key={item.id}
                                                onClick={() => seleccionarProducto(item)}
                                                className={`group text-left rounded-2xl border p-4 transition-all duration-200 relative overflow-hidden ${seleccionado
                                                    ? "border-blue-700 bg-blue-50 shadow-md ring-2 ring-blue-100"
                                                    : requiereFrio
                                                        ? "border-sky-200 bg-sky-50/60 hover:bg-sky-50 hover:border-sky-300"
                                                        : "border-slate-200 bg-white hover:bg-blue-50/40 hover:border-blue-200 hover:shadow-sm"
                                                    }`}
                                            >
                                                <div
                                                    className={`absolute left-0 top-0 h-full w-1.5 ${seleccionado
                                                        ? "bg-blue-800"
                                                        : requiereFrio
                                                            ? "bg-sky-500"
                                                            : "bg-slate-300 group-hover:bg-blue-500"
                                                        }`}
                                                ></div>

                                                <div className="flex items-start gap-3 pl-2">
                                                    <div
                                                        className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${seleccionado
                                                            ? "bg-blue-800 text-white"
                                                            : requiereFrio
                                                                ? "bg-sky-100 text-sky-700"
                                                                : "bg-blue-50 text-blue-800"
                                                            }`}
                                                    >
                                                        {seleccionado ? <FaCheck /> : <FaBoxOpen />}
                                                    </div>

                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <p className="font-bold text-slate-800 break-words">
                                                                    {item.nombreProducto || "Sin nombre"}
                                                                </p>

                                                                <p className="text-xs text-slate-500 mt-0.5">
                                                                    Código:{" "}
                                                                    <span className="font-bold text-slate-700">
                                                                        {item.codigo || "—"}
                                                                    </span>
                                                                </p>
                                                            </div>

                                                            {seleccionado && (
                                                                <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-blue-800 text-white px-2.5 py-1 text-[11px] font-bold">
                                                                    <FaCheck />
                                                                    Seleccionado
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="mt-3 flex flex-wrap gap-2">
                                                            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">
                                                                {item.codigoGrupo || "Sin grupo"}
                                                            </span>

                                                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                                                                {item.categoriaProducto || "Sin categoría"}
                                                            </span>

                                                            <span
                                                                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${requiereFrio
                                                                    ? "border-sky-200 bg-sky-100 text-sky-700"
                                                                    : "border-blue-200 bg-blue-50 text-blue-700"
                                                                    }`}
                                                            >
                                                                <FaLayerGroup />
                                                                {item.tipoProductoInventario ||
                                                                    "Sin tipo inventario"}
                                                            </span>
                                                        </div>

                                                        {(item.embalajeNombre || item.uniCaja) && (
                                                            <p className="mt-2 text-xs text-slate-500">
                                                                Embalaje: {item.embalajeNombre || "—"}
                                                                {item.uniCaja ? ` / ${item.uniCaja} und.` : ""}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};