import { normalizarTexto } from "../helpers/informeUtils";

const ORDEN_JORNADAS = ["AM", "PM", "JORNADA_UNICA"];

function obtenerArchivos(data) {
    return data?.archivos && typeof data.archivos === "object" ? data.archivos : {};
}

function obtenerDespacho(data) {
    return data?.despacho && typeof data.despacho === "object" ? data.despacho : {};
}

function obtenerRutasDeArchivo(archivo) {
    return Array.isArray(archivo?.rutas) ? archivo.rutas : [];
}

function obtenerDetallesDeRuta(ruta) {
    return Array.isArray(ruta?.detalles) ? ruta.detalles : [];
}

function obtenerProductoMostrar(detalle) {
    if (detalle?.descripcionMostrada) return String(detalle.descripcionMostrada).trim();
    if (detalle?.productoExcel) return String(detalle.productoExcel).trim();
    if (detalle?.producto?.descripcion) return String(detalle.producto.descripcion).trim();
    return "Sin producto";
}

function obtenerUnidadMostrar(detalle) {
    if (detalle?.unidadCoberturaExcel) return String(detalle.unidadCoberturaExcel).trim();
    if (detalle?.unidadCobertura) return String(detalle.unidadCobertura).trim();
    return "";
}

function obtenerCategoriaMostrar(detalle) {
    if (detalle?.producto?.categoria?.nombre) {
        return String(detalle.producto.categoria.nombre).trim();
    }
    return "Sin categoría";
}

function obtenerSedeMostrar(detalle) {
    if (detalle?.colegio?.nombre) return String(detalle.colegio.nombre).trim();
    if (detalle?.colegio?.codigo) return String(detalle.colegio.codigo).trim();
    return "Sin sede";
}

function obtenerRutaMostrar(ruta) {
    if (ruta?.nombreRuta) return String(ruta.nombreRuta).trim();
    return "Sin ruta";
}

function obtenerProductoKey(detalle) {
    return `${normalizarTexto(obtenerProductoMostrar(detalle))}||${normalizarTexto(
        obtenerUnidadMostrar(detalle)
    )}`;
}

function ordenarRutas(a, b) {
    const rutaA = String(a?.ruta || "");
    const rutaB = String(b?.ruta || "");

    const ma = rutaA.match(/\d+/);
    const mb = rutaB.match(/\d+/);

    const na = ma ? Number(ma[0]) : 999999;
    const nb = mb ? Number(mb[0]) : 999999;

    if (na !== nb) return na - nb;
    return rutaA.localeCompare(rutaB, "es", { sensitivity: "base" });
}

function ordenarProductos(a, b) {
    const productoA = String(a?.producto || "");
    const productoB = String(b?.producto || "");

    const cmpProducto = productoA.localeCompare(productoB, "es", { sensitivity: "base" });
    if (cmpProducto !== 0) return cmpProducto;

    return String(a?.unidadCobertura || "").localeCompare(
        String(b?.unidadCobertura || ""),
        "es",
        { sensitivity: "base" }
    );
}

export class InformeDespachoBuilder {
    constructor(detalleDespacho) {
        this.detalleDespacho = detalleDespacho || null;
        this.archivos = obtenerArchivos(detalleDespacho);
        this.despacho = obtenerDespacho(detalleDespacho);
    }

    construirResumenDespacho() {
        return {
            id: this.despacho?.id ?? null,
            codigo: this.despacho?.codigo || "Sin código",
            fechaDespacho: this.despacho?.fechaDespacho || "-",
            tipoPeriodo: this.despacho?.tipoPeriodo || "-",
            descripcion: this.despacho?.descripcion || "Sin descripción",
            estado: this.despacho?.estado?.nombre || this.despacho?.estado || "-",
        };
    }

