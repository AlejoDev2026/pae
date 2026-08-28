<?php
declare(strict_types=1);

require_once __DIR__ . '/InventarioOrdenesAlistamientoHelper.php';

try {
    oa_validar_metodo('POST');
    $usuario = oa_usuario_autenticado();
    $operador = oa_operador_por_usuario((int)$usuario['id']);
    if (!$operador) oa_lanzar('El usuario no tiene un operador activo asociado', 403, 'operador_no_configurado');
    $entrada = oa_json();
    $idOrdenPrincipal = (int)($entrada['idOrdenAlistamiento'] ?? 0);
    $idOrdenAlias = (int)($entrada['idOrden'] ?? 0);
    if ($idOrdenPrincipal > 0 && $idOrdenAlias > 0 && $idOrdenPrincipal !== $idOrdenAlias) {
        oa_lanzar('Los identificadores de la orden no coinciden', 422, 'identificadores_orden_no_coinciden');
    }
    $idOrden = $idOrdenPrincipal > 0 ? $idOrdenPrincipal : $idOrdenAlias;
    $versionEsperada = (int)($entrada['versionRegistro'] ?? 0);
    $observacion = oa_limpiar($entrada['observacion'] ?? '');
    if ($idOrden <= 0) oa_lanzar('La orden de alistamiento es obligatoria', 422, 'orden_requerida');
    if ($versionEsperada <= 0) oa_lanzar('Debe recargar la orden antes de finalizar', 422, 'version_registro_requerida');

    $estadoParcial = oa_estado('OA_ALIST_PARCIAL');
    $estadoFinal = oa_estado('OA_ALIST_FINALIZADA');
    oa_iniciar_transaccion();
    $orden = oa_orden_base($idOrden, true);
    if (!$orden) oa_lanzar('La orden de alistamiento no existe', 404, 'orden_no_encontrada');
    oa_validar_acceso_orden($orden, $usuario, $operador);
    if ((int)$orden['versionRegistro'] !== $versionEsperada) {
        oa_lanzar('La orden fue actualizada por otro usuario', 409, 'version_registro_desactualizada', [
            'versionRegistro' => (int)$orden['versionRegistro']
        ]);
    }
    if ((string)$orden['estadoAlistamientoCodigo'] !== 'OA_ALIST_EN_PROCESO') {
        oa_lanzar('La orden no esta en proceso de alistamiento', 409, 'estado_orden_no_admite_finalizacion');
    }
    $asignacion = oa_asignacion_activa($idOrden, true);
    if (!$asignacion || (int)$asignacion['idOperador'] !== (int)$operador['idOperador']
        || (string)$asignacion['estadoAsignacion'] !== 'EN_PROCESO') {
        oa_lanzar('La asignacion activa no permite finalizar la orden', 409, 'asignacion_no_valida');
    }

    oa_recalcular_orden($idOrden);
    $totales = oa_totales_orden($idOrden);
    $tienePendientes = $totales['cantidadPendiente'] > 0.0001;
    $estadoNuevo = $tienePendientes ? $estadoParcial : $estadoFinal;

    oa_ejecutar(
        "UPDATE InventarioOrdenesAlistamientoAsignaciones
         SET estadoAsignacion = 'FINALIZADA', fechaCierre = NOW(),
             observacion = COALESCE(?, observacion), updated_at = NOW()
         WHERE id = ?",
        'si',
        [$observacion !== '' ? $observacion : null, (int)$asignacion['id']]
    );
    oa_ejecutar(
        "UPDATE InventarioOrdenesAlistamiento
         SET idEstadoAlistamiento = ?, fechaFinalizacionAlistamiento = NOW(),
             observacion = COALESCE(?, observacion),
             versionRegistro = versionRegistro + 1, updated_at = NOW()
         WHERE id = ?",
        'isi',
        [(int)$estadoNuevo['id'], $observacion !== '' ? $observacion : null, $idOrden]
    );

    foreach (oa_detalles_orden($idOrden) as $detalle) {
        $detalleSinPendiente = oa_decimal($detalle['cantidadAlistada']) + 0.0001
            >= oa_decimal($detalle['cantidadSolicitada']);
        foreach (oa_reservas_detalle((int)$detalle['id'], true) as $reserva) {
            $reserva['idProducto'] = (int)$detalle['idProducto'];
            $alistada = oa_decimal($reserva['cantidadAlistada']);
            $liberada = oa_decimal($reserva['cantidadLiberada']);
            $reservada = oa_decimal($reserva['cantidadReservada']);
            $enviada = oa_decimal($reserva['cantidadEnviada']);
            $noAlistada = oa_decimal(max($reservada - $liberada - $alistada, 0));
            if ($detalleSinPendiente && $noAlistada > 0) {
                oa_liberar_reserva(
                    $idOrden,
                    $reserva,
                    $noAlistada,
                    (int)$usuario['id'],
                    (int)$operador['idOperador'],
                    'LIBERACION_EXCEDENTE_NO_ALISTADO',
                    'Liberacion de reserva excedente no alistada al finalizar la orden'
                );
                $liberada = oa_decimal($liberada + $noAlistada);
            }
            $capacidad = oa_decimal($reservada - $liberada);
            $saldoReserva = oa_decimal($reservada - $liberada - $enviada);
            if ($saldoReserva <= 0.0001) {
                $estadoReserva = $enviada > 0 ? 'EN_LOGISTICA' : 'LIBERADA';
            } elseif ($alistada <= 0) {
                $estadoReserva = 'RESERVADA';
            } else {
                $estadoReserva = $alistada + 0.0001 < $capacidad
                    ? 'ALISTAMIENTO_PARCIAL'
                    : 'ALISTADA';
            }
            oa_ejecutar(
                "UPDATE InventarioOrdenesAlistamientoReservas
                 SET estadoReserva = ?, idUsuarioActualiza = ?,
                     versionRegistro = versionRegistro + 1, updated_at = NOW()
                 WHERE id = ?",
                'sii',
                [$estadoReserva, (int)$usuario['id'], (int)$reserva['id']]
            );
        }
    }

    oa_registrar_historial([
        'idOrdenAlistamiento' => $idOrden,
        'idAsignacion' => (int)$asignacion['id'],
        'evento' => $tienePendientes ? 'ALISTAMIENTO_FINALIZADO_CON_PENDIENTES' : 'ALISTAMIENTO_FINALIZADO',
        'idEstadoAlistamientoAnterior' => (int)$orden['idEstadoAlistamiento'],
        'idEstadoAlistamientoNuevo' => (int)$estadoNuevo['id'],
        'cantidad' => $totales['cantidadAlistada'],
        'idUsuario' => (int)$usuario['id'],
        'idOperador' => (int)$operador['idOperador'],
        'observacion' => $observacion !== '' ? $observacion : null,
        'datos' => ['totales' => $totales, 'conPendientes' => $tienePendientes]
    ]);

    $respuesta = oa_detalle_completo($idOrden, $usuario, $operador);
    oa_confirmar_transaccion();
    oa_responder('si', $tienePendientes
        ? 'Alistamiento finalizado temporalmente con cantidades pendientes'
        : 'Alistamiento finalizado correctamente',
        array_merge($respuesta, ['orden' => $respuesta, 'resumen' => $respuesta['totales']]),
        ['idOrdenAlistamiento' => $idOrden, 'conPendientes' => $tienePendientes]
    );
} catch (Throwable $error) {
    oa_manejar_error($error, 'No fue posible finalizar el alistamiento');
}
