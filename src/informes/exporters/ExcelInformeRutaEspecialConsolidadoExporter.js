import ExcelJS from "exceljs";
import logoGobernacion from "../../assets/logoPae.png";

const COLOR_BORDE = "FF000000";
const COLOR_RELLENO_HEADER = "FFD9D9D9";
const COLOR_FONDO = "FFFFFFFF";
const LOTES_FIJO = "";

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
        size: opts.size || 16,
        bold: !!opts.bold,
    };
}

const construirTextoFechaConsumo = () => {

    const fechaDesdeRaw = localStorage.getItem("fechaconsumodesde");
    const fechaHastaRaw = localStorage.getItem("fechaconsumohasta");
    console.log('desde', fechaDesdeRaw);
    console.log('hasta', fechaHastaRaw);
    const fechaDesde = formatearFechaConsumoLarga(fechaDesdeRaw);
    const fechaHasta = formatearFechaConsumoLarga(fechaHastaRaw);

    if (fechaDesde && fechaHasta) {
        return `Fecha de consumo: ${fechaDesde} al ${fechaHasta}`;
    }

    if (fechaDesde) {
        return `Fecha de consumo: ${fechaDesde}`;
    }

    if (fechaHasta) {
        return `Fecha de consumo: ${fechaHasta}`;
    }

    return "";
};

