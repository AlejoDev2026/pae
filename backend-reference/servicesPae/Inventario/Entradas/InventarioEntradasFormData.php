<?php
require_once __DIR__ . "/InventarioEntradasHelper.php";

try {
    $idUsuario = intval(inv_parametro("idUsuario", inv_parametro("idUsuarioRegistro", 0)));

    $tipoDocumentoEntrada = inv_obtener_tipo_documento_entrada_mercancia();

    if (!$tipoDocumentoEntrada) {
        inv_responder(
            "no",
            "No se encontró un tipo de documento activo para Entrada de mercancía",
            [],
            [
                "sugerencia" => "Crea o activa un tipo en TiposDocumentoInventario con naturaleza='ENTRADA', afectaInventario=1 y permiteManual=1."
            ],
            400
        );
    }

    $tiposDocumento = [$tipoDocumentoEntrada];

    $bodegas = inv_obtener_filas("
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

    $ubicaciones = inv_obtener_filas("
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
        $operadorFila = inv_obtener_operador_por_usuario($idUsuario);

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

    $mapTipo = function ($fila) {
        return [
            "id" => intval($fila["id"]),
            "idTipoDocumento" => intval($fila["id"]),
            "codigo" => $fila["codigo"],
            "nombre" => $fila["nombre"],
            "naturaleza" => $fila["naturaleza"],
            "tipoMovimiento" => $fila["tipoMovimiento"],
            "afectaInventario" => intval($fila["afectaInventario"]),
            "requiereOrigen" => intval($fila["requiereOrigen"]),
            "requiereDestino" => intval($fila["requiereDestino"]),
            "permiteManual" => intval($fila["permiteManual"]),
            "descripcion" => $fila["descripcion"] ?? null,
            "estado" => intval($fila["estado"])
        ];
    };

    inv_responder(
        "si",
        "Datos de formulario consultados correctamente",
        [
            "tipoDocumentoEntrada" => $mapTipo($tipoDocumentoEntrada),
            "tiposDocumento" => array_map($mapTipo, $tiposDocumento),

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
        ]
    );
} catch (Throwable $e) {
    inv_responder(
        "no",
        "Error consultando datos de formulario de entrada",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
