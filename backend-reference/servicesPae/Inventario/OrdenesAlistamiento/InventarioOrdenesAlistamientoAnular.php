<?php
declare(strict_types=1);

require_once __DIR__ . '/InventarioOrdenesAlistamientoHelper.php';

try {
    oa_validar_metodo('POST');
    $usuario = oa_usuario_autenticado();
    oa_requerir_admin($usuario);
    $entrada = oa_json();
    $idOrden = (int)($entrada['idOrdenAlistamiento'] ?? $entrada['idOrden'] ?? 0);
    $versionEsperada = (int)($entrada['versionRegistro'] ?? 0);
    $observacion = oa_limpiar($entrada['observacion'] ?? $entrada['motivo'] ?? '');
    if ($idOrden <= 0) oa_lanzar('La orden de alistamiento es obligatoria', 422, 'orden_requerida');
    if ($versionEsperada <= 0) oa_lanzar('Debe recargar la orden antes de anularla', 422, 'version_registro_requerida');

    $estadoCancelada = oa_estado('OA_ALIST_CANCELADA');
    $estadoLogCancelada = oa_estado('OA_LOG_CANCELADA');
    oa_iniciar_transaccion();
    $orden = oa_orden_base($idOrden, true);
    if (!$orden) oa_lanzar('La orden de alistamiento no existe', 404, 'orden_no_encontrada');
    if ((int)$orden['versionRegistro'] !== $versionEsperada) {
        oa_lanzar('La orden fue actualizada por otro usuario', 409, 'version_registro_desactualizada', [
            'versionRegistro' => (int)$orden['versionRegistro']
        ]);
    }
    if ((string)$orden['estadoAlistamientoCodigo'] === 'OA_ALIST_CANCELADA') {
        oa_lanzar('La orden ya se encuentra cancelada', 409, 'orden_ya_cancelada');
    }

    $envios = oa_fila(
        "SELECT COUNT(*) AS totalEnvios,
                COALESCE(SUM(cantidadTotal), 0) AS cantidadEnviada
         FROM InventarioOrdenesAlistamientoEnvios
         WHERE idOrdenAlistamiento = ? AND estadoEnvio <> 'ANULADO'",
        'i',
        [$idOrden]
    );
    $enviadoReservas = oa_fila(
        "SELECT COALESCE(SUM(r.cantidadEnviada), 0) AS cantidadEnviada
         FROM InventarioOrdenesAlistamientoReservas r
         INNER JOIN InventarioOrdenesAlistamientoDetalle d ON d.id = r.idDetalleOrden
         WHERE d.idOrdenAlistamiento = ?",
        'i',
        [$idOrden]
    );
    if ((int)($envios['totalEnvios'] ?? 0) > 0
        || oa_decimal($envios['cantidadEnviada'] ?? 0) > 0
        || oa_decimal($enviadoReservas['cantidadEnviada'] ?? 0) > 0) {
        oa_lanzar('No se puede anular una orden que ya tiene envios a Logistica', 409, 'orden_con_envios_logistica');
    }

    foreach (oa_detalles_orden($idOrden) as $detalle) {
        foreach (oa_reservas_detalle((int)$detalle['id'], true) as $reserva) {
            $reserva['idProducto'] = (int)$detalle['idProducto'];
            oa_ejecutar(
                "UPDATE InventarioOrdenesAlistamientoReservas
                 SET cantidadAlistada = 0, idUsuarioActualiza = ?,
                     versionRegistro = versionRegistro + 1, updated_at = NOW()
                 WHERE id = ?",
                'ii',
                [(int)$usuario['id'], (int)$reserva['id']]
            );
            $cantidadLiberar = oa_decimal(
                oa_decimal($reserva['cantidadReservada']) - oa_decimal($reserva['cantidadLiberada'])
            );
            if ($cantidadLiberar > 0) {
                oa_liberar_reserva(
                    $idOrden,
                    $reserva,
                    $cantidadLiberar,
                    (int)$usuario['id'],
                    !empty($orden['idOperadorAsignado']) ? (int)$orden['idOperadorAsignado'] : null,
                    'LIBERACION_RESERVA_ANULACION',
                    $observacion !== '' ? $observacion : 'Liberacion por anulacion de la orden'
                );
            }
            oa_ejecutar(
                "UPDATE InventarioOrdenesAlistamientoReservas
                 SET estadoReserva = 'CANCELADA', idUsuarioActualiza = ?,
                     versionRegistro = versionRegistro + 1, updated_at = NOW()
                 WHERE id = ?",
                'ii',
                [(int)$usuario['id'], (int)$reserva['id']]
            );
        }
        oa_recalcular_detalle((int)$detalle['id']);
    }

    oa_ejecutar(
        "UPDATE InventarioOrdenesAlistamientoAsignaciones
         SET estadoAsignacion = 'CANCELADA', fechaCierre = COALESCE(fechaCierre, NOW()),
             observacion = COALESCE(?, observacion), updated_at = NOW()
         WHERE idOrdenAlistamiento = ?
           AND estadoAsignacion IN ('ASIGNADA', 'EN_PROCESO')",
        'si',
        [$observacion !== '' ? $observacion : null, $idOrden]
    );
    oa_ejecutar(
        "UPDATE InventarioOrdenesAlistamiento
         SET idEstadoAlistamiento = ?, idEstadoLogistica = ?,
             observacion = COALESCE(?, observacion),
             versionRegistro = versionRegistro + 1, updated_at = NOW()
         WHERE id = ?",
        'iisi',
        [
            (int)$estadoCancelada['id'],
            (int)$estadoLogCancelada['id'],
            $observacion !== '' ? $observacion : null,
            $idOrden
        ]
    );
    oa_registrar_historial([
        'idOrdenAlistamiento' => $idOrden,
        'evento' => 'ORDEN_ANULADA',
        'idEstadoAlistamientoAnterior' => (int)$orden['idEstadoAlistamiento'],
        'idEstadoAlistamientoNuevo' => (int)$estadoCancelada['id'],
        'idEstadoLogisticaAnterior' => (int)$orden['idEstadoLogistica'],
        'idEstadoLogisticaNuevo' => (int)$estadoLogCancelada['id'],
        'idUsuario' => (int)$usuario['id'],
        'idOperador' => !empty($orden['idOperadorAsignado']) ? (int)$orden['idOperadorAsignado'] : null,
        'observacion' => $observacion !== '' ? $observacion : null
    ]);

    $respuesta = oa_detalle_completo($idOrden, $usuario, oa_operador_por_usuario((int)$usuario['id']));
    oa_confirmar_transaccion();
    oa_responder('si', 'Orden de alistamiento anulada y reservas liberadas correctamente', array_merge($respuesta, [
        'orden' => $respuesta,
        'resumen' => $respuesta['totales']
    ]), ['idOrdenAlistamiento' => $idOrden]);
} catch (Throwable $error) {
    oa_manejar_error($error, 'No fue posible anular la orden de alistamiento');
}
