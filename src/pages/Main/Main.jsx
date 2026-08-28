import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ToastContainer, toast } from "react-toastify";

import { Sidebar } from "../../components/common/Sidebar";

import { Usuarios } from "../Usuarios/Usuarios";
import { DetalleUsuarios } from "../Usuarios/DetalleUsuarios";

import { API_BASE } from "../../constants";

import { DashboardGeneral } from "../Dashboard/DashboardGeneral";

import { Despachos } from "../Despachos/Despachos";
import { NuevoDespacho } from "../Despachos/NuevoDespacho";
import { DetalleDespacho } from "../Despachos/DetalleDespacho";
import CargadeDatos from "../Despachos/CargadeDatos";
import { InformesDespacho } from "../Despachos/InformesDespacho";
import InformesHome from "../Despachos/InformesHome";
import InformeRutaEspecialConsolidadoView from "../Despachos/InformeRutaEspecialConsolidadoView";
import InformeRutaTranzabilidad from "../Despachos/InformeRutaTranzabilidad";

import { DespachosRoldanillo } from "../Despachos/Roldanillo/DespachosRoldanillo";
import { NuevoDespachoRoldanillo } from "../Despachos/Roldanillo/NuevoDespachoRoldanillo";
import { DetalleDespachoRoldanillo } from "../Despachos/Roldanillo/DetalleDespachoRoldanillo";
import { InformesHomeRoldanillo } from "../Despachos/Roldanillo/InformesHomeRoldanillo";
import { InformeRutaTranzabilidadRoldanillo } from "../Despachos/Roldanillo/InformeRutaTranzabilidadRoldanillo";
import { InformesDespachoRoldanillo } from "../Despachos/Roldanillo/InformesDespachoRoldanillo";

// ******* INVENTARIOS *********

import { BodegasInventario } from "../Inventarios/Bodegas/BodegasInventario";
import { CrearBodegaInventario } from "../Inventarios/Bodegas/CrearBodegaInventario";
import { EditarBodegaInventario } from "../Inventarios/Bodegas/EditarBodegaInventario";

import { UbicacionesInventario } from "../Inventarios/Ubicaciones/UbicacionesInventario";
import { CrearUbicacionInventario } from "../Inventarios/Ubicaciones/CrearUbicacionInventario";
import { EditarUbicacionInventario } from "../Inventarios/Ubicaciones/EditarUbicacionInventario";

import { TiposProductoInventario } from "../Inventarios/TiposProducto/TiposProductoInventario";
import { CrearTipoProductoInventario } from "../Inventarios/TiposProducto/CrearTipoProductoInventario";
import { EditarTipoProductoInventario } from "../Inventarios/TiposProducto/EditarTipoProductoInventario";

