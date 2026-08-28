<?php
require_once __DIR__ . "/InventarioAjustesHelper.php";

try {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        aj_responder("no", "Método no permitido", [], [], 405);
    }

    $input = aj_entrada_json();

    $idDocumento = intval($input["idDocumento"] ?? $input["idAjuste"] ?? $input["id"] ?? 0);
    $idTipoDocumento = intval($input["idTipoDocumento"] ?? 0);
    $fechaDocumento = aj_limpiar_texto($input["fechaDocumento"] ?? date("Y-m-d"));
    $observacion = aj_limpiar_texto($input["observacion"] ?? "");
    $idUsuarioRegistro = intval($input["idUsuarioRegistro"] ?? $input["idUsuario"] ?? 0);
    $idOperador = intval($input["idOperador"] ?? 0);
    $idBodega = intval($input["idBodega"] ?? $input["idBodegaOrigen"] ?? 0);
    $idUbicacion = intval($input["idUbicacion"] ?? $input["idUbicacionOrigen"] ?? 0);
    $detalles = $input["detalles"] ?? $input["productos"] ?? [];

    if ($idUsuarioRegistro <= 0) {
        aj_responder("no", "Debe enviar el usuario que registra el ajuste");
    }

    if ($idTipoDocumento <= 0) {
        aj_responder("no", "Debe seleccionar el tipo de ajuste");
    }

    if ($idBodega <= 0) {
        aj_responder("no", "Debe seleccionar la bodega del ajuste");
    }

    if (!is_array($detalles) || count($detalles) === 0) {
        aj_responder("no", "Debe agregar al menos un producto al ajuste");
    }

    $tipoDocumento = aj_validar_tipo_documento($idTipoDocumento);
    $tipoAjuste = $tipoDocumento["tipoAjuste"];

    $bodega = aj_validar_bodega($idBodega);

    if (!$bodega) {
        aj_responder("no", "La bodega no existe o está inactiva");
    }

    if ($idUbicacion > 0 && !aj_validar_ubicacion($idUbicacion, $idBodega)) {
        aj_responder("no", "La ubicación no pertenece a la bodega o está inactiva");
    }

    if ($idOperador <= 0) {
        $operador = aj_obtener_operador_por_usuario($idUsuarioRegistro);

        if (!$operador) {
            aj_responder("no", "El usuario no tiene operador activo para registrar ajustes de inventario");
        }

        $idOperador = intval($operador["idOperador"]);
    }

    $conexion->begin_transaction();

    $modo = "CREADO";
    $consecutivo = "";

    if ($idDocumento > 0) {
        $documentoActual = aj_obtener_fila("
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
            throw new Exception("El ajuste que intenta editar no existe");
        }

        if ($documentoActual["estadoProceso"] !== "BORRADOR") {
            throw new Exception("Este ajuste ya fue finalizado o anulado y no se puede modificar");
        }

        if (aj_contar_movimientos_documento($idDocumento) > 0) {
            throw new Exception("Este ajuste ya tiene movimientos de inventario y no se puede editar");
        }

        $consecutivo = $documentoActual["consecutivo"];
        $modo = "ACTUALIZADO";

        $sqlDocumento = "
            UPDATE InventarioDocumentos
            SET
                idTipoDocumento = $idTipoDocumento,
                idUsuarioRegistro = $idUsuarioRegistro,
                idOperador = $idOperador,
                consecutivo = '" . aj_esc($consecutivo) . "',
                fechaDocumento = " . aj_fecha_o_null($fechaDocumento) . ",
                idResponsable = $idUsuarioRegistro,
                idOperadorAsignado = $idOperador,
                idEstado = 1,
                tipoOrigen = 'MANUAL',
                observacion = " . aj_texto_o_null($observacion) . ",
                estadoProceso = 'BORRADOR',
                fechaFinalizacion = NULL,
                idUsuarioFinaliza = NULL,
                idBodegaOrigen = $idBodega,
                idUbicacionOrigen = " . aj_int_o_null($idUbicacion) . ",
                idBodegaDestino = NULL,
                idUbicacionDestino = NULL,
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
        $consecutivo = aj_generar_consecutivo_ajuste();

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
                idBodegaOrigen,
                idUbicacionOrigen,
                idBodegaDestino,
                idUbicacionDestino,
                created_at,
                updated_at
            )
            VALUES
            (
                $idTipoDocumento,
                $idUsuarioRegistro,
                $idOperador,
                '" . aj_esc($consecutivo) . "',
                " . aj_fecha_o_null($fechaDocumento) . ",
                $idUsuarioRegistro,
                $idOperador,
                1,
                'MANUAL',
                " . aj_texto_o_null($observacion) . ",
                'BORRADOR',
                NULL,
                NULL,
                $idBodega,
                " . aj_int_o_null($idUbicacion) . ",
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
        $cantidad = aj_decimal_seguro($detalle["cantidad"] ?? $detalle["cantidadSolicitada"] ?? 0);
        $idLote = intval($detalle["idLote"] ?? 0);
        $unidad = aj_limpiar_texto($detalle["unidad"] ?? "");
        $observacionDetalle = aj_limpiar_texto($detalle["observacion"] ?? "");

        if ($idProducto <= 0) {
            throw new Exception("La línea $linea no tiene producto seleccionado");
        }

        if ($cantidad <= 0) {
            throw new Exception("La línea $linea debe tener una cantidad mayor a cero");
        }

        $producto = aj_obtener_producto_inventario($idProducto);

        if (!$producto) {
            throw new Exception("El producto de la línea $linea no está activo o no está configurado para inventario");
        }

        if ($unidad === "") {
            $unidad = $producto["unidadBaseInventario"] ?: "UND";
        }

        $lote = aj_validar_lote($detalle, $producto);
        $idLoteFinal = $lote ? intval($lote["id"]) : null;

        if ($tipoAjuste === "NEGATIVO") {
            $existencia = aj_obtener_existencia(
                $idProducto,
                $idLoteFinal ?: 0,
                $idBodega,
                $idUbicacion,
                false
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
        } else {
            $existencia = aj_obtener_existencia(
                $idProducto,
                $idLoteFinal ?: 0,
                $idBodega,
                $idUbicacion,
                false
            );

            $disponible = $existencia ? floatval($existencia["cantidadDisponible"]) : 0;
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
                '" . aj_esc($unidad) . "',
                " . aj_texto_o_null($observacionDetalle) . ",
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
                " . aj_int_o_null($idLoteFinal) . ",
                $idBodega,
                " . aj_int_o_null($idUbicacion) . ",
                $cantidad,
                " . aj_texto_o_null($observacionDetalle) . ",
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
            "idUbicacion" => $idUbicacion ?: null,
            "disponibleValidado" => $disponible
        ];
    }

    $conexion->commit();

    aj_responder(
        "si",
        $modo === "CREADO"
            ? "Ajuste guardado como borrador correctamente"
            : "Ajuste actualizado como borrador correctamente",
        [
            "idDocumento" => $idDocumento,
            "idAjuste" => $idDocumento,
            "consecutivo" => $consecutivo,
            "fechaDocumento" => $fechaDocumento,
            "idTipoDocumento" => $idTipoDocumento,
            "tipoDocumento" => $tipoDocumento["nombre"],
            "codigoTipoDocumento" => $tipoDocumento["codigo"],
            "tipoAjuste" => $tipoAjuste,
            "idUsuarioRegistro" => $idUsuarioRegistro,
            "idOperador" => $idOperador,
            "idBodega" => $idBodega,
            "idUbicacion" => $idUbicacion ?: null,
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

    aj_responder(
        "no",
        "Error guardando ajuste de inventario",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
