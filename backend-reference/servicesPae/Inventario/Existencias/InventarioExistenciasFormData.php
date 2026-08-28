<?php
require_once __DIR__ . "/InventarioExistenciasHelper.php";

try {
    $bodegas = ex_obtener_filas("
        SELECT
            id,
            codigo,
            nombre,
            descripcion,
            estado
        FROM BodegasInventario
        WHERE estado = 1
        ORDER BY nombre ASC
    ");

    $ubicaciones = ex_obtener_filas("
        SELECT
            u.id,
            u.idBodega,
            u.codigo,
            u.nombre,
            u.descripcion,
            u.estado,
            b.codigo AS codigoBodega,
            b.nombre AS nombreBodega
        FROM UbicacionesInventario u
        INNER JOIN BodegasInventario b
            ON b.id = u.idBodega
        WHERE
            u.estado = 1
            AND b.estado = 1
        ORDER BY
            b.nombre ASC,
            u.nombre ASC
    ");

    $tiposProducto = ex_obtener_filas("
        SELECT
            id,
            codigo,
            nombre,
            descripcion,
            estado
        FROM TiposProductoInventario
        WHERE estado = 1
        ORDER BY nombre ASC
    ");

    ex_responder(
        "si",
        "Datos de formulario consultados correctamente",
        [
            "bodegas" => array_map(function ($fila) {
                return [
                    "id" => intval($fila["id"]),
                    "idBodega" => intval($fila["id"]),
                    "codigo" => $fila["codigo"],
                    "nombre" => $fila["nombre"],
                    "descripcion" => $fila["descripcion"],
                    "estado" => intval($fila["estado"])
                ];
            }, $bodegas),

            "ubicaciones" => array_map(function ($fila) {
                return [
                    "id" => intval($fila["id"]),
                    "idUbicacion" => intval($fila["id"]),
                    "idBodega" => intval($fila["idBodega"]),
                    "codigo" => $fila["codigo"],
                    "nombre" => $fila["nombre"],
                    "descripcion" => $fila["descripcion"],
                    "codigoBodega" => $fila["codigoBodega"],
                    "nombreBodega" => $fila["nombreBodega"],
                    "estado" => intval($fila["estado"])
                ];
            }, $ubicaciones),

            "tiposProducto" => array_map(function ($fila) {
                return [
                    "id" => intval($fila["id"]),
                    "idTipoProducto" => intval($fila["id"]),
                    "codigo" => $fila["codigo"],
                    "nombre" => $fila["nombre"],
                    "descripcion" => $fila["descripcion"],
                    "estado" => intval($fila["estado"])
                ];
            }, $tiposProducto),

            "estadosVencimiento" => [
                ["codigo" => "VIGENTE", "nombre" => "Vigente"],
                ["codigo" => "POR_VENCER", "nombre" => "Por vencer"],
                ["codigo" => "VENCIDO", "nombre" => "Vencido"],
                ["codigo" => "SIN_FECHA", "nombre" => "Sin fecha"]
            ],

            "fechaActual" => date("Y-m-d")
        ]
    );
} catch (Throwable $e) {
    ex_responder(
        "no",
        "Error consultando datos de formulario de existencias",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
