<?php
require_once __DIR__ . "/InventarioSalidasHelper.php";

try {
    $idProducto = intval(sal_parametro("idProducto", 0));
    $idBodega = intval(sal_parametro("idBodega", 0));
    $idUbicacion = intval(sal_parametro("idUbicacion", 0));
    $idTipoDocumento = intval(sal_parametro("idTipoDocumento", 0));
    $q = sal_limpiar_texto(sal_parametro("q", sal_parametro("busqueda", "")));
    $limite = intval(sal_parametro("limite", 100));

    if ($limite <= 0 || $limite > 500) {
        $limite = 100;
    }

    if ($idProducto <= 0) {
        sal_responder("no", "Debe enviar el producto", [], [], 400);
    }

    if ($idBodega <= 0) {
        sal_responder("no", "Debe enviar la bodega", [], [], 400);
    }

    if ($idTipoDocumento <= 0) {
        sal_responder("no", "Debe enviar el tipo de salida", [], [], 400);
    }

    $producto = sal_obtener_producto_inventario($idProducto);

    if (!$producto) {
        sal_responder("no", "El producto no está activo o no está configurado para inventario", [], [], 404);
    }

    $tipoDocumento = sal_validar_tipo_documento_salida($idTipoDocumento);

    $permiteLoteVencido = intval($tipoDocumento["permiteLoteVencido"] ?? 0) === 1;
    $manejaLote = intval($producto["manejaLote"]) === 1;

    $where = "
        e.idProducto = $idProducto
        AND e.idBodega = $idBodega
        AND e.cantidadDisponible > 0
    ";

    if ($idUbicacion > 0) {
        $where .= " AND e.idUbicacion = $idUbicacion ";
    }

    if ($manejaLote) {
        $where .= " AND e.idLote IS NOT NULL AND il.estado = 1 ";
    }

    if (!$permiteLoteVencido) {
        $where .= "
            AND (
                il.fechaVencimiento IS NULL
                OR il.fechaVencimiento = ''
                OR il.fechaVencimiento = '0000-00-00'
                OR il.fechaVencimiento >= CURDATE()
            )
        ";
    }

    if ($q !== "") {
        $qEsc = sal_esc($q);
        $where .= "
            AND (
                il.lote LIKE '%$qEsc%'
                OR b.nombre LIKE '%$qEsc%'
                OR u.nombre LIKE '%$qEsc%'
            )
        ";
    }

    $filas = sal_obtener_filas("
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
        LEFT JOIN InventarioLotes il
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

    $data = array_map(function ($fila) use ($permiteLoteVencido) {
        $fechaVencimiento = $fila["fechaVencimiento"] ?? null;
        $vencido = sal_lote_vencido($fechaVencimiento);

        return [
            "idExistencia" => intval($fila["idExistencia"]),
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
            "vencido" => $vencido,
            "permiteSeleccion" => !$vencido || $permiteLoteVencido,
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
            "manejaVencimiento" => intval($fila["manejaVencimiento"])
        ];
    }, $filas);

    sal_responder(
        "si",
        "Lotes disponibles consultados correctamente",
        $data,
        [
            "total" => count($data),
            "permiteLoteVencido" => $permiteLoteVencido ? 1 : 0
        ]
    );
} catch (Throwable $e) {
    sal_responder(
        "no",
        "Error consultando lotes disponibles",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
