import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { API_BASE } from "../../constants";
import { toast } from "react-toastify";

const norm = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const normUpper = (v) => norm(v).toUpperCase();

const HEADERS_EQUIV = {
    grupo: ["GRUPO"],
    item1: ["ITEM 1", "ITEM1", "CODIGO", "CÓDIGO"],
    descripcion: ["DESCRIPCIÓN", "DESCRIPCION", "PRODUCTO", "NOMBRE"],
    item2: ["ITEM 2", "ITEM2", "CATEGORIA", "CATEGORÍA"],
};

const buscarIndiceColumna = (headers, aliases = []) => {
    const up = headers.map((h) => normUpper(h));
    return up.findIndex((h) => aliases.includes(h));
};

const obtenerHojaCatalogo = (wb) => {
    const preferidas = ["Items", "ITEMS", "Items 2", "ITEMS 2"];
    for (const nombre of preferidas) {
        const found = wb.SheetNames.find((s) => normUpper(s) === normUpper(nombre));
        if (found) return found;
    }
    return wb.SheetNames[0] || null;
};

const parsearCatalogoDesdeWorkbook = (wb) => {
    const hoja = obtenerHojaCatalogo(wb);
    if (!hoja) {
        throw new Error("El archivo no contiene hojas.");
    }

    const ws = wb.Sheets[hoja];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

    if (!rows.length) {
        throw new Error("La hoja seleccionada no contiene información.");
    }

    const headerRowIdx = rows.findIndex((row) => {
        const up = (row || []).map((c) => normUpper(c));
        return (
            up.some((c) => HEADERS_EQUIV.grupo.includes(c)) &&
            up.some((c) => HEADERS_EQUIV.item1.includes(c)) &&
            up.some((c) => HEADERS_EQUIV.descripcion.includes(c))
        );
    });

    if (headerRowIdx === -1) {
        throw new Error(
            "No encontré encabezados válidos. Deben existir al menos Grupo, Item 1 y Descripción."
        );
    }

    const headers = (rows[headerRowIdx] || []).map((c) => norm(c));
    const colGrupo = buscarIndiceColumna(headers, HEADERS_EQUIV.grupo);
    const colItem1 = buscarIndiceColumna(headers, HEADERS_EQUIV.item1);
    const colDescripcion = buscarIndiceColumna(headers, HEADERS_EQUIV.descripcion);
    const colItem2 = buscarIndiceColumna(headers, HEADERS_EQUIV.item2);

    if (colGrupo === -1 || colItem1 === -1 || colDescripcion === -1) {
        throw new Error("No pude mapear correctamente las columnas Grupo, Item 1 y Descripción.");
    }

    const productosRaw = [];
    const errores = [];
    const conflictosGrupoCategoria = [];

    const grupoCategoriaMap = new Map();
    const categoriaSet = new Set();
    const grupoSet = new Set();

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i] || [];

        const grupo = norm(row[colGrupo]);
        const codigo = norm(row[colItem1]);
        const descripcion = norm(row[colDescripcion]);
        const categoria = colItem2 !== -1 ? norm(row[colItem2]) : "";

        const filaVacia = !grupo && !codigo && !descripcion && !categoria;
        if (filaVacia) continue;

        if (!grupo || !codigo || !descripcion) {
            errores.push({
                filaExcel: i + 1,
                motivo: "Fila incompleta",
                grupo,
                codigo,
                descripcion,
                categoria,
            });
            continue;
        }

        if (grupoCategoriaMap.has(grupo)) {
            const categoriaAnterior = grupoCategoriaMap.get(grupo);
            if (normUpper(categoriaAnterior) !== normUpper(categoria || categoriaAnterior)) {
                conflictosGrupoCategoria.push({
                    filaExcel: i + 1,
                    grupo,
                    categoriaAnterior,
                    categoriaActual: categoria || "SIN CATEGORÍA",
                });
            }
        } else {
            grupoCategoriaMap.set(grupo, categoria || "SIN CATEGORÍA");
        }

        categoriaSet.add(categoria || "SIN CATEGORÍA");
        grupoSet.add(grupo);

        productosRaw.push({
            filaExcel: i + 1,
            grupo,
            codigo,
            descripcion,
            categoria: categoria || "SIN CATEGORÍA",
        });
    }

    const categorias = Array.from(categoriaSet)
        .map((nombre) => ({
            nombre,
            idEstado: 1,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

    const grupos = Array.from(grupoSet)
        .map((codigoGrupo) => ({
            codigo: codigoGrupo,
            categoriaNombre: grupoCategoriaMap.get(codigoGrupo) || "SIN CATEGORÍA",
            estado: 1,
        }))
        .sort((a, b) => a.codigo.localeCompare(b.codigo, "es"));

    const productos = productosRaw
        .map((p) => ({
            codigo: p.codigo,
            descripcion: p.descripcion,
            grupoCodigo: p.grupo,
            categoriaNombre: p.categoria,
            idEmbalaje: null,
            observacion: null,
            estado: 1,
            idEstado: 1,
        }))
        .sort((a, b) => a.codigo.localeCompare(b.codigo, "es"));

    return {
        hoja,
        headers,
        categorias,
        grupos,
        productos,
        errores,
        conflictosGrupoCategoria,
    };
};

export default function CargadeDatos() {
    const inputRef = useRef(null);

    const [archivo, setArchivo] = useState("");
    const [loading, setLoading] = useState(false);
    const [importando, setImportando] = useState(false);
    const [error, setError] = useState("");
    const [payload, setPayload] = useState(null);
    const [q, setQ] = useState("");
    const [respuestaImportacion, setRespuestaImportacion] = useState(null);

    const productosFiltrados = useMemo(() => {
        if (!payload?.productos?.length) return [];

        const qq = normUpper(q);
        if (!qq) return payload.productos.slice(0, 200);

        return payload.productos
            .filter((p) =>
                `${normUpper(p.codigo)} ${normUpper(p.descripcion)} ${normUpper(
                    p.grupoCodigo
                )} ${normUpper(p.categoriaNombre)}`.includes(qq)
            )
            .slice(0, 200);
    }, [payload, q]);

    const handleFile = async (file) => {
        setArchivo("");
        setError("");
        setPayload(null);
        setQ("");
        setRespuestaImportacion(null);

        if (!file) return;

        try {
            setLoading(true);

            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array" });

            const resultado = parsearCatalogoDesdeWorkbook(wb);

            setArchivo(file.name);
            setPayload(resultado);

            if (resultado.errores.length) {
                toast.warn(`Se detectaron ${resultado.errores.length} filas con novedad.`);
            } else {
                toast.success("Archivo leído correctamente.");
            }
        } catch (e) {
            console.error(e);
            setError(e?.message || "No fue posible leer el archivo.");
            toast.error(e?.message || "Error leyendo el archivo.");
        } finally {
            setLoading(false);
        }
    };

    const importarCatalogo = async () => {
        if (!payload?.productos?.length) {
            toast.warn("No hay productos listos para importar.");
            return;
        }

        if (payload?.errores?.length) {
            toast.warn("Se encontraron novedades, pero puedes continuar.");
        }

        const body = {
            hoja: payload.hoja,
            vaciarTabla: false,
            categorias: payload.categorias,
            grupos: payload.grupos,
            productos: payload.productos,
        };

        try {
            setImportando(true);
            setRespuestaImportacion(null);

            const url = `${API_BASE}Despachos/ProductosCatalogoImportarDesdeExcel.php`;
            console.log("URL:", url);
            console.log("BODY:", body);

            const resp = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(body),
            });

            const rawText = await resp.text();
            console.log("STATUS HTTP:", resp.status);
            console.log("RESPUESTA RAW:", rawText);

            let data = null;
            try {
                data = rawText ? JSON.parse(rawText) : null;
            } catch (parseError) {
                console.error("No se pudo parsear JSON:", parseError);
                throw new Error(
                    `El servicio respondió ${resp.status} pero no devolvió JSON válido. Respuesta: ${rawText}`
                );
            }

            console.log("RESPUESTA JSON:", data);

            if (!resp.ok || !data?.ok) {
                throw new Error(
                    data?.error ||
                    data?.mensaje ||
                    `Error HTTP ${resp.status}`
                );
            }

            setRespuestaImportacion(data);
            toast.success(data?.mensaje || "Catálogo importado correctamente.");
        } catch (e) {
            console.error("Error importando catálogo:", e);
            toast.error(e?.message || "Error importando catálogo.");
        } finally {
            setImportando(false);
        }
    };
    return (
        <article className="w-[95%] h-[95%] flex flex-col gap-5">
            <header className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-3 md:items-end">
                    <div className="flex-1">
                        <h1 className="text-slate-800 font-semibold text-[18px]">
                            Carga catálogo de productos
                        </h1>
                        <p className="text-slate-500 text-[13px]">
                            Lee la hoja Items, clasifica categorías, grupos y productos, y envía
                            todo al servicio para reconstruir el catálogo desde cero.
                        </p>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-100 text-slate-700 text-[13px]"
                        >
                            {loading ? "Leyendo..." : "Cargar Excel"}
                        </button>

                        <button
                            type="button"
                            onClick={importarCatalogo}
                            disabled={!payload?.productos?.length || importando}
                            className="bg-[#cd6155] border border-[#cd6155] rounded-lg px-3 py-2 text-white text-[13px] disabled:opacity-50"
                        >
                            {importando ? "Importando..." : "Montar catálogo"}
                        </button>

                        <input
                            ref={inputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onClick={(e) => {
                                e.currentTarget.value = "";
                            }}
                            onChange={(e) => handleFile(e.target.files?.[0])}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <p className="text-slate-500 text-[12px]">Archivo</p>
                        <p className="text-slate-800 font-semibold text-[13px] truncate">
                            {archivo || "—"}
                        </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <p className="text-slate-500 text-[12px]">Hoja</p>
                        <p className="text-slate-800 font-semibold text-[13px] truncate">
                            {payload?.hoja || "—"}
                        </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <p className="text-slate-500 text-[12px]">Categorías</p>
                        <p className="text-slate-800 font-semibold text-[16px]">
                            {payload?.categorias?.length || 0}
                        </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <p className="text-slate-500 text-[12px]">Grupos</p>
                        <p className="text-slate-800 font-semibold text-[16px]">
                            {payload?.grupos?.length || 0}
                        </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <p className="text-slate-500 text-[12px]">Productos</p>
                        <p className="text-slate-800 font-semibold text-[16px]">
                            {payload?.productos?.length || 0}
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-[13px]">
                        {error}
                    </div>
                )}

                {!!payload?.errores?.length && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800 text-[13px]">
                        Se detectaron <strong>{payload.errores.length}</strong> novedades.
                        Puedes revisarlas, pero ya no bloquean la importación.
                    </div>
                )}

                {!!payload?.conflictosGrupoCategoria?.length && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-orange-800 text-[13px]">
                        Hay grupos asociados a más de una categoría. Se tomará la primera
                        categoría encontrada por grupo.
                    </div>
                )}

                {!!respuestaImportacion?.resumen && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 text-[13px]">
                        <div className="font-semibold mb-1">Importación completada</div>
                        <div>
                            Categorías insertadas:{" "}
                            <strong>
                                {respuestaImportacion.resumen.categorias_insertadas ?? 0}
                            </strong>
                        </div>
                        <div>
                            Grupos insertados:{" "}
                            <strong>
                                {respuestaImportacion.resumen.grupos_insertados ?? 0}
                            </strong>
                        </div>
                        <div>
                            Productos insertados:{" "}
                            <strong>
                                {respuestaImportacion.resumen.productos_insertados ?? 0}
                            </strong>
                        </div>
                        <div>
                            Productos actualizados:{" "}
                            <strong>
                                {respuestaImportacion.resumen.productos_actualizados ?? 0}
                            </strong>
                        </div>
                        <div>
                            Productos omitidos:{" "}
                            <strong>
                                {respuestaImportacion.resumen.productos_omitidos ?? 0}
                            </strong>
                        </div>
                    </div>
                )}

                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                    <label className="text-slate-600 text-[12px]">Buscar producto</label>
                    <input
                        className="w-full bg-transparent outline-none text-slate-800"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Código, descripción, grupo o categoría"
                        disabled={!payload?.productos?.length}
                    />
                </div>
            </header>

            <section className="bg-white border border-slate-200 rounded-xl shadow-sm flex-1 overflow-hidden flex flex-col">
                <div className="px-4 py-3 border-b border-slate-200">
                    <p className="text-slate-800 font-semibold">Vista previa de productos</p>
                    <p className="text-slate-500 text-[12px]">
                        Se muestran máximo 200 registros filtrados.
                    </p>
                </div>

                <div className="flex-1 overflow-auto">
                    <table className="w-full">
                        <thead className="sticky top-0 bg-[#cd6155] z-10">
                            <tr className="text-white">
                                <th className="p-2 text-left">Código</th>
                                <th className="p-2 text-left">Descripción</th>
                                <th className="p-2 text-left">Grupo</th>
                                <th className="p-2 text-left">Categoría</th>
                                <th className="p-2 text-left">Embalaje</th>
                            </tr>
                        </thead>
                        <tbody>
                            {productosFiltrados.map((p, idx) => (
                                <tr
                                    key={`${p.codigo}-${idx}`}
                                    className={idx % 2 === 0 ? "bg-slate-50" : "bg-white"}
                                >
                                    <td className="p-2 text-slate-800 font-medium">{p.codigo}</td>
                                    <td className="p-2 text-slate-700">{p.descripcion}</td>
                                    <td className="p-2 text-slate-700">{p.grupoCodigo}</td>
                                    <td className="p-2 text-slate-700">{p.categoriaNombre}</td>
                                    <td className="p-2 text-slate-500">NULL</td>
                                </tr>
                            ))}

                            {!productosFiltrados.length && (
                                <tr>
                                    <td colSpan={5} className="p-6 text-center text-slate-500">
                                        Carga el archivo para visualizar los productos.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {!!payload?.errores?.length && (
                    <div className="border-t border-slate-200 p-4 bg-slate-50">
                        <p className="text-slate-800 font-semibold mb-2">Novedades detectadas</p>
                        <div className="max-h-[220px] overflow-auto text-[13px]">
                            <table className="w-full">
                                <thead className="bg-slate-200">
                                    <tr>
                                        <th className="p-2 text-left">Fila</th>
                                        <th className="p-2 text-left">Motivo</th>
                                        <th className="p-2 text-left">Detalle</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payload.errores.map((e, idx) => (
                                        <tr
                                            key={idx}
                                            className={idx % 2 === 0 ? "bg-white" : "bg-slate-100"}
                                        >
                                            <td className="p-2">{e.filaExcel}</td>
                                            <td className="p-2">{e.motivo}</td>
                                            <td className="p-2">
                                                {e.codigo ? `Código: ${e.codigo}` : ""}
                                                {e.descripcionActual
                                                    ? ` | Actual: ${e.descripcionActual}`
                                                    : ""}
                                                {e.descripcionAnterior
                                                    ? ` | Anterior: ${e.descripcionAnterior}`
                                                    : ""}
                                                {e.grupoActual ? ` | Grupo actual: ${e.grupoActual}` : ""}
                                                {e.grupoAnterior
                                                    ? ` | Grupo anterior: ${e.grupoAnterior}`
                                                    : ""}
                                                {e.categoriaActual
                                                    ? ` | Categoría actual: ${e.categoriaActual}`
                                                    : ""}
                                                {e.categoriaAnterior
                                                    ? ` | Categoría anterior: ${e.categoriaAnterior}`
                                                    : ""}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </section>
        </article>
    );
}