import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import logoGobernacion from "../../assets/logoPae.png";
import {
    FORMATO_META,
    construirFilasFormatoRuta,
    sanitizarNombreHoja,
} from "../helpers/informeUtils";



const BORDER_THIN = {
    top: { style: "thin", color: { argb: "FF000000" } },
    left: { style: "thin", color: { argb: "FF000000" } },
    bottom: { style: "thin", color: { argb: "FF000000" } },
    right: { style: "thin", color: { argb: "FF000000" } },
};

const BORDER_MEDIUM = {
    top: { style: "medium", color: { argb: "FF000000" } },
    left: { style: "medium", color: { argb: "FF000000" } },
    bottom: { style: "medium", color: { argb: "FF000000" } },
    right: { style: "medium", color: { argb: "FF000000" } },
};

const CENTER = {
    vertical: "middle",
    horizontal: "center",
    wrapText: true,
};

const LEFT = {
    vertical: "middle",
    horizontal: "left",
    wrapText: true,
};

const RIGHT = {
    vertical: "middle",
    horizontal: "right",
    wrapText: true,
};

const ETIQUETAS_JORNADA = {
    AM: "AM",
    PM: "PM",
    JORNADA_UNICA: "JORNADA ÚNICA",
    SIN_JORNADA: "SIN JORNADA",
};

