<?php
declare(strict_types=1);

require_once __DIR__ . '/InventarioOrdenesAlistamientoHelper.php';

try {
    oa_validar_metodo('GET');
    $usuario = oa_usuario_autenticado();
    $operadorSesion = oa_operador_por_usuario((int)$usuario['id']);

    $estadosAlistamiento = oa_consultar(
        "SELECT id, codigo, nombre, descripcion
         FROM Estados
         WHERE estado = 1 AND codigo IN (
            'OA_ALIST_PENDIENTE_ASIGNAR', 'OA_ALIST_ASIGNADA',
            'OA_ALIST_EN_PROCESO', 'OA_ALIST_PARCIAL',
            'OA_ALIST_FINALIZADA', 'OA_ALIST_CANCELADA'
         )
         ORDER BY FIELD(codigo,
            'OA_ALIST_PENDIENTE_ASIGNAR', 'OA_ALIST_ASIGNADA',
            'OA_ALIST_EN_PROCESO', 'OA_ALIST_PARCIAL',
            'OA_ALIST_FINALIZADA', 'OA_ALIST_CANCELADA')"
    );
    foreach ($estadosAlistamiento as &$estado) {
        $estado['id'] = (int)$estado['id'];
        $estado['estadoProceso'] = oa_estado_proceso((string)$estado['codigo']);
        $estado['valor'] = $estado['estadoProceso'];
    }
    unset($estado);

    $estadosLogistica = oa_consultar(
        "SELECT id, codigo, nombre, descripcion
         FROM Estados
         WHERE estado = 1 AND codigo IN (
            'OA_LOG_PENDIENTE', 'OA_LOG_PARCIAL',
            'OA_LOG_EN_LOGISTICA', 'OA_LOG_CANCELADA'
         )
         ORDER BY FIELD(codigo,
            'OA_LOG_PENDIENTE', 'OA_LOG_PARCIAL',
            'OA_LOG_EN_LOGISTICA', 'OA_LOG_CANCELADA')"
    );
    foreach ($estadosLogistica as &$estado) {
        $estado['id'] = (int)$estado['id'];
        $estado['estadoLogistica'] = oa_estado_logistica_simple((string)$estado['codigo']);
        $estado['valor'] = $estado['estadoLogistica'];
    }
    unset($estado);

    $operadores = [];
    if (oa_es_admin($usuario)) {
        $operadores = oa_consultar(
            "SELECT io.id AS idOperador, io.idUsuario, io.codigo, io.documento,
                    io.nombreCompleto, io.nombre, io.apellido, io.cargo
             FROM InventarioOperadores io
             INNER JOIN usuarios u ON u.id = io.idUsuario AND u.estado = 1
             WHERE io.estado = 1
             ORDER BY COALESCE(NULLIF(io.nombreCompleto, ''), CONCAT(io.nombre, ' ', COALESCE(io.apellido, ''))) ASC"
        );
        foreach ($operadores as &$operador) {
            $operador['idOperador'] = (int)$operador['idOperador'];
            $operador['id'] = $operador['idOperador'];
            $operador['idUsuario'] = (int)$operador['idUsuario'];
            $nombre = oa_limpiar($operador['nombreCompleto'] ?? '');
            if ($nombre === '') {
                $nombre = oa_limpiar(($operador['nombre'] ?? '') . ' ' . ($operador['apellido'] ?? ''));
            }
            $operador['nombreCompleto'] = $nombre;
            $operador['nombreOperador'] = $nombre;
        }
        unset($operador);
    }

    oa_responder('si', 'Datos de ordenes de alistamiento consultados correctamente', [
        'estadosOrden' => $estadosAlistamiento,
        'estados' => $estadosAlistamiento,
        'estadosLogistica' => $estadosLogistica,
        'operadores' => $operadores,
        'operador' => $operadorSesion,
        'esAdministrador' => oa_es_admin($usuario),
        'usuario' => [
            'id' => (int)$usuario['id'],
            'nombre' => $usuario['nombre'],
            'rol' => (int)$usuario['rol']
        ]
    ]);
} catch (Throwable $error) {
    oa_manejar_error($error, 'No fue posible cargar los datos de ordenes de alistamiento');
}

