<?php
require_once __DIR__ . "/InventarioSalidasHelper.php";

try {
    $idDocumento = intval(sal_parametro("idDocumento", sal_parametro("idSalida", sal_parametro("id", 0))));

    if ($idDocumento <= 0) {
        sal_responder("no", "Debe enviar la salida que desea consultar");
    }

    $documentoFila = sal_obtener_fila("
        SELECT
            d.id,
            d.idTipoDocumento,
            d.idUsuarioRegistro,
            d.idOperador,
            d.consecutivo,
            d.fechaDocumento,
            d.idResponsable,
            d.idOperadorAsignado,
            d.idEstado,
            d.tipoOrigen,
            d.observacion,
            d.estadoProceso,
            d.fechaFinalizacion,
            d.idUsuarioFinaliza,
            d.created_at,
            d.updated_at,

            td.codigo AS codigoTipoDocumento,
            td.nombre AS tipoDocumento,
            td.tipoMovimiento,
            td.naturaleza,
            COALESCE(td.permiteLoteVencido, 0) AS permiteLoteVencido,

            u.nombre AS usuarioRegistro,
            io.codigo AS codigoOperador,
            io.nombreCompleto AS operador,

            COUNT(DISTINCT dd.id) AS totalProductos,
            COALESCE(SUM(dd.cantidadSolicitada), 0) AS totalCantidad,
            COUNT(DISTINCT im.id) AS totalMovimientos

        FROM InventarioDocumentos d
        INNER JOIN TiposDocumentoInventario td
            ON td.id = d.idTipoDocumento
        LEFT JOIN usuarios u
            ON u.id = d.idUsuarioRegistro
        LEFT JOIN InventarioOperadores io
            ON io.id = d.idOperador
        LEFT JOIN InventarioDocumentoDetalle dd
            ON dd.idDocumento = d.id
        LEFT JOIN InventarioMovimientos im
            ON im.idDocumento = d.id
        WHERE d.id = $idDocumento
        GROUP BY
            d.id,
            d.idTipoDocumento,
            d.idUsuarioRegistro,
            d.idOperador,
            d.consecutivo,
            d.fechaDocumento,
            d.idResponsable,
            d.idOperadorAsignado,
            d.idEstado,
            d.tipoOrigen,
            d.observacion,
            d.estadoProceso,
            d.fechaFinalizacion,
            d.idUsuarioFinaliza,
            d.created_at,
            d.updated_at,
            td.codigo,
            td.nombre,
            td.tipoMovimiento,
            td.naturaleza,
            td.permiteLoteVencido,
            u.nombre,
            io.codigo,
            io.nombreCompleto
        LIMIT 1
    ");

    if (!$documentoFila) {
        sal_responder("no", "La salida no existe", [], [], 404);
    }

    if (!sal_es_tipo_salida($documentoFila["naturaleza"])) {
        sal_responder("no", "El documento consultado no corresponde a una salida de inventario", [], [], 400);
    }

    $documento = sal_formatear_documento($documentoFila);

    $detalles = sal_obtener_filas("
        SELECT
            dd.id AS idDocumentoDetalle,
            dd.idDocumento,
            dd.idProducto,
            dd.cantidadSolicitada,
            dd.cantidadProcesada,
            dd.unidad,
            dd.observacion,
            pc.codigo AS codigoProducto,
            pc.descripcion AS producto,
            pic.manejaLote,
            pic.manejaVencimiento,
            dl.id AS idDetalleLote,
            dl.idLote,
            dl.idBodega,
            dl.idUbicacion,
            dl.cantidad AS cantidadLote,
            dl.observacion AS observacionLote,
            il.lote,
            il.fechaFabricacion,
            il.fechaVencimiento,
            il.fechaIngreso,
            b.codigo AS codigoBodega,
            b.nombre AS bodega,
            u.codigo AS codigoUbicacion,
            u.nombre AS ubicacion
        FROM InventarioDocumentoDetalle dd
        INNER JOIN ProductosCatalogo pc
            ON pc.id = dd.idProducto
        LEFT JOIN ProductosInventarioConfig pic
            ON pic.idProducto = pc.id
        LEFT JOIN InventarioDocumentoDetalleLotes dl
            ON dl.idDocumentoDetalle = dd.id
        LEFT JOIN InventarioLotes il
            ON il.id = dl.idLote
        LEFT JOIN BodegasInventario b
            ON b.id = dl.idBodega
        LEFT JOIN UbicacionesInventario u
            ON u.id = dl.idUbicacion
        WHERE dd.idDocumento = $idDocumento
        ORDER BY dd.id ASC, dl.id ASC
    ");

    $detalleData = array_map(function ($fila) {
        return [
            "idDocumentoDetalle" => intval($fila["idDocumentoDetalle"]),
            "idDocumento" => intval($fila["idDocumento"]),
            "idProducto" => intval($fila["idProducto"]),
            "codigoProducto" => $fila["codigoProducto"],
            "producto" => $fila["producto"],
            "descripcion" => $fila["producto"],
            "manejaLote" => intval($fila["manejaLote"] ?? 0),
            "manejaVencimiento" => intval($fila["manejaVencimiento"] ?? 0),
            "cantidad" => floatval($fila["cantidadSolicitada"]),
            "cantidadSolicitada" => floatval($fila["cantidadSolicitada"]),
            "cantidadProcesada" => floatval($fila["cantidadProcesada"]),
            "unidad" => $fila["unidad"],
            "observacion" => $fila["observacion"],

            "idDetalleLote" => $fila["idDetalleLote"] !== null ? intval($fila["idDetalleLote"]) : null,
            "idLote" => $fila["idLote"] !== null ? intval($fila["idLote"]) : null,
            "lote" => $fila["lote"],
            "fechaFabricacion" => $fila["fechaFabricacion"],
            "fechaVencimiento" => $fila["fechaVencimiento"],
            "fechaIngreso" => $fila["fechaIngreso"],
            "vencido" => sal_lote_vencido($fila["fechaVencimiento"]),

            "idBodega" => $fila["idBodega"] !== null ? intval($fila["idBodega"]) : null,
            "codigoBodega" => $fila["codigoBodega"],
            "bodega" => $fila["bodega"],
            "idUbicacion" => $fila["idUbicacion"] !== null ? intval($fila["idUbicacion"]) : null,
            "codigoUbicacion" => $fila["codigoUbicacion"],
            "ubicacion" => $fila["ubicacion"],
            "cantidadLote" => $fila["cantidadLote"] !== null ? floatval($fila["cantidadLote"]) : null,
            "observacionLote" => $fila["observacionLote"]
        ];
    }, $detalles);

    $movimientos = sal_obtener_filas("
        SELECT
            m.id,
            m.idDocumento,
            m.idDocumentoDetalle,
            m.idProducto,
            pc.codigo AS codigoProducto,
            pc.descripcion AS producto,
            m.idLote,
            il.lote,
            m.idBodega,
            b.nombre AS bodega,
            m.idUbicacion,
            u.nombre AS ubicacion,
            m.tipoMovimiento,
            m.cantidad,
            m.saldoAnterior,
            m.saldoNuevo,
            m.idUsuario,
            us.nombre AS usuario,
            m.fechaMovimiento,
            m.observacion,
            m.idUsuarioRegistro,
            m.idOperador,
            io.nombreCompleto AS operador
        FROM InventarioMovimientos m
        INNER JOIN ProductosCatalogo pc
            ON pc.id = m.idProducto
        LEFT JOIN InventarioLotes il
            ON il.id = m.idLote
        INNER JOIN BodegasInventario b
            ON b.id = m.idBodega
        LEFT JOIN UbicacionesInventario u
            ON u.id = m.idUbicacion
        LEFT JOIN usuarios us
            ON us.id = m.idUsuario
        LEFT JOIN InventarioOperadores io
            ON io.id = m.idOperador
        WHERE m.idDocumento = $idDocumento
        ORDER BY m.id ASC
    ");

    $movimientosData = array_map(function ($fila) {
        return [
            "idMovimiento" => intval($fila["id"]),
            "idDocumento" => intval($fila["idDocumento"]),
            "idDocumentoDetalle" => intval($fila["idDocumentoDetalle"]),
            "idProducto" => intval($fila["idProducto"]),
            "codigoProducto" => $fila["codigoProducto"],
            "producto" => $fila["producto"],
            "idLote" => $fila["idLote"] !== null ? intval($fila["idLote"]) : null,
            "lote" => $fila["lote"],
            "idBodega" => intval($fila["idBodega"]),
            "bodega" => $fila["bodega"],
            "idUbicacion" => $fila["idUbicacion"] !== null ? intval($fila["idUbicacion"]) : null,
            "ubicacion" => $fila["ubicacion"],
            "tipoMovimiento" => $fila["tipoMovimiento"],
            "cantidad" => floatval($fila["cantidad"]),
            "saldoAnterior" => floatval($fila["saldoAnterior"]),
            "saldoNuevo" => floatval($fila["saldoNuevo"]),
            "idUsuario" => $fila["idUsuario"] !== null ? intval($fila["idUsuario"]) : null,
            "usuario" => $fila["usuario"],
            "fechaMovimiento" => $fila["fechaMovimiento"],
            "observacion" => $fila["observacion"],
            "idOperador" => $fila["idOperador"] !== null ? intval($fila["idOperador"]) : null,
            "operador" => $fila["operador"]
        ];
    }, $movimientos);

    sal_responder(
        "si",
        "Detalle de salida consultado correctamente",
        [
            "documento" => $documento,
            "salida" => $documento,
            "detalles" => $detalleData,
            "movimientos" => $movimientosData
        ]
    );
} catch (Throwable $e) {
    sal_responder(
        "no",
        "Error consultando detalle de salida",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
