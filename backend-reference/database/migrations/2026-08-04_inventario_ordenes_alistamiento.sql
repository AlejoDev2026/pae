-- Migracion: ordenes de alistamiento originadas en el consolidado de despachos.
-- Fecha: 2026-08-04
-- Motor objetivo: MariaDB 10.11 / InnoDB / utf8mb4.
--
-- Esta migracion no altera la carga Excel ni el flujo especial de Roldanillo.
-- Tampoco crea una bodega LOGISTICA: la entrega a Logistica se registra como
-- una salida real de inventario mediante el tipo documental SALIDA_LOGISTICA.
--
-- Reglas de cantidades:
--   * cantidadSolicitada: necesidad original del informe.
--   * cantidadReservada: reserva acumulada respaldada por filas de
--     InventarioOrdenesAlistamientoReservas e InventarioExistencias.
--   * cantidadAlistada: cantidad acumulada confirmada por el operador.
--   * cantidadExcedente: derivada de alistada - solicitada, nunca negativa.
--   * cantidadEnviada: cantidad acumulada entregada a Logistica.
-- El servicio debe actualizar cabecera, detalle, reservas, existencias,
-- movimientos e historial dentro de una unica transaccion y con FOR UPDATE.

-- -------------------------------------------------------------------------
-- Estados funcionales de la cabecera. Se reutiliza Estados por codigo.
-- -------------------------------------------------------------------------

INSERT INTO `Estados`
    (`codigo`, `nombre`, `descripcion`, `estado`, `created_at`, `updated_at`)
