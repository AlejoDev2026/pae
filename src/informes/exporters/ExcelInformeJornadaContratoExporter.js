import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import logoGobernacion from "../../assets/logoPae.png";
import { sanitizarNombreHoja } from "../helpers/informeUtils";
import { replace } from "react-router";

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

const FORMATO_META_JORNADA = {
    proceso: "PROCESO LOGISTICA",
    titulo: "FORMATO SALIDA DE MATERIAS PRIMAS DE INVENTARIO",
    codigo: "F-LOG-06",
    fechaActualizacion: "14-nov-2024",
    version: "3",
};

function aplicarFuente(cell, config = {}) {
    cell.font = {
        name: "Arial",
        size: 9,
        ...config,
    };
}

function setValor(ws, celda, valor, estilo = {}) {
    const cell = ws.getCell(celda);
    cell.value = valor;
    Object.assign(cell, estilo);
    return cell;
}

function aplicarBordeRango(ws, filaInicio, filaFin, colInicio, colFin, border = BORDER_THIN) {
    for (let row = filaInicio; row <= filaFin; row += 1) {
        for (let col = colInicio; col <= colFin; col += 1) {
            ws.getCell(row, col).border = border;
        }
    }
}

function aplicarRellenoRango(ws, filaInicio, filaFin, colInicio, colFin, argb = "FFF2F2F2") {
    for (let row = filaInicio; row <= filaFin; row += 1) {
        for (let col = colInicio; col <= colFin; col += 1) {
            ws.getCell(row, col).fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb },
            };
        }
    }
}

function formatearFechaCorta(valor) {
    if (!valor) return "";
    if (typeof valor === "string" && /DEL\s+\d+/i.test(valor)) return valor;

    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return String(valor);

    const dia = String(fecha.getDate()).padStart(2, "0");
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const anio = fecha.getFullYear();
    return `${dia}/${mes}/${anio}`;
}

function obtenerFechaConsumoTexto(despacho, exportData) {
    if (exportData?.fechaConsumoTexto) return exportData.fechaConsumoTexto;
    if (despacho?.fechaConsumoTexto) return despacho.fechaConsumoTexto;
    if (despacho?.fechaDespacho) return formatearFechaCorta(despacho.fechaDespacho);
    return "";
}

function obtenerDestino(exportData, despacho) {
    return exportData?.destino || despacho?.destino || "CALI PREPARADOS";
}

