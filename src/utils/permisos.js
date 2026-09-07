const MAPA_PAGINAS = {
  DashboardGeneral: "dashboard.ver",
  Usuarios: "usuarios.administrar",
  DetalleUsuarios: "usuarios.administrar",

  Despachos: "despachos.ver",
  DetalleDespacho: "despachos.ver",
  NuevoDespacho: "despachos.gestionar",
  CargadeDatos: "despachos.gestionar",
  InformesDespacho: "despachos.informes",
  InformesHome: "despachos.informes",
  InformeRutaEspecialConsolidadoView: "despachos.informes",
  InformeRutaTranzabilidad: "despachos.informes",
  DespachosRoldanillo: "despachos.ver",
  DetalleDespachoRoldanillo: "despachos.ver",
  NuevoDespachoRoldanillo: "despachos.gestionar",
  InformesHomeRoldanillo: "despachos.informes",
  InformeRutaTranzabilidadRoldanillo: "despachos.informes",
  InformesDespachoRoldanillo: "despachos.informes",

  BodegasInventario: "inventario.catalogos",
  CrearBodegaInventario: "inventario.catalogos",
  EditarBodegaInventario: "inventario.catalogos",
  UbicacionesInventario: "inventario.catalogos",
  CrearUbicacionInventario: "inventario.catalogos",
  EditarUbicacionInventario: "inventario.catalogos",
  TiposProductoInventario: "inventario.catalogos",
  CrearTipoProductoInventario: "inventario.catalogos",
  EditarTipoProductoInventario: "inventario.catalogos",
  ProductosInventario: "inventario.catalogos",
  CrearProductoInventario: "inventario.catalogos",
  EditarProductoInventario: "inventario.catalogos",
  CodigosBarrasInventario: "inventario.catalogos",
  CrearCodigoBarrasInventario: "inventario.catalogos",
  EditarCodigoBarrasInventario: "inventario.catalogos",

  EntradasInventario: "inventario.operacion.ver",
  DetalleEntradaInventario: "inventario.operacion.ver",
  CrearEntradaInventario: "inventario.operacion.gestionar",
  SalidasInventario: "inventario.operacion.ver",
  DetalleSalidaInventario: "inventario.operacion.ver",
  CrearSalidaInventario: "inventario.operacion.gestionar",
  TrasladosInventario: "inventario.operacion.ver",
  CrearTrasladoInventario: "inventario.operacion.gestionar",
  EditarTrasladoInventario: "inventario.operacion.gestionar",
  AjustesInventario: "inventario.operacion.ver",
  CrearAjusteInventario: "inventario.operacion.gestionar",
  InventarioInicial: "inventario.operacion.ver",
  CrearInventarioInicial: "inventario.operacion.gestionar",

  ExistenciasInventario: "inventario.control",
  MovimientosInventario: "inventario.control",
  LotesVencimientosInventario: "inventario.control",
  TiposDocumentoInventario: "inventario.configuracion",
  CrearTipoDocumentoInventario: "inventario.configuracion",
  EditarTipoDocumentoInventario: "inventario.configuracion",
  OperadoresInventario: "inventario.configuracion",
  CrearOperadorInventario: "inventario.configuracion",
  EditarOperadorInventario: "inventario.configuracion",

  OrdenesAlistamientoInventario: "alistamiento.administrar",
  DetalleOrdenAlistamientoInventario: "alistamiento.administrar",
  MisOrdenesAlistamientoInventario: "alistamiento.ejecutar",
  AlistarOrdenInventario: "alistamiento.ejecutar",
  ConteosFisicosInventario: "conteos.administrar",
  CrearConteoFisicoInventario: "conteos.administrar",
  DetalleConteoFisicoInventario: "conteos.administrar",
  AnalisisConteoFisicoInventario: "conteos.administrar",
  AjustesConteoFisicoInventario: "conteos.administrar",
  ConteoBodegaInventario: "conteos.ejecutar",
  ConteosAsignadosInventario: "conteos.ejecutar",
};

export const permisosUsuario = (usuario) => Array.isArray(usuario?.permisos) ? usuario.permisos : [];

export const tienePermiso = (usuario, permiso) => {
  if (!permiso) return true;
  if (usuario?.esAdministrador || Number(usuario?.rol || 0) === 1) return true;
  return permisosUsuario(usuario).includes(permiso);
};

export const permisoDePagina = (pagina) => MAPA_PAGINAS[pagina] || null;

export const puedeAbrirPagina = (usuario, pagina) => tienePermiso(usuario, permisoDePagina(pagina));

export const primeraPaginaPermitida = (usuario) => {
  const candidatas = ["DashboardGeneral", "MisOrdenesAlistamientoInventario", "ConteosAsignadosInventario", "Despachos", "ExistenciasInventario"];
  return candidatas.find((pagina) => puedeAbrirPagina(usuario, pagina)) || "DashboardGeneral";
};
