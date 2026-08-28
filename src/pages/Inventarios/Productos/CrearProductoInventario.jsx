import React, { useEffect, useMemo, useState } from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaArrowLeft,
    FaSave,
    FaBoxOpen,
    FaClipboardList,
    FaLayerGroup,
    FaBoxes,
    FaWarehouse,
    FaInfoCircle,
    FaCalendarAlt,
    FaSnowflake,
    FaCheckCircle,
} from "react-icons/fa";
import { toast } from "react-toastify";

const API_BASE_PRODUCTOS =
    "https://app.accionporcolombia.com/servicesPae/Inventario/Productos/";

export const CrearProductoInventario = ({ setSidebar, navegar }) => {
    const abrirMenu = () => setSidebar(true);
    const estadoPagina = (pagina) => navegar(pagina);

    const [guardando, setGuardando] = useState(false);
    const [cargandoData, setCargandoData] = useState(false);

    const [grupos, setGrupos] = useState([]);
    const [embalajes, setEmbalajes] = useState([]);
    const [tiposProducto, setTiposProducto] = useState([]);

    const [form, setForm] = useState({
        codigo: "",
        descripcion: "",
        idGrupo: "",
        idEmbalaje: "",
        observacionProducto: "",
        estadoProducto: 1,

        idTipoProductoInventario: "",
        manejaLote: 0,
        manejaVencimiento: 0,
        stockMinimo: 0,
        stockMaximo: "",
        unidadBaseInventario: "UND",
        observacionInventario: "",
        estadoConfig: 1,
    });

    const grupoSeleccionado = useMemo(() => {
        return grupos.find((item) => Number(item.id) === Number(form.idGrupo));
    }, [grupos, form.idGrupo]);

    const embalajeSeleccionado = useMemo(() => {
        return embalajes.find(
            (item) => Number(item.id) === Number(form.idEmbalaje)
        );
    }, [embalajes, form.idEmbalaje]);

    const tipoSeleccionado = useMemo(() => {
        return tiposProducto.find(
            (item) => Number(item.id) === Number(form.idTipoProductoInventario)
        );
    }, [tiposProducto, form.idTipoProductoInventario]);

    const esActivo = Number(form.estadoProducto) === 1;
    const manejaLote = Number(form.manejaLote) === 1;
    const manejaVencimiento = Number(form.manejaVencimiento) === 1;

    const cargarDataFormulario = async () => {
        try {
            setCargandoData(true);

            const res = await fetch(
                `${API_BASE_PRODUCTOS}InventarioProductosFormData.php`,
                { cache: "no-store" }
            );

            const json = await res.json();

            if (!json.rpta) {
                toast.error(
                    json.mensaje || "No se pudieron cargar los datos del formulario"
                );
                return;
            }

            setGrupos(Array.isArray(json.data?.grupos) ? json.data.grupos : []);
            setEmbalajes(
                Array.isArray(json.data?.embalajes) ? json.data.embalajes : []
            );
            setTiposProducto(
                Array.isArray(json.data?.tiposProducto) ? json.data.tiposProducto : []
            );
        } catch (error) {
            console.error(error);
            toast.error("Error al cargar los datos del formulario");
        } finally {
            setCargandoData(false);
        }
    };

    useEffect(() => {
        cargarDataFormulario();
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;

        const camposNumericos = [
            "idGrupo",
            "idEmbalaje",
            "idTipoProductoInventario",
            "manejaLote",
            "manejaVencimiento",
            "estadoProducto",
            "estadoConfig",
        ];

        setForm((prev) => ({
            ...prev,
            [name]:
                name === "codigo"
                    ? value.toUpperCase()
                    : camposNumericos.includes(name)
                        ? value === ""
                            ? ""
                            : Number(value)
                        : value,
        }));
    };

    const handleTipoProducto = (e) => {
        const idTipo = Number(e.target.value);
        const tipo = tiposProducto.find((item) => Number(item.id) === idTipo);

        setForm((prev) => ({
            ...prev,
            idTipoProductoInventario: idTipo || "",
            manejaLote: tipo ? Number(tipo.manejaLote) : 0,
            manejaVencimiento: tipo ? Number(tipo.manejaVencimiento) : 0,
        }));
    };

    const validarFormulario = () => {
        if (!form.codigo.trim()) {
            toast.warning("Debes escribir el código del producto");
            return false;
        }

        if (!form.descripcion.trim()) {
            toast.warning("Debes escribir el nombre o descripción del producto");
            return false;
        }

        if (!form.idGrupo) {
            toast.warning("Debes seleccionar el grupo del producto");
            return false;
        }

        if (!form.idTipoProductoInventario) {
            toast.warning("Debes seleccionar el tipo de producto de inventario");
            return false;
        }

        if (!form.unidadBaseInventario.trim()) {
            toast.warning("Debes escribir la unidad base de inventario");
            return false;
        }

        const stockMinimo = Number(form.stockMinimo || 0);
        const stockMaximo =
            form.stockMaximo === "" || form.stockMaximo === null
                ? null
                : Number(form.stockMaximo);

        if (Number.isNaN(stockMinimo) || stockMinimo < 0) {
            toast.warning("El stock mínimo no puede ser negativo");
            return false;
        }

        if (stockMaximo !== null && (Number.isNaN(stockMaximo) || stockMaximo < 0)) {
            toast.warning("El stock máximo no puede ser negativo");
            return false;
        }

        if (stockMaximo !== null && stockMaximo < stockMinimo) {
            toast.warning("El stock máximo no puede ser menor al stock mínimo");
            return false;
        }

        return true;
    };

    const guardarProducto = async (e) => {
        e.preventDefault();

        if (!validarFormulario()) return;

        try {
            setGuardando(true);

            const payload = {
                idProducto: 0,

                codigo: form.codigo.trim().toUpperCase(),
                descripcion: form.descripcion.trim().toUpperCase(),
                idGrupo: Number(form.idGrupo),
                idEmbalaje: form.idEmbalaje ? Number(form.idEmbalaje) : 0,
                observacionProducto: form.observacionProducto.trim(),
                estadoProducto: Number(form.estadoProducto),

                idTipoProductoInventario: Number(form.idTipoProductoInventario),
                manejaLote: Number(form.manejaLote),
                manejaVencimiento: Number(form.manejaVencimiento),
                stockMinimo: Number(form.stockMinimo || 0),
                stockMaximo:
                    form.stockMaximo === "" || form.stockMaximo === null
                        ? null
                        : Number(form.stockMaximo),
                unidadBaseInventario: form.unidadBaseInventario.trim().toUpperCase(),
                observacionInventario: form.observacionInventario.trim(),
                estadoConfig: Number(form.estadoConfig),
            };

            const res = await fetch(
                `${API_BASE_PRODUCTOS}InventarioProductosGuardar.php`,
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
                toast.error(json.mensaje || "No se pudo guardar el producto");
                return;
            }

            toast.success(json.mensaje || "Producto creado correctamente");
            estadoPagina("ProductosInventario");
        } catch (error) {
            console.error(error);
            toast.error("Ocurrió un error al guardar el producto");
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

                <h1 className="text-lg font-bold">Crear producto</h1>
            </div>

            <article className="flex-1 bg-white shadow-lg rounded-2xl flex flex-col overflow-hidden border border-slate-200">
                <nav className="w-full px-6 py-5 border-b border-slate-200 bg-white">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={() => estadoPagina("ProductosInventario")}
                                className="h-10 w-10 flex items-center justify-center border border-slate-300 rounded-xl bg-white hover:bg-slate-100 transition-colors"
                            >
                                <FaArrowLeft className="text-slate-700" />
                            </button>

                            <div className="h-12 w-12 rounded-2xl bg-blue-800 text-white flex items-center justify-center shadow-sm">
                                <FaBoxOpen className="text-xl" />
                            </div>

                            <div>
                                <h1 className="text-[calc(0.9rem+0.7vw)] font-bold text-slate-800">
                                    Crear producto
                                </h1>

                                <p className="text-sm text-slate-500">
                                    Registra el producto base y su configuración para inventario.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={guardarProducto}
                            disabled={guardando || cargandoData}
                            className="px-5 py-2.5 bg-blue-800 text-white rounded-xl hover:bg-blue-900 flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm font-semibold"
                        >
                            <FaSave />
                            {guardando ? "Guardando..." : "Guardar producto"}
                        </button>
                    </div>
                </nav>

                <form
                    onSubmit={guardarProducto}
                    className="flex-1 overflow-y-auto no-scrollbar bg-slate-50"
                >
                    <div className="p-6">
                        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_390px] gap-6 items-start">
                            <section className="min-w-0 space-y-6">
                                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
                                            <FaClipboardList />
                                        </div>

                                        <div>
                                            <h2 className="text-base lg:text-lg font-bold text-slate-800">
                                                Información del producto
                                            </h2>
                                            <p className="text-sm text-slate-500">
                                                Datos base que se guardarán en el catálogo de productos.
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
                                                    <FaBoxOpen className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-700 text-sm" />

                                                    <input
                                                        type="text"
                                                        name="codigo"
                                                        value={form.codigo}
                                                        onChange={handleChange}
                                                        className="h-11 w-full border border-slate-300 bg-white rounded-xl pl-10 pr-3 text-sm uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                                        placeholder="Ej: PROD001"
                                                    />
                                                </div>

                                                <span className="text-xs text-slate-400">
                                                    Código único del producto.
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
                                                        name="estadoProducto"
                                                        value={form.estadoProducto}
                                                        onChange={handleChange}
                                                        className="h-11 w-full border border-slate-300 bg-white rounded-xl pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                                    >
                                                        <option value={1}>ACTIVO</option>
                                                        <option value={0}>INACTIVO</option>
                                                    </select>
                                                </div>

                                                <span className="text-xs text-slate-400">
                                                    Controla si el producto estará disponible.
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-sm font-semibold text-slate-700">
                                                Nombre / descripción{" "}
                                                <span className="text-red-500">*</span>
                                            </label>

                                            <div className="relative">
                                                <FaClipboardList className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />

                                                <input
                                                    type="text"
                                                    name="descripcion"
                                                    value={form.descripcion}
                                                    onChange={handleChange}
                                                    className="h-11 w-full border border-slate-300 bg-white rounded-xl pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                                    placeholder="Ej: ARROZ BLANCO X 500 GR"
                                                />
                                            </div>

                                            <span className="text-xs text-slate-400">
                                                Este nombre será visible en el catálogo y en inventario.
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-semibold text-slate-700">
                                                    Grupo <span className="text-red-500">*</span>
                                                </label>

                                                <div className="relative">
                                                    <FaLayerGroup className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-700 text-sm" />

                                                    <select
                                                        name="idGrupo"
                                                        value={form.idGrupo}
                                                        onChange={handleChange}
                                                        disabled={cargandoData}
                                                        className="h-11 w-full border border-slate-300 bg-white rounded-xl pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition disabled:bg-slate-100 disabled:text-slate-400"
                                                    >
                                                        <option value="">
                                                            {cargandoData
                                                                ? "Cargando grupos..."
                                                                : "Seleccione grupo"}
                                                        </option>

                                                        {grupos.map((item) => (
                                                            <option key={item.id} value={item.id}>
                                                                {item.codigo}
                                                                {item.categoriaProducto
                                                                    ? ` - ${item.categoriaProducto}`
                                                                    : ""}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <span className="text-xs text-slate-400">
                                                    Clasificación principal del producto.
                                                </span>
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-semibold text-slate-700">
                                                    Embalaje
                                                </label>

                                                <div className="relative">
                                                    <FaBoxes className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />

                                                    <select
                                                        name="idEmbalaje"
                                                        value={form.idEmbalaje}
                                                        onChange={handleChange}
                                                        disabled={cargandoData}
                                                        className="h-11 w-full border border-slate-300 bg-white rounded-xl pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition disabled:bg-slate-100 disabled:text-slate-400"
                                                    >
                                                        <option value="">
                                                            {cargandoData
                                                                ? "Cargando embalajes..."
                                                                : "Seleccione embalaje"}
                                                        </option>

                                                        {embalajes.map((item) => (
                                                            <option key={item.id} value={item.id}>
                                                                {item.productoBase || "Producto"}
                                                                {item.presentacion
                                                                    ? ` / ${item.presentacion}`
                                                                    : ""}
                                                                {item.embalaje ? ` / ${item.embalaje}` : ""}
                                                                {item.uniCaja ? ` / ${item.uniCaja} und.` : ""}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <span className="text-xs text-slate-400">
                                                    Presentación o empaque del producto.
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-sm font-semibold text-slate-700">
                                                Observación del producto
                                            </label>

                                            <textarea
                                                name="observacionProducto"
                                                value={form.observacionProducto}
                                                onChange={handleChange}
                                                rows={4}
                                                className="w-full border border-slate-300 bg-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition resize-none"
                                                placeholder="Observaciones internas del producto"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
                                            <FaWarehouse />
                                        </div>

                                        <div>
                                            <h2 className="text-base lg:text-lg font-bold text-slate-800">
                                                Configuración de inventario
                                            </h2>
                                            <p className="text-sm text-slate-500">
                                                Define cómo se controlará este producto en inventario.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="p-5 space-y-4">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-sm font-semibold text-slate-700">
                                                Tipo de producto{" "}
                                                <span className="text-red-500">*</span>
                                            </label>

                                            <div className="relative">
                                                <FaLayerGroup className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-700 text-sm" />

                                                <select
                                                    name="idTipoProductoInventario"
                                                    value={form.idTipoProductoInventario}
                                                    onChange={handleTipoProducto}
                                                    disabled={cargandoData}
                                                    className="h-11 w-full border border-slate-300 bg-white rounded-xl pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition disabled:bg-slate-100 disabled:text-slate-400"
                                                >
                                                    <option value="">
                                                        {cargandoData
                                                            ? "Cargando tipos..."
                                                            : "Seleccione tipo"}
                                                    </option>

                                                    {tiposProducto.map((item) => (
                                                        <option key={item.id} value={item.id}>
                                                            {item.codigo} - {item.nombre}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <span className="text-xs text-slate-400">
                                                Al seleccionar el tipo se toman sus reglas base de lote y
                                                vencimiento.
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
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-semibold text-slate-700">
                                                    Stock mínimo
                                                </label>

                                                <input
                                                    type="number"
                                                    name="stockMinimo"
                                                    value={form.stockMinimo}
                                                    onChange={handleChange}
                                                    min="0"
                                                    step="0.01"
                                                    className="h-11 w-full border border-slate-300 bg-white rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                                    placeholder="0"
                                                />
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-semibold text-slate-700">
                                                    Stock máximo
                                                </label>

                                                <input
                                                    type="number"
                                                    name="stockMaximo"
                                                    value={form.stockMaximo}
                                                    onChange={handleChange}
                                                    min="0"
                                                    step="0.01"
                                                    className="h-11 w-full border border-slate-300 bg-white rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                                    placeholder="Opcional"
                                                />
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-semibold text-slate-700">
                                                    Unidad base <span className="text-red-500">*</span>
                                                </label>

                                                <input
                                                    type="text"
                                                    name="unidadBaseInventario"
                                                    value={form.unidadBaseInventario}
                                                    onChange={handleChange}
                                                    className="h-11 w-full border border-slate-300 bg-white rounded-xl px-4 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                                    placeholder="UND, KG, CAJA, LT"
                                                />
                                            </div>

                                            <div className="flex flex-col gap-1.5">
                                                <label className="text-sm font-semibold text-slate-700">
                                                    Estado inventario
                                                </label>

                                                <select
                                                    name="estadoConfig"
                                                    value={form.estadoConfig}
                                                    onChange={handleChange}
                                                    className="h-11 w-full border border-slate-300 bg-white rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                                >
                                                    <option value={1}>ACTIVO</option>
                                                    <option value={0}>INACTIVO</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-sm font-semibold text-slate-700">
                                                Observación de inventario
                                            </label>

                                            <textarea
                                                name="observacionInventario"
                                                value={form.observacionInventario}
                                                onChange={handleChange}
                                                rows={4}
                                                className="w-full border border-slate-300 bg-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition resize-none"
                                                placeholder="Observaciones internas para control de inventario"
                                            />
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
                                                    <FaBoxOpen className="text-xl" />
                                                </div>

                                                <div className="min-w-0">
                                                    <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">
                                                        Nuevo producto
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
                                                    {form.descripcion || "Sin nombre"}
                                                </p>
                                            </div>

                                            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                                <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">
                                                    Clasificación
                                                </p>

                                                <p className="mt-1 text-sm font-semibold text-slate-800">
                                                    {grupoSeleccionado?.codigo || "Sin grupo"}
                                                </p>

                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {grupoSeleccionado?.categoriaProducto ||
                                                        "Sin categoría"}
                                                </p>
                                            </div>

                                            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                                <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">
                                                    Embalaje
                                                </p>

                                                <p className="mt-1 text-sm font-semibold text-slate-800 break-words">
                                                    {embalajeSeleccionado
                                                        ? `${embalajeSeleccionado.productoBase || ""} ${embalajeSeleccionado.presentacion || ""
                                                        }`
                                                        : "Sin embalaje"}
                                                </p>

                                                {embalajeSeleccionado?.embalaje && (
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        {embalajeSeleccionado.embalaje}
                                                        {embalajeSeleccionado.uniCaja
                                                            ? ` / ${embalajeSeleccionado.uniCaja} und.`
                                                            : ""}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                                <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">
                                                    Tipo inventario
                                                </p>

                                                <p className="mt-1 text-sm font-semibold text-slate-800 break-words">
                                                    {tipoSeleccionado
                                                        ? `${tipoSeleccionado.codigo} - ${tipoSeleccionado.nombre}`
                                                        : "Sin tipo seleccionado"}
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

                                                    {Number(tipoSeleccionado?.requiereBodegaFria) ===
                                                        1 && (
                                                            <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold border bg-sky-50 text-sky-700 border-sky-200">
                                                                <FaSnowflake />
                                                                Bodega fría
                                                            </span>
                                                        )}
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
                                                Primero registra los datos base del producto y luego
                                                confirma su tipo de inventario. Esa configuración será
                                                usada en lotes, existencias, entradas y salidas.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </aside>
                        </div>

                        <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3 border-t border-slate-200 pt-5">
                            <button
                                type="button"
                                onClick={() => estadoPagina("ProductosInventario")}
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
                                {guardando ? "Guardando..." : "Guardar producto"}
                            </button>
                        </div>
                    </div>
                </form>
            </article>
        </div>
    );
};