    obtenerCategoriasDisponibles() {
        const categoriasMap = new Map();

        ORDEN_JORNADAS.forEach((tipoJornada) => {
            const listaArchivos = Array.isArray(this.archivos?.[tipoJornada])
                ? this.archivos[tipoJornada]
                : [];

            listaArchivos.forEach((archivo) => {
                obtenerRutasDeArchivo(archivo).forEach((ruta) => {
                    obtenerDetallesDeRuta(ruta).forEach((detalle) => {
                        const nombre = obtenerCategoriaMostrar(detalle);
                        const key = normalizarTexto(nombre);

                        if (!key) return;
                        if (!categoriasMap.has(key)) {
                            categoriasMap.set(key, {
                                key,
                                nombre,
                            });
                        }
                    });
                });
            });
        });

        return Array.from(categoriasMap.values()).sort((a, b) =>
            a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })
        );
    }

    construirInformePorRuta() {
        const rutasMap = new Map();
        const productosGlobalesSet = new Set();

        ORDEN_JORNADAS.forEach((tipoJornada) => {
            const listaArchivos = Array.isArray(this.archivos?.[tipoJornada])
                ? this.archivos[tipoJornada]
                : [];

            listaArchivos.forEach((archivo) => {
                obtenerRutasDeArchivo(archivo).forEach((ruta) => {
                    const nombreRuta = obtenerRutaMostrar(ruta);
                    const rutaKey = normalizarTexto(nombreRuta);

                    if (!rutasMap.has(rutaKey)) {
                        rutasMap.set(rutaKey, {
                            ruta: nombreRuta,
                            productosMap: new Map(),
                            totalAm: 0,
                            totalPm: 0,
                            totalUnica: 0,
                            totalRuta: 0,
                        });
                    }

                    const rutaItem = rutasMap.get(rutaKey);

                    obtenerDetallesDeRuta(ruta).forEach((detalle) => {
                        const producto = obtenerProductoMostrar(detalle);
                        const unidadCobertura = obtenerUnidadMostrar(detalle);
                        const cantidad = Number(detalle?.cantidad || 0);
                        const productoKey = obtenerProductoKey(detalle);

                        if (productoKey !== "||") {
                            productosGlobalesSet.add(productoKey);
                        }

                        if (!rutaItem.productosMap.has(productoKey)) {
                            rutaItem.productosMap.set(productoKey, {
                                producto,
                                unidadCobertura,
                                am: 0,
                                pm: 0,
                                unica: 0,
                                total: 0,
                            });
                        }

                        const productoItem = rutaItem.productosMap.get(productoKey);

                        if (tipoJornada === "AM") {
                            productoItem.am += cantidad;
                            rutaItem.totalAm += cantidad;
                        } else if (tipoJornada === "PM") {
                            productoItem.pm += cantidad;
                            rutaItem.totalPm += cantidad;
                        } else if (tipoJornada === "JORNADA_UNICA") {
                            productoItem.unica += cantidad;
                            rutaItem.totalUnica += cantidad;
                        }

                        productoItem.total += cantidad;
                        rutaItem.totalRuta += cantidad;
                    });
                });
            });
        });

        const rutas = Array.from(rutasMap.values())
            .map((rutaItem) => ({
                ruta: rutaItem.ruta,
                productos: Array.from(rutaItem.productosMap.values()).sort(ordenarProductos),
                totalAm: rutaItem.totalAm,
                totalPm: rutaItem.totalPm,
                totalUnica: rutaItem.totalUnica,
                totalRuta: rutaItem.totalRuta,
            }))
            .filter((item) => item.productos.length > 0)
            .sort(ordenarRutas);

        const totalCantidad = rutas.reduce((acc, item) => acc + Number(item.totalRuta || 0), 0);

        return {
            tipo: "POR_RUTA",
            titulo: "Informe total por ruta",
            subtitulo: "Consolidado por ruta",
            rutas,
            resumen: {
                totalRutas: rutas.length,
                totalProductos: productosGlobalesSet.size,
                totalCantidad,
            },
        };
    }

    construirInformePorJornada() {
        const productosMap = new Map();
        const sedesSet = new Set();
        const rutasSet = new Set();

        const jornadasBase = {
            AM: { jornada: "AM", productos: 0, cantidad: 0, rutas: 0, sedes: 0 },
            PM: { jornada: "PM", productos: 0, cantidad: 0, rutas: 0, sedes: 0 },
            JORNADA_UNICA: {
                jornada: "Jornada Única",
                productos: 0,
                cantidad: 0,
                rutas: 0,
                sedes: 0,
            },
        };

        const productosPorJornada = {
            AM: new Set(),
            PM: new Set(),
            JORNADA_UNICA: new Set(),
        };

        const rutasPorJornada = {
            AM: new Set(),
            PM: new Set(),
            JORNADA_UNICA: new Set(),
        };

        const sedesPorJornada = {
            AM: new Set(),
            PM: new Set(),
            JORNADA_UNICA: new Set(),
        };

        ORDEN_JORNADAS.forEach((tipoJornada) => {
            const listaArchivos = Array.isArray(this.archivos?.[tipoJornada])
                ? this.archivos[tipoJornada]
                : [];

            listaArchivos.forEach((archivo) => {
                obtenerRutasDeArchivo(archivo).forEach((ruta) => {
                    const nombreRuta = obtenerRutaMostrar(ruta);
                    rutasSet.add(normalizarTexto(nombreRuta));
                    rutasPorJornada[tipoJornada].add(normalizarTexto(nombreRuta));

                    obtenerDetallesDeRuta(ruta).forEach((detalle) => {
                        const sede = obtenerSedeMostrar(detalle);
                        const cantidad = Number(detalle?.cantidad || 0);
                        const producto = obtenerProductoMostrar(detalle);
                        const unidadCobertura = obtenerUnidadMostrar(detalle);
                        const productoKey = obtenerProductoKey(detalle);

                        sedesSet.add(normalizarTexto(sede));
                        sedesPorJornada[tipoJornada].add(normalizarTexto(sede));
                        productosPorJornada[tipoJornada].add(productoKey);

                        jornadasBase[tipoJornada].cantidad += cantidad;

                        if (!productosMap.has(productoKey)) {
                            productosMap.set(productoKey, {
                                producto,
                                unidadCobertura,
                                am: 0,
                                pm: 0,
                                unica: 0,
                                total: 0,
                            });
                        }

                        const productoItem = productosMap.get(productoKey);

                        if (tipoJornada === "AM") productoItem.am += cantidad;
                        if (tipoJornada === "PM") productoItem.pm += cantidad;
                        if (tipoJornada === "JORNADA_UNICA") productoItem.unica += cantidad;

                        productoItem.total += cantidad;
                    });
                });
            });
        });

        jornadasBase.AM.productos = productosPorJornada.AM.size;
        jornadasBase.PM.productos = productosPorJornada.PM.size;
        jornadasBase.JORNADA_UNICA.productos = productosPorJornada.JORNADA_UNICA.size;

        jornadasBase.AM.rutas = rutasPorJornada.AM.size;
        jornadasBase.PM.rutas = rutasPorJornada.PM.size;
        jornadasBase.JORNADA_UNICA.rutas = rutasPorJornada.JORNADA_UNICA.size;

        jornadasBase.AM.sedes = sedesPorJornada.AM.size;
        jornadasBase.PM.sedes = sedesPorJornada.PM.size;
        jornadasBase.JORNADA_UNICA.sedes = sedesPorJornada.JORNADA_UNICA.size;

        const data = [
            jornadasBase.AM,
            jornadasBase.PM,
            jornadasBase.JORNADA_UNICA,
        ];

        const productos = Array.from(productosMap.values()).sort(ordenarProductos);
        const totalCantidad = productos.reduce((acc, item) => acc + Number(item.total || 0), 0);

        return {
            tipo: "POR_JORNADA",
            data,
            productos,
            resumen: {
                totalProductos: productos.length,
                totalCantidad,
                totalRutas: rutasSet.size,
                totalSedes: sedesSet.size,
            },
        };
    }

    construirInformePorSede() {
        const sedesMap = new Map();
        const productosGlobalesSet = new Set();

        ORDEN_JORNADAS.forEach((tipoJornada) => {
            const listaArchivos = Array.isArray(this.archivos?.[tipoJornada])
                ? this.archivos[tipoJornada]
                : [];

            listaArchivos.forEach((archivo) => {
                obtenerRutasDeArchivo(archivo).forEach((ruta) => {
                    obtenerDetallesDeRuta(ruta).forEach((detalle) => {
                        const sede = obtenerSedeMostrar(detalle);
                        const sedeKey = normalizarTexto(sede);
                        const cantidad = Number(detalle?.cantidad || 0);
                        const productoKey = obtenerProductoKey(detalle);

                        productosGlobalesSet.add(productoKey);

                        if (!sedesMap.has(sedeKey)) {
                            sedesMap.set(sedeKey, {
                                sede,
                                cantidad: 0,
                                productosSet: new Set(),
                                jornadasSet: new Set(),
                            });
                        }

                        const sedeItem = sedesMap.get(sedeKey);
                        sedeItem.cantidad += cantidad;
                        sedeItem.productosSet.add(productoKey);

                        if (tipoJornada === "AM") sedeItem.jornadasSet.add("AM");
                        if (tipoJornada === "PM") sedeItem.jornadasSet.add("PM");
                        if (tipoJornada === "JORNADA_UNICA") sedeItem.jornadasSet.add("Jornada Única");
                    });
                });
            });
        });

        const data = Array.from(sedesMap.values())
            .map((item) => ({
                sede: item.sede,
                productos: item.productosSet.size,
                cantidad: item.cantidad,
                jornadas: Array.from(item.jornadasSet).join(", "),
            }))
            .sort((a, b) => a.sede.localeCompare(b.sede, "es", { sensitivity: "base" }));

        const totalCantidad = data.reduce((acc, item) => acc + Number(item.cantidad || 0), 0);

        return {
            tipo: "POR_SEDE",
            data,
            resumen: {
                totalSedes: data.length,
                totalProductos: productosGlobalesSet.size,
                totalCantidad,
            },
        };
    }

    construirInformePorCategoriaYRuta(categoriaSeleccionada) {
        const categoriaNormalizada = normalizarTexto(categoriaSeleccionada || "");
        const rutasMap = new Map();
        const productosGlobalesSet = new Set();

        ORDEN_JORNADAS.forEach((tipoJornada) => {
            const listaArchivos = Array.isArray(this.archivos?.[tipoJornada])
                ? this.archivos[tipoJornada]
                : [];

            listaArchivos.forEach((archivo) => {
                obtenerRutasDeArchivo(archivo).forEach((ruta) => {
                    const nombreRuta = obtenerRutaMostrar(ruta);
                    const rutaKey = normalizarTexto(nombreRuta);

                    if (!rutasMap.has(rutaKey)) {
                        rutasMap.set(rutaKey, {
                            ruta: nombreRuta,
                            productosMap: new Map(),
                            totalAm: 0,
                            totalPm: 0,
                            totalUnica: 0,
                            totalRuta: 0,
                        });
                    }

                    const rutaItem = rutasMap.get(rutaKey);

                    obtenerDetallesDeRuta(ruta).forEach((detalle) => {
                        const categoriaDetalle = normalizarTexto(obtenerCategoriaMostrar(detalle));

                        if (categoriaNormalizada && categoriaDetalle !== categoriaNormalizada) {
                            return;
                        }

                        const producto = obtenerProductoMostrar(detalle);
                        const unidadCobertura = obtenerUnidadMostrar(detalle);
                        const cantidad = Number(detalle?.cantidad || 0);
                        const productoKey = obtenerProductoKey(detalle);

                        productosGlobalesSet.add(productoKey);

                        if (!rutaItem.productosMap.has(productoKey)) {
                            rutaItem.productosMap.set(productoKey, {
                                producto,
                                unidadCobertura,
                                am: 0,
                                pm: 0,
                                unica: 0,
                                total: 0,
                                pac: 0,
                                und: 0,
                                lotes: "",
                            });
                        }

                        const productoItem = rutaItem.productosMap.get(productoKey);

                        if (tipoJornada === "AM") {
                            productoItem.am += cantidad;
                            rutaItem.totalAm += cantidad;
                        } else if (tipoJornada === "PM") {
                            productoItem.pm += cantidad;
                            rutaItem.totalPm += cantidad;
                        } else if (tipoJornada === "JORNADA_UNICA") {
                            productoItem.unica += cantidad;
                            rutaItem.totalUnica += cantidad;
                        }

                        productoItem.total += cantidad;
                        rutaItem.totalRuta += cantidad;
                    });
                });
            });
        });

        const rutas = Array.from(rutasMap.values())
            .map((rutaItem) => ({
                ruta: rutaItem.ruta,
                productos: Array.from(rutaItem.productosMap.values()).sort(ordenarProductos),
                totalAm: rutaItem.totalAm,
                totalPm: rutaItem.totalPm,
                totalUnica: rutaItem.totalUnica,
                totalRuta: rutaItem.totalRuta,
                totalPac: 0,
                totalUnd: 0,
            }))
            .filter((item) => item.productos.length > 0)
            .sort(ordenarRutas);

        const totalCantidad = rutas.reduce((acc, item) => acc + Number(item.totalRuta || 0), 0);

        return {
            tipo: "POR_CATEGORIA",
            titulo: "Informe por categoría y ruta",
            subtitulo: categoriaSeleccionada
                ? `Categoría: ${categoriaSeleccionada}`
                : "Categoría general",
            categoria: categoriaSeleccionada || "",
            rutas,
            resumen: {
                totalRutas: rutas.length,
                totalProductos: productosGlobalesSet.size,
                totalCantidad,
            },
        };
    }
    construirPaqueteExportacion({ informeActivo, categoriaSeleccionada, despacho }) {
        if (informeActivo === "POR_CATEGORIA") {
            const informe = this.construirInformePorCategoriaYRuta(categoriaSeleccionada);

            return {
                tipo: "POR_CATEGORIA",
                titulo: "FORMATO DE ALISTAMIENTO POR CATEGORÍA",
                subtitulo: informe.subtitulo,
                categoria: categoriaSeleccionada || "",
                bloques: (informe.rutas || []).map((ruta) => ({
                    ruta: ruta.ruta,
                    productos: ruta.productos || [],
                    totalPac: ruta.totalPac || 0,
                    totalUnd: ruta.totalUnd || 0,
                    totalRuta: ruta.totalRuta || 0,
                    totalAm: ruta.totalAm || 0,
                    totalPm: ruta.totalPm || 0,
                    totalUnica: ruta.totalUnica || 0,
                })),
                resumen: informe.resumen || {},
            };
        }

        if (informeActivo === "POR_JORNADA") {
            const informe = this.construirInformePorJornada();

            return {
                tipo: "POR_JORNADA",
                titulo: "FORMATO CONSOLIDADO POR JORNADA",
                subtitulo: despacho?.descripcion || "CONSOLIDADO GENERAL",
                data: informe.data || [],
                productos: informe.productos || [],
                resumen: informe.resumen || {},
            };
        }

        return this.construirInformePorRuta();
    }
}