<?php
require_once __DIR__ . "/InventarioMovimientosHelper.php";

try {
    $limite = intval(km_parametro("limite", 500));

    if ($limite <= 0 || $limite > 2000) {
        $limite = 500;
    }

    $orden = strtoupper(km_limpiar_texto(km_parametro("orden", "DESC")));

    if (!in_array($orden, ["ASC", "DESC"], true)) {
        $orden = "DESC";
    }

    $whereData = km_where_movimientos_desde_parametros();
    $where = $whereData["where"];

    $sql = km_select_movimientos_sql() . km_base_movimientos_sql() . "
        WHERE $where
        ORDER BY
            m.fechaMovimiento $orden,
            m.id $orden
        LIMIT $limite
    ";

    $filas = km_obtener_filas($sql);
    $data = array_map("km_formatear_movimiento", $filas);

    $resumen = km_resumen_desde_movimientos($data);

    km_responder(
        "si",
        "Movimientos consultados correctamente",
        $data,
        [
            "total" => count($data),
            "resumen" => $resumen,
            "filtros" => array_merge(
                $whereData["filtros"],
                [
                    "limite" => $limite,
                    "orden" => $orden
                ]
            )
        ]
    );
} catch (Throwable $e) {
    km_responder(
        "no",
        "Error consultando movimientos de inventario",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
