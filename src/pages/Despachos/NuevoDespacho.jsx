import React, { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { API_BASE } from "../../constants";
import { IoMenu } from "react-icons/io5";
import { FaArrowLeft, FaSave, FaFileExcel, FaTrash } from "react-icons/fa";
import { toast } from "react-toastify";

/* ======================================================
  Helpers de lectura Excel
====================================================== */
const norm = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const normUpper = (v) => norm(v).toUpperCase();
const isRowEmpty = (row) => (row || []).every((c) => norm(c) === "");

const toNumber = (v) => {
    if (v == null || v === "") return 0;
    if (typeof v === "number") {
        return Number.isFinite(v) ? v : 0;
    }

    let s = String(v).trim();
    if (!s) return 0;

    s = s.replace(/\s/g, "");

    const hasDot = s.includes(".");
    const hasComma = s.includes(",");

    if (hasDot && hasComma) {
        if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
            s = s.replace(/\./g, "").replace(",", ".");
        } else {
            s = s.replace(/,/g, "");
        }
    } else if (hasComma) {
        s = s.replace(",", ".");
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
};

const calcularHashArchivo = async (file) => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

const looksLikeRouteRow = (row) => {
    const t = normUpper((row || []).map((c) => norm(c)).filter(Boolean).join(" "));
    return t.includes("RUTA") && /\bRUTA\s*:?[\s-]*\d+\b/.test(t);
};

const getRouteNameFromRow = (row) => {
    const t = normUpper((row || []).map((c) => norm(c)).filter(Boolean).join(" "));
    const m = t.match(/\bRUTA\s*:?[\s-]*(\d+)\b/);
    return m && m[1] ? `Ruta ${m[1]}` : norm((row || []).find((c) => norm(c))) || "Ruta ?";
};

const isConsecutivo = (v) => /^\d+$/.test(norm(v));

const findHeaderRowIdx = (block) => {
    for (let i = 0; i < block.length; i++) {
        const up = (block[i] || []).map((c) => normUpper(c));
        const p = up.findIndex((c) => c === "PRODUCTO" || c.includes("PRODUCTO"));
        const u = up.findIndex((c) => c.includes("UNIDAD"));
        const n = up.findIndex(
            (c) =>
                c === "N°" ||
                c === "Nº" ||
                c === "NO" ||
                c.includes("N°") ||
                c.includes("Nº") ||
                c.includes("CONSECUT")
        );
        if (p !== -1 && u !== -1 && n !== -1) return i;
    }

    for (let i = 0; i < block.length; i++) {
        const up = (block[i] || []).map((c) => normUpper(c));
        const p = up.findIndex((c) => c === "PRODUCTO" || c.includes("PRODUCTO"));
        const u = up.findIndex((c) => c.includes("UNIDAD"));
        if (p !== -1 && u !== -1) return i;
    }

    return -1;
};

const findCols = (headerRow) => {
    const up = (headerRow || []).map((c) => normUpper(c));
    const colN = up.findIndex(
        (c) =>
            c === "N°" ||
            c === "Nº" ||
            c === "NO" ||
            c.includes("N°") ||
            c.includes("Nº") ||
            c.includes("CONSECUT")
    );
    const colProducto = up.findIndex((c) => c === "PRODUCTO" || c.includes("PRODUCTO"));
    const colUnidad = up.findIndex((c) => c.includes("UNIDAD"));
    return { colN, colProducto, colUnidad };
};

const isHeaderLikeRow = (row) => {
    const up = (row || []).map((c) => normUpper(c));
    const p = up.findIndex((c) => c === "PRODUCTO" || c.includes("PRODUCTO"));
    const u = up.findIndex((c) => c.includes("UNIDAD"));
    const n = up.findIndex(
        (c) =>
            c === "N°" ||
            c === "Nº" ||
            c === "NO" ||
            c.includes("N°") ||
            c.includes("Nº") ||
            c.includes("CONSECUT")
    );
    return p !== -1 && u !== -1 && n !== -1;
};

const looksLikeCierreRow = (row) => {
    const t = normUpper((row || []).map((c) => norm(c)).filter(Boolean).join(" "));
    if (!t) return false;

    return (
        t.includes("ENTREGO A SATISFACCION") ||
        t.includes("ENTREGO A SATISFACCIÓN") ||
        t.includes("RECIBO A SATISFACCION") ||
        t.includes("RECIBO A SATISFACCIÓN") ||
        t.includes("FIRMA") ||
        t.includes("OBSERVACION") ||
        t.includes("OBSERVACIÓN")
    );
};

const getFirstNonEmptyCell = (row) => {
    if (!Array.isArray(row)) return "";
    const cell = row.find((c) => norm(c) !== "");
    return norm(cell);
};

const findPreviousNonEmptyRowIdx = (grid, fromIdx, limit = 6) => {
    for (let i = fromIdx; i >= Math.max(0, fromIdx - limit); i--) {
        if (!isRowEmpty(grid[i])) return i;
    }
    return -1;
};

const findSedesRowAbove = (block, headerIdx, colUnidad) => {
    const start = colUnidad + 1;

    for (let i = headerIdx - 1; i >= Math.max(0, headerIdx - 20); i--) {
        const row = block[i] || [];
        const slice = row.slice(start).map((c) => norm(c)).filter(Boolean);
        if (!slice.length) continue;

        const sedeCandidates = slice.filter((s) => {
            const clean = s.replace(/\s/g, "");
            if (/^\d+([.,]\d+)?$/.test(clean)) return false;
            if (/\b\d{1,3}\/\d{2}\b/.test(s)) return true;
            if (s.length >= 6) return true;
            return false;
        });

        if (sedeCandidates.length >= 2) return row;
    }

    return null;
};

const findColByKeywords = (block, headerIdx, keywords = []) => {
    for (let r = headerIdx; r >= Math.max(0, headerIdx - 12); r--) {
        const row = block[r] || [];
        for (let c = 0; c < row.length; c++) {
            const t = normUpper(row[c]);
            if (!t) continue;
            if (keywords.every((k) => t.includes(k))) return c;
        }
    }
    return -1;
};

const buildSedes = (sedeRow, startCol, endCol) =>
    (sedeRow || [])
        .slice(startCol, endCol + 1)
        .map((s) => norm(s))
        .filter((s) => {
            if (!s) return false;
            const up = normUpper(s);
            if (up.includes("TOTAL")) return false;
            if (up.includes("CAJAS")) return false;
            if (up.includes("PACAS")) return false;
            if (up.includes("UNIDADES")) return false;
            if (up.includes("COMEDOR / ESCUELA")) return false;
            if (/^\d+([.,]\d+)?$/.test(s.replace(/\s/g, ""))) return false;
            return true;
        });

const getSheetGrid = (ws) => {
    const ref = ws["!ref"];
    if (!ref) return [];

    const range = XLSX.utils.decode_range(ref);
    const r0 = range.s.r;
    const c0 = range.s.c;
    const r1 = range.e.r;
    const c1 = range.e.c;

    const grid = Array.from({ length: r1 - r0 + 1 }, (_, i) =>
        Array.from({ length: c1 - c0 + 1 }, (_, j) => {
            const addr = XLSX.utils.encode_cell({ r: r0 + i, c: c0 + j });
            const cell = ws[addr];
            return cell ? cell.v : "";
        })
    );

    const merges = ws["!merges"] || [];
    merges.forEach((m) => {
        const val = grid[m.s.r - r0] && grid[m.s.r - r0][m.s.c - c0];
        for (let rr = m.s.r; rr <= m.e.r; rr++) {
            for (let cc = m.s.c; cc <= m.e.c; cc++) {
                const gr = rr - r0;
                const gc = cc - c0;
                if (grid[gr] && grid[gr][gc] === "") grid[gr][gc] = val;
            }
        }
    });

    return grid;
};

/* ======================================================
  Bloques por RUTA
====================================================== */
function parseBlocksFromGrid(grid) {
    const starts = [];
    for (let i = 0; i < grid.length; i++) {
        if (looksLikeRouteRow(grid[i])) starts.push(i);
    }

    if (!starts.length) return [];

    const blocks = [];
    for (let k = 0; k < starts.length; k++) {
        const start = starts[k];
        const end = k < starts.length - 1 ? starts[k + 1] : grid.length;
        blocks.push({
            start,
            end,
            mode: "RUTA",
            rows: grid.slice(start, end),
        });
    }

    return blocks;
}

/* ======================================================
  Bloques por formato estructurado
====================================================== */
function parseStructuredBlocksFromGrid(grid) {
    const headerStarts = [];

    for (let i = 0; i < grid.length; i++) {
        if (!isHeaderLikeRow(grid[i])) continue;

        const prev1 = grid[i - 1] || [];
        const prev2 = grid[i - 2] || [];

        const prev1Text = normUpper(prev1.map((c) => norm(c)).filter(Boolean).join(" "));
        const prev2Text = normUpper(prev2.map((c) => norm(c)).filter(Boolean).join(" "));

        const hasSedeHints =
            prev1Text.includes("COMEDOR / ESCUELA") ||
            prev2Text.includes("COMEDOR / ESCUELA") ||
            (!isRowEmpty(prev1) && prev1.some((c) => /\b\d{1,3}\/\d{2}\b/.test(norm(c)))) ||
            (!isRowEmpty(prev1) && prev1.filter((c) => norm(c).length >= 6).length >= 2);

        if (!hasSedeHints) continue;

        let start = i - 1 >= 0 ? i - 1 : i;

        if (start < 0 || isRowEmpty(grid[start])) {
            const fallbackIdx = findPreviousNonEmptyRowIdx(grid, i - 1, 3);
            start = fallbackIdx !== -1 ? fallbackIdx : i;
        }

        if (!headerStarts.includes(start)) {
            headerStarts.push(start);
        }
    }

    if (!headerStarts.length) return [];

    headerStarts.sort((a, b) => a - b);

    const blocks = [];
    for (let k = 0; k < headerStarts.length; k++) {
        const start = headerStarts[k];
        let end = k < headerStarts.length - 1 ? headerStarts[k + 1] : grid.length;

        for (let r = start + 1; r < end; r++) {
            if (looksLikeCierreRow(grid[r])) {
                end = r;
                break;
            }
        }

        blocks.push({
            start,
            end,
            mode: "DESCRIPTIVO",
            rows: grid.slice(start, end),
        });
    }

    return blocks;
}

/* ======================================================
  Parse de bloque
====================================================== */
function parseRouteBlock(block) {
    const rows = block.rows || [];
    const mode = block.mode || "RUTA";

    if (!rows.length) return null;

    let ruta = "";
    let descripcionBloque = "";
    let nombreOriginalBloque = "";

    if (mode === "RUTA") {
        ruta = getRouteNameFromRow(rows[0]);
        nombreOriginalBloque = getFirstNonEmptyCell(rows[0]) || ruta;
        descripcionBloque = nombreOriginalBloque || ruta;
    } else {
        const firstTitle = getFirstNonEmptyCell(rows[0]);
        const fallbackTitle = `Bloque ${block.start + 1}`;
        ruta = firstTitle || fallbackTitle;
        nombreOriginalBloque = firstTitle || fallbackTitle;
        descripcionBloque = firstTitle || fallbackTitle;
    }

    const headerIdx = findHeaderRowIdx(rows);
    if (headerIdx === -1) return null;

    const headerRow = rows[headerIdx] || [];
    const { colN, colProducto, colUnidad } = findCols(headerRow);
    if (colProducto === -1 || colUnidad === -1) return null;

    const colTotalCoberturaRuta = findColByKeywords(rows, headerIdx, ["TOTAL", "COBERTURA", "RUTA"]);
    const colCajasPacas =
        findColByKeywords(rows, headerIdx, ["CAJAS"]) !== -1
            ? findColByKeywords(rows, headerIdx, ["CAJAS"])
            : findColByKeywords(rows, headerIdx, ["PACAS"]);
    const colUnidades = findColByKeywords(rows, headerIdx, ["UNIDADES"]);

    const sedeHeader = findSedesRowAbove(rows, headerIdx, colUnidad);
    const sedeRow = (sedeHeader || headerRow).map((c) => norm(c));

    const startSedeCol = colUnidad + 1;

    let endSedeCol = -1;
    if (colTotalCoberturaRuta !== -1) endSedeCol = colTotalCoberturaRuta - 1;
    else if (colCajasPacas !== -1) endSedeCol = colCajasPacas - 1;
    else if (colUnidades !== -1) endSedeCol = colUnidades - 1;
    else endSedeCol = sedeRow.length - 1;

    let sedes = buildSedes(sedeRow, startSedeCol, endSedeCol);

    if (!sedes.length && headerIdx - 2 >= 0) {
        const sedeRow2 = (rows[headerIdx - 2] || []).map((c) => norm(c));
        sedes = buildSedes(sedeRow2, startSedeCol, endSedeCol);
    }

    const items = [];
    for (let r = headerIdx + 1; r < rows.length; r++) {
        const row = rows[r] || [];
        if (isRowEmpty(row)) continue;
        if (mode === "RUTA" && looksLikeRouteRow(row)) break;
        if (looksLikeCierreRow(row)) break;
        if (isHeaderLikeRow(row) && r !== headerIdx + 1) break;

        if (colN !== -1 && !isConsecutivo(row[colN])) continue;

        let producto = norm(row[colProducto]);
        const unidad = norm(row[colUnidad]);
        if (!producto) continue;
        if (producto.includes("/")) producto = norm(producto.split("/")[0]);

        const cantidades = {};
        let totalSedes = 0;

        sedes.forEach((sede, k) => {
            const col = startSedeCol + k;
            const val = toNumber(row[col]);
            if (val !== 0) cantidades[sede] = val;
            totalSedes += val;
        });

        const totalCoberturaRuta = colTotalCoberturaRuta !== -1 ? toNumber(row[colTotalCoberturaRuta]) : 0;
        const cajasPacas = colCajasPacas !== -1 ? toNumber(row[colCajasPacas]) : 0;
        const unidades = colUnidades !== -1 ? toNumber(row[colUnidades]) : 0;

        if (!Object.keys(cantidades).length && !totalCoberturaRuta && !cajasPacas && !unidades) continue;

        items.push({
            consecutivo: colN !== -1 ? Number(norm(row[colN])) : null,
            producto,
            unidad,
            cantidades,
            totalSedes,
            totalCoberturaRuta,
            cajasPacas,
            unidades,
        });
    }

    if (!items.length) return null;

    return {
        ruta,
        tipoBloque: mode,
        descripcionBloque,
        nombreOriginalBloque,
        sedes,
        items,
    };
}

/* ======================================================
  Merge
====================================================== */
function mergeRoutes(routesArr) {
    const map = new Map();

    routesArr.forEach((rt) => {
        if (!rt) return;

        const key = `${rt.tipoBloque || "RUTA"}||${rt.ruta}`;
        if (!map.has(key)) {
            map.set(key, {
                ruta: rt.ruta,
                tipoBloque: rt.tipoBloque || "RUTA",
                descripcionBloque: rt.descripcionBloque || rt.ruta,
                nombreOriginalBloque: rt.nombreOriginalBloque || rt.ruta,
                sedes: [],
                items: [],
            });
        }

        const acc = map.get(key);

        const sedesSet = new Set(acc.sedes);
        rt.sedes.forEach((s) => sedesSet.add(s));
        acc.sedes = Array.from(sedesSet);

        rt.items.forEach((it) => {
            const idx = acc.items.findIndex(
                (x) => x.producto === it.producto && x.unidad === it.unidad
            );

            if (idx === -1) {
                acc.items.push({ ...it, cantidades: { ...it.cantidades } });
            } else {
                const cur = acc.items[idx];
                Object.entries(it.cantidades).forEach(([sede, val]) => {
                    cur.cantidades[sede] = (cur.cantidades[sede] || 0) + val;
                });

                cur.totalSedes = Object.values(cur.cantidades).reduce((a, b) => a + b, 0);
                cur.totalCoberturaRuta = (cur.totalCoberturaRuta || 0) + (it.totalCoberturaRuta || 0);
                cur.cajasPacas = (cur.cajasPacas || 0) + (it.cajasPacas || 0);
                cur.unidades = (cur.unidades || 0) + (it.unidades || 0);
            }
        });
    });

    return Array.from(map.values()).sort((a, b) => {
        const aIsRuta = a.tipoBloque === "RUTA";
        const bIsRuta = b.tipoBloque === "RUTA";

        if (aIsRuta && bIsRuta) {
            const na = Number((a.ruta.match(/\d+/) || [0])[0]);
            const nb = Number((b.ruta.match(/\d+/) || [0])[0]);
            return na - nb;
        }

        return a.ruta.localeCompare(b.ruta, "es", { numeric: true, sensitivity: "base" });
    });
}

/* ======================================================
  Descripción para backend
====================================================== */
function buildDescripcionCarga(parsedRoutes = []) {
    if (!parsedRoutes.length) return "";

    const tipos = new Set(parsedRoutes.map((r) => r.tipoBloque).filter(Boolean));
    const descriptivos = parsedRoutes
        .filter((r) => r.tipoBloque === "DESCRIPTIVO")
        .map((r) => r.descripcionBloque)
        .filter(Boolean);

    if (tipos.size === 1 && tipos.has("RUTA")) {
        return "FORMATO_RUTA";
    }

    if (tipos.size === 1 && tipos.has("DESCRIPTIVO")) {
        const base = descriptivos.slice(0, 3).join(" | ");
        return base ? `FORMATO_DESCRIPTIVO | ${base}` : "FORMATO_DESCRIPTIVO";
    }

    const base = descriptivos.slice(0, 3).join(" | ");
    return base ? `FORMATO_MIXTO | ${base}` : "FORMATO_MIXTO";
}

/* ======================================================
  Workbook parser
====================================================== */
function parseWorkbookByRouteBlocks(wb) {
    const parsedRoutes = [];

    wb.SheetNames.forEach((sheetName) => {
        const ws = wb.Sheets[sheetName];
        const grid = getSheetGrid(ws);
        if (!grid.length) return;

        const routeBlocks = parseBlocksFromGrid(grid);

        if (routeBlocks.length) {
            routeBlocks.forEach((b) => {
                const rt = parseRouteBlock(b);
                if (rt) parsedRoutes.push(rt);
            });
            return;
        }

        const structuredBlocks = parseStructuredBlocksFromGrid(grid);
        structuredBlocks.forEach((b) => {
            const rt = parseRouteBlock(b);
            if (rt) parsedRoutes.push(rt);
        });
    });

    return mergeRoutes(parsedRoutes);
}

/* ======================================================
  UI
====================================================== */
export const NuevoDespacho = ({ setSidebar, navegar }) => {
    const abrirMenu = () => setSidebar(true);
    const estadoPagina = (pagina) => navegar(pagina);

    const inputRefs = {
        AM: useRef(null),
        PM: useRef(null),
        JORNADA_UNICA: useRef(null),
    };

    const [guardando, setGuardando] = useState(false);

    const [form, setForm] = useState({
        fechaDespacho: "",
        fechaConsumoDesde: "",
        fechaConsumoHasta: "",
        tipoPeriodo: "DIARIO",
        observacion: "",
    });

    const [archivos, setArchivos] = useState({
        AM: null,
        PM: null,
        JORNADA_UNICA: null,
    });

    const [previewArchivos, setPreviewArchivos] = useState({
        AM: null,
        PM: null,
        JORNADA_UNICA: null,
    });

    const handleChange = (e) => {
        const { name, value } = e.target;

        const upperCaseFields = ["observacion"];

        setForm((prev) => ({
            ...prev,
            [name]: upperCaseFields.includes(name) ? value.toUpperCase() : value,
        }));
    };

    const limpiarFormulario = () => {
        setForm({
            fechaDespacho: "",
            fechaConsumoDesde: "",
            fechaConsumoHasta: "",
            tipoPeriodo: "DIARIO",
            observacion: "",
        });

        setArchivos({
            AM: null,
            PM: null,
            JORNADA_UNICA: null,
        });

        setPreviewArchivos({
            AM: null,
            PM: null,
            JORNADA_UNICA: null,
        });

        Object.values(inputRefs).forEach((ref) => {
            if (ref && ref.current) {
                ref.current.value = "";
            }
        });
    };

    const procesarArchivoExcel = async (file, tipoArchivo) => {
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const rutas = parseWorkbookByRouteBlocks(wb);
        const hashArchivo = await calcularHashArchivo(file);
        const descripcion = buildDescripcionCarga(rutas);

        return {
            tipoArchivo,
            nombreArchivo: file.name,
            hashArchivo,
            hojasDetectadas: wb.SheetNames.length,
            rutasDetectadas: rutas.length,
            descripcion,
            rutas,
        };
    };

    const handleFileChange = async (tipo, file) => {
        if (!file) {
            setArchivos((prev) => ({ ...prev, [tipo]: null }));
            setPreviewArchivos((prev) => ({ ...prev, [tipo]: null }));
            return;
        }

        try {
            const preview = await procesarArchivoExcel(file, tipo);

            setArchivos((prev) => ({
                ...prev,
                [tipo]: file,
            }));

            setPreviewArchivos((prev) => ({
                ...prev,
                [tipo]: preview,
            }));

            toast.success(`${tipo}: archivo leído correctamente`);
        } catch (error) {
            console.error(error);
            toast.error(`No se pudo leer el archivo ${tipo}`);

            setArchivos((prev) => ({ ...prev, [tipo]: null }));
            setPreviewArchivos((prev) => ({ ...prev, [tipo]: null }));
        }
    };

    const eliminarArchivo = (tipo) => {
        setArchivos((prev) => ({
            ...prev,
            [tipo]: null,
        }));

        setPreviewArchivos((prev) => ({
            ...prev,
            [tipo]: null,
        }));

        if (inputRefs[tipo] && inputRefs[tipo].current) {
            inputRefs[tipo].current.value = "";
        }
    };

    const validarFormulario = () => {
        if (!form.fechaDespacho) {
            toast.warning("Debes seleccionar la fecha del despacho");
            return false;
        }

        if (!form.fechaConsumoDesde) {
            toast.warning("Debes seleccionar la fecha inicial de consumo");
            return false;
        }

        if (!form.fechaConsumoHasta) {
            toast.warning("Debes seleccionar la fecha final de consumo");
            return false;
        }

        if (form.fechaConsumoDesde > form.fechaConsumoHasta) {
            toast.warning("La fecha inicial de consumo no puede ser mayor que la fecha final");
            return false;
        }

        if (!form.observacion.trim()) {
            toast.warning("Debes escribir el texto requerido");
            return false;
        }

        if (!form.tipoPeriodo) {
            toast.warning("Debes seleccionar el tipo de periodo");
            return false;
        }

        const tieneAM = !!archivos.AM;
        const tienePM = !!archivos.PM;
        const tieneJornadaUnica = !!archivos.JORNADA_UNICA;

        if (!tieneAM && !tienePM && !tieneJornadaUnica) {
            toast.warning("Debes adjuntar al menos un archivo del despacho");
            return false;
        }

        return true;
    };

    const obtenerDescripcionGeneral = () => {
        const descripciones = ["AM", "PM", "JORNADA_UNICA"]
            .map((tipo) => previewArchivos[tipo]?.descripcion)
            .filter(Boolean);

        if (!descripciones.length) return "";

        const unicas = Array.from(new Set(descripciones));
        return unicas.join(" || ");
    };

    const crearDespacho = async () => {
        const body = new URLSearchParams();
        body.append("fechaDespacho", form.fechaDespacho);
        body.append("fechaConsumoDesde", form.fechaConsumoDesde);
        body.append("fechaConsumoHasta", form.fechaConsumoHasta);
        body.append("tipoPeriodo", form.tipoPeriodo);
        body.append("observacion", form.observacion.trim().toUpperCase());
        body.append("idEstado", "1");
        body.append("descripcion", obtenerDescripcionGeneral());

        const res = await fetch(`${API_BASE}Despachos/DespachosCreate.php`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            },
            body: body.toString(),
        });

        return await res.json();
    };

    const guardarDetalleDespacho = async (idDespacho, archivosProcesados) => {
        const body = new URLSearchParams();
        body.append("idDespacho", String(idDespacho));
        body.append("archivosProcesados", JSON.stringify(archivosProcesados));

        const res = await fetch(`${API_BASE}Despachos/DespachosGuardarDetalle.php`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            },
            body: body.toString(),
        });

        return await res.json();
    };

    const construirPayloadArchivosProcesados = () => {
        const archivosPayload = [];

        ["AM", "PM", "JORNADA_UNICA"].forEach((tipo) => {
            const data = previewArchivos[tipo];
            if (!data) return;

            archivosPayload.push({
                tipoArchivo: tipo,
                nombreArchivo: data.nombreArchivo || "",
                hashArchivo: data.hashArchivo || "",
                hojasDetectadas: data.hojasDetectadas || 0,
                rutasDetectadas: data.rutasDetectadas || 0,
                descripcion: data.descripcion || "",
                rutas: Array.isArray(data.rutas) ? data.rutas : [],
            });
        });

        return {
            descripcion: obtenerDescripcionGeneral(),
            archivos: archivosPayload,
        };
    };

    const guardarDespacho = async (e) => {
        e.preventDefault();

        if (!validarFormulario()) return;

        try {
            setGuardando(true);
            console.log("1. Iniciando guardado");

            const responseCreate = await crearDespacho();
            console.log("2. responseCreate:", responseCreate);

            if (responseCreate.rpta !== "si") {
                toast.error(responseCreate.mensaje || "No se pudo crear el despacho");
                return;
            }

            const idDespacho = responseCreate && responseCreate.data ? responseCreate.data.idDespacho : null;
            console.log("3. idDespacho:", idDespacho);

            if (!idDespacho) {
                toast.error("El servicio no retornó el idDespacho");
                return;
            }

            const archivosProcesados = construirPayloadArchivosProcesados();
            console.log("4. archivosProcesados:", archivosProcesados);

            const responseDetalle = await guardarDetalleDespacho(idDespacho, archivosProcesados);
            console.log("5. responseDetalle:", responseDetalle);

            if (responseDetalle.rpta !== "si") {
                toast.error(responseDetalle.mensaje || "No se pudo guardar el detalle del despacho");
                return;
            }

            toast.success("Despacho y detalle guardados correctamente");
            limpiarFormulario();
            estadoPagina("Despachos");
        } catch (error) {
            console.error("ERROR EN guardarDespacho:", error);
            toast.error("Ocurrió un error al guardar el despacho");
        } finally {
            setGuardando(false);
        }
    };

    const renderArchivo = (label, tipo) => {
        const archivo = archivos[tipo];
        const preview = previewArchivos[tipo];

        return (
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FaFileExcel className="text-green-600" />
                        <span className="font-semibold text-slate-700">{label}</span>
                    </div>

                    {archivo && (
                        <button
                            type="button"
                            onClick={() => eliminarArchivo(tipo)}
                            className="text-red-500 hover:bg-red-100 p-2 rounded-lg transition-colors"
                        >
                            <FaTrash />
                        </button>
                    )}
                </div>

                <input
                    ref={inputRefs[tipo]}
                    type="file"
                    accept=".xlsx,.xls"
                    onClick={(e) => {
                        e.currentTarget.value = "";
                    }}
                    onChange={(e) => handleFileChange(tipo, e.target.files ? e.target.files[0] : null)}
                    className="border border-gray-300 rounded-lg p-3 bg-white"
                />

                <span className="text-sm text-gray-500 break-all">
                    {archivo ? archivo.name : "No se ha seleccionado archivo"}
                </span>

                {preview && (
                    <div className="bg-white border border-slate-200 rounded-lg p-3 text-sm text-slate-600">
                        <p><strong>Hojas:</strong> {preview.hojasDetectadas}</p>
                        <p><strong>Rutas detectadas:</strong> {preview.rutasDetectadas}</p>
                        <p><strong>Descripción:</strong> {preview.descripcion || "—"}</p>

                        <p className="mt-2 font-semibold text-slate-700">Rutas / Bloques:</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {preview.rutas.length > 0 ? (
                                preview.rutas.map((r, index) => (
                                    <span
                                        key={`${tipo}-${r.ruta}-${index}`}
                                        className="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs"
                                    >
                                        {r.ruta} {r.tipoBloque ? `(${r.tipoBloque})` : ""}
                                    </span>
                                ))
                            ) : (
                                <span className="text-xs text-slate-500">Sin rutas detectadas</span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const resumenGeneral = useMemo(() => {
        const tipos = ["AM", "PM", "JORNADA_UNICA"];
        let totalArchivos = 0;
        let totalRutas = 0;

        tipos.forEach((tipo) => {
            if (previewArchivos[tipo]) {
                totalArchivos += 1;
                totalRutas += previewArchivos[tipo].rutasDetectadas || 0;
            }
        });

        return {
            totalArchivos,
            totalRutas,
            descripcion: obtenerDescripcionGeneral(),
        };
    }, [previewArchivos]);

    return (
        <div className="w-full h-screen flex flex-col p-6 gap-6">
            <div className="flex items-center gap-5 lg:hidden">
                <div
                    className="p-2 rounded-lg hover:bg-gray-300 cursor-pointer"
                    onClick={abrirMenu}
                >
                    <IoMenu className="text-2xl" />
                </div>

                <h1 className="text-lg font-bold">
                    Crear Despacho
                </h1>
            </div>

            <article className="flex-1 bg-white shadow-lg rounded-lg p-6 flex flex-col overflow-hidden">
                <nav className="w-full flex items-center justify-between mb-6 gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            className="p-2 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                            onClick={() => estadoPagina("Despachos")}
                            type="button"
                        >
                            <FaArrowLeft className="text-slate-700" />
                        </button>

                        <h1 className="text-[calc(0.8rem+0.7vw)] font-bold">
                            Crear Despacho
                        </h1>
                    </div>

                    <button
                        className="px-4 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-900 flex items-center gap-2 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                        onClick={guardarDespacho}
                        disabled={guardando}
                        type="button"
                    >
                        <FaSave />
                        <span>{guardando ? "Guardando..." : "Guardar"}</span>
                    </button>
                </nav>
                <form
                    onSubmit={guardarDespacho}
                    className="flex-1 overflow-y-auto no-scrollbar pr-1 space-y-5"
                >
                    <div className="border border-slate-200 rounded-2xl bg-gradient-to-br from-slate-50 to-white p-4 lg:p-5 shadow-sm">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div>
                                <h2 className="text-base lg:text-lg font-bold text-slate-800">
                                    Información general del despacho
                                </h2>
                                <p className="text-sm text-slate-500">
                                    Completa los datos base antes de cargar los archivos
                                </p>
                            </div>

                            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                Campos obligatorios
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-semibold text-slate-700">
                                    Fecha despacho <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    name="fechaDespacho"
                                    value={form.fechaDespacho}
                                    onChange={handleChange}
                                    className="h-11 border border-slate-300 bg-white rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-semibold text-slate-700">
                                    Tipo de periodo <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="tipoPeriodo"
                                    value={form.tipoPeriodo}
                                    onChange={handleChange}
                                    className="h-11 border border-slate-300 bg-white rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                >
                                    <option value="DIARIO">DIARIO</option>
                                    <option value="SEMANAL">SEMANAL</option>
                                    <option value="MENSUAL">MENSUAL</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-semibold text-slate-700">
                                    Consumo desde <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    name="fechaConsumoDesde"
                                    value={form.fechaConsumoDesde}
                                    onChange={handleChange}
                                    className="h-11 border border-slate-300 bg-white rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-semibold text-slate-700">
                                    Consumo hasta <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    name="fechaConsumoHasta"
                                    value={form.fechaConsumoHasta}
                                    onChange={handleChange}
                                    className="h-11 border border-slate-300 bg-white rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                />
                            </div>

                            <div className="md:col-span-2 xl:col-span-4 flex flex-col gap-1.5">
                                <label className="text-sm font-semibold text-slate-700">
                                    Nombre del Contrato <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="observacion"
                                    value={form.observacion}
                                    onChange={handleChange}
                                    style={{ textTransform: "uppercase" }}
                                    className="h-11 border border-slate-300 bg-white rounded-xl px-3 text-sm uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                                    placeholder="ESCRIBE AQUÍ"
                                />
                                <span className="text-xs text-slate-400">
                                    Todo lo que escribas aquí se convertirá automáticamente a mayúscula.
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="border border-slate-200 rounded-2xl bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-3 mb-3">
                            <h2 className="text-base lg:text-lg font-bold text-slate-800">
                                Resumen del despacho
                            </h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                                    Estado
                                </p>
                                <p className="text-sm font-bold text-slate-800 mt-1">
                                    ACTIVO (id 1)
                                </p>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                                    Archivos cargados
                                </p>
                                <p className="text-sm font-bold text-slate-800 mt-1">
                                    {resumenGeneral.totalArchivos}
                                </p>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                                <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                                    Rutas detectadas
                                </p>
                                <p className="text-sm font-bold text-slate-800 mt-1">
                                    {resumenGeneral.totalRutas}
                                </p>
                            </div>
                        </div>

                        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
                            <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1">
                                Descripción
                            </p>
                            <p className="text-sm text-slate-700 break-words">
                                {resumenGeneral.descripcion || "—"}
                            </p>
                        </div>
                    </div>

                    <div className="mt-1">
                        <h2 className="text-lg font-bold text-slate-800 mb-4">
                            Archivos del despacho
                        </h2>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {renderArchivo("Archivo AM", "AM")}
                            {renderArchivo("Archivo PM", "PM")}
                            {renderArchivo("Archivo Jornada Única", "JORNADA_UNICA")}
                        </div>

                        <div className="mt-4 text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-4">
                            Puedes adjuntar archivos para las jornadas <strong>AM</strong>, <strong>PM</strong> y <strong>JORNADA_UNICA</strong>.
                            Adjunta uno, varios o los tres según corresponda al despacho.
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-1">
                        <button
                            type="button"
                            onClick={() => estadoPagina("Despachos")}
                            className="px-5 py-2.5 border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors"
                        >
                            Cancelar
                        </button>

                        <button
                            type="submit"
                            disabled={guardando}
                            className="px-5 py-2.5 bg-blue-800 text-white rounded-xl hover:bg-blue-900 transition-colors disabled:opacity-60"
                        >
                            {guardando ? "Guardando..." : "Guardar despacho"}
                        </button>
                    </div>
                </form>



            </article>
        </div>
    );
};