VALUES
    ('OA_ALIST_PENDIENTE_ASIGNAR', 'Pendiente de asignar', 'Orden de alistamiento generada y pendiente de operador.', 1, NOW(), NOW()),
    ('OA_ALIST_ASIGNADA', 'Asignada', 'Orden asignada a un operador y pendiente de inicio.', 1, NOW(), NOW()),
    ('OA_ALIST_EN_PROCESO', 'En alistamiento', 'El operador se encuentra registrando las cantidades alistadas.', 1, NOW(), NOW()),
    ('OA_ALIST_PARCIAL', 'Alistamiento parcial', 'El alistamiento fue cerrado temporalmente con cantidades pendientes.', 1, NOW(), NOW()),
    ('OA_ALIST_FINALIZADA', 'Alistamiento finalizado', 'El alistamiento fue finalizado por el operador.', 1, NOW(), NOW()),
    ('OA_ALIST_CANCELADA', 'Alistamiento cancelado', 'La orden de alistamiento fue cancelada y sus reservas deben estar liberadas.', 1, NOW(), NOW()),
    ('OA_LOG_PENDIENTE', 'Pendiente de Logistica', 'La orden aun no tiene cantidades enviadas a Logistica.', 1, NOW(), NOW()),
    ('OA_LOG_PARCIAL', 'Envio parcial a Logistica', 'Parte de las cantidades alistadas ya fue enviada a Logistica.', 1, NOW(), NOW()),
    ('OA_LOG_EN_LOGISTICA', 'En Logistica', 'Todas las cantidades definidas para entrega se encuentran en Logistica.', 1, NOW(), NOW()),
    ('OA_LOG_CANCELADA', 'Envio a Logistica cancelado', 'El flujo de entrega a Logistica fue cancelado.', 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE
    `nombre` = VALUES(`nombre`),
    `descripcion` = VALUES(`descripcion`),
    `estado` = 1,
    `updated_at` = NOW();

-- Tipo documental usado exclusivamente por los servicios de alistamiento.
-- permiteManual = 0 evita que aparezca como salida manual ordinaria.
INSERT INTO `TiposDocumentoInventario`
    (
        `codigo`,
        `nombre`,
        `naturaleza`,
        `tipoMovimiento`,
        `afectaInventario`,
        `requiereOrigen`,
        `requiereDestino`,
        `permiteManual`,
        `permiteLoteVencido`,
        `descripcion`,
        `estado`,
        `created_at`,
        `updated_at`
    )
VALUES
    (
        'SALIDA_LOGISTICA',
        'Salida hacia Logistica',
        'SALIDA',
        'SALIDA_LOGISTICA',
        1,
        1,
        0,
        0,
        0,
        'Salida generada desde una orden de alistamiento para entregar mercancia al area de Logistica.',
        1,
        NOW(),
        NOW()
    )
ON DUPLICATE KEY UPDATE
    `nombre` = VALUES(`nombre`),
    `naturaleza` = VALUES(`naturaleza`),
    `tipoMovimiento` = VALUES(`tipoMovimiento`),
    `afectaInventario` = VALUES(`afectaInventario`),
    `requiereOrigen` = VALUES(`requiereOrigen`),
    `requiereDestino` = VALUES(`requiereDestino`),
    `permiteManual` = VALUES(`permiteManual`),
    `permiteLoteVencido` = VALUES(`permiteLoteVencido`),
    `descripcion` = VALUES(`descripcion`),
    `estado` = 1,
    `updated_at` = NOW();

-- -------------------------------------------------------------------------
-- Cabecera de la orden.
-- Una sola orden por despacho + tipo de informe + alcance.
-- Los estados de alistamiento y Logistica evolucionan de forma independiente.
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `InventarioOrdenesAlistamiento` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `consecutivo` varchar(80) NOT NULL,
    `idDespachoInforme` int(11) NOT NULL,
    `tipoInforme` varchar(60) NOT NULL DEFAULT 'TOTAL_JORNADA_CONTRATO',
    `alcance` varchar(30) NOT NULL DEFAULT 'TODAS',
    `hashFuente` char(64) NOT NULL,
    `idEstadoAlistamiento` int(11) NOT NULL,
    `idEstadoLogistica` int(11) NOT NULL,
    `idOperadorAsignado` int(10) UNSIGNED DEFAULT NULL,
    `idUsuarioRegistro` int(11) DEFAULT NULL,
    `idUsuarioUltimaAsignacion` int(11) DEFAULT NULL,
    `fechaGeneracion` datetime NOT NULL DEFAULT current_timestamp(),
    `fechaUltimaAsignacion` datetime DEFAULT NULL,
    `fechaInicioAlistamiento` datetime DEFAULT NULL,
    `fechaFinalizacionAlistamiento` datetime DEFAULT NULL,
    `fechaPrimerEnvioLogistica` datetime DEFAULT NULL,
    `fechaUltimoEnvioLogistica` datetime DEFAULT NULL,
    `observacion` text DEFAULT NULL,
    `versionRegistro` int(10) UNSIGNED NOT NULL DEFAULT 1,
    `created_at` timestamp NULL DEFAULT current_timestamp(),
    `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_inv_oa_consecutivo` (`consecutivo`),
    UNIQUE KEY `uq_inv_oa_fuente` (`idDespachoInforme`, `tipoInforme`, `alcance`),
    KEY `idx_inv_oa_estado_alistamiento` (`idEstadoAlistamiento`),
    KEY `idx_inv_oa_estado_logistica` (`idEstadoLogistica`),
    KEY `idx_inv_oa_operador` (`idOperadorAsignado`),
    KEY `idx_inv_oa_fecha` (`fechaGeneracion`),
    KEY `idx_inv_oa_usuario_registro` (`idUsuarioRegistro`),
    KEY `idx_inv_oa_usuario_asigna` (`idUsuarioUltimaAsignacion`),
    CONSTRAINT `chk_inv_oa_fuente`
        CHECK (`tipoInforme` = 'TOTAL_JORNADA_CONTRATO' AND `alcance` = 'TODAS'),
    CONSTRAINT `fk_inv_oa_despacho`
        FOREIGN KEY (`idDespachoInforme`)
        REFERENCES `DespachosInforme` (`id`)
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_estado_alistamiento`
        FOREIGN KEY (`idEstadoAlistamiento`)
        REFERENCES `Estados` (`id`)
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_estado_logistica`
        FOREIGN KEY (`idEstadoLogistica`)
        REFERENCES `Estados` (`id`)
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_operador`
        FOREIGN KEY (`idOperadorAsignado`)
        REFERENCES `InventarioOperadores` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_usuario_registro`
        FOREIGN KEY (`idUsuarioRegistro`)
        REFERENCES `usuarios` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_usuario_asigna`
        FOREIGN KEY (`idUsuarioUltimaAsignacion`)
        REFERENCES `usuarios` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- Detalle consolidado y snapshot inmutable del informe que genero la orden.
-- cantidadReservada, cantidadAlistada y cantidadEnviada son acumulados y
-- deben coincidir con sus tablas de desglose al confirmar cada transaccion.
-- No se limita cantidadAlistada a cantidadSolicitada: el excedente es valido
-- siempre que cantidadAlistada no supere cantidadReservada.
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `InventarioOrdenesAlistamientoDetalle` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT,
    `idOrdenAlistamiento` int(11) NOT NULL,
    `idProducto` int(11) NOT NULL,
    `codigoProductoSnapshot` varchar(30) NOT NULL,
    `productoSnapshot` varchar(255) NOT NULL,
    `categoriaSnapshot` varchar(150) DEFAULT NULL,
    `unidadSnapshot` varchar(150) NOT NULL DEFAULT 'UND',
    `presentacionSnapshot` varchar(150) DEFAULT NULL,
    `embalajeSnapshot` varchar(255) DEFAULT NULL,
    `uniCajaSnapshot` decimal(14,3) DEFAULT NULL,
    `pacSolicitado` decimal(14,3) NOT NULL DEFAULT 0.000,
    `undSolicitado` decimal(14,3) NOT NULL DEFAULT 0.000,
    `cantidadSolicitada` decimal(14,3) NOT NULL,
    `cantidadReservada` decimal(14,3) NOT NULL DEFAULT 0.000,
    `cantidadAlistada` decimal(14,3) NOT NULL DEFAULT 0.000,
    `cantidadEnviada` decimal(14,3) NOT NULL DEFAULT 0.000,
    `cantidadPendiente` decimal(14,3)
        GENERATED ALWAYS AS (greatest(`cantidadSolicitada` - `cantidadAlistada`, 0)) STORED,
    `cantidadExcedente` decimal(14,3)
        GENERATED ALWAYS AS (greatest(`cantidadAlistada` - `cantidadSolicitada`, 0)) STORED,
    `observacion` text DEFAULT NULL,
    `created_at` timestamp NULL DEFAULT current_timestamp(),
    `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_inv_oa_det_producto` (`idOrdenAlistamiento`, `idProducto`),
    KEY `idx_inv_oa_det_producto` (`idProducto`),
    KEY `idx_inv_oa_det_pendiente` (`cantidadPendiente`),
    CONSTRAINT `chk_inv_oa_det_cantidades`
        CHECK (
            `cantidadSolicitada` > 0
            AND `cantidadReservada` >= 0
            AND `cantidadAlistada` >= 0
            AND `cantidadEnviada` >= 0
            AND `cantidadAlistada` <= `cantidadReservada`
            AND `cantidadEnviada` <= `cantidadAlistada`
        ),
    CONSTRAINT `fk_inv_oa_det_orden`
        FOREIGN KEY (`idOrdenAlistamiento`)
        REFERENCES `InventarioOrdenesAlistamiento` (`id`)
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_det_producto`
        FOREIGN KEY (`idProducto`)
        REFERENCES `ProductosCatalogo` (`id`)
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- Historial de asignaciones. La marca generada evita usar la llave foranea
-- idOrdenAlistamiento dentro de la expresion, por compatibilidad con versiones
-- de MariaDB que rechazan esa combinacion. El indice compuesto asegura una sola
-- asignacion activa por orden y permite conservar todas las cerradas.
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `InventarioOrdenesAlistamientoAsignaciones` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT,
    `idOrdenAlistamiento` int(11) NOT NULL,
    `idOperador` int(10) UNSIGNED NOT NULL,
    `idUsuarioAsigna` int(11) DEFAULT NULL,
    `estadoAsignacion` enum('ASIGNADA','EN_PROCESO','FINALIZADA','REASIGNADA','CANCELADA') NOT NULL DEFAULT 'ASIGNADA',
    `esAsignacionActiva` tinyint(1)
        GENERATED ALWAYS AS (
            CASE
                WHEN `estadoAsignacion` IN ('ASIGNADA', 'EN_PROCESO')
                THEN 1
                ELSE NULL
            END
        ) STORED,
    `fechaAsignacion` datetime NOT NULL DEFAULT current_timestamp(),
    `fechaInicio` datetime DEFAULT NULL,
    `fechaCierre` datetime DEFAULT NULL,
    `observacion` text DEFAULT NULL,
    `created_at` timestamp NULL DEFAULT current_timestamp(),
    `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_inv_oa_asignacion_activa` (`idOrdenAlistamiento`, `esAsignacionActiva`),
    KEY `idx_inv_oa_asig_orden` (`idOrdenAlistamiento`),
    KEY `idx_inv_oa_asig_operador` (`idOperador`),
    KEY `idx_inv_oa_asig_usuario` (`idUsuarioAsigna`),
    KEY `idx_inv_oa_asig_estado` (`estadoAsignacion`),
    CONSTRAINT `fk_inv_oa_asig_orden`
        FOREIGN KEY (`idOrdenAlistamiento`)
        REFERENCES `InventarioOrdenesAlistamiento` (`id`)
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_asig_operador`
        FOREIGN KEY (`idOperador`)
        REFERENCES `InventarioOperadores` (`id`)
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_asig_usuario`
        FOREIGN KEY (`idUsuarioAsigna`)
        REFERENCES `usuarios` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- Reserva por existencia real. Se repiten bodega/ubicacion/lote para dejar
-- una fotografia operativa y facilitar la pantalla de ubicacion del producto.
-- El servicio debe validar que estos campos coincidan con idExistencia.
-- Puede haber varias reservas sobre una misma existencia a lo largo del flujo.
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `InventarioOrdenesAlistamientoReservas` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT,
    `idDetalleOrden` bigint(20) NOT NULL,
    `idExistencia` int(11) NOT NULL,
    `idBodega` int(11) NOT NULL,
    `idUbicacion` int(11) DEFAULT NULL,
    `idLote` int(11) DEFAULT NULL,
    `cantidadReservada` decimal(14,3) NOT NULL,
    `cantidadAlistada` decimal(14,3) NOT NULL DEFAULT 0.000,
    `cantidadLiberada` decimal(14,3) NOT NULL DEFAULT 0.000,
    `cantidadEnviada` decimal(14,3) NOT NULL DEFAULT 0.000,
    `saldoReserva` decimal(14,3)
        GENERATED ALWAYS AS (`cantidadReservada` - `cantidadLiberada` - `cantidadEnviada`) STORED,
    `estadoReserva` enum('RESERVADA','ALISTAMIENTO_PARCIAL','ALISTADA','LIBERADA','EN_LOGISTICA','CANCELADA') NOT NULL DEFAULT 'RESERVADA',
    `idUsuarioReserva` int(11) DEFAULT NULL,
    `idUsuarioActualiza` int(11) DEFAULT NULL,
    `versionRegistro` int(10) UNSIGNED NOT NULL DEFAULT 1,
    `observacion` text DEFAULT NULL,
    `created_at` timestamp NULL DEFAULT current_timestamp(),
    `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (`id`),
    KEY `idx_inv_oa_res_detalle` (`idDetalleOrden`),
    KEY `idx_inv_oa_res_existencia` (`idExistencia`),
    KEY `idx_inv_oa_res_posicion` (`idBodega`, `idUbicacion`, `idLote`),
    KEY `idx_inv_oa_res_estado` (`estadoReserva`),
    KEY `idx_inv_oa_res_usuario_reserva` (`idUsuarioReserva`),
    KEY `idx_inv_oa_res_usuario_actualiza` (`idUsuarioActualiza`),
    CONSTRAINT `chk_inv_oa_res_cantidades`
        CHECK (
            `cantidadReservada` > 0
            AND `cantidadAlistada` >= 0
            AND `cantidadLiberada` >= 0
            AND `cantidadEnviada` >= 0
            AND `cantidadAlistada` + `cantidadLiberada` <= `cantidadReservada`
            AND `cantidadEnviada` <= `cantidadAlistada`
            AND `cantidadEnviada` + `cantidadLiberada` <= `cantidadReservada`
        ),
    CONSTRAINT `fk_inv_oa_res_detalle`
        FOREIGN KEY (`idDetalleOrden`)
        REFERENCES `InventarioOrdenesAlistamientoDetalle` (`id`)
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_res_existencia`
        FOREIGN KEY (`idExistencia`)
        REFERENCES `InventarioExistencias` (`id`)
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_res_bodega`
        FOREIGN KEY (`idBodega`)
        REFERENCES `BodegasInventario` (`id`)
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_res_ubicacion`
        FOREIGN KEY (`idUbicacion`)
        REFERENCES `UbicacionesInventario` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_res_lote`
        FOREIGN KEY (`idLote`)
        REFERENCES `InventarioLotes` (`id`)
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_res_usuario_reserva`
        FOREIGN KEY (`idUsuarioReserva`)
        REFERENCES `usuarios` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_res_usuario_actualiza`
        FOREIGN KEY (`idUsuarioActualiza`)
        REFERENCES `usuarios` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- Cada envio corresponde a un documento SALIDA_LOGISTICA finalizado.
-- Se genera un envio/documento por bodega origen; una orden puede tener
-- multiples envios parciales y usar tantas bodegas como sea necesario.
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `InventarioOrdenesAlistamientoEnvios` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT,
    `consecutivo` varchar(80) NOT NULL,
    `idOrdenAlistamiento` int(11) NOT NULL,
    `idDocumentoInventario` int(11) NOT NULL,
    `idBodegaOrigen` int(11) NOT NULL,
    `estadoEnvio` enum('BORRADOR','EN_LOGISTICA','ANULADO') NOT NULL DEFAULT 'BORRADOR',
    `cantidadTotal` decimal(14,3) NOT NULL DEFAULT 0.000,
    `idUsuarioGenera` int(11) DEFAULT NULL,
    `fechaGeneracion` datetime NOT NULL DEFAULT current_timestamp(),
    `fechaEnvioLogistica` datetime DEFAULT NULL,
    `observacion` text DEFAULT NULL,
    `created_at` timestamp NULL DEFAULT current_timestamp(),
    `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_inv_oa_envio_consecutivo` (`consecutivo`),
    UNIQUE KEY `uq_inv_oa_envio_documento` (`idDocumentoInventario`),
    KEY `idx_inv_oa_envio_orden` (`idOrdenAlistamiento`),
    KEY `idx_inv_oa_envio_bodega` (`idBodegaOrigen`),
    KEY `idx_inv_oa_envio_estado` (`estadoEnvio`),
    KEY `idx_inv_oa_envio_usuario` (`idUsuarioGenera`),
    CONSTRAINT `chk_inv_oa_envio_cantidad`
        CHECK (`cantidadTotal` >= 0),
    CONSTRAINT `fk_inv_oa_envio_orden`
        FOREIGN KEY (`idOrdenAlistamiento`)
        REFERENCES `InventarioOrdenesAlistamiento` (`id`)
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_envio_documento`
        FOREIGN KEY (`idDocumentoInventario`)
        REFERENCES `InventarioDocumentos` (`id`)
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_envio_bodega`
        FOREIGN KEY (`idBodegaOrigen`)
        REFERENCES `BodegasInventario` (`id`)
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_envio_usuario`
        FOREIGN KEY (`idUsuarioGenera`)
        REFERENCES `usuarios` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `InventarioOrdenesAlistamientoEnvioDetalle` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT,
    `idEnvio` bigint(20) NOT NULL,
    `idDetalleOrden` bigint(20) NOT NULL,
    `idReservaAlistamiento` bigint(20) NOT NULL,
    `idDocumentoDetalle` int(11) NOT NULL,
    `idDocumentoDetalleLote` int(11) NOT NULL,
    `cantidadEnviada` decimal(14,3) NOT NULL,
    `created_at` timestamp NULL DEFAULT current_timestamp(),
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_inv_oa_env_det_reserva_lote` (`idEnvio`, `idReservaAlistamiento`, `idDocumentoDetalleLote`),
    KEY `idx_inv_oa_env_det_detalle` (`idDetalleOrden`),
    KEY `idx_inv_oa_env_det_reserva` (`idReservaAlistamiento`),
    KEY `idx_inv_oa_env_det_doc_det` (`idDocumentoDetalle`),
    KEY `idx_inv_oa_env_det_doc_lote` (`idDocumentoDetalleLote`),
    CONSTRAINT `chk_inv_oa_env_det_cantidad`
        CHECK (`cantidadEnviada` > 0),
    CONSTRAINT `fk_inv_oa_env_det_envio`
        FOREIGN KEY (`idEnvio`)
        REFERENCES `InventarioOrdenesAlistamientoEnvios` (`id`)
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_env_det_detalle`
        FOREIGN KEY (`idDetalleOrden`)
        REFERENCES `InventarioOrdenesAlistamientoDetalle` (`id`)
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_env_det_reserva`
        FOREIGN KEY (`idReservaAlistamiento`)
        REFERENCES `InventarioOrdenesAlistamientoReservas` (`id`)
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_env_det_doc_det`
        FOREIGN KEY (`idDocumentoDetalle`)
        REFERENCES `InventarioDocumentoDetalle` (`id`)
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_env_det_doc_lote`
        FOREIGN KEY (`idDocumentoDetalleLote`)
        REFERENCES `InventarioDocumentoDetalleLotes` (`id`)
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -------------------------------------------------------------------------
-- Auditoria funcional append-only. Los servicios no deben actualizar ni
-- eliminar eventos ya registrados.
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `InventarioOrdenesAlistamientoHistorial` (
    `id` bigint(20) NOT NULL AUTO_INCREMENT,
    `idOrdenAlistamiento` int(11) NOT NULL,
    `idDetalleOrden` bigint(20) DEFAULT NULL,
    `idAsignacion` bigint(20) DEFAULT NULL,
    `idReservaAlistamiento` bigint(20) DEFAULT NULL,
    `idEnvio` bigint(20) DEFAULT NULL,
    `idMovimientoInventario` bigint(20) DEFAULT NULL,
    `evento` varchar(60) NOT NULL,
    `idEstadoAlistamientoAnterior` int(11) DEFAULT NULL,
    `idEstadoAlistamientoNuevo` int(11) DEFAULT NULL,
    `idEstadoLogisticaAnterior` int(11) DEFAULT NULL,
    `idEstadoLogisticaNuevo` int(11) DEFAULT NULL,
    `cantidad` decimal(14,3) DEFAULT NULL,
    `idUsuario` int(11) DEFAULT NULL,
    `idOperador` int(10) UNSIGNED DEFAULT NULL,
    `observacion` text DEFAULT NULL,
    `datos` longtext DEFAULT NULL,
    `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (`id`),
    KEY `idx_inv_oa_hist_orden_fecha` (`idOrdenAlistamiento`, `created_at`),
    KEY `idx_inv_oa_hist_evento` (`evento`),
    KEY `idx_inv_oa_hist_detalle` (`idDetalleOrden`),
    KEY `idx_inv_oa_hist_asignacion` (`idAsignacion`),
    KEY `idx_inv_oa_hist_reserva` (`idReservaAlistamiento`),
    KEY `idx_inv_oa_hist_envio` (`idEnvio`),
    KEY `idx_inv_oa_hist_movimiento` (`idMovimientoInventario`),
    KEY `idx_inv_oa_hist_usuario` (`idUsuario`),
    KEY `idx_inv_oa_hist_operador` (`idOperador`),
    CONSTRAINT `fk_inv_oa_hist_orden`
        FOREIGN KEY (`idOrdenAlistamiento`)
        REFERENCES `InventarioOrdenesAlistamiento` (`id`)
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_hist_detalle`
        FOREIGN KEY (`idDetalleOrden`)
        REFERENCES `InventarioOrdenesAlistamientoDetalle` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_hist_asignacion`
        FOREIGN KEY (`idAsignacion`)
        REFERENCES `InventarioOrdenesAlistamientoAsignaciones` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_hist_reserva`
        FOREIGN KEY (`idReservaAlistamiento`)
        REFERENCES `InventarioOrdenesAlistamientoReservas` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_hist_envio`
        FOREIGN KEY (`idEnvio`)
        REFERENCES `InventarioOrdenesAlistamientoEnvios` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_hist_movimiento`
        FOREIGN KEY (`idMovimientoInventario`)
        REFERENCES `InventarioMovimientos` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_hist_estado_alist_anterior`
        FOREIGN KEY (`idEstadoAlistamientoAnterior`)
        REFERENCES `Estados` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_hist_estado_alist_nuevo`
        FOREIGN KEY (`idEstadoAlistamientoNuevo`)
        REFERENCES `Estados` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_hist_estado_log_anterior`
        FOREIGN KEY (`idEstadoLogisticaAnterior`)
        REFERENCES `Estados` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_hist_estado_log_nuevo`
        FOREIGN KEY (`idEstadoLogisticaNuevo`)
        REFERENCES `Estados` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_hist_usuario`
        FOREIGN KEY (`idUsuario`)
        REFERENCES `usuarios` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
    CONSTRAINT `fk_inv_oa_hist_operador`
        FOREIGN KEY (`idOperador`)
        REFERENCES `InventarioOperadores` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