const formatearFechaConsumoLarga = (valor) => {
    if (!valor) return "";

    const texto = String(valor).trim();
    if (!texto) return "";

    const fecha = new Date(
        /^\d{4}-\d{2}-\d{2}$/.test(texto) ? `${texto}T00:00:00` : texto
    );

    if (Number.isNaN(fecha.getTime())) {
        return texto;
    }

    return new Intl.DateTimeFormat("es-CO", {
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(fecha);
};

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

function obtenerEtiquetaColegio(colegio, index = 0) {
    if (typeof colegio === "string") return colegio;

    const codigo = String(colegio?.codigo || colegio?.codigoColegio || "").trim();
    const nombre = String(
        colegio?.nombre || colegio?.nombreColegio || colegio?.label || ""
    ).trim();

    if (codigo && nombre) return `${codigo} - ${nombre}`;
    if (nombre) return nombre;
    if (codigo) return codigo;
    return `Colegio ${index + 1}`;
}

function obtenerClaveColegio(colegio, index = 0) {
    if (typeof colegio === "string") return colegio;
    return (
        colegio?.key ||
        colegio?.codigo ||
        colegio?.codigoColegio ||
        colegio?.nombre ||
        colegio?.nombreColegio ||
        `colegio_${index}`
    );
}

function construirDataExportacionRuta(bloqueRuta) {
    const colegiosEntrada = Array.isArray(bloqueRuta?.colegios) ? bloqueRuta.colegios : [];
    const productosEntrada = Array.isArray(bloqueRuta?.productos) ? bloqueRuta.productos : [];

    const colegios = colegiosEntrada.map((colegio, index) => ({
        key: obtenerClaveColegio(colegio, index),
        label: obtenerEtiquetaColegio(colegio, index),
    }));

    const productos = productosEntrada.map((prod) => ({
        idProducto: prod?.idProducto || null,
        codigoProducto: prod?.codigoProducto || "",
        producto: prod?.producto || "",
        unidad: prod?.unidad || "",
        cantidadesPorColegio: prod?.cantidadesPorColegio || {},
        totalCoberturaRuta: formatearNumero(
            prod?.totalCantidadRuta ?? prod?.totalCoberturaRuta ?? 0
        ),
        totalPacRuta: formatearNumero(prod?.totalPacRuta ?? 0),
        totalUndRuta: formatearNumero(prod?.totalUndRuta ?? 0),
        lotes: LOTES_FIJO,
    }));

    return { colegios, productos };
}

export class ExcelInformeRutaEspecialConsolidadoExporter {
    static async exportar({ data, despacho }) {
        if (!data?.rutas?.length) {
            throw new Error("No hay información para exportar.");
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = "OpenAI";
        workbook.lastModifiedBy = "OpenAI";
        workbook.created = new Date();
        workbook.modified = new Date();

        const imageId = await intentarAgregarLogo(workbook);

        for (const bloqueRuta of data.rutas) {
            const nombreHojaBase = sanitizarNombreHoja(
                bloqueRuta?.ruta ||
                bloqueRuta?.descripcionRutaAgrupada ||
                bloqueRuta?.nombreRutaAgrupada ||
                "RUTA"
            );
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

            const { colegios, productos } = construirDataExportacionRuta(bloqueRuta);

            const colProducto = 1;
            const colUnidad = 2;
            const colColegiosIni = 3;
            const colColegiosFin = colColegiosIni + colegios.length - 1;
            const colTotal = colColegiosFin + 1;
            const colPac = colTotal + 1;
            const colUnd = colPac + 1;
            const colLotes = colUnd + 1;
            const ultimaCol = colLotes;

            const colLogoIni = 1;
            const colLogoFin = 2;
            const colMetaIni = Math.max(ultimaCol - 1, 8);
            const colMetaFin = ultimaCol;
            const colCentroIni = colLogoFin + 1;
            const colCentroFin = Math.max(colMetaIni - 1, colCentroIni);

            ws.getColumn(colProducto).width = 38;
            ws.getColumn(colUnidad).width = 20;

            for (let c = colColegiosIni; c <= colColegiosFin; c += 1) {
                ws.getColumn(c).width = 12;
            }

            ws.getColumn(colTotal).width = 14;
            ws.getColumn(colPac).width = 10;
            ws.getColumn(colUnd).width = 10;
            ws.getColumn(colLotes).width = 18;

            ws.getRow(1).height = 22;
            ws.getRow(2).height = 22;
            ws.getRow(3).height = 22;
            ws.getRow(4).height = 22;
            ws.getRow(5).height = 16;
            ws.getRow(6).height = 32;
            ws.getRow(7).height = 38;
            ws.getRow(8).height = 120;

            for (let f = 1; f <= 16 + Math.max(productos.length, 1); f += 1) {
                for (let c = 1; c <= ultimaCol; c += 1) {
                    aplicarRelleno(ws.getCell(f, c), COLOR_FONDO);
                }
            }

            mergeYEstiloCoords(ws, 1, colLogoIni, 5, colLogoFin, "", {
                alignment: { horizontal: "center", vertical: "middle" },
            });
            ponerBordesRango(ws, 1, colLogoIni, 5, colLogoFin);


            ws.addImage(imageId, {
                tl: { col: colLogoIni - 1 + 0.08, row: 0.12 },
                br: { col: colLogoFin - 0.15, row: 4.95 },
                editAs: "oneCell",
            });


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
                    font: { bold: false, size: 16 },
                    alignment: { horizontal: "center", vertical: "middle" },
                });
            }
            ponerBordesRango(ws, 1, colMetaIni, 5, colMetaFin);

            ws.mergeCells(6, 1, 6, ultimaCol);

            const tituloCell = ws.getCell(6, 1);
            tituloCell.value = construirTextoFechaConsumo();
            aplicarFuente(tituloCell, { bold: true, size: 12 });
            aplicarAlineacion(tituloCell, { horizontal: "center", vertical: "middle" });
            ponerBordesRango(ws, 6, 1, 6, ultimaCol);

            ws.mergeCells(7, 1, 7, ultimaCol);
            const rutaCell = ws.getCell(7, 1);
            rutaCell.value =
                bloqueRuta?.ruta ||
                bloqueRuta?.descripcionRutaAgrupada ||
                bloqueRuta?.nombreRutaAgrupada ||
                "RUTA";
            aplicarFuente(rutaCell, { bold: true, size: 22 });
            aplicarAlineacion(rutaCell, { horizontal: "center", vertical: "middle" });
            ponerBordesRango(ws, 7, 1, 7, ultimaCol);

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
                cell.value = colegios[i].label;
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
            totalHeader.value = "TOTAL";
            aplicarFuente(totalHeader, { bold: true, size: 11 });
            aplicarAlineacion(totalHeader, {
                horizontal: "center",
                vertical: "middle",
                textRotation: 90,
                wrapText: true,
            });
            aplicarRelleno(totalHeader, COLOR_RELLENO_HEADER);
            aplicarBorde(totalHeader);

            const pacHeader = ws.getCell(8, colPac);
            pacHeader.value = "PAC";
            aplicarFuente(pacHeader, { bold: true, size: 11 });
            aplicarAlineacion(pacHeader, {
                horizontal: "center",
                vertical: "middle",
                textRotation: 90,
                wrapText: true,
            });
            aplicarRelleno(pacHeader, COLOR_RELLENO_HEADER);
            aplicarBorde(pacHeader);

            const undHeader = ws.getCell(8, colUnd);
            undHeader.value = "UND";
            aplicarFuente(undHeader, { bold: true, size: 11 });
            aplicarAlineacion(undHeader, {
                horizontal: "center",
                vertical: "middle",
                textRotation: 90,
                wrapText: true,
            });
            aplicarRelleno(undHeader, COLOR_RELLENO_HEADER);
            aplicarBorde(undHeader);

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

            let filaActual = 9;

            productos.forEach((prod) => {
                ws.getRow(filaActual).height = 22;

                const prodCell = ws.getCell(filaActual, colProducto);
                prodCell.value = prod?.producto || "";
                aplicarFuente(prodCell, { bold: true, size: 14 });
                aplicarAlineacion(prodCell, {
                    horizontal: "left",
                    vertical: "middle",
                });
                aplicarBorde(prodCell);

                const unidadCell = ws.getCell(filaActual, colUnidad);
                unidadCell.value = prod?.unidad || "";
                aplicarFuente(unidadCell, { size: 14 });
                aplicarAlineacion(unidadCell, {
                    horizontal: "center",
                    vertical: "middle",
                });
                aplicarBorde(unidadCell);

                for (let i = 0; i < colegios.length; i += 1) {
                    const col = colColegiosIni + i;
                    const colegioKey = colegios[i].key;
                    const valor = formatearNumero(
                        prod?.cantidadesPorColegio?.[colegioKey] || 0
                    );

                    const cell = ws.getCell(filaActual, col);
                    cell.value = valor;
                    cell.numFmt = "#,##0.00";
                    aplicarFuente(cell, { size: 14 });
                    aplicarAlineacion(cell, {
                        horizontal: "right",
                        vertical: "middle",
                    });
                    aplicarBorde(cell);
                }

                const totalCell = ws.getCell(filaActual, colTotal);
                totalCell.value = formatearNumero(prod?.totalCoberturaRuta || 0);
                totalCell.numFmt = "#,##0.00";
                aplicarFuente(totalCell, { size: 14 });
                aplicarAlineacion(totalCell, {
                    horizontal: "right",
                    vertical: "middle",
                });
                aplicarBorde(totalCell);

                const pacCell = ws.getCell(filaActual, colPac);
                pacCell.value = formatearNumero(prod?.totalPacRuta || 0);
                pacCell.numFmt = "#,##0";
                aplicarFuente(pacCell, { size: 14 });
                aplicarAlineacion(pacCell, {
                    horizontal: "right",
                    vertical: "middle",
                });
                aplicarBorde(pacCell);

                const undCell = ws.getCell(filaActual, colUnd);
                undCell.value = formatearNumero(prod?.totalUndRuta || 0);
                undCell.numFmt = "#,##0";
                aplicarFuente(undCell, { size: 14 });
                aplicarAlineacion(undCell, {
                    horizontal: "right",
                    vertical: "middle",
                });
                aplicarBorde(undCell);

                const lotesCell = ws.getCell(filaActual, colLotes);
                lotesCell.value = LOTES_FIJO;
                aplicarFuente(lotesCell, { size: 14 });
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

            const filaFirmasIni = filaFecha + 1;
            const filaFirmasFin = filaFecha + 3;

            ws.mergeCells(filaFirmasIni, 1, filaFirmasIni, mitad);
            const responsablesCell = ws.getCell(filaFirmasIni, 1);
            responsablesCell.value = "RESPONSABLES:";
            aplicarFuente(responsablesCell, { bold: true, size: 11 });
            aplicarAlineacion(responsablesCell, {
                horizontal: "left",
                vertical: "middle",
            });

            ws.mergeCells(filaFirmasIni, mitad + 1, filaFirmasIni, ultimaCol);
            const verificadoCell = ws.getCell(filaFirmasIni, mitad + 1);
            verificadoCell.value = "VERIFICADO POR:";
            aplicarFuente(verificadoCell, { bold: true, size: 11 });
            aplicarAlineacion(verificadoCell, {
                horizontal: "left",
                vertical: "middle",
            });

            ws.mergeCells(filaFirmasIni + 1, 1, filaFirmasFin, mitad);
            ws.mergeCells(filaFirmasIni + 1, mitad + 1, filaFirmasFin, ultimaCol);
            ponerBordesRango(ws, filaFirmasIni, 1, filaFirmasFin, ultimaCol);

            ws.getRow(filaFirmasIni + 1).height = 24;
            ws.getRow(filaFirmasIni + 2).height = 24;

            ws.eachRow((row) => {
                row.eachCell((cell) => {
                    if (!cell.font) aplicarFuente(cell, { size: 14 });
                });
            });
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Informe_Ruta_Especial_Consolidado.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    }


}

export default ExcelInformeRutaEspecialConsolidadoExporter;