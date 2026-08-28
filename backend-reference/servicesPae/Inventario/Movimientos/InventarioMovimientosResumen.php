<?php
require_once __DIR__ . "/InventarioMovimientosHelper.php";

try {
    $agruparPor = strtoupper(km_limpiar_texto(km_parametro("agruparPor", "TIPO_MOVIMIENTO")));
    $limite = intval(km_parametro("limite", 500));

    if ($limite <= 0 || $limite > 2000) {
        $limite = 500;
    }

    $whereData = km_where_movimientos_desde_parametros();
    $where = $whereData["where"];

    $select = "";
    $groupBy = "";
    $orderBy = "cantidadTotal DESC";

    switch ($agruparPor) {
        case "DIA":
            $select = "
                DATE(m.fechaMovimiento) AS codigo,
                DATE(m.fechaMovimiento) AS nombre,
                DATE(m.fechaMovimiento) AS fecha
            ";
            $groupBy = "DATE(m.fechaMovimiento)";
            $orderBy = "fecha DESC";
            break;

        case "BODEGA":
            $select = "
                CAST(m.idBodega AS CHAR) AS codigo,
                b.nombre AS nombre,
                b.codigo AS codigoBodega
            ";
            $groupBy = "m.idBodega, b.nombre, b.codigo";
            $orderBy = "b.nombre ASC";
            break;

        case "PRODUCTO":
            $select = "
                CAST(m.idProducto AS CHAR) AS codigo,
                pc.descripcion AS nombre,
                pc.codigo AS codigoProducto
            ";
            $groupBy = "m.idProducto, pc.descripcion, pc.codigo";
            $orderBy = "pc.descripcion ASC";
            break;

        case "DOCUMENTO":
            $select = "
                COALESCE(d.consecutivo, 'SIN_DOCUMENTO') AS codigo,
                COALESCE(td.nombre, 'Sin documento') AS nombre,
                d.fechaDocumento AS fechaDocumento
            ";
            $groupBy = "d.id, d.consecutivo, td.nombre, d.fechaDocumento";
            $orderBy = "d.fechaDocumento DESC, d.consecutivo DESC";
            break;

        case "NATURALEZA":
            $select = "
                COALESCE(td.naturaleza, 'SIN_NATURALEZA') AS codigo,
                COALESCE(td.naturaleza, 'Sin naturaleza') AS nombre
            ";
            $groupBy = "td.naturaleza";
            $orderBy = "nombre ASC";
            break;

        case "TIPO_MOVIMIENTO":
        default:
            $agruparPor = "TIPO_MOVIMIENTO";
            $select = "
                COALESCE(m.tipoMovimiento, 'SIN_TIPO') AS codigo,
                COALESCE(m.tipoMovimiento, 'Sin tipo') AS nombre
            ";
            $groupBy = "m.tipoMovimiento";
            $orderBy = "nombre ASC";
            break;
    }

    $filas = km_obtener_filas("
        SELECT
            $select,
            COUNT(*) AS totalMovimientos,
            COALESCE(SUM(m.cantidad), 0) AS cantidadTotal,
            COALESCE(SUM(CASE
                WHEN UPPER(m.tipoMovimiento) LIKE '%ENTRADA%'
                  OR UPPER(m.tipoMovimiento) LIKE '%INGRESO%'
                  OR UPPER(m.tipoMovimiento) LIKE '%AJUSTE_POSITIVO%'
                  OR UPPER(m.tipoMovimiento) LIKE '%TRASLADO_ENTRADA%'
                  OR UPPER(m.tipoMovimiento) LIKE '%INVENTARIO_INICIAL%'
                THEN m.cantidad ELSE 0 END), 0) AS cantidadEntrada,
            COALESCE(SUM(CASE
                WHEN UPPER(m.tipoMovimiento) LIKE '%SALIDA%'
                  OR UPPER(m.tipoMovimiento) LIKE '%EGRESO%'
                  OR UPPER(m.tipoMovimiento) LIKE '%AJUSTE_NEGATIVO%'
                  OR UPPER(m.tipoMovimiento) LIKE '%TRASLADO_SALIDA%'
                THEN m.cantidad ELSE 0 END), 0) AS cantidadSalida,
            COALESCE(SUM(CASE
                WHEN UPPER(m.tipoMovimiento) LIKE '%RESERV%'
                  AND UPPER(m.tipoMovimiento) NOT LIKE '%LIBER%'
                THEN m.cantidad ELSE 0 END), 0) AS cantidadReserva,
            COALESCE(SUM(CASE
                WHEN UPPER(m.tipoMovimiento) LIKE '%LIBER%'
                  AND UPPER(m.tipoMovimiento) LIKE '%RESERV%'
                THEN m.cantidad ELSE 0 END), 0) AS cantidadLiberacionReserva,
            COALESCE(SUM(CASE
                WHEN UPPER(m.tipoMovimiento) LIKE '%BLOQUE%'
                THEN m.cantidad ELSE 0 END), 0) AS cantidadBloqueo
        " . km_base_movimientos_sql() . "
        WHERE $where
        GROUP BY $groupBy
        ORDER BY $orderBy
        LIMIT $limite
    ");

    $data = array_map(function ($fila) {
        return [
            "codigo" => $fila["codigo"],
            "nombre" => $fila["nombre"],
            "fecha" => $fila["fecha"] ?? null,
            "fechaDocumento" => $fila["fechaDocumento"] ?? null,
            "codigoBodega" => $fila["codigoBodega"] ?? null,
            "codigoProducto" => $fila["codigoProducto"] ?? null,
            "totalMovimientos" => intval($fila["totalMovimientos"]),
            "cantidadTotal" => km_numero($fila["cantidadTotal"]),
            "cantidadEntrada" => km_numero($fila["cantidadEntrada"]),
            "cantidadSalida" => km_numero($fila["cantidadSalida"]),
            "cantidadReserva" => km_numero($fila["cantidadReserva"]),
            "cantidadLiberacionReserva" => km_numero($fila["cantidadLiberacionReserva"]),
            "cantidadBloqueo" => km_numero($fila["cantidadBloqueo"])
        ];
    }, $filas);

    $resumenGeneral = [
        "totalGrupos" => count($data),
        "totalMovimientos" => 0,
        "cantidadTotal" => 0,
        "cantidadEntrada" => 0,
        "cantidadSalida" => 0,
        "cantidadReserva" => 0,
        "cantidadLiberacionReserva" => 0,
        "cantidadBloqueo" => 0
    ];

    foreach ($data as $item) {
        $resumenGeneral["totalMovimientos"] += intval($item["totalMovimientos"]);
        $resumenGeneral["cantidadTotal"] += floatval($item["cantidadTotal"]);
        $resumenGeneral["cantidadEntrada"] += floatval($item["cantidadEntrada"]);
        $resumenGeneral["cantidadSalida"] += floatval($item["cantidadSalida"]);
        $resumenGeneral["cantidadReserva"] += floatval($item["cantidadReserva"]);
        $resumenGeneral["cantidadLiberacionReserva"] += floatval($item["cantidadLiberacionReserva"]);
        $resumenGeneral["cantidadBloqueo"] += floatval($item["cantidadBloqueo"]);
    }

    foreach ([
        "cantidadTotal",
        "cantidadEntrada",
        "cantidadSalida",
        "cantidadReserva",
        "cantidadLiberacionReserva",
        "cantidadBloqueo"
    ] as $campo) {
        $resumenGeneral[$campo] = km_numero($resumenGeneral[$campo]);
    }

    km_responder(
        "si",
        "Resumen de movimientos consultado correctamente",
        $data,
        [
            "total" => count($data),
            "resumen" => $resumenGeneral,
            "agruparPor" => $agruparPor,
            "filtros" => array_merge(
                $whereData["filtros"],
                ["limite" => $limite]
            )
        ]
    );
} catch (Throwable $e) {
    km_responder(
        "no",
        "Error consultando resumen de movimientos",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
