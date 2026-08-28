import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoGobernacion from "../../assets/logoPae.png";
import {
    FORMATO_META,
    construirFilasFormatoRuta,
    construirBloquesFormatoJornada,
} from "../helpers/informeUtils";

const ETIQUETAS_JORNADA = {
    AM: "AM",
    PM: "PM",
    JORNADA_UNICA: "JORNADA ÚNICA",
    SIN_JORNADA: "SIN JORNADA",
};

function obtenerEtiquetaJornada(jornada) {
    return ETIQUETAS_JORNADA[jornada] || jornada || "SIN JORNADA";
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

function construirFilasRutaFormatoPdf(bloqueRuta) {
    return (bloqueRuta?.productos || []).map((fila) => ({
        producto: fila?.producto || "",
        emp: fila?.unidadCobertura || "",
        pac: Number(fila?.pac || 0),
        und: Number(fila?.und || 0),
        total: Number(fila?.total || 0),
        lotes: fila?.lotes || "",
    }));
}

async function cargarImagenBase64(url) {
    const response = await fetch(url, {
        method: "GET",
        cache: "force-cache",
    });

    if (!response.ok) {
        throw new Error(`No se pudo cargar el logo: ${response.status}`);
    }

    const blob = await response.blob();

    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function dibujarRect(doc, x, y, w, h) {
    doc.rect(x, y, w, h);
}

function escribirCentro(doc, texto, x, y, maxWidth, fontSize = 7, bold = true) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.text(String(texto || ""), x, y, {
        align: "center",
        maxWidth,
    });
}

function escribirIzquierda(doc, texto, x, y, fontSize = 7, bold = true) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.text(String(texto || ""), x, y);
}

function escribirDerecha(doc, texto, x, y, fontSize = 6.5, bold = true) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.text(String(texto || ""), x, y, { align: "right" });
}

function dibujarEncabezadoRuta(
    doc,
    {
        tituloFormato,
        tituloSecundario,
        pagina,
        logoBase64,
        lineaDetalle = "",
    }
) {
    const xLogo = 10;
    const yTop = 10;

    const wLogo = 34;
    const wCentro = 106;
    const wDerecha = 50;

    const h1 = 6;
    const h2 = 12;
    const h4 = 6;

    const xCentro = xLogo + wLogo;
    const xDerecha = xCentro + wCentro;

    dibujarRect(doc, xLogo, yTop, wLogo, 30);

    dibujarRect(doc, xCentro, yTop, wCentro, h1);
    dibujarRect(doc, xCentro, yTop + h1, wCentro, h2 + h1);
    dibujarRect(doc, xCentro, yTop + h1 + h2 + h1, wCentro, h4);

    dibujarRect(doc, xDerecha, yTop, wDerecha, h1);
    dibujarRect(doc, xDerecha, yTop + h1, wDerecha, h1 + 6);
    dibujarRect(doc, xDerecha, yTop + 12 + 6, wDerecha, h1);
    dibujarRect(doc, xDerecha, yTop + 18 + 6, wDerecha, h1);

    if (logoBase64) {
        try {
            doc.addImage(logoBase64, "PNG", 10.8, 10.8, 32.2, 28.2);
        } catch (error) {
            console.warn("No se pudo dibujar el logo en PDF:", error);
        }
    }

    escribirCentro(
        doc,
        FORMATO_META.proceso || "",
        xCentro + wCentro / 2,
        14,
        wCentro - 4,
        6.6,
        true
    );

    escribirCentro(
        doc,
        tituloFormato || FORMATO_META.formatoRuta || "",
        xCentro + wCentro / 2,
        23,
        wCentro - 6,
        7,
        true
    );

    escribirCentro(
        doc,
        tituloSecundario || "",
        xCentro + wCentro / 2,
        37,
        wCentro - 6,
        6.8,
        true
    );

    escribirDerecha(doc, `Código: ${FORMATO_META.codigo || ""}`, 198, 14, 6.2, true);
    escribirDerecha(
        doc,
        `Fecha Actualización: ${FORMATO_META.fechaActualizacion || ""}`,
        198,
        22,
        6.2,
        true
    );
    escribirDerecha(doc, `Versión: ${FORMATO_META.version || ""}`, 198, 32, 6.2, true);
    escribirDerecha(doc, `Página: ${pagina}`, 198, 38, 6.2, true);

    dibujarRect(doc, 10, 40, 190, 8);

    if (lineaDetalle) {
        escribirCentro(doc, lineaDetalle, 105, 45.3, 184, 6.8, true);
    }
}

