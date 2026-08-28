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
    if ($versionEsperada <= 0) oa_lanzar('Debe recargar la orden antes de iniciar', 422, 'version_registro_requerida');

    $estadoProceso = oa_estado('OA_ALIST_EN_PROCESO');
    oa_iniciar_transaccion();
    $orden = oa_orden_base($idOrden, true);
    if (!$orden) oa_lanzar('La orden de alistamiento no existe', 404, 'orden_no_encontrada');
    oa_validar_acceso_orden($orden, $usuario, $operador);
    if ((int)$orden['versionRegistro'] !== $versionEsperada) {
        oa_lanzar('La orden fue actualizada por otro usuario', 409, 'version_registro_desactualizada', [
            'versionRegistro' => (int)$orden['versionRegistro']
        ]);
    }
    if ((string)$orden['estadoAlistamientoCodigo'] !== 'OA_ALIST_ASIGNADA') {
        oa_lanzar('La orden no esta disponible para iniciar', 409, 'estado_orden_no_admite_inicio');
    }
    $asignacion = oa_asignacion_activa($idOrden, true);
    if (!$asignacion || (int)$asignacion['idOperador'] !== (int)$operador['idOperador']
        || (string)$asignacion['estadoAsignacion'] !== 'ASIGNADA') {
        oa_lanzar('La asignacion activa no corresponde al operador autenticado', 409, 'asignacion_no_valida');
    }

    oa_ejecutar(
        "UPDATE InventarioOrdenesAlistamientoAsignaciones
         SET estadoAsignacion = 'EN_PROCESO', fechaInicio = NOW(),
             observacion = COALESCE(?, observacion), updated_at = NOW()
         WHERE id = ?",
        'si',
        [$observacion !== '' ? $observacion : null, (int)$asignacion['id']]
    );
    oa_ejecutar(
        "UPDATE InventarioOrdenesAlistamiento
         SET idEstadoAlistamiento = ?, fechaInicioAlistamiento = COALESCE(fechaInicioAlistamiento, NOW()),
             versionRegistro = versionRegistro + 1, updated_at = NOW()
         WHERE id = ?",
        'ii',
        [(int)$estadoProceso['id'], $idOrden]
    );
    oa_registrar_historial([
        'idOrdenAlistamiento' => $idOrden,
        'idAsignacion' => (int)$asignacion['id'],
        'evento' => 'ALISTAMIENTO_INICIADO',
        'idEstadoAlistamientoAnterior' => (int)$orden['idEstadoAlistamiento'],
        'idEstadoAlistamientoNuevo' => (int)$estadoProceso['id'],
        'idUsuario' => (int)$usuario['id'],
        'idOperador' => (int)$operador['idOperador'],
        'observacion' => $observacion !== '' ? $observacion : null
    ]);

    $respuesta = oa_detalle_completo($idOrden, $usuario, $operador);
    oa_confirmar_transaccion();
    oa_responder('si', 'Alistamiento iniciado correctamente',
        $respuesta,
        ['idOrdenAlistamiento' => $idOrden]
    );
} catch (Throwable $error) {
    oa_manejar_error($error, 'No fue posible iniciar el alistamiento');
}
