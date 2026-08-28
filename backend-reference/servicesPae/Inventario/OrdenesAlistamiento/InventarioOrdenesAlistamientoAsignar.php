<?php
declare(strict_types=1);

require_once __DIR__ . '/InventarioOrdenesAlistamientoHelper.php';

try {
    oa_validar_metodo('POST');
    $usuario = oa_usuario_autenticado();
    oa_requerir_admin($usuario);
    $entrada = oa_json();

    $idOrdenPrincipal = (int)($entrada['idOrdenAlistamiento'] ?? 0);
    $idOrdenAlias = (int)($entrada['idOrden'] ?? 0);
    if ($idOrdenPrincipal > 0 && $idOrdenAlias > 0 && $idOrdenPrincipal !== $idOrdenAlias) {
        oa_lanzar('Los identificadores de la orden no coinciden', 422, 'identificadores_orden_no_coinciden');
    }
    $idOrden = $idOrdenPrincipal > 0 ? $idOrdenPrincipal : $idOrdenAlias;
    $idOperador = (int)($entrada['idOperador'] ?? 0);
    $versionEsperada = (int)($entrada['versionRegistro'] ?? 0);
    $observacion = oa_limpiar($entrada['observacion'] ?? '');

    if ($idOrden <= 0) oa_lanzar('La orden de alistamiento es obligatoria', 422, 'orden_requerida');
    if ($idOperador <= 0) oa_lanzar('Debe seleccionar un operador', 422, 'operador_requerido');
    if ($versionEsperada <= 0) oa_lanzar('Debe recargar la orden antes de asignarla', 422, 'version_registro_requerida');

    $operadorAsignado = oa_validar_operador_activo($idOperador);
    $estadoAsignada = oa_estado('OA_ALIST_ASIGNADA');
    oa_iniciar_transaccion();

    $orden = oa_orden_base($idOrden, true);
    if (!$orden) oa_lanzar('La orden de alistamiento no existe', 404, 'orden_no_encontrada');
    if ((int)$orden['versionRegistro'] !== $versionEsperada) {
        oa_lanzar('La orden fue actualizada por otro usuario', 409, 'version_registro_desactualizada', [
            'versionRegistro' => (int)$orden['versionRegistro']
        ]);
    }
    if ((string)$orden['estadoAlistamientoCodigo'] !== 'OA_ALIST_PENDIENTE_ASIGNAR') {
        oa_lanzar('La orden ya no esta pendiente de asignacion', 409, 'estado_orden_no_admite_asignacion');
    }
    if (oa_asignacion_activa($idOrden, true)) {
        oa_lanzar('La orden ya tiene una asignacion activa', 409, 'asignacion_activa_existente');
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
             versionRegistro = versionRegistro + 1, updated_at = NOW()
         WHERE id = ?",
        'iiii',
        [(int)$estadoAsignada['id'], $idOperador, (int)$usuario['id'], $idOrden]
    );

    oa_registrar_historial([
        'idOrdenAlistamiento' => $idOrden,
        'idAsignacion' => $idAsignacion,
        'evento' => 'ORDEN_ASIGNADA',
        'idEstadoAlistamientoAnterior' => (int)$orden['idEstadoAlistamiento'],
        'idEstadoAlistamientoNuevo' => (int)$estadoAsignada['id'],
        'idUsuario' => (int)$usuario['id'],
        'idOperador' => $idOperador,
        'observacion' => $observacion !== '' ? $observacion : null,
        'datos' => [
            'operador' => [
                'idOperador' => (int)$operadorAsignado['idOperador'],
                'codigo' => $operadorAsignado['codigo'],
                'nombreCompleto' => $operadorAsignado['nombreCompleto'],
                'cargo' => $operadorAsignado['cargo']
            ]
        ]
    ]);

    $respuesta = oa_detalle_completo(
        $idOrden,
        $usuario,
        oa_operador_por_usuario((int)$usuario['id'])
    );
    oa_confirmar_transaccion();
    oa_responder('si', 'Orden asignada correctamente',
        $respuesta,
        ['idOrdenAlistamiento' => $idOrden, 'idAsignacion' => $idAsignacion]
    );
} catch (Throwable $error) {
    oa_manejar_error($error, 'No fue posible asignar la orden de alistamiento');
}
