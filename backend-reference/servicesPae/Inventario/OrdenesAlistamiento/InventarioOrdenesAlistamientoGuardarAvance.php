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
    $reservasEntrada = $entrada['reservas'] ?? [];
    if ($idOrden <= 0) oa_lanzar('La orden de alistamiento es obligatoria', 422, 'orden_requerida');
    if ($versionEsperada <= 0) oa_lanzar('Debe recargar la orden antes de guardar el avance', 422, 'version_registro_requerida');
    if (!is_array($reservasEntrada) || !$reservasEntrada) {
        oa_lanzar('Debe enviar al menos una reserva para guardar el avance', 422, 'reservas_requeridas');
    }

    $reservasNormalizadas = [];
    foreach ($reservasEntrada as $item) {
        if (!is_array($item)) oa_lanzar('El formato de las reservas no es valido', 422, 'reservas_invalidas');
        $idReserva = (int)($item['idReserva'] ?? $item['idReservaAlistamiento'] ?? $item['id'] ?? 0);
        if ($idReserva <= 0) oa_lanzar('Cada registro debe identificar su reserva', 422, 'reserva_requerida');
        if (array_key_exists($idReserva, $reservasNormalizadas)) {
            oa_lanzar('Una reserva fue enviada mas de una vez', 422, 'reserva_duplicada', ['idReserva' => $idReserva]);
        }
        $cantidad = oa_decimal_entrada($item['cantidadAlistada'] ?? null, 'cantidad alistada');
        if ($cantidad < 0) oa_lanzar('La cantidad alistada no puede ser negativa', 422, 'cantidad_alistada_invalida');
        $reservasNormalizadas[$idReserva] = [
            'idReserva' => $idReserva,
            'cantidadAlistada' => $cantidad,
            'observacion' => oa_limpiar($item['observacion'] ?? '')
        ];
    }
    ksort($reservasNormalizadas, SORT_NUMERIC);

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
        oa_lanzar('La orden no esta en proceso de alistamiento', 409, 'estado_orden_no_admite_avance');
    }
    $asignacion = oa_asignacion_activa($idOrden, true);
    if (!$asignacion || (int)$asignacion['idOperador'] !== (int)$operador['idOperador']
        || (string)$asignacion['estadoAsignacion'] !== 'EN_PROCESO') {
        oa_lanzar('La asignacion activa no permite registrar el avance', 409, 'asignacion_no_valida');
    }
    $totalesInicio = oa_totales_orden($idOrden);
    $protegerDetallesCerrados = $totalesInicio['cantidadEnviada'] > 0.0001;

    $detallesAfectados = [];
    $cambios = [];
    foreach ($reservasNormalizadas as $item) {
        $reserva = oa_fila(
            "SELECT
                r.*, d.idOrdenAlistamiento, d.idProducto,
                d.cantidadSolicitada, d.cantidadAlistada AS cantidadAlistadaDetalle,
                d.cantidadPendiente,
                ex.idProducto AS idProductoExistencia,
                ex.idBodega AS idBodegaExistencia,
                ex.idUbicacion AS idUbicacionExistencia,
                ex.idLote AS idLoteExistencia
             FROM InventarioOrdenesAlistamientoReservas r
             INNER JOIN InventarioOrdenesAlistamientoDetalle d ON d.id = r.idDetalleOrden
             INNER JOIN InventarioExistencias ex ON ex.id = r.idExistencia
             WHERE r.id = ?
             LIMIT 1 FOR UPDATE",
            'i',
            [(int)$item['idReserva']]
        );
        if (!$reserva || (int)$reserva['idOrdenAlistamiento'] !== $idOrden) {
            oa_lanzar('Una de las reservas no pertenece a la orden', 422, 'reserva_no_pertenece_orden', [
                'idReserva' => (int)$item['idReserva']
            ]);
        }
        if ((int)$reserva['idProducto'] !== (int)$reserva['idProductoExistencia']
            || (int)$reserva['idBodega'] !== (int)$reserva['idBodegaExistencia']
            || (int)($reserva['idUbicacion'] ?? 0) !== (int)($reserva['idUbicacionExistencia'] ?? 0)
            || (int)($reserva['idLote'] ?? 0) !== (int)($reserva['idLoteExistencia'] ?? 0)) {
            oa_lanzar('La reserva no coincide con su existencia de inventario', 409, 'reserva_existencia_inconsistente', [
                'idReserva' => (int)$reserva['id']
            ]);
        }

        $nuevaCantidad = (float)$item['cantidadAlistada'];
        $anteriorAlistada = oa_decimal($reserva['cantidadAlistada']);
        $enviada = oa_decimal($reserva['cantidadEnviada']);
        if ($protegerDetallesCerrados
            && oa_decimal($reserva['cantidadPendiente']) <= 0.0001
            && abs($nuevaCantidad - $anteriorAlistada) > 0.0001) {
            oa_lanzar(
                'No se puede modificar un producto ya cerrado por un operador anterior',
                409,
                'detalle_cerrado_no_editable',
                [
                    'idDetalleOrden' => (int)$reserva['idDetalleOrden'],
                    'idReserva' => (int)$reserva['id']
                ]
            );
        }
        if ($nuevaCantidad + 0.0001 < $enviada) {
            oa_lanzar('No se puede reducir una cantidad que ya fue enviada a Logistica', 409, 'cantidad_ya_enviada', [
                'idReserva' => (int)$reserva['id'],
                'cantidadEnviada' => $enviada
            ]);
        }

        $reservada = oa_decimal($reserva['cantidadReservada']);
        $liberada = oa_decimal($reserva['cantidadLiberada']);
        $capacidad = oa_decimal($reservada - $liberada);
        $adicional = oa_decimal(max($nuevaCantidad - $capacidad, 0));
        $nuevaCantidadReserva = oa_decimal(min($nuevaCantidad, $capacidad));
        $reservasAdicionales = [];

        if ($adicional > 0) {
            $resultadoExcedente = oa_reservar_excedente_alistado_fefo(
                $idOrden,
                (int)$reserva['idDetalleOrden'],
                (int)$reserva['idProducto'],
                $adicional,
                (int)$usuario['id'],
                (int)$operador['idOperador'],
                $item['observacion'] !== '' ? $item['observacion'] : null,
                (int)$reserva['idExistencia']
            );
            $reservasAdicionales = $resultadoExcedente['reservas'];
        }

        $estadoReserva = 'RESERVADA';
        if ($nuevaCantidadReserva > 0 && $nuevaCantidadReserva + 0.0001 < $capacidad) {
            $estadoReserva = 'ALISTAMIENTO_PARCIAL';
        } elseif ($nuevaCantidadReserva > 0) {
            $estadoReserva = 'ALISTADA';
        }

        oa_ejecutar(
            "UPDATE InventarioOrdenesAlistamientoReservas
             SET cantidadAlistada = ?, estadoReserva = ?,
                 idUsuarioActualiza = ?, versionRegistro = versionRegistro + 1,
                 observacion = COALESCE(?, observacion), updated_at = NOW()
             WHERE id = ?",
            'dsisi',
            [
                $nuevaCantidadReserva,
                $estadoReserva,
                (int)$usuario['id'],
                $item['observacion'] !== '' ? $item['observacion'] : null,
                (int)$reserva['id']
            ]
        );
        $detallesAfectados[(int)$reserva['idDetalleOrden']] = true;
        $cambios[] = [
            'idReserva' => (int)$reserva['id'],
            'cantidadAnterior' => $anteriorAlistada,
            'cantidadAlistadaSolicitada' => $nuevaCantidad,
            'cantidadAlistadaEnReserva' => $nuevaCantidadReserva,
            'cantidadReservada' => $reservada,
            'cantidadAdicionalReservada' => $adicional,
            'reservasAdicionales' => $reservasAdicionales
        ];

        if (abs($nuevaCantidadReserva - $anteriorAlistada) > 0.0001 || $adicional > 0) {
            oa_registrar_historial([
                'idOrdenAlistamiento' => $idOrden,
                'idDetalleOrden' => (int)$reserva['idDetalleOrden'],
                'idAsignacion' => (int)$asignacion['id'],
                'idReservaAlistamiento' => (int)$reserva['id'],
                'evento' => 'AVANCE_RESERVA_GUARDADO',
                'cantidad' => $nuevaCantidad,
                'idUsuario' => (int)$usuario['id'],
                'idOperador' => (int)$operador['idOperador'],
                'observacion' => $item['observacion'] !== '' ? $item['observacion'] : null,
                'datos' => [
                    'cantidadAnterior' => $anteriorAlistada,
                    'cantidadAlistadaEnReservaOriginal' => $nuevaCantidadReserva,
                    'cantidadAdicionalReservada' => $adicional,
                    'reservasAdicionales' => $reservasAdicionales
                ]
            ]);
        }
    }

    foreach (array_keys($detallesAfectados) as $idDetalle) {
        oa_recalcular_detalle((int)$idDetalle);
    }
    oa_ejecutar(
        "UPDATE InventarioOrdenesAlistamiento
         SET versionRegistro = versionRegistro + 1, updated_at = NOW()
         WHERE id = ?",
        'i',
        [$idOrden]
    );
    oa_registrar_historial([
        'idOrdenAlistamiento' => $idOrden,
        'idAsignacion' => (int)$asignacion['id'],
        'evento' => 'AVANCE_ALISTAMIENTO_GUARDADO',
        'idEstadoAlistamientoAnterior' => (int)$orden['idEstadoAlistamiento'],
        'idEstadoAlistamientoNuevo' => (int)$orden['idEstadoAlistamiento'],
        'idUsuario' => (int)$usuario['id'],
        'idOperador' => (int)$operador['idOperador'],
        'datos' => ['reservas' => $cambios]
    ]);

    $respuesta = oa_detalle_completo($idOrden, $usuario, $operador);
    oa_confirmar_transaccion();
    oa_responder('si', 'Avance de alistamiento guardado correctamente', array_merge($respuesta, [
        'orden' => $respuesta,
        'resumen' => $respuesta['totales']
    ]), ['idOrdenAlistamiento' => $idOrden]);
} catch (Throwable $error) {
    oa_manejar_error($error, 'No fue posible guardar el avance de alistamiento');
}
