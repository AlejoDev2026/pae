<?php
require_once __DIR__ . "/InventarioEntradasHelper.php";
require_once __DIR__ . "/EntradaCompraHelper.php";

try {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        inv_responder("no", "Método no permitido", [], [], 405);
    }

    $input = inv_entrada_json();

    $idDocumento = intval($input["idDocumento"] ?? $input["idEntrada"] ?? $input["id"] ?? 0);
    $idUsuarioFinaliza = intval($input["idUsuarioFinaliza"] ?? $input["idUsuario"] ?? $input["idUsuarioRegistro"] ?? 0);
    $idOperador = intval($input["idOperador"] ?? 0);
    $observacionFinalizacion = inv_limpiar_texto($input["observacionFinalizacion"] ?? "");

    if ($idDocumento <= 0) {
        inv_responder("no", "Debe enviar la entrada que desea finalizar");
    }

    if ($idUsuarioFinaliza <= 0) {
        inv_responder("no", "Debe enviar el usuario que finaliza la entrada");
    }

    $conexion->begin_transaction();

    $documento = inv_obtener_fila("
        SELECT
            d.*,
            td.nombre AS tipoDocumento,
            td.codigo AS codigoTipoDocumento,
            td.tipoMovimiento,
            td.naturaleza,
            td.afectaInventario,
            td.estado AS estadoTipoDocumento
        FROM InventarioDocumentos d
        INNER JOIN TiposDocumentoInventario td
            ON td.id = d.idTipoDocumento
        WHERE d.id = $idDocumento
        LIMIT 1
        FOR UPDATE
    ");

    if (!$documento) {
        throw new Exception("La entrada no existe");
    }

    if ($documento["estadoProceso"] !== "BORRADOR") {
        throw new Exception("Esta entrada ya fue finalizada o anulada");
    }

    if (intval($documento["estadoTipoDocumento"]) !== 1) {
        throw new Exception("El tipo de documento de la entrada está inactivo");
    }

    if (intval($documento["afectaInventario"]) !== 1) {
        throw new Exception("El tipo de documento de la entrada no afecta inventario");
    }

    if (inv_contar_movimientos_documento($idDocumento) > 0) {
        throw new Exception("Esta entrada ya tiene movimientos registrados");
    }

    if (($documento['tipoOrigen'] ?? '') === 'ORDEN_COMPRA') {
        $sesionCompra = ecPermiso($input);
        $idUsuarioFinaliza = $sesionCompra['id'];
        $relacion = ecConsulta('SELECT idOrdenCompra FROM InventarioEntradaCompra WHERE idDocumento = ?', [$idDocumento]);
        if (!$relacion) throw new InvalidArgumentException('La entrada perdió su relación con la compra.');
        $recepcion = ecConsulta('SELECT dd.idProducto, dd.cantidadSolicitada AS cantidad, r.idOrdenCompraDetalle
          FROM InventarioDocumentoDetalle dd LEFT JOIN InventarioEntradaCompraDetalle r ON r.idDocumentoDetalle = dd.id WHERE dd.idDocumento = ?', [$idDocumento]);
        ecValidar($relacion[0]['idOrdenCompra'], $recepcion);
    }

    if ($idOperador <= 0) {
        $idOperador = intval($documento["idOperador"] ?? 0);
    }

    if ($idOperador <= 0) {
        $operador = inv_obtener_operador_por_usuario($idUsuarioFinaliza);

        if (!$operador) {
            throw new Exception("El usuario no tiene operador activo para finalizar entradas de inventario");
        }

        $idOperador = intval($operador["idOperador"]);
    }

    $lineas = inv_obtener_filas("
        SELECT
            dd.id AS idDocumentoDetalle,
            dd.idProducto,
            dd.cantidadSolicitada,
            dd.cantidadProcesada,
            dd.unidad,
            dd.observacion AS observacionDetalle,
            dl.id AS idDetalleLote,
            dl.idLote,
            dl.idBodega,
            dl.idUbicacion,
            dl.cantidad,
            dl.observacion AS observacionLote,
            pc.descripcion AS producto,
            pc.codigo AS codigoProducto,
            pic.manejaLote,
            pic.manejaVencimiento,
            il.lote,
            il.fechaVencimiento,
            b.nombre AS bodega,
            u.nombre AS ubicacion
        FROM InventarioDocumentoDetalle dd
        INNER JOIN InventarioDocumentoDetalleLotes dl
            ON dl.idDocumentoDetalle = dd.id
        INNER JOIN ProductosCatalogo pc
            ON pc.id = dd.idProducto
        INNER JOIN ProductosInventarioConfig pic
            ON pic.idProducto = pc.id
            AND pic.estado = 1
        LEFT JOIN InventarioLotes il
            ON il.id = dl.idLote
        INNER JOIN BodegasInventario b
            ON b.id = dl.idBodega
        LEFT JOIN UbicacionesInventario u
            ON u.id = dl.idUbicacion
        WHERE dd.idDocumento = $idDocumento
        ORDER BY dd.id ASC, dl.id ASC
    ");

    if (count($lineas) === 0) {
        throw new Exception("La entrada no tiene productos para finalizar");
    }

    $tipoMovimiento = inv_limpiar_texto($documento["tipoMovimiento"] ?: "ENTRADA");
    $totalCantidad = 0;
    $totalProductos = 0;
    $movimientos = [];

    foreach ($lineas as $indice => $linea) {
        $numeroLinea = $indice + 1;

        $idProducto = intval($linea["idProducto"]);
        $idDocumentoDetalle = intval($linea["idDocumentoDetalle"]);
        $idLote = intval($linea["idLote"] ?? 0);
        $idBodega = intval($linea["idBodega"] ?? 0);
        $idUbicacion = intval($linea["idUbicacion"] ?? 0);
        $cantidad = inv_decimal_seguro($linea["cantidad"] ?? 0);

        if ($cantidad <= 0) {
            throw new Exception("La línea $numeroLinea debe tener una cantidad mayor a cero");
        }

        if ($idBodega <= 0) {
            throw new Exception("La línea $numeroLinea no tiene bodega destino");
        }

        $producto = inv_obtener_producto_inventario($idProducto);

        if (!$producto) {
            throw new Exception("El producto " . ($linea["producto"] ?? $idProducto) . " no está activo o configurado para inventario");
        }

        if (intval($producto["manejaLote"]) === 1 && $idLote <= 0) {
            throw new Exception("El producto " . $producto["descripcion"] . " requiere lote antes de finalizar");
        }

        if (intval($producto["manejaVencimiento"]) === 1 && $idLote > 0 && empty($linea["fechaVencimiento"])) {
            throw new Exception("El lote del producto " . $producto["descripcion"] . " requiere fecha de vencimiento");
        }

        $bodega = inv_validar_bodega($idBodega);

        if (!$bodega) {
            throw new Exception("La bodega de la línea $numeroLinea no existe o está inactiva");
        }

        if ($idUbicacion > 0) {
            $ubicacion = inv_validar_ubicacion($idUbicacion, $idBodega);

            if (!$ubicacion) {
                throw new Exception("La ubicación de la línea $numeroLinea no pertenece a la bodega seleccionada o está inactiva");
            }
        }

        $existencia = inv_obtener_existencia_actual(
            $idProducto,
            $idLote,
            $idBodega,
            $idUbicacion
        );

        $saldoAnterior = 0;
        $saldoNuevo = $cantidad;

        if ($existencia) {
            $saldoAnterior = floatval($existencia["cantidadDisponible"]);
            $saldoNuevo = $saldoAnterior + $cantidad;
            $idExistencia = intval($existencia["id"]);

            $sqlExistencia = "
                UPDATE InventarioExistencias
                SET
                    cantidadDisponible = $saldoNuevo,
                    updated_at = NOW()
                WHERE id = $idExistencia
                LIMIT 1
            ";
        } else {
            $sqlExistencia = "
                INSERT INTO InventarioExistencias
                (
                    idProducto,
                    idLote,
                    idBodega,
                    idUbicacion,
                    cantidadDisponible,
                    cantidadReservada,
                    cantidadBloqueada,
                    updated_at
                )
                VALUES
                (
                    $idProducto,
                    " . inv_int_o_null($idLote) . ",
                    $idBodega,
                    " . inv_int_o_null($idUbicacion) . ",
                    $cantidad,
                    0,
                    0,
                    NOW()
                )
            ";
        }

        if (!$conexion->query($sqlExistencia)) {
            throw new Exception($conexion->error);
        }

        $observacionMovimiento = $linea["observacionDetalle"] ?: $observacionFinalizacion;

        $sqlMovimiento = "
            INSERT INTO InventarioMovimientos
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
                $idDocumento,
                $idDocumentoDetalle,
                $idProducto,
                " . inv_int_o_null($idLote) . ",
                $idBodega,
                " . inv_int_o_null($idUbicacion) . ",
                '" . inv_esc($tipoMovimiento) . "',
                $cantidad,
                $saldoAnterior,
                $saldoNuevo,
                $idUsuarioFinaliza,
                NOW(),
                " . inv_texto_o_null($observacionMovimiento) . ",
                $idUsuarioFinaliza,
                $idOperador
            )
        ";

        if (!$conexion->query($sqlMovimiento)) {
            throw new Exception($conexion->error);
        }

        $idMovimiento = intval($conexion->insert_id);

        $movimientos[] = [
            "idMovimiento" => $idMovimiento,
            "idDocumentoDetalle" => $idDocumentoDetalle,
            "idProducto" => $idProducto,
            "producto" => $producto["descripcion"],
            "idLote" => $idLote ?: null,
            "lote" => $linea["lote"] ?? null,
            "idBodega" => $idBodega,
            "idUbicacion" => $idUbicacion ?: null,
            "cantidad" => $cantidad,
            "saldoAnterior" => $saldoAnterior,
            "saldoNuevo" => $saldoNuevo
        ];

        $totalCantidad += $cantidad;
        $totalProductos++;
    }

    if (!$conexion->query("
        UPDATE InventarioDocumentoDetalle
        SET
            cantidadProcesada = cantidadSolicitada,
            updated_at = NOW()
        WHERE idDocumento = $idDocumento
    ")) {
        throw new Exception($conexion->error);
    }

    $sqlFinalizar = "
        UPDATE InventarioDocumentos
        SET
            estadoProceso = 'FINALIZADA',
            fechaFinalizacion = NOW(),
            idUsuarioFinaliza = $idUsuarioFinaliza,
            idOperador = $idOperador,
            idEstado = 1,
            updated_at = NOW()
        WHERE id = $idDocumento
        LIMIT 1
    ";

    if (!$conexion->query($sqlFinalizar)) {
        throw new Exception($conexion->error);
    }

    $conexion->commit();

    inv_responder(
        "si",
        "Entrada finalizada correctamente",
        [
            "idDocumento" => $idDocumento,
            "idEntrada" => $idDocumento,
            "consecutivo" => $documento["consecutivo"],
            "estadoProceso" => "FINALIZADA",
            "estadoProcesoTexto" => "Finalizada",
            "editable" => false,
            "finalizable" => false,
            "fechaFinalizacion" => date("Y-m-d H:i:s"),
            "idUsuarioFinaliza" => $idUsuarioFinaliza,
            "idOperador" => $idOperador,
            "totalProductos" => $totalProductos,
            "totalCantidad" => $totalCantidad,
            "movimientos" => $movimientos
        ]
    );
} catch (Throwable $e) {
    if (isset($conexion) && $conexion instanceof mysqli) {
        $conexion->rollback();
    }

    inv_responder(
        "no",
        $e instanceof InvalidArgumentException ? $e->getMessage() : "Error finalizando entrada de inventario",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