import { ProductosInventario } from "../Inventarios/Productos/ProductosInventario";
import { CrearProductoInventario } from "../Inventarios/Productos/CrearProductoInventario";
import { EditarProductoInventario } from "../Inventarios/Productos/EditarProductoInventario";
import { CodigosBarrasInventario } from "../Inventarios/CodigosBarras/CodigosBarrasInventario";
import { CrearCodigoBarrasInventario } from "../Inventarios/CodigosBarras/CrearCodigoBarrasInventario";
import { EditarCodigoBarrasInventario } from "../Inventarios/CodigosBarras/EditarCodigoBarrasInventario";
import { TiposDocumentoInventario } from "../Inventarios/TiposDocumentos/TiposDocumentosInventario";
import { CrearTipoDocumentoInventario } from "../Inventarios/TiposDocumentos/CrearTipoDocumentoInventario";
import { EditarTipoDocumentoInventario } from "../Inventarios/TiposDocumentos/EditarTipoDocumentoInventario";
import { OperadoresInventario } from "../Inventarios/Operadores/OperadoresInventario";
import { CrearOperadorInventario } from "../Inventarios/Operadores/CrearOperadorInventario";
import { EditarOperadorInventario } from "../Inventarios/Operadores/EditarOperadorInventario";
import { EntradasInventario } from "../Inventarios/Entradas/EntradasInventario";
import { CrearEntradaInventario } from "../Inventarios/Entradas/CrearEntradaInventario";
import { DetalleEntradaInventario } from "../Inventarios/Entradas/DetalleEntradaInventario";
import OrdenesAlistamientoInventario from "../Inventarios/OrdenesAlistamiento/OrdenesAlistamientoInventario";
import DetalleOrdenAlistamientoInventario from "../Inventarios/OrdenesAlistamiento/DetalleOrdenAlistamientoInventario";
import MisOrdenesAlistamientoInventario from "../Inventarios/OrdenesAlistamiento/MisOrdenesAlistamientoInventario";
import AlistarOrdenInventario from "../Inventarios/OrdenesAlistamiento/AlistarOrdenInventario";
import { SalidasInventario } from "../Inventarios/Salidas/SalidasInventario";
import { CrearSalidaInventario } from "../Inventarios/Salidas/CrearSalidaInventario";
import { DetalleSalidaInventario } from "../Inventarios/Salidas/DetalleSalidaInventario";
import { TrasladosInventario } from "../Inventarios/Traslados/TrasladosInventario";
import { CrearTrasladoInventario } from "../Inventarios/Traslados/CrearTrasladoInventario";
import { EditarTrasladoInventario } from "../Inventarios/Traslados/EditarTrasladoInventario";
import { AjustesInventario } from "../Inventarios/Ajustes/AjustesInventario";
import { CrearAjusteInventario } from "../Inventarios/Ajustes/CrearAjusteInventario";
import { ExistenciasInventario } from "../Inventarios/Existencias/ExistenciasInventario";
import { MovimientosInventario } from "../Inventarios/Movimientos/MovimientosInventario";
import { LotesVencimientosInventario } from "../Inventarios/Lotes/LotesVencimientosInventario";
import ConteosFisicosInventario from "../Inventarios/Conteos/ConteosFisicosInventario";
import CrearConteoFisicoInventario from "../Inventarios/Conteos/CrearConteoFisicoInventario";
import DetalleConteoFisicoInventario from "../Inventarios/Conteos/DetalleConteoFisicoInventario";
import ConteoBodegaInventario from "../Inventarios/Conteos/ConteoBodegaInventario";
import ConteosAsignadosInventario from "../Inventarios/Conteos/ConteosAsignadosInventario";
import AnalisisConteoFisicoInventario from "../Inventarios/Conteos/AnalisisConteoFisicoInventario";
import AjustesConteoFisicoInventario from "../Inventarios/Conteos/AjustesConteoFisicoInventario";
import { CrearInventarioInicial } from "../Inventarios/InventarioInicial/CrearInventarioInicial";
import { InventarioInicial } from "../Inventarios/InventarioInicial/InventarioInicial";