function numeroSeguro(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

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

function aplicarConfiguracionHoja(ws) {
    ws.columns = [
        { width: 10 }, // A ITEM
        { width: 9 },  // B PRODUCTO 1
        { width: 15 }, // C PRODUCTO 2
        { width: 21 }, // D PRODUCTO 3
        { width: 10 }, // E LOTE
        { width: 17 }, // F VENCIMIENTO
        { width: 11 }, // G PRESENTACION
        { width: 14 }, // H CANTIDAD
        { width: 7 },  // I C
        { width: 7 },  // J NC
        { width: 13 }, // K OBS 1
        { width: 13 }, // L OBS 2
    ];
}

function aplicarEncabezado(ws, imageId, despacho, exportData, paginaTexto = "Página: 1 de 1") {
    aplicarConfiguracionHoja(ws);

    ws.views = [{ showGridLines: false }];
    ws.properties.defaultRowHeight = 18;

    ws.getRow(1).height = 20;
    ws.getRow(2).height = 20;
    ws.getRow(3).height = 18;
    ws.getRow(4).height = 18;
    ws.getRow(5).height = 28;
    ws.getRow(6).height = 28;
    ws.getRow(7).height = 30;
    ws.getRow(8).height = 22;

    // ===== BLOQUE SUPERIOR =====
    // Logo A1:C4
    ws.mergeCells("A1:C4");
    aplicarBordeRango(ws, 1, 4, 1, 3, BORDER_THIN);

    if (imageId !== null && imageId !== undefined) {
        ws.addImage(imageId, {
            tl: { col: 0.15, row: 0.15 },
            br: { col: 2.85, row: 3.85 },
            editAs: "oneCell",
        });
    } else {
        console.error("imageId realmente es null o undefined");
    }


    // Título central D1:L4
    ws.mergeCells("D1:K2");
    ws.mergeCells("D3:K4");

    setValor(ws, "D1", FORMATO_META_JORNADA.proceso, { alignment: CENTER });
    setValor(ws, "D3", FORMATO_META_JORNADA.titulo, { alignment: CENTER });

    ["D1", "D3"].forEach((ref) => {
        const cell = ws.getCell(ref);
        cell.border = BORDER_THIN;
        aplicarFuente(cell, {
            bold: false,
            size: ref === "D3" ? 11 : 10,
        });
    });

    aplicarBordeRango(ws, 1, 4, 4, 11, BORDER_THIN);

    // Metadata derecha L1:L4
    setValor(ws, "L1", `Código: ${FORMATO_META_JORNADA.codigo}`, { alignment: LEFT });
    setValor(ws, "L2", `Fecha de Actualización:\n${FORMATO_META_JORNADA.fechaActualizacion}`, {
        alignment: LEFT,
    });
    setValor(ws, "L3", `Versión: ${FORMATO_META_JORNADA.version}`, { alignment: LEFT });
    setValor(ws, "L4", paginaTexto, { alignment: LEFT });

    ["L1", "L2", "L3", "L4"].forEach((ref) => {
        const cell = ws.getCell(ref);
        cell.border = BORDER_THIN;
        aplicarFuente(cell, { size: 8 });
    });

    // ===== BLOQUE FECHAS Y DESTINO =====
    // Fechas ahora en filas 5 y 6
    ws.mergeCells("A5:C5");
    ws.mergeCells("A6:C6");

    setValor(ws, "A5", "Fecha elaboración", { alignment: LEFT });

    ws.mergeCells("D5:G5");
    setValor(ws, "D5", formatearFechaCorta(exportData?.fechaElaboracion || new Date()), {
        alignment: CENTER,
    });

    setValor(ws, "A6", "Fecha de consumo", { alignment: LEFT });

    ws.mergeCells("D6:G6");

    const fecha = despacho?.fechaContrato.replace('Fecha de consumo: ', '')
    setValor(ws, "D6", fecha || "", {
        alignment: CENTER,
    });



    aplicarBordeRango(ws, 5, 6, 1, 3, BORDER_THIN);
    aplicarBordeRango(ws, 5, 6, 4, 4, BORDER_THIN);

    ["A5", "A6"].forEach((ref) => aplicarFuente(ws.getCell(ref), { size: 10, bold: false }));
    ["D5", "D6"].forEach((ref) => aplicarFuente(ws.getCell(ref), { size: 10, bold: false }));

    // Espacio estructural E:G
    aplicarBordeRango(ws, 5, 6, 5, 7, BORDER_THIN);

    // Destino H:I / J:L
    ws.mergeCells("H5:I6");
    ws.mergeCells("J5:L6");

    setValor(ws, "H5", "Destino", { alignment: CENTER });
    setValor(ws, "J5", '', { alignment: CENTER });

    aplicarBordeRango(ws, 5, 6, 8, 9, BORDER_THIN);
    aplicarBordeRango(ws, 5, 6, 10, 12, BORDER_THIN);

    aplicarFuente(ws.getCell("H5"), { size: 10, bold: false });
    aplicarFuente(ws.getCell("J5"), { size: 22, bold: false });

    // ===== ENCABEZADO TABLA =====
    // ahora arranca en filas 7 y 8
    ws.mergeCells("A7:A8");
    ws.mergeCells("B7:D8");
    ws.mergeCells("E7:E8");
    ws.mergeCells("F7:F8");
    ws.mergeCells("G7:G8");
    ws.mergeCells("H7:H8");
    ws.mergeCells("I7:J7");
    ws.mergeCells("K7:L7");

    setValor(ws, "A7", "ÍTEM", { alignment: CENTER });
    setValor(ws, "B7", "PRODUCTO", { alignment: CENTER });
    setValor(ws, "E7", "LOTE", { alignment: CENTER });
    setValor(ws, "F7", "VENCIMIENTO", { alignment: CENTER });
    setValor(ws, "G7", "PRESENTACIÓN\n(Unid.\nMedida)", { alignment: CENTER });
    setValor(ws, "H7", "CANTIDAD\nENTREGADA\n(Total)", { alignment: CENTER });

    setValor(ws, "I7", "ESPECIFICACIÓN\nPOR CALIDAD", { alignment: CENTER });
    setValor(ws, "I8", "C", { alignment: CENTER });
    setValor(ws, "J8", "NC", { alignment: CENTER });

    setValor(ws, "K7", "OBSERVACIONES", { alignment: CENTER });
    setValor(ws, "K8", "", { alignment: CENTER });
    setValor(ws, "L8", "", { alignment: CENTER });

    aplicarBordeRango(ws, 7, 8, 1, 12, BORDER_THIN);
    aplicarRellenoRango(ws, 7, 8, 1, 12, "FFF2F2F2");

    for (let col = 1; col <= 12; col += 1) {
        aplicarFuente(ws.getCell(7, col), { bold: true, size: 9 });
        aplicarFuente(ws.getCell(8, col), { bold: true, size: 9 });
        ws.getCell(7, col).alignment = CENTER;
        ws.getCell(8, col).alignment = CENTER;
    }

    aplicarBordeRango(ws, 1, 8, 1, 12, BORDER_MEDIUM);
}


function escribirFilaDetalle(ws, rowNumber, item) {
    ws.getRow(rowNumber).height = 20;

    // console.log("ITEM EXPORTAR:", item);

    const codigo = item?.codigo || item?.item || "";
    const producto = String(item?.producto || item?.descripcion || "").toUpperCase();
    const lote = item?.lote || "";
    const vencimiento = item?.vencimiento || item?.fechaVencimiento || "";
    const presentacion = item?.presentacion || item?.unidadCobertura || item?.unidad || "";
    const total = numeroSeguro(item?.total ?? item?.cantidadEntregada ?? item?.cantidad, 0);

    const calidadC = item?.calidadC ?? item?.c ?? "";
    const calidadNC = item?.calidadNC ?? item?.nc ?? "";

    const obsPac = numeroSeguro(
        item?.observacionPac ??
        item?.pac ??
        item?.obs1 ??
        item?.totalPac ??
        item?.pacas ??
        item?.cajasPacas ??
        item?.cantidadPac ??
        item?.observacionesPac,
        0
    );

    const obsUnd = numeroSeguro(
        item?.observacionUnd ??
        item?.und ??
        item?.obs2 ??
        item?.totalUnd ??
        item?.unidades ??
        item?.cantidadUnd ??
        item?.cantidadUnidades ??
        item?.observacionesUnd,
        0
    );

    ws.getCell(`A${rowNumber}`).value = codigo;
    ws.mergeCells(`B${rowNumber}:D${rowNumber}`);
    ws.getCell(`B${rowNumber}`).value = producto;
    ws.getCell(`E${rowNumber}`).value = lote;
    ws.getCell(`F${rowNumber}`).value = vencimiento;
    ws.getCell(`G${rowNumber}`).value = presentacion;
    ws.getCell(`H${rowNumber}`).value = total;
    ws.getCell(`I${rowNumber}`).value = calidadC;
    ws.getCell(`J${rowNumber}`).value = calidadNC;
    ws.getCell(`K${rowNumber}`).value = obsPac;
    ws.getCell(`L${rowNumber}`).value = obsUnd;

    for (let col = 1; col <= 12; col += 1) {
        const cell = ws.getCell(rowNumber, col);
        cell.border = BORDER_THIN;

        if (col >= 2 && col <= 4) {
            cell.alignment = LEFT;
            aplicarFuente(cell, { size: 9 });
        } else if ([8, 11, 12].includes(col)) {
            cell.alignment = RIGHT;
            aplicarFuente(cell, { size: 9, bold: col === 8 });
        } else {
            cell.alignment = CENTER;
            aplicarFuente(cell, { size: 9 });
        }
    }

    aplicarFuente(ws.getCell(`A${rowNumber}`), { size: 9, bold: false });
}


function escribirFilaTotal(ws, rowNumber, resumen = {}) {
    ws.getRow(rowNumber).height = 22;

    ws.mergeCells(`A${rowNumber}:G${rowNumber}`);
    ws.getCell(`A${rowNumber}`).value = "TOTAL GENERAL";
    ws.getCell(`A${rowNumber}`).alignment = LEFT;

    ws.getCell(`H${rowNumber}`).value = numeroSeguro(resumen?.totalCantidad, 0);
    ws.getCell(`I${rowNumber}`).value = resumen?.totalC ?? "";
    ws.getCell(`J${rowNumber}`).value = resumen?.totalNC ?? "";
    ws.getCell(`K${rowNumber}`).value = numeroSeguro(resumen?.totalPac, 0);
    ws.getCell(`L${rowNumber}`).value = numeroSeguro(resumen?.totalUnd, 0);

    for (let col = 1; col <= 12; col += 1) {
        const cell = ws.getCell(rowNumber, col);
        cell.border = BORDER_THIN;
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF5F5F5" },
        };
        cell.alignment = col === 1 ? LEFT : RIGHT;
        aplicarFuente(cell, { bold: true, size: 9 });
    }
}

