import React from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaArrowLeft,
    FaRoute,
    FaClock,
    FaBoxesStacked,
    FaLayerGroup,
} from "react-icons/fa6";

const SECCIONES_INFORMES = [
    {
        key: "ROLDANILLO_INFORMES",
        titulo: "Informes Roldanillo",
        descripcion: "Selecciona el informe que necesitas consultar para este despacho.",
        items: [
            {
                key: "POR_RUTA",
                titulo: "Total por ruta",
                descripcion: "Consolida los productos por ruta calculando PAC y UND según embalaje.",
                icono: FaRoute,
                badge: "Consolidado",
                color: "bg-emerald-50 border-emerald-200 text-emerald-700",
                rutaDestino: "InformesDespachoRoldanillo",
                disabled: false,
            },
            {
                key: "POR_JORNADA",
                titulo: "Total por jornada / contrato",
                descripcion: "Resume los productos totales para AM, PM y Jornada Única.",
                icono: FaClock,
                badge: "Consolidado",
                color: "bg-sky-50 border-sky-200 text-sky-700",
                rutaDestino: "InformesDespachoRoldanillo",
                disabled: false,
            },
            {
                key: "POR_CADENA_FRIO",
                titulo: "Congelados y refrigerados",
                descripcion: "Consolida por ruta y colegio usando columnas dinámicas para categorías especiales.",
                icono: FaBoxesStacked,
                badge: "Especial",
                color: "bg-cyan-50 border-cyan-200 text-cyan-700",
                rutaDestino: "InformesDespachoRoldanillo",
                disabled: false,
            },
            {
                key: "POR_RUTA_TRANZABILIDAD_CONSOLIDADO",
                titulo: "Trazabilidad Rutas especiales",
                descripcion: "Formato de trazabilidad por ruta.",
                icono: FaLayerGroup,
                badge: "Especial",
                color: "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700",
                rutaDestino: "InformeRutaTranzabilidadRoldanillo",
                disabled: false,
            },
        ],
    },
];

export const InformesHomeRoldanillo = ({ setSidebar, navegar, idDespacho }) => {
    const abrirMenu = () => setSidebar?.(true);
    const estadoPagina = (pagina) => navegar?.(pagina);

    const volverDetalle = () => {
        estadoPagina("DetalleDespachoRoldanillo");
    };

    const guardarContextoInforme = (item) => {
        if (idDespacho) {
            localStorage.setItem("idDespachoDetalle", String(idDespacho));
        }

        localStorage.setItem("tipoInformeSeleccionado", item.key);
        localStorage.setItem("tipoInformeInicial", item.key);
        localStorage.setItem("tipoDespachoInforme", "ROLDANILLO");
    };

    const irOpcion = (item) => {
        if (item.disabled || !item.rutaDestino) return;

        guardarContextoInforme(item);
        estadoPagina(item.rutaDestino);
    };

    return (
        <div className="w-full h-screen flex flex-col p-4 md:p-6 gap-4 bg-slate-100 overflow-hidden">
            <div className="flex items-center gap-5 lg:hidden shrink-0">
                <button
                    type="button"
                    className="p-2 rounded-lg hover:bg-gray-300 cursor-pointer"
                    onClick={abrirMenu}
                >
                    <IoMenu className="text-2xl" />
                </button>

                <h1 className="text-lg font-bold text-slate-800">
                    Informes Roldanillo
                </h1>
            </div>

            <article className="flex-1 min-h-0 bg-white shadow-lg rounded-2xl p-4 md:p-6 flex flex-col overflow-hidden">
                <nav className="w-full flex items-start justify-between gap-4 flex-wrap shrink-0">
                    <div className="flex items-start gap-3">
                        <button
                            className="p-2 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                            onClick={volverDetalle}
                            type="button"
                            title="Volver al detalle del despacho"
                        >
                            <FaArrowLeft className="text-slate-700" />
                        </button>

                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-slate-800">
                                Informes Roldanillo
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">
                                Accesos disponibles para el flujo Roldanillo.
                            </p>
                        </div>
                    </div>
                </nav>

                <div className="flex-1 min-h-0 overflow-y-auto pr-1 mt-5">
                    {SECCIONES_INFORMES.map((seccion) => (
                        <section key={seccion.key} className="flex flex-col gap-4">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {seccion.items.map((item) => {
                                    const Icono = item.icono;

                                    return (
                                        <button
                                            key={item.key}
                                            type="button"
                                            onClick={() => irOpcion(item)}
                                            disabled={item.disabled}
                                            className={`group text-left rounded-2xl border p-4 transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 ${item.color} ${item.disabled
                                                ? "opacity-60 cursor-not-allowed"
                                                : "cursor-pointer"
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <span className="inline-flex items-center rounded-full bg-white/75 border border-white px-3 py-1 text-[11px] font-semibold shadow-sm">
                                                    {item.badge}
                                                </span>

                                                <span className="w-9 h-9 rounded-full flex items-center justify-center bg-white/70 group-hover:bg-white transition-colors">
                                                    <Icono className="text-base" />
                                                </span>
                                            </div>

                                            <div className="mt-4">
                                                <h3 className="text-base md:text-lg font-bold leading-tight">
                                                    {item.titulo}
                                                </h3>
                                                <p className="text-sm mt-2 opacity-90 leading-relaxed">
                                                    {item.descripcion}
                                                </p>
                                            </div>

                                            <div className="mt-4 pt-4 border-t border-current/15 flex items-center justify-between">
                                                <span className="text-sm font-semibold">
                                                    {item.disabled ? "No disponible" : "Abrir opción"}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                </div>
            </article>
        </div>
    );
};

export default InformesHomeRoldanillo;