export const Main = () => {
    const navigate = useNavigate();

    const usuario = JSON.parse(localStorage.getItem("us"));

    const [session, setSession] = useState(false);
    const [sidebar, setSidebar] = useState(false);

    const [pagina, setPagina] = useState(
        usuario?.rol === 1 ? "DashboardGeneral" : usuario?.rol === 6 ? "Perfil" : "DashboardGeneral"
    );

    const validarSesion = async () => {
        if (!localStorage.getItem("us")) {
            navigate("/");
            return;
        }

        try {
            const url = `${API_BASE}auth/autenticacion.php?case=2`;

            const formData = new FormData();
            formData.append("token", localStorage.getItem("st"));
            formData.append("correo", usuario.correo);

            const res = await fetch(url, {
                method: "POST",
                body: formData,
            });

            const response = await res.json();

            if (response.rpta === "si") {
                setSession(true);
            } else {
                setSession(false);
                localStorage.clear();

                toast.error(response.mensaje);
                navigate("/");
            }
        } catch (error) {
            setSession(false);
            localStorage.clear();

            console.error(error);
            toast.error("Ocurrió un error al validar la sesión");
            navigate("/");
        }
    };

    useEffect(() => {
        validarSesion();

        const timer = setInterval(validarSesion, 5000);

        return () => clearInterval(timer);
    }, []);

    const navegar = (nuevaPagina) => {
        if (!nuevaPagina || nuevaPagina === false) return;

        window.history.pushState({ pagina: nuevaPagina }, "", `#${nuevaPagina}`);
        setPagina(nuevaPagina);
    };

    useEffect(() => {
        const hashInicial = window.location.hash.replace("#", "");

        if (hashInicial) {
            setPagina(hashInicial);
            window.history.replaceState({ pagina: hashInicial }, "", `#${hashInicial}`);
        } else if (pagina && pagina !== false) {
            window.history.replaceState({ pagina }, "", `#${pagina}`);
        }

        const onPopState = (event) => {
            if (event.state && event.state.pagina) {
                setPagina(event.state.pagina);
            }
        };

        window.addEventListener("popstate", onPopState);

        return () => window.removeEventListener("popstate", onPopState);
    }, []);

    return (
        <>
            {session && (
                <>
                    <ToastContainer position="top-center" autoClose={5000} />

                    <main className="md:h-screen w-screen flex bg-gray-200/70 overflow-hidden relative">
                        <div
                            className={`${sidebar ? "opacity-100 z-100" : "opacity-0"
                                } -z-10 h-screen w-screen bg-black/60 fixed transition-opacity md:hidden`}
                        ></div>

                        <Sidebar
                            isOpen={sidebar}
                            setIsOpen={setSidebar}
                            pagina={pagina}
                            navegar={navegar}
                        />

                        {pagina === "DashboardGeneral" && (
                            <DashboardGeneral setSidebar={setSidebar} navegar={navegar} />
                        )}

                        {pagina === "Usuarios" && (
                            <Usuarios setSidebar={setSidebar} navegar={navegar} />
                        )}

                        {pagina === "DetalleUsuarios" && (
                            <DetalleUsuarios setSidebar={setSidebar} navegar={navegar} />
                        )}

                        {pagina === "Despachos" && (
                            <Despachos setSidebar={setSidebar} navegar={navegar} />
                        )}

                        {pagina === "NuevoDespacho" && (
                            <NuevoDespacho setSidebar={setSidebar} navegar={navegar} />
                        )}

                        {pagina === "DetalleDespacho" && (
                            <DetalleDespacho setSidebar={setSidebar} navegar={navegar} />
                        )}

                        {pagina === "CargadeDatos" && (
                            <CargadeDatos setSidebar={setSidebar} navegar={navegar} />
                        )}

                        {pagina === "InformesDespacho" && (
                            <InformesDespacho setSidebar={setSidebar} navegar={navegar} />
                        )}

                        {pagina === "InformesHome" && (
                            <InformesHome setSidebar={setSidebar} navegar={navegar} />
                        )}

                        {pagina === "InformeRutaEspecialConsolidadoView" && (
                            <InformeRutaEspecialConsolidadoView
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "InformeRutaTranzabilidad" && (
                            <InformeRutaTranzabilidad
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "DespachosRoldanillo" && (
                            <DespachosRoldanillo setSidebar={setSidebar} navegar={navegar} />
                        )}

                        {pagina === "NuevoDespachoRoldanillo" && (
                            <NuevoDespachoRoldanillo
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "DetalleDespachoRoldanillo" && (
                            <DetalleDespachoRoldanillo
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "InformesHomeRoldanillo" && (
                            <InformesHomeRoldanillo
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "InformeRutaTranzabilidadRoldanillo" && (
                            <InformeRutaTranzabilidadRoldanillo
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "InformesDespachoRoldanillo" && (
                            <InformesDespachoRoldanillo
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {/* INVENTARIOS - BODEGAS */}

                        {pagina === "BodegasInventario" && (
                            <BodegasInventario setSidebar={setSidebar} navegar={navegar} />
                        )}

                        {pagina === "CrearBodegaInventario" && (
                            <CrearBodegaInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "EditarBodegaInventario" && (
                            <EditarBodegaInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {/* INVENTARIOS - UBICACIONES */}

                        {pagina === "UbicacionesInventario" && (
                            <UbicacionesInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "CrearUbicacionInventario" && (
                            <CrearUbicacionInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "EditarUbicacionInventario" && (
                            <EditarUbicacionInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {/* INVENTARIOS - TIPOS DE PRODUCTO */}

                        {pagina === "TiposProductoInventario" && (
                            <TiposProductoInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "CrearTipoProductoInventario" && (
                            <CrearTipoProductoInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "EditarTipoProductoInventario" && (
                            <EditarTipoProductoInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {/* INVENTARIOS - PRODUCTOS */}

                        {pagina === "ProductosInventario" && (
                            <ProductosInventario setSidebar={setSidebar} navegar={navegar} />
                        )}

                        {pagina === "CrearProductoInventario" && (
                            <CrearProductoInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "EditarProductoInventario" && (
                            <EditarProductoInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "CodigosBarrasInventario" && (
                            <CodigosBarrasInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "CrearCodigoBarrasInventario" && (
                            <CrearCodigoBarrasInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}


                        {pagina === "EditarCodigoBarrasInventario" && (
                            <EditarCodigoBarrasInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}


                        {/* INVENTARIOS - TIPOS DE DOCUMENTO */}

                        {pagina === "TiposDocumentoInventario" && (
                            <TiposDocumentoInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "CrearTipoDocumentoInventario" && (
                            <CrearTipoDocumentoInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "EditarTipoDocumentoInventario" && (
                            <EditarTipoDocumentoInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}


                        {/* INVENTARIOS - OPERADORES */}

                        {pagina === "OperadoresInventario" && (
                            <OperadoresInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "CrearOperadorInventario" && (
                            <CrearOperadorInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "EditarOperadorInventario" && (
                            <EditarOperadorInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}


                        {/* INVENTARIOS - ENTRADAS */}

                        {pagina === "EntradasInventario" && (
                            <EntradasInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "CrearEntradaInventario" && (
                            <CrearEntradaInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "DetalleEntradaInventario" && (
                            <DetalleEntradaInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {/* INVENTARIOS - ÓRDENES DE ALISTAMIENTO */}

                        {pagina === "OrdenesAlistamientoInventario" && (
                            <OrdenesAlistamientoInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "DetalleOrdenAlistamientoInventario" && (
                            <DetalleOrdenAlistamientoInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "MisOrdenesAlistamientoInventario" && (
                            <MisOrdenesAlistamientoInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "AlistarOrdenInventario" && (
                            <AlistarOrdenInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {/* INVENTARIOS - SALIDAS */}

                        {pagina === "SalidasInventario" && (
                            <SalidasInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}


                        {pagina === "CrearSalidaInventario" && (
                            <CrearSalidaInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}


                        {pagina === "DetalleSalidaInventario" && (
                            <DetalleSalidaInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}


                        {/* INVENTARIOS - TRASLADOS */}

                        {pagina === "TrasladosInventario" && (
                            <TrasladosInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "CrearTrasladoInventario" && (
                            <CrearTrasladoInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}
                        {pagina === "EditarTrasladoInventario" && (
                            <EditarTrasladoInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {/* INVENTARIOS - AJUSTES */}

                        {pagina === "AjustesInventario" && (
                            <AjustesInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "CrearAjusteInventario" && (
                            <CrearAjusteInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {/* INVENTARIOS - TRASLADOS */}

                        {pagina === "ExistenciasInventario" && (
                            <ExistenciasInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}


                        {/* INVENTARIOS - Movimientos */}

                        {pagina === "MovimientosInventario" && (
                            <MovimientosInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}


                        {/* INVENTARIOS - LotesVencimientosInventario */}

                        {pagina === "LotesVencimientosInventario" && (
                            <LotesVencimientosInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {/* INVENTARIOS - Conteos */}


                        {pagina === "ConteosFisicosInventario" && (
                            <ConteosFisicosInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "CrearConteoFisicoInventario" && (
                            <CrearConteoFisicoInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "DetalleConteoFisicoInventario" && (
                            <DetalleConteoFisicoInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}


                        {pagina === "ConteoBodegaInventario" && (
                            <ConteoBodegaInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "ConteosAsignadosInventario" && (
                            <ConteosAsignadosInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "AnalisisConteoFisicoInventario" && (
                            <AnalisisConteoFisicoInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "AjustesConteoFisicoInventario" && (
                            <AjustesConteoFisicoInventario
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {/* INVENTARIOS - inventario inicial */}

                        {pagina === "CrearInventarioInicial" && (
                            <CrearInventarioInicial
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}

                        {pagina === "InventarioInicial" && (
                            <InventarioInicial
                                setSidebar={setSidebar}
                                navegar={navegar}
                            />
                        )}


                    </main>
                </>
            )}
        </>
    );
};
