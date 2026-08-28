import { useState, useEffect } from "react";
import { API_BASE } from "../../constants";

import { FaSearch, FaEye } from "react-icons/fa";
import { FaPlus } from "react-icons/fa6";
import { IoMenu } from "react-icons/io5";

import { toast } from "react-toastify";
import { Tooltip } from "../../components/common/Tooltip";

export const Despachos = ({
    setSidebar,
    navegar
}) => {
    const abrirMenu = () => setSidebar(true);
    const estadoPagina = (pagina) => navegar(pagina);

    const [despachos, setDespachos] = useState([]);
    const [busqueda, setBusqueda] = useState("");
    const [loading, setLoading] = useState(false);

    const obtenerDespachos = async () => {
        try {
            setLoading(true);

            const url = `${API_BASE}Despachos/DespachosGetAll.php`;
            console.log('url', url);
            const res = await fetch(url, {
                method: "GET",
                cache: "no-store",
                headers: {
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    Pragma: "no-cache",
                    Expires: "0",
                },
            });

            const response = await res.json();

            if (response.rpta === "si") {
                setDespachos(response.data || []);
            } else {
                setDespachos([]);
                toast.error(response.mensaje || "No se pudieron consultar los despachos");
                console.error("Error en consulta:", response.mensaje);
            }
        } catch (error) {
            toast.error("Ocurrió un error al obtener los despachos");
            console.error("Error al obtener despachos:", error);
            setDespachos([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        obtenerDespachos();
    }, []);

    const obtenerColorEstado = (item) => {
        const codigo = item?.estado?.codigo?.toUpperCase?.() || "";
        const nombre = item?.estado?.nombre?.toUpperCase?.() || "";

        if (codigo.includes("ACTIVO") || nombre.includes("ACTIVO")) return "#22c55e";
        if (codigo.includes("ERROR") || nombre.includes("ERROR")) return "#ef4444";
        if (codigo.includes("PROCESANDO") || nombre.includes("PROCESANDO")) return "#f59e0b";

        return "#3b82f6";
    };

    const despachosFiltrados = despachos.filter((item) => {
        const termino = busqueda.toLowerCase();

        return (
            (item.codigo && item.codigo.toLowerCase().includes(termino)) ||
            (item.fechaDespacho && item.fechaDespacho.toLowerCase().includes(termino)) ||
            (item.tipoPeriodo && item.tipoPeriodo.toLowerCase().includes(termino)) ||
            (item.contrato && item.contrato.toLowerCase().includes(termino)) ||
            (item.fechaConsumoHasta && item.fechaConsumoHasta.toLowerCase().includes(termino)) ||
            (item.estado?.codigo && item.estado.codigo.toLowerCase().includes(termino)) ||
            (item.estado?.nombre && item.estado.nombre.toLowerCase().includes(termino))
        );
    });

    const verDetalle = (despacho) => {
        localStorage.setItem("idDespachoDetalle", String(despacho.id));
        estadoPagina("DetalleDespacho");
    };




    return (
        <>
            <div className="w-full h-screen flex flex-col p-6 gap-6">
                <div className="flex items-center gap-5 lg:hidden">
                    <div
                        className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-gray-300 active:bg-gray-300 transition-colors mr-4"
                        onClick={abrirMenu}
                    >
                        <IoMenu className="text-2xl" />
                    </div>

                    <h1 className="text-lg font-bold">
                        Despachos
                    </h1>
                </div>

                <article className="flex-1 bg-white shadow-lg rounded-lg p-6 flex flex-col overflow-hidden">
                    <nav className="w-full flex flex-row items-center justify-between mb-4 gap-6">
                        <div className="flex items-center flex-1">
                            <h1 className="hidden lg:inline text-[calc(0.7rem+0.7vw)] font-bold w-[30%] mr-5">
                                Despachos
                            </h1>

                            <div className="relative flex-1">
                                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Buscar por código, fecha, periodo, contrato, consumo hasta o estado..."
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                    className="border-1 border-gray-400 rounded-md p-2 pl-9 w-full text-[0.9rem] focus:outline-none focus:ring-1 focus:border-[#193CB8]"
                                />
                            </div>
                        </div>

                        <button
                            className="h-full px-4 text-[calc(0.4rem+0.4vw)] bg-transparent border text-blue-800 border-blue-800 hover:text-white rounded-lg hover:bg-blue-800 hover:scale-[1.05] transition-all duration-300 cursor-pointer flex items-center justify-center"
                            onClick={() => estadoPagina("NuevoDespacho")}
                        >
                            <span className="hidden lg:inline font-semibold">Agregar Despacho</span>
                            <FaPlus className="lg:hidden text-lg font-extralight" />
                        </button>
                    </nav>

                    {/* Escritorio */}
                    <div className="hidden w-full lg:flex flex-col mb-4 overflow-hidden">
                        <div className="w-full flex flex-row bg-[#ECEEF1] p-3 rounded-lg font-semibold text-gray-700">
                            <span className="w-[8%] text-center">Estado</span>
                            <span className="w-[14%]">Código</span>
                            <span className="w-[12%]">Fecha</span>
                            <span className="w-[12%]">Periodo</span>
                            <span className="w-[22%]">Descripción</span>
                            <span className="w-[22%]">Jornada</span>
                            <span className="w-[10%] text-center">Acción</span>
                        </div>

                        <div className="w-full overflow-y-auto no-scrollbar">
                            {loading ? (
                                <div className="text-center text-gray-500 py-4">
                                    Cargando despachos...
                                </div>
                            ) : despachosFiltrados.length > 0 ? (
                                despachosFiltrados.map((item) => {
                                    const colorEstado = obtenerColorEstado(item);

                                    return (
                                        <div
                                            key={item.id}
                                            className="flex flex-row justify-between items-center bg-white border border-gray-200 rounded-lg shadow-sm mt-2 p-3 hover:bg-gray-50"
                                        >
                                            <div className="w-[8%] flex justify-center relative group px-3">
                                                <div
                                                    className="w-[12px] h-[12px] rounded-full cursor-pointer"
                                                    style={{ backgroundColor: colorEstado }}
                                                ></div>

                                                <Tooltip
                                                    color={colorEstado}
                                                    text={item?.estado?.nombre || "Sin estado"}
                                                    className="-top-8"
                                                />
                                            </div>

                                            <span className="w-[14%] text-gray-700 truncate pr-4" title={item.codigo}>
                                                {item.codigo}
                                            </span>

                                            <span className="w-[12%] text-gray-700">
                                                {item.fechaDespacho}
                                            </span>

                                            <span className="w-[12%] text-gray-700">
                                                {item.tipoPeriodo}
                                            </span>

                                            <span className="w-[22%] text-gray-700 truncate pr-4" title={item.contrato || ""}>
                                                {item.contrato || "Sin contrato"}
                                            </span>

                                            <div className="w-[22%] text-gray-700 truncate pr-4" title={item.fechaConsumoHasta || ""}>
                                                <div className="truncate font-medium">
                                                    {item.fechaConsumoHasta || "Sin fecha"}
                                                </div>
                                            </div>

                                            <div className="w-[10%] flex justify-center">
                                                <div
                                                    className="hover:bg-blue-100 p-2 rounded-full cursor-pointer relative group flex justify-center"
                                                    onClick={() => verDetalle(item)}
                                                >
                                                    <FaEye className="text-blue-600 text-xl" />
                                                    <Tooltip color="#2563eb" text="Ver detalle" />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center text-gray-500 py-4">
                                    No se encontraron despachos que coincidan con la búsqueda.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Mobile */}
                    <div className="w-full h-full lg:hidden flex flex-col overflow-hidden gap-6 overflow-y-auto no-scrollbar">
                        {loading ? (
                            <div className="text-center text-gray-500 py-4">
                                Cargando despachos...
                            </div>
                        ) : despachosFiltrados.length > 0 ? (
                            despachosFiltrados.map((item) => {
                                const colorEstado = obtenerColorEstado(item);

                                return (
                                    <div
                                        key={item.id}
                                        className="rounded-lg shadow-lg p-4 flex flex-col gap-3 border border-slate-200"
                                    >
                                        <div className="w-full flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-[12px] h-[12px] rounded-full cursor-pointer"
                                                    style={{ backgroundColor: colorEstado }}
                                                    title={item?.estado?.nombre || "Sin estado"}
                                                ></div>

                                                <span className="font-semibold truncate">
                                                    {item.codigo}
                                                </span>
                                            </div>

                                            <div
                                                className="hover:bg-blue-100 p-2 rounded-full cursor-pointer"
                                                onClick={() => verDetalle(item)}
                                            >
                                                <FaEye className="text-blue-600" title="Ver detalle" />
                                            </div>
                                        </div>

                                        <div className="flex flex-col text-sm text-slate-600 gap-1">
                                            <span>
                                                <strong>Fecha:</strong> {item.fechaDespacho}
                                            </span>
                                            <span>
                                                <strong>Periodo:</strong> {item.tipoPeriodo}
                                            </span>
                                            <span className="truncate">
                                                <strong>Contrato:</strong> {item.contrato || "Sin contrato"}
                                            </span>
                                            <span className="truncate">
                                                <strong>Consumo hasta:</strong> {item.fechaConsumoHasta || "Sin fecha"}
                                            </span>
                                            <span className="truncate">
                                                <strong>Estado:</strong> {item?.estado?.nombre || "Sin estado"}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="text-center text-gray-500 py-4">
                                No se encontraron despachos que coincidan con la búsqueda.
                            </div>
                        )}
                    </div>
                </article>
            </div>
        </>
    );
};