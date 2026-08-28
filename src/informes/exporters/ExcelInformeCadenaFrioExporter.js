import ExcelJS from "exceljs";

/**
 * IMPORTANTE:
 * Reemplaza este valor por el MISMO base64 real del logo que ya te funciona
 * en los otros exportadores. No dejes "...".
 */
// const LOGO_BASE64 = "data:image/png;base64,PEGA_AQUI_EL_BASE64_REAL_DEL_LOGO";

import logoGobernacion from "../../assets/logoPae.png";


const COLOR_BORDE = "FF000000";
const COLOR_RELLENO_HEADER = "FFD9D9D9";
const COLOR_FONDO = "FFFFFFFF";

function aplicarBorde(cell, estilo = "thin") {
    cell.border = {
        top: { style: estilo, color: { argb: COLOR_BORDE } },
        left: { style: estilo, color: { argb: COLOR_BORDE } },
        bottom: { style: estilo, color: { argb: COLOR_BORDE } },
        right: { style: estilo, color: { argb: COLOR_BORDE } },
    };
}

function aplicarFuente(cell, opts = {}) {
    cell.font = {
        name: "Arial",
        size: opts.size || 10,
        bold: !!opts.bold,
    };
}

function aplicarAlineacion(cell, opts = {}) {
    cell.alignment = {
        horizontal: opts.horizontal || "center",
        vertical: opts.vertical || "middle",
        wrapText: opts.wrapText !== false,
        textRotation: opts.textRotation ?? 0,
    };
}

function aplicarRelleno(cell, color = COLOR_RELLENO_HEADER) {
    cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: color },
    };
}

function formatearNumero(valor) {
    const num = Number(valor || 0);
    if (!Number.isFinite(num)) return 0;
    return num;
}

