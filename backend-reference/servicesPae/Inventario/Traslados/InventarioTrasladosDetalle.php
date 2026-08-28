<?php
require_once __DIR__ . "/InventarioTrasladosHelper.php";

try {
    $idDocumento = intval(tr_parametro("idDocumento", tr_parametro("idTraslado", tr_parametro("id", 0))));
    if ($idDocumento <= 0) tr_responder("no", "Debe enviar el traslado que desea consultar");

    $filaDoc = tr_fila("
        SELECT d.id, d.idTipoDocumento, d.idUsuarioRegistro, d.idOperador, d.consecutivo, d.fechaDocumento,
               d.idResponsable, d.idOperadorAsignado, d.idEstado, d.tipoOrigen, d.observacion,
               d.estadoProceso, d.fechaFinalizacion, d.idUsuarioFinaliza,
               d.idBodegaOrigen, d.idUbicacionOrigen, d.idBodegaDestino, d.idUbicacionDestino,
               d.created_at, d.updated_at,
               td.codigo AS codigoTipoDocumento, td.nombre AS tipoDocumento, td.tipoMovimiento, td.naturaleza,
               us.nombre AS usuarioRegistro,
               io.codigo AS codigoOperador, io.nombreCompleto AS operador,
               bo.codigo AS codigoBodegaOrigen, bo.nombre AS bodegaOrigen,
               uo.codigo AS codigoUbicacionOrigen, uo.nombre AS ubicacionOrigen,
               bd.codigo AS codigoBodegaDestino, bd.nombre AS bodegaDestino,
               ud.codigo AS codigoUbicacionDestino, ud.nombre AS ubicacionDestino,
               COUNT(DISTINCT dd.id) AS totalProductos,
               COALESCE(SUM(dd.cantidadSolicitada), 0) AS totalCantidad,
               COUNT(DISTINCT im.id) AS totalMovimientos
        FROM InventarioDocumentos d
        INNER JOIN TiposDocumentoInventario td ON td.id = d.idTipoDocumento
        LEFT JOIN usuarios us ON us.id = d.idUsuarioRegistro
        LEFT JOIN InventarioOperadores io ON io.id = d.idOperador
        LEFT JOIN BodegasInventario bo ON bo.id = d.idBodegaOrigen
        LEFT JOIN UbicacionesInventario uo ON uo.id = d.idUbicacionOrigen
        LEFT JOIN BodegasInventario bd ON bd.id = d.idBodegaDestino
        LEFT JOIN UbicacionesInventario ud ON ud.id = d.idUbicacionDestino
        LEFT JOIN InventarioDocumentoDetalle dd ON dd.idDocumento = d.id
        LEFT JOIN InventarioMovimientos im ON im.idDocumento = d.id
        WHERE d.id = $idDocumento
        GROUP BY d.id, d.idTipoDocumento, d.idUsuarioRegistro, d.idOperador, d.consecutivo, d.fechaDocumento,
               d.idResponsable, d.idOperadorAsignado, d.idEstado, d.tipoOrigen, d.observacion,
               d.estadoProceso, d.fechaFinalizacion, d.idUsuarioFinaliza,
               d.idBodegaOrigen, d.idUbicacionOrigen, d.idBodegaDestino, d.idUbicacionDestino,
               d.created_at, d.updated_at, td.codigo, td.nombre, td.tipoMovimiento, td.naturaleza,
               us.nombre, io.codigo, io.nombreCompleto,
               bo.codigo, bo.nombre, uo.codigo, uo.nombre, bd.codigo, bd.nombre, ud.codigo, ud.nombre
        LIMIT 1
    ");

    if (!$filaDoc) tr_responder("no", "El traslado no existe", [], [], 404);
    if (!tr_es_traslado($filaDoc["naturaleza"], $filaDoc["tipoMovimiento"])) tr_responder("no", "El documento consultado no corresponde a un traslado de inventario", [], [], 400);

    $documento = tr_doc($filaDoc);
    $idBD = intval($documento["idBodegaDestino"] ?? 0);
    $idUD = intval($documento["idUbicacionDestino"] ?? 0);

    $detalles = tr_filas("
        SELECT dd.id AS idDocumentoDetalle, dd.idDocumento, dd.idProducto, dd.cantidadSolicitada, dd.cantidadProcesada, dd.unidad, dd.observacion,
               pc.codigo AS codigoProducto, pc.descripcion AS producto,
               pic.manejaLote, pic.manejaVencimiento,
               dl.id AS idDetalleLote, dl.idLote, dl.idBodega AS idBodegaOrigen, dl.idUbicacion AS idUbicacionOrigen,
               dl.cantidad AS cantidadLote, dl.observacion AS observacionLote,
               il.lote, il.fechaFabricacion, il.fechaVencimiento, il.fechaIngreso,
               bo.codigo AS codigoBodegaOrigen, bo.nombre AS bodegaOrigen,
               uo.codigo AS codigoUbicacionOrigen, uo.nombre AS ubicacionOrigen,
               bd.codigo AS codigoBodegaDestino, bd.nombre AS bodegaDestino,
               ud.codigo AS codigoUbicacionDestino, ud.nombre AS ubicacionDestino
        FROM InventarioDocumentoDetalle dd
        INNER JOIN ProductosCatalogo pc ON pc.id = dd.idProducto
        LEFT JOIN ProductosInventarioConfig pic ON pic.idProducto = pc.id
        LEFT JOIN InventarioDocumentoDetalleLotes dl ON dl.idDocumentoDetalle = dd.id
        LEFT JOIN InventarioLotes il ON il.id = dl.idLote
        LEFT JOIN BodegasInventario bo ON bo.id = dl.idBodega
        LEFT JOIN UbicacionesInventario uo ON uo.id = dl.idUbicacion
        LEFT JOIN BodegasInventario bd ON bd.id = $idBD
        LEFT JOIN UbicacionesInventario ud ON ud.id = $idUD
        WHERE dd.idDocumento = $idDocumento
        ORDER BY dd.id ASC, dl.id ASC
    ");

    $detalleData = array_map(function($r) use ($documento) {
        return [
            "idDocumentoDetalle" => intval($r["idDocumentoDetalle"]),
            "idDocumento" => intval($r["idDocumento"]),
            "idProducto" => intval($r["idProducto"]),
            "codigoProducto" => $r["codigoProducto"],
            "producto" => $r["producto"],
            "descripcion" => $r["producto"],
            "manejaLote" => intval($r["manejaLote"] ?? 0),
            "manejaVencimiento" => intval($r["manejaVencimiento"] ?? 0),
            "cantidad" => floatval($r["cantidadSolicitada"]),
            "cantidadSolicitada" => floatval($r["cantidadSolicitada"]),
            "cantidadProcesada" => floatval($r["cantidadProcesada"]),
            "unidad" => $r["unidad"],
            "observacion" => $r["observacion"],
            "idDetalleLote" => $r["idDetalleLote"] !== null ? intval($r["idDetalleLote"]) : null,
            "idLote" => $r["idLote"] !== null ? intval($r["idLote"]) : null,
            "lote" => $r["lote"],
            "fechaFabricacion" => $r["fechaFabricacion"],
            "fechaVencimiento" => $r["fechaVencimiento"],
            "fechaIngreso" => $r["fechaIngreso"],
            "vencido" => tr_lote_vencido($r["fechaVencimiento"]),
            "idBodegaOrigen" => $r["idBodegaOrigen"] !== null ? intval($r["idBodegaOrigen"]) : null,
            "codigoBodegaOrigen" => $r["codigoBodegaOrigen"],
            "bodegaOrigen" => $r["bodegaOrigen"],
            "idUbicacionOrigen" => $r["idUbicacionOrigen"] !== null ? intval($r["idUbicacionOrigen"]) : null,
            "codigoUbicacionOrigen" => $r["codigoUbicacionOrigen"],
            "ubicacionOrigen" => $r["ubicacionOrigen"],
            "idBodegaDestino" => $documento["idBodegaDestino"],
            "codigoBodegaDestino" => $r["codigoBodegaDestino"],
            "bodegaDestino" => $r["bodegaDestino"],
            "idUbicacionDestino" => $documento["idUbicacionDestino"],
            "codigoUbicacionDestino" => $r["codigoUbicacionDestino"],
            "ubicacionDestino" => $r["ubicacionDestino"],
            "cantidadLote" => $r["cantidadLote"] !== null ? floatval($r["cantidadLote"]) : null,
            "observacionLote" => $r["observacionLote"]
        ];
    }, $detalles);

    $movs = tr_filas("
        SELECT m.id, m.idDocumento, m.idDocumentoDetalle, m.idProducto,
               pc.codigo AS codigoProducto, pc.descripcion AS producto,
               m.idLote, il.lote, m.idBodega, b.nombre AS bodega,
               m.idUbicacion, u.nombre AS ubicacion,
               m.tipoMovimiento, m.cantidad, m.saldoAnterior, m.saldoNuevo,
               m.idUsuario, us.nombre AS usuario, m.fechaMovimiento, m.observacion,
               m.idUsuarioRegistro, m.idOperador, io.nombreCompleto AS operador
        FROM InventarioMovimientos m
        INNER JOIN ProductosCatalogo pc ON pc.id = m.idProducto
        LEFT JOIN InventarioLotes il ON il.id = m.idLote
        INNER JOIN BodegasInventario b ON b.id = m.idBodega
        LEFT JOIN UbicacionesInventario u ON u.id = m.idUbicacion
        LEFT JOIN usuarios us ON us.id = m.idUsuario
        LEFT JOIN InventarioOperadores io ON io.id = m.idOperador
        WHERE m.idDocumento = $idDocumento
        ORDER BY m.id ASC
    ");

    $movData = array_map(function($r) {
        return [
            "idMovimiento" => intval($r["id"]),
            "idDocumento" => intval($r["idDocumento"]),
            "idDocumentoDetalle" => intval($r["idDocumentoDetalle"]),
            "idProducto" => intval($r["idProducto"]),
            "codigoProducto" => $r["codigoProducto"],
            "producto" => $r["producto"],
            "idLote" => $r["idLote"] !== null ? intval($r["idLote"]) : null,
            "lote" => $r["lote"],
            "idBodega" => intval($r["idBodega"]),
            "bodega" => $r["bodega"],
            "idUbicacion" => $r["idUbicacion"] !== null ? intval($r["idUbicacion"]) : null,
            "ubicacion" => $r["ubicacion"],
            "tipoMovimiento" => $r["tipoMovimiento"],
            "cantidad" => floatval($r["cantidad"]),
            "saldoAnterior" => floatval($r["saldoAnterior"]),
            "saldoNuevo" => floatval($r["saldoNuevo"]),
            "idUsuario" => $r["idUsuario"] !== null ? intval($r["idUsuario"]) : null,
            "usuario" => $r["usuario"],
            "fechaMovimiento" => $r["fechaMovimiento"],
            "observacion" => $r["observacion"],
            "idOperador" => $r["idOperador"] !== null ? intval($r["idOperador"]) : null,
            "operador" => $r["operador"]
        ];
    }, $movs);

    tr_responder("si", "Detalle de traslado consultado correctamente", [
        "documento" => $documento,
        "traslado" => $documento,
        "detalles" => $detalleData,
        "movimientos" => $movData
    ]);
} catch (Throwable $e) {
    tr_responder("no", "Error consultando detalle de traslado", [], ["error" => $e->getMessage()], 500);
}
?>
