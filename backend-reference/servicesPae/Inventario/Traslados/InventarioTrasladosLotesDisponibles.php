<?php
require_once __DIR__ . "/InventarioTrasladosHelper.php";

try {
    $idProducto = intval(tr_parametro("idProducto", 0));
    $idBodegaOrigen = intval(tr_parametro("idBodegaOrigen", tr_parametro("idBodega", 0)));
    $idUbicacionOrigen = intval(tr_parametro("idUbicacionOrigen", tr_parametro("idUbicacion", 0)));
    $idTipoDocumento = intval(tr_parametro("idTipoDocumento", 0));
    $q = tr_limpiar(tr_parametro("q", tr_parametro("busqueda", "")));
    $limite = intval(tr_parametro("limite", 100));

    if ($limite <= 0 || $limite > 500) $limite = 100;
    if ($idProducto <= 0) tr_responder("no", "Debe enviar el producto", [], [], 400);
    if ($idBodegaOrigen <= 0) tr_responder("no", "Debe enviar la bodega origen", [], [], 400);
    if ($idTipoDocumento > 0) tr_validar_tipo_documento($idTipoDocumento);

    $producto = tr_producto($idProducto);
    if (!$producto) tr_responder("no", "El producto no está activo o no está configurado para inventario", [], [], 404);

    $where = "e.idProducto = $idProducto AND e.idBodega = $idBodegaOrigen AND e.cantidadDisponible > 0";

    if ($idUbicacionOrigen > 0) $where .= " AND e.idUbicacion = $idUbicacionOrigen ";
    if (intval($producto["manejaLote"]) === 1) $where .= " AND e.idLote IS NOT NULL AND il.estado = 1 ";

    if ($q !== "") {
        $qe = tr_esc($q);
        $where .= " AND (il.lote LIKE '%$qe%' OR b.nombre LIKE '%$qe%' OR u.nombre LIKE '%$qe%') ";
    }

    $filas = tr_filas("
        SELECT e.id AS idExistencia, e.idProducto, e.idLote, e.idBodega, e.idUbicacion,
               e.cantidadDisponible, e.cantidadReservada, e.cantidadBloqueada,
               pc.codigo AS codigoProducto, pc.descripcion AS producto,
               pic.manejaLote, pic.manejaVencimiento, pic.unidadBaseInventario,
               il.lote, il.fechaFabricacion, il.fechaVencimiento, il.fechaIngreso,
               b.codigo AS codigoBodega, b.nombre AS bodega,
               u.codigo AS codigoUbicacion, u.nombre AS ubicacion
        FROM InventarioExistencias e
        INNER JOIN ProductosCatalogo pc ON pc.id = e.idProducto
        INNER JOIN ProductosInventarioConfig pic ON pic.idProducto = pc.id AND pic.estado = 1
        LEFT JOIN InventarioLotes il ON il.id = e.idLote
        INNER JOIN BodegasInventario b ON b.id = e.idBodega
        LEFT JOIN UbicacionesInventario u ON u.id = e.idUbicacion
        WHERE $where
        ORDER BY CASE
            WHEN il.fechaVencimiento IS NULL OR il.fechaVencimiento = '0000-00-00' THEN 2
            WHEN il.fechaVencimiento < CURDATE() THEN 3
            ELSE 1 END,
            il.fechaVencimiento ASC,
            il.lote ASC
        LIMIT $limite
    ");

    $data = array_map(function($r) {
        return [
            "idExistencia" => intval($r["idExistencia"]),
            "idProducto" => intval($r["idProducto"]),
            "codigoProducto" => $r["codigoProducto"],
            "producto" => $r["producto"],
            "descripcion" => $r["producto"],
            "idLote" => $r["idLote"] !== null ? intval($r["idLote"]) : null,
            "id" => $r["idLote"] !== null ? intval($r["idLote"]) : null,
            "lote" => $r["lote"],
            "fechaFabricacion" => $r["fechaFabricacion"],
            "fechaVencimiento" => $r["fechaVencimiento"],
            "fechaIngreso" => $r["fechaIngreso"],
            "vencido" => tr_lote_vencido($r["fechaVencimiento"]),
            "idBodega" => intval($r["idBodega"]),
            "codigoBodega" => $r["codigoBodega"],
            "bodega" => $r["bodega"],
            "idUbicacion" => $r["idUbicacion"] !== null ? intval($r["idUbicacion"]) : null,
            "codigoUbicacion" => $r["codigoUbicacion"],
            "ubicacion" => $r["ubicacion"],
            "cantidadDisponible" => floatval($r["cantidadDisponible"]),
            "cantidadReservada" => floatval($r["cantidadReservada"] ?? 0),
            "cantidadBloqueada" => floatval($r["cantidadBloqueada"] ?? 0),
            "unidad" => $r["unidadBaseInventario"] ?: "UND",
            "manejaLote" => intval($r["manejaLote"]),
            "manejaVencimiento" => intval($r["manejaVencimiento"])
        ];
    }, $filas);

    tr_responder("si", "Lotes disponibles consultados correctamente", $data, ["total" => count($data)]);
} catch (Throwable $e) {
    tr_responder("no", "Error consultando lotes disponibles", [], ["error" => $e->getMessage()], 500);
}
?>
