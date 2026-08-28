<?php
require_once __DIR__ . "/InventarioAjustesHelper.php";

try {
    $idProducto = intval(aj_parametro("idProducto", 0));
    $idBodega = intval(aj_parametro("idBodega", 0));
    $idUbicacion = intval(aj_parametro("idUbicacion", 0));
    $idTipoDocumento = intval(aj_parametro("idTipoDocumento", 0));
    $q = aj_limpiar_texto(aj_parametro("q", aj_parametro("busqueda", "")));
    $limite = intval(aj_parametro("limite", 100));

    if ($limite <= 0 || $limite > 500) {
        $limite = 100;
    }

    if ($idProducto <= 0) {
        aj_responder("no", "Debe enviar el producto", [], [], 400);
    }

    if ($idBodega <= 0) {
        aj_responder("no", "Debe enviar la bodega", [], [], 400);
    }

    $tipoAjuste = "";

    if ($idTipoDocumento > 0) {
        $tipoDocumento = aj_validar_tipo_documento($idTipoDocumento);
        $tipoAjuste = $tipoDocumento["tipoAjuste"];
    }

    $producto = aj_obtener_producto_inventario($idProducto);

    if (!$producto) {
        aj_responder("no", "El producto no está activo o no está configurado para inventario", [], [], 404);
    }

    $manejaLote = intval($producto["manejaLote"]) === 1;

    if (!$manejaLote) {
        $existencia = aj_obtener_existencia($idProducto, 0, $idBodega, $idUbicacion, false);

        aj_responder(
            "si",
            "El producto no requiere lote",
            [[
                "idExistencia" => $existencia ? intval($existencia["id"]) : null,
                "idProducto" => $idProducto,
                "idLote" => null,
                "id" => null,
                "lote" => null,
                "cantidadDisponible" => $existencia ? floatval($existencia["cantidadDisponible"]) : 0,
                "unidad" => $producto["unidadBaseInventario"] ?: "UND",
                "manejaLote" => 0,
                "manejaVencimiento" => intval($producto["manejaVencimiento"])
            ]]
        );
    }

    $whereLote = "
        il.idProducto = $idProducto
        AND il.estado = 1
    ";

    if ($q !== "") {
        $qEsc = aj_esc($q);
        $whereLote .= " AND il.lote LIKE '%$qEsc%' ";
    }

    if ($tipoAjuste === "NEGATIVO") {
        $where = "
            e.idProducto = $idProducto
            AND e.idBodega = $idBodega
            AND e.cantidadDisponible > 0
            AND e.idLote IS NOT NULL
            AND il.estado = 1
        ";

        if ($idUbicacion > 0) {
            $where .= " AND e.idUbicacion = $idUbicacion ";
        }

        if ($q !== "") {
            $qEsc = aj_esc($q);
            $where .= " AND il.lote LIKE '%$qEsc%' ";
        }

        $filas = aj_obtener_filas("
            SELECT
                e.id AS idExistencia,
                e.idProducto,
                e.idLote,
                e.idBodega,
                e.idUbicacion,
                e.cantidadDisponible,
                e.cantidadReservada,
                e.cantidadBloqueada,
                pc.codigo AS codigoProducto,
                pc.descripcion AS producto,
                pic.manejaLote,
                pic.manejaVencimiento,
                pic.unidadBaseInventario,
                il.lote,
                il.fechaFabricacion,
                il.fechaVencimiento,
                il.fechaIngreso,
                b.codigo AS codigoBodega,
                b.nombre AS bodega,
                u.codigo AS codigoUbicacion,
                u.nombre AS ubicacion
            FROM InventarioExistencias e
            INNER JOIN ProductosCatalogo pc
                ON pc.id = e.idProducto
            INNER JOIN ProductosInventarioConfig pic
                ON pic.idProducto = pc.id
                AND pic.estado = 1
            INNER JOIN InventarioLotes il
                ON il.id = e.idLote
            INNER JOIN BodegasInventario b
                ON b.id = e.idBodega
            LEFT JOIN UbicacionesInventario u
                ON u.id = e.idUbicacion
            WHERE $where
            ORDER BY
                CASE
                    WHEN il.fechaVencimiento IS NULL OR il.fechaVencimiento = '0000-00-00' THEN 2
                    WHEN il.fechaVencimiento < CURDATE() THEN 3
                    ELSE 1
                END,
                il.fechaVencimiento ASC,
                il.lote ASC
            LIMIT $limite
        ");
    } else {
        $filas = aj_obtener_filas("
            SELECT
                NULL AS idExistencia,
                il.idProducto,
                il.id AS idLote,
                $idBodega AS idBodega,
                " . ($idUbicacion > 0 ? $idUbicacion : "NULL") . " AS idUbicacion,
                COALESCE(e.cantidadDisponible, 0) AS cantidadDisponible,
                COALESCE(e.cantidadReservada, 0) AS cantidadReservada,
                COALESCE(e.cantidadBloqueada, 0) AS cantidadBloqueada,
                pc.codigo AS codigoProducto,
                pc.descripcion AS producto,
                pic.manejaLote,
                pic.manejaVencimiento,
                pic.unidadBaseInventario,
                il.lote,
                il.fechaFabricacion,
                il.fechaVencimiento,
                il.fechaIngreso,
                b.codigo AS codigoBodega,
                b.nombre AS bodega,
                u.codigo AS codigoUbicacion,
                u.nombre AS ubicacion
            FROM InventarioLotes il
            INNER JOIN ProductosCatalogo pc
                ON pc.id = il.idProducto
            INNER JOIN ProductosInventarioConfig pic
                ON pic.idProducto = pc.id
                AND pic.estado = 1
            INNER JOIN BodegasInventario b
                ON b.id = $idBodega
            LEFT JOIN UbicacionesInventario u
                ON u.id = " . ($idUbicacion > 0 ? $idUbicacion : "NULL") . "
            LEFT JOIN InventarioExistencias e
                ON e.idProducto = il.idProducto
                AND e.idLote = il.id
                AND e.idBodega = $idBodega
                AND " . ($idUbicacion > 0 ? "e.idUbicacion = $idUbicacion" : "e.idUbicacion IS NULL") . "
            WHERE $whereLote
            ORDER BY
                CASE
                    WHEN il.fechaVencimiento IS NULL OR il.fechaVencimiento = '0000-00-00' THEN 2
                    WHEN il.fechaVencimiento < CURDATE() THEN 3
                    ELSE 1
                END,
                il.fechaVencimiento ASC,
                il.lote ASC
            LIMIT $limite
        ");
    }

    $data = array_map(function ($fila) use ($tipoAjuste) {
        $fechaVencimiento = $fila["fechaVencimiento"] ?? null;

        return [
            "idExistencia" => $fila["idExistencia"] !== null ? intval($fila["idExistencia"]) : null,
            "idProducto" => intval($fila["idProducto"]),
            "codigoProducto" => $fila["codigoProducto"],
            "producto" => $fila["producto"],
            "descripcion" => $fila["producto"],
            "idLote" => $fila["idLote"] !== null ? intval($fila["idLote"]) : null,
            "id" => $fila["idLote"] !== null ? intval($fila["idLote"]) : null,
            "lote" => $fila["lote"],
            "fechaFabricacion" => $fila["fechaFabricacion"],
            "fechaVencimiento" => $fechaVencimiento,
            "fechaIngreso" => $fila["fechaIngreso"],
            "vencido" => aj_lote_vencido($fechaVencimiento),
            "idBodega" => intval($fila["idBodega"]),
            "codigoBodega" => $fila["codigoBodega"],
            "bodega" => $fila["bodega"],
            "idUbicacion" => $fila["idUbicacion"] !== null ? intval($fila["idUbicacion"]) : null,
            "codigoUbicacion" => $fila["codigoUbicacion"],
            "ubicacion" => $fila["ubicacion"],
            "cantidadDisponible" => floatval($fila["cantidadDisponible"]),
            "cantidadReservada" => floatval($fila["cantidadReservada"] ?? 0),
            "cantidadBloqueada" => floatval($fila["cantidadBloqueada"] ?? 0),
            "unidad" => $fila["unidadBaseInventario"] ?: "UND",
            "manejaLote" => intval($fila["manejaLote"]),
            "manejaVencimiento" => intval($fila["manejaVencimiento"]),
            "tipoAjuste" => $tipoAjuste
        ];
    }, $filas);

    aj_responder(
        "si",
        "Lotes consultados correctamente",
        $data,
        ["total" => count($data)]
    );
} catch (Throwable $e) {
    aj_responder(
        "no",
        "Error consultando lotes para ajuste",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
