<?php
require_once __DIR__ . "/InventarioAjustesHelper.php";

try {
    $idUsuario = intval(aj_parametro("idUsuario", aj_parametro("idUsuarioRegistro", 0)));

    $tiposDocumento = aj_obtener_filas("
        SELECT
            id,
            codigo,
            nombre,
            naturaleza,
            tipoMovimiento,
            afectaInventario,
            requiereOrigen,
            requiereDestino,
            permiteManual,
            descripcion,
            estado
        FROM TiposDocumentoInventario
        WHERE
            estado = 1
            AND permiteManual = 1
            AND afectaInventario = 1
            AND (
                naturaleza = 'AJUSTE'
                OR naturaleza LIKE '%AJUSTE%'
                OR tipoMovimiento LIKE '%AJUSTE%'
                OR codigo LIKE '%AJUSTE%'
                OR nombre LIKE '%AJUSTE%'
            )
        ORDER BY nombre ASC
    ");

    $tiposDocumento = array_values(array_filter($tiposDocumento, function ($fila) {
        $tipoAjuste = aj_resolver_tipo_ajuste($fila);
        return aj_es_tipo_ajuste($fila) && in_array($tipoAjuste, ["POSITIVO", "NEGATIVO"], true);
    }));

    $bodegas = aj_obtener_filas("
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

    $ubicaciones = aj_obtener_filas("
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

    $operador = null;

    if ($idUsuario > 0) {
        $operadorFila = aj_obtener_operador_por_usuario($idUsuario);

        if ($operadorFila) {
            $nombre = trim((string)($operadorFila["nombreCompleto"] ?: trim(($operadorFila["nombre"] ?? "") . " " . ($operadorFila["apellido"] ?? ""))));

            $operador = [
                "idOperador" => intval($operadorFila["idOperador"]),
                "idUsuario" => intval($operadorFila["idUsuario"]),
                "codigo" => $operadorFila["codigo"],
                "nombre" => $nombre,
                "nombreCompleto" => $nombre,
                "cargo" => $operadorFila["cargo"],
                "estadoOperador" => intval($operadorFila["estadoOperador"]),
                "estadoUsuario" => intval($operadorFila["estadoUsuario"])
            ];
        }
    }

    aj_responder(
        "si",
        "Datos de formulario consultados correctamente",
        [
            "tiposDocumento" => array_map(function ($fila) {
                return [
                    "id" => intval($fila["id"]),
                    "idTipoDocumento" => intval($fila["id"]),
                    "codigo" => $fila["codigo"],
                    "nombre" => $fila["nombre"],
                    "naturaleza" => aj_normalizar_naturaleza($fila["naturaleza"]),
                    "tipoMovimiento" => $fila["tipoMovimiento"],
                    "tipoAjuste" => aj_resolver_tipo_ajuste($fila),
                    "afectaInventario" => intval($fila["afectaInventario"]),
                    "requiereOrigen" => intval($fila["requiereOrigen"]),
                    "requiereDestino" => intval($fila["requiereDestino"]),
                    "permiteManual" => intval($fila["permiteManual"]),
                    "descripcion" => $fila["descripcion"] ?? null,
                    "estado" => intval($fila["estado"])
                ];
            }, $tiposDocumento),

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

            "operador" => $operador,
            "fechaActual" => date("Y-m-d")
        ],
        [
            "totalTiposAjuste" => count($tiposDocumento)
        ]
    );
} catch (Throwable $e) {
    aj_responder(
        "no",
        "Error consultando datos de formulario de ajuste",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
