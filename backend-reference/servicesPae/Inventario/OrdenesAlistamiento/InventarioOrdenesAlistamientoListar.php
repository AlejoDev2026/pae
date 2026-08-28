<?php
declare(strict_types=1);

require_once __DIR__ . '/InventarioOrdenesAlistamientoHelper.php';

try {
    oa_validar_metodo('GET');
    $usuario = oa_usuario_autenticado();
    oa_requerir_admin($usuario);
    $operadorSesion = oa_operador_por_usuario((int)$usuario['id']);

    $pagina = max((int)oa_parametro('pagina', 1), 1);
    $limite = min(max((int)oa_parametro('limite', 50), 1), 200);
    $offset = ($pagina - 1) * $limite;
    $q = oa_limpiar(oa_parametro('q', ''));
    $estadoProceso = strtoupper(oa_limpiar(oa_parametro('estadoProceso', '')));
    $estadoLogistica = strtoupper(oa_limpiar(oa_parametro('estadoLogistica', '')));
    $idOperador = (int)oa_parametro('idOperador', 0);
    $fechaDesde = oa_limpiar(oa_parametro('fechaDesde', ''));
    $fechaHasta = oa_limpiar(oa_parametro('fechaHasta', ''));

    $mapaProceso = [
        'PENDIENTE_ASIGNACION' => 'OA_ALIST_PENDIENTE_ASIGNAR',
        'ASIGNADA' => 'OA_ALIST_ASIGNADA',
        'EN_ALISTAMIENTO' => 'OA_ALIST_EN_PROCESO',
        'ALISTADA_CON_PENDIENTES' => 'OA_ALIST_PARCIAL',
        'ALISTADA_COMPLETA' => 'OA_ALIST_FINALIZADA',
        'CANCELADA' => 'OA_ALIST_CANCELADA'
    ];
    $mapaLogistica = [
        'PENDIENTE' => 'OA_LOG_PENDIENTE',
        'EN_LOGISTICA_PARCIAL' => 'OA_LOG_PARCIAL',
        'EN_LOGISTICA' => 'OA_LOG_EN_LOGISTICA',
        'CANCELADA' => 'OA_LOG_CANCELADA'
    ];
    $estadoProcesoCodigo = $mapaProceso[$estadoProceso] ?? $estadoProceso;
    $estadoLogisticaCodigo = $mapaLogistica[$estadoLogistica] ?? $estadoLogistica;

    $where = ['1 = 1'];
    $tipos = '';
    $valores = [];

    if ($q !== '') {
        $where[] = "(o.consecutivo LIKE ? OR d.codigo LIKE ? OR d.descripcion LIKE ?
                    OR d.contrato LIKE ? OR op.nombreCompleto LIKE ? OR op.codigo LIKE ?
                    OR EXISTS (
                        SELECT 1
                        FROM InventarioOrdenesAlistamientoDetalle od
                        WHERE od.idOrdenAlistamiento = o.id
                          AND (od.productoSnapshot LIKE ? OR od.codigoProductoSnapshot LIKE ?)
                    ))";
        $busqueda = '%' . $q . '%';
        $tipos .= 'ssssssss';
        array_push(
            $valores,
            $busqueda,
            $busqueda,
            $busqueda,
            $busqueda,
            $busqueda,
            $busqueda,
            $busqueda,
            $busqueda
        );
    }
    if ($estadoProcesoCodigo !== '') {
        $where[] = 'ea.codigo = ?';
        $tipos .= 's';
        $valores[] = $estadoProcesoCodigo;
    }
    if ($estadoLogisticaCodigo !== '') {
        $where[] = 'el.codigo = ?';
        $tipos .= 's';
        $valores[] = $estadoLogisticaCodigo;
    }
    if ($idOperador > 0) {
        $where[] = 'o.idOperadorAsignado = ?';
        $tipos .= 'i';
        $valores[] = $idOperador;
    }
    if ($fechaDesde !== '') {
        $where[] = 'DATE(o.fechaGeneracion) >= ?';
        $tipos .= 's';
        $valores[] = $fechaDesde;
    }
    if ($fechaHasta !== '') {
        $where[] = 'DATE(o.fechaGeneracion) <= ?';
        $tipos .= 's';
        $valores[] = $fechaHasta;
    }

    $joins = " FROM InventarioOrdenesAlistamiento o
        INNER JOIN Estados ea ON ea.id = o.idEstadoAlistamiento
        INNER JOIN Estados el ON el.id = o.idEstadoLogistica
        INNER JOIN DespachosInforme d ON d.id = o.idDespachoInforme
        LEFT JOIN InventarioOperadores op ON op.id = o.idOperadorAsignado ";
    $condiciones = ' WHERE ' . implode(' AND ', $where);

    $totalFila = oa_fila(
        'SELECT COUNT(*) AS total ' . $joins . $condiciones,
        $tipos,
        $valores
    );
    $total = (int)($totalFila['total'] ?? 0);

    $ids = oa_consultar(
        'SELECT o.id ' . $joins . $condiciones
        . ' ORDER BY o.fechaGeneracion DESC, o.id DESC LIMIT ' . $limite . ' OFFSET ' . $offset,
        $tipos,
        $valores
    );

    $ordenes = [];
    foreach ($ids as $filaId) {
        $fila = oa_orden_base((int)$filaId['id']);
        if ($fila) {
            $ordenes[] = oa_formatear_orden($fila, $usuario, $operadorSesion);
        }
    }

    $resumen = [
        'total' => $total,
        'pendientesAsignacion' => 0,
        'asignadas' => 0,
        'enAlistamiento' => 0,
        'alistadasConPendientes' => 0,
        'alistadasCompletas' => 0,
        'enLogistica' => 0
    ];
    $resumenFilas = oa_consultar(
        "SELECT ea.codigo AS estadoAlistamientoCodigo,
                el.codigo AS estadoLogisticaCodigo, COUNT(*) AS cantidad
         $joins $condiciones
         GROUP BY ea.codigo, el.codigo",
        $tipos,
        $valores
    );
    foreach ($resumenFilas as $filaResumen) {
        $cantidad = (int)$filaResumen['cantidad'];
        $codigoA = (string)$filaResumen['estadoAlistamientoCodigo'];
        $codigoL = (string)$filaResumen['estadoLogisticaCodigo'];
        if ($codigoA === 'OA_ALIST_PENDIENTE_ASIGNAR') $resumen['pendientesAsignacion'] += $cantidad;
        if ($codigoA === 'OA_ALIST_ASIGNADA') $resumen['asignadas'] += $cantidad;
        if ($codigoA === 'OA_ALIST_EN_PROCESO') $resumen['enAlistamiento'] += $cantidad;
        if ($codigoA === 'OA_ALIST_PARCIAL') $resumen['alistadasConPendientes'] += $cantidad;
        if ($codigoA === 'OA_ALIST_FINALIZADA') $resumen['alistadasCompletas'] += $cantidad;
        if ($codigoL === 'OA_LOG_EN_LOGISTICA') $resumen['enLogistica'] += $cantidad;
    }

    oa_responder('si', 'Ordenes de alistamiento consultadas correctamente', [
        'ordenes' => $ordenes,
        'resumen' => $resumen,
        'paginacion' => [
            'pagina' => $pagina,
            'limite' => $limite,
            'total' => $total,
            'totalPaginas' => $total > 0 ? (int)ceil($total / $limite) : 0
        ]
    ], ['resumen' => $resumen]);
} catch (Throwable $error) {
    oa_manejar_error($error, 'No fue posible consultar las ordenes de alistamiento');
}
