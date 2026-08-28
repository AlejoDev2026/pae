<?php
require_once __DIR__ . "/InventarioMovimientosHelper.php";

try {
    /*
        Corrección:
        En la versión anterior el servicio sí respondía bien, pero antes del JSON
        se imprimían Notices de PHP por la variable $q en coincidenciaExacta.
        Eso dañaba el JSON y el front no podía parsear la respuesta.
    */

    $busqueda = km_limpiar_texto(km_parametro("q", km_parametro("busqueda", "")));
    $limite = intval(km_parametro("limite", 20));

    if ($limite <= 0 || $limite > 50) {
        $limite = 20;
    }

    if ($busqueda === "") {
        km_responder(
            "si",
            "Ingrese un texto para buscar productos",
            [],
            ["total" => 0]
        );
    }

    $busquedaEsc = km_esc($busqueda);
    $like = "%" . $busquedaEsc . "%";

    $filas = km_obtener_filas("
        SELECT DISTINCT
            pc.id,
            pc.codigo,
            pc.descripcion,
            pic.idTipoProductoInventario AS idTipoProducto,
            tpi.nombre AS tipoProducto,
            pic.manejaLote,
            pic.manejaVencimiento,
            pic.stockMinimo,
            pic.stockMaximo,
            pic.unidadBaseInventario,
            COUNT(m.id) AS totalMovimientos,
            MAX(m.fechaMovimiento) AS ultimoMovimiento
        FROM ProductosCatalogo pc
        INNER JOIN InventarioMovimientos m
            ON m.idProducto = pc.id
        LEFT JOIN ProductosInventarioConfig pic
            ON pic.idProducto = pc.id
        LEFT JOIN TiposProductoInventario tpi
            ON tpi.id = pic.idTipoProductoInventario
        WHERE
            pc.estado = 1
            AND COALESCE(pc.idEstado, 1) = 1
            AND (
                pc.codigo LIKE '$like'
                OR pc.descripcion LIKE '$like'
            )
        GROUP BY
            pc.id,
            pc.codigo,
            pc.descripcion,
            pic.idTipoProductoInventario,
            tpi.nombre,
            pic.manejaLote,
            pic.manejaVencimiento,
            pic.stockMinimo,
            pic.stockMaximo,
            pic.unidadBaseInventario
        ORDER BY
            CASE
                WHEN pc.codigo = '$busquedaEsc' THEN 0
                WHEN pc.descripcion = '$busquedaEsc' THEN 1
                WHEN pc.codigo LIKE '$busquedaEsc%' THEN 2
                WHEN pc.descripcion LIKE '$busquedaEsc%' THEN 3
                ELSE 4
            END ASC,
            pc.descripcion ASC
        LIMIT $limite
    ");

    $busquedaNormalizada = strtoupper(trim($busqueda));

    $data = array_map(function ($fila) use ($busquedaNormalizada) {
        $codigoNormalizado = strtoupper(trim((string)($fila["codigo"] ?? "")));
        $descripcionNormalizada = strtoupper(trim((string)($fila["descripcion"] ?? "")));

        return [
            "id" => intval($fila["id"]),
            "idProducto" => intval($fila["id"]),
            "codigo" => $fila["codigo"],
            "codigoProducto" => $fila["codigo"],
            "descripcion" => $fila["descripcion"],
            "producto" => $fila["descripcion"],
            "idTipoProducto" => $fila["idTipoProducto"] !== null ? intval($fila["idTipoProducto"]) : null,
            "tipoProducto" => $fila["tipoProducto"],
            "manejaLote" => intval($fila["manejaLote"] ?? 0),
            "manejaVencimiento" => intval($fila["manejaVencimiento"] ?? 0),
            "stockMinimo" => km_numero($fila["stockMinimo"] ?? 0),
            "stockMaximo" => $fila["stockMaximo"] !== null ? km_numero($fila["stockMaximo"]) : null,
            "unidad" => $fila["unidadBaseInventario"] ?: "UND",
            "totalMovimientos" => intval($fila["totalMovimientos"]),
            "ultimoMovimiento" => $fila["ultimoMovimiento"],
            "coincidenciaExacta" => (
                $codigoNormalizado === $busquedaNormalizada ||
                $descripcionNormalizada === $busquedaNormalizada
            ) ? 1 : 0
        ];
    }, $filas);

    km_responder(
        "si",
        "Productos con movimientos consultados correctamente",
        $data,
        ["total" => count($data)]
    );
} catch (Throwable $e) {
    km_responder(
        "no",
        "Error buscando productos para kardex",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
