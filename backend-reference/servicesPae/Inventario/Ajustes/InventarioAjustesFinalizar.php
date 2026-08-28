<?php
require_once __DIR__ . "/InventarioAjustesHelper.php";

try {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        aj_responder("no", "Método no permitido", [], [], 405);
    }

    $input = aj_entrada_json();

    $idDocumento = intval($input["idDocumento"] ?? $input["idAjuste"] ?? $input["id"] ?? 0);
    $idUsuarioFinaliza = intval($input["idUsuarioFinaliza"] ?? $input["idUsuario"] ?? $input["idUsuarioRegistro"] ?? 0);
    $idOperador = intval($input["idOperador"] ?? 0);
    $observacionFinalizacion = aj_limpiar_texto($input["observacionFinalizacion"] ?? "");

    if ($idDocumento <= 0) {
        aj_responder("no", "Debe enviar el ajuste que desea finalizar");
    }

    if ($idUsuarioFinaliza <= 0) {
        aj_responder("no", "Debe enviar el usuario que finaliza el ajuste");
    }

    $conexion->begin_transaction();

    $documento = aj_obtener_fila("
        SELECT
            d.*,
            td.nombre AS tipoDocumento,
            td.codigo AS codigoTipoDocumento,
            td.tipoMovimiento,
            td.naturaleza,
            td.descripcion AS descripcionTipoDocumento,
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
        throw new Exception("El ajuste no existe");
    }

    if ($documento["estadoProceso"] !== "BORRADOR") {
        throw new Exception("Este ajuste ya fue finalizado o anulado");
    }

    $tipoDocumento = [
        "codigo" => $documento["codigoTipoDocumento"],
        "nombre" => $documento["tipoDocumento"],
        "naturaleza" => $documento["naturaleza"],
        "tipoMovimiento" => $documento["tipoMovimiento"],
        "descripcion" => $documento["descripcionTipoDocumento"],
        "afectaInventario" => $documento["afectaInventario"],
        "estado" => $documento["estadoTipoDocumento"]
    ];

    if (intval($tipoDocumento["estado"]) !== 1) {
        throw new Exception("El tipo de documento del ajuste está inactivo");
    }

    if (intval($tipoDocumento["afectaInventario"]) !== 1) {
        throw new Exception("El tipo de documento del ajuste no afecta inventario");
    }

    if (!aj_es_tipo_ajuste($tipoDocumento)) {
        throw new Exception("El documento no corresponde a un ajuste de inventario");
    }

    $tipoAjuste = aj_resolver_tipo_ajuste($tipoDocumento);

    if (!in_array($tipoAjuste, ["POSITIVO", "NEGATIVO"], true)) {
        throw new Exception("No se pudo determinar si el ajuste es POSITIVO o NEGATIVO");
    }

    if (aj_contar_movimientos_documento($idDocumento) > 0) {
        throw new Exception("Este ajuste ya tiene movimientos registrados");
    }

    $idBodega = intval($documento["idBodegaOrigen"] ?? 0);
    $idUbicacion = intval($documento["idUbicacionOrigen"] ?? 0);

    if ($idBodega <= 0) {
        throw new Exception("El ajuste no tiene bodega asociada");
    }

    if (!aj_validar_bodega($idBodega)) {
        throw new Exception("La bodega del ajuste no existe o está inactiva");
    }

    if ($idUbicacion > 0 && !aj_validar_ubicacion($idUbicacion, $idBodega)) {
        throw new Exception("La ubicación del ajuste no pertenece a la bodega o está inactiva");
    }

    if ($idOperador <= 0) {
        $idOperador = intval($documento["idOperador"] ?? 0);
    }

    if ($idOperador <= 0) {
        $operador = aj_obtener_operador_por_usuario($idUsuarioFinaliza);

        if (!$operador) {
            throw new Exception("El usuario no tiene operador activo para finalizar ajustes de inventario");
        }

        $idOperador = intval($operador["idOperador"]);
    }

    $lineas = aj_obtener_filas("
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
            il.fechaVencimiento
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
        WHERE dd.idDocumento = $idDocumento
        ORDER BY dd.id ASC, dl.id ASC
    ");

    if (count($lineas) === 0) {
        throw new Exception("El ajuste no tiene productos para finalizar");
    }

    $totalCantidad = 0;
    $totalProductos = 0;
    $movimientos = [];

    foreach ($lineas as $indice => $linea) {
        $numeroLinea = $indice + 1;

        $idProducto = intval($linea["idProducto"]);
        $idDocumentoDetalle = intval($linea["idDocumentoDetalle"]);
        $idLote = intval($linea["idLote"] ?? 0);
        $cantidad = aj_decimal_seguro($linea["cantidad"] ?? 0);

        if ($cantidad <= 0) {
            throw new Exception("La línea $numeroLinea debe tener una cantidad mayor a cero");
        }

        $producto = aj_obtener_producto_inventario($idProducto);

        if (!$producto) {
            throw new Exception("El producto " . ($linea["producto"] ?? $idProducto) . " no está activo o configurado para inventario");
        }

        if (intval($producto["manejaLote"]) === 1 && $idLote <= 0) {
            throw new Exception("El producto " . $producto["descripcion"] . " requiere lote antes de finalizar");
        }

        if (intval($producto["manejaLote"]) === 1) {
            aj_validar_lote(["idLote" => $idLote], $producto);
        }

        $existencia = aj_obtener_existencia(
            $idProducto,
            $idLote,
            $idBodega,
            $idUbicacion,
            true
        );

        if ($tipoAjuste === "NEGATIVO") {
            if (!$existencia) {
                throw new Exception("No hay existencia disponible para el producto " . $producto["descripcion"]);
            }

            $saldoAnterior = floatval($existencia["cantidadDisponible"]);

            if ($cantidad > $saldoAnterior) {
                throw new Exception(
                    "La cantidad solicitada para " . $producto["descripcion"] .
                    " supera la existencia disponible. Disponible: " . $saldoAnterior
                );
            }

            $saldoNuevo = $saldoAnterior - $cantidad;
            $idExistencia = intval($existencia["id"]);

            if (!$conexion->query("
                UPDATE InventarioExistencias
                SET
                    cantidadDisponible = $saldoNuevo,
                    updated_at = NOW()
                WHERE id = $idExistencia
                LIMIT 1
            ")) {
                throw new Exception($conexion->error);
            }

            $tipoMovimiento = "AJUSTE_NEGATIVO";
        } else {
            if ($existencia) {
                $saldoAnterior = floatval($existencia["cantidadDisponible"]);
                $saldoNuevo = $saldoAnterior + $cantidad;
                $idExistencia = intval($existencia["id"]);

                if (!$conexion->query("
                    UPDATE InventarioExistencias
                    SET
                        cantidadDisponible = $saldoNuevo,
                        updated_at = NOW()
                    WHERE id = $idExistencia
                    LIMIT 1
                ")) {
                    throw new Exception($conexion->error);
                }
            } else {
                $saldoAnterior = 0;
                $saldoNuevo = $cantidad;

                if (!$conexion->query("
                    INSERT INTO InventarioExistencias
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
                        $idProducto,
                        " . aj_int_o_null($idLote) . ",
                        $idBodega,
                        " . aj_int_o_null($idUbicacion) . ",
                        $cantidad,
                        0,
                        0,
                        NOW(),
                        NOW()
                    )
                ")) {
                    throw new Exception($conexion->error);
                }

                $idExistencia = intval($conexion->insert_id);
            }

            $tipoMovimiento = "AJUSTE_POSITIVO";
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
                " . aj_int_o_null($idLote) . ",
                $idBodega,
                " . aj_int_o_null($idUbicacion) . ",
                '$tipoMovimiento',
                $cantidad,
                $saldoAnterior,
                $saldoNuevo,
                $idUsuarioFinaliza,
                NOW(),
                " . aj_texto_o_null($observacionMovimiento) . ",
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
            "tipoMovimiento" => $tipoMovimiento,
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

    if (!$conexion->query("
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
    ")) {
        throw new Exception($conexion->error);
    }

    $conexion->commit();

    aj_responder(
        "si",
        "Ajuste finalizado correctamente",
        [
            "idDocumento" => $idDocumento,
            "idAjuste" => $idDocumento,
            "consecutivo" => $documento["consecutivo"],
            "tipoAjuste" => $tipoAjuste,
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

    aj_responder(
        "no",
        "Error finalizando ajuste de inventario",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
