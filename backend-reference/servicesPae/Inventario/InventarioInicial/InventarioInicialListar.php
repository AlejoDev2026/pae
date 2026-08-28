<?php

require_once __DIR__ . "/_InventarioInicialComun.php";

try {
    $db = ii_buscar_conexion();
    $idUsuario = ii_entero($_GET["idUsuario"] ?? 0, "idUsuario");
    ii_validar_usuario_administrativo($db, $idUsuario);

    $estado = strtoupper(ii_texto($_GET["estado"] ?? "", 20));
    $idBodega = intval($_GET["idBodega"] ?? 0);
    $busqueda = ii_texto($_GET["q"] ?? "", 100);

    $sql = "SELECT
                d.id,
                d.id AS idDocumento,
                d.consecutivo,
                d.fechaDocumento,
                d.estadoProceso,
                d.observacion,
                d.fechaFinalizacion,
                d.created_at,
                d.updated_at,
                b.id AS idBodega,
                b.codigo AS codigoBodega,
                b.nombre AS nombreBodega,
                COUNT(DISTINCT dd.id) AS totalProductos,
                COUNT(ddl.id) AS totalRegistros,
                ROUND(SUM(ddl.cantidad), 3) AS totalCantidad
            FROM InventarioDocumentos d
            INNER JOIN TiposDocumentoInventario td
                ON td.id = d.idTipoDocumento
            INNER JOIN InventarioDocumentoDetalle dd
                ON dd.idDocumento = d.id
            INNER JOIN InventarioDocumentoDetalleLotes ddl
                ON ddl.idDocumentoDetalle = dd.id
            INNER JOIN BodegasInventario b
                ON b.id = ddl.idBodega
            WHERE " . ii_es_tipo_inventario_inicial_sql("td");

    $tipos = "";
    $valores = [];

    if ($estado !== "") {
        $estadosValidos = [
            II_ESTADO_BORRADOR,
            II_ESTADO_FINALIZADA,
            II_ESTADO_ANULADA
        ];

        if (!in_array($estado, $estadosValidos, true)) {
            ii_responder(
                false,
                "El estado solicitado no es válido.",
                [],
                [],
                422
            );
        }

        $sql .= " AND d.estadoProceso = ?";
        $tipos .= "s";
        $valores[] = $estado;
    }

    if ($idBodega > 0) {
        $sql .= " AND ddl.idBodega = ?";
        $tipos .= "i";
        $valores[] = $idBodega;
    }

    if ($busqueda !== "") {
        $sql .= " AND (
                    d.consecutivo LIKE ?
                    OR b.nombre LIKE ?
                    OR b.codigo LIKE ?
                    OR d.observacion LIKE ?
                  )";
        $like = "%" . $busqueda . "%";
        $tipos .= "ssss";
        $valores[] = $like;
        $valores[] = $like;
        $valores[] = $like;
        $valores[] = $like;
    }

    $sql .= " GROUP BY
                d.id,
                d.consecutivo,
                d.fechaDocumento,
                d.estadoProceso,
                d.observacion,
                d.fechaFinalizacion,
                d.created_at,
                d.updated_at,
                b.id,
                b.codigo,
                b.nombre
              ORDER BY d.id DESC";

    $stmt = ii_preparar($db, $sql);

    if ($tipos !== "") {
        ii_bind_parametros($stmt, $tipos, $valores);
    }

    $stmt->execute();
    $filas = ii_stmt_filas($stmt);
    $documentos = [];

    foreach ($filas as $fila) {
        $fila["id"] = intval($fila["id"]);
        $fila["idDocumento"] = intval($fila["idDocumento"]);
        $fila["idBodega"] = intval($fila["idBodega"]);
        $fila["totalProductos"] = intval($fila["totalProductos"]);
        $fila["totalRegistros"] = intval($fila["totalRegistros"]);
        $fila["totalCantidad"] = round(
            floatval($fila["totalCantidad"]),
            3
        );
        $fila["editable"] = (
            strtoupper((string)$fila["estadoProceso"])
            === II_ESTADO_BORRADOR
        );
        $fila["finalizable"] = $fila["editable"];
        $documentos[] = $fila;
    }

    $stmt->close();

    ii_responder(
        true,
        "Inventarios iniciales consultados correctamente.",
        [
            "documentos" => $documentos,
            "total" => count($documentos)
        ]
    );
} catch (Throwable $error) {
    ii_responder(
        false,
        "Error consultando los inventarios iniciales.",
        [],
        ["error" => ii_mensaje_excepcion($error)],
        500
    );
}

?>
