<?php
require_once __DIR__ . "/InventarioExistenciasHelper.php";

try {
    $q = ex_limpiar_texto(ex_parametro("q", ex_parametro("busqueda", "")));
    $idProducto = intval(ex_parametro("idProducto", 0));
    $idBodega = intval(ex_parametro("idBodega", 0));
    $idUbicacion = intval(ex_parametro("idUbicacion", 0));
    $idLote = intval(ex_parametro("idLote", 0));
    $idTipoProducto = intval(ex_parametro("idTipoProducto", 0));
    $soloDiferencias = ex_bool(ex_parametro("soloDiferencias", "0"));
    $limite = intval(ex_parametro("limite", 500));

    if ($limite <= 0 || $limite > 2000) {
        $limite = 500;
    }

    $where = "
        pc.estado = 1
        AND COALESCE(pc.idEstado, 1) = 1
        AND b.estado = 1
    ";

    if ($idProducto > 0) {
        $where .= " AND e.idProducto = $idProducto ";
    }

    if ($idBodega > 0) {
        $where .= " AND e.idBodega = $idBodega ";
    }

    if ($idUbicacion > 0) {
        $where .= " AND e.idUbicacion = $idUbicacion ";
    }

    if ($idLote > 0) {
        $where .= " AND e.idLote = $idLote ";
    }

    if ($idTipoProducto > 0) {
        $where .= " AND pic.idTipoProductoInventario = $idTipoProducto ";
    }

    if ($q !== "") {
        $qEsc = ex_esc($q);
        $like = "%" . $qEsc . "%";

        $where .= "
            AND (
                pc.codigo LIKE '$like'
                OR pc.descripcion LIKE '$like'
                OR il.lote LIKE '$like'
                OR b.nombre LIKE '$like'
                OR u.nombre LIKE '$like'
                OR tpi.nombre LIKE '$like'
            )
        ";
    }

    $filas = ex_obtener_filas("
        SELECT
            e.id AS idExistencia,
            e.idProducto,
            pc.codigo AS codigoProducto,
            pc.descripcion AS producto,
            pic.idTipoProductoInventario AS idTipoProducto,
            tpi.nombre AS tipoProducto,
            e.idLote,
            il.lote,
            e.idBodega,
            b.nombre AS bodega,
            e.idUbicacion,
            u.nombre AS ubicacion,
            e.cantidadDisponible,
            e.cantidadReservada,
            e.cantidadBloqueada,
            e.updated_at,

            m.id AS idMovimiento,
            m.tipoMovimiento,
            m.cantidad AS cantidadMovimiento,
            m.saldoAnterior,
            m.saldoNuevo,
            m.fechaMovimiento,
            m.idDocumento,
            d.consecutivo,
            td.codigo AS codigoTipoDocumento,
            td.nombre AS tipoDocumento
        FROM InventarioExistencias e
        INNER JOIN ProductosCatalogo pc
            ON pc.id = e.idProducto
        LEFT JOIN ProductosInventarioConfig pic
            ON pic.idProducto = pc.id
        LEFT JOIN TiposProductoInventario tpi
            ON tpi.id = pic.idTipoProductoInventario
        LEFT JOIN InventarioLotes il
            ON il.id = e.idLote
        INNER JOIN BodegasInventario b
            ON b.id = e.idBodega
        LEFT JOIN UbicacionesInventario u
            ON u.id = e.idUbicacion
        LEFT JOIN InventarioMovimientos m
            ON m.id = (
                SELECT mi.id
                FROM InventarioMovimientos mi
                WHERE mi.idProducto = e.idProducto
                  AND mi.idBodega = e.idBodega
                  AND (
                        (mi.idLote = e.idLote)
                        OR (mi.idLote IS NULL AND e.idLote IS NULL)
                  )
                  AND (
                        (mi.idUbicacion = e.idUbicacion)
                        OR (mi.idUbicacion IS NULL AND e.idUbicacion IS NULL)
                  )
                ORDER BY mi.fechaMovimiento DESC, mi.id DESC
                LIMIT 1
            )
        LEFT JOIN InventarioDocumentos d
            ON d.id = m.idDocumento
        LEFT JOIN TiposDocumentoInventario td
            ON td.id = d.idTipoDocumento
        WHERE $where
        ORDER BY
            pc.descripcion ASC,
            b.nombre ASC,
            u.nombre ASC,
            il.lote ASC
        LIMIT $limite
    ");

    $data = [];
    $resumen = [
        "totalRegistros" => 0,
        "totalOK" => 0,
        "totalDiferencias" => 0,
        "totalSinMovimientos" => 0,
        "diferenciaNeta" => 0
    ];

    foreach ($filas as $fila) {
        $disponible = ex_numero($fila["cantidadDisponible"] ?? 0);
        $saldoMovimiento = $fila["saldoNuevo"] !== null ? ex_numero($fila["saldoNuevo"]) : null;
        $diferencia = $saldoMovimiento !== null ? ex_numero($disponible - $saldoMovimiento) : null;

        $estado = "OK";
        $estadoTexto = "Correcto";

        if ($saldoMovimiento === null) {
            $estado = "SIN_MOVIMIENTOS";
            $estadoTexto = "Sin movimientos";
            $resumen["totalSinMovimientos"]++;
        } elseif (abs($diferencia) > 0.001) {
            $estado = "DIFERENCIA";
            $estadoTexto = "Con diferencia";
            $resumen["totalDiferencias"]++;
            $resumen["diferenciaNeta"] += $diferencia;
        } else {
            $resumen["totalOK"]++;
        }

        if ($soloDiferencias && $estado === "OK") {
            continue;
        }

        $data[] = [
            "idExistencia" => intval($fila["idExistencia"]),
            "idProducto" => intval($fila["idProducto"]),
            "codigoProducto" => $fila["codigoProducto"],
            "producto" => $fila["producto"],
            "idTipoProducto" => $fila["idTipoProducto"] !== null ? intval($fila["idTipoProducto"]) : null,
            "tipoProducto" => $fila["tipoProducto"],
            "idLote" => $fila["idLote"] !== null ? intval($fila["idLote"]) : null,
            "lote" => $fila["lote"],
            "idBodega" => intval($fila["idBodega"]),
            "bodega" => $fila["bodega"],
            "idUbicacion" => $fila["idUbicacion"] !== null ? intval($fila["idUbicacion"]) : null,
            "ubicacion" => $fila["ubicacion"],
            "cantidadDisponible" => $disponible,
            "cantidadReservada" => ex_numero($fila["cantidadReservada"] ?? 0),
            "cantidadBloqueada" => ex_numero($fila["cantidadBloqueada"] ?? 0),
            "saldoMovimiento" => $saldoMovimiento,
            "diferencia" => $diferencia,
            "estadoValidacion" => $estado,
            "estadoValidacionTexto" => $estadoTexto,
            "idMovimiento" => $fila["idMovimiento"] !== null ? intval($fila["idMovimiento"]) : null,
            "tipoMovimiento" => $fila["tipoMovimiento"],
            "cantidadMovimiento" => $fila["cantidadMovimiento"] !== null ? ex_numero($fila["cantidadMovimiento"]) : null,
            "saldoAnterior" => $fila["saldoAnterior"] !== null ? ex_numero($fila["saldoAnterior"]) : null,
            "saldoNuevo" => $saldoMovimiento,
            "fechaMovimiento" => $fila["fechaMovimiento"],
            "idDocumento" => $fila["idDocumento"] !== null ? intval($fila["idDocumento"]) : null,
            "consecutivo" => $fila["consecutivo"],
            "codigoTipoDocumento" => $fila["codigoTipoDocumento"],
            "tipoDocumento" => $fila["tipoDocumento"],
            "updated_at" => $fila["updated_at"]
        ];

        $resumen["totalRegistros"]++;
    }

    $resumen["diferenciaNeta"] = ex_numero($resumen["diferenciaNeta"]);

    ex_responder(
        "si",
        "Validación contra movimientos consultada correctamente",
        $data,
        [
            "total" => count($data),
            "resumen" => $resumen,
            "nota" => "La validación compara InventarioExistencias.cantidadDisponible contra el último saldoNuevo registrado en InventarioMovimientos para la misma combinación producto/bodega/ubicación/lote."
        ]
    );
} catch (Throwable $e) {
    ex_responder(
        "no",
        "Error validando existencias contra movimientos",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
