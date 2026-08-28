<?php
require_once __DIR__ . "/InventarioExistenciasHelper.php";

try {
    $q = ex_limpiar_texto(ex_parametro("q", ex_parametro("busqueda", "")));
    $idProducto = intval(ex_parametro("idProducto", 0));
    $idBodega = intval(ex_parametro("idBodega", 0));
    $idTipoProducto = intval(ex_parametro("idTipoProducto", 0));
    $estadoStock = strtoupper(ex_limpiar_texto(ex_parametro("estadoStock", "")));
    $soloDisponibles = ex_bool(ex_parametro("soloDisponibles", ex_parametro("disponibles", "0")));
    $limite = intval(ex_parametro("limite", 300));

    if ($limite <= 0 || $limite > 1000) {
        $limite = 300;
    }

    $where = "
        pc.estado = 1
        AND COALESCE(pc.idEstado, 1) = 1
        AND b.estado = 1
        AND (
            COALESCE(e.cantidadDisponible, 0) <> 0
            OR COALESCE(e.cantidadReservada, 0) <> 0
            OR COALESCE(e.cantidadBloqueada, 0) <> 0
        )
    ";

    if ($soloDisponibles) {
        $where .= " AND COALESCE(e.cantidadDisponible, 0) > 0 ";
    }

    if ($idProducto > 0) {
        $where .= " AND e.idProducto = $idProducto ";
    }

    if ($idBodega > 0) {
        $where .= " AND e.idBodega = $idBodega ";
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
                OR tpi.nombre LIKE '$like'
                OR b.nombre LIKE '$like'
            )
        ";
    }

    $having = "1 = 1";

    if (in_array($estadoStock, ["OK", "BAJO", "CRITICO", "SIN_STOCK", "SIN_CONFIGURAR"], true)) {
        if ($estadoStock === "SIN_CONFIGURAR") {
            $having .= " AND stockMinimo <= 0 ";
        } elseif ($estadoStock === "SIN_STOCK") {
            $having .= " AND stockMinimo > 0 AND cantidadDisponible <= 0 ";
        } elseif ($estadoStock === "CRITICO") {
            $having .= " AND stockMinimo > 0 AND cantidadDisponible > 0 AND cantidadDisponible <= (stockMinimo * 0.5) ";
        } elseif ($estadoStock === "BAJO") {
            $having .= " AND stockMinimo > 0 AND cantidadDisponible > (stockMinimo * 0.5) AND cantidadDisponible < stockMinimo ";
        } elseif ($estadoStock === "OK") {
            $having .= " AND (stockMinimo <= 0 OR cantidadDisponible >= stockMinimo) ";
        }
    }

    $filas = ex_obtener_filas("
        SELECT
            pc.id AS idProducto,
            pc.codigo AS codigoProducto,
            pc.descripcion AS producto,
            pic.idTipoProductoInventario AS idTipoProducto,
            tpi.nombre AS tipoProducto,
            pic.manejaLote,
            pic.manejaVencimiento,
            pic.unidadBaseInventario,
            COALESCE(pic.stockMinimo, 0) AS stockMinimo,
            pic.stockMaximo,

            COUNT(DISTINCT e.id) AS totalRegistros,
            COUNT(DISTINCT e.idBodega) AS totalBodegas,
            COUNT(DISTINCT e.idUbicacion) AS totalUbicaciones,
            COUNT(DISTINCT e.idLote) AS totalLotes,

            COALESCE(SUM(e.cantidadDisponible), 0) AS cantidadDisponible,
            COALESCE(SUM(e.cantidadReservada), 0) AS cantidadReservada,
            COALESCE(SUM(e.cantidadBloqueada), 0) AS cantidadBloqueada,

            MIN(
                CASE
                    WHEN il.fechaVencimiento IS NULL OR il.fechaVencimiento = '0000-00-00' THEN NULL
                    ELSE il.fechaVencimiento
                END
            ) AS proximoVencimiento,

            SUM(
                CASE
                    WHEN il.fechaVencimiento IS NOT NULL
                         AND il.fechaVencimiento <> '0000-00-00'
                         AND il.fechaVencimiento < CURDATE()
                    THEN 1 ELSE 0
                END
            ) AS lotesVencidos,

            SUM(
                CASE
                    WHEN il.fechaVencimiento IS NOT NULL
                         AND il.fechaVencimiento <> '0000-00-00'
                         AND il.fechaVencimiento >= CURDATE()
                         AND il.fechaVencimiento <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                    THEN 1 ELSE 0
                END
            ) AS lotesPorVencer

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
        WHERE $where
        GROUP BY
            pc.id,
            pc.codigo,
            pc.descripcion,
            pic.idTipoProductoInventario,
            tpi.nombre,
            pic.manejaLote,
            pic.manejaVencimiento,
            pic.unidadBaseInventario,
            pic.stockMinimo,
            pic.stockMaximo
        HAVING $having
        ORDER BY
            pc.descripcion ASC
        LIMIT $limite
    ");

    $data = array_map(function ($fila) {
        $disponible = ex_numero($fila["cantidadDisponible"] ?? 0);
        $reservada = ex_numero($fila["cantidadReservada"] ?? 0);
        $bloqueada = ex_numero($fila["cantidadBloqueada"] ?? 0);
        $vencimiento = ex_fecha_vencimiento_info($fila["proximoVencimiento"] ?? null);
        $stock = ex_estado_stock_info($disponible, $fila["stockMinimo"] ?? 0);

        return [
            "idProducto" => intval($fila["idProducto"]),
            "codigoProducto" => $fila["codigoProducto"],
            "producto" => $fila["producto"],
            "descripcion" => $fila["producto"],
            "idTipoProducto" => $fila["idTipoProducto"] !== null ? intval($fila["idTipoProducto"]) : null,
            "tipoProducto" => $fila["tipoProducto"],
            "manejaLote" => intval($fila["manejaLote"] ?? 0),
            "manejaVencimiento" => intval($fila["manejaVencimiento"] ?? 0),
            "unidad" => ($fila["unidadBaseInventario"] ?? "") ?: "UND",
            "stockMinimo" => $stock["stockMinimo"],
            "stockMaximo" => $fila["stockMaximo"] !== null ? ex_numero($fila["stockMaximo"]) : null,
            "diferenciaStockMinimo" => $stock["diferenciaStockMinimo"],
            "estadoStock" => $stock["estadoStock"],
            "estadoStockTexto" => $stock["estadoStockTexto"],
            "alertaStock" => $stock["alertaStock"],
            "totalRegistros" => intval($fila["totalRegistros"]),
            "totalBodegas" => intval($fila["totalBodegas"]),
            "totalUbicaciones" => intval($fila["totalUbicaciones"]),
            "totalLotes" => intval($fila["totalLotes"]),
            "cantidadDisponible" => $disponible,
            "cantidadReservada" => $reservada,
            "cantidadBloqueada" => $bloqueada,
            "cantidadTotal" => ex_numero($disponible + $reservada + $bloqueada),
            "proximoVencimiento" => $vencimiento["fechaVencimiento"],
            "diasProximoVencimiento" => $vencimiento["diasVencimiento"],
            "estadoProximoVencimiento" => $vencimiento["estadoVencimiento"],
            "estadoProximoVencimientoTexto" => $vencimiento["estadoVencimientoTexto"],
            "lotesVencidos" => intval($fila["lotesVencidos"] ?? 0),
            "lotesPorVencer" => intval($fila["lotesPorVencer"] ?? 0)
        ];
    }, $filas);

    ex_responder(
        "si",
        "Saldos consolidados por producto consultados correctamente",
        $data,
        ["total" => count($data)]
    );
} catch (Throwable $e) {
    ex_responder(
        "no",
        "Error consultando saldos por producto",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
