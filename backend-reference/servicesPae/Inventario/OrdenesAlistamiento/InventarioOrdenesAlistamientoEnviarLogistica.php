<?php
declare(strict_types=1);

require_once __DIR__ . '/InventarioOrdenesAlistamientoHelper.php';

try {
    oa_validar_metodo('POST');
    $usuario = oa_usuario_autenticado();
    oa_requerir_admin($usuario);
    $entrada = oa_json();
    $idOrden = (int)($entrada['idOrdenAlistamiento'] ?? $entrada['idOrden'] ?? 0);
    $idBodegaFiltro = (int)($entrada['idBodegaOrigen'] ?? 0);
    $versionEsperada = (int)($entrada['versionRegistro'] ?? 0);
    $observacion = oa_limpiar($entrada['observacion'] ?? '');
    if ($idOrden <= 0) oa_lanzar('La orden de alistamiento es obligatoria', 422, 'orden_requerida');
    if ($versionEsperada <= 0) oa_lanzar('Debe recargar la orden antes de enviarla a Logistica', 422, 'version_registro_requerida');

    $tipoDocumento = oa_fila(
        "SELECT id, codigo, nombre, naturaleza, tipoMovimiento, afectaInventario,
                permiteLoteVencido, estado
         FROM TiposDocumentoInventario
         WHERE codigo = 'SALIDA_LOGISTICA' AND estado = 1
         LIMIT 1"
    );
    if (!$tipoDocumento || strtoupper((string)$tipoDocumento['naturaleza']) !== 'SALIDA'
        || (int)$tipoDocumento['afectaInventario'] !== 1) {
        oa_lanzar('No esta configurado el tipo documental SALIDA_LOGISTICA', 409, 'tipo_documento_logistica_no_configurado');
    }
    $estadoLogParcial = oa_estado('OA_LOG_PARCIAL');
    $estadoEnLogistica = oa_estado('OA_LOG_EN_LOGISTICA');

    oa_iniciar_transaccion();
    $orden = oa_orden_base($idOrden, true);
    if (!$orden) oa_lanzar('La orden de alistamiento no existe', 404, 'orden_no_encontrada');
    if ((int)$orden['versionRegistro'] !== $versionEsperada) {
        oa_lanzar('La orden fue actualizada por otro usuario', 409, 'version_registro_desactualizada', [
            'versionRegistro' => (int)$orden['versionRegistro']
        ]);
    }
    if (!in_array((string)$orden['estadoAlistamientoCodigo'], ['OA_ALIST_PARCIAL', 'OA_ALIST_FINALIZADA'], true)) {
        oa_lanzar('La orden debe estar finalizada para enviarla a Logistica', 409, 'estado_orden_no_admite_envio');
    }

    $sqlReservas = "SELECT
            r.*, d.idOrdenAlistamiento, d.idProducto, d.unidadSnapshot,
            d.productoSnapshot, d.codigoProductoSnapshot,
            ex.idProducto AS idProductoExistencia,
            ex.idBodega AS idBodegaExistencia,
            ex.idUbicacion AS idUbicacionExistencia,
            ex.idLote AS idLoteExistencia,
            pc.id AS idProductoCatalogo,
            pc.estado AS estadoProductoCatalogo,
            pc.idEstado AS idEstadoProductoCatalogo,
            pic.id AS idConfigInventario,
            pic.estado AS estadoConfigInventario,
            pic.manejaLote,
            pic.manejaVencimiento,
            b.estado AS estadoBodega,
            u.id AS idUbicacionCatalogo,
            u.idBodega AS idBodegaUbicacion,
            u.estado AS estadoUbicacion,
            l.id AS idLoteCatalogo,
            l.idProducto AS idProductoLote,
            l.lote AS codigoLote,
            l.fechaVencimiento,
            l.estado AS estadoLote
         FROM InventarioOrdenesAlistamientoReservas r
         INNER JOIN InventarioOrdenesAlistamientoDetalle d ON d.id = r.idDetalleOrden
         INNER JOIN InventarioExistencias ex ON ex.id = r.idExistencia
         LEFT JOIN ProductosCatalogo pc ON pc.id = d.idProducto
         LEFT JOIN ProductosInventarioConfig pic ON pic.idProducto = d.idProducto
         LEFT JOIN BodegasInventario b ON b.id = r.idBodega
         LEFT JOIN UbicacionesInventario u ON u.id = r.idUbicacion
         LEFT JOIN InventarioLotes l ON l.id = r.idLote
         WHERE d.idOrdenAlistamiento = ?
           AND r.cantidadAlistada > r.cantidadEnviada";
    $tiposReservas = 'i';
    $valoresReservas = [$idOrden];
    if ($idBodegaFiltro > 0) {
        $sqlReservas .= ' AND r.idBodega = ?';
        $tiposReservas .= 'i';
        $valoresReservas[] = $idBodegaFiltro;
    }
    $sqlReservas .= ' ORDER BY r.idBodega, d.idProducto, r.id FOR UPDATE';
    $reservas = oa_consultar($sqlReservas, $tiposReservas, $valoresReservas);
    if (!$reservas) {
        oa_lanzar('No hay cantidades alistadas pendientes de enviar a Logistica', 409, 'orden_sin_cantidades_por_enviar');
    }

    $porBodega = [];
    foreach ($reservas as $reserva) {
        if ((int)$reserva['idProducto'] !== (int)$reserva['idProductoExistencia']
            || (int)$reserva['idBodega'] !== (int)$reserva['idBodegaExistencia']
            || (int)($reserva['idUbicacion'] ?? 0) !== (int)($reserva['idUbicacionExistencia'] ?? 0)
            || (int)($reserva['idLote'] ?? 0) !== (int)($reserva['idLoteExistencia'] ?? 0)) {
            oa_lanzar('Una reserva no coincide con su existencia de inventario', 409, 'reserva_existencia_inconsistente', [
                'idReserva' => (int)$reserva['id']
            ]);
        }
        if ($reserva['idProductoCatalogo'] === null
            || (int)$reserva['estadoProductoCatalogo'] !== 1
            || (int)($reserva['idEstadoProductoCatalogo'] ?? 1) !== 1
            || $reserva['idConfigInventario'] === null
            || (int)$reserva['estadoConfigInventario'] !== 1) {
            oa_lanzar(
                'Un producto ya no esta activo o configurado para inventario',
                409,
                'producto_inventario_no_habilitado',
                ['idProducto' => (int)$reserva['idProducto']]
            );
        }
        if ((int)($reserva['estadoBodega'] ?? 0) !== 1) {
            oa_lanzar(
                'Una bodega origen ya no se encuentra activa',
                409,
                'bodega_origen_no_habilitada',
                ['idBodega' => (int)$reserva['idBodega']]
            );
        }
        if ($reserva['idUbicacion'] !== null
            && ($reserva['idUbicacionCatalogo'] === null
                || (int)$reserva['estadoUbicacion'] !== 1
                || (int)$reserva['idBodegaUbicacion'] !== (int)$reserva['idBodega'])) {
            oa_lanzar(
                'Una ubicacion ya no esta activa o no pertenece a la bodega reservada',
                409,
                'ubicacion_origen_no_habilitada',
                ['idUbicacion' => (int)$reserva['idUbicacion']]
            );
        }

        $manejaLote = (int)$reserva['manejaLote'] === 1;
        $manejaVencimiento = (int)$reserva['manejaVencimiento'] === 1;
        if ($manejaLote && $reserva['idLote'] === null) {
            oa_lanzar(
                'Un producto requiere lote para salir hacia Logistica',
                409,
                'lote_requerido',
                ['idProducto' => (int)$reserva['idProducto']]
            );
        }
        if ($reserva['idLote'] !== null
            && ($reserva['idLoteCatalogo'] === null
                || (int)$reserva['estadoLote'] !== 1
                || (int)$reserva['idProductoLote'] !== (int)$reserva['idProducto'])) {
            oa_lanzar(
                'Un lote ya no esta activo o no pertenece al producto reservado',
                409,
                'lote_no_habilitado',
                ['idLote' => (int)$reserva['idLote']]
            );
        }
        $fechaVencimiento = substr((string)($reserva['fechaVencimiento'] ?? ''), 0, 10);
        if ($manejaVencimiento
            && (int)($tipoDocumento['permiteLoteVencido'] ?? 0) !== 1
            && $fechaVencimiento !== ''
            && $fechaVencimiento !== '0000-00-00'
            && $fechaVencimiento < date('Y-m-d')) {
            oa_lanzar(
                'Un lote reservado esta vencido y no puede salir hacia Logistica',
                409,
                'lote_vencido_no_permitido',
                [
                    'idLote' => (int)$reserva['idLote'],
                    'lote' => $reserva['codigoLote'],
                    'fechaVencimiento' => $fechaVencimiento
                ]
            );
        }
        $cantidadEnviar = oa_decimal($reserva['cantidadAlistada']) - oa_decimal($reserva['cantidadEnviada']);
        if ($cantidadEnviar <= 0) continue;
        $saldoReserva = oa_decimal(
            oa_decimal($reserva['cantidadReservada'])
            - oa_decimal($reserva['cantidadLiberada'])
            - oa_decimal($reserva['cantidadEnviada'])
        );
        if ($cantidadEnviar > $saldoReserva + 0.0001) {
            oa_lanzar('La cantidad por enviar supera el saldo fisico de la reserva', 409, 'reserva_inventario_inconsistente', [
                'idReserva' => (int)$reserva['id'],
                'cantidadPorEnviar' => $cantidadEnviar,
                'saldoReserva' => $saldoReserva
            ]);
        }
        $reserva['cantidadEnviar'] = oa_decimal($cantidadEnviar);
        $idBodega = (int)$reserva['idBodega'];
        if (!isset($porBodega[$idBodega])) {
            $porBodega[$idBodega] = ['cantidad' => 0.0, 'reservas' => []];
        }
        $porBodega[$idBodega]['cantidad'] = oa_decimal($porBodega[$idBodega]['cantidad'] + $cantidadEnviar);
        $porBodega[$idBodega]['reservas'][] = $reserva;
    }
    if (!$porBodega) oa_lanzar('No hay cantidades pendientes de enviar', 409, 'orden_sin_cantidades_por_enviar');

    $idOperadorDocumento = !empty($orden['idOperadorAsignado']) ? (int)$orden['idOperadorAsignado'] : null;
    $enviosCreados = [];
    $totalEnviado = 0.0;

    foreach ($porBodega as $idBodega => $grupoBodega) {
        $consecutivoDocumento = oa_consecutivo('SAL-LOG');
        $insertDocumento = oa_ejecutar(
            "INSERT INTO InventarioDocumentos
            (idTipoDocumento, idUsuarioRegistro, idOperador, consecutivo,
             fechaDocumento, idResponsable, idOperadorAsignado, idEstado,
             idDespachoInforme, tipoOrigen, observacion, estadoProceso,
             fechaFinalizacion, idUsuarioFinaliza, idBodegaOrigen,
             created_at, updated_at)
            VALUES (?, ?, ?, ?, CURDATE(), ?, ?, 1, ?, 'ORDEN_ALISTAMIENTO', ?,
                    'FINALIZADA', NOW(), ?, ?, NOW(), NOW())",
            'iiisiiisii',
            [
                (int)$tipoDocumento['id'],
                (int)$usuario['id'],
                $idOperadorDocumento,
                $consecutivoDocumento,
                (int)$usuario['id'],
                $idOperadorDocumento,
                (int)$orden['idDespachoInforme'],
                $observacion !== '' ? $observacion : 'Salida generada desde orden de alistamiento ' . $orden['consecutivo'],
                (int)$usuario['id'],
                (int)$idBodega
            ]
        );
        $idDocumento = (int)$insertDocumento['insert_id'];
        $consecutivoEnvio = oa_consecutivo('ENV-LOG');
        $insertEnvio = oa_ejecutar(
            "INSERT INTO InventarioOrdenesAlistamientoEnvios
            (consecutivo, idOrdenAlistamiento, idDocumentoInventario,
             idBodegaOrigen, estadoEnvio, cantidadTotal, idUsuarioGenera,
             fechaGeneracion, fechaEnvioLogistica, observacion, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'EN_LOGISTICA', ?, ?, NOW(), NOW(), ?, NOW(), NOW())",
            'siiidis',
            [
                $consecutivoEnvio,
                $idOrden,
                $idDocumento,
                (int)$idBodega,
                (float)$grupoBodega['cantidad'],
                (int)$usuario['id'],
                $observacion !== '' ? $observacion : null
            ]
        );
        $idEnvio = (int)$insertEnvio['insert_id'];

        $porDetalle = [];
        foreach ($grupoBodega['reservas'] as $reserva) {
            $idDetalle = (int)$reserva['idDetalleOrden'];
            if (!isset($porDetalle[$idDetalle])) {
                $porDetalle[$idDetalle] = [
                    'idProducto' => (int)$reserva['idProducto'],
                    'unidad' => substr(oa_limpiar($reserva['unidadSnapshot']) ?: 'UND', 0, 50),
                    'cantidad' => 0.0,
                    'reservas' => []
                ];
            }
            $porDetalle[$idDetalle]['cantidad'] = oa_decimal(
                $porDetalle[$idDetalle]['cantidad'] + (float)$reserva['cantidadEnviar']
            );
            $porDetalle[$idDetalle]['reservas'][] = $reserva;
        }

        foreach ($porDetalle as $idDetalle => $grupoDetalle) {
            $insertDocumentoDetalle = oa_ejecutar(
                "INSERT INTO InventarioDocumentoDetalle
                (idDocumento, idProducto, cantidadSolicitada, cantidadProcesada,
                 unidad, observacion, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())",
                'iiddss',
                [
                    $idDocumento,
                    (int)$grupoDetalle['idProducto'],
                    (float)$grupoDetalle['cantidad'],
                    (float)$grupoDetalle['cantidad'],
                    (string)$grupoDetalle['unidad'],
                    $observacion !== '' ? $observacion : null
                ]
            );
            $idDocumentoDetalle = (int)$insertDocumentoDetalle['insert_id'];

            foreach ($grupoDetalle['reservas'] as $reserva) {
                $cantidad = (float)$reserva['cantidadEnviar'];
                $insertLote = oa_ejecutar(
                    "INSERT INTO InventarioDocumentoDetalleLotes
                    (idDocumentoDetalle, idLote, idBodega, idUbicacion,
                     cantidad, observacion, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, NOW())",
                    'iiiids',
                    [
                        $idDocumentoDetalle,
                        $reserva['idLote'] !== null ? (int)$reserva['idLote'] : null,
                        (int)$idBodega,
                        $reserva['idUbicacion'] !== null ? (int)$reserva['idUbicacion'] : null,
                        $cantidad,
                        $observacion !== '' ? $observacion : null
                    ]
                );
                $idDocumentoDetalleLote = (int)$insertLote['insert_id'];

                $existencia = oa_fila(
                    "SELECT id, idProducto, idLote, idBodega, idUbicacion,
                            cantidadDisponible, cantidadReservada
                     FROM InventarioExistencias
                     WHERE id = ?
                     LIMIT 1 FOR UPDATE",
                    'i',
                    [(int)$reserva['idExistencia']]
                );
                if (!$existencia
                    || (int)$existencia['idProducto'] !== (int)$reserva['idProducto']
                    || (int)$existencia['idBodega'] !== (int)$reserva['idBodega']
                    || (int)($existencia['idUbicacion'] ?? 0) !== (int)($reserva['idUbicacion'] ?? 0)
                    || (int)($existencia['idLote'] ?? 0) !== (int)($reserva['idLote'] ?? 0)
                    || oa_decimal($existencia['cantidadReservada']) + 0.0001 < $cantidad) {
                    oa_lanzar('La cantidad reservada en inventario ya no es suficiente', 409, 'reserva_inventario_inconsistente', [
                        'idReserva' => (int)$reserva['id'],
                        'idExistencia' => (int)$reserva['idExistencia']
                    ]);
                }

                $saldoInicial = oa_decimal($existencia['cantidadDisponible']);
                $liberacion = oa_ejecutar(
                    "UPDATE InventarioExistencias
                     SET cantidadDisponible = cantidadDisponible + ?,
                         cantidadReservada = cantidadReservada - ?, updated_at = NOW()
                     WHERE id = ? AND cantidadReservada >= ?",
                    'ddid',
                    [$cantidad, $cantidad, (int)$existencia['id'], $cantidad]
                );
                if ($liberacion['affected_rows'] !== 1) {
                    oa_lanzar('La reserva cambio durante el envio', 409, 'reserva_inventario_inconsistente');
                }
                $saldoLiberado = oa_decimal($saldoInicial + $cantidad);
                $idMovimientoLiberacion = oa_registrar_movimiento(
                    $idDocumento,
                    $idDocumentoDetalle,
                    (int)$reserva['idProducto'],
                    $reserva['idLote'] !== null ? (int)$reserva['idLote'] : null,
                    (int)$idBodega,
                    $reserva['idUbicacion'] !== null ? (int)$reserva['idUbicacion'] : null,
                    'LIBERACION_RESERVA_ALISTAMIENTO',
                    $cantidad,
                    $saldoInicial,
                    $saldoLiberado,
                    (int)$usuario['id'],
                    $idOperadorDocumento,
                    'Liberacion previa a salida hacia Logistica, orden #' . $idOrden
                );

                $salida = oa_ejecutar(
                    "UPDATE InventarioExistencias
                     SET cantidadDisponible = cantidadDisponible - ?, updated_at = NOW()
                     WHERE id = ? AND cantidadDisponible >= ?",
                    'did',
                    [$cantidad, (int)$existencia['id'], $cantidad]
                );
                if ($salida['affected_rows'] !== 1) {
                    oa_lanzar('No fue posible consolidar la salida hacia Logistica', 409, 'salida_logistica_inconsistente');
                }
                $saldoFinal = oa_decimal($saldoLiberado - $cantidad);
                $idMovimientoSalida = oa_registrar_movimiento(
                    $idDocumento,
                    $idDocumentoDetalle,
                    (int)$reserva['idProducto'],
                    $reserva['idLote'] !== null ? (int)$reserva['idLote'] : null,
                    (int)$idBodega,
                    $reserva['idUbicacion'] !== null ? (int)$reserva['idUbicacion'] : null,
                    'SALIDA_LOGISTICA',
                    $cantidad,
                    $saldoLiberado,
                    $saldoFinal,
                    (int)$usuario['id'],
                    $idOperadorDocumento,
                    'Salida hacia Logistica desde orden de alistamiento #' . $idOrden
                );

                $saldoReservaPosterior = oa_decimal(
                    oa_decimal($reserva['cantidadReservada'])
                    - oa_decimal($reserva['cantidadLiberada'])
                    - oa_decimal($reserva['cantidadEnviada'])
                    - $cantidad
                );
                $estadoReservaPosterior = $saldoReservaPosterior <= 0.0001
                    ? 'EN_LOGISTICA'
                    : 'RESERVADA';
                $actualizaReserva = oa_ejecutar(
                    "UPDATE InventarioOrdenesAlistamientoReservas
                     SET cantidadEnviada = cantidadEnviada + ?,
                         estadoReserva = ?, idUsuarioActualiza = ?,
                         versionRegistro = versionRegistro + 1, updated_at = NOW()
                     WHERE id = ? AND cantidadEnviada + ? <= cantidadAlistada",
                    'dsiid',
                    [
                        $cantidad,
                        $estadoReservaPosterior,
                        (int)$usuario['id'],
                        (int)$reserva['id'],
                        $cantidad
                    ]
                );
                if ($actualizaReserva['affected_rows'] !== 1) {
                    oa_lanzar('La cantidad alistada cambio durante el envio', 409, 'cantidad_alistada_inconsistente');
                }

                oa_ejecutar(
                    "INSERT INTO InventarioOrdenesAlistamientoEnvioDetalle
                    (idEnvio, idDetalleOrden, idReservaAlistamiento,
                     idDocumentoDetalle, idDocumentoDetalleLote, cantidadEnviada, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, NOW())",
                    'iiiiid',
                    [
                        $idEnvio,
                        (int)$idDetalle,
                        (int)$reserva['id'],
                        $idDocumentoDetalle,
                        $idDocumentoDetalleLote,
                        $cantidad
                    ]
                );
                oa_registrar_historial([
                    'idOrdenAlistamiento' => $idOrden,
                    'idDetalleOrden' => (int)$idDetalle,
                    'idReservaAlistamiento' => (int)$reserva['id'],
                    'idEnvio' => $idEnvio,
                    'idMovimientoInventario' => $idMovimientoLiberacion,
                    'evento' => 'LIBERACION_RESERVA_ENVIO_LOGISTICA',
                    'cantidad' => $cantidad,
                    'idUsuario' => (int)$usuario['id'],
                    'idOperador' => $idOperadorDocumento
                ]);
                oa_registrar_historial([
                    'idOrdenAlistamiento' => $idOrden,
                    'idDetalleOrden' => (int)$idDetalle,
                    'idReservaAlistamiento' => (int)$reserva['id'],
                    'idEnvio' => $idEnvio,
                    'idMovimientoInventario' => $idMovimientoSalida,
                    'evento' => 'SALIDA_LOGISTICA',
                    'cantidad' => $cantidad,
                    'idUsuario' => (int)$usuario['id'],
                    'idOperador' => $idOperadorDocumento
                ]);
            }
            oa_recalcular_detalle((int)$idDetalle);
        }

        $totalEnviado = oa_decimal($totalEnviado + (float)$grupoBodega['cantidad']);
        $enviosCreados[] = [
            'idEnvio' => $idEnvio,
            'consecutivo' => $consecutivoEnvio,
            'idDocumentoInventario' => $idDocumento,
            'consecutivoDocumento' => $consecutivoDocumento,
            'idBodegaOrigen' => (int)$idBodega,
            'cantidadTotal' => (float)$grupoBodega['cantidad']
        ];
    }

    $pendienteEnvioFila = oa_fila(
        "SELECT COALESCE(SUM(r.cantidadAlistada - r.cantidadEnviada), 0) AS pendiente
         FROM InventarioOrdenesAlistamientoReservas r
         INNER JOIN InventarioOrdenesAlistamientoDetalle d ON d.id = r.idDetalleOrden
         WHERE d.idOrdenAlistamiento = ?",
        'i',
        [$idOrden]
    );
    $pendienteEnvio = oa_decimal($pendienteEnvioFila['pendiente'] ?? 0);
    $totalesDespues = oa_totales_orden($idOrden);
    $logisticaCompleta = (string)$orden['estadoAlistamientoCodigo'] === 'OA_ALIST_FINALIZADA'
        && $totalesDespues['cantidadPendiente'] <= 0.0001
        && $pendienteEnvio <= 0.0001;
    $estadoLogNuevo = $logisticaCompleta ? $estadoEnLogistica : $estadoLogParcial;
    oa_ejecutar(
        "UPDATE InventarioOrdenesAlistamiento
         SET idEstadoLogistica = ?,
             fechaPrimerEnvioLogistica = COALESCE(fechaPrimerEnvioLogistica, NOW()),
             fechaUltimoEnvioLogistica = NOW(),
             versionRegistro = versionRegistro + 1, updated_at = NOW()
         WHERE id = ?",
        'ii',
        [(int)$estadoLogNuevo['id'], $idOrden]
    );
    oa_registrar_historial([
        'idOrdenAlistamiento' => $idOrden,
        'evento' => $logisticaCompleta ? 'ENVIO_LOGISTICA_COMPLETO' : 'ENVIO_LOGISTICA_PARCIAL',
        'idEstadoLogisticaAnterior' => (int)$orden['idEstadoLogistica'],
        'idEstadoLogisticaNuevo' => (int)$estadoLogNuevo['id'],
        'cantidad' => $totalEnviado,
        'idUsuario' => (int)$usuario['id'],
        'idOperador' => $idOperadorDocumento,
        'observacion' => $observacion !== '' ? $observacion : null,
        'datos' => [
            'envios' => $enviosCreados,
            'cantidadPendienteEnvio' => $pendienteEnvio,
            'cantidadPendienteAlistar' => $totalesDespues['cantidadPendiente'],
            'logisticaCompleta' => $logisticaCompleta
        ]
    ]);

    $respuesta = oa_detalle_completo($idOrden, $usuario, oa_operador_por_usuario((int)$usuario['id']));
    oa_confirmar_transaccion();
    oa_responder('si', 'Cantidades enviadas a Logistica correctamente', array_merge($respuesta, [
        'orden' => $respuesta,
        'resumen' => $respuesta['totales'],
        'enviosGenerados' => $enviosCreados
    ]), [
        'idOrdenAlistamiento' => $idOrden,
        'cantidadEnviada' => $totalEnviado,
        'cantidadPendienteEnvio' => $pendienteEnvio,
        'cantidadPendienteAlistar' => $totalesDespues['cantidadPendiente'],
        'logisticaCompleta' => $logisticaCompleta
    ]);
} catch (Throwable $error) {
    oa_manejar_error($error, 'No fue posible enviar la orden a Logistica');
}
