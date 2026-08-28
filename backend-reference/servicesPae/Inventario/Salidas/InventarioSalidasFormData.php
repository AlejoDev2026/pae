<?php
require_once __DIR__ . "/InventarioSalidasHelper.php";

try {
    $idUsuario = intval(sal_parametro("idUsuario", sal_parametro("idUsuarioRegistro", 0)));

    $tiposDocumento = sal_obtener_filas("
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
            COALESCE(permiteLoteVencido, 0) AS permiteLoteVencido,
            descripcion,
            estado
        FROM TiposDocumentoInventario
        WHERE
            estado = 1
            AND permiteManual = 1
            AND afectaInventario = 1
            AND (
                naturaleza = 'SALIDA'
                OR naturaleza = 'SALIDA_INVENTARIO'
                OR naturaleza = 'SALIDA DE INVENTARIO'
                OR naturaleza LIKE '%SALIDA%'
            )
        ORDER BY nombre ASC
    ");

    $bodegas = sal_obtener_filas("
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

    $ubicaciones = sal_obtener_filas("
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
        $operadorFila = sal_obtener_operador_por_usuario($idUsuario);

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

    sal_responder(
        "si",
        "Datos de formulario consultados correctamente",
        [
            "tiposDocumento" => array_map(function ($fila) {
                return [
                    "id" => intval($fila["id"]),
                    "idTipoDocumento" => intval($fila["id"]),
                    "codigo" => $fila["codigo"],
                    "nombre" => $fila["nombre"],
                    "naturaleza" => sal_normalizar_naturaleza($fila["naturaleza"]),
                    "tipoMovimiento" => $fila["tipoMovimiento"],
                    "afectaInventario" => intval($fila["afectaInventario"]),
                    "requiereOrigen" => intval($fila["requiereOrigen"]),
                    "requiereDestino" => intval($fila["requiereDestino"]),
                    "permiteManual" => intval($fila["permiteManual"]),
                    "permiteLoteVencido" => intval($fila["permiteLoteVencido"]),
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
            "totalTiposSalida" => count($tiposDocumento)
        ]
    );
} catch (Throwable $e) {
    sal_responder(
        "no",
        "Error consultando datos de formulario de salida",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
