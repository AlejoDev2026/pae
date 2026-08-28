import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import plantillaTrazabilidad from "../../assets/F-SGC-28 FORMATO DE TRAZABILIDAD.xlsx";
import logoGobernacion from "../../assets/logoPae.png";

const CONFIG = {
    hojaPlantilla: "BLANCO",
    ultimaColumna: 14,

    inicioProductos: 12,
    finProductosBase: 41,
    productosBase: 30,

    filaSeparadorBase: 42,
    filaHeaderInstituciones1Base: 43,
    filaHeaderInstituciones2Base: 44,
    inicioInstitucionesBase: 45,
    finInstitucionesBase: 53,
    institucionesBase: 3,
    filasPorInstitucion: 3,
    filaFooterBase: 54,

    celdas: {
        contrato: "A7",
        fecha: "E7",
        etc: "A8",
        modalidad: "E8",
        ruta: "A9",
        auxiliarBodega: "G9",
    },
};

const MERGES_PRODUCTO = ["B:D", "E:F", "G:H", "I:N"];

const clone = (value) => {
    if (!value) return value;
    return JSON.parse(JSON.stringify(value));
};

const formatearFecha = (fecha) => {
    if (!fecha) return "";

    if (fecha instanceof Date) {
        if (Number.isNaN(fecha.getTime())) return "";
        return fecha.toLocaleDateString("es-CO", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    }

    const texto = String(fecha).trim();
    if (texto === "") return "";

    // Evita desfases por zona horaria cuando viene como YYYY-MM-DD.
    const soloFecha = texto.split("T")[0].split(" ")[0];
    const partes = soloFecha.split("-");

    if (partes.length === 3) {
        const [year, month, day] = partes;
        if (year?.length === 4 && month && day) {
            return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
        }
    }

    const date = new Date(texto.replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return texto;

    return date.toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
};

const formatearRangoFechas = (fechaDesde, fechaHasta) => {
    const desde = formatearFecha(fechaDesde);
    const hasta = formatearFecha(fechaHasta);

    if (desde && hasta) return `${desde} - ${hasta}`;
    if (desde) return desde;
    if (hasta) return hasta;

    return "";
};

const obtenerBufferDesdeAsset = async (assetUrl) => {
    const response = await fetch(assetUrl, {
        method: "GET",
        cache: "force-cache",
    });

    if (!response.ok) {
        throw new Error(`No se pudo cargar el archivo: ${response.status}`);
    }

    return response.arrayBuffer();
};

const aplicarMergeSeguro = (ws, rango) => {
    try {
        ws.mergeCells(rango);
    } catch { }
};

const descombinarMergeSeguro = (ws, rango) => {
    try {
        ws.unMergeCells(rango);
    } catch { }
};

const copiarCelda = (origen, destino, copiarValor = true) => {
    if (copiarValor) destino.value = clone(origen.value);

    destino.style = clone(origen.style) || {};
    destino.numFmt = origen.numFmt;
    destino.font = clone(origen.font);
    destino.alignment = clone(origen.alignment);
    destino.border = clone(origen.border);
    destino.fill = clone(origen.fill);
    destino.protection = clone(origen.protection);
};

const copiarFila = (ws, filaOrigenNumero, filaDestinoNumero, copiarValores = false) => {
    const filaOrigen = ws.getRow(filaOrigenNumero);
    const filaDestino = ws.getRow(filaDestinoNumero);

    filaDestino.height = filaOrigen.height;
    filaDestino.hidden = filaOrigen.hidden;
    filaDestino.outlineLevel = filaOrigen.outlineLevel;

    for (let col = 1; col <= CONFIG.ultimaColumna; col += 1) {
        const celdaOrigen = filaOrigen.getCell(col);
        const celdaDestino = filaDestino.getCell(col);

        copiarCelda(celdaOrigen, celdaDestino, copiarValores);

        if (!copiarValores) {
            celdaDestino.value = null;
        }
    }

    filaDestino.commit?.();
};

const limpiarRango = (ws, filaInicio, filaFin, colInicio = 1, colFin = 14) => {
    for (let fila = filaInicio; fila <= filaFin; fila += 1) {
        for (let col = colInicio; col <= colFin; col += 1) {
            ws.getRow(fila).getCell(col).value = null;
        }
    }
};

const normalizarNombreHojaBase = (nombre, fallback = "TRAZABILIDAD") => {
    const limpio = String(nombre || fallback)
        .replace(/[\\/*?:[\]]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    return limpio || fallback;
};

const normalizarNombreHoja = (nombre, fallback = "TRAZABILIDAD", usados = new Set()) => {
    const base = normalizarNombreHojaBase(nombre, fallback);
    let candidato = base.slice(0, 31);
    let consecutivo = 2;

    while (usados.has(candidato)) {
        const sufijo = ` ${consecutivo}`;
        candidato = `${base.slice(0, 31 - sufijo.length)}${sufijo}`;
        consecutivo += 1;
    }

    usados.add(candidato);
    return candidato;
};

const aplicarMergesProducto = (ws, fila) => {
    MERGES_PRODUCTO.forEach((cols) => aplicarMergeSeguro(ws, `${cols}${fila}`));
};

const descombinarMergesProducto = (ws, fila) => {
    MERGES_PRODUCTO.forEach((cols) => descombinarMergeSeguro(ws, `${cols}${fila}`));
};

const aplicarMergesEncabezadoInstituciones = (ws, filaHeader1, filaHeader2) => {
    [
        `A${filaHeader1}:A${filaHeader2}`,
        `B${filaHeader1}:D${filaHeader2}`,
        `E${filaHeader1}:F${filaHeader2}`,
        `G${filaHeader1}:G${filaHeader2}`,
        `H${filaHeader1}:H${filaHeader2}`,
        `I${filaHeader1}:M${filaHeader1}`,
        `N${filaHeader1}:N${filaHeader2}`,
    ].forEach((rango) => aplicarMergeSeguro(ws, rango));
};

const descombinarMergesEncabezadoInstituciones = (ws, filaHeader1, filaHeader2) => {
    [
        `A${filaHeader1}:A${filaHeader2}`,
        `B${filaHeader1}:D${filaHeader2}`,
        `E${filaHeader1}:F${filaHeader2}`,
        `G${filaHeader1}:G${filaHeader2}`,
        `H${filaHeader1}:H${filaHeader2}`,
        `I${filaHeader1}:M${filaHeader1}`,
        `N${filaHeader1}:N${filaHeader2}`,
    ].forEach((rango) => descombinarMergeSeguro(ws, rango));
};

const aplicarMergesInstitucion = (ws, filaBase) => {
    const filaFin = filaBase + 2;

    [
        `A${filaBase}:A${filaFin}`,
        `B${filaBase}:D${filaFin}`,
        `H${filaBase}:H${filaFin}`,
        `N${filaBase}:N${filaFin}`,
    ].forEach((rango) => aplicarMergeSeguro(ws, rango));
};

const descombinarMergesInstitucion = (ws, filaBase) => {
    const filaFin = filaBase + 2;

    [
        `A${filaBase}:A${filaFin}`,
        `B${filaBase}:D${filaFin}`,
        `H${filaBase}:H${filaFin}`,
        `N${filaBase}:N${filaFin}`,
    ].forEach((rango) => descombinarMergeSeguro(ws, rango));
};

const copiarHojaDesdePlantilla = (workbook, hojaPlantilla, nombreHoja) => {
    const ws = workbook.addWorksheet(nombreHoja, {
        properties: clone(hojaPlantilla.properties),
        pageSetup: clone(hojaPlantilla.pageSetup),
        views: clone(hojaPlantilla.views),
    });

    ws.properties = clone(hojaPlantilla.properties) || ws.properties;
    ws.pageSetup = clone(hojaPlantilla.pageSetup) || ws.pageSetup;
    ws.headerFooter = clone(hojaPlantilla.headerFooter) || ws.headerFooter;
    ws.views = clone(hojaPlantilla.views) || ws.views;

    hojaPlantilla.columns.forEach((columnaOrigen, index) => {
        const columnaDestino = ws.getColumn(index + 1);
        columnaDestino.width = columnaOrigen.width;
        columnaDestino.hidden = columnaOrigen.hidden;
        columnaDestino.outlineLevel = columnaOrigen.outlineLevel;
        columnaDestino.style = clone(columnaOrigen.style) || {};
    });

    for (let rowNumber = 1; rowNumber <= CONFIG.filaFooterBase; rowNumber += 1) {
        const filaOrigen = hojaPlantilla.getRow(rowNumber);
        const filaDestino = ws.getRow(rowNumber);

        filaDestino.height = filaOrigen.height;
        filaDestino.hidden = filaOrigen.hidden;
        filaDestino.outlineLevel = filaOrigen.outlineLevel;

        for (let col = 1; col <= CONFIG.ultimaColumna; col += 1) {
            copiarCelda(filaOrigen.getCell(col), filaDestino.getCell(col), true);
        }
    }

    const merges = hojaPlantilla.model?.merges || [];
    merges.forEach((rango) => aplicarMergeSeguro(ws, rango));

    return ws;
};

const agregarLogo = async (workbook, ws) => {
    try {
        const buffer = await obtenerBufferDesdeAsset(logoGobernacion);

        const imageId = workbook.addImage({
            buffer,
            extension: "png",
        });

        ws.addImage(imageId, {
            tl: { col: 0.05, row: 0.1 },
            br: { col: 1.05, row: 3.95 },
            editAs: "oneCell",
        });
    } catch (error) {
        console.warn("No se pudo agregar el logo:", error);
    }
};

const obtenerNombreRuta = (ruta, index) =>
    ruta?.descripcionRutaAgrupada?.trim?.() ||
    ruta?.nombreRutaAgrupada ||
    ruta?.ruta ||
    ruta?.codigoRutaAgrupada ||
    `Ruta ${index + 1}`;

const obtenerProductosDesdeColegios = (ruta) => {
    const colegios = Array.isArray(ruta?.colegios) ? ruta.colegios : [];
    const mapa = new Map();

    colegios.forEach((colegio) => {
        const productos = Array.isArray(colegio?.productos) ? colegio.productos : [];

        productos.forEach((producto, index) => {
            const key =
                producto?.idProducto ||
                producto?.codigoProducto ||
                `${producto?.producto || producto?.descripcion || ""}_${index}`;

            if (!mapa.has(key)) {
                mapa.set(key, {
                    idProducto: producto?.idProducto || null,
                    codigoProducto: producto?.codigoProducto || "",
                    producto:
                        producto?.producto ||
                        producto?.descripcion ||
                        producto?.nombre ||
                        "",
                    unidad:
                        producto?.unidad ||
                        producto?.unidadCobertura ||
                        producto?.unidadCoberturaExcel ||
                        "",
                    lote1: producto?.lote1 || producto?.lotes?.lote1 || "",
                    lote2: producto?.lote2 || producto?.lotes?.lote2 || "",
                    lote3: producto?.lote3 || producto?.lotes?.lote3 || "",
                    observacion:
                        producto?.observacion ||
                        producto?.observaciones ||
                        "",
                });
            }
        });
    });

    return Array.from(mapa.values()).sort((a, b) =>
        String(a.producto || "").localeCompare(String(b.producto || ""), "es", {
            sensitivity: "base",
        })
    );
};

const obtenerProductosRuta = (ruta) => {
    const productosDirectos = Array.isArray(ruta?.productos) ? ruta.productos : [];
    const productos = productosDirectos.length ? productosDirectos : obtenerProductosDesdeColegios(ruta);

    return productos.map((producto, index) => ({
        key: producto?.idProducto || producto?.codigoProducto || `producto_${index}`,
        producto:
            producto?.producto ||
            producto?.descripcion ||
            producto?.nombre ||
            "",
        unidad:
            producto?.unidad ||
            producto?.unidadCobertura ||
            producto?.unidadCoberturaExcel ||
            "",
        lote1: producto?.lote1 || producto?.lotes?.lote1 || "",
        lote2: producto?.lote2 || producto?.lotes?.lote2 || "",
        lote3: producto?.lote3 || producto?.lotes?.lote3 || "",
        observacion:
            producto?.observacion ||
            producto?.observaciones ||
            "",
    }));
};

const obtenerInstitucionesRuta = (ruta) => {
    const colegios = Array.isArray(ruta?.colegios) ? ruta.colegios : [];

    return colegios.map((colegio, index) => ({
        key:
            colegio?.codigoColegio ||
            colegio?.idColegio ||
            colegio?.key ||
            `institucion_${index}`,

        institucion:
            colegio?.institucion ||
            colegio?.nombreInstitucion ||
            colegio?.nombreColegio ||
            colegio?.nombre ||
            colegio?.label ||
            "",

        sede:
            colegio?.sede ||
            colegio?.nombreSede ||
            colegio?.codigoSede ||
            colegio?.codigoColegio ||
            colegio?.nombreColegio ||
            colegio?.nombre ||
            "",

        manipuladora:
            colegio?.manipuladora ||
            colegio?.nombreManipuladora ||
            "",

        observaciones:
            colegio?.observacion ||
            colegio?.observaciones ||
            "",

        lotes: {
            l1: {
                lote: colegio?.lotes?.l1?.lote || colegio?.lotes?.lote1 || colegio?.lote1 || "",
                condicion:
                    colegio?.lotes?.l1?.condicion ||
                    colegio?.condiciones?.lote1 ||
                    colegio?.condicionLote1 ||
                    "",
                ce:
                    colegio?.lotes?.l1?.ce ||
                    colegio?.temperaturas?.ce?.lote1 ||
                    colegio?.tempCeLote1 ||
                    "",
                r:
                    colegio?.lotes?.l1?.r ||
                    colegio?.temperaturas?.r?.lote1 ||
                    colegio?.tempRLote1 ||
                    "",
                p:
                    colegio?.lotes?.l1?.p ||
                    colegio?.temperaturas?.p?.lote1 ||
                    colegio?.tempPLote1 ||
                    "",
                q:
                    colegio?.lotes?.l1?.q ||
                    colegio?.temperaturas?.q?.lote1 ||
                    colegio?.tempQLote1 ||
                    "",
                y:
                    colegio?.lotes?.l1?.y ||
                    colegio?.temperaturas?.y?.lote1 ||
                    colegio?.tempYLote1 ||
                    "",
            },
            l2: {
                lote: colegio?.lotes?.l2?.lote || colegio?.lotes?.lote2 || colegio?.lote2 || "",
                condicion:
                    colegio?.lotes?.l2?.condicion ||
                    colegio?.condiciones?.lote2 ||
                    colegio?.condicionLote2 ||
                    "",
                ce:
                    colegio?.lotes?.l2?.ce ||
                    colegio?.temperaturas?.ce?.lote2 ||
                    colegio?.tempCeLote2 ||
                    "",
                r:
                    colegio?.lotes?.l2?.r ||
                    colegio?.temperaturas?.r?.lote2 ||
                    colegio?.tempRLote2 ||
                    "",
                p:
                    colegio?.lotes?.l2?.p ||
                    colegio?.temperaturas?.p?.lote2 ||
                    colegio?.tempPLote2 ||
                    "",
                q:
                    colegio?.lotes?.l2?.q ||
                    colegio?.temperaturas?.q?.lote2 ||
                    colegio?.tempQLote2 ||
                    "",
                y:
                    colegio?.lotes?.l2?.y ||
                    colegio?.temperaturas?.y?.lote2 ||
                    colegio?.tempYLote2 ||
                    "",
            },
            l3: {
                lote: colegio?.lotes?.l3?.lote || colegio?.lotes?.lote3 || colegio?.lote3 || "",
                condicion:
                    colegio?.lotes?.l3?.condicion ||
                    colegio?.condiciones?.lote3 ||
                    colegio?.condicionLote3 ||
                    "",
                ce:
                    colegio?.lotes?.l3?.ce ||
                    colegio?.temperaturas?.ce?.lote3 ||
                    colegio?.tempCeLote3 ||
                    "",
                r:
                    colegio?.lotes?.l3?.r ||
                    colegio?.temperaturas?.r?.lote3 ||
                    colegio?.tempRLote3 ||
                    "",
                p:
                    colegio?.lotes?.l3?.p ||
                    colegio?.temperaturas?.p?.lote3 ||
                    colegio?.tempPLote3 ||
                    "",
                q:
                    colegio?.lotes?.l3?.q ||
                    colegio?.temperaturas?.q?.lote3 ||
                    colegio?.tempQLote3 ||
                    "",
                y:
                    colegio?.lotes?.l3?.y ||
                    colegio?.temperaturas?.y?.lote3 ||
                    colegio?.tempYLote3 ||
                    "",
            },
        },
    }));
};

const redimensionarProductos = (ws, totalProductos) => {
    const filasObjetivo = Math.max(Number(totalProductos || 0), 1);
    const diferencia = filasObjetivo - CONFIG.productosBase;

    for (let fila = CONFIG.inicioProductos; fila <= CONFIG.finProductosBase; fila += 1) {
        descombinarMergesProducto(ws, fila);
    }

    if (diferencia > 0) {
        ws.spliceRows(
            CONFIG.filaSeparadorBase,
            0,
            ...Array.from({ length: diferencia }, () => [])
        );

        for (let i = 0; i < diferencia; i += 1) {
            copiarFila(ws, CONFIG.finProductosBase, CONFIG.filaSeparadorBase + i, false);
        }
    }

    if (diferencia < 0) {
        const filaEliminar = CONFIG.inicioProductos + filasObjetivo;
        ws.spliceRows(filaEliminar, Math.abs(diferencia));
    }

    const filaFinProductos = CONFIG.inicioProductos + filasObjetivo - 1;

    for (let fila = CONFIG.inicioProductos; fila <= filaFinProductos; fila += 1) {
        aplicarMergesProducto(ws, fila);
    }

    return {
        offsetProductos: diferencia,
        filaFinProductos,
        filaHeaderInstituciones1: CONFIG.filaHeaderInstituciones1Base + diferencia,
        filaHeaderInstituciones2: CONFIG.filaHeaderInstituciones2Base + diferencia,
        inicioInstituciones: CONFIG.inicioInstitucionesBase + diferencia,
        finInstitucionesBase: CONFIG.finInstitucionesBase + diferencia,
        filaFooter: CONFIG.filaFooterBase + diferencia,
    };
};

const descombinarMergesInstitucionesDinamicas = (ws, filaInicio, filaFin) => {
    const merges = [...(ws.model?.merges || [])];

    merges.forEach((rango) => {
        const match = String(rango).match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
        if (!match) return;

        const filaDesde = Number(match[2]);
        const filaHasta = Number(match[4]);

        const cruzaZona =
            filaDesde <= filaFin &&
            filaHasta >= filaInicio;

        if (cruzaZona) {
            descombinarMergeSeguro(ws, rango);
        }
    });
};

const limpiarMergesZonaInstituciones = (ws, filaInicio, filaFin) => {
    const merges = [...(ws.model?.merges || [])];

    merges.forEach((rango) => {
        const match = String(rango).match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
        if (!match) return;

        const filaDesde = Number(match[2]);
        const filaHasta = Number(match[4]);

        if (filaDesde <= filaFin && filaHasta >= filaInicio) {
            descombinarMergeSeguro(ws, rango);
        }
    });
};

const redimensionarInstituciones = (ws, totalInstituciones, layout) => {
    const institucionesObjetivo = Math.max(Number(totalInstituciones || 0), 1);

    const filasObjetivo =
        institucionesObjetivo * CONFIG.filasPorInstitucion;

    const filasBase =
        CONFIG.institucionesBase * CONFIG.filasPorInstitucion;

    const diferencia = filasObjetivo - filasBase;

    const filaInicio = layout.inicioInstituciones;
    const filaFooterOriginal = layout.filaFooter;

    // Limpiar merges viejos antes de insertar/eliminar.
    limpiarMergesZonaInstituciones(
        ws,
        filaInicio,
        filaFooterOriginal + Math.max(diferencia, 0) + 20
    );

    if (diferencia > 0) {
        ws.spliceRows(
            filaFooterOriginal,
            0,
            ...Array.from({ length: diferencia }, () => [])
        );

        for (let i = 0; i < diferencia; i += 1) {
            const filaReferencia =
                filaInicio + (i % CONFIG.filasPorInstitucion);

            const filaDestino = filaFooterOriginal + i;

            copiarFila(ws, filaReferencia, filaDestino, false);
        }
    }

    if (diferencia < 0) {
        const filaEliminar = filaInicio + filasObjetivo;
        ws.spliceRows(filaEliminar, Math.abs(diferencia));
    }

    const finInstituciones = filaInicio + filasObjetivo - 1;
    const filaFooterFinal = filaInicio + filasObjetivo;

    // Limpiar de nuevo después del spliceRows porque ExcelJS mueve merges.
    limpiarMergesZonaInstituciones(
        ws,
        filaInicio,
        filaFooterFinal + 20
    );

    // Recrear merges para TODAS las instituciones reales.
    for (let i = 0; i < institucionesObjetivo; i += 1) {
        const filaBase = filaInicio + i * CONFIG.filasPorInstitucion;
        const filaFin = filaBase + 2;

        aplicarMergeSeguro(ws, `A${filaBase}:A${filaFin}`); // INSTITUCIÓN
        aplicarMergeSeguro(ws, `B${filaBase}:D${filaFin}`); // SEDE
        aplicarMergeSeguro(ws, `H${filaBase}:H${filaFin}`); // MANIPULADORA
        aplicarMergeSeguro(ws, `N${filaBase}:N${filaFin}`); // OBSERVACIONES
    }

    return {
        ...layout,
        offsetInstituciones: diferencia,
        finInstituciones,
        filaFooterFinal,
    };
};




const reconstruirEncabezadoInstituciones = (ws, layout) => {
    descombinarMergesEncabezadoInstituciones(
        ws,
        layout.filaHeaderInstituciones1,
        layout.filaHeaderInstituciones2
    );

    const f1 = layout.filaHeaderInstituciones1;
    const f2 = layout.filaHeaderInstituciones2;

    // Se limpian antes de combinar para evitar que la plantilla copie
    // "OBSERVACIONES" en las dos filas del encabezado.
    ws.getCell(`N${f1}`).value = null;
    ws.getCell(`N${f2}`).value = null;

    aplicarMergesEncabezadoInstituciones(
        ws,
        layout.filaHeaderInstituciones1,
        layout.filaHeaderInstituciones2
    );

    ws.getCell(`A${f1}`).value = "INSTITUCIÓN";
    ws.getCell(`B${f1}`).value = "SEDE";
    ws.getCell(`E${f1}`).value = "LOTE";
    ws.getCell(`G${f1}`).value = "CONDICIONES";
    ws.getCell(`G${f2}`).value = "C / NC";
    ws.getCell(`H${f1}`).value = "MANIPULADORA";
    ws.getCell(`I${f1}`).value = "TEMPERATURA (°C)";
    ws.getCell(`I${f2}`).value = "CE";
    ws.getCell(`J${f2}`).value = "R";
    ws.getCell(`K${f2}`).value = "P";
    ws.getCell(`L${f2}`).value = "Q";
    ws.getCell(`M${f2}`).value = "Y";

    ws.getCell(`N${f1}`).value = "OBSERVACIONES";
};

const llenarDatosGenerales = (ws, { despacho, nombreRuta }) => {
    const contrato = despacho?.contrato || despacho?.descripcion || despacho?.codigo || "";
    const fechaConsumo = formatearRangoFechas(
        despacho?.fechaConsumoDesde,
        despacho?.fechaConsumoHasta
    );
    const fechaEncabezado = formatearFecha(
        despacho?.fechaDespacho ||
        despacho?.fecha ||
        despacho?.created_at ||
        despacho?.createdAt ||
        ""
    );
    const etc = despacho?.etc || despacho?.ETC || despacho?.entidadTerritorial || "";
    const modalidad = despacho?.modalidad || despacho?.tipoPeriodo || despacho?.descripcionModalidad || "";
    const auxiliar = despacho?.auxiliarBodega || despacho?.auxiliar || despacho?.nombreAuxiliar || "";

    ws.getCell(CONFIG.celdas.contrato).value = `CONTRATO: ${contrato}`;
    ws.getCell(CONFIG.celdas.fecha).value = `FECHA CONSUMO: ${fechaConsumo}`;
    ws.getCell(CONFIG.celdas.etc).value = `ETC: ${etc}`;
    ws.getCell(CONFIG.celdas.modalidad).value = `MODALIDAD: ${modalidad}`;
    ws.getCell(CONFIG.celdas.ruta).value = `RUTA: ${nombreRuta}`;
    ws.getCell(CONFIG.celdas.auxiliarBodega).value = `AUXILIAR DE BODEGA: ${auxiliar}`;

    // N3 mantiene la fecha original del encabezado, solo formateada como día/mes/año.
    ws.getCell("N3").value = '21/06/2026';
};

const llenarProductos = (ws, productos) => {
    const totalFilas = Math.max(productos.length, 1);
    const filaFin = CONFIG.inicioProductos + totalFilas - 1;

    limpiarRango(ws, CONFIG.inicioProductos, filaFin, 1, CONFIG.ultimaColumna);

    productos.forEach((producto, index) => {
        const fila = CONFIG.inicioProductos + index;

        const nombreProducto = producto.unidad
            ? `${producto.producto} - ${producto.unidad}`
            : producto.producto;

        ws.getCell(`A${fila}`).value = nombreProducto || "";
        ws.getCell(`B${fila}`).value = producto.lote1 || "";
        ws.getCell(`E${fila}`).value = producto.lote2 || "";
        ws.getCell(`G${fila}`).value = producto.lote3 || "";
        ws.getCell(`I${fila}`).value = producto.observacion || "";
    });
};
const llenarInstituciones = (ws, instituciones, layout) => {
    const totalInstituciones = Math.max(instituciones.length, 1);
    const filaFin =
        layout.inicioInstituciones +
        totalInstituciones * CONFIG.filasPorInstitucion -
        1;

    limpiarRango(ws, layout.inicioInstituciones, filaFin, 1, CONFIG.ultimaColumna);

    instituciones.forEach((item, index) => {
        const filaBase =
            layout.inicioInstituciones + index * CONFIG.filasPorInstitucion;

        const fillBloque =
            index % 2 === 0
                ? {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFD9D9D9" },
                }
                : {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFFFFFFF" },
                };

        for (let fila = filaBase; fila <= filaBase + 2; fila += 1) {
            for (let col = 1; col <= CONFIG.ultimaColumna; col += 1) {
                ws.getRow(fila).getCell(col).fill = fillBloque;
            }
        }

        ws.getCell(`A${filaBase}`).value = item.institucion || "";
        ws.getCell(`B${filaBase}`).value = item.sede || "";
        ws.getCell(`H${filaBase}`).value = item.manipuladora || "";
        ws.getCell(`N${filaBase}`).value = item.observaciones || "";

        const lotes = ["l1", "l2", "l3"];

        lotes.forEach((loteKey, loteIndex) => {
            const fila = filaBase + loteIndex;
            const lote = item?.lotes?.[loteKey] || {};

            ws.getCell(`E${fila}`).value = loteKey.toUpperCase();
            ws.getCell(`F${fila}`).value = lote?.lote || "";
            ws.getCell(`G${fila}`).value = lote?.condicion || "";
            ws.getCell(`I${fila}`).value = lote?.ce || "";
            ws.getCell(`J${fila}`).value = lote?.r || "";
            ws.getCell(`K${fila}`).value = lote?.p || "";
            ws.getCell(`L${fila}`).value = lote?.q || "";
            ws.getCell(`M${fila}`).value = lote?.y || "";
        });
    });
};
const reconstruirFooterFormato = (ws, filaFooter) => {
    limpiarRango(ws, filaFooter, filaFooter, 1, CONFIG.ultimaColumna);

    // Quita merges viejos que crucen la fila del footer
    const merges = [...(ws.model?.merges || [])];

    merges.forEach((rango) => {
        const match = String(rango).match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
        if (!match) return;

        const filaDesde = Number(match[2]);
        const filaHasta = Number(match[4]);

        if (filaDesde <= filaFooter && filaHasta >= filaFooter) {
            descombinarMergeSeguro(ws, rango);
        }
    });

    aplicarMergeSeguro(ws, `A${filaFooter}:N${filaFooter}`);

    const celda = ws.getCell(`A${filaFooter}`);

    celda.value =
        "Condiciones organolépticas: ponga C (cumple) si el producto cuenta con olor, color, sabor y apariencia física idónea. / " +
        "Temperatura las siglas son CE: Cerdo, R: Res, P: Pollo, Q: Queso, Y: Yogurt / " +
        "Lote identificar con un ✓ el lote que se despacha en la sede";

    celda.alignment = {
        ...(celda.alignment || {}),
        horizontal: "left",
        vertical: "middle",
        wrapText: false,
        shrinkToFit: true,
    };

    celda.font = {
        ...(celda.font || {}),
        size: 8,
        bold: true,
    };
};


const configurarImpresion = (ws, ultimaFila) => {
    ws.pageSetup = {
        ...(ws.pageSetup || {}),
        printArea: `A1:N${ultimaFila}`,
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        orientation: "landscape",
    };
};

const llenarHojaRuta = async (workbook, ws, { despacho, ruta, index }) => {
    const nombreRuta = obtenerNombreRuta(ruta, index);
    const productos = obtenerProductosRuta(ruta);
    const instituciones = obtenerInstitucionesRuta(ruta);

    const layoutProductos = redimensionarProductos(ws, productos.length);
    const layoutFinal = redimensionarInstituciones(
        ws,
        instituciones.length,
        layoutProductos
    );

    reconstruirEncabezadoInstituciones(ws, layoutFinal);

    llenarDatosGenerales(ws, {
        despacho,
        nombreRuta,
    });

    llenarProductos(ws, productos);
    llenarInstituciones(ws, instituciones, layoutFinal);
    reconstruirFooterFormato(ws, layoutFinal.filaFooterFinal);
    eliminarFilasDespuesDelFooter(ws, layoutFinal.filaFooterFinal);

    await agregarLogo(workbook, ws);

    configurarImpresion(ws, layoutFinal.filaFooterFinal);
};

const eliminarFilasDespuesDelFooter = (ws, filaFooterFinal) => {
    const totalFilas = ws.rowCount;

    if (totalFilas > filaFooterFinal) {
        ws.spliceRows(
            filaFooterFinal + 1,
            totalFilas - filaFooterFinal
        );
    }
};

const descargarWorkbook = async (workbook, nombreArchivo) => {
    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    saveAs(blob, nombreArchivo);
};

export class ExcelFormatoTrazabilidadExporter {
    static async exportar({
        data,
        nombreArchivo = "F-SGC-28 FORMATO DE TRAZABILIDAD.xlsx",
    }) {
        if (!data) {
            throw new Error("No hay información disponible para exportar.");
        }

        const rutas = Array.isArray(data?.rutas) ? data.rutas : [];

        if (!rutas.length) {
            throw new Error("No hay rutas disponibles para exportar el formato de trazabilidad.");
        }

        const templateBuffer = await obtenerBufferDesdeAsset(plantillaTrazabilidad);

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(templateBuffer);

        const hojaPlantilla =
            workbook.getWorksheet(CONFIG.hojaPlantilla) ||
            workbook.getWorksheet("Hoja1") ||
            workbook.worksheets[0];

        if (!hojaPlantilla) {
            throw new Error("La plantilla no tiene una hoja válida para copiar.");
        }

        const hojasOriginales = workbook.worksheets.map((sheet) => sheet.id);
        const nombresUsados = new Set();

        for (const [index, ruta] of rutas.entries()) {
            const nombreRuta = obtenerNombreRuta(ruta, index);

            const nombreHoja = normalizarNombreHoja(
                nombreRuta,
                `RUTA ${index + 1}`,
                nombresUsados
            );

            const ws = copiarHojaDesdePlantilla(workbook, hojaPlantilla, nombreHoja);

            await llenarHojaRuta(workbook, ws, {
                despacho: data?.despacho || {},
                ruta,
                index,
            });
        }

        hojasOriginales.forEach((sheetId) => {
            const sheet = workbook.getWorksheet(sheetId);
            if (sheet) {
                workbook.removeWorksheet(sheet.id);
            }
        });

        await descargarWorkbook(workbook, nombreArchivo);
    }
}

export default ExcelFormatoTrazabilidadExporter;