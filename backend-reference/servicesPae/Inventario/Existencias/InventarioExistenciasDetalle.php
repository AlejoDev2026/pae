<?php
require_once __DIR__ . "/InventarioExistenciasHelper.php";

try {
    $idExistencia = intval(ex_parametro("idExistencia", ex_parametro("id", 0)));
    $idProducto = intval(ex_parametro("idProducto", 0));
    $idBodega = intval(ex_parametro("idBodega", 0));
    $idUbicacion = intval(ex_parametro("idUbicacion", 0));
    $idLote = intval(ex_parametro("idLote", 0));

    $where = "1 = 1";

    if ($idExistencia > 0) {
        $where .= " AND e.id = $idExistencia ";
    } else {
        if ($idProducto <= 0 || $idBodega <= 0) {
            ex_responder(
                "no",
                "Debe enviar idExistencia o la combinación idProducto/idBodega",
                [],
                [],
                400
            );
        }

        $where .= " AND e.idProducto = $idProducto AND e.idBodega = $idBodega ";

        if ($idLote > 0) {
            $where .= " AND e.idLote = $idLote ";
        } else {
            $where .= " AND e.idLote IS NULL ";
        }

        if ($idUbicacion > 0) {
            $where .= " AND e.idUbicacion = $idUbicacion ";
        } else {
            $where .= " AND e.idUbicacion IS NULL ";
        }
    }

    $fila = ex_obtener_fila(
        ex_select_existencias_sql() .
        ex_base_existencias_sql() .
        " WHERE $where LIMIT 1"
    );

    if (!$fila) {
        ex_responder("no", "La existencia no fue encontrada", [], [], 404);
    }

    $existencia = ex_formatear_existencia($fila);

    $idProductoMov = intval($existencia["idProducto"]);
    $idBodegaMov = intval($existencia["idBodega"]);
    $idLoteMov = $existencia["idLote"] ? intval($existencia["idLote"]) : 0;
    $idUbicacionMov = $existencia["idUbicacion"] ? intval($existencia["idUbicacion"]) : 0;

    $whereMov = "
        m.idProducto = $idProductoMov
        AND m.idBodega = $idBodegaMov
    ";

    if ($idLoteMov > 0) {
        $whereMov .= " AND m.idLote = $idLoteMov ";
    } else {
        $whereMov .= " AND m.idLote IS NULL ";
    }

    if ($idUbicacionMov > 0) {
        $whereMov .= " AND m.idUbicacion = $idUbicacionMov ";
    } else {
        $whereMov .= " AND m.idUbicacion IS NULL ";
    }

    $movimientos = ex_obtener_filas("
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
            io.codigo AS codigoOperador,
            io.nombreCompleto AS operador,
            d.consecutivo,
            td.codigo AS codigoTipoDocumento,
            td.nombre AS tipoDocumento
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
        LEFT JOIN InventarioDocumentos d
            ON d.id = m.idDocumento
        LEFT JOIN TiposDocumentoInventario td
            ON td.id = d.idTipoDocumento
        WHERE $whereMov
        ORDER BY m.fechaMovimiento DESC, m.id DESC
        LIMIT 100
    ");

    $movimientosData = array_map(function ($fila) {
        return [
            "idMovimiento" => intval($fila["id"]),
            "idDocumento" => $fila["idDocumento"] !== null ? intval($fila["idDocumento"]) : null,
            "idDocumentoDetalle" => $fila["idDocumentoDetalle"] !== null ? intval($fila["idDocumentoDetalle"]) : null,
            "consecutivo" => $fila["consecutivo"],
            "codigoTipoDocumento" => $fila["codigoTipoDocumento"],
            "tipoDocumento" => $fila["tipoDocumento"],
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
            "cantidad" => ex_numero($fila["cantidad"]),
            "saldoAnterior" => ex_numero($fila["saldoAnterior"]),
            "saldoNuevo" => ex_numero($fila["saldoNuevo"]),
            "idUsuario" => $fila["idUsuario"] !== null ? intval($fila["idUsuario"]) : null,
            "usuario" => $fila["usuario"],
            "fechaMovimiento" => $fila["fechaMovimiento"],
            "observacion" => $fila["observacion"],
            "idOperador" => $fila["idOperador"] !== null ? intval($fila["idOperador"]) : null,
            "codigoOperador" => $fila["codigoOperador"],
            "operador" => $fila["operador"]
        ];
    }, $movimientos);

    ex_responder(
        "si",
        "Detalle de existencia consultado correctamente",
        [
            "existencia" => $existencia,
            "movimientos" => $movimientosData
        ],
        [
            "totalMovimientos" => count($movimientosData)
        ]
    );
} catch (Throwable $e) {
    ex_responder(
        "no",
        "Error consultando detalle de existencia",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