function dibujarPieFormato(doc, y) {
    dibujarRect(doc, 10, y, 190, 10);
    escribirIzquierda(doc, "OBSERVACIONES:", 12, y + 6, 7, true);

    dibujarRect(doc, 10, y + 10, 190, 10);

    dibujarRect(doc, 10, y + 20, 95, 10);
    dibujarRect(doc, 105, y + 20, 95, 10);
    escribirIzquierda(doc, "FECHA:", 12, y + 26, 7, true);
    escribirIzquierda(doc, "FECHA DE VERIFICADO:", 107, y + 26, 7, true);

    dibujarRect(doc, 10, y + 30, 95, 10);
    dibujarRect(doc, 105, y + 30, 95, 10);
    escribirIzquierda(doc, "RESPONSABLES:", 12, y + 36, 7, true);
    escribirIzquierda(doc, "VERIFICADO POR:", 107, y + 36, 7, true);
}

function obtenerYSeguroPie(finalYTabla) {
    const yMinimo = finalYTabla + 4;
    const yMaximo = 247;
    return Math.min(yMinimo, yMaximo);
}

export class PdfInformeExporter {
    static async exportar({ exportData, despacho, categoriaSeleccionada, formatearNumero }) {
        if (!exportData) {
            throw new Error("No hay información para exportar a PDF.");
        }

        if (
            exportData.tipo === "POR_RUTA_FORMATO" ||
            exportData.tipo === "POR_CATEGORIA"
        ) {
            return this.exportarRutaFormato({
                exportData,
                despacho,
                categoriaSeleccionada,
                formatearNumero,
            });
        }

        if (exportData.tipo === "POR_JORNADA") {
            return this.exportarJornada({ exportData, despacho, formatearNumero });
        }

        if (exportData.tipo === "POR_SEDE") {
            return this.exportarSede({ exportData, despacho, formatearNumero });
        }

        if (!Array.isArray(exportData.bloques) || !exportData.bloques.length) {
            throw new Error("No hay información para exportar a PDF.");
        }

        return this.exportarFormatoAnterior({
            exportData,
            despacho,
            categoriaSeleccionada,
            formatearNumero,
        });
    }

