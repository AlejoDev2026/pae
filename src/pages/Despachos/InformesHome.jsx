import React from "react";
import { IoMenu } from "react-icons/io5";
import {
    FaArrowLeft,
    FaRoute,
    FaClock,
    FaSchool,
    FaBoxesStacked,
    FaLayerGroup,
    FaDiagramProject,
    FaWandMagicSparkles,
} from "react-icons/fa6";

const SECCIONES_INFORMES = [
    {
        key: "CONSOLIDADOS",
        titulo: "Consolidados",
        descripcion:
            "Consulta los informes generales del despacho con sus diferentes vistas de consolidación.",
        colorHeader: "from-emerald-500 to-emerald-600",
        items: [
            {
                key: "POR_RUTA",
                titulo: "Total por ruta",
                descripcion:
                    "Consolida los productos por ruta calculando PAC y UND según embalaje.",
                icono: FaRoute,
                badge: "Consolidado",
                color: "bg-emerald-50 border-emerald-200 text-emerald-700",
                rutaDestino: "InformesDespacho",
                disabled: false,
            },
            {
                key: "POR_JORNADA",
                titulo: "Total por jornada / contrato",
                descripcion:
                    "Resume los productos totales para AM, PM y Jornada Única.",
                icono: FaClock,
                badge: "Consolidado",
                color: "bg-sky-50 border-sky-200 text-sky-700",
                rutaDestino: "InformesDespacho",
                disabled: false,
            },
            {
                key: "POR_SEDE",
                titulo: "Total por sede",
                descripcion:
                    "Agrupa la información por colegio o sede para revisar cantidades consolidadas.",
                icono: FaSchool,
                badge: "Consolidado",
                color: "bg-violet-50 border-violet-200 text-violet-700",
                rutaDestino: "InformesDespacho",
                disabled: false,
            },
            {
                key: "POR_CATEGORIA",
                titulo: "Total por categoría",
                descripcion:
                    "Permite consultar productos por ruta filtrando una categoría específica.",
                icono: FaBoxesStacked,
                badge: "Filtrado",
                color: "bg-amber-50 border-amber-200 text-amber-700",
                rutaDestino: "InformesDespacho",
                disabled: false,
            },
        ],
    },
    {
        key: "ESPECIALES",
        titulo: "Especiales",
        descripcion:
            "Accesos a reportes especializados con estructura y lógica particular.",
        colorHeader: "from-indigo-500 to-indigo-600",
        items: [
            {
                key: "POR_CADENA_FRIO",
                titulo: "Congelados y refrigerados",
                descripcion:
                    "Consolida por ruta y colegio usando columnas dinámicas para categorías especiales.",
                icono: FaBoxesStacked,
                badge: "Especial",
                color: "bg-cyan-50 border-cyan-200 text-cyan-700",
                rutaDestino: "InformesDespacho",
                disabled: false,
            },
            {
                key: "POR_RUTAS_ESPECIALES",
                titulo: "Rutas especiales",
                descripcion:
                    "Consulta las rutas agrupadas especiales con su consolidado de productos.",
                icono: FaLayerGroup,
                badge: "Especial",
                color: "bg-indigo-50 border-indigo-200 text-indigo-700",
                rutaDestino: "InformesDespacho",
                disabled: false,
            },
            {
                key: "POR_RUTA_ESPECIAL_CONSOLIDADO",
                titulo: "Rutas especiales consolidado",
                descripcion:
                    "Consulta el consolidado final por ruta especial con cantidad, PAC y UND por producto.",
                icono: FaLayerGroup,
                badge: "Especial",
                color: "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700",
                rutaDestino: "InformeRutaEspecialConsolidadoView",
                disabled: false,
            },
            {
                key: "POR_RUTA_TRANZABILIDAD_CONSOLIDADO",
                titulo: "Tranzabilidad Rutas espceciales",
                descripcion:
                    "formato de tranzabilidad por ruta.",
                icono: FaLayerGroup,
                badge: "Especial",
                color: "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700",
                rutaDestino: "InformeRutaTranzabilidad",
                disabled: false,
            },
        ],
    },
    // {
    //     key: "GENERADORES",
    //     titulo: "Generadores de rutas",
    //     descripcion:
    //         "Espacio para procesos operativos y herramientas de construcción o reasignación.",
    //     colorHeader: "from-slate-600 to-slate-700",
    //     items: [
    //         {
    //             key: "GENERADOR_RUTAS",
    //             titulo: "Generador de rutas",
    //             descripcion:
    //                 "Acceso para construcción y gestión de rutas agrupadas.",
    //             icono: FaDiagramProject,
    //             badge: "Operativo",
    //             color: "bg-slate-50 border-slate-200 text-slate-700",
    //             rutaDestino: "GeneradorRutas",
    //             disabled: false,
    //         },
    //         {
    //             key: "ASIGNACIONES",
    //             titulo: "Asignaciones especiales",
    //             descripcion:
    //                 "Espacio para futuras herramientas de reasignación o administración operativa.",
    //             icono: FaWandMagicSparkles,
    //             badge: "Próximo",
    //             color: "bg-slate-50 border-slate-200 text-slate-700",
    //             rutaDestino: null,
    //             disabled: true,
    //         },
    //     ],
    // },
];