function escribirBloqueEspecificaciones(ws, filaInicio) {
    const textoIzquierda = [
        "Especificaciones de calidad",
        "1. Producto en presencia de objetos, partículas extrañas y libres de olor, color, aspecto y forma diferentes al característico.",
        "2. Embalaje y empaques tanto secundarios como primarios limpios sin abolladuras, rasgaduras sin presencia de sustancias derramadas.",
        "3. Peso correcto según especificaciones del producto.",
    ];

    const textoDerecha = [
        "4. Producto sin evidencia de presencia de plagas",
        "5. La temperatura se adecua para productos cárnicos (<18°C) y lácteos (0°C a 4°C).",
        "6. Canastilla limpia y en buen estado",
        "7. Fruta en condiciones de maduración adecuada",
    ];

    ws.mergeCells(`A${filaInicio}:F${filaInicio + 4}`);
    ws.mergeCells(`G${filaInicio}:L${filaInicio + 4}`);

    const cellLeft = ws.getCell(`A${filaInicio}`);
    cellLeft.value = textoIzquierda.join("\n");
    cellLeft.alignment = { vertical: "top", horizontal: "left", wrapText: true };
    aplicarFuente(cellLeft, { size: 7 });

    const cellRight = ws.getCell(`G${filaInicio}`);
    cellRight.value = textoDerecha.join("\n");
    cellRight.alignment = { vertical: "top", horizontal: "left", wrapText: true };
    aplicarFuente(cellRight, { size: 7 });

    aplicarBordeRango(ws, filaInicio, filaInicio + 4, 1, 6, BORDER_THIN);
    aplicarBordeRango(ws, filaInicio, filaInicio + 4, 7, 12, BORDER_THIN);

    for (let i = filaInicio; i <= filaInicio + 4; i += 1) {
        ws.getRow(i).height = i === filaInicio ? 22 : 18;
    }

    const notaFila = filaInicio + 5;
    ws.mergeCells(`A${notaFila}:L${notaFila + 1}`);

    const notaCell = ws.getCell(`A${notaFila}`);
    notaCell.value =
        'Si el producto verificado cumple con la totalidad de las especificaciones, en la casilla "ESPECIFICACIÓN POR CALIDAD" se califica con una "C" que significa "CUMPLE". En caso contrario, se debe diligenciar "NC" que significa "NO CUMPLE" y se debe especificar en la casilla de observaciones mediante el número asignado qué especificación no está cumpliendo y su rechazo.';
    notaCell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
    aplicarFuente(notaCell, { size: 7 });

    aplicarBordeRango(ws, notaFila, notaFila + 1, 1, 12, BORDER_THIN);
    ws.getRow(notaFila).height = 24;
    ws.getRow(notaFila + 1).height = 20;

    return notaFila + 2;
}

