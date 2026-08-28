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
    $idDocumento = ii_entero(
        $data["idDocumento"] ?? $data["id"] ?? 0,
        "idDocumento"
    );
    $idUsuario = ii_entero(
        $data["idUsuario"] ?? $data["idUsuarioFinaliza"] ?? 0,
        "idUsuario"
    );
    $observacionFinalizacion = ii_texto(
        $data["observacion"] ?? "",
        1000
    );

    $acceso = ii_validar_usuario_administrativo($db, $idUsuario);
    $idOperador = intval(
        $acceso["operador"]["idOperador"] ?? 0
    );

    $db->begin_transaction();

    try {
        $documento = ii_documento($db, $idDocumento, true);

        if (!$documento) {
            throw new Exception("El inventario inicial no existe.");
        }

        if (
            strtoupper((string)$documento["estadoProceso"])
            !== II_ESTADO_BORRADOR
        ) {
            throw new Exception(
                "El inventario inicial ya no está en borrador."
            );
        }

        $detalles = ii_detalles_documento(
            $db,
            $idDocumento,
            true
        );

        if (count($detalles) === 0) {
            throw new Exception(
                "El inventario inicial no contiene productos."
            );
        }

        $idBodega = intval($detalles[0]["idBodega"]);

        foreach ($detalles as $detalle) {
            if (intval($detalle["idBodega"]) !== $idBodega) {
                throw new Exception(
                    "Todos los productos deben pertenecer a la misma bodega."
                );
            }
        }

        /*
         * El bloqueo de la bodega evita que dos procesos creen movimientos
         * iniciales simultáneos para el mismo almacén.
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
        $bodega = ii_stmt_fila($stmt);
        $stmt->close();

        if (!$bodega) {
            throw new Exception(
                "La bodega asociada al documento no existe."
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

        $tipoMovimiento = "INVENTARIO_INICIAL";
        $totalCantidad = 0.0;
        $totalMovimientos = 0;

        foreach ($detalles as $detalle) {
            $idDocumentoDetalle = intval(
                $detalle["idDocumentoDetalle"]
            );
            $idProducto = intval($detalle["idProducto"]);
            $idUbicacion = intval($detalle["idUbicacion"]);
            $idLote = intval($detalle["idLote"] ?? 0);
            $cantidad = round(floatval($detalle["cantidad"]), 3);

            if ($cantidad <= 0) {
                throw new Exception(
                    "El producto " . $detalle["descripcion"]
                        . " tiene una cantidad no válida."
                );
            }

            if (
                intval($detalle["manejaLote"]) === 1
                && $idLote <= 0
            ) {
                throw new Exception(
                    "El producto " . $detalle["descripcion"]
                        . " requiere lote."
                );
            }

            if (
                intval($detalle["manejaVencimiento"]) === 1
                && (
                    $idLote <= 0
                    || empty($detalle["fechaVencimiento"])
                )
            ) {
                throw new Exception(
                    "El producto " . $detalle["descripcion"]
                        . " requiere un lote con fecha de vencimiento."
                );
            }

            $stmt = ii_preparar(
                $db,
                "SELECT id, cantidadDisponible
                 FROM InventarioExistencias
                 WHERE idProducto = ?
                   AND idBodega = ?
                   AND COALESCE(idUbicacion, 0) = ?
                   AND COALESCE(idLote, 0) = ?
                 ORDER BY id ASC
                 LIMIT 1
                 FOR UPDATE"
            );
            $stmt->bind_param(
                "iiii",
                $idProducto,
                $idBodega,
                $idUbicacion,
                $idLote
            );
            $stmt->execute();
            $existencia = ii_stmt_fila($stmt);
            $stmt->close();

            $saldoAnterior = $existencia
                ? round(floatval($existencia["cantidadDisponible"]), 3)
                : 0.0;

            /*
             * La bodega puede tener existencias o movimientos anteriores.
             * La carga inicial se suma al disponible actual y ambos saldos
             * quedan registrados en el Kardex.
             */
            $saldoNuevo = round($saldoAnterior + $cantidad, 3);

            if ($existencia) {
                $idExistencia = intval($existencia["id"]);
                $stmt = ii_preparar(
                    $db,
                    "UPDATE InventarioExistencias
                     SET
                        cantidadDisponible = ?,
                        updated_at = NOW()
                     WHERE id = ?"
                );
                $stmt->bind_param(
                    "di",
                    $saldoNuevo,
                    $idExistencia
                );
                $stmt->execute();
                $stmt->close();
            } else {
                $stmt = ii_preparar(
                    $db,
                    "INSERT INTO InventarioExistencias
                    (
                        idProducto,
                        idLote,
                        idBodega,
                        idUbicacion,
                        cantidadDisponible,
                        cantidadReservada,
                        cantidadBloqueada,
                        created_at,
                        updated_at
                    )
                    VALUES
                    (
                        ?,
                        NULLIF(?, 0),
                        ?,
                        NULLIF(?, 0),
                        ?,
                        0,
                        0,
                        NOW(),
                        NOW()
                    )"
                );
                $stmt->bind_param(
                    "iiiid",
                    $idProducto,
                    $idLote,
                    $idBodega,
                    $idUbicacion,
                    $saldoNuevo
                );
                $stmt->execute();
                $stmt->close();
            }

            $observacionMovimiento = (
                "Saldo de apertura generado desde "
                . $documento["consecutivo"]
            );

            if ($observacionFinalizacion !== "") {
                $observacionMovimiento .= " - "
                    . $observacionFinalizacion;
            }

            /*
             * El Kardex del proyecto guarda un registro por producto/lote en
             * InventarioMovimientos; no existe InventarioMovimientosDetalle.
             */
            $stmt = ii_preparar(
                $db,
                "INSERT INTO InventarioMovimientos
                (
                    idDocumento,
                    idDocumentoDetalle,
                    idProducto,
                    idLote,
                    idBodega,
                    idUbicacion,
                    tipoMovimiento,
                    cantidad,
                    saldoAnterior,
                    saldoNuevo,
                    idUsuario,
                    fechaMovimiento,
                    observacion,
                    idUsuarioRegistro,
                    idOperador
                )
                VALUES
                (
                    ?,
                    ?,
                    ?,
                    NULLIF(?, 0),
                    ?,
                    NULLIF(?, 0),
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    NOW(),
                    ?,
                    ?,
                    NULLIF(?, 0)
                )"
            );
            $stmt->bind_param(
                "iiiiiisdddisii",
                $idDocumento,
                $idDocumentoDetalle,
                $idProducto,
                $idLote,
                $idBodega,
                $idUbicacion,
                $tipoMovimiento,
                $cantidad,
                $saldoAnterior,
                $saldoNuevo,
                $idUsuario,
                $observacionMovimiento,
                $idUsuario,
                $idOperador
            );
            $stmt->execute();
            $stmt->close();

            $stmt = ii_preparar(
                $db,
                "UPDATE InventarioDocumentoDetalle
                 SET
                    cantidadProcesada = cantidadSolicitada,
                    updated_at = NOW()
                 WHERE id = ?"
            );
            $stmt->bind_param("i", $idDocumentoDetalle);
            $stmt->execute();
            $stmt->close();

            $totalCantidad += $cantidad;
            $totalMovimientos++;
        }

        $estadoFinal = II_ESTADO_FINALIZADA;
        $stmt = ii_preparar(
            $db,
            "UPDATE InventarioDocumentos
             SET
                estadoProceso = ?,
                fechaFinalizacion = NOW(),
                idUsuarioFinaliza = ?,
                observacion = CASE
                    WHEN ? = '' THEN observacion
                    WHEN observacion IS NULL OR observacion = '' THEN ?
                    ELSE CONCAT(observacion, '\nFinalización: ', ?)
                END,
                updated_at = NOW()
             WHERE id = ?"
        );
        $stmt->bind_param(
            "sisssi",
            $estadoFinal,
            $idUsuario,
            $observacionFinalizacion,
            $observacionFinalizacion,
            $observacionFinalizacion,
            $idDocumento
        );
        $stmt->execute();
        $stmt->close();

        $db->commit();

        ii_responder(
            true,
            "Inventario inicial finalizado correctamente.",
            [
                "idDocumento" => $idDocumento,
                "consecutivo" => $documento["consecutivo"],
                "idBodega" => $idBodega,
                "estadoProceso" => II_ESTADO_FINALIZADA,
                "totalMovimientos" => $totalMovimientos,
                "totalCantidad" => round($totalCantidad, 3)
            ]
        );
    } catch (Throwable $errorTransaccion) {
        $db->rollback();
        throw $errorTransaccion;
    }
} catch (Throwable $error) {
    $mensajeError = ii_mensaje_excepcion($error);

    ii_responder(
        false,
        $mensajeError,
        [],
        ["error" => $mensajeError],
        409
    );
}

?>