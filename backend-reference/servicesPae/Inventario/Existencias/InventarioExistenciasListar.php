<?php
require_once __DIR__ . "/InventarioExistenciasHelper.php";

try {
    $q = ex_limpiar_texto(ex_parametro("q", ex_parametro("busqueda", "")));
    $idProducto = intval(ex_parametro("idProducto", 0));
    $idBodega = intval(ex_parametro("idBodega", 0));
    $idUbicacion = intval(ex_parametro("idUbicacion", 0));
    $idLote = intval(ex_parametro("idLote", 0));
    $idTipoProducto = intval(ex_parametro("idTipoProducto", 0));
    $estadoVencimiento = strtoupper(ex_limpiar_texto(ex_parametro("estadoVencimiento", "")));
    $estadoStock = strtoupper(ex_limpiar_texto(ex_parametro("estadoStock", "")));
    $soloDisponibles = ex_bool(ex_parametro("soloDisponibles", ex_parametro("disponibles", "0")));
    $incluirCeros = ex_bool(ex_parametro("incluirCeros", "0"));
    $limite = intval(ex_parametro("limite", 300));

    if ($limite <= 0 || $limite > 1000) {
        $limite = 300;
    }

    $where = "
        pc.estado = 1
        AND COALESCE(pc.idEstado, 1) = 1
        AND b.estado = 1
    ";

    if (!$incluirCeros) {
        $where .= "
            AND (
                COALESCE(e.cantidadDisponible, 0) <> 0
                OR COALESCE(e.cantidadReservada, 0) <> 0
                OR COALESCE(e.cantidadBloqueada, 0) <> 0
            )
        ";
    }

    if ($soloDisponibles) {
        $where .= " AND COALESCE(e.cantidadDisponible, 0) > 0 ";
    }

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
                OR b.codigo LIKE '$like'
                OR u.nombre LIKE '$like'
                OR u.codigo LIKE '$like'
                OR tpi.nombre LIKE '$like'
            )
        ";
    }

    if (in_array($estadoStock, ["OK", "BAJO", "CRITICO", "SIN_STOCK", "SIN_CONFIGURAR"], true)) {
        if ($estadoStock === "SIN_CONFIGURAR") {
            $where .= " AND COALESCE(pic.stockMinimo, 0) <= 0 ";
        } elseif ($estadoStock === "SIN_STOCK") {
            $where .= " AND COALESCE(pic.stockMinimo, 0) > 0 AND COALESCE(e.cantidadDisponible, 0) <= 0 ";
        } elseif ($estadoStock === "CRITICO") {
            $where .= " AND COALESCE(pic.stockMinimo, 0) > 0 AND COALESCE(e.cantidadDisponible, 0) > 0 AND COALESCE(e.cantidadDisponible, 0) <= (COALESCE(pic.stockMinimo, 0) * 0.5) ";
        } elseif ($estadoStock === "BAJO") {
            $where .= " AND COALESCE(pic.stockMinimo, 0) > 0 AND COALESCE(e.cantidadDisponible, 0) > (COALESCE(pic.stockMinimo, 0) * 0.5) AND COALESCE(e.cantidadDisponible, 0) < COALESCE(pic.stockMinimo, 0) ";
        } elseif ($estadoStock === "OK") {
            $where .= " AND (COALESCE(pic.stockMinimo, 0) <= 0 OR COALESCE(e.cantidadDisponible, 0) >= COALESCE(pic.stockMinimo, 0)) ";
        }
    }

    if (in_array($estadoVencimiento, ["VIGENTE", "POR_VENCER", "VENCIDO", "SIN_FECHA"], true)) {
        if ($estadoVencimiento === "SIN_FECHA") {
            $where .= " AND (il.fechaVencimiento IS NULL OR il.fechaVencimiento = '0000-00-00') ";
        } elseif ($estadoVencimiento === "VENCIDO") {
            $where .= " AND il.fechaVencimiento IS NOT NULL AND il.fechaVencimiento <> '0000-00-00' AND il.fechaVencimiento < CURDATE() ";
        } elseif ($estadoVencimiento === "POR_VENCER") {
            $where .= " AND il.fechaVencimiento IS NOT NULL AND il.fechaVencimiento <> '0000-00-00' AND il.fechaVencimiento >= CURDATE() AND il.fechaVencimiento <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) ";
        } elseif ($estadoVencimiento === "VIGENTE") {
            $where .= " AND il.fechaVencimiento IS NOT NULL AND il.fechaVencimiento <> '0000-00-00' AND il.fechaVencimiento > DATE_ADD(CURDATE(), INTERVAL 30 DAY) ";
        }
    }

    $sql = ex_select_existencias_sql() . ex_base_existencias_sql() . "
        WHERE $where
        ORDER BY
            b.nombre ASC,
            u.nombre ASC,
            pc.descripcion ASC,
            CASE
                WHEN il.fechaVencimiento IS NULL OR il.fechaVencimiento = '0000-00-00' THEN 2
                WHEN il.fechaVencimiento < CURDATE() THEN 0
                WHEN il.fechaVencimiento <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 1
                ELSE 3
            END ASC,
            il.fechaVencimiento ASC,
            il.lote ASC
        LIMIT $limite
    ";

    $filas = ex_obtener_filas($sql);
    $data = array_map("ex_formatear_existencia", $filas);

    $resumen = [
        "totalRegistros" => count($data),
        "totalProductos" => 0,
        "totalBodegas" => 0,
        "totalLotes" => 0,
        "totalDisponible" => 0,
        "totalReservado" => 0,
        "totalBloqueado" => 0,
        "totalGeneral" => 0,
        "totalVencidos" => 0,
        "totalPorVencer" => 0,
        "totalSinFecha" => 0,
        "totalStockBajo" => 0,
        "totalStockCritico" => 0,
        "totalSinStock" => 0,
        "totalStockSinConfigurar" => 0
    ];

    $productosUnicos = [];
    $bodegasUnicas = [];
    $lotesUnicos = [];

    foreach ($data as $item) {
        $productosUnicos[$item["idProducto"]] = true;
        $bodegasUnicas[$item["idBodega"]] = true;

        if ($item["idLote"]) {
            $lotesUnicos[$item["idLote"]] = true;
        }

        $resumen["totalDisponible"] += floatval($item["cantidadDisponible"]);
        $resumen["totalReservado"] += floatval($item["cantidadReservada"]);
        $resumen["totalBloqueado"] += floatval($item["cantidadBloqueada"]);
        $resumen["totalGeneral"] += floatval($item["cantidadTotal"]);

        if ($item["estadoVencimiento"] === "VENCIDO") {
            $resumen["totalVencidos"]++;
        } elseif ($item["estadoVencimiento"] === "POR_VENCER") {
            $resumen["totalPorVencer"]++;
        } elseif ($item["estadoVencimiento"] === "SIN_FECHA") {
            $resumen["totalSinFecha"]++;
        }

        if ($item["estadoStock"] === "BAJO") {
            $resumen["totalStockBajo"]++;
        } elseif ($item["estadoStock"] === "CRITICO") {
            $resumen["totalStockCritico"]++;
        } elseif ($item["estadoStock"] === "SIN_STOCK") {
            $resumen["totalSinStock"]++;
        } elseif ($item["estadoStock"] === "SIN_CONFIGURAR") {
            $resumen["totalStockSinConfigurar"]++;
        }
    }

    $resumen["totalProductos"] = count($productosUnicos);
    $resumen["totalBodegas"] = count($bodegasUnicas);
    $resumen["totalLotes"] = count($lotesUnicos);

    ex_responder(
        "si",
        "Existencias consultadas correctamente",
        $data,
        [
            "total" => count($data),
            "resumen" => $resumen,
            "filtros" => [
                "q" => $q,
                "idProducto" => $idProducto,
                "idBodega" => $idBodega,
                "idUbicacion" => $idUbicacion,
                "idLote" => $idLote,
                "idTipoProducto" => $idTipoProducto,
                "estadoVencimiento" => $estadoVencimiento,
                "estadoStock" => $estadoStock,
                "soloDisponibles" => $soloDisponibles,
                "incluirCeros" => $incluirCeros,
                "limite" => $limite
            ]
        ]
    );
} catch (Throwable $e) {
    ex_responder(
        "no",
        "Error consultando existencias de inventario",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
