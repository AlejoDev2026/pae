<?php
require_once __DIR__ . "/InventarioEntradasHelper.php";
require_once __DIR__ . "/EntradaCompraHelper.php";

try {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        inv_responder("no", "Método no permitido", [], [], 405);
    }

    $input = inv_entrada_json();

    $idDocumento = intval($input["idDocumento"] ?? $input["idEntrada"] ?? $input["id"] ?? 0);
    $idTipoDocumento = intval($input["idTipoDocumento"] ?? 0);
    $fechaDocumento = inv_limpiar_texto($input["fechaDocumento"] ?? date("Y-m-d"));
    $observacion = inv_limpiar_texto($input["observacion"] ?? "");
    $idUsuarioRegistro = intval($input["idUsuarioRegistro"] ?? $input["idUsuario"] ?? 0);
    $idOperador = intval($input["idOperador"] ?? 0);
    $detalles = $input["detalles"] ?? $input["productos"] ?? [];
    $idOrdenCompra = (int)($input['idOrdenCompra'] ?? 0);
    // También exigir sesión si se intenta quitar la relación de un borrador existente.
    $origenActual = $idDocumento > 0 ? inv_obtener_fila("SELECT tipoOrigen FROM InventarioDocumentos WHERE id = $idDocumento") : null;
    if ($idOrdenCompra || ($origenActual['tipoOrigen'] ?? '') === 'ORDEN_COMPRA') {
        $sesionCompra = ecPermiso($input);
        $idUsuarioRegistro = $sesionCompra['id'];
    }

    if ($idTipoDocumento <= 0) {
        $tipoDocumentoDefault = inv_obtener_tipo_documento_entrada_mercancia();
        $idTipoDocumento = intval($tipoDocumentoDefault["id"] ?? 0);
    }

    if ($idUsuarioRegistro <= 0) {
        inv_responder("no", "Debe enviar el usuario que registra la entrada");
    }

    if (!is_array($detalles) || count($detalles) === 0) {
        inv_responder("no", "Debe agregar al menos un producto a la entrada");
    }

    $tipoDocumento = inv_validar_tipo_documento_entrada($idTipoDocumento);

    if ($idOperador <= 0) {
        $operador = inv_obtener_operador_por_usuario($idUsuarioRegistro);

        if (!$operador) {
            inv_responder("no", "El usuario no tiene operador activo para registrar entradas de inventario");
        }

        $idOperador = intval($operador["idOperador"]);
    }

    $conexion->begin_transaction();

    $modo = "CREADO";
    $consecutivo = "";

    if ($idDocumento > 0) {
        $documentoActual = inv_obtener_fila("
            SELECT
                id,
                consecutivo,
                tipoOrigen,
                estadoProceso
            FROM InventarioDocumentos
            WHERE id = $idDocumento
            LIMIT 1
            FOR UPDATE
        ");

        if (!$documentoActual) {
            throw new Exception("La entrada que intenta editar no existe");
        }

        if ($documentoActual["estadoProceso"] !== "BORRADOR") {
            throw new Exception("Esta entrada ya fue finalizada o anulada y no se puede modificar");
        }

        if (inv_contar_movimientos_documento($idDocumento) > 0) {
            throw new Exception("Esta entrada ya tiene movimientos de inventario y no se puede editar");
        }

        $consecutivo = $documentoActual["consecutivo"];
        if (($documentoActual['tipoOrigen'] ?? '') !== ($origenActual['tipoOrigen'] ?? '')) throw new InvalidArgumentException('La entrada cambió mientras se editaba. Vuelve a consultarla.');
        if ($idOrdenCompra > 0) ecValidar($idOrdenCompra, $detalles);
        $modo = "ACTUALIZADO";

        $sqlDocumento = "
            UPDATE InventarioDocumentos
            SET
                idTipoDocumento = $idTipoDocumento,
                idUsuarioRegistro = $idUsuarioRegistro,
                idOperador = $idOperador,
                fechaDocumento = " . inv_fecha_o_null($fechaDocumento) . ",
                idResponsable = $idUsuarioRegistro,
                idOperadorAsignado = $idOperador,
                idEstado = 1,
                tipoOrigen = 'MANUAL',
                observacion = " . inv_texto_o_null($observacion) . ",
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

        if (($origenActual['tipoOrigen'] ?? '') === 'ORDEN_COMPRA') {
            ecConsulta('DELETE FROM InventarioEntradaCompraDetalle WHERE idDocumento = ?', [$idDocumento]);
            ecConsulta('DELETE FROM InventarioEntradaCompra WHERE idDocumento = ?', [$idDocumento]);
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
        if ($idOrdenCompra > 0) ecValidar($idOrdenCompra, $detalles);
        $consecutivo = inv_generar_consecutivo_entrada();

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
                '" . inv_esc($consecutivo) . "',
                " . inv_fecha_o_null($fechaDocumento) . ",
                $idUsuarioRegistro,
                $idOperador,
                1,
                'MANUAL',
                " . inv_texto_o_null($observacion) . ",
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
    if ($idOrdenCompra > 0) {
        ecConsulta('INSERT INTO InventarioEntradaCompra (idDocumento,idOrdenCompra) VALUES (?,?)', [$idDocumento,$idOrdenCompra]);
        ecConsulta("UPDATE InventarioDocumentos SET tipoOrigen = 'ORDEN_COMPRA' WHERE id = ?", [$idDocumento]);
    }
    $totalProductos = 0;
    $detallesGuardados = [];

    foreach ($detalles as $indice => $detalle) {
        $linea = $indice + 1;

        $idProducto = intval($detalle["idProducto"] ?? 0);
        $cantidad = inv_decimal_seguro($detalle["cantidad"] ?? $detalle["cantidadSolicitada"] ?? 0);
        $idBodega = intval($detalle["idBodega"] ?? 0);
        $idUbicacion = intval($detalle["idUbicacion"] ?? 0);
        $unidad = inv_limpiar_texto($detalle["unidad"] ?? "");
        $observacionDetalle = inv_limpiar_texto($detalle["observacion"] ?? "");

        if ($idProducto <= 0) {
            throw new Exception("La línea $linea no tiene producto seleccionado");
        }

        if ($cantidad <= 0) {
            throw new Exception("La línea $linea debe tener una cantidad mayor a cero");
        }

        if ($idBodega <= 0) {
            throw new Exception("La línea $linea debe tener bodega destino");
        }

        $producto = inv_obtener_producto_inventario($idProducto);

        if (!$producto) {
            throw new Exception("El producto de la línea $linea no está activo o no está configurado para inventario");
        }

        $bodega = inv_validar_bodega($idBodega);

        if (!$bodega) {
            throw new Exception("La bodega de la línea $linea no existe o está inactiva");
        }

        if ($idUbicacion > 0) {
            $ubicacion = inv_validar_ubicacion($idUbicacion, $idBodega);

            if (!$ubicacion) {
                throw new Exception("La ubicación de la línea $linea no pertenece a la bodega seleccionada o está inactiva");
            }
        }

        if ($unidad === "") {
            $unidad = $producto["unidadBaseInventario"] ?: "UND";
        }

        $idLote = inv_obtener_o_crear_lote($detalle, $producto);

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
                '" . inv_esc($unidad) . "',
                " . inv_texto_o_null($observacionDetalle) . ",
                NOW(),
                NOW()
            )
        ";

        if (!$conexion->query($sqlDetalle)) {
            throw new Exception($conexion->error);
        }

        $idDocumentoDetalle = intval($conexion->insert_id);
        if ($idOrdenCompra > 0) ecConsulta('INSERT INTO InventarioEntradaCompraDetalle (idDocumentoDetalle,idDocumento,idOrdenCompraDetalle) VALUES (?,?,?)', [$idDocumentoDetalle,$idDocumento,$detalle['idOrdenCompraDetalle']]);

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
                " . inv_int_o_null($idLote) . ",
                $idBodega,
                " . inv_int_o_null($idUbicacion) . ",
                $cantidad,
                " . inv_texto_o_null($observacionDetalle) . ",
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
            "idLote" => $idLote,
            "idBodega" => $idBodega,
            "idUbicacion" => $idUbicacion
        ];
    }

    $conexion->commit();

    inv_responder(
        "si",
        $modo === "CREADO"
            ? "Entrada guardada como borrador correctamente"
            : "Entrada actualizada como borrador correctamente",
        [
            "idDocumento" => $idDocumento,
            "idEntrada" => $idDocumento,
            "consecutivo" => $consecutivo,
            "fechaDocumento" => $fechaDocumento,
            "idTipoDocumento" => $idTipoDocumento,
            "tipoDocumento" => $tipoDocumento["nombre"],
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

    inv_responder(
        "no",
        $e instanceof InvalidArgumentException ? $e->getMessage() : "Error guardando entrada de inventario",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
