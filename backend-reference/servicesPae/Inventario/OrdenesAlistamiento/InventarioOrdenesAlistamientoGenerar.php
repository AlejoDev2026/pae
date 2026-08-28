<?php
declare(strict_types=1);

require_once __DIR__ . '/InventarioOrdenesAlistamientoHelper.php';

try {
    oa_validar_metodo('POST');
    $usuario = oa_usuario_autenticado();
    oa_requerir_admin($usuario);

    $entrada = oa_json();
    $idDespacho = (int)($entrada['idDespacho'] ?? 0);
    $idDespachoInforme = (int)($entrada['idDespachoInforme'] ?? 0);

    if ($idDespacho > 0 && $idDespachoInforme > 0 && $idDespacho !== $idDespachoInforme) {
        oa_lanzar(
            'Los identificadores del despacho no coinciden',
            422,
            'identificadores_fuente_no_coinciden'
        );
    }

    $idFuente = $idDespachoInforme > 0 ? $idDespachoInforme : $idDespacho;
    if ($idFuente <= 0) {
        oa_lanzar('El despacho es obligatorio', 422, 'despacho_requerido');
    }

    oa_iniciar_transaccion();

    $despacho = oa_fila(
        "SELECT id, codigo, fechaDespacho, tipoPeriodo, tipoDespacho, descripcion
         FROM DespachosInforme
         WHERE id = ?
         LIMIT 1 FOR UPDATE",
        'i',
        [$idFuente]
    );

    if (!$despacho) {
        oa_lanzar('El despacho no existe', 404, 'despacho_no_encontrado');
    }

    $tipoDespacho = strtoupper(oa_limpiar($despacho['tipoDespacho'] ?? 'CLASICO'));
    if ($tipoDespacho === '') {
        $tipoDespacho = 'CLASICO';
    }
    if ($tipoDespacho !== 'CLASICO') {
        oa_lanzar(
            $tipoDespacho === 'ROLDANILLO'
                ? 'Las ordenes de alistamiento no aplican al flujo especial de Roldanillo'
                : 'El despacho no corresponde al flujo clasico habilitado',
            422,
            'tipo_despacho_no_admitido',
            ['tipoDespacho' => $tipoDespacho]
        );
    }

    $existente = oa_fila(
        "SELECT id
         FROM InventarioOrdenesAlistamiento
         WHERE idDespachoInforme = ?
           AND tipoInforme = 'TOTAL_JORNADA_CONTRATO'
           AND alcance = 'TODAS'
         LIMIT 1 FOR UPDATE",
        'i',
        [$idFuente]
    );

    if ($existente) {
        $ordenExistente = oa_orden_base((int)$existente['id']);
        oa_lanzar(
            'El informe total de este despacho ya tiene una orden de alistamiento',
            409,
            'orden_fuente_duplicada',
            [
                'idOrdenAlistamiento' => (int)$existente['id'],
                'orden' => $ordenExistente
                    ? oa_formatear_orden($ordenExistente, $usuario, oa_operador_por_usuario((int)$usuario['id']))
                    : null
            ]
        );
    }

    /* Misma fuente funcional de DespachosGetInformeJornadaContrato.php:
       despacho completo, sin filtro de jornada y categorias 21/24. */
    $productos = oa_consultar(
        "SELECT
            d.idProducto,
            COALESCE(NULLIF(TRIM(p.codigo), ''), '') AS codigo,
            COALESCE(NULLIF(TRIM(p.descripcion), ''), 'Sin producto') AS producto,
            COALESCE(NULLIF(TRIM(cp.nombre), ''), 'Sin categoria') AS categoria,
            COALESCE(MAX(NULLIF(TRIM(d.unidadCoberturaExcel), '')), '') AS unidadCobertura,
            SUM(COALESCE(d.cantidad, 0)) AS totalCantidad,
            p.idEmbalaje,
            e.producto_base AS productoBase,
            e.presentacion,
            e.embalaje,
            e.`uni/caja` AS uniCaja
         FROM DetalleRutaProducto d
         INNER JOIN ProductosCatalogo p ON p.id = d.idProducto
         LEFT JOIN GruposProducto gp ON gp.id = p.idGrupo
         LEFT JOIN CategoriasProducto cp ON cp.id = gp.idCategoria
         LEFT JOIN EmbalajeCatalogo e ON e.id = p.idEmbalaje
         WHERE d.idDespacho = ?
           AND cp.id IN (24, 21)
         GROUP BY
            d.idProducto, p.codigo, p.descripcion, cp.nombre, p.idEmbalaje,
            e.producto_base, e.presentacion, e.embalaje, e.`uni/caja`
         ORDER BY p.codigo ASC, p.descripcion ASC",
        'i',
        [$idFuente]
    );

    $productos = array_values(array_filter($productos, static function (array $producto): bool {
        return oa_decimal($producto['totalCantidad'] ?? 0) > 0;
    }));

    if (!$productos) {
        oa_lanzar(
            'El informe total del despacho no contiene productos de las categorias habilitadas',
            422,
            'informe_sin_productos'
        );
    }

    $sinConfigurar = [];
    foreach ($productos as $producto) {
        if (!oa_producto_configurado((int)$producto['idProducto'])) {
            $sinConfigurar[] = [
                'idProducto' => (int)$producto['idProducto'],
                'codigo' => $producto['codigo'],
                'producto' => $producto['producto']
            ];
        }
    }

    if ($sinConfigurar) {
        oa_lanzar(
            'Hay productos del informe que aun no estan habilitados para inventario',
            422,
            'productos_sin_configuracion_inventario',
            ['productos' => $sinConfigurar]
        );
    }

    $fuenteHash = [];
    foreach ($productos as $producto) {
        $fuenteHash[] = [
            'idProducto' => (int)$producto['idProducto'],
            'cantidad' => oa_decimal($producto['totalCantidad']),
            'unidad' => oa_limpiar($producto['unidadCobertura'])
        ];
    }
    $hashFuente = hash('sha256', json_encode($fuenteHash, JSON_UNESCAPED_UNICODE));
    $estadoPendiente = oa_estado('OA_ALIST_PENDIENTE_ASIGNAR');
    $estadoLogistica = oa_estado('OA_LOG_PENDIENTE');
    $consecutivo = oa_consecutivo('OA');
    $observacion = oa_limpiar($entrada['observacion'] ?? '');

    $insertOrden = oa_ejecutar(
        "INSERT INTO InventarioOrdenesAlistamiento
        (consecutivo, idDespachoInforme, tipoInforme, alcance, hashFuente,
         idEstadoAlistamiento, idEstadoLogistica, idUsuarioRegistro,
         fechaGeneracion, observacion, versionRegistro, created_at, updated_at)
        VALUES (?, ?, 'TOTAL_JORNADA_CONTRATO', 'TODAS', ?, ?, ?, ?, NOW(), ?, 1, NOW(), NOW())",
        'sisiiis',
        [
            $consecutivo,
            $idFuente,
            $hashFuente,
            (int)$estadoPendiente['id'],
            (int)$estadoLogistica['id'],
            (int)$usuario['id'],
            $observacion !== '' ? $observacion : null
        ]
    );
    $idOrden = (int)$insertOrden['insert_id'];

    foreach ($productos as $producto) {
        $idProducto = (int)$producto['idProducto'];
        $cantidad = oa_decimal($producto['totalCantidad']);
        $uniCaja = (int)oa_decimal($producto['uniCaja'] ?? 0);
        $cantidadEntera = (int)round($cantidad);
        $pac = $uniCaja > 0 ? intdiv($cantidadEntera, $uniCaja) : 0;
        $und = $uniCaja > 0 ? $cantidadEntera % $uniCaja : $cantidadEntera;
        $unidad = oa_limpiar($producto['unidadCobertura']);
        if ($unidad === '') {
            $unidad = 'UND';
        }

        $insertDetalle = oa_ejecutar(
            "INSERT INTO InventarioOrdenesAlistamientoDetalle
            (idOrdenAlistamiento, idProducto, codigoProductoSnapshot,
             productoSnapshot, categoriaSnapshot, unidadSnapshot,
             presentacionSnapshot, embalajeSnapshot, uniCajaSnapshot,
             pacSolicitado, undSolicitado, cantidadSolicitada,
             cantidadReservada, cantidadAlistada, cantidadEnviada,
             observacion, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, NULL, NOW(), NOW())",
            'iissssssdddd',
            [
                $idOrden,
                $idProducto,
                (string)$producto['codigo'],
                (string)$producto['producto'],
                (string)$producto['categoria'],
                $unidad,
                $producto['presentacion'] !== null ? (string)$producto['presentacion'] : null,
                $producto['embalaje'] !== null ? (string)$producto['embalaje'] : null,
                $uniCaja > 0 ? (float)$uniCaja : null,
                (float)$pac,
                (float)$und,
                $cantidad
            ]
        );

        $idDetalle = (int)$insertDetalle['insert_id'];
        oa_reservar_fefo(
            $idOrden,
            $idDetalle,
            $idProducto,
            $cantidad,
            (int)$usuario['id']
        );
        oa_recalcular_detalle($idDetalle);
    }

    oa_registrar_historial([
        'idOrdenAlistamiento' => $idOrden,
        'evento' => 'ORDEN_GENERADA',
        'idEstadoAlistamientoNuevo' => (int)$estadoPendiente['id'],
        'idEstadoLogisticaNuevo' => (int)$estadoLogistica['id'],
        'idUsuario' => (int)$usuario['id'],
        'observacion' => $observacion !== '' ? $observacion : null,
        'datos' => [
            'idDespachoInforme' => $idFuente,
            'tipoInforme' => 'TOTAL_JORNADA_CONTRATO',
            'alcance' => 'TODAS',
            'hashFuente' => $hashFuente
        ]
    ]);

    $respuesta = oa_detalle_completo(
        $idOrden,
        $usuario,
        oa_operador_por_usuario((int)$usuario['id'])
    );
    oa_confirmar_transaccion();

    oa_responder(
        'si',
        'Orden de alistamiento generada correctamente',
        $respuesta,
        ['idOrdenAlistamiento' => $idOrden],
        201
    );
} catch (Throwable $error) {
    oa_manejar_error($error, 'No fue posible generar la orden de alistamiento');
}
