<?php
require_once __DIR__ . "/InventarioSalidasHelper.php";

try {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        sal_responder("no", "Método no permitido", [], [], 405);
    }

    $input = sal_entrada_json();

    $idDocumento = intval($input["idDocumento"] ?? $input["idSalida"] ?? $input["id"] ?? 0);
    $idTipoDocumento = intval($input["idTipoDocumento"] ?? 0);
    $fechaDocumento = sal_limpiar_texto($input["fechaDocumento"] ?? date("Y-m-d"));
    $observacion = sal_limpiar_texto($input["observacion"] ?? "");
    $idUsuarioRegistro = intval($input["idUsuarioRegistro"] ?? $input["idUsuario"] ?? 0);
    $idOperador = intval($input["idOperador"] ?? 0);
    $detalles = $input["detalles"] ?? $input["productos"] ?? [];

    if ($idUsuarioRegistro <= 0) {
        sal_responder("no", "Debe enviar el usuario que registra la salida");
    }

    if ($idTipoDocumento <= 0) {
        sal_responder("no", "Debe seleccionar el tipo de salida");
    }

    if (!is_array($detalles) || count($detalles) === 0) {
        sal_responder("no", "Debe agregar al menos un producto a la salida");
    }

    $tipoDocumento = sal_validar_tipo_documento_salida($idTipoDocumento);

    if ($idOperador <= 0) {
        $operador = sal_obtener_operador_por_usuario($idUsuarioRegistro);

        if (!$operador) {
            sal_responder("no", "El usuario no tiene operador activo para registrar salidas de inventario");
        }

        $idOperador = intval($operador["idOperador"]);
    }

    $conexion->begin_transaction();

    $modo = "CREADO";
    $consecutivo = "";

    if ($idDocumento > 0) {
        $documentoActual = sal_obtener_fila("
            SELECT
                id,
                consecutivo,
                estadoProceso
            FROM InventarioDocumentos
            WHERE id = $idDocumento
            LIMIT 1
            FOR UPDATE
        ");

        if (!$documentoActual) {
            throw new Exception("La salida que intenta editar no existe");
        }

        if ($documentoActual["estadoProceso"] !== "BORRADOR") {
            throw new Exception("Esta salida ya fue finalizada o anulada y no se puede modificar");
        }

        if (sal_contar_movimientos_documento($idDocumento) > 0) {
            throw new Exception("Esta salida ya tiene movimientos de inventario y no se puede editar");
        }

        $consecutivo = $documentoActual["consecutivo"];
        $modo = "ACTUALIZADO";

        $sqlDocumento = "
            UPDATE InventarioDocumentos
            SET
                idTipoDocumento = $idTipoDocumento,
                idUsuarioRegistro = $idUsuarioRegistro,
                idOperador = $idOperador,
                fechaDocumento = " . sal_fecha_o_null($fechaDocumento) . ",
                idResponsable = $idUsuarioRegistro,
                idOperadorAsignado = $idOperador,
                idEstado = 1,
                tipoOrigen = 'MANUAL',
                observacion = " . sal_texto_o_null($observacion) . ",
                estadoProceso = 'BORRADOR',
                fechaFinalizacion = NULL,
                idUsuarioFinaliza = NULL,
                updated_at = NOW()
            WHERE id = $idDocumento
            LIMIT 1
        ";

        if (!$conexion->query($sqlDocumento)) {
            throw new Exception($conexion->error);
        }

        if (!$conexion->query("
            DELETE dll
            FROM InventarioDocumentoDetalleLotes dll
            INNER JOIN InventarioDocumentoDetalle dd
                ON dd.id = dll.idDocumentoDetalle
            WHERE dd.idDocumento = $idDocumento
        ")) {
            throw new Exception($conexion->error);
        }

        if (!$conexion->query("
            DELETE FROM InventarioDocumentoDetalle
            WHERE idDocumento = $idDocumento
        ")) {
            throw new Exception($conexion->error);
        }
    } else {
        $consecutivo = sal_generar_consecutivo_salida();

        $sqlDocumento = "
            INSERT INTO InventarioDocumentos
            (
                idTipoDocumento,
                idUsuarioRegistro,
                idOperador,
                consecutivo,
                fechaDocumento,
                idResponsable,
                idOperadorAsignado,
                idEstado,
                tipoOrigen,
                observacion,
                estadoProceso,
                fechaFinalizacion,
                idUsuarioFinaliza,
                created_at,
                updated_at
            )
            VALUES
            (
                $idTipoDocumento,
                $idUsuarioRegistro,
                $idOperador,
                '" . sal_esc($consecutivo) . "',
                " . sal_fecha_o_null($fechaDocumento) . ",
                $idUsuarioRegistro,
                $idOperador,
                1,
                'MANUAL',
                " . sal_texto_o_null($observacion) . ",
                'BORRADOR',
                NULL,
                NULL,
                NOW(),
                NOW()
            )
        ";

        if (!$conexion->query($sqlDocumento)) {
            throw new Exception($conexion->error);
        }

        $idDocumento = intval($conexion->insert_id);
    }

    $totalCantidad = 0;
    $totalProductos = 0;
    $detallesGuardados = [];

    foreach ($detalles as $indice => $detalle) {
        $linea = $indice + 1;

        $idProducto = intval($detalle["idProducto"] ?? 0);
        $cantidad = sal_decimal_seguro($detalle["cantidad"] ?? $detalle["cantidadSolicitada"] ?? 0);
        $idBodega = intval($detalle["idBodega"] ?? 0);
        $idUbicacion = intval($detalle["idUbicacion"] ?? 0);
        $idLote = intval($detalle["idLote"] ?? 0);
        $unidad = sal_limpiar_texto($detalle["unidad"] ?? "");
        $observacionDetalle = sal_limpiar_texto($detalle["observacion"] ?? "");

        if ($idProducto <= 0) {
            throw new Exception("La línea $linea no tiene producto seleccionado");
        }

        if ($cantidad <= 0) {
            throw new Exception("La línea $linea debe tener una cantidad mayor a cero");
        }

        if ($idBodega <= 0) {
            throw new Exception("La línea $linea debe tener bodega origen");
        }

        $producto = sal_obtener_producto_inventario($idProducto);

        if (!$producto) {
            throw new Exception("El producto de la línea $linea no está activo o no está configurado para inventario");
        }

        $bodega = sal_validar_bodega($idBodega);

        if (!$bodega) {
            throw new Exception("La bodega de la línea $linea no existe o está inactiva");
        }

        if ($idUbicacion > 0) {
            $ubicacion = sal_validar_ubicacion($idUbicacion, $idBodega);

            if (!$ubicacion) {
                throw new Exception("La ubicación de la línea $linea no pertenece a la bodega seleccionada o está inactiva");
            }
        }

        if ($unidad === "") {
            $unidad = $producto["unidadBaseInventario"] ?: "UND";
        }

        $lote = sal_validar_lote_salida($detalle, $producto, $tipoDocumento);
        $idLoteFinal = $lote ? intval($lote["id"]) : null;

        $existencia = sal_obtener_existencia_actual_sin_lock(
            $idProducto,
            $idLoteFinal ?: 0,
            $idBodega,
            $idUbicacion
        );

        $disponible = $existencia ? floatval($existencia["cantidadDisponible"]) : 0;

        if ($disponible <= 0) {
            throw new Exception("No hay existencia disponible para el producto " . $producto["descripcion"]);
        }

        if ($cantidad > $disponible) {
            throw new Exception(
                "La cantidad solicitada para " . $producto["descripcion"] .
                " supera la existencia disponible. Disponible: " . $disponible
            );
        }

        $sqlDetalle = "
            INSERT INTO InventarioDocumentoDetalle
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
            VALUES
            (
                $idDocumento,
                $idProducto,
                $cantidad,
                0,
                '" . sal_esc($unidad) . "',
                " . sal_texto_o_null($observacionDetalle) . ",
                NOW(),
                NOW()
            )
        ";

        if (!$conexion->query($sqlDetalle)) {
            throw new Exception($conexion->error);
        }

        $idDocumentoDetalle = intval($conexion->insert_id);

        $sqlDetalleLote = "
            INSERT INTO InventarioDocumentoDetalleLotes
            (
                idDocumentoDetalle,
                idLote,
                idBodega,
                idUbicacion,
                cantidad,
                observacion,
                created_at
            )
            VALUES
            (
                $idDocumentoDetalle,
                " . sal_int_o_null($idLoteFinal) . ",
                $idBodega,
                " . sal_int_o_null($idUbicacion) . ",
                $cantidad,
                " . sal_texto_o_null($observacionDetalle) . ",
                NOW()
            )
        ";

        if (!$conexion->query($sqlDetalleLote)) {
            throw new Exception($conexion->error);
        }

        $totalProductos++;
        $totalCantidad += $cantidad;

        $detallesGuardados[] = [
            "idDocumentoDetalle" => $idDocumentoDetalle,
            "idProducto" => $idProducto,
            "producto" => $producto["descripcion"],
            "cantidad" => $cantidad,
            "cantidadSolicitada" => $cantidad,
            "cantidadProcesada" => 0,
            "unidad" => $unidad,
            "idLote" => $idLoteFinal,
            "lote" => $lote ? $lote["lote"] : null,
            "idBodega" => $idBodega,
            "idUbicacion" => $idUbicacion,
            "disponibleValidado" => $disponible
        ];
    }

    $conexion->commit();

    sal_responder(
        "si",
        $modo === "CREADO"
            ? "Salida guardada como borrador correctamente"
            : "Salida actualizada como borrador correctamente",
        [
            "idDocumento" => $idDocumento,
            "idSalida" => $idDocumento,
            "consecutivo" => $consecutivo,
            "fechaDocumento" => $fechaDocumento,
            "idTipoDocumento" => $idTipoDocumento,
            "tipoDocumento" => $tipoDocumento["nombre"],
            "permiteLoteVencido" => intval($tipoDocumento["permiteLoteVencido"] ?? 0),
            "idUsuarioRegistro" => $idUsuarioRegistro,
            "idOperador" => $idOperador,
            "estadoProceso" => "BORRADOR",
            "estadoProcesoTexto" => "Borrador",
            "editable" => true,
            "finalizable" => true,
            "totalProductos" => $totalProductos,
            "totalCantidad" => $totalCantidad,
            "detalles" => $detallesGuardados
        ],
        ["modo" => $modo]
    );
} catch (Throwable $e) {
    if (isset($conexion) && $conexion instanceof mysqli) {
        $conexion->rollback();
    }

    sal_responder(
        "no",
        "Error guardando salida de inventario",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
