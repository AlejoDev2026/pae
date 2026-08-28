<?php

require_once __DIR__ . "/_InventarioInicialComun.php";

try {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        ii_responder(
            false,
            "Método no permitido. Debe utilizar POST.",
            [],
            [],
            405
        );
    }

    $db = ii_buscar_conexion();
    $data = ii_entrada_json();

    $idUsuario = ii_entero(
        $data["idUsuario"] ?? $data["idUsuarioRegistro"] ?? 0,
        "idUsuario"
    );
    $idBodega = ii_entero(
        $data["idBodega"] ?? 0,
        "idBodega"
    );
    $idUbicacionPrincipal = ii_entero(
        $data["idUbicacion"] ?? 0,
        "idUbicacion"
    );
    $fechaDocumento = ii_fecha(
        $data["fechaDocumento"] ?? $data["fechaCorte"] ?? "",
        "fechaDocumento"
    );
    $observacion = ii_texto($data["observacion"] ?? "", 1000);
    $idDocumento = intval($data["idDocumento"] ?? $data["id"] ?? 0);
    $detallesEntrada = $data["detalles"] ?? [];

    $acceso = ii_validar_usuario_administrativo($db, $idUsuario);
    $tipoDocumento = ii_tipo_documento($db);

    if (!is_array($detallesEntrada) || count($detallesEntrada) === 0) {
        ii_responder(
            false,
            "Debe agregar al menos un producto.",
            [],
            [],
            422
        );
    }

    $stmt = ii_preparar(
        $db,
        "SELECT id
         FROM BodegasInventario
         WHERE id = ?
           AND estado = 1
         LIMIT 1"
    );
    $stmt->bind_param("i", $idBodega);
    $stmt->execute();
    $bodegaValida = ii_stmt_fila($stmt);
    $stmt->close();

    if (!$bodegaValida) {
        ii_responder(
            false,
            "La bodega no existe o está inactiva.",
            [],
            [],
            422
        );
    }

    $stmt = ii_preparar(
        $db,
        "SELECT id
         FROM UbicacionesInventario
         WHERE id = ?
           AND idBodega = ?
           AND estado = 1
         LIMIT 1"
    );
    $stmt->bind_param("ii", $idUbicacionPrincipal, $idBodega);
    $stmt->execute();
    $ubicacionValida = ii_stmt_fila($stmt);
    $stmt->close();

    if (!$ubicacionValida) {
        ii_responder(
            false,
            "La ubicación no pertenece a la bodega seleccionada o está inactiva.",
            [],
            [],
            422
        );
    }

    $detalles = [];
    $claves = [];

    $stmtProducto = ii_preparar(
        $db,
        "SELECT
            pc.id,
            pc.codigo,
            pc.descripcion,
            pic.manejaLote,
            pic.manejaVencimiento,
            pic.unidadBaseInventario
         FROM ProductosCatalogo pc
         INNER JOIN ProductosInventarioConfig pic
            ON pic.idProducto = pc.id
         WHERE pc.id = ?
           AND pc.estado = 1
           AND pic.estado = 1
         LIMIT 1"
    );

    $stmtUbicacion = ii_preparar(
        $db,
        "SELECT id
         FROM UbicacionesInventario
         WHERE id = ?
           AND idBodega = ?
           AND estado = 1
         LIMIT 1"
    );

    $stmtLote = ii_preparar(
        $db,
        "SELECT id, fechaVencimiento
         FROM InventarioLotes
         WHERE id = ?
           AND idProducto = ?
           AND estado = 1
         LIMIT 1"
    );

    foreach ($detallesEntrada as $indice => $detalleEntrada) {
        if (!is_array($detalleEntrada)) {
            ii_responder(
                false,
                "La línea " . ($indice + 1) . " no es válida.",
                [],
                [],
                422
            );
        }

        $idProducto = ii_entero(
            $detalleEntrada["idProducto"] ?? 0,
            "detalles.$indice.idProducto"
        );
        $cantidad = ii_decimal_positivo(
            $detalleEntrada["cantidad"] ?? 0,
            "detalles.$indice.cantidad"
        );
        $idUbicacion = intval(
            $detalleEntrada["idUbicacion"] ?? $idUbicacionPrincipal
        );
        $idLote = intval($detalleEntrada["idLote"] ?? 0);
        $observacionDetalle = ii_texto(
            $detalleEntrada["observacion"] ?? "",
            500
        );

        if ($idUbicacion <= 0) {
            $idUbicacion = $idUbicacionPrincipal;
        }

        $stmtUbicacion->bind_param(
            "ii",
            $idUbicacion,
            $idBodega
        );
        $stmtUbicacion->execute();
        $ubicacionDetalle = ii_stmt_fila($stmtUbicacion);

        if (!$ubicacionDetalle) {
            ii_responder(
                false,
                "La ubicación de la línea " . ($indice + 1)
                    . " no pertenece a la bodega o está inactiva.",
                [],
                [],
                422
            );
        }

        $stmtProducto->bind_param("i", $idProducto);
        $stmtProducto->execute();
        $producto = ii_stmt_fila($stmtProducto);

        if (!$producto) {
            ii_responder(
                false,
                "El producto de la línea " . ($indice + 1)
                    . " no está configurado o está inactivo.",
                [],
                [],
                422
            );
        }

        $manejaLote = intval($producto["manejaLote"]);
        $manejaVencimiento = intval($producto["manejaVencimiento"]);

        if ($manejaLote === 1 && $idLote <= 0) {
            ii_responder(
                false,
                "El producto " . $producto["descripcion"]
                    . " requiere lote.",
                [],
                [],
                422
            );
        }

        if ($idLote > 0) {
            $stmtLote->bind_param("ii", $idLote, $idProducto);
            $stmtLote->execute();
            $lote = ii_stmt_fila($stmtLote);

            if (!$lote) {
                ii_responder(
                    false,
                    "El lote de la línea " . ($indice + 1)
                        . " no pertenece al producto o está inactivo.",
                    [],
                    [],
                    422
                );
            }

            if (
                $manejaVencimiento === 1
                && empty($lote["fechaVencimiento"])
            ) {
                ii_responder(
                    false,
                    "El lote del producto " . $producto["descripcion"]
                        . " requiere fecha de vencimiento.",
                    [],
                    [],
                    422
                );
            }
        }

        $clave = implode("|", [
            $idProducto,
            $idBodega,
            $idUbicacion,
            $idLote
        ]);

        if (isset($claves[$clave])) {
            ii_responder(
                false,
                "El producto, ubicación y lote de la línea "
                    . ($indice + 1) . " están repetidos.",
                [],
                [],
                422
            );
        }

        $claves[$clave] = true;
        $detalles[] = [
            "idProducto" => $idProducto,
            "cantidad" => $cantidad,
            "unidad" => ii_texto(
                $producto["unidadBaseInventario"] ?? "UND",
                50
            ),
            "idBodega" => $idBodega,
            "idUbicacion" => $idUbicacion,
            "idLote" => $idLote,
            "observacion" => $observacionDetalle
        ];
    }

    $stmtProducto->close();
    $stmtUbicacion->close();
    $stmtLote->close();

    $db->begin_transaction();

    try {
        /*
         * Bloquear la bodega serializa la creación/finalización y evita dos
         * cargas iniciales simultáneas.
         */
        $stmt = ii_preparar(
            $db,
            "SELECT id
             FROM BodegasInventario
             WHERE id = ?
             LIMIT 1
             FOR UPDATE"
        );
        $stmt->bind_param("i", $idBodega);
        $stmt->execute();
        $bodegaBloqueada = ii_stmt_fila($stmt);
        $stmt->close();

        if (!$bodegaBloqueada) {
            throw new Exception(
                "La bodega seleccionada no existe."
            );
        }

        if ($idDocumento > 0) {
            $documento = ii_documento($db, $idDocumento, true);

            if (!$documento) {
                throw new Exception(
                    "El documento de inventario inicial no existe."
                );
            }

            if (
                strtoupper((string)$documento["estadoProceso"])
                !== II_ESTADO_BORRADOR
            ) {
                throw new Exception(
                    "Solo se pueden modificar inventarios iniciales en borrador."
                );
            }

            $estadoBodega = ii_estado_bodega(
                $db,
                $idBodega,
                $idDocumento
            );

            if (!$estadoBodega["puedeCrear"]) {
                throw new Exception(
                    "La bodega ya tiene otro inventario inicial en borrador o finalizado."
                );
            }

            $stmt = ii_preparar(
                $db,
                "UPDATE InventarioDocumentos
                 SET
                    fechaDocumento = ?,
                    observacion = NULLIF(?, ''),
                    idBodegaDestino = ?,
                    idUbicacionDestino = ?,
                    updated_at = NOW()
                 WHERE id = ?"
            );
            $stmt->bind_param(
                "ssiii",
                $fechaDocumento,
                $observacion,
                $idBodega,
                $idUbicacionPrincipal,
                $idDocumento
            );
            $stmt->execute();
            $stmt->close();

            $stmt = ii_preparar(
                $db,
                "DELETE FROM InventarioDocumentoDetalle
                 WHERE idDocumento = ?"
            );
            $stmt->bind_param("i", $idDocumento);
            $stmt->execute();
            $stmt->close();
        } else {
            $estadoBodega = ii_estado_bodega($db, $idBodega);

            if (!$estadoBodega["puedeCrear"]) {
                throw new Exception(
                    "La bodega ya tiene un inventario inicial en borrador o finalizado."
                );
            }

            $idTipoDocumento = intval(
                $tipoDocumento["idTipoDocumento"]
            );
            $idOperador = intval(
                $acceso["operador"]["idOperador"] ?? 0
            );
            $consecutivo = ii_generar_consecutivo($db);
            $estado = II_ESTADO_BORRADOR;
            $tipoOrigen = "INVENTARIO_INICIAL";

            $stmt = ii_preparar(
                $db,
                "INSERT INTO InventarioDocumentos
                (
                    idTipoDocumento,
                    idUsuarioRegistro,
                    idOperador,
                    consecutivo,
                    fechaDocumento,
                    tipoOrigen,
                    observacion,
                    estadoProceso,
                    idBodegaDestino,
                    idUbicacionDestino,
                    created_at,
                    updated_at
                )
                VALUES
                (
                    ?,
                    ?,
                    NULLIF(?, 0),
                    ?,
                    ?,
                    ?,
                    NULLIF(?, ''),
                    ?,
                    ?,
                    ?,
                    NOW(),
                    NOW()
                )"
            );
            $stmt->bind_param(
                "iiisssssii",
                $idTipoDocumento,
                $idUsuario,
                $idOperador,
                $consecutivo,
                $fechaDocumento,
                $tipoOrigen,
                $observacion,
                $estado,
                $idBodega,
                $idUbicacionPrincipal
            );
            $stmt->execute();
            $idDocumento = intval($stmt->insert_id);
            $stmt->close();
        }

        $stmtDetalle = ii_preparar(
            $db,
            "INSERT INTO InventarioDocumentoDetalle
            (
                idDocumento,
                idProducto,
                cantidadSolicitada,
                cantidadProcesada,
                unidad,
                observacion,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, 0, ?, NULLIF(?, ''), NOW(), NOW())"
        );

        $stmtDetalleLote = ii_preparar(
            $db,
            "INSERT INTO InventarioDocumentoDetalleLotes
            (
                idDocumentoDetalle,
                idLote,
                idBodega,
                idUbicacion,
                cantidad,
                observacion,
                created_at
            )
            VALUES (?, NULLIF(?, 0), ?, ?, ?, NULLIF(?, ''), NOW())"
        );

        foreach ($detalles as $detalle) {
            $idProductoDetalle = intval($detalle["idProducto"]);
            $cantidadDetalle = floatval($detalle["cantidad"]);
            $unidadDetalle = $detalle["unidad"];
            $observacionDetalle = $detalle["observacion"];

            $stmtDetalle->bind_param(
                "iidss",
                $idDocumento,
                $idProductoDetalle,
                $cantidadDetalle,
                $unidadDetalle,
                $observacionDetalle
            );
            $stmtDetalle->execute();
            $idDocumentoDetalle = intval($stmtDetalle->insert_id);

            $idLoteDetalle = intval($detalle["idLote"]);
            $idBodegaDetalle = intval($detalle["idBodega"]);
            $idUbicacionDetalle = intval($detalle["idUbicacion"]);

            $stmtDetalleLote->bind_param(
                "iiiids",
                $idDocumentoDetalle,
                $idLoteDetalle,
                $idBodegaDetalle,
                $idUbicacionDetalle,
                $cantidadDetalle,
                $observacionDetalle
            );
            $stmtDetalleLote->execute();
        }

        $stmtDetalle->close();
        $stmtDetalleLote->close();
        $db->commit();

        ii_responder(
            true,
            "Inventario inicial guardado como borrador.",
            [
                "idDocumento" => $idDocumento,
                "estadoProceso" => II_ESTADO_BORRADOR
            ]
        );
    } catch (Throwable $errorTransaccion) {
        $db->rollback();
        throw $errorTransaccion;
    }
} catch (Throwable $error) {
    ii_responder(
        false,
        "No fue posible guardar el inventario inicial.",
        [],
        ["error" => ii_mensaje_excepcion($error)],
        409
    );
}

?>
