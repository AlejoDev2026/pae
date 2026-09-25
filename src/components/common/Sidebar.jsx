import { useMemo, useState } from "react";
import { API_BASE } from "../../constants/index";
import { toast } from "react-toastify";
import { MdLocalShipping } from "react-icons/md";
import {
  FaHouseChimney,
  FaMapLocationDot,
  FaUser,
  FaBox,
  FaCreditCard,
  FaMoneyBill1Wave,
  FaUserGear,
  FaWarehouse,
  FaBarcode,
  FaBoxesStacked,
  FaClipboardList,
  FaChevronDown,
  FaRightFromBracket,
} from "react-icons/fa6";
import { IoClose } from "react-icons/io5";
import { useNavigate } from "react-router";
import logo from "../../assets/logoPae.png";
import { puedeAbrirPagina, tienePermiso } from "../../utils/permisos";

export const Sidebar = ({ isOpen, setIsOpen, pagina, navegar }) => {
  const navigate = useNavigate();

  const [openGroups, setOpenGroups] = useState({
    inventarios: false,
    "inventarios-catalogos": false,
    "inventarios-operacion": false,
    "inventarios-control": false,
    "inventarios-configuracion": false,
  });

  const usuario = JSON.parse(localStorage.getItem("us"));
  const administraAlistamiento = tienePermiso(usuario, "alistamiento.administrar");

  const cerrarMenu = () => setIsOpen(false);

  const estadoPagina = (paginaDestino) => {
    navegar(paginaDestino);
    setIsOpen(false);
  };

  const paginaActiva = (item) => {
    if (!item) return false;

    if (item.pagina && item.pagina === pagina) return true;

    if (
      Array.isArray(item.paginasRelacionadas) &&
      item.paginasRelacionadas.includes(pagina)
    ) {
      return true;
    }

    return false;
  };

  const sectionActiva = (section) => {
    if (!section?.children?.length) return false;

    return section.children.some((item) => paginaActiva(item));
  };

  const grupoActivo = (item) => {
    if (!item?.children?.length) return false;

    return item.children.some((child) => {
      if (child.tipo === "section") {
        return sectionActiva(child);
      }

      return paginaActiva(child);
    });
  };

  const toggleGrupoPrincipal = (groupId) => {
    setOpenGroups((prev) => {
      const nuevoEstado = !prev[groupId];

      if (groupId === "inventarios" && !nuevoEstado) {
        return {
          ...prev,
          inventarios: false,
          "inventarios-catalogos": false,
          "inventarios-operacion": false,
          "inventarios-control": false,
          "inventarios-configuracion": false,
        };
      }

      return {
        ...prev,
        [groupId]: nuevoEstado,
      };
    });
  };

  const toggleSectionInventario = (sectionId) => {
    setOpenGroups((prev) => {
      const nuevoEstado = !prev[sectionId];

      return {
        ...prev,
        inventarios: true,
        "inventarios-catalogos": false,
        "inventarios-operacion": false,
        "inventarios-control": false,
        "inventarios-configuracion": false,
        [sectionId]: nuevoEstado,
      };
    });
  };

  const cerrarSesión = async () => {
    try {
      const url = `${API_BASE}auth/autenticacion.php?case=3&id=${usuario?.id}`;
      const res = await fetch(url);
      const response = await res.json();

      if (response.rpta === "si") {
        toast.success(response.mensaje);
        localStorage.clear();
        navigate("/");
      } else {
        toast.error(response.mensaje);
      }
    } catch (error) {
      console.error(error);
      toast.error("Ocurrió un error al cerrar sesión");
    }
  };

  const menuAdmin = useMemo(
    () => [
      {
        id: "dashboard",
        label: "Dashboard",
        pagina: "DashboardGeneral",
        icono: <FaHouseChimney />,
      },
      {
        id: "usuarios",
        label: "Usuarios",
        pagina: "Usuarios",
        icono: <FaUser />,
        paginasRelacionadas: ["Usuarios", "DetalleUsuarios"],
      },
      {
        id: "despachos",
        label: "Despachos",
        pagina: "Despachos",
        icono: <MdLocalShipping />,
        paginasRelacionadas: [
          "Despachos",
          "NuevoDespacho",
          "DetalleDespacho",
          "CargadeDatos",
          "InformesDespacho",
          "InformesHome",
          "InformeRutaEspecialConsolidadoView",
          "InformeRutaTranzabilidad",
        ],
      },
      {
        id: "roldanillo",
        label: "Roldanillo",
        pagina: "DespachosRoldanillo",
        icono: <FaMapLocationDot />,
        paginasRelacionadas: [
          "DespachosRoldanillo",
          "NuevoDespachoRoldanillo",
          "DetalleDespachoRoldanillo",
          "InformesHomeRoldanillo",
          "InformeRutaTranzabilidadRoldanillo",
        ],
      },
      {
        id: "ordenes-compra",
        label: "Órdenes de compra",
        pagina: "OrdenesCompraInventario",
        icono: <FaClipboardList />,
      },
      {
        id: "inventarios",
        label: "Inventarios",
        icono: <FaBox />,
        children: [
          {
            id: "inventarios-catalogos",
            tipo: "section",
            label: "Catálogos",
            icono: <FaBoxesStacked />,
            children: [
              {
                id: "bodegas",
                label: "Bodegas",
                pagina: "BodegasInventario",
                icono: <FaWarehouse />,
                paginasRelacionadas: [
                  "BodegasInventario",
                  "CrearBodegaInventario",
                  "EditarBodegaInventario",
                ],
              },
              {
                id: "ubicaciones",
                label: "Ubicaciones",
                pagina: "UbicacionesInventario",
                icono: <FaBoxesStacked />,
                paginasRelacionadas: [
                  "UbicacionesInventario",
                  "CrearUbicacionInventario",
                  "EditarUbicacionInventario",
                ],
              },
              {
                id: "tipos-producto",
                label: "Tipos de producto",
                pagina: "TiposProductoInventario",
                icono: <FaClipboardList />,
                paginasRelacionadas: [
                  "TiposProductoInventario",
                  "CrearTipoProductoInventario",
                  "EditarTipoProductoInventario",
                ],
              },
              {
                id: "productos",
                label: "Productos",
                pagina: "ProductosInventario",
                icono: <FaBox />,
                paginasRelacionadas: [
                  "ProductosInventario",
                  "CrearProductoInventario",
                  "EditarProductoInventario",
                ],
              },
              {
                id: "embalajes",
                label: "Embalajes",
                pagina: "EmbalajesInventario",
                icono: <FaBoxesStacked />,
                paginasRelacionadas: ["EmbalajesInventario", "CrearEmbalajeInventario", "EditarEmbalajeInventario"],
              },
              {
                id: "codigos-barras",
                label: "Códigos de barras",
                pagina: "CodigosBarrasInventario",
                icono: <FaBarcode />,
                paginasRelacionadas: [
                  "CodigosBarrasInventario",
                  "CrearCodigoBarrasInventario",
                  "EditarCodigoBarrasInventario",
                ],
              },
            ],
          },
          {
            id: "inventarios-operacion",
            tipo: "section",
            label: "Operación",
            icono: <FaClipboardList />,
            children: [
              {
                id: "entradas-inventario",
                label: "Entradas de inventario",
                pagina: "EntradasInventario",
                icono: <FaClipboardList />,
                paginasRelacionadas: [
                  "EntradasInventario",
                  "CrearEntradaInventario",
                  "EditarEntradaInventario",
                  "DetalleEntradaInventario",
                ],
              },
              ...(administraAlistamiento
                ? [
                  {
                    id: "ordenes-alistamiento-inventario",
                    label: "Órdenes de alistamiento",
                    pagina: "OrdenesAlistamientoInventario",
                    icono: <FaClipboardList />,
                    paginasRelacionadas: [
                      "OrdenesAlistamientoInventario",
                      "DetalleOrdenAlistamientoInventario",
                      "MisOrdenesAlistamientoInventario",
                      "AlistarOrdenInventario",
                    ],
                  },
                ]
                : [
                  {
                    id: "mis-ordenes-alistamiento-inventario",
                    label: "Mis órdenes de alistamiento",
                    pagina: "MisOrdenesAlistamientoInventario",
                    icono: <FaClipboardList />,
                    paginasRelacionadas: [
                      "MisOrdenesAlistamientoInventario",
                      "AlistarOrdenInventario",
                    ],
                  },
                ]),
              {
                id: "salidas-inventario",
                label: "Salidas de inventario",
                pagina: "SalidasInventario",
                icono: <FaBox />,
                paginasRelacionadas: [
                  "SalidasInventario",
                  "CrearSalidaInventario",
                  "EditarSalidaInventario",
                  "DetalleSalidaInventario",
                ],
              },
              {
                id: "traslados-inventario",
                label: "Traslados",
                pagina: "TrasladosInventario",
                icono: <FaBoxesStacked />,
                paginasRelacionadas: [
                  "TrasladosInventario",
                  "CrearTrasladoInventario",
                  "EditarTrasladoInventario",
                  "DetalleTrasladoInventario",
                ],
              },
              {
                id: "ajustes-inventario",
                label: "Ajustes de inventario",
                pagina: "AjustesInventario",
                icono: <FaWarehouse />,
                paginasRelacionadas: [
                  "AjustesInventario",
                  "CrearAjusteInventario",
                  "EditarAjusteInventario",
                  "DetalleAjusteInventario",
                ],
              },
              {
                id: "inventario-inicial",
                label: "Inventario inicial",
                pagina: "InventarioInicial",
                icono: <FaClipboardList />,
                paginasRelacionadas: [
                  "InventarioInicial",
                  "CrearInventarioInicial",
                ],
              },
            ],
          },
          {
            id: "inventarios-control",
            tipo: "section",
            label: "Control",
            icono: <FaWarehouse />,
            children: [
              {
                id: "existencias-inventario",
                label: "Existencias / saldos",
                pagina: "ExistenciasInventario",
                icono: <FaBoxesStacked />,
                paginasRelacionadas: ["ExistenciasInventario"],
              },
              {
                id: "lotes-inventario",
                label: "Lotes y vencimientos",
                pagina: "LotesVencimientosInventario",
                icono: <FaWarehouse />,
                paginasRelacionadas: [
                  "LotesInventario",
                  "DetalleLoteInventario",
                ],
              },
              {
                id: "kardex-inventario",
                label: "Movimientos / Kardex",
                pagina: "MovimientosInventario",
                icono: <FaClipboardList />,
                paginasRelacionadas: [
                  "MovimientosKardexInventario",
                  "DetalleMovimientoInventario",
                ],
              },
              {
                id: "conteos-fisicos",
                label: "Conteos físicos",
                pagina: "ConteosFisicosInventario",
                icono: <FaClipboardList />,
                paginasRelacionadas: [
                  "ConteosFisicosInventario",
                  "CrearConteoFisicoInventario",
                  "EditarConteoFisicoInventario",
                  "DetalleConteoFisicoInventario",
                ],
              },

            ],
          },
          {
            id: "inventarios-configuracion",
            tipo: "section",
            label: "Configuración",
            icono: <FaUserGear />,
            children: [
              {
                id: "tipos-documento-inventario",
                label: "Tipos de documento",
                pagina: "TiposDocumentoInventario",
                icono: <FaClipboardList />,
                paginasRelacionadas: [
                  "TiposDocumentoInventario",
                  "CrearTipoDocumentoInventario",
                  "EditarTipoDocumentoInventario",
                ],
              },
              {
                id: "operadores-inventario",
                label: "Operadores",
                pagina: "OperadoresInventario",
                icono: <FaUserGear />,
                paginasRelacionadas: [
                  "OperadoresInventario",
                  "CrearOperadorInventario",
                  "EditarOperadorInventario",
                ],
              },
            ],
          },
        ],
      },
    ],
    [administraAlistamiento]
  );

  const renderItem = (item, nivel = 0) => {
    const activo = paginaActiva(item);
    const esSubItem = nivel > 0;

    return (
      <li key={item.id}>
        <button
          type="button"
          onClick={() => estadoPagina(item.pagina)}
          className={`group flex w-full items-center text-left font-semibold transition-all duration-300 ${esSubItem
            ? "gap-2 rounded-lg px-2 py-2 text-[12px]"
            : "gap-3 rounded-xl px-3 py-2.5 text-sm"
            } ${activo
              ? "bg-blue-800 text-white shadow-md"
              : "text-slate-700 hover:bg-white hover:shadow-sm"
            }`}
        >
          <span
            className={`flex items-center justify-center shrink-0 transition-all ${esSubItem
              ? "h-7 w-7 rounded-lg text-[13px]"
              : "h-8 w-8 rounded-lg text-base"
              } ${activo
                ? "bg-white/15 text-white"
                : "bg-white text-blue-800 shadow-sm group-hover:bg-blue-50"
              }`}
          >
            {item.icono}
          </span>

          <span className="min-w-0 flex-1 leading-tight">
            {item.label}
          </span>
        </button>
      </li>
    );
  };
  const renderSection = (section) => {
    const activa = sectionActiva(section);
    const abierta = !!openGroups[section.id];

    return (
      <li key={section.id} className="mt-2 first:mt-0">
        <button
          type="button"
          onClick={() => toggleSectionInventario(section.id)}
          className={`group flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-sm font-bold transition-all duration-300 ${activa
            ? "bg-blue-50 text-blue-800 border border-blue-100"
            : abierta
              ? "bg-white text-slate-800 shadow-sm border border-slate-200"
              : "bg-slate-100 text-slate-600 hover:bg-white hover:shadow-sm border border-transparent"
            }`}
        >
          <span className="flex items-center gap-2 min-w-0">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-[13px] shrink-0 transition-all ${activa
                ? "bg-blue-800 text-white"
                : abierta
                  ? "bg-blue-50 text-blue-800"
                  : "bg-white text-blue-800 shadow-sm group-hover:bg-blue-50"
                }`}
            >
              {section.icono}
            </span>

            <span className="min-w-0 leading-tight">
              {section.label}
            </span>
          </span>

          <FaChevronDown
            className={`text-[10px] shrink-0 transition-transform duration-300 ${abierta ? "rotate-180" : ""
              }`}
          />
        </button>

        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${abierta ? "max-h-[600px] opacity-100 mt-2" : "max-h-0 opacity-0"
            }`}
        >
          <ul className="ml-1 border-l border-slate-200 pl-2 flex flex-col gap-1">
            {section.children.map((item) => renderItem(item, 1))}
          </ul>
        </div>
      </li>
    );
  };
  const renderGrupo = (item) => {
    const activoGrupo = grupoActivo(item);
    const abierto = !!openGroups[item.id];

    return (
      <li key={item.id} className="flex flex-col">
        <button
          type="button"
          onClick={() => toggleGrupoPrincipal(item.id)}
          className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm font-bold transition-all duration-300 ${activoGrupo
            ? "bg-blue-800 text-white shadow-md"
            : abierto
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-700 hover:bg-white hover:shadow-sm"
            }`}
        >
          <span className="flex items-center gap-3">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg text-base transition-all ${activoGrupo
                ? "bg-white/15 text-white"
                : abierto
                  ? "bg-blue-50 text-blue-800"
                  : "bg-white text-blue-800 shadow-sm group-hover:bg-blue-50"
                }`}
            >
              {item.icono}
            </span>

            <span>{item.label}</span>
          </span>

          <FaChevronDown
            className={`text-xs transition-transform duration-300 ${abierto ? "rotate-180" : ""
              }`}
          />
        </button>

        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${abierto ? "max-h-[1400px] opacity-100 mt-2" : "max-h-0 opacity-0"
            }`}
        >
          <ul className="ml-1 border-l border-slate-200 pl-2 flex flex-col gap-1">
            {item.children.map((child) =>
              child.tipo === "section" ? renderSection(child) : renderItem(child)
            )}
          </ul>
        </div>
      </li>
    );
  };

  const renderMenu = (items) => {
    return items.map((item) => {
      if (item.children?.length) {
        return renderGrupo(item);
      }

      return renderItem(item);
    });
  };

  const menu = useMemo(() => {
    const filtrar = (items) => items.reduce((resultado, item) => {
      if (item.children?.length) {
        const children = filtrar(item.children);
        if (children.length) resultado.push({ ...item, children });
      } else if (puedeAbrirPagina(usuario, item.pagina)) {
        resultado.push(item);
      }
      return resultado;
    }, []);

    return filtrar(menuAdmin);
  }, [menuAdmin, usuario]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] lg:hidden"
          onClick={cerrarMenu}
        ></div>
      )}

      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-[88vw] max-w-[320px] bg-slate-100 border-r border-slate-200 shadow-xl transition-transform duration-300 lg:static lg:w-[320px] lg:max-w-none lg:translate-x-0 lg:shadow-none ${isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-3 px-5 py-5 border-b border-slate-200 bg-white">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-11 w-11 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden">
                <img
                  src={logo}
                  alt="Logo PAE"
                  className="h-9 w-9 object-contain"
                />
              </div>

              <div className="min-w-0">
                <h1 className="text-base font-black text-slate-800 leading-tight">
                  PAE
                </h1>
                <p className="text-xs text-slate-500 font-semibold truncate">
                  Panel administrativo
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={cerrarMenu}
              className="h-9 w-9 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center lg:hidden"
            >
              <IoClose className="text-xl text-slate-700" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-5">
            <ul className="flex flex-col gap-2">{renderMenu(menu)}</ul>
          </div>

          <div className="border-t border-slate-200 bg-white p-4">
            <button
              type="button"
              onClick={cerrarSesión}
              className="w-full h-11 rounded-xl bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-bold transition-colors flex items-center justify-center gap-2"
            >
              <FaRightFromBracket />
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
