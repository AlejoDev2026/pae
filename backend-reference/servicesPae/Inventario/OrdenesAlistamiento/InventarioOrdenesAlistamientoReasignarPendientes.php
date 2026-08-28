<?php
declare(strict_types=1);

require_once __DIR__ . '/InventarioOrdenesAlistamientoHelper.php';

try {
    oa_validar_metodo('POST');
    $usuario = oa_usuario_autenticado();
    oa_requerir_admin($usuario);
    $entrada = oa_json();
    $idOrden = (int)($entrada['idOrdenAlistamiento'] ?? $entrada['idOrden'] ?? 0);
    $idOperador = (int)($entrada['idOperador'] ?? 0);
    $versionEsperada = (int)($entrada['versionRegistro'] ?? 0);
    $observacion = oa_limpiar($entrada['observacion'] ?? '');
    if ($idOrden <= 0) oa_lanzar('La orden de alistamiento es obligatoria', 422, 'orden_requerida');
    if ($idOperador <= 0) oa_lanzar('Debe seleccionar el nuevo operador', 422, 'operador_requerido');
    if ($versionEsperada <= 0) oa_lanzar('Debe recargar la orden antes de reasignarla', 422, 'version_registro_requerida');

    $nuevoOperador = oa_validar_operador_activo($idOperador);
    $estadoAsignada = oa_estado('OA_ALIST_ASIGNADA');
    oa_iniciar_transaccion();
    $orden = oa_orden_base($idOrden, true);
    if (!$orden) oa_lanzar('La orden de alistamiento no existe', 404, 'orden_no_encontrada');
    if ((int)$orden['versionRegistro'] !== $versionEsperada) {
        oa_lanzar('La orden fue actualizada por otro usuario', 409, 'version_registro_desactualizada', [
            'versionRegistro' => (int)$orden['versionRegistro']
        ]);
    }
    if (!in_array((string)$orden['estadoAlistamientoCodigo'], [
        'OA_ALIST_ASIGNADA',
        'OA_ALIST_PARCIAL',
        'OA_ALIST_FINALIZADA'
    ], true)) {
        oa_lanzar('La orden no esta disponible para reasignar pendientes', 409, 'estado_orden_no_admite_reasignacion');
    }

    oa_recalcular_orden($idOrden);
    $totales = oa_totales_orden($idOrden);
    if ($totales['cantidadPendiente'] <= 0.0001) {
        oa_lanzar('La orden no tiene cantidades pendientes por alistar', 409, 'orden_sin_pendientes');
    }
    if ((string)$orden['estadoAlistamientoCodigo'] !== 'OA_ALIST_ASIGNADA'
        && $totales['cantidadAlistada'] > $totales['cantidadEnviada'] + 0.0001) {
        oa_lanzar(
            'Antes de reasignar pendientes debe enviar a Logistica todo lo ya alistado',
            409,
            'alistado_pendiente_envio_logistica',
            [
                'cantidadAlistada' => $totales['cantidadAlistada'],
                'cantidadEnviada' => $totales['cantidadEnviada'],
                'cantidadPendienteEnvio' => oa_decimal(
                    $totales['cantidadAlistada'] - $totales['cantidadEnviada']
                )
            ]
        );
    }

    $activa = oa_asignacion_activa($idOrden, true);
    if ($activa) {
        oa_ejecutar(
            "UPDATE InventarioOrdenesAlistamientoAsignaciones
             SET estadoAsignacion = 'REASIGNADA', fechaCierre = NOW(), updated_at = NOW()
             WHERE id = ?",
            'i',
            [(int)$activa['id']]
        );
    }

    $reservadoAdicional = 0.0;
    foreach (oa_detalles_orden($idOrden) as $detalle) {
        $pendiente = oa_decimal(max(
            oa_decimal($detalle['cantidadSolicitada']) - oa_decimal($detalle['cantidadAlistada']),
            0
        ));
        if ($pendiente <= 0) continue;

        $capacidadFila = oa_fila(
            "SELECT COALESCE(SUM(cantidadReservada - cantidadLiberada - cantidadAlistada), 0) AS capacidad
             FROM InventarioOrdenesAlistamientoReservas
             WHERE idDetalleOrden = ?",
            'i',
            [(int)$detalle['id']]
        );
        $capacidad = oa_decimal($capacidadFila['capacidad'] ?? 0);
        $faltanteReserva = oa_decimal(max($pendiente - $capacidad, 0));
        if ($faltanteReserva > 0) {
            $reservadoAdicional = oa_decimal($reservadoAdicional + oa_reservar_fefo(
                $idOrden,
                (int)$detalle['id'],
                (int)$detalle['idProducto'],
                $faltanteReserva,
                (int)$usuario['id'],
                $idOperador,
                'RESERVA_ALISTAMIENTO'
            ));
            oa_recalcular_detalle((int)$detalle['id']);
        }
    }

    $insert = oa_ejecutar(
        "INSERT INTO InventarioOrdenesAlistamientoAsignaciones
        (idOrdenAlistamiento, idOperador, idUsuarioAsigna, estadoAsignacion,
         fechaAsignacion, observacion, created_at, updated_at)
        VALUES (?, ?, ?, 'ASIGNADA', NOW(), ?, NOW(), NOW())",
        'iiis',
        [$idOrden, $idOperador, (int)$usuario['id'], $observacion !== '' ? $observacion : null]
    );
    $idAsignacion = (int)$insert['insert_id'];
    oa_ejecutar(
        "UPDATE InventarioOrdenesAlistamiento
         SET idEstadoAlistamiento = ?, idOperadorAsignado = ?,
             idUsuarioUltimaAsignacion = ?, fechaUltimaAsignacion = NOW(),
             fechaFinalizacionAlistamiento = NULL,
             versionRegistro = versionRegistro + 1, updated_at = NOW()
         WHERE id = ?",
        'iiii',
        [(int)$estadoAsignada['id'], $idOperador, (int)$usuario['id'], $idOrden]
    );
    oa_registrar_historial([
        'idOrdenAlistamiento' => $idOrden,
        'idAsignacion' => $idAsignacion,
        'evento' => 'PENDIENTES_REASIGNADOS',
        'idEstadoAlistamientoAnterior' => (int)$orden['idEstadoAlistamiento'],
        'idEstadoAlistamientoNuevo' => (int)$estadoAsignada['id'],
        'cantidad' => $totales['cantidadPendiente'],
        'idUsuario' => (int)$usuario['id'],
        'idOperador' => $idOperador,
        'observacion' => $observacion !== '' ? $observacion : null,
        'datos' => [
            'operador' => [
                'idOperador' => (int)$nuevoOperador['idOperador'],
                'codigo' => $nuevoOperador['codigo'],
                'nombreCompleto' => $nuevoOperador['nombreCompleto'],
                'cargo' => $nuevoOperador['cargo']
            ],
            'cantidadReservadaAdicional' => $reservadoAdicional
        ]
    ]);

    $respuesta = oa_detalle_completo($idOrden, $usuario, oa_operador_por_usuario((int)$usuario['id']));
    oa_confirmar_transaccion();
    oa_responder('si', 'Cantidades pendientes reasignadas correctamente', array_merge($respuesta, [
        'orden' => $respuesta,
        'resumen' => $respuesta['totales']
    ]), ['idOrdenAlistamiento' => $idOrden, 'idAsignacion' => $idAsignacion]);
} catch (Throwable $error) {
    oa_manejar_error($error, 'No fue posible reasignar las cantidades pendientes');
}
