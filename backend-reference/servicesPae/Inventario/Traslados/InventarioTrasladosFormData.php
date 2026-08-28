<?php
require_once __DIR__ . "/InventarioTrasladosHelper.php";

try {
    $idUsuario = intval(tr_parametro("idUsuario", tr_parametro("idUsuarioRegistro", 0)));

    $tiposDocumento = tr_filas("
        SELECT id, codigo, nombre, naturaleza, tipoMovimiento, afectaInventario, requiereOrigen, requiereDestino, permiteManual, descripcion, estado
        FROM TiposDocumentoInventario
        WHERE estado = 1
          AND permiteManual = 1
          AND afectaInventario = 1
          AND (
              naturaleza = 'TRASLADO'
              OR naturaleza = 'TRASLADO_INVENTARIO'
              OR naturaleza LIKE '%TRASLADO%'
              OR tipoMovimiento = 'TRASLADO'
              OR tipoMovimiento LIKE '%TRASLADO%'
          )
        ORDER BY nombre ASC
    ");

    $bodegas = tr_filas("
        SELECT id, codigo, nombre, descripcion, estado
        FROM BodegasInventario
        WHERE estado = 1
        ORDER BY nombre ASC
    ");

    $ubicaciones = tr_filas("
        SELECT u.id, u.idBodega, u.codigo, u.nombre, u.descripcion, u.estado,
               b.codigo AS codigoBodega, b.nombre AS nombreBodega
        FROM UbicacionesInventario u
        INNER JOIN BodegasInventario b ON b.id = u.idBodega
        WHERE u.estado = 1 AND b.estado = 1
        ORDER BY b.nombre ASC, u.nombre ASC
    ");

    $operador = null;
    if ($idUsuario > 0) {
        $op = tr_operador_usuario($idUsuario);
        if ($op) {
            $nombre = trim((string)($op["nombreCompleto"] ?: trim(($op["nombre"] ?? "") . " " . ($op["apellido"] ?? ""))));
            $operador = [
                "idOperador" => intval($op["idOperador"]),
                "idUsuario" => intval($op["idUsuario"]),
                "codigo" => $op["codigo"],
                "nombre" => $nombre,
                "nombreCompleto" => $nombre,
                "cargo" => $op["cargo"],
                "estadoOperador" => intval($op["estadoOperador"]),
                "estadoUsuario" => intval($op["estadoUsuario"])
            ];
        }
    }

    tr_responder("si", "Datos de formulario consultados correctamente", [
        "tiposDocumento" => array_map(function($r) {
            return [
                "id" => intval($r["id"]),
                "idTipoDocumento" => intval($r["id"]),
                "codigo" => $r["codigo"],
                "nombre" => $r["nombre"],
                "naturaleza" => tr_nat($r["naturaleza"]),
                "tipoMovimiento" => $r["tipoMovimiento"],
                "afectaInventario" => intval($r["afectaInventario"]),
                "requiereOrigen" => intval($r["requiereOrigen"]),
                "requiereDestino" => intval($r["requiereDestino"]),
                "permiteManual" => intval($r["permiteManual"]),
                "descripcion" => $r["descripcion"] ?? null,
                "estado" => intval($r["estado"])
            ];
        }, $tiposDocumento),
        "bodegas" => array_map(function($r) {
            return [
                "id" => intval($r["id"]),
                "idBodega" => intval($r["id"]),
                "codigo" => $r["codigo"],
                "nombre" => $r["nombre"],
                "descripcion" => $r["descripcion"],
                "estado" => intval($r["estado"])
            ];
        }, $bodegas),
        "ubicaciones" => array_map(function($r) {
            return [
                "id" => intval($r["id"]),
                "idUbicacion" => intval($r["id"]),
                "idBodega" => intval($r["idBodega"]),
                "codigo" => $r["codigo"],
                "nombre" => $r["nombre"],
                "descripcion" => $r["descripcion"],
                "codigoBodega" => $r["codigoBodega"],
                "nombreBodega" => $r["nombreBodega"],
                "estado" => intval($r["estado"])
            ];
        }, $ubicaciones),
        "operador" => $operador,
        "fechaActual" => date("Y-m-d")
    ], ["totalTiposTraslado" => count($tiposDocumento)]);
} catch (Throwable $e) {
    tr_responder("no", "Error consultando datos de formulario de traslado", [], ["error" => $e->getMessage()], 500);
}
?>
