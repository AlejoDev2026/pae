<?php
declare(strict_types=1);

require_once __DIR__ . '/InventarioOrdenesAlistamientoHelper.php';

try {
    oa_validar_metodo('GET');
    $usuario = oa_usuario_autenticado();
    $operador = oa_operador_por_usuario((int)$usuario['id']);
    $idOrden = (int)oa_parametro('idOrdenAlistamiento', oa_parametro('idOrden', 0));
    $pagina = max((int)oa_parametro('pagina', 1), 1);
    $limite = min(max((int)oa_parametro('limite', 100), 1), 300);
    $offset = ($pagina - 1) * $limite;
    if ($idOrden <= 0) oa_lanzar('La orden de alistamiento es obligatoria', 422, 'orden_requerida');

    $orden = oa_orden_base($idOrden);
    if (!$orden) oa_lanzar('La orden de alistamiento no existe', 404, 'orden_no_encontrada');
    oa_validar_acceso_orden($orden, $usuario, $operador);

    $totalFila = oa_fila(
        'SELECT COUNT(*) AS total FROM InventarioOrdenesAlistamientoHistorial WHERE idOrdenAlistamiento = ?',
        'i',
        [$idOrden]
    );
    $total = (int)($totalFila['total'] ?? 0);
    $historial = oa_consultar(
        "SELECT
            h.*, u.nombre AS nombreUsuario,
            op.codigo AS codigoOperador, op.nombreCompleto AS nombreOperador,
            ea.codigo AS estadoAlistamientoAnteriorCodigo,
            en.codigo AS estadoAlistamientoNuevoCodigo,
            la.codigo AS estadoLogisticaAnteriorCodigo,
            ln.codigo AS estadoLogisticaNuevoCodigo
         FROM InventarioOrdenesAlistamientoHistorial h
         LEFT JOIN usuarios u ON u.id = h.idUsuario
         LEFT JOIN InventarioOperadores op ON op.id = h.idOperador
         LEFT JOIN Estados ea ON ea.id = h.idEstadoAlistamientoAnterior
         LEFT JOIN Estados en ON en.id = h.idEstadoAlistamientoNuevo
         LEFT JOIN Estados la ON la.id = h.idEstadoLogisticaAnterior
         LEFT JOIN Estados ln ON ln.id = h.idEstadoLogisticaNuevo
         WHERE h.idOrdenAlistamiento = ?
         ORDER BY h.id DESC
         LIMIT $limite OFFSET $offset",
        'i',
        [$idOrden]
    );
    $camposEnteros = [
        'id', 'idOrdenAlistamiento', 'idDetalleOrden', 'idAsignacion',
        'idReservaAlistamiento', 'idEnvio', 'idMovimientoInventario',
        'idEstadoAlistamientoAnterior', 'idEstadoAlistamientoNuevo',
        'idEstadoLogisticaAnterior', 'idEstadoLogisticaNuevo',
        'idUsuario', 'idOperador'
    ];
    foreach ($historial as &$evento) {
        foreach ($camposEnteros as $campo) {
            if (array_key_exists($campo, $evento) && $evento[$campo] !== null) {
                $evento[$campo] = (int)$evento[$campo];
            }
        }
        $evento['cantidad'] = $evento['cantidad'] !== null ? oa_decimal($evento['cantidad']) : null;
        if ($evento['datos'] !== null && $evento['datos'] !== '') {
            $datos = json_decode((string)$evento['datos'], true);
            $evento['datos'] = is_array($datos) ? $datos : $evento['datos'];
        }
    }
    unset($evento);

    oa_responder('si', 'Historial de la orden consultado correctamente', [
        'idOrdenAlistamiento' => $idOrden,
        'codigo' => $orden['consecutivo'],
        'historial' => $historial,
        'eventos' => $historial,
        'paginacion' => [
            'pagina' => $pagina,
            'limite' => $limite,
            'total' => $total,
            'totalPaginas' => $total > 0 ? (int)ceil($total / $limite) : 0
        ]
    ]);
} catch (Throwable $error) {
    oa_manejar_error($error, 'No fue posible consultar el historial de la orden');
}

