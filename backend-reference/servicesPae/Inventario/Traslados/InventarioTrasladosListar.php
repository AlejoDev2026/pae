<?php
require_once __DIR__ . "/InventarioTrasladosHelper.php";

try {
    $idUsuario = intval(tr_parametro("idUsuario", 0));
    $idOperador = intval(tr_parametro("idOperador", 0));
    $fechaDesde = tr_limpiar(tr_parametro("fechaDesde", ""));
    $fechaHasta = tr_limpiar(tr_parametro("fechaHasta", ""));
    $estadoProceso = strtoupper(tr_limpiar(tr_parametro("estadoProceso", "")));
    $q = tr_limpiar(tr_parametro("q", tr_parametro("busqueda", "")));
    $limite = intval(tr_parametro("limite", 100));

    if ($limite <= 0 || $limite > 500) $limite = 100;

    $where = "d.tipoOrigen = 'MANUAL' AND (
        td.naturaleza = 'TRASLADO'
        OR td.naturaleza LIKE '%TRASLADO%'
        OR td.tipoMovimiento = 'TRASLADO'
        OR td.tipoMovimiento LIKE '%TRASLADO%'
    )";

    if ($idUsuario > 0) $where .= " AND d.idUsuarioRegistro = $idUsuario ";
    if ($idOperador > 0) $where .= " AND d.idOperador = $idOperador ";
    if ($fechaDesde !== "") $where .= " AND d.fechaDocumento >= '" . tr_esc($fechaDesde) . "' ";
    if ($fechaHasta !== "") $where .= " AND d.fechaDocumento <= '" . tr_esc($fechaHasta) . "' ";
    if (in_array($estadoProceso, ["BORRADOR", "FINALIZADA", "ANULADA"], true)) $where .= " AND d.estadoProceso = '" . tr_esc($estadoProceso) . "' ";

    if ($q !== "") {
        $qe = tr_esc($q);
        $like = "%$qe%";
        $where .= " AND (d.consecutivo LIKE '$like' OR d.observacion LIKE '$like' OR td.nombre LIKE '$like' OR us.nombre LIKE '$like' OR io.nombreCompleto LIKE '$like' OR io.codigo LIKE '$like' OR bo.nombre LIKE '$like' OR bd.nombre LIKE '$like' OR uo.nombre LIKE '$like' OR ud.nombre LIKE '$like') ";
    }

    $filas = tr_filas("
        SELECT d.id, d.idTipoDocumento, d.idUsuarioRegistro, d.idOperador, d.consecutivo, d.fechaDocumento,
               d.idResponsable, d.idOperadorAsignado, d.idEstado, d.tipoOrigen, d.observacion,
               d.estadoProceso, d.fechaFinalizacion, d.idUsuarioFinaliza,
               d.idBodegaOrigen, d.idUbicacionOrigen, d.idBodegaDestino, d.idUbicacionDestino,
               d.created_at, d.updated_at,
               td.codigo AS codigoTipoDocumento, td.nombre AS tipoDocumento, td.tipoMovimiento, td.naturaleza,
               us.nombre AS usuarioRegistro,
               io.codigo AS codigoOperador, io.nombreCompleto AS operador,
               bo.codigo AS codigoBodegaOrigen, bo.nombre AS bodegaOrigen,
               uo.codigo AS codigoUbicacionOrigen, uo.nombre AS ubicacionOrigen,
               bd.codigo AS codigoBodegaDestino, bd.nombre AS bodegaDestino,
               ud.codigo AS codigoUbicacionDestino, ud.nombre AS ubicacionDestino,
               COUNT(DISTINCT dd.id) AS totalProductos,
               COALESCE(SUM(dd.cantidadSolicitada), 0) AS totalCantidad,
               COUNT(DISTINCT im.id) AS totalMovimientos
        FROM InventarioDocumentos d
        INNER JOIN TiposDocumentoInventario td ON td.id = d.idTipoDocumento
        LEFT JOIN usuarios us ON us.id = d.idUsuarioRegistro
        LEFT JOIN InventarioOperadores io ON io.id = d.idOperador
        LEFT JOIN BodegasInventario bo ON bo.id = d.idBodegaOrigen
        LEFT JOIN UbicacionesInventario uo ON uo.id = d.idUbicacionOrigen
        LEFT JOIN BodegasInventario bd ON bd.id = d.idBodegaDestino
        LEFT JOIN UbicacionesInventario ud ON ud.id = d.idUbicacionDestino
        LEFT JOIN InventarioDocumentoDetalle dd ON dd.idDocumento = d.id
        LEFT JOIN InventarioMovimientos im ON im.idDocumento = d.id
        WHERE $where
        GROUP BY d.id, d.idTipoDocumento, d.idUsuarioRegistro, d.idOperador, d.consecutivo, d.fechaDocumento,
               d.idResponsable, d.idOperadorAsignado, d.idEstado, d.tipoOrigen, d.observacion,
               d.estadoProceso, d.fechaFinalizacion, d.idUsuarioFinaliza,
               d.idBodegaOrigen, d.idUbicacionOrigen, d.idBodegaDestino, d.idUbicacionDestino,
               d.created_at, d.updated_at, td.codigo, td.nombre, td.tipoMovimiento, td.naturaleza,
               us.nombre, io.codigo, io.nombreCompleto,
               bo.codigo, bo.nombre, uo.codigo, uo.nombre, bd.codigo, bd.nombre, ud.codigo, ud.nombre
        ORDER BY d.created_at DESC, d.id DESC
        LIMIT $limite
    ");

    $data = array_map("tr_doc", $filas);

    $resumen = [
        "totalTraslados" => count($data),
        "totalBorradores" => 0,
        "totalFinalizados" => 0,
        "totalProductos" => 0,
        "totalCantidad" => 0
    ];

    foreach ($data as $item) {
        if ($item["estadoProceso"] === "BORRADOR") $resumen["totalBorradores"]++;
        if ($item["estadoProceso"] === "FINALIZADA") $resumen["totalFinalizados"]++;
        $resumen["totalProductos"] += intval($item["totalProductos"]);
        $resumen["totalCantidad"] += floatval($item["totalCantidad"]);
    }

    tr_responder("si", "Traslados de inventario consultados correctamente", $data, ["total" => count($data), "resumen" => $resumen]);
} catch (Throwable $e) {
    tr_responder("no", "Error consultando traslados de inventario", [], ["error" => $e->getMessage()], 500);
}
?>