export const InformesHome = ({ setSidebar, navegar, idDespacho }) => {
    const abrirMenu = () => setSidebar?.(true);
    const estadoPagina = (pagina) => navegar?.(pagina);

    const volverDetalle = () => {
        estadoPagina("DetalleDespacho");
    };

    const guardarContextoInforme = (item) => {


        localStorage.setItem("tipoInformeSeleccionado", item.key);

        if (item.rutaDestino === "InformesDespacho") {
            localStorage.setItem("tipoInformeInicial", item.key);
        } else {
            localStorage.removeItem("tipoInformeInicial");
        }
    };

    const irOpcion = (item) => {
        if (item.disabled || !item.rutaDestino) return;

        guardarContextoInforme(item);
        estadoPagina(item.rutaDestino);
    };

    return (
        <div className="w-full h-screen flex flex-col p-4 md:p-6 gap-4 md:gap-6 bg-slate-100 overflow-hidden">
            <div className="flex items-center gap-5 lg:hidden">
                <button
                    type="button"
                    className="p-2 rounded-lg hover:bg-gray-300 cursor-pointer"
                    onClick={abrirMenu}
                >
                    <IoMenu className="text-2xl" />
                </button>

                <h1 className="text-lg font-bold text-slate-800">
                    Centro de informes
                </h1>
            </div>

            <article className="flex-1 min-h-0 bg-white shadow-lg rounded-2xl p-4 md:p-6 flex flex-col overflow-hidden">
                <nav className="w-full flex items-start justify-between gap-4 flex-wrap shrink-0">
                    <div className="flex items-start gap-3">
                        <button
                            className="p-2 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                            onClick={volverDetalle}
                            type="button"
                        >
                            <FaArrowLeft className="text-slate-700" />
                        </button>

                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-slate-800">
                                Centro de informes
                            </h1>
                        </div>
                    </div>
                </nav>

                <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                    <section className="flex flex-col gap-6">
                        {SECCIONES_INFORMES.map((seccion) => (
                            <div
                                key={seccion.key}
                                className="rounded-2xl border border-slate-200 overflow-hidden"
                            >
                                <div
                                    className={`bg-gradient-to-r ${seccion.colorHeader} px-5 py-4 text-white`}
                                >
                                    <h2 className="text-lg md:text-xl font-bold">
                                        {seccion.titulo}
                                    </h2>
                                    <p className="text-sm text-white/90 mt-1">
                                        {seccion.descripcion}
                                    </p>
                                </div>

                                <div className="p-4 md:p-5 bg-white">
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {seccion.items.map((item) => {
                                            const Icono = item.icono;

                                            return (
                                                <button
                                                    key={item.key}
                                                    type="button"
                                                    onClick={() => irOpcion(item)}
                                                    disabled={item.disabled}
                                                    className={`rounded-2xl border p-4 text-left transition-all duration-200 shadow-sm ${item.color} ${item.disabled
                                                        ? "opacity-60 cursor-not-allowed"
                                                        : "hover:shadow-md hover:-translate-y-[2px]"
                                                        }`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0 flex-1">
                                                            <span className="inline-flex items-center rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-semibold border border-current/10">
                                                                {item.badge}
                                                            </span>

                                                            <h3 className="text-base md:text-lg font-bold mt-3 leading-5">
                                                                {item.titulo}
                                                            </h3>

                                                            <p className="text-sm mt-2 leading-5 opacity-90">
                                                                {item.descripcion}
                                                            </p>
                                                        </div>

                                                        <div className="text-xl shrink-0 mt-1">
                                                            <Icono />
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 pt-4 border-t border-current/10">
                                                        <span className="text-sm font-semibold">
                                                            {item.disabled
                                                                ? "Próximamente"
                                                                : "Abrir opción"}
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </section>
                </div>
            </article>
        </div>
    );
};

export default InformesHome;