<?php
require_once __DIR__ . "/InventarioMovimientosHelper.php";

try {
    $bodegas = km_obtener_filas("
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

    $ubicaciones = km_obtener_filas("
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

    $tiposProducto = km_obtener_filas("
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

    $tiposDocumento = km_obtener_filas("
        SELECT
            id,
            codigo,
            nombre,
            naturaleza,
            tipoMovimiento,
            afectaInventario,
            estado
        FROM TiposDocumentoInventario
        WHERE estado = 1
        ORDER BY naturaleza ASC, nombre ASC
    ");

    $tiposMovimiento = km_obtener_filas("
        SELECT DISTINCT
            m.tipoMovimiento AS codigo,
            m.tipoMovimiento AS nombre
        FROM InventarioMovimientos m
        WHERE
            m.tipoMovimiento IS NOT NULL
            AND m.tipoMovimiento <> ''
        ORDER BY m.tipoMovimiento ASC
    ");

    $operadores = km_obtener_filas("
        SELECT
            id,
            codigo,
            documento,
            nombre,
            apellido,
            nombreCompleto,
            cargo,
            estado
        FROM InventarioOperadores
        WHERE estado = 1
        ORDER BY nombreCompleto ASC, nombre ASC
    ");

    km_responder(
        "si",
        "Datos de formulario de movimientos consultados correctamente",
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

            "tiposDocumento" => array_map(function ($fila) {
                return [
                    "id" => intval($fila["id"]),
                    "idTipoDocumento" => intval($fila["id"]),
                    "codigo" => $fila["codigo"],
                    "nombre" => $fila["nombre"],
                    "naturaleza" => $fila["naturaleza"],
                    "tipoMovimiento" => $fila["tipoMovimiento"],
                    "afectaInventario" => intval($fila["afectaInventario"]),
                    "estado" => intval($fila["estado"])
                ];
            }, $tiposDocumento),

            "tiposMovimiento" => array_map(function ($fila) {
                return [
                    "codigo" => $fila["codigo"],
                    "nombre" => $fila["nombre"],
                    "sentido" => km_sentido_movimiento($fila["codigo"])
                ];
            }, $tiposMovimiento),

            "operadores" => array_map(function ($fila) {
                return [
                    "id" => intval($fila["id"]),
                    "idOperador" => intval($fila["id"]),
                    "codigo" => $fila["codigo"],
                    "documento" => $fila["documento"],
                    "nombre" => $fila["nombre"],
                    "apellido" => $fila["apellido"],
                    "nombreCompleto" => $fila["nombreCompleto"],
                    "cargo" => $fila["cargo"],
                    "estado" => intval($fila["estado"])
                ];
            }, $operadores),

            "naturalezas" => [
                ["codigo" => "ENTRADA", "nombre" => "Entrada"],
                ["codigo" => "SALIDA", "nombre" => "Salida"],
                ["codigo" => "TRASLADO", "nombre" => "Traslado"],
                ["codigo" => "AJUSTE", "nombre" => "Ajuste"],
                ["codigo" => "INVENTARIO_INICIAL", "nombre" => "Inventario inicial"],
                ["codigo" => "NEUTRO", "nombre" => "Neutro"]
            ],

            "estadosProceso" => [
                ["codigo" => "BORRADOR", "nombre" => "Borrador"],
                ["codigo" => "FINALIZADA", "nombre" => "Finalizada"],
                ["codigo" => "ANULADA", "nombre" => "Anulada"]
            ],

            "fechaActual" => date("Y-m-d")
        ]
    );
} catch (Throwable $e) {
    km_responder(
        "no",
        "Error consultando datos de formulario de movimientos",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
