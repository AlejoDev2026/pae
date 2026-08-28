<?php
declare(strict_types=1);

require_once __DIR__ . '/InventarioOrdenesAlistamientoHelper.php';

try {
    oa_validar_metodo('GET');
    $usuario = oa_usuario_autenticado();
    $operador = oa_operador_por_usuario((int)$usuario['id']);
    $idOrdenPrincipal = (int)oa_parametro('idOrdenAlistamiento', 0);
    $idOrdenAlias = (int)oa_parametro('idOrden', 0);

    if ($idOrdenPrincipal > 0 && $idOrdenAlias > 0 && $idOrdenPrincipal !== $idOrdenAlias) {
        oa_lanzar('Los identificadores de la orden no coinciden', 422, 'identificadores_orden_no_coinciden');
    }
    $idOrden = $idOrdenPrincipal > 0 ? $idOrdenPrincipal : $idOrdenAlias;
    if ($idOrden <= 0) {
        oa_lanzar('La orden de alistamiento es obligatoria', 422, 'orden_requerida');
    }

    $detalle = oa_detalle_completo($idOrden, $usuario, $operador);
    oa_responder('si', 'Detalle de la orden consultado correctamente', array_merge($detalle, [
        'orden' => $detalle,
        'resumen' => $detalle['totales']
    ]));
} catch (Throwable $error) {
    oa_manejar_error($error, 'No fue posible consultar el detalle de la orden de alistamiento');
}

