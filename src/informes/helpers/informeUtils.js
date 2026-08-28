export const ORDEN_JORNADAS = ["AM", "PM", "JORNADA_UNICA"];

export const LABEL_JORNADAS = {
    AM: "AM",
    PM: "PM",
    JORNADA_UNICA: "Jornada Única",
};

export const FORMATO_META = {
    codigo: "F-LOG-25",
    fechaActualizacion: "19/02/2026",
    version: "1",
    proceso: "PROCESO LOGÍSTICA",
    formatoRuta: "FORMATO CONSOLIDADO ENSAMBLE DE RUTAS",
    formatoCategoria: "FORMATO CONSOLIDADO POR CATEGORÍA Y RUTA",
    formatoJornada: "FORMATO CONSOLIDADO POR JORNADA",
};

export const ESTILOS_RUTA = {
    emerald: {
        header: "bg-emerald-50",
        title: "text-emerald-800",
        subtitle: "text-emerald-700",
        boxBorder: "border-emerald-100",
    },
    amber: {
        header: "bg-amber-50",
        title: "text-amber-800",
        subtitle: "text-amber-700",
        boxBorder: "border-amber-100",
    },
};

export const aNumeroSeguro = (valor) => {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : 0;
};

export const formatearNumero = (valor) => {
    const numero = aNumeroSeguro(valor);

    return numero.toLocaleString("es-CO", {
        minimumFractionDigits: numero % 1 !== 0 ? 2 : 0,
        maximumFractionDigits: 2,
    });
};

export const normalizarTexto = (valor) =>
    String(valor ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();

export const obtenerProductoMostrar = (detalle) =>
    String(
        detalle?.descripcionMostrada ||
        detalle?.productoExcel ||
        detalle?.producto?.descripcion ||
        "Sin producto"
    ).trim();

export const obtenerUnidadMostrar = (detalle) =>
    String(
        detalle?.unidadCoberturaExcel ||
        detalle?.unidadCobertura ||
        ""
    ).trim();

export const obtenerCategoriaMostrar = (detalle) =>
    String(detalle?.producto?.categoria?.nombre || "Sin categoría").trim();

export const obtenerProductoKey = (detalle) =>
    [
        normalizarTexto(obtenerProductoMostrar(detalle)),
        normalizarTexto(obtenerUnidadMostrar(detalle)),
    ].join("||");

export const sanitizarNombreHoja = (nombre = "Hoja") =>
    String(nombre)
        .replace(/[\\/*?:[\]]/g, "")
        .substring(0, 31);

export const ordenarRutas = (a, b) => {
    const na = Number((String(a?.ruta || "").match(/\d+/) || [999999])[0]);
    const nb = Number((String(b?.ruta || "").match(/\d+/) || [999999])[0]);

    if (na !== nb) return na - nb;
    return String(a?.ruta || "").localeCompare(String(b?.ruta || ""), "es");
};

export const ordenarProductos = (a, b) => {
    const productoComp = String(a?.producto || "").localeCompare(String(b?.producto || ""), "es");
    if (productoComp !== 0) return productoComp;

    return String(a?.unidadCobertura || "").localeCompare(
        String(b?.unidadCobertura || ""),
        "es"
    );
};

export const construirFilasFormatoRuta = (bloqueRuta) => {
    return (bloqueRuta?.productos || []).map((item) => ({
        producto: item.producto || "",
        emp: "",
        pac: aNumeroSeguro(item.pac),
        und: aNumeroSeguro(item.und),
        total: aNumeroSeguro(item.total),
        lotes: "",
        am: aNumeroSeguro(item.am),
        pm: aNumeroSeguro(item.pm),
        unica: aNumeroSeguro(item.unica),
        unidadCobertura: item.unidadCobertura || "",
    }));
}; export const construirBloquesFormatoJornada = (exportData) => {
    const productos = Array.isArray(exportData?.productos) ? exportData.productos : [];

    const bloques = ORDEN_JORNADAS.map((jornadaKey) => {
        const labelJornada = LABEL_JORNADAS[jornadaKey] || jornadaKey;

        const productosJornada = productos
            .map((item) => {
                const cantidad =
                    jornadaKey === "AM"
                        ? aNumeroSeguro(item?.am)
                        : jornadaKey === "PM"
                            ? aNumeroSeguro(item?.pm)
                            : aNumeroSeguro(item?.unica);

                const pac =
                    jornadaKey === "AM"
                        ? aNumeroSeguro(item?.pacAm)
                        : jornadaKey === "PM"
                            ? aNumeroSeguro(item?.pacPm)
                            : aNumeroSeguro(item?.pacUnica);

                const und =
                    jornadaKey === "AM"
                        ? aNumeroSeguro(item?.undAm)
                        : jornadaKey === "PM"
                            ? aNumeroSeguro(item?.undPm)
                            : aNumeroSeguro(item?.undUnica);

                return {
                    producto: item?.producto || "",
                    unidadCobertura: item?.unidadCobertura || "",
                    pac,
                    und,
                    total: cantidad,
                    lotes: "",
                };
            })
            .filter(
                (item) =>
                    aNumeroSeguro(item.total) > 0 ||
                    aNumeroSeguro(item.pac) > 0 ||
                    aNumeroSeguro(item.und) > 0
            )
            .sort((a, b) =>
                ordenarProductos(
                    { producto: a.producto, unidadCobertura: a.unidadCobertura },
                    { producto: b.producto, unidadCobertura: b.unidadCobertura }
                )
            );

        const resumenJornada = Array.isArray(exportData?.data)
            ? exportData.data.find(
                (item) => item?.jornada === labelJornada || item?.jornada === jornadaKey
            )
            : null;

        const totalCantidad = productosJornada.reduce(
            (acc, item) => acc + aNumeroSeguro(item.total),
            0
        );
        const totalPac = productosJornada.reduce(
            (acc, item) => acc + aNumeroSeguro(item.pac),
            0
        );
        const totalUnd = productosJornada.reduce(
            (acc, item) => acc + aNumeroSeguro(item.und),
            0
        );

        return {
            jornada: jornadaKey,
            labelJornada,
            productos: productosJornada,
            totalPac,
            totalUnd,
            totalRuta: totalCantidad,
            resumen: {
                productos: aNumeroSeguro(resumenJornada?.productos),
                cantidad: aNumeroSeguro(resumenJornada?.cantidad || totalCantidad),
                rutas: aNumeroSeguro(resumenJornada?.rutas),
                sedes: aNumeroSeguro(resumenJornada?.sedes),
                pac: aNumeroSeguro(resumenJornada?.pac || totalPac),
                und: aNumeroSeguro(resumenJornada?.und || totalUnd),
            },
        };
    }).filter((bloque) => bloque.productos.length > 0);

    return bloques;
};