function escribirFirmas(ws, filaInicio) {
    ws.mergeCells(`A${filaInicio}:C${filaInicio + 1}`);
    ws.mergeCells(`D${filaInicio}:F${filaInicio + 1}`);
    ws.mergeCells(`G${filaInicio}:I${filaInicio + 1}`);
    ws.mergeCells(`J${filaInicio}:L${filaInicio + 1}`);

    const labels = [
        { ref: `A${filaInicio}`, text: "Autorizado Inventarios por" },
        { ref: `D${filaInicio}`, text: "Recibido por" },
        { ref: `G${filaInicio}`, text: "Entregado por" },
        { ref: `J${filaInicio}`, text: "Verificación de calidad o inocuidad por" },
    ];

    labels.forEach(({ ref, text }) => {
        const cell = ws.getCell(ref);
        cell.value = text;
        cell.alignment = { vertical: "bottom", horizontal: "center", wrapText: true };
        aplicarFuente(cell, { size: 8, bold: true });
    });

    aplicarBordeRango(ws, filaInicio, filaInicio + 1, 1, 3, BORDER_THIN);
    aplicarBordeRango(ws, filaInicio, filaInicio + 1, 4, 6, BORDER_THIN);
    aplicarBordeRango(ws, filaInicio, filaInicio + 1, 7, 9, BORDER_THIN);
    aplicarBordeRango(ws, filaInicio, filaInicio + 1, 10, 12, BORDER_THIN);

    ws.getRow(filaInicio).height = 36;
    ws.getRow(filaInicio + 1).height = 20;
}

