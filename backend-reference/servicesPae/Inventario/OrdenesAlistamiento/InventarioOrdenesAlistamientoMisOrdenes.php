<?php
declare(strict_types=1);

require_once __DIR__ . '/InventarioOrdenesAlistamientoHelper.php';

try {
    oa_validar_metodo('GET');
    $usuario = oa_usuario_autenticado();
    $operador = oa_operador_por_usuario((int)$usuario['id']);
    if (!$operador) {
        oa_lanzar('El usuario no tiene un operador de inventario activo asociado', 403, 'operador_no_configurado');
    }

    $q = oa_limpiar(oa_parametro('q', ''));
    $estadoProceso = strtoupper(oa_limpiar(oa_parametro('estadoProceso', '')));
    $fechaDesde = oa_limpiar(oa_parametro('fechaDesde', ''));
    $fechaHasta = oa_limpiar(oa_parametro('fechaHasta', ''));
    $pagina = max((int)oa_parametro('pagina', 1), 1);
    $limite = min(max((int)oa_parametro('limite', 100), 1), 200);
    $offset = ($pagina - 1) * $limite;
    $mapa = [
        'ASIGNADA' => 'OA_ALIST_ASIGNADA',
        'EN_ALISTAMIENTO' => 'OA_ALIST_EN_PROCESO',
        'ALISTADA_CON_PENDIENTES' => 'OA_ALIST_PARCIAL',
        'ALISTADA_COMPLETA' => 'OA_ALIST_FINALIZADA'
    ];
    $estadoCodigo = $mapa[$estadoProceso] ?? $estadoProceso;

    $where = ['o.idOperadorAsignado = ?'];
    $tipos = 'i';
    $valores = [(int)$operador['idOperador']];
    if ($q !== '') {
        $like = '%' . $q . '%';
        $where[] = "(o.consecutivo LIKE ? OR d.codigo LIKE ? OR d.descripcion LIKE ?
                    OR d.contrato LIKE ? OR EXISTS (
                        SELECT 1
                        FROM InventarioOrdenesAlistamientoDetalle od
                        WHERE od.idOrdenAlistamiento = o.id
                          AND (od.productoSnapshot LIKE ? OR od.codigoProductoSnapshot LIKE ?)
                    ))";
        $tipos .= 'ssssss';
        array_push($valores, $like, $like, $like, $like, $like, $like);
    }
    if ($estadoCodigo !== '') {
        $where[] = 'ea.codigo = ?';
        $tipos .= 's';
        $valores[] = $estadoCodigo;
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

    $from = " FROM InventarioOrdenesAlistamiento o
        INNER JOIN Estados ea ON ea.id = o.idEstadoAlistamiento
        INNER JOIN DespachosInforme d ON d.id = o.idDespachoInforme ";
    $condiciones = ' WHERE ' . implode(' AND ', $where);
    $totalFila = oa_fila('SELECT COUNT(*) AS total ' . $from . $condiciones, $tipos, $valores);
    $total = (int)($totalFila['total'] ?? 0);
    $ids = oa_consultar(
        'SELECT o.id ' . $from . $condiciones
        . ' ORDER BY FIELD(ea.codigo, \'OA_ALIST_EN_PROCESO\', \'OA_ALIST_ASIGNADA\', \'OA_ALIST_PARCIAL\', \'OA_ALIST_FINALIZADA\'), o.fechaUltimaAsignacion DESC, o.id DESC'
        . ' LIMIT ' . $limite . ' OFFSET ' . $offset,
        $tipos,
        $valores
    );

    $ordenes = [];
    foreach ($ids as $filaId) {
        $fila = oa_orden_base((int)$filaId['id']);
        if ($fila) $ordenes[] = oa_formatear_orden($fila, $usuario, $operador);
    }

    $resumen = [
        'total' => $total,
        'asignadas' => 0,
        'enAlistamiento' => 0,
        'alistadasConPendientes' => 0,
        'alistadasCompletas' => 0
    ];
    $resumenFilas = oa_consultar(
        'SELECT ea.codigo AS estadoAlistamientoCodigo, COUNT(*) AS cantidad '
        . $from . $condiciones . ' GROUP BY ea.codigo',
        $tipos,
        $valores
    );
    foreach ($resumenFilas as $filaResumen) {
        $cantidad = (int)$filaResumen['cantidad'];
        $codigo = (string)$filaResumen['estadoAlistamientoCodigo'];
        if ($codigo === 'OA_ALIST_ASIGNADA') $resumen['asignadas'] += $cantidad;
        if ($codigo === 'OA_ALIST_EN_PROCESO') $resumen['enAlistamiento'] += $cantidad;
        if ($codigo === 'OA_ALIST_PARCIAL') $resumen['alistadasConPendientes'] += $cantidad;
        if ($codigo === 'OA_ALIST_FINALIZADA') $resumen['alistadasCompletas'] += $cantidad;
    }

    oa_responder('si', 'Ordenes asignadas consultadas correctamente', [
        'ordenes' => $ordenes,
        'operador' => $operador,
        'resumen' => $resumen,
        'paginacion' => [
            'pagina' => $pagina,
            'limite' => $limite,
            'total' => $total,
            'totalPaginas' => $total > 0 ? (int)ceil($total / $limite) : 0
        ]
    ], ['resumen' => $resumen]);
} catch (Throwable $error) {
    oa_manejar_error($error, 'No fue posible consultar las ordenes asignadas');
}
