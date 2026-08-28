<?php
require_once __DIR__ . "/InventarioMovimientosHelper.php";

try {
    $idProducto = intval(km_parametro("idProducto", 0));
    $idBodega = intval(km_parametro("idBodega", 0));
    $idUbicacion = intval(km_parametro("idUbicacion", 0));
    $idLote = intval(km_parametro("idLote", 0));
    $fechaDesde = km_fecha_sql(km_parametro("fechaDesde", ""), false);
    $fechaHasta = km_fecha_sql(km_parametro("fechaHasta", ""), true);
    $limite = intval(km_parametro("limite", 1000));

    if ($limite <= 0 || $limite > 3000) {
        $limite = 1000;
    }

    if ($idProducto <= 0) {
        km_responder(
            "no",
            "Debe enviar el idProducto para consultar el kardex",
            [],
            [],
            400
        );
    }

    $producto = km_obtener_fila("
        SELECT
            pc.id,
            pc.codigo,
            pc.descripcion,
            pc.estado,
            pc.idEstado,
            pic.idTipoProductoInventario AS idTipoProducto,
            pic.manejaLote,
            pic.manejaVencimiento,
            pic.stockMinimo,
            pic.stockMaximo,
            pic.unidadBaseInventario,
            tpi.nombre AS tipoProducto
        FROM ProductosCatalogo pc
        LEFT JOIN ProductosInventarioConfig pic
            ON pic.idProducto = pc.id
        LEFT JOIN TiposProductoInventario tpi
            ON tpi.id = pic.idTipoProductoInventario
        WHERE pc.id = $idProducto
        LIMIT 1
    ");

    if (!$producto) {
        km_responder(
            "no",
            "El producto no fue encontrado",
            [],
            [],
            404
        );
    }

    $where = "m.idProducto = $idProducto";

    if ($idBodega > 0) {
        $where .= " AND m.idBodega = $idBodega ";
    }

    if ($idUbicacion > 0) {
        $where .= " AND m.idUbicacion = $idUbicacion ";
    }

    if ($idLote > 0) {
        $where .= " AND m.idLote = $idLote ";
    }

    if ($fechaDesde !== "") {
        $fechaDesdeEsc = km_esc($fechaDesde);
        $where .= " AND m.fechaMovimiento >= '$fechaDesdeEsc' ";
    }

    if ($fechaHasta !== "") {
        $fechaHastaEsc = km_esc($fechaHasta);
        $where .= " AND m.fechaMovimiento <= '$fechaHastaEsc' ";
    }

    $filas = km_obtener_filas(
        km_select_movimientos_sql() .
        km_base_movimientos_sql() .
        "
            WHERE $where
            ORDER BY
                m.fechaMovimiento ASC,
                m.id ASC
            LIMIT $limite
        "
    );

    $movimientos = array_map("km_formatear_movimiento", $filas);

    $saldoInicial = null;
    $saldoFinal = null;

    if (count($movimientos) > 0) {
        $saldoInicial = $movimientos[0]["saldoAnterior"];
        $saldoFinal = $movimientos[count($movimientos) - 1]["saldoNuevo"];
    }

    $resumenMovimientos = km_resumen_desde_movimientos($movimientos);

    $whereExist = "e.idProducto = $idProducto";

    if ($idBodega > 0) {
        $whereExist .= " AND e.idBodega = $idBodega ";
    }

    if ($idUbicacion > 0) {
        $whereExist .= " AND e.idUbicacion = $idUbicacion ";
    }

    if ($idLote > 0) {
        $whereExist .= " AND e.idLote = $idLote ";
    }

    $saldosActuales = km_obtener_filas("
        SELECT
            e.id,
            e.idProducto,
            e.idLote,
            e.idBodega,
            e.idUbicacion,
            e.cantidadDisponible,
            e.cantidadReservada,
            e.cantidadBloqueada,
            e.updated_at,
            il.lote,
            il.fechaVencimiento,
            b.codigo AS codigoBodega,
            b.nombre AS bodega,
            u.codigo AS codigoUbicacion,
            u.nombre AS ubicacion
        FROM InventarioExistencias e
        LEFT JOIN InventarioLotes il
            ON il.id = e.idLote
        INNER JOIN BodegasInventario b
            ON b.id = e.idBodega
        LEFT JOIN UbicacionesInventario u
            ON u.id = e.idUbicacion
        WHERE $whereExist
        ORDER BY
            b.nombre ASC,
            u.nombre ASC,
            il.fechaVencimiento ASC,
            il.lote ASC
    ");

    $saldosData = array_map(function ($fila) {
        $disponible = km_numero($fila["cantidadDisponible"]);
        $reservada = km_numero($fila["cantidadReservada"]);
        $bloqueada = km_numero($fila["cantidadBloqueada"]);

        return [
            "idExistencia" => intval($fila["id"]),
            "idProducto" => intval($fila["idProducto"]),
            "idLote" => $fila["idLote"] !== null ? intval($fila["idLote"]) : null,
            "lote" => $fila["lote"],
            "fechaVencimiento" => $fila["fechaVencimiento"],
            "idBodega" => intval($fila["idBodega"]),
            "codigoBodega" => $fila["codigoBodega"],
            "bodega" => $fila["bodega"],
            "idUbicacion" => $fila["idUbicacion"] !== null ? intval($fila["idUbicacion"]) : null,
            "codigoUbicacion" => $fila["codigoUbicacion"],
            "ubicacion" => $fila["ubicacion"],
            "cantidadDisponible" => $disponible,
            "cantidadReservada" => $reservada,
            "cantidadBloqueada" => $bloqueada,
            "cantidadTotal" => km_numero($disponible + $reservada + $bloqueada),
            "updated_at" => $fila["updated_at"]
        ];
    }, $saldosActuales);

    $saldoDisponibleActual = 0;
    $saldoReservadoActual = 0;
    $saldoBloqueadoActual = 0;

    foreach ($saldosData as $saldo) {
        $saldoDisponibleActual += floatval($saldo["cantidadDisponible"]);
        $saldoReservadoActual += floatval($saldo["cantidadReservada"]);
        $saldoBloqueadoActual += floatval($saldo["cantidadBloqueada"]);
    }

    km_responder(
        "si",
        "Kardex de producto consultado correctamente",
        [
            "producto" => [
                "idProducto" => intval($producto["id"]),
                "codigoProducto" => $producto["codigo"],
                "producto" => $producto["descripcion"],
                "descripcion" => $producto["descripcion"],
                "idTipoProducto" => $producto["idTipoProducto"] !== null ? intval($producto["idTipoProducto"]) : null,
                "tipoProducto" => $producto["tipoProducto"],
                "manejaLote" => intval($producto["manejaLote"] ?? 0),
                "manejaVencimiento" => intval($producto["manejaVencimiento"] ?? 0),
                "stockMinimo" => km_numero($producto["stockMinimo"] ?? 0),
                "stockMaximo" => $producto["stockMaximo"] !== null ? km_numero($producto["stockMaximo"]) : null,
                "unidad" => $producto["unidadBaseInventario"] ?: "UND"
            ],
            "resumen" => array_merge($resumenMovimientos, [
                "saldoInicial" => $saldoInicial,
                "saldoFinal" => $saldoFinal,
                "saldoDisponibleActual" => km_numero($saldoDisponibleActual),
                "saldoReservadoActual" => km_numero($saldoReservadoActual),
                "saldoBloqueadoActual" => km_numero($saldoBloqueadoActual),
                "saldoTotalActual" => km_numero($saldoDisponibleActual + $saldoReservadoActual + $saldoBloqueadoActual)
            ]),
            "saldosActuales" => $saldosData,
            "movimientos" => $movimientos
        ],
        [
            "totalMovimientos" => count($movimientos),
            "filtros" => [
                "idProducto" => $idProducto,
                "idBodega" => $idBodega,
                "idUbicacion" => $idUbicacion,
                "idLote" => $idLote,
                "fechaDesde" => km_parametro("fechaDesde", ""),
                "fechaHasta" => km_parametro("fechaHasta", ""),
                "limite" => $limite
            ]
        ]
    );
} catch (Throwable $e) {
    km_responder(
        "no",
        "Error consultando kardex de producto",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