    static async exportarRutaFormato({
        exportData,
        despacho,
        categoriaSeleccionada,
        formatearNumero,
    }) {
        const bloques = obtenerBloquesRutaFormato(exportData);

        if (!bloques.length) {
            throw new Error("No hay información para exportar a PDF.");
        }

        const doc = new jsPDF("p", "mm", "a4");

        let logoBase64 = null;
        try {
            logoBase64 = await cargarImagenBase64(logoGobernacion);
        } catch (error) {
            console.warn("No se pudo cargar el logo para PDF:", error);
        }

        bloques.forEach((bloqueRuta, index) => {
            if (index > 0) doc.addPage();

            const nombreJornada = obtenerEtiquetaJornada(bloqueRuta.jornada);

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
                    : construirFilasRutaFormatoPdf(bloqueRuta);

            const esCategoria = exportData.tipo === "POR_CATEGORIA";

            dibujarEncabezadoRuta(doc, {
                tituloFormato: esCategoria
                    ? (FORMATO_META.formatoCategoria ||
                        "FORMATO CONSOLIDADO POR CATEGORÍA Y RUTA")
                    : FORMATO_META.formatoRuta,
                tituloSecundario: esCategoria
                    ? `RUTA: ${String(bloqueRuta?.ruta || "-").toUpperCase()}`
                    : `JORNADA: ${nombreJornada} - RUTA: ${String(
                        bloqueRuta?.ruta || "-"
                    ).toUpperCase()}`,
                pagina: index + 1,
                logoBase64,
                lineaDetalle: esCategoria
                    ? `CATEGORÍA: ${categoriaSeleccionada || exportData.categoria || "GENERAL"}`
                    : "",
            });

            autoTable(doc, {
                startY: 48,
                head: [["PRODUCTO", "EMP", "PAC", "UND", "TOTAL", "LOTES"]],
                body: filas.map((fila) => [
                    fila.producto,
                    fila.emp,
                    formatearNumero ? formatearNumero(fila.pac) : String(fila.pac),
                    formatearNumero ? formatearNumero(fila.und) : String(fila.und),
                    formatearNumero ? formatearNumero(fila.total) : String(fila.total),
                    fila.lotes || "",
                ]),
                foot: [[
                    `TOTAL ${String(bloqueRuta?.ruta || "").toUpperCase()}`,
                    "",
                    formatearNumero
                        ? formatearNumero(bloqueRuta?.totalPac || 0)
                        : String(bloqueRuta?.totalPac || 0),
                    formatearNumero
                        ? formatearNumero(bloqueRuta?.totalUnd || 0)
                        : String(bloqueRuta?.totalUnd || 0),
                    formatearNumero
                        ? formatearNumero(bloqueRuta?.totalRuta || 0)
                        : String(bloqueRuta?.totalRuta || 0),
                    "",
                ]],
                theme: "grid",
                styles: {
                    font: "helvetica",
                    fontSize: 7,
                    cellPadding: 1.5,
                    lineColor: [0, 0, 0],
                    lineWidth: 0.2,
                    textColor: [0, 0, 0],
                    valign: "middle",
                },
                headStyles: {
                    fillColor: [237, 237, 237],
                    textColor: [0, 0, 0],
                    fontStyle: "bold",
                    halign: "center",
                },
                footStyles: {
                    fillColor: [245, 245, 245],
                    textColor: [0, 0, 0],
                    fontStyle: "bold",
                },
                columnStyles: {
                    0: { cellWidth: 82 },
                    1: { cellWidth: 18 },
                    2: { cellWidth: 20 },
                    3: { cellWidth: 20 },
                    4: { cellWidth: 25 },
                    5: { cellWidth: 25 },
                },
                margin: { left: 10, right: 10 },
            });

            let finalY = doc.lastAutoTable.finalY + 2;

            doc.setFont("helvetica", "bold");
            doc.setFontSize(7);
            doc.rect(10, finalY, 190, 8);
            doc.text(
                `TOTAL JORNADA ${nombreJornada} | PAC: ${formatearNumero
                    ? formatearNumero(bloqueRuta?.totalJornadaPac || 0)
                    : String(bloqueRuta?.totalJornadaPac || 0)
                } | UND: ${formatearNumero
                    ? formatearNumero(bloqueRuta?.totalJornadaUnd || 0)
                    : String(bloqueRuta?.totalJornadaUnd || 0)
                } | TOTAL: ${formatearNumero
                    ? formatearNumero(bloqueRuta?.totalJornada || 0)
                    : String(bloqueRuta?.totalJornada || 0)
                }`,
                12,
                finalY + 5.2
            );

            const yPie = obtenerYSeguroPie(finalY + 8);
            dibujarPieFormato(doc, yPie);
        });

        const nombreArchivo =
            exportData.tipo === "POR_CATEGORIA"
                ? `Informe_Categoria_${categoriaSeleccionada || exportData.categoria || "General"}_${despacho?.codigo || "Despacho"}.pdf`
                : `Informe_Rutas_${despacho?.codigo || "Despacho"}.pdf`;

        doc.save(nombreArchivo);
    }

    static exportarJornada({ exportData, despacho, formatearNumero }) {
        const productos = Array.isArray(exportData?.productos)
            ? exportData.productos
            : [];

        if (!productos.length) {
            throw new Error("No hay información para exportar a PDF.");
        }

        const doc = new jsPDF("p", "mm", "a4");

        doc.setFontSize(12);
        doc.text("FORMATO CONSOLIDADO POR JORNADA", 105, 10, { align: "center" });

        doc.setFontSize(9);
        doc.text(
            `${despacho?.codigo || ""} | ${despacho?.fechaDespacho || ""} | ${despacho?.tipoPeriodo || ""}`,
            105,
            15,
            { align: "center" }
        );

        doc.text(despacho?.descripcion || "", 105, 20, { align: "center" });

        autoTable(doc, {
            startY: 25,
            head: [[
                "PRODUCTO",
                "EMP",
                "AM",
                "PM",
                "JORNADA ÚNICA",
                "TOTAL",
            ]],
            body: productos.map((item) => [
                item.producto,
                item.unidadCobertura || "",
                formatearNumero(item.am),
                formatearNumero(item.pm),
                formatearNumero(item.unica),
                formatearNumero(item.total),
            ]),
            foot: [[
                "TOTAL",
                "",
                formatearNumero(productos.reduce((a, b) => a + (b.am || 0), 0)),
                formatearNumero(productos.reduce((a, b) => a + (b.pm || 0), 0)),
                formatearNumero(productos.reduce((a, b) => a + (b.unica || 0), 0)),
                formatearNumero(productos.reduce((a, b) => a + (b.total || 0), 0)),
            ]],
        });

        doc.save(`Informe_Jornada_${despacho?.codigo}.pdf`);
    }