function escribirPie(ws, filaBase) {
    const siguienteFila = escribirBloqueEspecificaciones(ws, filaBase);
    escribirFirmas(ws, siguienteFila);
    aplicarBordeRango(ws, 1, siguienteFila + 1, 1, 12, BORDER_MEDIUM);
}

export class ExcelInformeJornadaContratoExporter {
    static async exportar({ exportData, despacho }) {
        const productos = Array.isArray(exportData?.productos) ? exportData.productos : [];

        if (!productos.length) {
            throw new Error("No hay información para exportar el informe total jornada / contrato.");
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = "OpenAI";
        workbook.created = new Date();
        workbook.modified = new Date();

        // const imageId = await intentarAgregarLogo(workbook);

        const ws = workbook.addWorksheet(
            sanitizarNombreHoja(`Alistamiento_${despacho?.codigo || "Despacho"}`),
            {
                pageSetup: {
                    paperSize: 9,
                    orientation: "landscape",
                    fitToPage: true,
                    fitToWidth: 1,
                    fitToHeight: 0,
                    horizontalCentered: true,
                    verticalCentered: false,
                    margins: {
                        left: 0.18,
                        right: 0.18,
                        top: 0.2,
                        bottom: 0.2,
                        header: 0.1,
                        footer: 0.1,
                    },
                    printTitlesRow: "7:8",
                },
                views: [{ showGridLines: false }],
            }
        );
        // === LOGO Y BLOQUE SUPERIOR DINÁMICO ===

        const imageId = await intentarAgregarLogo(workbook);
        console.log("IMAGE ID EXCEL:", imageId);

        aplicarEncabezado(ws, imageId, despacho, exportData, "Página: 1 de 1");

        let currentRow = 9;

        productos.forEach((item) => {
            escribirFilaDetalle(ws, currentRow, item);
            currentRow += 1;
        });

        escribirFilaTotal(ws, currentRow, exportData?.resumen || {});
        currentRow += 1;

        escribirPie(ws, currentRow);

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        saveAs(
            blob,
            `Informe_Jornada_Contrato_${despacho?.codigo || "Despacho"}.xlsx`
        );
    }
}