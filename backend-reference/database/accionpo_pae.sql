-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Servidor: localhost:3306
-- Tiempo de generación: 04-08-2026 a las 20:08:39
-- Versión del servidor: 10.11.18-MariaDB-cll-lve
-- Versión de PHP: 8.4.23

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `accionpo_pae`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `BodegasInventario`
--

CREATE TABLE `BodegasInventario` (
  `id` int(11) NOT NULL,
  `codigo` varchar(50) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `CargasExcelDespacho`
--

CREATE TABLE `CargasExcelDespacho` (
  `id` int(11) NOT NULL,
  `idJornada` int(11) DEFAULT NULL,
  `idDespacho` int(11) DEFAULT NULL,
  `nombreArchivo` varchar(255) NOT NULL,
  `hojasDetectadas` int(11) NOT NULL DEFAULT 0,
  `rutasDetectadas` int(11) NOT NULL DEFAULT 0,
  `estado` enum('PROCESANDO','LISTO','ERROR') NOT NULL DEFAULT 'PROCESANDO',
  `mensajeError` text DEFAULT NULL,
  `observacion` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `CategoriasProducto`
--

CREATE TABLE `CategoriasProducto` (
  `id` int(11) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `idEstado` int(11) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `ColegiosDespacho`
--

CREATE TABLE `ColegiosDespacho` (
  `id` int(11) NOT NULL,
  `codigo` varchar(50) DEFAULT NULL,
  `nombre` varchar(255) NOT NULL,
  `observacion` varchar(255) DEFAULT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `DespachoArchivos`
--

CREATE TABLE `DespachoArchivos` (
  `id` int(11) NOT NULL,
  `idDespacho` int(11) NOT NULL,
  `tipoArchivo` enum('AM','PM','JORNADA_UNICA') NOT NULL,
  `nombreArchivo` varchar(255) NOT NULL,
  `hashArchivo` varchar(100) DEFAULT NULL,
  `hojasDetectadas` int(11) NOT NULL DEFAULT 0,
  `rutasDetectadas` int(11) NOT NULL DEFAULT 0,
  `idEstado` int(11) NOT NULL,
  `mensajeError` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `DespachosInforme`
--

CREATE TABLE `DespachosInforme` (
  `id` int(11) NOT NULL,
  `idJornada` int(11) DEFAULT NULL,
  `codigo` varchar(50) NOT NULL,
  `fechaDespacho` date NOT NULL,
  `fechaConsumoDesde` date DEFAULT NULL,
  `fechaConsumoHasta` date DEFAULT NULL,
  `contrato` varchar(120) DEFAULT NULL,
  `tipoDespacho` varchar(50) DEFAULT 'CLASICO',
  `tipoPeriodo` enum('DIARIO','SEMANAL','MENSUAL') NOT NULL DEFAULT 'DIARIO',
  `descripcion` varchar(150) DEFAULT NULL,
  `idEstado` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `DetalleRutaProducto`
--

CREATE TABLE `DetalleRutaProducto` (
  `id` bigint(20) NOT NULL,
  `idDespacho` int(11) NOT NULL,
  `idDespachoArchivo` int(11) DEFAULT NULL,
  `idCarga` int(11) DEFAULT NULL,
  `idRuta` int(11) NOT NULL,
  `idColegio` int(11) DEFAULT NULL,
  `idSede` int(11) DEFAULT NULL,
  `idProducto` int(11) NOT NULL,
  `productoExcel` varchar(255) DEFAULT NULL,
  `unidadCoberturaExcel` varchar(150) DEFAULT NULL,
  `descripcionMostrada` varchar(350) DEFAULT NULL,
  `consecutivo` int(11) DEFAULT NULL,
  `cantidad` decimal(18,2) NOT NULL DEFAULT 0.00,
  `totalCoberturaRuta` decimal(18,2) NOT NULL DEFAULT 0.00,
  `cajasPacas` decimal(18,2) NOT NULL DEFAULT 0.00,
  `unidades` decimal(18,2) NOT NULL DEFAULT 0.00,
  `observacion` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `EmbalajeCatalogo`
--

CREATE TABLE `EmbalajeCatalogo` (
  `id` int(11) NOT NULL,
  `producto_base` varchar(180) NOT NULL,
  `presentacion` varchar(120) DEFAULT NULL,
  `embalaje` varchar(180) DEFAULT NULL,
  `uni/caja` varchar(50) NOT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `Estados`
--

CREATE TABLE `Estados` (
  `id` int(11) NOT NULL,
  `codigo` varchar(50) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `GruposProducto`
--

CREATE TABLE `GruposProducto` (
  `id` int(11) NOT NULL,
  `codigo` varchar(20) NOT NULL,
  `idCategoria` int(11) NOT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `InventarioConteoDetalle`
--

CREATE TABLE `InventarioConteoDetalle` (
  `id` int(11) NOT NULL,
  `idSolicitudConteo` int(11) NOT NULL,
  `idProducto` int(11) NOT NULL,
  `idLote` int(11) DEFAULT NULL,
  `idBodega` int(11) DEFAULT NULL,
  `idUbicacion` int(11) DEFAULT NULL,
  `cantidadSistema` decimal(14,3) NOT NULL DEFAULT 0.000,
  `cantidadDisponibleSistema` decimal(14,3) DEFAULT NULL,
  `cantidadReservadaSistema` decimal(14,3) DEFAULT NULL,
  `cantidadBloqueadaSistema` decimal(14,3) DEFAULT NULL,
  `cantidadTotalSistema` decimal(14,3) DEFAULT NULL,
  `cantidadFisica` decimal(14,3) NOT NULL DEFAULT 0.000,
  `diferencia` decimal(14,3) NOT NULL DEFAULT 0.000,
  `conteoRealizado` tinyint(1) NOT NULL DEFAULT 0,
  `fechaConteo` datetime DEFAULT NULL,
  `idUsuarioCuenta` int(11) DEFAULT NULL,
  `idOperadorCuenta` int(10) UNSIGNED DEFAULT NULL,
  `tipoDiferencia` enum('PENDIENTE','SIN_DIFERENCIA','SOBRANTE','FALTANTE') DEFAULT NULL,
  `estadoAnalisis` enum('PENDIENTE','VALIDADO','OBSERVADO','AJUSTADO') DEFAULT NULL,
  `observacion` text DEFAULT NULL,
  `observacionAnalisis` text DEFAULT NULL,
  `idUsuarioAnaliza` int(11) DEFAULT NULL,
  `fechaAnalisis` datetime DEFAULT NULL,
  `cantidadAjuste` decimal(14,3) DEFAULT NULL,
  `idDocumentoDetalleAjuste` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `InventarioConteoHistorial`
--

CREATE TABLE `InventarioConteoHistorial` (
  `id` bigint(20) NOT NULL,
  `idOrdenConteo` int(11) DEFAULT NULL,
  `idSolicitudConteo` int(11) DEFAULT NULL,
  `idDetalleConteo` int(11) DEFAULT NULL,
  `accion` varchar(80) NOT NULL,
  `estadoAnterior` varchar(50) DEFAULT NULL,
  `estadoNuevo` varchar(50) DEFAULT NULL,
  `descripcion` text DEFAULT NULL,
  `datos` longtext DEFAULT NULL,
  `idUsuario` int(11) DEFAULT NULL,
  `idOperador` int(10) UNSIGNED DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `InventarioConteoResponsables`
--

CREATE TABLE `InventarioConteoResponsables` (
  `id` int(11) NOT NULL,
  `idSolicitudConteo` int(11) NOT NULL,
  `idOperador` int(10) UNSIGNED NOT NULL,
  `esPrincipal` tinyint(1) NOT NULL DEFAULT 0,
  `puedeFinalizar` tinyint(1) NOT NULL DEFAULT 0,
  `estado` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `InventarioDocumentoDetalle`
--

CREATE TABLE `InventarioDocumentoDetalle` (
  `id` int(11) NOT NULL,
  `idDocumento` int(11) NOT NULL,
  `idProducto` int(11) NOT NULL,
  `cantidadSolicitada` decimal(14,3) NOT NULL DEFAULT 0.000,
  `cantidadProcesada` decimal(14,3) NOT NULL DEFAULT 0.000,
  `unidad` varchar(50) NOT NULL DEFAULT 'UND',
  `observacion` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `InventarioDocumentoDetalleLotes`
--

CREATE TABLE `InventarioDocumentoDetalleLotes` (
  `id` int(11) NOT NULL,
  `idDocumentoDetalle` int(11) NOT NULL,
  `idLote` int(11) DEFAULT NULL,
  `idBodega` int(11) NOT NULL,
  `idUbicacion` int(11) DEFAULT NULL,
  `cantidad` decimal(14,3) NOT NULL DEFAULT 0.000,
  `observacion` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp()
) ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `InventarioDocumentos`
--

CREATE TABLE `InventarioDocumentos` (
  `id` int(11) NOT NULL,
  `idTipoDocumento` int(11) NOT NULL,
  `idUsuarioRegistro` int(11) DEFAULT NULL,
  `idOperador` int(10) UNSIGNED DEFAULT NULL,
  `consecutivo` varchar(80) NOT NULL,
  `fechaDocumento` date NOT NULL,
  `idResponsable` int(11) DEFAULT NULL,
  `idOperadorAsignado` int(11) DEFAULT NULL,
  `idEstado` int(11) DEFAULT NULL,
  `idDespachoInforme` int(11) DEFAULT NULL,
  `tipoOrigen` varchar(50) DEFAULT NULL,
  `observacion` text DEFAULT NULL,
  `estadoProceso` enum('BORRADOR','FINALIZADA','ANULADA') NOT NULL DEFAULT 'BORRADOR',
  `fechaFinalizacion` datetime DEFAULT NULL,
  `idUsuarioFinaliza` int(11) DEFAULT NULL,
  `idBodegaOrigen` int(11) DEFAULT NULL,
  `idUbicacionOrigen` int(11) DEFAULT NULL,
  `idBodegaDestino` int(11) DEFAULT NULL,
  `idUbicacionDestino` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `InventarioExistencias`
--

CREATE TABLE `InventarioExistencias` (
  `id` int(11) NOT NULL,
  `idProducto` int(11) NOT NULL,
  `idLote` int(11) DEFAULT NULL,
  `idBodega` int(11) NOT NULL,
  `idUbicacion` int(11) DEFAULT NULL,
  `cantidadDisponible` decimal(14,3) NOT NULL DEFAULT 0.000,
  `cantidadReservada` decimal(14,3) NOT NULL DEFAULT 0.000,
  `cantidadBloqueada` decimal(14,3) NOT NULL DEFAULT 0.000,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `InventarioLotes`
--

CREATE TABLE `InventarioLotes` (
  `id` int(11) NOT NULL,
  `idProducto` int(11) NOT NULL,
  `lote` varchar(120) NOT NULL,
  `fechaFabricacion` date DEFAULT NULL,
  `fechaVencimiento` date DEFAULT NULL,
  `fechaIngreso` date DEFAULT NULL,
  `observacion` text DEFAULT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `InventarioMovimientos`
--

CREATE TABLE `InventarioMovimientos` (
  `id` bigint(20) NOT NULL,
  `idDocumento` int(11) DEFAULT NULL,
  `idDocumentoDetalle` int(11) DEFAULT NULL,
  `idProducto` int(11) NOT NULL,
  `idLote` int(11) DEFAULT NULL,
  `idBodega` int(11) NOT NULL,
  `idUbicacion` int(11) DEFAULT NULL,
  `tipoMovimiento` varchar(60) NOT NULL,
  `cantidad` decimal(14,3) NOT NULL DEFAULT 0.000,
  `saldoAnterior` decimal(14,3) NOT NULL DEFAULT 0.000,
  `saldoNuevo` decimal(14,3) NOT NULL DEFAULT 0.000,
  `idUsuario` int(11) DEFAULT NULL,
  `fechaMovimiento` datetime NOT NULL DEFAULT current_timestamp(),
  `observacion` text DEFAULT NULL,
  `idUsuarioRegistro` int(11) DEFAULT NULL,
  `idOperador` int(10) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `InventarioOperadores`
--

CREATE TABLE `InventarioOperadores` (
  `id` int(10) UNSIGNED NOT NULL,
  `idUsuario` int(11) DEFAULT NULL,
  `codigo` varchar(50) DEFAULT NULL,
  `tipoDocumento` varchar(30) NOT NULL DEFAULT 'CC',
  `documento` varchar(50) NOT NULL,
  `nombre` varchar(120) NOT NULL,
  `apellido` varchar(120) DEFAULT NULL,
  `nombreCompleto` varchar(250) DEFAULT NULL,
  `telefono` varchar(50) DEFAULT NULL,
  `correo` varchar(150) DEFAULT NULL,
  `cargo` varchar(80) NOT NULL DEFAULT 'OPERADOR',
  `usuario` varchar(80) DEFAULT NULL,
  `clave` varchar(255) DEFAULT NULL,
  `observacion` text DEFAULT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `InventarioOrdenesConteo`
--

CREATE TABLE `InventarioOrdenesConteo` (
  `id` int(11) NOT NULL,
  `codigo` varchar(80) NOT NULL,
  `nombre` varchar(180) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `fechaCorte` datetime NOT NULL,
  `fechaInicio` datetime DEFAULT NULL,
  `fechaLimite` datetime DEFAULT NULL,
  `tipoConteo` enum('CIEGO','GUIADO') NOT NULL DEFAULT 'CIEGO',
  `estadoProceso` enum('BORRADOR','PROGRAMADA','ABIERTA','EN_CONTEO','EN_ANALISIS','FINALIZADA','ANULADA') NOT NULL DEFAULT 'BORRADOR',
  `mostrarResultadoBodegas` tinyint(1) NOT NULL DEFAULT 0,
  `fechaInicioAnalisis` datetime DEFAULT NULL,
  `fechaFinalizacionAnalisis` datetime DEFAULT NULL,
  `fechaPublicacionResultados` datetime DEFAULT NULL,
  `idUsuarioRegistro` int(11) DEFAULT NULL,
  `idUsuarioAnaliza` int(11) DEFAULT NULL,
  `idUsuarioFinaliza` int(11) DEFAULT NULL,
  `observacion` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `InventarioSolicitudesConteo`
--

CREATE TABLE `InventarioSolicitudesConteo` (
  `id` int(11) NOT NULL,
  `idOrdenConteo` int(11) DEFAULT NULL,
  `codigo` varchar(80) NOT NULL,
  `origenConteo` enum('ORDEN','EXTRAORDINARIO') DEFAULT NULL,
  `fechaSolicitud` date NOT NULL,
  `fechaCorteAplicada` datetime DEFAULT NULL,
  `fechaInicioConteo` datetime DEFAULT NULL,
  `fechaUltimoGuardado` datetime DEFAULT NULL,
  `fechaEnvio` datetime DEFAULT NULL,
  `fechaRevision` datetime DEFAULT NULL,
  `fechaFinalizacion` datetime DEFAULT NULL,
  `idResponsable` int(11) DEFAULT NULL,
  `idOperadorAsignado` int(11) DEFAULT NULL,
  `idBodega` int(11) DEFAULT NULL,
  `idEstado` int(11) DEFAULT NULL,
  `estadoProceso` enum('PENDIENTE','EN_PROCESO','ENVIADO','DEVUELTO','APROBADO','FINALIZADO','ANULADO') DEFAULT NULL,
  `observacion` text DEFAULT NULL,
  `observacionRevision` text DEFAULT NULL,
  `numeroRevision` int(11) NOT NULL DEFAULT 0,
  `resultadoVisible` tinyint(1) NOT NULL DEFAULT 0,
  `idDocumentoAjuste` int(11) DEFAULT NULL,
  `ajusteGenerado` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `idUsuarioRegistro` int(11) DEFAULT NULL,
  `idOperador` int(10) UNSIGNED DEFAULT NULL,
  `idUsuarioRevisa` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `JornadasDespacho`
--

CREATE TABLE `JornadasDespacho` (
  `id` int(11) NOT NULL,
  `fecha` date NOT NULL,
  `descripcion` varchar(150) DEFAULT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `idEstado` int(11) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `parametros`
--

CREATE TABLE `parametros` (
  `id` int(11) NOT NULL,
  `parametro` varchar(120) NOT NULL,
  `color` varchar(10) NOT NULL,
  `tipoParametro` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `ProductosCatalogo`
--

CREATE TABLE `ProductosCatalogo` (
  `id` int(11) NOT NULL,
  `codigo` varchar(30) NOT NULL,
  `descripcion` varchar(255) NOT NULL,
  `idGrupo` int(11) NOT NULL,
  `idEmbalaje` int(11) DEFAULT NULL,
  `observacion` varchar(255) DEFAULT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `idEstado` int(11) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `ProductosCodigosBarras`
--

CREATE TABLE `ProductosCodigosBarras` (
  `id` int(11) NOT NULL,
  `idProducto` int(11) NOT NULL,
  `codigoBarras` varchar(100) NOT NULL,
  `tipoCodigo` varchar(50) NOT NULL DEFAULT 'UNIDAD',
  `principal` tinyint(1) NOT NULL DEFAULT 0,
  `observacion` text DEFAULT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `ProductosInventarioConfig`
--

CREATE TABLE `ProductosInventarioConfig` (
  `id` int(11) NOT NULL,
  `idProducto` int(11) NOT NULL,
  `idTipoProductoInventario` int(11) DEFAULT NULL,
  `manejaLote` tinyint(1) NOT NULL DEFAULT 1,
  `manejaVencimiento` tinyint(1) NOT NULL DEFAULT 1,
  `stockMinimo` decimal(14,3) NOT NULL DEFAULT 0.000,
  `stockMaximo` decimal(14,3) DEFAULT NULL,
  `unidadBaseInventario` varchar(50) NOT NULL DEFAULT 'UND',
  `observacion` text DEFAULT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `RutasAgrupadas`
--

CREATE TABLE `RutasAgrupadas` (
  `id` int(11) NOT NULL,
  `codigo` varchar(50) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `estado` tinyint(4) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `RutasAgrupadasColegios`
--

CREATE TABLE `RutasAgrupadasColegios` (
  `id` int(11) NOT NULL,
  `idRutaAgrupada` int(11) NOT NULL,
  `codigoColegio` varchar(50) NOT NULL,
  `nombreColegio` varchar(255) DEFAULT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `estado` tinyint(4) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `RutasDespacho`
--

CREATE TABLE `RutasDespacho` (
  `id` int(11) NOT NULL,
  `idDespacho` int(11) NOT NULL,
  `idJornada` int(11) NOT NULL,
  `nombreRuta` varchar(100) NOT NULL,
  `ordenRuta` int(11) DEFAULT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `idEstado` int(11) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `SedesDespacho`
--

CREATE TABLE `SedesDespacho` (
  `id` int(11) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `codigo` varchar(50) DEFAULT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `TiposDocumentoInventario`
--

CREATE TABLE `TiposDocumentoInventario` (
  `id` int(11) NOT NULL,
  `codigo` varchar(60) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `naturaleza` enum('ENTRADA','SALIDA','TRASLADO','AJUSTE','INVENTARIO_INICIAL','NEUTRO') NOT NULL DEFAULT 'ENTRADA',
  `tipoMovimiento` varchar(40) NOT NULL DEFAULT 'ENTRADA',
  `afectaInventario` tinyint(1) NOT NULL DEFAULT 1,
  `requiereOrigen` tinyint(1) NOT NULL DEFAULT 0,
  `requiereDestino` tinyint(1) NOT NULL DEFAULT 0,
  `permiteManual` tinyint(1) NOT NULL DEFAULT 1,
  `permiteLoteVencido` tinyint(1) NOT NULL DEFAULT 0,
  `descripcion` text DEFAULT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `tiposParametros`
--

CREATE TABLE `tiposParametros` (
  `id` int(11) NOT NULL,
  `tipoParametro` varchar(120) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `TiposProductoInventario`
--

CREATE TABLE `TiposProductoInventario` (
  `id` int(11) NOT NULL,
  `codigo` varchar(50) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `manejaLote` tinyint(1) NOT NULL DEFAULT 1,
  `manejaVencimiento` tinyint(1) NOT NULL DEFAULT 1,
  `requiereFechaVencimiento` tinyint(1) NOT NULL DEFAULT 1,
  `requiereBodegaFria` tinyint(1) NOT NULL DEFAULT 0,
  `estado` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `UbicacionesInventario`
--

CREATE TABLE `UbicacionesInventario` (
  `id` int(11) NOT NULL,
  `idBodega` int(11) NOT NULL,
  `codigo` varchar(50) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios`
--

CREATE TABLE `usuarios` (
  `id` int(11) NOT NULL,
  `nombre` varchar(120) NOT NULL,
  `telefono` varchar(30) NOT NULL,
  `correo` varchar(120) NOT NULL,
  `rol` int(11) NOT NULL,
  `contrasena` varchar(500) NOT NULL,
  `estado` int(11) NOT NULL,
  `tokenSesion` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `BodegasInventario`
--
ALTER TABLE `BodegasInventario`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_bodega_codigo` (`codigo`),
  ADD KEY `idx_bodega_nombre` (`nombre`),
  ADD KEY `idx_bodega_estado` (`estado`);

--
-- Indices de la tabla `CargasExcelDespacho`
--
ALTER TABLE `CargasExcelDespacho`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_carga_jornada` (`idJornada`),
  ADD KEY `idx_cargas_excel_idDespacho` (`idDespacho`);

--
-- Indices de la tabla `CategoriasProducto`
--
ALTER TABLE `CategoriasProducto`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_categoria_nombre` (`nombre`),
  ADD KEY `fk_categoria_estado` (`idEstado`);

--
-- Indices de la tabla `ColegiosDespacho`
--
ALTER TABLE `ColegiosDespacho`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `DespachoArchivos`
--
ALTER TABLE `DespachoArchivos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_despacho_archivo_estado` (`idEstado`),
  ADD KEY `idx_despacho_archivos_hashArchivo` (`hashArchivo`),
  ADD KEY `idx_despacho_archivos_idDespacho_tipoArchivo` (`idDespacho`,`tipoArchivo`);

--
-- Indices de la tabla `DespachosInforme`
--
ALTER TABLE `DespachosInforme`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `codigo` (`codigo`),
  ADD KEY `fk_despacho_estado` (`idEstado`),
  ADD KEY `idx_despachos_informe_idJornada` (`idJornada`);

--
-- Indices de la tabla `DetalleRutaProducto`
--
ALTER TABLE `DetalleRutaProducto`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_detalle_archivo_ruta_colegio_producto_consecutivo` (`idDespachoArchivo`,`idRuta`,`idColegio`,`idProducto`,`consecutivo`),
  ADD KEY `idx_detalle_carga` (`idCarga`),
  ADD KEY `idx_detalle_ruta` (`idRuta`),
  ADD KEY `idx_detalle_sede` (`idSede`),
  ADD KEY `idx_detalle_producto` (`idProducto`),
  ADD KEY `idx_detalle_consecutivo` (`consecutivo`),
  ADD KEY `idx_detalle_ruta_producto_idDespacho` (`idDespacho`),
  ADD KEY `idx_detalle_ruta_producto_idDespachoArchivo` (`idDespachoArchivo`),
  ADD KEY `idx_detalle_ruta_producto_idCarga` (`idCarga`),
  ADD KEY `idx_detalle_ruta_producto_idRuta` (`idRuta`),
  ADD KEY `idx_detalle_ruta_producto_idSede` (`idSede`),
  ADD KEY `idx_detalle_ruta_producto_idProducto` (`idProducto`),
  ADD KEY `fk_detalle_ruta_producto_colegio` (`idColegio`);

--
-- Indices de la tabla `EmbalajeCatalogo`
--
ALTER TABLE `EmbalajeCatalogo`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_embalaje_producto_base` (`producto_base`),
  ADD KEY `idx_embalaje_presentacion` (`presentacion`);

--
-- Indices de la tabla `Estados`
--
ALTER TABLE `Estados`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_estado_codigo` (`codigo`);

--
-- Indices de la tabla `GruposProducto`
--
ALTER TABLE `GruposProducto`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_grupo_categoria` (`idCategoria`);

--
-- Indices de la tabla `InventarioConteoDetalle`
--
ALTER TABLE `InventarioConteoDetalle`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_inv_conteo_det_solicitud` (`idSolicitudConteo`),
  ADD KEY `idx_inv_conteo_det_producto` (`idProducto`),
  ADD KEY `idx_inv_conteo_det_lote` (`idLote`),
  ADD KEY `idx_inv_conteo_det_bodega` (`idBodega`),
  ADD KEY `fk_inv_conteo_det_ubicacion` (`idUbicacion`),
  ADD KEY `idx_inv_conteo_det_clave` (`idSolicitudConteo`,`idProducto`,`idLote`,`idBodega`,`idUbicacion`),
  ADD KEY `idx_inv_conteo_det_realizado` (`idSolicitudConteo`,`conteoRealizado`),
  ADD KEY `idx_inv_conteo_det_tipo_diferencia` (`tipoDiferencia`),
  ADD KEY `idx_inv_conteo_det_estado_analisis` (`estadoAnalisis`),
  ADD KEY `idx_inv_conteo_det_usuario_cuenta` (`idUsuarioCuenta`),
  ADD KEY `idx_inv_conteo_det_operador_cuenta` (`idOperadorCuenta`),
  ADD KEY `idx_inv_conteo_det_usuario_analiza` (`idUsuarioAnaliza`),
  ADD KEY `idx_inv_conteo_det_doc_det_ajuste` (`idDocumentoDetalleAjuste`);

--
-- Indices de la tabla `InventarioConteoHistorial`
--
ALTER TABLE `InventarioConteoHistorial`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_inv_conteo_hist_orden` (`idOrdenConteo`),
  ADD KEY `idx_inv_conteo_hist_solicitud` (`idSolicitudConteo`),
  ADD KEY `idx_inv_conteo_hist_detalle` (`idDetalleConteo`),
  ADD KEY `idx_inv_conteo_hist_accion` (`accion`),
  ADD KEY `idx_inv_conteo_hist_fecha` (`created_at`),
  ADD KEY `idx_inv_conteo_hist_usuario` (`idUsuario`),
  ADD KEY `idx_inv_conteo_hist_operador` (`idOperador`);

--
-- Indices de la tabla `InventarioConteoResponsables`
--
ALTER TABLE `InventarioConteoResponsables`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_inv_conteo_resp_solicitud_operador` (`idSolicitudConteo`,`idOperador`),
  ADD KEY `idx_inv_conteo_resp_solicitud` (`idSolicitudConteo`),
  ADD KEY `idx_inv_conteo_resp_operador` (`idOperador`),
  ADD KEY `idx_inv_conteo_resp_estado` (`estado`);

--
-- Indices de la tabla `InventarioDocumentoDetalle`
--
ALTER TABLE `InventarioDocumentoDetalle`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_inv_doc_det_documento` (`idDocumento`),
  ADD KEY `idx_inv_doc_det_producto` (`idProducto`);

--
-- Indices de la tabla `InventarioDocumentoDetalleLotes`
--
ALTER TABLE `InventarioDocumentoDetalleLotes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_inv_doc_det_lote_detalle` (`idDocumentoDetalle`),
  ADD KEY `idx_inv_doc_det_lote_lote` (`idLote`),
  ADD KEY `idx_inv_doc_det_lote_bodega` (`idBodega`),
  ADD KEY `idx_inv_doc_det_lote_ubicacion` (`idUbicacion`);

--
-- Indices de la tabla `InventarioDocumentos`
--
ALTER TABLE `InventarioDocumentos`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_inventario_documento_consecutivo` (`consecutivo`),
  ADD KEY `idx_inv_doc_tipo` (`idTipoDocumento`),
  ADD KEY `idx_inv_doc_fecha` (`fechaDocumento`),
  ADD KEY `idx_inv_doc_estado` (`idEstado`),
  ADD KEY `idx_inv_doc_responsable` (`idResponsable`),
  ADD KEY `idx_inv_doc_operador` (`idOperadorAsignado`),
  ADD KEY `idx_inv_doc_despacho` (`idDespachoInforme`),
  ADD KEY `idx_inv_doc_idResponsable` (`idResponsable`),
  ADD KEY `idx_inv_doc_idOperadorAsignado` (`idOperadorAsignado`),
  ADD KEY `idx_inv_doc_idUsuarioRegistro` (`idUsuarioRegistro`),
  ADD KEY `idx_inv_doc_idOperador` (`idOperador`),
  ADD KEY `idx_inv_doc_estadoProceso` (`estadoProceso`),
  ADD KEY `idx_inv_doc_fechaFinalizacion` (`fechaFinalizacion`);

--
-- Indices de la tabla `InventarioExistencias`
--
ALTER TABLE `InventarioExistencias`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_existencia_producto_lote_bodega_ubicacion` (`idProducto`,`idLote`,`idBodega`,`idUbicacion`),
  ADD KEY `idx_existencia_producto` (`idProducto`),
  ADD KEY `idx_existencia_lote` (`idLote`),
  ADD KEY `idx_existencia_bodega` (`idBodega`),
  ADD KEY `idx_existencia_ubicacion` (`idUbicacion`);

--
-- Indices de la tabla `InventarioLotes`
--
ALTER TABLE `InventarioLotes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_lote_producto` (`idProducto`,`lote`),
  ADD KEY `idx_lote_producto` (`idProducto`),
  ADD KEY `idx_lote_codigo` (`lote`),
  ADD KEY `idx_lote_vencimiento` (`fechaVencimiento`),
  ADD KEY `idx_lote_estado` (`estado`);

--
-- Indices de la tabla `InventarioMovimientos`
--
ALTER TABLE `InventarioMovimientos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_inv_mov_documento` (`idDocumento`),
  ADD KEY `idx_inv_mov_detalle` (`idDocumentoDetalle`),
  ADD KEY `idx_inv_mov_producto` (`idProducto`),
  ADD KEY `idx_inv_mov_lote` (`idLote`),
  ADD KEY `idx_inv_mov_bodega` (`idBodega`),
  ADD KEY `idx_inv_mov_fecha` (`fechaMovimiento`),
  ADD KEY `idx_inv_mov_tipo` (`tipoMovimiento`),
  ADD KEY `fk_inv_mov_ubicacion` (`idUbicacion`),
  ADD KEY `idx_inv_mov_idUsuarioRegistro` (`idUsuarioRegistro`),
  ADD KEY `idx_inv_mov_idOperador` (`idOperador`),
  ADD KEY `idx_movimientos_fecha` (`fechaMovimiento`,`id`),
  ADD KEY `idx_movimientos_producto_bodega_lote_ubicacion_fecha` (`idProducto`,`idBodega`,`idLote`,`idUbicacion`,`fechaMovimiento`,`id`),
  ADD KEY `idx_movimientos_documento` (`idDocumento`,`idDocumentoDetalle`),
  ADD KEY `idx_movimientos_tipo` (`tipoMovimiento`);

--
-- Indices de la tabla `InventarioOperadores`
--
ALTER TABLE `InventarioOperadores`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_inventario_operadores_documento` (`documento`),
  ADD UNIQUE KEY `uq_inventario_operadores_idUsuario` (`idUsuario`),
  ADD KEY `idx_inventario_operadores_codigo` (`codigo`),
  ADD KEY `idx_inventario_operadores_nombre` (`nombre`),
  ADD KEY `idx_inventario_operadores_cargo` (`cargo`),
  ADD KEY `idx_inventario_operadores_estado` (`estado`),
  ADD KEY `idx_inventario_operadores_usuario` (`usuario`),
  ADD KEY `idx_inventario_operadores_correo` (`correo`),
  ADD KEY `idx_inventario_operadores_idUsuario` (`idUsuario`);

--
-- Indices de la tabla `InventarioOrdenesConteo`
--
ALTER TABLE `InventarioOrdenesConteo`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_inv_orden_conteo_codigo` (`codigo`),
  ADD KEY `idx_inv_orden_conteo_estado` (`estadoProceso`),
  ADD KEY `idx_inv_orden_conteo_fecha_corte` (`fechaCorte`),
  ADD KEY `idx_inv_orden_conteo_fecha_limite` (`fechaLimite`),
  ADD KEY `idx_inv_orden_conteo_usuario_registro` (`idUsuarioRegistro`),
  ADD KEY `idx_inv_orden_conteo_usuario_analiza` (`idUsuarioAnaliza`),
  ADD KEY `idx_inv_orden_conteo_usuario_finaliza` (`idUsuarioFinaliza`);

--
-- Indices de la tabla `InventarioSolicitudesConteo`
--
ALTER TABLE `InventarioSolicitudesConteo`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_inv_conteo_codigo` (`codigo`),
  ADD UNIQUE KEY `uq_inv_sol_conteo_orden_bodega` (`idOrdenConteo`,`idBodega`),
  ADD KEY `idx_inv_conteo_fecha` (`fechaSolicitud`),
  ADD KEY `idx_inv_conteo_bodega` (`idBodega`),
  ADD KEY `idx_inv_conteo_estado` (`idEstado`),
  ADD KEY `idx_inv_sol_conteo_idResponsable` (`idResponsable`),
  ADD KEY `idx_inv_sol_conteo_idOperadorAsignado` (`idOperadorAsignado`),
  ADD KEY `idx_inv_sol_conteo_orden` (`idOrdenConteo`),
  ADD KEY `idx_inv_sol_conteo_estado_proceso` (`estadoProceso`),
  ADD KEY `idx_inv_sol_conteo_fecha_envio` (`fechaEnvio`),
  ADD KEY `idx_inv_sol_conteo_usuario_revisa` (`idUsuarioRevisa`),
  ADD KEY `idx_inv_sol_conteo_documento_ajuste` (`idDocumentoAjuste`);

--
-- Indices de la tabla `JornadasDespacho`
--
ALTER TABLE `JornadasDespacho`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_jornada_fecha` (`fecha`),
  ADD KEY `fk_jornada_estado` (`idEstado`);

--
-- Indices de la tabla `parametros`
--
ALTER TABLE `parametros`
  ADD PRIMARY KEY (`id`),
  ADD KEY `tipoParametro` (`tipoParametro`);

--
-- Indices de la tabla `ProductosCatalogo`
--
ALTER TABLE `ProductosCatalogo`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_producto_grupo` (`idGrupo`),
  ADD KEY `idx_producto_embalaje` (`idEmbalaje`),
  ADD KEY `idx_producto_descripcion` (`descripcion`),
  ADD KEY `fk_producto_estado` (`idEstado`);

--
-- Indices de la tabla `ProductosCodigosBarras`
--
ALTER TABLE `ProductosCodigosBarras`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_codigo_barras` (`codigoBarras`),
  ADD KEY `idx_codigos_barras_producto` (`idProducto`),
  ADD KEY `idx_codigos_barras_tipo` (`tipoCodigo`),
  ADD KEY `idx_codigos_barras_estado` (`estado`);

--
-- Indices de la tabla `ProductosInventarioConfig`
--
ALTER TABLE `ProductosInventarioConfig`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_producto_inv_config_producto` (`idProducto`),
  ADD KEY `idx_producto_inv_config_tipo` (`idTipoProductoInventario`),
  ADD KEY `idx_producto_inv_config_estado` (`estado`);

--
-- Indices de la tabla `RutasAgrupadas`
--
ALTER TABLE `RutasAgrupadas`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `RutasAgrupadasColegios`
--
ALTER TABLE `RutasAgrupadasColegios`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_rutaagrupada_codigo` (`idRutaAgrupada`,`codigoColegio`);

--
-- Indices de la tabla `RutasDespacho`
--
ALTER TABLE `RutasDespacho`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_despacho_jornada_nombreRuta` (`idDespacho`,`idJornada`,`nombreRuta`),
  ADD KEY `idx_ruta_jornada` (`idJornada`),
  ADD KEY `idx_ruta_nombre` (`nombreRuta`),
  ADD KEY `fk_ruta_estado` (`idEstado`),
  ADD KEY `idx_rutas_despacho_idDespacho_nombreRuta` (`idDespacho`,`nombreRuta`);

--
-- Indices de la tabla `SedesDespacho`
--
ALTER TABLE `SedesDespacho`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_sede_nombre` (`nombre`),
  ADD KEY `idx_sede_codigo` (`codigo`);

--
-- Indices de la tabla `TiposDocumentoInventario`
--
ALTER TABLE `TiposDocumentoInventario`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_tipo_documento_inv_codigo` (`codigo`),
  ADD KEY `idx_tipo_documento_inv_naturaleza` (`naturaleza`),
  ADD KEY `idx_tipo_documento_inv_estado` (`estado`),
  ADD KEY `idx_tipos_documento_codigo` (`codigo`),
  ADD KEY `idx_tipos_documento_naturaleza` (`naturaleza`),
  ADD KEY `idx_tipos_documento_estado` (`estado`);

--
-- Indices de la tabla `tiposParametros`
--
ALTER TABLE `tiposParametros`
  ADD PRIMARY KEY (`id`);

--
-- Indices de la tabla `TiposProductoInventario`
--
ALTER TABLE `TiposProductoInventario`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_tipo_producto_inv_codigo` (`codigo`),
  ADD KEY `idx_tipo_producto_inv_estado` (`estado`);

--
-- Indices de la tabla `UbicacionesInventario`
--
ALTER TABLE `UbicacionesInventario`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_ubicacion_bodega_codigo` (`idBodega`,`codigo`),
  ADD KEY `idx_ubicacion_bodega` (`idBodega`),
  ADD KEY `idx_ubicacion_estado` (`estado`);

--
-- Indices de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`id`),
  ADD KEY `rol` (`rol`),
  ADD KEY `estado` (`estado`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `BodegasInventario`
--
ALTER TABLE `BodegasInventario`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `CargasExcelDespacho`
--
ALTER TABLE `CargasExcelDespacho`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `CategoriasProducto`
--
ALTER TABLE `CategoriasProducto`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `ColegiosDespacho`
--
ALTER TABLE `ColegiosDespacho`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `DespachoArchivos`
--
ALTER TABLE `DespachoArchivos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `DespachosInforme`
--
ALTER TABLE `DespachosInforme`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `DetalleRutaProducto`
--
ALTER TABLE `DetalleRutaProducto`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `Estados`
--
ALTER TABLE `Estados`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `GruposProducto`
--
ALTER TABLE `GruposProducto`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `InventarioConteoDetalle`
--
ALTER TABLE `InventarioConteoDetalle`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `InventarioConteoHistorial`
--
ALTER TABLE `InventarioConteoHistorial`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `InventarioConteoResponsables`
--
ALTER TABLE `InventarioConteoResponsables`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `InventarioDocumentoDetalle`
--
ALTER TABLE `InventarioDocumentoDetalle`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `InventarioDocumentoDetalleLotes`
--
ALTER TABLE `InventarioDocumentoDetalleLotes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `InventarioDocumentos`
--
ALTER TABLE `InventarioDocumentos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `InventarioExistencias`
--
ALTER TABLE `InventarioExistencias`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `InventarioLotes`
--
ALTER TABLE `InventarioLotes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `InventarioMovimientos`
--
ALTER TABLE `InventarioMovimientos`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `InventarioOperadores`
--
ALTER TABLE `InventarioOperadores`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `InventarioOrdenesConteo`
--
ALTER TABLE `InventarioOrdenesConteo`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `InventarioSolicitudesConteo`
--
ALTER TABLE `InventarioSolicitudesConteo`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `JornadasDespacho`
--
ALTER TABLE `JornadasDespacho`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `parametros`
--
ALTER TABLE `parametros`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `ProductosCatalogo`
--
ALTER TABLE `ProductosCatalogo`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `ProductosCodigosBarras`
--
ALTER TABLE `ProductosCodigosBarras`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `ProductosInventarioConfig`
--
ALTER TABLE `ProductosInventarioConfig`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `RutasAgrupadas`
--
ALTER TABLE `RutasAgrupadas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `RutasAgrupadasColegios`
--
ALTER TABLE `RutasAgrupadasColegios`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `RutasDespacho`
--
ALTER TABLE `RutasDespacho`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `SedesDespacho`
--
ALTER TABLE `SedesDespacho`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `TiposDocumentoInventario`
--
ALTER TABLE `TiposDocumentoInventario`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `TiposProductoInventario`
--
ALTER TABLE `TiposProductoInventario`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `UbicacionesInventario`
--
ALTER TABLE `UbicacionesInventario`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `CargasExcelDespacho`
--
ALTER TABLE `CargasExcelDespacho`
  ADD CONSTRAINT `fk_carga_jornada` FOREIGN KEY (`idJornada`) REFERENCES `JornadasDespacho` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_cargas_excel_despacho` FOREIGN KEY (`idDespacho`) REFERENCES `DespachosInforme` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Filtros para la tabla `CategoriasProducto`
--
ALTER TABLE `CategoriasProducto`
  ADD CONSTRAINT `fk_categoria_estado` FOREIGN KEY (`idEstado`) REFERENCES `Estados` (`id`);

--
-- Filtros para la tabla `DespachoArchivos`
--
ALTER TABLE `DespachoArchivos`
  ADD CONSTRAINT `fk_despacho_archivo_despacho` FOREIGN KEY (`idDespacho`) REFERENCES `DespachosInforme` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_despacho_archivo_estado` FOREIGN KEY (`idEstado`) REFERENCES `Estados` (`id`) ON UPDATE CASCADE;

--
-- Filtros para la tabla `DespachosInforme`
--
ALTER TABLE `DespachosInforme`
  ADD CONSTRAINT `fk_despacho_estado` FOREIGN KEY (`idEstado`) REFERENCES `Estados` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_despachos_informe_jornada` FOREIGN KEY (`idJornada`) REFERENCES `JornadasDespacho` (`id`) ON UPDATE CASCADE;

--
-- Filtros para la tabla `DetalleRutaProducto`
--
ALTER TABLE `DetalleRutaProducto`
  ADD CONSTRAINT `fk_detalle_carga` FOREIGN KEY (`idCarga`) REFERENCES `CargasExcelDespacho` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_detalle_despacho` FOREIGN KEY (`idDespacho`) REFERENCES `DespachosInforme` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_detalle_despacho_archivo` FOREIGN KEY (`idDespachoArchivo`) REFERENCES `DespachoArchivos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_detalle_producto` FOREIGN KEY (`idProducto`) REFERENCES `ProductosCatalogo` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_detalle_ruta` FOREIGN KEY (`idRuta`) REFERENCES `RutasDespacho` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_detalle_ruta_producto_colegio` FOREIGN KEY (`idColegio`) REFERENCES `ColegiosDespacho` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_detalle_sede` FOREIGN KEY (`idSede`) REFERENCES `SedesDespacho` (`id`) ON UPDATE CASCADE;

--
-- Filtros para la tabla `InventarioConteoDetalle`
--
ALTER TABLE `InventarioConteoDetalle`
  ADD CONSTRAINT `fk_inv_conteo_det_bodega` FOREIGN KEY (`idBodega`) REFERENCES `BodegasInventario` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_conteo_det_doc_det_ajuste` FOREIGN KEY (`idDocumentoDetalleAjuste`) REFERENCES `InventarioDocumentoDetalle` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_conteo_det_lote` FOREIGN KEY (`idLote`) REFERENCES `InventarioLotes` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_conteo_det_operador_cuenta` FOREIGN KEY (`idOperadorCuenta`) REFERENCES `InventarioOperadores` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_conteo_det_producto` FOREIGN KEY (`idProducto`) REFERENCES `ProductosCatalogo` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_conteo_det_solicitud` FOREIGN KEY (`idSolicitudConteo`) REFERENCES `InventarioSolicitudesConteo` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_conteo_det_ubicacion` FOREIGN KEY (`idUbicacion`) REFERENCES `UbicacionesInventario` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_conteo_det_usuario_analiza` FOREIGN KEY (`idUsuarioAnaliza`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_conteo_det_usuario_cuenta` FOREIGN KEY (`idUsuarioCuenta`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Filtros para la tabla `InventarioConteoHistorial`
--
ALTER TABLE `InventarioConteoHistorial`
  ADD CONSTRAINT `fk_inv_conteo_hist_detalle` FOREIGN KEY (`idDetalleConteo`) REFERENCES `InventarioConteoDetalle` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_conteo_hist_operador` FOREIGN KEY (`idOperador`) REFERENCES `InventarioOperadores` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_conteo_hist_orden` FOREIGN KEY (`idOrdenConteo`) REFERENCES `InventarioOrdenesConteo` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_conteo_hist_solicitud` FOREIGN KEY (`idSolicitudConteo`) REFERENCES `InventarioSolicitudesConteo` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_conteo_hist_usuario` FOREIGN KEY (`idUsuario`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Filtros para la tabla `InventarioConteoResponsables`
--
ALTER TABLE `InventarioConteoResponsables`
  ADD CONSTRAINT `fk_inv_conteo_resp_operador` FOREIGN KEY (`idOperador`) REFERENCES `InventarioOperadores` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_conteo_resp_solicitud` FOREIGN KEY (`idSolicitudConteo`) REFERENCES `InventarioSolicitudesConteo` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Filtros para la tabla `InventarioDocumentoDetalle`
--
ALTER TABLE `InventarioDocumentoDetalle`
  ADD CONSTRAINT `fk_inv_doc_det_documento` FOREIGN KEY (`idDocumento`) REFERENCES `InventarioDocumentos` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_doc_det_producto` FOREIGN KEY (`idProducto`) REFERENCES `ProductosCatalogo` (`id`) ON UPDATE CASCADE;

--
-- Filtros para la tabla `InventarioDocumentoDetalleLotes`
--
ALTER TABLE `InventarioDocumentoDetalleLotes`
  ADD CONSTRAINT `fk_inv_doc_det_lote_bodega` FOREIGN KEY (`idBodega`) REFERENCES `BodegasInventario` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_doc_det_lote_detalle` FOREIGN KEY (`idDocumentoDetalle`) REFERENCES `InventarioDocumentoDetalle` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_doc_det_lote_lote` FOREIGN KEY (`idLote`) REFERENCES `InventarioLotes` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_doc_det_lote_ubicacion` FOREIGN KEY (`idUbicacion`) REFERENCES `UbicacionesInventario` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Filtros para la tabla `InventarioDocumentos`
--
ALTER TABLE `InventarioDocumentos`
  ADD CONSTRAINT `fk_inv_doc_despacho` FOREIGN KEY (`idDespachoInforme`) REFERENCES `DespachosInforme` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_doc_estado` FOREIGN KEY (`idEstado`) REFERENCES `Estados` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_doc_tipo` FOREIGN KEY (`idTipoDocumento`) REFERENCES `TiposDocumentoInventario` (`id`) ON UPDATE CASCADE;

--
-- Filtros para la tabla `InventarioExistencias`
--
ALTER TABLE `InventarioExistencias`
  ADD CONSTRAINT `fk_existencia_bodega` FOREIGN KEY (`idBodega`) REFERENCES `BodegasInventario` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_existencia_lote` FOREIGN KEY (`idLote`) REFERENCES `InventarioLotes` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_existencia_producto` FOREIGN KEY (`idProducto`) REFERENCES `ProductosCatalogo` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_existencia_ubicacion` FOREIGN KEY (`idUbicacion`) REFERENCES `UbicacionesInventario` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Filtros para la tabla `InventarioLotes`
--
ALTER TABLE `InventarioLotes`
  ADD CONSTRAINT `fk_lote_producto` FOREIGN KEY (`idProducto`) REFERENCES `ProductosCatalogo` (`id`) ON UPDATE CASCADE;

--
-- Filtros para la tabla `InventarioMovimientos`
--
ALTER TABLE `InventarioMovimientos`
  ADD CONSTRAINT `fk_inv_mov_bodega` FOREIGN KEY (`idBodega`) REFERENCES `BodegasInventario` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_mov_detalle` FOREIGN KEY (`idDocumentoDetalle`) REFERENCES `InventarioDocumentoDetalle` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_mov_documento` FOREIGN KEY (`idDocumento`) REFERENCES `InventarioDocumentos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_mov_lote` FOREIGN KEY (`idLote`) REFERENCES `InventarioLotes` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_mov_producto` FOREIGN KEY (`idProducto`) REFERENCES `ProductosCatalogo` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_mov_ubicacion` FOREIGN KEY (`idUbicacion`) REFERENCES `UbicacionesInventario` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Filtros para la tabla `InventarioOrdenesConteo`
--
ALTER TABLE `InventarioOrdenesConteo`
  ADD CONSTRAINT `fk_inv_orden_conteo_usuario_analiza` FOREIGN KEY (`idUsuarioAnaliza`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_orden_conteo_usuario_finaliza` FOREIGN KEY (`idUsuarioFinaliza`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_orden_conteo_usuario_registro` FOREIGN KEY (`idUsuarioRegistro`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Filtros para la tabla `InventarioSolicitudesConteo`
--
ALTER TABLE `InventarioSolicitudesConteo`
  ADD CONSTRAINT `fk_inv_conteo_bodega` FOREIGN KEY (`idBodega`) REFERENCES `BodegasInventario` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_conteo_estado` FOREIGN KEY (`idEstado`) REFERENCES `Estados` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_sol_conteo_documento_ajuste` FOREIGN KEY (`idDocumentoAjuste`) REFERENCES `InventarioDocumentos` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_sol_conteo_orden` FOREIGN KEY (`idOrdenConteo`) REFERENCES `InventarioOrdenesConteo` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_inv_sol_conteo_usuario_revisa` FOREIGN KEY (`idUsuarioRevisa`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Filtros para la tabla `ProductosCodigosBarras`
--
ALTER TABLE `ProductosCodigosBarras`
  ADD CONSTRAINT `fk_codigos_barras_producto` FOREIGN KEY (`idProducto`) REFERENCES `ProductosCatalogo` (`id`) ON UPDATE CASCADE;

--
-- Filtros para la tabla `ProductosInventarioConfig`
--
ALTER TABLE `ProductosInventarioConfig`
  ADD CONSTRAINT `fk_producto_inv_config_producto` FOREIGN KEY (`idProducto`) REFERENCES `ProductosCatalogo` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_producto_inv_config_tipo` FOREIGN KEY (`idTipoProductoInventario`) REFERENCES `TiposProductoInventario` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Filtros para la tabla `RutasAgrupadasColegios`
--
ALTER TABLE `RutasAgrupadasColegios`
  ADD CONSTRAINT `fk_ruta_agrupada_colegio` FOREIGN KEY (`idRutaAgrupada`) REFERENCES `RutasAgrupadas` (`id`);

--
-- Filtros para la tabla `UbicacionesInventario`
--
ALTER TABLE `UbicacionesInventario`
  ADD CONSTRAINT `fk_ubicacion_bodega` FOREIGN KEY (`idBodega`) REFERENCES `BodegasInventario` (`id`) ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