    static exportarSede({ exportData, despacho, formatearNumero }) {
        const doc = new jsPDF("p", "mm", "a4");

        autoTable(doc, {
            startY: 20,
            head: [["SEDE", "PRODUCTOS", "CANTIDAD", "JORNADAS"]],
            body: (exportData.data?.data || exportData.data || []).map((item) => [
                item.sede,
                formatearNumero ? formatearNumero(item.productos || 0) : String(item.productos || 0),
                formatearNumero ? formatearNumero(item.cantidad || 0) : String(item.cantidad || 0),
                item.jornadas || "",
            ]),
            theme: "grid",
        });

        doc.save(`Informe_Sede_${despacho?.codigo || "Despacho"}.pdf`);
    }

    static async exportarFormatoAnterior({
        exportData,
        despacho,
        categoriaSeleccionada,
        formatearNumero,
    }) {
        const doc = new jsPDF("p", "mm", "a4");

        let logoBase64 = null;
        try {
            logoBase64 = await cargarImagenBase64(logoGobernacion);
        } catch (error) {
            console.warn("No se pudo cargar el logo para PDF:", error);
        }

        exportData.bloques.forEach((bloqueRuta, index) => {
            if (index > 0) doc.addPage();

            dibujarEncabezadoRuta(doc, {
                tituloFormato: exportData.tipo === "POR_CATEGORIA"
                    ? FORMATO_META.formatoCategoria
                    : FORMATO_META.formatoRuta,
                tituloSecundario: `RUTA: ${String(bloqueRuta?.ruta || "-").toUpperCase()}`,
                pagina: index + 1,
                logoBase64,
                lineaDetalle:
                    exportData.tipo === "POR_CATEGORIA"
                        ? `CATEGORÍA: ${categoriaSeleccionada || exportData.categoria || "GENERAL"}`
                        : "",
            });

            autoTable(doc, {
                startY: 48,
                head: [["PRODUCTO", "EMP", "PAC", "UND", "TOTAL", "LOTES"]],
                body: construirFilasFormatoRuta(bloqueRuta).map((fila) => [
                    fila.producto,
                    fila.emp,
                    formatearNumero ? formatearNumero(fila.pac) : String(fila.pac),
                    formatearNumero ? formatearNumero(fila.und) : String(fila.und),
                    formatearNumero ? formatearNumero(fila.total) : String(fila.total),
                    fila.lotes || "",
                ]),
                theme: "grid",
                styles: {
                    font: "helvetica",
                    fontSize: 7,
                    cellPadding: 1.5,
                    lineColor: [0, 0, 0],
                    lineWidth: 0.2,
                    textColor: [0, 0, 0],
                },
                headStyles: {
                    fillColor: [237, 237, 237],
                    textColor: [0, 0, 0],
                    fontStyle: "bold",
                    halign: "center",
                },
                columnStyles: {
                    0: { cellWidth: 78, halign: "left" },
                    1: { cellWidth: 18, halign: "center" },
                    2: { cellWidth: 20, halign: "right" },
                    3: { cellWidth: 20, halign: "right" },
                    4: { cellWidth: 24, halign: "right" },
                    5: { cellWidth: 20, halign: "center" },
                },
                margin: { left: 10, right: 10 },
            });

            const yPie = obtenerYSeguroPie(doc.lastAutoTable.finalY + 4);
            dibujarPieFormato(doc, yPie);
        });

        const nombreArchivo =
            exportData.tipo === "POR_CATEGORIA"
                ? `Informe_Categoria_${categoriaSeleccionada || "General"}_${despacho?.codigo || "Despacho"}.pdf`
                : `Informe_Rutas_${despacho?.codigo || "Despacho"}.pdf`;

        doc.save(nombreArchivo);
    }
}