async function cargarLogoComoBuffer() {
    const response = await fetch(logoGobernacion, {
        method: "GET",
        cache: "force-cache",
    });

    if (!response.ok) {
        throw new Error(`No se pudo cargar el logo: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
}

async function intentarAgregarLogo(workbook) {
    try {
        const buffer = await cargarLogoComoBuffer();

        return workbook.addImage({
            buffer,
            extension: "png",
        });
    } catch (error) {
        console.error("No se pudo cargar el logo para exportación:", error);
        return null;
    }
}


function aplicarBordeRango(ws, filaInicio, filaFin, colInicio, colFin, border = BORDER_THIN) {
    for (let row = filaInicio; row <= filaFin; row += 1) {
        for (let col = colInicio; col <= colFin; col += 1) {
            ws.getCell(row, col).border = border;
        }
    }
}

function setValor(ws, celda, valor, estilo = {}) {
    const cell = ws.getCell(celda);
    cell.value = valor;
    Object.assign(cell, estilo);
    return cell;
}

function aplicarFuente(cell, config = {}) {
    cell.font = {
        name: "Arial",
        size: 9,
        ...config,
    };
}

function llenarFilaVaciaConBorde(ws, rowNumber, colInicio = 1, colFin = 7) {
    for (let col = colInicio; col <= colFin; col += 1) {
        ws.getCell(rowNumber, col).border = BORDER_THIN;
    }
}

function obtenerEtiquetaJornada(jornada) {
    return ETIQUETAS_JORNADA[jornada] || jornada || "SIN JORNADA";
}

function construirFilasRutaFormato(ruta) {
    return (ruta?.productos || []).map((item) => ({
        producto: item?.producto || "",
        emp: item?.unidadCobertura || "",
        pac: Number(item?.pac || 0),
        und: Number(item?.und || 0),
        total: Number(item?.total || 0),
        lotes: item?.lotes || "",
    }));
}

function obtenerBloquesRutaFormato(exportData) {
    const jornadas = Array.isArray(exportData?.jornadas) ? exportData.jornadas : [];
    const rutasDirectas = Array.isArray(exportData?.rutas) ? exportData.rutas : [];

    if (jornadas.length > 0) {
        return jornadas.flatMap((jornadaItem) => {
            const jornada = jornadaItem?.jornada || "SIN_JORNADA";
            const rutas = Array.isArray(jornadaItem?.rutas) ? jornadaItem.rutas : [];

            return rutas.map((ruta) => ({
                ...ruta,
                jornada,
                totalJornadaPac: Number(jornadaItem?.totalPac || 0),
                totalJornadaUnd: Number(jornadaItem?.totalUnd || 0),
                totalJornada: Number(jornadaItem?.totalJornada || 0),
            }));
        });
    }

    if (rutasDirectas.length > 0) {
        return rutasDirectas.map((ruta) => ({
            ...ruta,
            jornada: ruta?.jornada || "SIN_JORNADA",
            totalJornadaPac: Number(ruta?.totalJornadaPac || 0),
            totalJornadaUnd: Number(ruta?.totalJornadaUnd || 0),
            totalJornada: Number(ruta?.totalJornada || 0),
        }));
    }

    return [];
}



function aplicarEncabezadoComun(ws, imageId, exportData, despacho, tituloSecundario, paginaTexto, lineaA5 = "") {
    ws.columns = [
        { width: 34 },
        { width: 10 },
        { width: 10 },
        { width: 10 },
        { width: 12 },
        { width: 20 },
    ];

    ws.mergeCells("A1:A4");
    ws.mergeCells("B1:D1");
    ws.mergeCells("B2:D3");
    ws.mergeCells("B4:D4");
    ws.mergeCells("E1:F1");
    ws.mergeCells("E2:F2");
    ws.mergeCells("E3:F3");
    ws.mergeCells("E4:F4");

    ws.getRow(1).height = 18;
    ws.getRow(2).height = 35;
    ws.getRow(3).height = 18;
    ws.getRow(4).height = 18;
    ws.getRow(5).height = 22;

    ws.addImage(imageId, {
        tl: { col: 0.04, row: 0.04 },
        br: { col: 1.95, row: 3.95 },
        editAs: "oneCell",
    });

    setValor(ws, "B1", FORMATO_META.proceso, { alignment: CENTER });
    setValor(
        ws,
        "B2",
        exportData.tipo === "POR_CATEGORIA"
            ? FORMATO_META.formatoCategoria
            : exportData.tipo === "POR_SEDE"
                ? (FORMATO_META.formatoSede || "FORMATO CONSOLIDADO POR SEDE")
                : FORMATO_META.formatoRuta,
        { alignment: CENTER }
    );
    setValor(ws, "B4", tituloSecundario, { alignment: CENTER });

    setValor(ws, "E1", `Código: ${FORMATO_META.codigo}`, { alignment: CENTER });
    setValor(ws, "E2", `Fecha Actualización: ${FORMATO_META.fechaActualizacion}`, { alignment: CENTER });
    setValor(ws, "E3", `Versión: ${FORMATO_META.version}`, { alignment: CENTER });
    setValor(ws, "E4", paginaTexto, { alignment: CENTER });

    ["B1", "B2", "B3", "B4", "E1", "E2", "E3", "E4"].forEach((ref) => {
        const cell = ws.getCell(ref);
        aplicarFuente(cell, {
            bold: true,
            size: ref === "B2" ? 9 : 8,
        });
        cell.border = BORDER_THIN;
    });

    ws.getCell("A1").border = BORDER_THIN;
    ws.getCell("A2").border = BORDER_THIN;
    ws.getCell("A3").border = BORDER_THIN;
    ws.getCell("A4").border = BORDER_THIN;

    aplicarBordeRango(ws, 1, 4, 2, 4, BORDER_THIN);
    aplicarBordeRango(ws, 1, 4, 5, 6, BORDER_THIN);


    ws.mergeCells("A5:F5");
    setValor(ws, "A5", `${despacho?.fechaContrato || "-"}`, { alignment: CENTER });
    aplicarFuente(ws.getCell("A5"), { bold: true, size: 9 });
    aplicarBordeRango(ws, 5, 5, 1, 6, BORDER_THIN);

    ws.getRow(6).height = 20;
    const headers = ["PRODUCTO", "EMP", "PAC", "UND", "TOTAL", "LOTES"];

    headers.forEach((header, i) => {
        const cell = ws.getCell(6, i + 1);
        cell.value = header;
        cell.alignment = CENTER;
        cell.border = BORDER_THIN;
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFEDEDED" },
        };
        aplicarFuente(cell, { bold: true, size: 9 });
    });
}

function aplicarEncabezadoSede(ws, imageId, despacho, tituloSecundario, paginaTexto, lineaA5 = "") {
    ws.columns = [
        { width: 42 },
        { width: 14 },
        { width: 16 },
        { width: 22 },
        { width: 18 },
    ];

    ws.mergeCells("A1:A4");
    ws.mergeCells("B1:C1");
    ws.mergeCells("B2:C3");
    ws.mergeCells("B4:C4");
    ws.mergeCells("D1:E1");
    ws.mergeCells("D2:E2");
    ws.mergeCells("D3:E3");
    ws.mergeCells("D4:E4");

    ws.getRow(1).height = 18;
    ws.getRow(2).height = 35;
    ws.getRow(3).height = 18;
    ws.getRow(4).height = 18;
    ws.getRow(5).height = 22;
    ws.getRow(6).height = 20;


    ws.addImage(imageId, {
        tl: { col: 0.04, row: 0.04 },
        br: { col: 1.95, row: 3.95 },
        editAs: "oneCell",
    });

    setValor(ws, "B1", FORMATO_META.proceso, { alignment: CENTER });
    setValor(
        ws,
        "B2",
        FORMATO_META.formatoSede || "FORMATO CONSOLIDADO POR SEDE",
        { alignment: CENTER }
    );
    setValor(ws, "B4", tituloSecundario, { alignment: CENTER });

    setValor(ws, "D1", `Código: ${FORMATO_META.codigo}`, { alignment: CENTER });
    setValor(ws, "D2", `Fecha Actualización: ${FORMATO_META.fechaActualizacion}`, { alignment: CENTER });
    setValor(ws, "D3", `Versión: ${FORMATO_META.version}`, { alignment: CENTER });
    setValor(ws, "D4", paginaTexto, { alignment: CENTER });

    ["B1", "B2", "B4", "D1", "D2", "D3", "D4"].forEach((ref) => {
        const cell = ws.getCell(ref);
        aplicarFuente(cell, {
            bold: true,
            size: ref === "B2" ? 9 : 8,
        });
        cell.border = BORDER_THIN;
    });

    ws.getCell("A1").border = BORDER_THIN;
    ws.getCell("A2").border = BORDER_THIN;
    ws.getCell("A3").border = BORDER_THIN;
    ws.getCell("A4").border = BORDER_THIN;

    aplicarBordeRango(ws, 1, 4, 2, 3, BORDER_THIN);
    aplicarBordeRango(ws, 1, 4, 4, 5, BORDER_THIN);

    ws.mergeCells("A5:E5");
    setValor(
        ws,
        "A5",
        `${despacho?.fechaContrato || "-"}`,
        { alignment: CENTER }
    );
    aplicarFuente(ws.getCell("A5"), { bold: true, size: 9 });
    aplicarBordeRango(ws, 5, 5, 1, 5, BORDER_THIN);

    ws.mergeCells("D6:E6");
    const headers = [
        { cell: "A6", text: "SEDE" },
        { cell: "B6", text: "PRODUCTOS" },
        { cell: "C6", text: "CANTIDAD" },
        { cell: "D6", text: "JORNADAS" },
    ];

    headers.forEach(({ cell, text }) => {
        const ref = ws.getCell(cell);
        ref.value = text;
        ref.alignment = CENTER;
        ref.border = BORDER_THIN;
        ref.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFEDEDED" },
        };
        aplicarFuente(ref, { bold: true, size: 9 });
    });

    applyBorderSafe(ws, "E6");
}

function aplicarEncabezadoCategoria(ws, imageId, despacho, categoriaNombre, tituloSecundario, paginaTexto) {
    ws.columns = [
        { width: 34 },
        { width: 10 },
        { width: 10 },
        { width: 10 },
        { width: 12 },
        { width: 20 },
    ];

    ws.mergeCells("A1:A4");
    ws.mergeCells("B1:D1");
    ws.mergeCells("B2:D3");
    ws.mergeCells("B4:D4");
    ws.mergeCells("E1:F1");
    ws.mergeCells("E2:F2");
    ws.mergeCells("E3:F3");
    ws.mergeCells("E4:F4");

    ws.getRow(1).height = 18;
    ws.getRow(2).height = 35;
    ws.getRow(3).height = 18;
    ws.getRow(4).height = 18;
    ws.getRow(5).height = 22;
    ws.getRow(6).height = 20;


    ws.addImage(imageId, {
        tl: { col: 0.04, row: 0.04 },
        br: { col: 1.95, row: 3.95 },
        editAs: "oneCell",
    });

    setValor(ws, "B1", FORMATO_META.proceso, { alignment: CENTER });
    setValor(
        ws,
        "B2",
        FORMATO_META.formatoCategoria || "FORMATO CONSOLIDADO POR CATEGORÍA Y RUTA",
        { alignment: CENTER }
    );
    setValor(ws, "B4", tituloSecundario, { alignment: CENTER });

    setValor(ws, "E1", `Código: ${FORMATO_META.codigo}`, { alignment: CENTER });
    setValor(ws, "E2", `Fecha Actualización: ${FORMATO_META.fechaActualizacion}`, { alignment: CENTER });
    setValor(ws, "E3", `Versión: ${FORMATO_META.version}`, { alignment: CENTER });
    setValor(ws, "E4", paginaTexto, { alignment: CENTER });

    ["B1", "B2", "B4", "E1", "E2", "E3", "E4"].forEach((ref) => {
        const cell = ws.getCell(ref);
        aplicarFuente(cell, {
            bold: true,
            size: ref === "B2" ? 9 : 8,
        });
        cell.border = BORDER_THIN;
    });

    ws.getCell("A1").border = BORDER_THIN;
    ws.getCell("A2").border = BORDER_THIN;
    ws.getCell("A3").border = BORDER_THIN;
    ws.getCell("A4").border = BORDER_THIN;

    aplicarBordeRango(ws, 1, 4, 2, 4, BORDER_THIN);
    aplicarBordeRango(ws, 1, 4, 5, 6, BORDER_THIN);

    ws.mergeCells("A5:G5");
    setValor(
        ws,
        "A5",
        `${despacho?.fechaContrato || "-"}`,
        { alignment: CENTER }
    );
    aplicarFuente(ws.getCell("A5"), { bold: true, size: 9 });
    aplicarBordeRango(ws, 5, 5, 1, 5, BORDER_THIN);
    aplicarFuente(ws.getCell("A5"), { bold: true, size: 9 });
    aplicarBordeRango(ws, 5, 5, 1, 6, BORDER_THIN);

    const headers = ["PRODUCTO", "EMP", "PAC", "UND", "TOTAL", "LOTES"];
    headers.forEach((header, i) => {
        const cell = ws.getCell(6, i + 1);
        cell.value = header;
        cell.alignment = CENTER;
        cell.border = BORDER_THIN;
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFEDEDED" },
        };
        aplicarFuente(cell, { bold: true, size: 9 });
    });
}

function applyBorderSafe(ws, ref) {
    ws.getCell(ref).border = BORDER_THIN;
}

function escribirPieFormatoCategoria(ws, filaBase) {
    const observacionesRow = filaBase;
    ws.mergeCells(`A${observacionesRow}:F${observacionesRow}`);
    setValor(ws, `A${observacionesRow}`, "OBSERVACIONES:", { alignment: LEFT });
    aplicarFuente(ws.getCell(`A${observacionesRow}`), { bold: true, size: 8 });
    ws.getRow(observacionesRow).height = 18;
    aplicarBordeRango(ws, observacionesRow, observacionesRow, 1, 6, BORDER_THIN);

    const espacioObsRow = observacionesRow + 1;
    ws.getRow(espacioObsRow).height = 18;
    aplicarBordeRango(ws, espacioObsRow, espacioObsRow, 1, 6, BORDER_THIN);

    const fechaRow = observacionesRow + 2;
    ws.mergeCells(`A${fechaRow}:C${fechaRow}`);
    ws.mergeCells(`D${fechaRow}:F${fechaRow}`);

    setValor(ws, `A${fechaRow}`, "FECHA:", { alignment: LEFT });
    setValor(ws, `D${fechaRow}`, "FECHA DE VERIFICADO:", { alignment: LEFT });

    aplicarFuente(ws.getCell(`A${fechaRow}`), { bold: true, size: 8 });
    aplicarFuente(ws.getCell(`D${fechaRow}`), { bold: true, size: 8 });

    aplicarBordeRango(ws, fechaRow, fechaRow, 1, 3, BORDER_THIN);
    aplicarBordeRango(ws, fechaRow, fechaRow, 4, 6, BORDER_THIN);

    const responsablesRow = observacionesRow + 3;
    ws.mergeCells(`A${responsablesRow}:C${responsablesRow}`);
    ws.mergeCells(`D${responsablesRow}:F${responsablesRow}`);

    setValor(ws, `A${responsablesRow}`, "RESPONSABLES:", { alignment: LEFT });
    setValor(ws, `D${responsablesRow}`, "VERIFICADO POR:", { alignment: LEFT });

    aplicarFuente(ws.getCell(`A${responsablesRow}`), { bold: true, size: 8 });
    aplicarFuente(ws.getCell(`D${responsablesRow}`), { bold: true, size: 8 });

    ws.getRow(responsablesRow).height = 18;
    aplicarBordeRango(ws, responsablesRow, responsablesRow, 1, 3, BORDER_THIN);
    aplicarBordeRango(ws, responsablesRow, responsablesRow, 4, 6, BORDER_THIN);

    aplicarBordeRango(ws, 1, responsablesRow, 1, 6, BORDER_MEDIUM);

    return responsablesRow;
}

function escribirPieFormato(ws, filaBase, totalColumnas = 7) {
    const observacionesRow = filaBase;
    const colFin = totalColumnas === 6 ? "F" : "G";

    ws.mergeCells(`A${observacionesRow}:${colFin}${observacionesRow + 1}`);
    setValor(ws, `A${observacionesRow}`, "OBSERVACIONES:", { alignment: LEFT });
    aplicarFuente(ws.getCell(`A${observacionesRow}`), { bold: true, size: 8 });
    ws.getRow(observacionesRow).height = 18;
    aplicarBordeRango(ws, observacionesRow, observacionesRow, 1, totalColumnas, BORDER_THIN);

    const espacioObsRow = observacionesRow;
    ws.getRow(espacioObsRow).height = 18;
    llenarFilaVaciaConBorde(ws, espacioObsRow, 1, totalColumnas);

    const fechaRow = observacionesRow + 2;

    if (totalColumnas === 6) {
        ws.mergeCells(`A${fechaRow}:C${fechaRow}`);
        ws.mergeCells(`D${fechaRow}:F${fechaRow}`);

        setValor(ws, `A${fechaRow}`, "FECHA:", { alignment: LEFT });
        setValor(ws, `D${fechaRow}`, "FECHA DE VERIFICADO:", { alignment: LEFT });

        aplicarFuente(ws.getCell(`A${fechaRow}`), { bold: true, size: 8 });
        aplicarFuente(ws.getCell(`D${fechaRow}`), { bold: true, size: 8 });

        aplicarBordeRango(ws, fechaRow, fechaRow, 1, 3, BORDER_THIN);
        aplicarBordeRango(ws, fechaRow, fechaRow, 4, 6, BORDER_THIN);
    } else {
        ws.mergeCells(`A${fechaRow}:D${fechaRow}`);
        ws.mergeCells(`E${fechaRow}:G${fechaRow}`);

        setValor(ws, `A${fechaRow}`, "FECHA:", { alignment: LEFT });
        setValor(ws, `E${fechaRow}`, "FECHA DE VERIFICADO:", { alignment: LEFT });

        aplicarFuente(ws.getCell(`A${fechaRow}`), { bold: true, size: 8 });
        aplicarFuente(ws.getCell(`E${fechaRow}`), { bold: true, size: 8 });

        aplicarBordeRango(ws, fechaRow, fechaRow, 1, 4, BORDER_THIN);
        aplicarBordeRango(ws, fechaRow, fechaRow, 5, 7, BORDER_THIN);
    }

    const responsablesRow = observacionesRow + 3;

    if (totalColumnas === 6) {
        ws.mergeCells(`A${responsablesRow}:C${responsablesRow}`);
        ws.mergeCells(`D${responsablesRow}:F${responsablesRow}`);

        setValor(ws, `A${responsablesRow}`, "RESPONSABLES:", { alignment: LEFT });
        setValor(ws, `D${responsablesRow}`, "VERIFICADO POR:", { alignment: LEFT });

        aplicarFuente(ws.getCell(`A${responsablesRow}`), { bold: true, size: 8 });
        aplicarFuente(ws.getCell(`D${responsablesRow}`), { bold: true, size: 8 });

        ws.getRow(responsablesRow).height = 18;
        aplicarBordeRango(ws, responsablesRow, responsablesRow, 1, 3, BORDER_THIN);
        aplicarBordeRango(ws, responsablesRow, responsablesRow, 4, 6, BORDER_THIN);
    } else {
        ws.mergeCells(`A${responsablesRow}:D${responsablesRow}`);
        ws.mergeCells(`E${responsablesRow}:G${responsablesRow}`);

        setValor(ws, `A${responsablesRow}`, "RESPONSABLES:", { alignment: LEFT });
        setValor(ws, `E${responsablesRow}`, "VERIFICADO POR:", { alignment: LEFT });

        aplicarFuente(ws.getCell(`A${responsablesRow}`), { bold: true, size: 8 });
        aplicarFuente(ws.getCell(`E${responsablesRow}`), { bold: true, size: 8 });

        ws.getRow(responsablesRow).height = 18;
        aplicarBordeRango(ws, responsablesRow, responsablesRow, 1, 4, BORDER_THIN);
        aplicarBordeRango(ws, responsablesRow, responsablesRow, 5, 7, BORDER_THIN);
    }

    aplicarBordeRango(ws, 1, responsablesRow, 1, totalColumnas, BORDER_MEDIUM);

    ws.eachRow((row) => {
        row.eachCell((cell) => {
            if (!cell.alignment) {
                cell.alignment = CENTER;
            }
        });
    });

    return responsablesRow;
}

function escribirFilaProducto(ws, rowNumber, fila) {
    ws.getRow(rowNumber).height = 18;

    const productoCell = ws.getCell(rowNumber, 1);
    productoCell.value = String(fila.producto || "").toUpperCase();
    productoCell.alignment = LEFT;
    productoCell.border = BORDER_THIN;
    aplicarFuente(productoCell, { bold: true, size: 8 });

    const empCell = ws.getCell(rowNumber, 2);
    empCell.value = fila.emp || "";
    empCell.alignment = CENTER;
    empCell.border = BORDER_THIN;
    aplicarFuente(empCell, { size: 8 });

    const pacCell = ws.getCell(rowNumber, 3);
    pacCell.value = Number(fila.pac || 0);
    pacCell.alignment = RIGHT;
    pacCell.border = BORDER_THIN;
    aplicarFuente(pacCell, { size: 8 });

    const undCell = ws.getCell(rowNumber, 4);
    undCell.value = Number(fila.und || 0);
    undCell.alignment = RIGHT;
    undCell.border = BORDER_THIN;
    aplicarFuente(undCell, { size: 8 });

    const totalCell = ws.getCell(rowNumber, 5);
    totalCell.value = Number(fila.total || 0);
    totalCell.alignment = RIGHT;
    totalCell.border = BORDER_THIN;
    aplicarFuente(totalCell, { size: 8, bold: true });

    const lotesCell = ws.getCell(rowNumber, 6);
    lotesCell.value = fila.lotes || "";
    lotesCell.alignment = CENTER;
    lotesCell.border = BORDER_THIN;
    aplicarFuente(lotesCell, { size: 8 });
}

function escribirFilaTotal(ws, rowNumber, etiqueta, totalPac, totalUnd, totalRuta) {
    ws.getRow(rowNumber).height = 18;

    for (let col = 1; col <= 6; col += 1) {
        const cell = ws.getCell(rowNumber, col);
        cell.border = BORDER_THIN;
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF5F5F5" },
        };
        aplicarFuente(cell, { bold: true, size: 8 });
    }

    ws.getCell(rowNumber, 1).value = etiqueta;
    ws.getCell(rowNumber, 1).alignment = LEFT;

    ws.getCell(rowNumber, 2).value = "";
    ws.getCell(rowNumber, 2).alignment = CENTER;

    ws.getCell(rowNumber, 3).value = Number(totalPac || 0);
    ws.getCell(rowNumber, 3).alignment = RIGHT;

    ws.getCell(rowNumber, 4).value = Number(totalUnd || 0);
    ws.getCell(rowNumber, 4).alignment = RIGHT;

    ws.getCell(rowNumber, 5).value = Number(totalRuta || 0);
    ws.getCell(rowNumber, 5).alignment = RIGHT;

    ws.getCell(rowNumber, 6).value = "";
    ws.getCell(rowNumber, 6).alignment = CENTER;
}

function aplicarEncabezadoJornada(ws, imageId, despacho, tituloSecundario, paginaTexto) {
    ws.columns = [
        { width: 34 },
        { width: 10 },
        { width: 10 },
        { width: 10 },
        { width: 14 },
        { width: 12 },
        { width: 20 },
    ];

    ws.mergeCells("A1:A4");
    ws.mergeCells("B1:E1");
    ws.mergeCells("B2:E3");
    ws.mergeCells("B4:E4");
    ws.mergeCells("F1:G1");
    ws.mergeCells("F2:G2");
    ws.mergeCells("F3:G3");
    ws.mergeCells("F4:G4");

    ws.getRow(1).height = 18;
    ws.getRow(2).height = 35;
    ws.getRow(3).height = 18;
    ws.getRow(4).height = 18;
    ws.getRow(5).height = 22;
    ws.getRow(6).height = 20;

    ws.addImage(imageId, {
        tl: { col: 0.04, row: 0.04 },
        br: { col: 1.95, row: 3.95 },
        editAs: "oneCell",
    });

    setValor(ws, "B1", FORMATO_META.proceso, { alignment: CENTER });
    setValor(
        ws,
        "B2",
        FORMATO_META.formatoJornada || "FORMATO CONSOLIDADO POR JORNADA",
        { alignment: CENTER }
    );
    setValor(ws, "B4", tituloSecundario, { alignment: CENTER });

    setValor(ws, "F1", `Código: ${FORMATO_META.codigo}`, { alignment: CENTER });
    setValor(
        ws,
        "F2",
        `Fecha Actualización: ${FORMATO_META.fechaActualizacion}`,
        { alignment: CENTER }
    );
    setValor(ws, "F3", `Versión: ${FORMATO_META.version}`, { alignment: CENTER });
    setValor(ws, "F4", paginaTexto, { alignment: CENTER });

    ["B1", "B2", "B3", "B4", "F1", "F2", "F3", "F4"].forEach((ref) => {
        const cell = ws.getCell(ref);
        aplicarFuente(cell, {
            bold: true,
            size: ref === "B2" ? 9 : 8,
        });
        cell.border = BORDER_THIN;
    });

    ws.getCell("A1").border = BORDER_THIN;
    ws.getCell("A2").border = BORDER_THIN;
    ws.getCell("A3").border = BORDER_THIN;
    ws.getCell("A4").border = BORDER_THIN;

    aplicarBordeRango(ws, 1, 4, 2, 5, BORDER_THIN);
    aplicarBordeRango(ws, 1, 4, 6, 7, BORDER_THIN);

    ws.mergeCells("A5:G5");
    setValor(
        ws,
        "A5",
        `${despacho?.fechaContrato || "-"} `,
        { alignment: CENTER }
    );
    ws.getCell("A5").alignment = {
        vertical: "middle",
        horizontal: "center",
        wrapText: true,
    };
    aplicarFuente(ws.getCell("A5"), { bold: true, size: 9 });
    aplicarBordeRango(ws, 5, 5, 1, 7, BORDER_THIN);

    const headers = ["PRODUCTO", "EMP", "AM", "PM", "JORNADA ÚNICA", "TOTAL", "LOTES"];

    headers.forEach((header, i) => {
        const cell = ws.getCell(6, i + 1);
        cell.value = header;
        cell.alignment = CENTER;
        cell.border = BORDER_THIN;
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFEDEDED" },
        };
        aplicarFuente(cell, { bold: true, size: 9 });
    });
}

function escribirFilaProductoJornada(ws, rowNumber, fila) {
    ws.getRow(rowNumber).height = 18;

    const productoCell = ws.getCell(rowNumber, 1);
    productoCell.value = String(fila.producto || "").toUpperCase();
    productoCell.alignment = LEFT;
    productoCell.border = BORDER_THIN;
    aplicarFuente(productoCell, { bold: true, size: 8 });

    const empCell = ws.getCell(rowNumber, 2);
    empCell.value = fila.emp || "";
    empCell.alignment = CENTER;
    empCell.border = BORDER_THIN;
    aplicarFuente(empCell, { size: 8 });

    const amCell = ws.getCell(rowNumber, 3);
    amCell.value = Number(fila.am || 0);
    amCell.alignment = RIGHT;
    amCell.border = BORDER_THIN;
    aplicarFuente(amCell, { size: 8 });

    const pmCell = ws.getCell(rowNumber, 4);
    pmCell.value = Number(fila.pm || 0);
    pmCell.alignment = RIGHT;
    pmCell.border = BORDER_THIN;
    aplicarFuente(pmCell, { size: 8 });

    const unicaCell = ws.getCell(rowNumber, 5);
    unicaCell.value = Number(fila.unica || 0);
    unicaCell.alignment = RIGHT;
    unicaCell.border = BORDER_THIN;
    aplicarFuente(unicaCell, { size: 8 });

    const totalCell = ws.getCell(rowNumber, 6);
    totalCell.value = Number(fila.total || 0);
    totalCell.alignment = RIGHT;
    totalCell.border = BORDER_THIN;
    aplicarFuente(totalCell, { size: 8, bold: true });

    const lotesCell = ws.getCell(rowNumber, 7);
    lotesCell.value = fila.lotes || "";
    lotesCell.alignment = CENTER;
    lotesCell.border = BORDER_THIN;
    aplicarFuente(lotesCell, { size: 8 });
}

function generarNombreHojaUnico(workbook, nombreBase) {
    const baseLimpia = String(nombreBase || "Hoja").trim() || "Hoja";
    let nombreFinal = baseLimpia;
    let contador = 1;

    while (workbook.getWorksheet(nombreFinal)) {
        const sufijo = ` (${contador})`;
        const maxBase = 31 - sufijo.length;
        nombreFinal = `${baseLimpia.slice(0, maxBase)}${sufijo}`;
        contador += 1;
    }

    return nombreFinal;
}

function escribirFilaTotalJornada(ws, rowNumber, etiqueta, totalAm, totalPm, totalUnica, totalGeneral) {
    ws.getRow(rowNumber).height = 18;

    for (let col = 1; col <= 7; col += 1) {
        const cell = ws.getCell(rowNumber, col);
        cell.border = BORDER_THIN;
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF5F5F5" },
        };
        aplicarFuente(cell, { bold: true, size: 8 });
    }

    ws.getCell(rowNumber, 1).value = etiqueta;
    ws.getCell(rowNumber, 1).alignment = LEFT;

    ws.getCell(rowNumber, 2).value = "";
    ws.getCell(rowNumber, 2).alignment = CENTER;

    ws.getCell(rowNumber, 3).value = Number(totalAm || 0);
    ws.getCell(rowNumber, 3).alignment = RIGHT;

    ws.getCell(rowNumber, 4).value = Number(totalPm || 0);
    ws.getCell(rowNumber, 4).alignment = RIGHT;

    ws.getCell(rowNumber, 5).value = Number(totalUnica || 0);
    ws.getCell(rowNumber, 5).alignment = RIGHT;

    ws.getCell(rowNumber, 6).value = Number(totalGeneral || 0);
    ws.getCell(rowNumber, 6).alignment = RIGHT;

    ws.getCell(rowNumber, 7).value = "";
    ws.getCell(rowNumber, 7).alignment = CENTER;
}

function construirFilasSede(informe = {}) {
    return Array.isArray(informe?.data) ? informe.data : [];
}

export class ExcelInformeExporter {
    static async exportar({ exportData, despacho, categoriaSeleccionada }) {
        if (!exportData) {
            throw new Error("No hay información para exportar a Excel.");
        }

        if (
            exportData.tipo === "POR_RUTA_FORMATO" ||
            exportData.tipo === "POR_CATEGORIA"
        ) {
            return this.exportarRutaFormato({
                exportData,
                despacho,
                categoriaSeleccionada,
            });
        }

        if (exportData.tipo === "POR_JORNADA") {
            return this.exportarJornada({ exportData, despacho });
        }

        if (exportData.tipo === "POR_SEDE") {
            return this.exportarSede({ exportData, despacho });
        }

        if (!Array.isArray(exportData.bloques) || !exportData.bloques.length) {
            throw new Error("No hay información para exportar a Excel.");
        }

        return this.exportarFormatoAnterior({
            exportData,
            despacho,
            categoriaSeleccionada,
        });
    }

    static async exportarRutaFormato({ exportData, despacho, categoriaSeleccionada }) {
        const bloques = obtenerBloquesRutaFormato(exportData);

        if (!bloques.length) {
            console.error("ExportData recibido en ruta:", exportData);
            throw new Error("No hay información para exportar a Excel.");
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = "OpenAI";
        workbook.created = new Date();
        workbook.modified = new Date();

        const imageId = await intentarAgregarLogo(workbook);

        for (let index = 0; index < bloques.length; index += 1) {
            const bloqueRuta = bloques[index];
            const filas =
                exportData.tipo === "POR_CATEGORIA"
                    ? (bloqueRuta.productos || []).map((item) => ({
                        producto: item?.producto || "",
                        emp: item?.unidadCobertura || "",
                        pac: Number(item?.pac || 0),
                        und: Number(item?.und || 0),
                        total: Number(item?.total || 0),
                        lotes: item?.lotes || "",
                    }))
                    : construirFilasRutaFormato(bloqueRuta);
            const nombreJornada = obtenerEtiquetaJornada(bloqueRuta.jornada);
            const nombreRuta = bloqueRuta.ruta || `Ruta ${index + 1}`;

            const nombreHoja = generarNombreHojaUnico(
                workbook,
                sanitizarNombreHoja(String(nombreRuta))
            );

            const ws = workbook.addWorksheet(
                nombreHoja,
                {
                    pageSetup: {
                        paperSize: 9,
                        orientation: "portrait",
                        fitToPage: true,
                        fitToWidth: 1,
                        fitToHeight: 0,
                        margins: {
                            left: 0.2,
                            right: 0.2,
                            top: 0.25,
                            bottom: 0.25,
                            header: 0.1,
                            footer: 0.1,
                        },
                    },
                    views: [{ showGridLines: false }],
                }
            );

            if (exportData.tipo === "POR_CATEGORIA") {
                aplicarEncabezadoCategoria(
                    ws,
                    imageId,
                    despacho,
                    categoriaSeleccionada || exportData.categoria || "GENERAL",
                    ` ${String(nombreRuta).toUpperCase()}`,
                    `PÁGINA: 1`
                );
            } else {
                aplicarEncabezadoComun(
                    ws,
                    imageId,
                    exportData,
                    despacho,
                    ` ${String(nombreRuta).toUpperCase()}`,
                    `PÁGINA: 1`
                );
            }

            let currentRow = 7;

            if (exportData.tipo === "POR_CATEGORIA") {
                ws.mergeCells("F6:G6");
                ws.getCell("F6").value = "LOTES";
                ws.getCell("F6").alignment = CENTER;
                ws.getCell("F6").border = BORDER_THIN;
                ws.getCell("G6").border = BORDER_THIN;

                filas.forEach((fila) => {
                    ws.getRow(currentRow).height = 18;

                    const productoCell = ws.getCell(`A${currentRow}`);
                    productoCell.value = String(fila.producto || "").toUpperCase();
                    productoCell.alignment = LEFT;
                    productoCell.border = BORDER_THIN;
                    aplicarFuente(productoCell, { bold: true, size: 8 });

                    const empCell = ws.getCell(`B${currentRow}`);
                    empCell.value = fila.emp || "";
                    empCell.alignment = CENTER;
                    empCell.border = BORDER_THIN;
                    aplicarFuente(empCell, { size: 8 });

                    const pacCell = ws.getCell(`C${currentRow}`);
                    pacCell.value = Number(fila.pac || 0);
                    pacCell.alignment = RIGHT;
                    pacCell.border = BORDER_THIN;
                    aplicarFuente(pacCell, { size: 8 });

                    const undCell = ws.getCell(`D${currentRow}`);
                    undCell.value = Number(fila.und || 0);
                    undCell.alignment = RIGHT;
                    undCell.border = BORDER_THIN;
                    aplicarFuente(undCell, { size: 8 });

                    const totalCell = ws.getCell(`E${currentRow}`);
                    totalCell.value = Number(fila.total || 0);
                    totalCell.alignment = RIGHT;
                    totalCell.border = BORDER_THIN;
                    aplicarFuente(totalCell, { size: 8, bold: true });

                    ws.mergeCells(`F${currentRow}:G${currentRow}`);
                    const lotesCell = ws.getCell(`F${currentRow}`);
                    lotesCell.value = fila.lotes || "";
                    lotesCell.alignment = CENTER;
                    lotesCell.border = BORDER_THIN;
                    aplicarFuente(lotesCell, { size: 8 });
                    ws.getCell(`G${currentRow}`).border = BORDER_THIN;

                    currentRow += 1;
                });

                ws.getRow(currentRow).height = 18;

                for (let col = 1; col <= 7; col += 1) {
                    const cell = ws.getCell(currentRow, col);
                    cell.border = BORDER_THIN;
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FFF5F5F5" },
                    };
                    aplicarFuente(cell, { bold: true, size: 8 });
                }

                ws.getCell(`A${currentRow}`).value = `TOTAL ${String(bloqueRuta.ruta || "").toUpperCase()}`;
                ws.getCell(`A${currentRow}`).alignment = LEFT;

                ws.getCell(`B${currentRow}`).value = "";
                ws.getCell(`B${currentRow}`).alignment = CENTER;

                ws.getCell(`C${currentRow}`).value = Number(bloqueRuta.totalPac || 0);
                ws.getCell(`C${currentRow}`).alignment = RIGHT;

                ws.getCell(`D${currentRow}`).value = Number(bloqueRuta.totalUnd || 0);
                ws.getCell(`D${currentRow}`).alignment = RIGHT;

                ws.getCell(`E${currentRow}`).value = Number(bloqueRuta.totalRuta || 0);
                ws.getCell(`E${currentRow}`).alignment = RIGHT;

                ws.mergeCells(`F${currentRow}:G${currentRow}`);
                ws.getCell(`F${currentRow}`).value = "";
                ws.getCell(`F${currentRow}`).alignment = CENTER;
                ws.getCell(`F${currentRow}`).border = BORDER_THIN;
                ws.getCell(`G${currentRow}`).border = BORDER_THIN;
            } else {
                filas.forEach((fila) => {
                    escribirFilaProducto(ws, currentRow, fila);
                    currentRow += 1;
                });

                escribirFilaTotal(
                    ws,
                    currentRow,
                    `TOTAL ${String(bloqueRuta.ruta || "").toUpperCase()}`,
                    bloqueRuta.totalPac,
                    bloqueRuta.totalUnd,
                    bloqueRuta.totalRuta
                );
            }

            // currentRow += 1;

            // ws.getRow(currentRow).height = 18;
            // ws.mergeCells(`A${currentRow}:F${currentRow}`);
            // setValor(
            //     ws,
            //     `A${currentRow}`,
            //     `TOTAL JORNADA ${nombreJornada} | PAC: ${Number(
            //         bloqueRuta.totalJornadaPac || 0
            //     )} | UND: ${Number(
            //         bloqueRuta.totalJornadaUnd || 0
            //     )} | TOTAL: ${Number(
            //         bloqueRuta.totalJornada || 0
            //     )}`,
            //     { alignment: LEFT }
            // );
            aplicarFuente(ws.getCell(`A${currentRow}`), { bold: true, size: 8 });
            aplicarBordeRango(ws, currentRow, currentRow, 1, 6, BORDER_THIN);

            currentRow += 1;
            escribirPieFormato(ws, currentRow, exportData.tipo === "POR_CATEGORIA" ? 7 : 6);
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        const nombreArchivo =
            exportData.tipo === "POR_CATEGORIA"
                ? `Informe_Categoria_${categoriaSeleccionada || exportData.categoria || "General"}_${despacho?.codigo || "Despacho"}.xlsx`
                : `Informe_Rutas_${despacho?.codigo || "Despacho"}.xlsx`;

        saveAs(blob, nombreArchivo);
    }

    static async exportarJornada({ exportData, despacho }) {
        const productos = Array.isArray(exportData?.productos)
            ? exportData.productos
            : [];

        if (!productos.length) {
            throw new Error("No hay información para exportar a Excel.");
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = "OpenAI";
        workbook.created = new Date();
        workbook.modified = new Date();

        const imageId = await intentarAgregarLogo(workbook);

        const ws = workbook.addWorksheet(
            sanitizarNombreHoja(`Jornada_${despacho?.codigo || "Despacho"}`),
            {
                pageSetup: {
                    paperSize: 9,
                    orientation: "portrait",
                    fitToPage: true,
                    fitToWidth: 1,
                    fitToHeight: 0,
                    margins: {
                        left: 0.2,
                        right: 0.2,
                        top: 0.25,
                        bottom: 0.25,
                        header: 0.1,
                        footer: 0.1,
                    },
                },
                views: [{ showGridLines: false }],
            }
        );

        aplicarEncabezadoJornada(
            ws,
            imageId,
            despacho,
            "CONSOLIDADO GENERAL POR JORNADA",
            "PÁGINA: 1"
        );

        let currentRow = 7;

        productos.forEach((item) => {
            escribirFilaProductoJornada(ws, currentRow, {
                producto: item.producto || "",
                emp: item.unidadCobertura || "",
                am: Number(item.am || 0),
                pm: Number(item.pm || 0),
                unica: Number(item.unica || 0),
                total: Number(item.total || 0),
                lotes: "",
            });
            currentRow += 1;
        });

        const totalAm = productos.reduce((acc, item) => acc + Number(item.am || 0), 0);
        const totalPm = productos.reduce((acc, item) => acc + Number(item.pm || 0), 0);
        const totalUnica = productos.reduce((acc, item) => acc + Number(item.unica || 0), 0);
        const totalGeneral = productos.reduce((acc, item) => acc + Number(item.total || 0), 0);

        escribirFilaTotalJornada(
            ws,
            currentRow,
            "TOTALES GLOBALES",
            totalAm,
            totalPm,
            totalUnica,
            totalGeneral
        );

        currentRow += 1;

        ws.getRow(currentRow).height = 18;
        ws.mergeCells(`A${currentRow}:G${currentRow}`);
        setValor(
            ws,
            `A${currentRow}`,
            `PRODUCTOS: ${Number(exportData?.resumen?.totalProductos || productos.length)} | RUTAS: ${Number(
                exportData?.resumen?.totalRutas || 0
            )} | SEDES: ${Number(
                exportData?.resumen?.totalSedes || 0
            )} | TOTAL: ${Number(
                exportData?.resumen?.totalCantidad || totalGeneral
            )}`,
            { alignment: LEFT }
        );
        aplicarFuente(ws.getCell(`A${currentRow}`), { bold: true, size: 8 });
        aplicarBordeRango(ws, currentRow, currentRow, 1, 7, BORDER_THIN);

        currentRow += 1;
        escribirPieFormato(ws, currentRow);

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        saveAs(blob, `Informe_Jornada_${despacho?.codigo || "Despacho"}.xlsx`);
    }

    static async exportarSede({ exportData, despacho }) {
        const filas = construirFilasSede(exportData.data);

        if (!filas.length) {
            throw new Error("No hay información para exportar a Excel.");
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = "OpenAI";
        workbook.created = new Date();
        workbook.modified = new Date();

        const imageId = await intentarAgregarLogo(workbook);

        const ws = workbook.addWorksheet(
            sanitizarNombreHoja(`Sede_${despacho?.codigo || "Despacho"}`),
            {
                pageSetup: {
                    paperSize: 9,
                    orientation: "portrait",
                    fitToPage: true,
                    fitToWidth: 1,
                    fitToHeight: 0,
                    margins: {
                        left: 0.2,
                        right: 0.2,
                        top: 0.25,
                        bottom: 0.25,
                        header: 0.1,
                        footer: 0.1,
                    },
                },
                views: [{ showGridLines: false }],
            }
        );

        aplicarEncabezadoSede(
            ws,
            imageId,
            despacho,
            "CONSOLIDADO GENERAL POR SEDE",
            "PÁGINA: 1",
            `${despacho?.codigo || "SIN CÓDIGO"} | ${despacho?.fechaDespacho || "-"} | ${despacho?.tipoPeriodo || "-"}`
        );

        let currentRow = 7;

        filas.forEach((item) => {
            ws.getRow(currentRow).height = 18;

            const cellA = ws.getCell(`A${currentRow}`);
            cellA.value = item.sede || "";
            cellA.border = BORDER_THIN;
            cellA.alignment = LEFT;
            cellA.font = { name: "Arial", size: 8 };

            const cellB = ws.getCell(`B${currentRow}`);
            cellB.value = Number(item.productos || 0);
            cellB.border = BORDER_THIN;
            cellB.alignment = RIGHT;
            cellB.font = { name: "Arial", size: 8 };

            const cellC = ws.getCell(`C${currentRow}`);
            cellC.value = Number(item.cantidad || 0);
            cellC.border = BORDER_THIN;
            cellC.alignment = RIGHT;
            cellC.font = { name: "Arial", size: 8 };

            ws.mergeCells(`D${currentRow}:E${currentRow}`);
            const cellD = ws.getCell(`D${currentRow}`);
            cellD.value = item.jornadas || "";
            cellD.border = BORDER_THIN;
            cellD.alignment = LEFT;
            cellD.font = { name: "Arial", size: 8 };

            ws.getCell(`E${currentRow}`).border = BORDER_THIN;

            currentRow += 1;
        });

        // currentRow += 1;

        const observacionesRow = currentRow;
        ws.mergeCells(`A${observacionesRow}:E${observacionesRow}`);
        setValor(ws, `A${observacionesRow}`, "OBSERVACIONES:", { alignment: LEFT });
        aplicarFuente(ws.getCell(`A${observacionesRow}`), { bold: true, size: 8 });
        ws.getRow(observacionesRow).height = 18;
        aplicarBordeRango(ws, observacionesRow, observacionesRow, 1, 5, BORDER_THIN);

        // const espacioObsRow = observacionesRow + 1;
        // ws.getRow(espacioObsRow).height = 18;
        // aplicarBordeRango(ws, espacioObsRow, espacioObsRow, 1, 5, BORDER_THIN);

        const fechaRow = observacionesRow + 1;
        ws.mergeCells(`A${fechaRow}:C${fechaRow}`);
        ws.mergeCells(`D${fechaRow}:E${fechaRow}`);
        setValor(ws, `A${fechaRow}`, "FECHA:", { alignment: LEFT });
        setValor(ws, `D${fechaRow}`, "FECHA DE VERIFICADO:", { alignment: LEFT });
        aplicarFuente(ws.getCell(`A${fechaRow}`), { bold: true, size: 8 });
        aplicarFuente(ws.getCell(`D${fechaRow}`), { bold: true, size: 8 });
        aplicarBordeRango(ws, fechaRow, fechaRow, 1, 3, BORDER_THIN);
        aplicarBordeRango(ws, fechaRow, fechaRow, 4, 5, BORDER_THIN);

        const responsablesRow = observacionesRow + 2;
        ws.mergeCells(`A${responsablesRow}:C${responsablesRow}`);
        ws.mergeCells(`D${responsablesRow}:E${responsablesRow}`);
        setValor(ws, `A${responsablesRow}`, "RESPONSABLES:", { alignment: LEFT });
        setValor(ws, `D${responsablesRow}`, "VERIFICADO POR:", { alignment: LEFT });
        aplicarFuente(ws.getCell(`A${responsablesRow}`), { bold: true, size: 8 });
        aplicarFuente(ws.getCell(`D${responsablesRow}`), { bold: true, size: 8 });
        aplicarBordeRango(ws, responsablesRow, responsablesRow, 1, 3, BORDER_THIN);
        aplicarBordeRango(ws, responsablesRow, responsablesRow, 4, 5, BORDER_THIN);

        aplicarBordeRango(ws, 1, responsablesRow, 1, 5, BORDER_MEDIUM);

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(
            new Blob([buffer], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            }),
            `Informe_Sede_${despacho?.codigo || "Despacho"}.xlsx`
        );
    }

    static async exportarFormatoAnterior({ exportData, despacho, categoriaSeleccionada }) {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = "OpenAI";
        workbook.created = new Date();
        workbook.modified = new Date();

        const imageId = await intentarAgregarLogo(workbook);

        for (let index = 0; index < exportData.bloques.length; index += 1) {
            const bloqueRuta = exportData.bloques[index];
            const filas = construirFilasFormatoRuta(bloqueRuta);
            const nombreHoja = generarNombreHojaUnico(
                workbook,
                sanitizarNombreHoja(bloqueRuta.ruta || `Ruta ${index + 1}`)
            );

            const ws = workbook.addWorksheet(
                nombreHoja,
                {
                    pageSetup: {
                        paperSize: 9,
                        orientation: "portrait",
                        fitToPage: true,
                        fitToWidth: 1,
                        fitToHeight: 0,
                        margins: {
                            left: 0.2,
                            right: 0.2,
                            top: 0.25,
                            bottom: 0.25,
                            header: 0.1,
                            footer: 0.1,
                        },
                    },
                    views: [{ showGridLines: false }],
                }
            );

            if (exportData.tipo === "POR_CATEGORIA") {
                aplicarEncabezadoCategoria(
                    ws,
                    imageId,
                    despacho,
                    categoriaSeleccionada || exportData.categoria || "GENERAL",
                    `RUTA: ${String(bloqueRuta.ruta || "").toUpperCase()}`,
                    `PÁGINA: 1`
                );
            } else {
                aplicarEncabezadoComun(
                    ws,
                    imageId,
                    exportData,
                    despacho,
                    `RUTA: ${String(bloqueRuta.ruta || "").toUpperCase()}`,
                    `PÁGINA: 1`,
                    ""
                );
            }

            let currentRow = 7;

            filas.forEach((fila) => {
                escribirFilaProducto(ws, currentRow, fila);
                currentRow += 1;
            });

            escribirFilaTotal(
                ws,
                currentRow,
                `TOTAL ${String(bloqueRuta.ruta || "").toUpperCase()}`,
                bloqueRuta.totalPac,
                bloqueRuta.totalUnd,
                bloqueRuta.totalRuta
            );

            currentRow += 1;

            if (exportData.tipo === "POR_CATEGORIA") {
                escribirPieFormatoCategoria(ws, currentRow);
            } else {
                escribirPieFormato(ws, currentRow, 6);
            }
        }

        const buffer = await workbook.xlsx.writeBuffer();

        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        const nombreArchivo =
            exportData.tipo === "POR_CATEGORIA"
                ? `Informe_Categoria_${categoriaSeleccionada || "General"}_${despacho?.codigo || "Despacho"}.xlsx`
                : `Informe_Rutas_${despacho?.codigo || "Despacho"}.xlsx`;

        saveAs(blob, nombreArchivo);
    }
}