function sanitizarNombreHoja(nombre = "Hoja") {
    return String(nombre).replace(/[\\/*?:[\]]/g, "").substring(0, 31) || "Hoja";
}

function ponerBordesRango(ws, filaIni, colIni, filaFin, colFin, estilo = "thin") {
    for (let f = filaIni; f <= filaFin; f += 1) {
        for (let c = colIni; c <= colFin; c += 1) {
            aplicarBorde(ws.getCell(f, c), estilo);
        }
    }
}

function mergeYEstiloCoords(ws, filaIni, colIni, filaFin, colFin, value, config = {}) {
    ws.mergeCells(filaIni, colIni, filaFin, colFin);
    const cell = ws.getCell(filaIni, colIni);
    cell.value = value;
    aplicarFuente(cell, config.font || {});
    aplicarAlineacion(cell, config.alignment || {});
    if (config.fill) aplicarRelleno(cell, config.fill);
    return cell;
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

function generarNombreHojaUnico(workbook, nombreBase = "Hoja") {
    const base = (String(nombreBase || "Hoja").trim() || "Hoja").substring(0, 31);
    let nombreFinal = base;
    let contador = 1;

    while (workbook.getWorksheet(nombreFinal)) {
        const sufijo = ` (${contador})`;
        const limiteBase = 31 - sufijo.length;
        nombreFinal = `${base.substring(0, limiteBase)}${sufijo}`;
        contador += 1;
    }

    return nombreFinal;
}

export class ExcelInformeCadenaFrioExporter {
    static async exportar({ data, despacho }) {
        if (!data?.rutas?.length) {
            throw new Error("No hay información para exportar.");
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = "OpenAI";
        workbook.lastModifiedBy = "OpenAI";
        workbook.created = new Date();
        workbook.modified = new Date();



        for (const bloqueRuta of data.rutas) {
            const nombreHojaBase = sanitizarNombreHoja(bloqueRuta?.ruta || "RUTA");
            const nombreHoja = generarNombreHojaUnico(workbook, nombreHojaBase);

            const ws = workbook.addWorksheet(nombreHoja, {
                properties: { defaultRowHeight: 20 },
                pageSetup: {
                    paperSize: 9,
                    orientation: "landscape",
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
            });

            const colegios = Array.isArray(bloqueRuta?.colegios) ? bloqueRuta.colegios : [];
            const productos = Array.isArray(bloqueRuta?.productos) ? bloqueRuta.productos : [];

            const colProducto = 1; // A
            const colUnidad = 2;   // B
            const colColegiosIni = 3; // C
            const colColegiosFin = colColegiosIni + colegios.length - 1;
            const colTotal = colColegiosFin + 1;
            const colLotes = colTotal + 1;
            const ultimaCol = colLotes;

            // Distribución dinámica del header superior
            const colLogoIni = 1;
            const colLogoFin = 2;

            // Reserva 2 columnas al final para metadata, pero nunca menos de 6
            const colMetaIni = Math.max(ultimaCol - 1, 6);
            const colMetaFin = ultimaCol;

            // Bloque central ocupa el espacio entre logo y metadata
            const colCentroIni = colLogoFin + 1;
            const colCentroFin = Math.max(colMetaIni - 1, colCentroIni);

            // Anchos
            ws.getColumn(colProducto).width = 38;
            ws.getColumn(colUnidad).width = 20;

            for (let c = colColegiosIni; c <= colColegiosFin; c += 1) {
                ws.getColumn(c).width = 18;
            }

            ws.getColumn(colTotal).width = 18;
            ws.getColumn(colLotes).width = 28;

            // Alturas
            ws.getRow(1).height = 22;
            ws.getRow(2).height = 22;
            ws.getRow(3).height = 22;
            ws.getRow(4).height = 22;
            ws.getRow(5).height = 16;
            ws.getRow(6).height = 32;
            ws.getRow(7).height = 38;
            ws.getRow(8).height = 120;

            // Fondo blanco base
            for (let f = 1; f <= 16 + Math.max(productos.length, 1); f += 1) {
                for (let c = 1; c <= ultimaCol; c += 1) {
                    aplicarRelleno(ws.getCell(f, c), COLOR_FONDO);
                }
            }

            // === LOGO Y BLOQUE SUPERIOR DINÁMICO ===

            const imageId = await intentarAgregarLogo(workbook);
            mergeYEstiloCoords(ws, 1, colLogoIni, 5, colLogoFin, "", {
                alignment: { horizontal: "center", vertical: "middle" },
            });
            ponerBordesRango(ws, 1, colLogoIni, 5, colLogoFin);
            // console.log('---------->', imageId);

            ws.addImage(imageId, {
                tl: { col: colLogoIni - 1 + 0.08, row: 0.12 },
                br: { col: colLogoFin - 0.15, row: 4.95 },
                editAs: "oneCell",
            });
            // if (imageId) {

            // } else {
            //     const logoCell = ws.getCell(1, colLogoIni);
            //     logoCell.value = "LOGOss";
            //     aplicarFuente(logoCell, { bold: true, size: 10 });
            //     aplicarAlineacion(logoCell, { horizontal: "center", vertical: "middle" });
            // }

            mergeYEstiloCoords(
                ws,
                1,
                colCentroIni,
                3,
                colCentroFin,
                "PROCESO LOGÍSTICA",
                {
                    font: { bold: false, size: 11 },
                    alignment: { horizontal: "center", vertical: "middle" },
                }
            );
            ponerBordesRango(ws, 1, colCentroIni, 3, colCentroFin);

            mergeYEstiloCoords(
                ws,
                4,
                colCentroIni,
                5,
                colCentroFin,
                "FORMATO CONSOLIDADO ENSAMBLE DE RUTAS",
                {
                    font: { bold: false, size: 11 },
                    alignment: { horizontal: "center", vertical: "middle" },
                }
            );
            ponerBordesRango(ws, 4, colCentroIni, 5, colCentroFin);

            const metadata = [
                "Código: F-LOG-25",
                "Fecha de Actualización:",
                "19/02/2026",
                "Versión: 1",
                "Página: 1",
            ];

            for (let i = 0; i < metadata.length; i += 1) {
                const fila = i + 1;
                mergeYEstiloCoords(ws, fila, colMetaIni, fila, colMetaFin, metadata[i], {
                    font: { bold: false, size: 10 },
                    alignment: { horizontal: "center", vertical: "middle" },
                });
            }
            ponerBordesRango(ws, 1, colMetaIni, 5, colMetaFin);

            // === TITULO PRINCIPAL ===
            ws.mergeCells(6, 1, 6, ultimaCol);
            const tituloCell = ws.getCell(6, 1);
            tituloCell.value = despacho?.fechaContrato || "";
            aplicarFuente(tituloCell, { bold: true, size: 16 });
            aplicarAlineacion(tituloCell, { horizontal: "center", vertical: "middle" });
            ponerBordesRango(ws, 6, 1, 6, ultimaCol);

            // === RUTA ===
            ws.mergeCells(7, 1, 7, ultimaCol);
            const rutaCell = ws.getCell(7, 1);
            rutaCell.value = bloqueRuta?.ruta || "RUTA";
            aplicarFuente(rutaCell, { bold: true, size: 22 });
            aplicarAlineacion(rutaCell, { horizontal: "center", vertical: "middle" });
            ponerBordesRango(ws, 7, 1, 7, ultimaCol);

            // === HEADER TABLA ===
            const cellProducto = ws.getCell(8, colProducto);
            cellProducto.value = "PRODUCTO";
            aplicarFuente(cellProducto, { bold: true, size: 12 });
            aplicarAlineacion(cellProducto, {
                horizontal: "center",
                vertical: "middle",
            });
            aplicarRelleno(cellProducto, COLOR_RELLENO_HEADER);
            aplicarBorde(cellProducto);

            const cellUnidad = ws.getCell(8, colUnidad);
            cellUnidad.value = "UNIDAD /\nCOBERTURA";
            aplicarFuente(cellUnidad, { bold: true, size: 12 });
            aplicarAlineacion(cellUnidad, {
                horizontal: "center",
                vertical: "middle",
                wrapText: true,
            });
            aplicarRelleno(cellUnidad, COLOR_RELLENO_HEADER);
            aplicarBorde(cellUnidad);

            for (let i = 0; i < colegios.length; i += 1) {
                const col = colColegiosIni + i;
                const cell = ws.getCell(8, col);
                cell.value = colegios[i];
                aplicarFuente(cell, { bold: true, size: 11 });
                aplicarAlineacion(cell, {
                    horizontal: "center",
                    vertical: "middle",
                    textRotation: 90,
                    wrapText: true,
                });
                aplicarRelleno(cell, COLOR_RELLENO_HEADER);
                aplicarBorde(cell);
            }

            const totalHeader = ws.getCell(8, colTotal);
            totalHeader.value = "TOTAL\nCOBERTURA\nRUTA";
            aplicarFuente(totalHeader, { bold: true, size: 11 });
            aplicarAlineacion(totalHeader, {
                horizontal: "center",
                vertical: "middle",
                textRotation: 90,
                wrapText: true,
            });
            aplicarRelleno(totalHeader, COLOR_RELLENO_HEADER);
            aplicarBorde(totalHeader);

            const lotesHeader = ws.getCell(8, colLotes);
            lotesHeader.value = "LOTES";
            aplicarFuente(lotesHeader, { bold: true, size: 12 });
            aplicarAlineacion(lotesHeader, {
                horizontal: "center",
                vertical: "middle",
            });
            aplicarRelleno(lotesHeader, COLOR_RELLENO_HEADER);
            aplicarBorde(lotesHeader);

            ponerBordesRango(ws, 8, 1, 8, ultimaCol);

            // === DETALLE ===
            let filaActual = 9;

            productos.forEach((prod) => {
                const row = ws.getRow(filaActual);
                row.height = 22;

                const prodCell = ws.getCell(filaActual, colProducto);
                prodCell.value = prod?.producto || "";
                aplicarFuente(prodCell, { bold: true, size: 10 });
                aplicarAlineacion(prodCell, {
                    horizontal: "left",
                    vertical: "middle",
                });
                aplicarBorde(prodCell);

                const unidadCell = ws.getCell(filaActual, colUnidad);
                unidadCell.value = prod?.unidad || "";
                aplicarFuente(unidadCell, { size: 10 });
                aplicarAlineacion(unidadCell, {
                    horizontal: "center",
                    vertical: "middle",
                });
                aplicarBorde(unidadCell);

                for (let i = 0; i < colegios.length; i += 1) {
                    const col = colColegiosIni + i;
                    const nombreColegio = colegios[i];
                    const valor = formatearNumero(prod?.cantidadesPorColegio?.[nombreColegio] || 0);

                    const cell = ws.getCell(filaActual, col);
                    cell.value = valor;
                    cell.numFmt = "#,##0.00";
                    aplicarFuente(cell, { size: 10 });
                    aplicarAlineacion(cell, {
                        horizontal: "right",
                        vertical: "middle",
                    });
                    aplicarBorde(cell);
                }

                const totalCell = ws.getCell(filaActual, colTotal);
                totalCell.value = formatearNumero(prod?.totalCoberturaRuta || 0);
                totalCell.numFmt = "#,##0.00";
                aplicarFuente(totalCell, { size: 10 });
                aplicarAlineacion(totalCell, {
                    horizontal: "right",
                    vertical: "middle",
                });
                aplicarBorde(totalCell);

                const lotesCell = ws.getCell(filaActual, colLotes);
                lotesCell.value = prod?.lotes || "";
                aplicarFuente(lotesCell, { size: 10 });
                aplicarAlineacion(lotesCell, {
                    horizontal: "center",
                    vertical: "middle",
                });
                aplicarBorde(lotesCell);

                filaActual += 1;
            });

            if (!productos.length) {
                for (let c = 1; c <= ultimaCol; c += 1) {
                    aplicarBorde(ws.getCell(filaActual, c));
                }
                filaActual += 1;
            }

            // === OBSERVACIONES ===
            const filaObsIni = filaActual;
            const filaObsFin = filaActual + 2;

            ws.mergeCells(filaObsIni, 1, filaObsIni, ultimaCol);
            const obsCell = ws.getCell(filaObsIni, 1);
            obsCell.value = "OBSERVACIONES:";
            aplicarFuente(obsCell, { bold: true, size: 11 });
            aplicarAlineacion(obsCell, {
                horizontal: "left",
                vertical: "middle",
            });

            ws.mergeCells(filaObsIni + 1, 1, filaObsFin, ultimaCol);
            ponerBordesRango(ws, filaObsIni, 1, filaObsFin, ultimaCol);
            ws.getRow(filaObsIni + 1).height = 22;
            ws.getRow(filaObsIni + 2).height = 22;

            // === FECHAS ===
            const filaFecha = filaObsFin + 1;
            const mitad = Math.floor(ultimaCol / 2);

            ws.mergeCells(filaFecha, 1, filaFecha, mitad);
            const fechaIzq = ws.getCell(filaFecha, 1);
            fechaIzq.value = "FECHA:";
            aplicarFuente(fechaIzq, { bold: true, size: 11 });
            aplicarAlineacion(fechaIzq, {
                horizontal: "left",
                vertical: "middle",
            });

            ws.mergeCells(filaFecha, mitad + 1, filaFecha, ultimaCol);
            const fechaDer = ws.getCell(filaFecha, mitad + 1);
            fechaDer.value = "FECHA:";
            aplicarFuente(fechaDer, { bold: true, size: 11 });
            aplicarAlineacion(fechaDer, {
                horizontal: "left",
                vertical: "middle",
            });

            ponerBordesRango(ws, filaFecha, 1, filaFecha, ultimaCol);

            // === RESPONSABLES / VERIFICADO ===
            const filaFirmasIni = filaFecha + 1;
            const filaFirmasFin = filaFecha + 3;

            ws.mergeCells(filaFirmasIni, 1, filaFirmasIni, mitad);
            const responsablesCell = ws.getCell(filaFirmasIni, 1);
            responsablesCell.value = "RESPONSABLES:";
            aplicarFuente(responsablesCell, { bold: true, size: 11 });
            aplicarAlineacion(responsablesCell, {
                horizontal: "left",
                vertical: "top",
            });

            ws.mergeCells(filaFirmasIni, mitad + 1, filaFirmasIni, ultimaCol);
            const verificadoCell = ws.getCell(filaFirmasIni, mitad + 1);
            verificadoCell.value = "VERIFICADO POR:";
            aplicarFuente(verificadoCell, { bold: true, size: 11 });
            aplicarAlineacion(verificadoCell, {
                horizontal: "center",
                vertical: "top",
            });

            ws.mergeCells(filaFirmasIni + 1, 1, filaFirmasFin, mitad);
            ws.mergeCells(filaFirmasIni + 1, mitad + 1, filaFirmasFin, ultimaCol);

            ws.getRow(filaFirmasIni + 1).height = 22;
            ws.getRow(filaFirmasIni + 2).height = 22;
            ws.getRow(filaFirmasIni + 3).height = 22;

            ponerBordesRango(ws, filaFirmasIni, 1, filaFirmasFin, ultimaCol);

            // Bordes generales del bloque superior dinámico
            ponerBordesRango(ws, 1, 1, 5, ultimaCol);
            ponerBordesRango(ws, 6, 1, 7, ultimaCol);
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Informe_Congelados_Refrigerados_Formato_Cali.xlsx";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
}