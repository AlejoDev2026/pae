<?php
require_once __DIR__ . "/InventarioExistenciasHelper.php";

try {
    $idBodega = intval(ex_parametro("idBodega", 0));
    $dias = intval(ex_parametro("dias", 30));
    $limite = intval(ex_parametro("limite", 300));

    if ($dias <= 0 || $dias > 365) {
        $dias = 30;
    }

    if ($limite <= 0 || $limite > 1000) {
        $limite = 300;
    }

    $where = "
        pc.estado = 1
        AND COALESCE(pc.idEstado, 1) = 1
        AND b.estado = 1
        AND COALESCE(e.cantidadDisponible, 0) > 0
        AND il.fechaVencimiento IS NOT NULL
        AND il.fechaVencimiento <> '0000-00-00'
        AND il.fechaVencimiento <= DATE_ADD(CURDATE(), INTERVAL $dias DAY)
    ";

    if ($idBodega > 0) {
        $where .= " AND e.idBodega = $idBodega ";
    }

    $filas = ex_obtener_filas(
        ex_select_existencias_sql() .
        ex_base_existencias_sql() .
        "
            WHERE $where
            ORDER BY
                il.fechaVencimiento ASC,
                pc.descripcion ASC,
                b.nombre ASC
            LIMIT $limite
        "
    );

    $data = array_map("ex_formatear_existencia", $filas);

    $resumen = [
        "totalAlertas" => count($data),
        "totalVencidos" => 0,
        "totalPorVencer" => 0,
        "totalDisponibleComprometido" => 0
    ];

    foreach ($data as $item) {
        if ($item["estadoVencimiento"] === "VENCIDO") {
            $resumen["totalVencidos"]++;
        } elseif ($item["estadoVencimiento"] === "POR_VENCER") {
            $resumen["totalPorVencer"]++;
        }

        $resumen["totalDisponibleComprometido"] += floatval($item["cantidadDisponible"]);
    }

    ex_responder(
        "si",
        "Alertas de vencimiento consultadas correctamente",
        $data,
        [
            "total" => count($data),
            "resumen" => $resumen,
            "dias" => $dias
        ]
    );
} catch (Throwable $e) {
    ex_responder(
        "no",
        "Error consultando alertas de vencimiento",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
