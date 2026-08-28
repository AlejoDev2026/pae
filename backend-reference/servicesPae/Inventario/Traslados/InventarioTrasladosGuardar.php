<?php
require_once __DIR__ . "/InventarioTrasladosHelper.php";

try {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") tr_responder("no", "Método no permitido", [], [], 405);

    $input = tr_json();
    $idDocumento = intval($input["idDocumento"] ?? $input["idTraslado"] ?? $input["id"] ?? 0);
    $idTipoDocumento = intval($input["idTipoDocumento"] ?? 0);
    $fechaDocumento = tr_limpiar($input["fechaDocumento"] ?? date("Y-m-d"));
    $observacion = tr_limpiar($input["observacion"] ?? "");
    $idUsuarioRegistro = intval($input["idUsuarioRegistro"] ?? $input["idUsuario"] ?? 0);
    $idOperador = intval($input["idOperador"] ?? 0);
    $idBodegaOrigen = intval($input["idBodegaOrigen"] ?? $input["idBodega"] ?? 0);
    $idUbicacionOrigen = intval($input["idUbicacionOrigen"] ?? $input["idUbicacion"] ?? 0);
    $idBodegaDestino = intval($input["idBodegaDestino"] ?? 0);
    $idUbicacionDestino = intval($input["idUbicacionDestino"] ?? 0);
    $detalles = $input["detalles"] ?? $input["productos"] ?? [];

    if ($idUsuarioRegistro <= 0) tr_responder("no", "Debe enviar el usuario que registra el traslado");
    if ($idTipoDocumento <= 0) tr_responder("no", "Debe seleccionar el tipo de traslado");
    if (!is_array($detalles) || count($detalles) === 0) tr_responder("no", "Debe agregar al menos un producto al traslado");

    $tipoDocumento = tr_validar_tipo_documento($idTipoDocumento);
    tr_validar_origen_destino($idBodegaOrigen, $idUbicacionOrigen, $idBodegaDestino, $idUbicacionDestino);

    if ($idOperador <= 0) {
        $op = tr_operador_usuario($idUsuarioRegistro);
        if (!$op) tr_responder("no", "El usuario no tiene operador activo para registrar traslados de inventario");
        $idOperador = intval($op["idOperador"]);
    }

    $conexion->begin_transaction();
    $modo = "CREADO";
    $consecutivo = "";

    if ($idDocumento > 0) {
        $actual = tr_fila("SELECT id, consecutivo, estadoProceso FROM InventarioDocumentos WHERE id = $idDocumento LIMIT 1 FOR UPDATE");
        if (!$actual) throw new Exception("El traslado que intenta editar no existe");
        if ($actual["estadoProceso"] !== "BORRADOR") throw new Exception("Este traslado ya fue finalizado o anulado y no se puede modificar");
        if (tr_movs_doc($idDocumento) > 0) throw new Exception("Este traslado ya tiene movimientos de inventario y no se puede editar");

        $consecutivo = $actual["consecutivo"];
        $modo = "ACTUALIZADO";

        if (!$conexion->query("UPDATE InventarioDocumentos SET
            idTipoDocumento = $idTipoDocumento,
            idUsuarioRegistro = $idUsuarioRegistro,
            idOperador = $idOperador,
            fechaDocumento = " . tr_fecha($fechaDocumento) . ",
            idResponsable = $idUsuarioRegistro,
            idOperadorAsignado = $idOperador,
            idEstado = 1,
            tipoOrigen = 'MANUAL',
            observacion = " . tr_texto($observacion) . ",
            estadoProceso = 'BORRADOR',
            fechaFinalizacion = NULL,
            idUsuarioFinaliza = NULL,
            idBodegaOrigen = $idBodegaOrigen,
            idUbicacionOrigen = " . tr_int_null($idUbicacionOrigen) . ",
            idBodegaDestino = $idBodegaDestino,
            idUbicacionDestino = " . tr_int_null($idUbicacionDestino) . ",
            updated_at = NOW()
            WHERE id = $idDocumento LIMIT 1")) throw new Exception($conexion->error);

        if (!$conexion->query("DELETE dll FROM InventarioDocumentoDetalleLotes dll INNER JOIN InventarioDocumentoDetalle dd ON dd.id = dll.idDocumentoDetalle WHERE dd.idDocumento = $idDocumento")) throw new Exception($conexion->error);
        if (!$conexion->query("DELETE FROM InventarioDocumentoDetalle WHERE idDocumento = $idDocumento")) throw new Exception($conexion->error);
    } else {
        $consecutivo = tr_consecutivo();
        if (!$conexion->query("INSERT INTO InventarioDocumentos
            (idTipoDocumento, idUsuarioRegistro, idOperador, consecutivo, fechaDocumento, idResponsable, idOperadorAsignado, idEstado, tipoOrigen, observacion, estadoProceso, fechaFinalizacion, idUsuarioFinaliza, idBodegaOrigen, idUbicacionOrigen, idBodegaDestino, idUbicacionDestino, created_at, updated_at)
            VALUES ($idTipoDocumento, $idUsuarioRegistro, $idOperador, '" . tr_esc($consecutivo) . "', " . tr_fecha($fechaDocumento) . ", $idUsuarioRegistro, $idOperador, 1, 'MANUAL', " . tr_texto($observacion) . ", 'BORRADOR', NULL, NULL, $idBodegaOrigen, " . tr_int_null($idUbicacionOrigen) . ", $idBodegaDestino, " . tr_int_null($idUbicacionDestino) . ", NOW(), NOW())")) throw new Exception($conexion->error);
        $idDocumento = intval($conexion->insert_id);
    }

    $totalCantidad = 0;
    $totalProductos = 0;
    $detallesGuardados = [];

    foreach ($detalles as $i => $detalle) {
        $linea = $i + 1;
        $idProducto = intval($detalle["idProducto"] ?? 0);
        $cantidad = tr_dec($detalle["cantidad"] ?? $detalle["cantidadSolicitada"] ?? 0);
        $idLote = intval($detalle["idLote"] ?? 0);
        $unidad = tr_limpiar($detalle["unidad"] ?? "");
        $obsDetalle = tr_limpiar($detalle["observacion"] ?? "");

        if ($idProducto <= 0) throw new Exception("La línea $linea no tiene producto seleccionado");
        if ($cantidad <= 0) throw new Exception("La línea $linea debe tener una cantidad mayor a cero");

        $producto = tr_producto($idProducto);
        if (!$producto) throw new Exception("El producto de la línea $linea no está activo o no está configurado para inventario");
        if ($unidad === "") $unidad = $producto["unidadBaseInventario"] ?: "UND";

        $lote = tr_validar_lote($detalle, $producto);
        $idLoteFinal = $lote ? intval($lote["id"]) : 0;

        $existencia = tr_existencia($idProducto, $idLoteFinal, $idBodegaOrigen, $idUbicacionOrigen, false);
        $disponible = $existencia ? floatval($existencia["cantidadDisponible"]) : 0;
        if ($disponible <= 0) throw new Exception("No hay existencia disponible en origen para el producto " . $producto["descripcion"]);
        if ($cantidad > $disponible) throw new Exception("La cantidad solicitada para " . $producto["descripcion"] . " supera la existencia disponible en origen. Disponible: " . $disponible);

        if (!$conexion->query("INSERT INTO InventarioDocumentoDetalle
            (idDocumento, idProducto, cantidadSolicitada, cantidadProcesada, unidad, observacion, created_at, updated_at)
            VALUES ($idDocumento, $idProducto, $cantidad, 0, '" . tr_esc($unidad) . "', " . tr_texto($obsDetalle) . ", NOW(), NOW())")) throw new Exception($conexion->error);

        $idDocumentoDetalle = intval($conexion->insert_id);

        if (!$conexion->query("INSERT INTO InventarioDocumentoDetalleLotes
            (idDocumentoDetalle, idLote, idBodega, idUbicacion, cantidad, observacion, created_at)
            VALUES ($idDocumentoDetalle, " . tr_int_null($idLoteFinal) . ", $idBodegaOrigen, " . tr_int_null($idUbicacionOrigen) . ", $cantidad, " . tr_texto($obsDetalle) . ", NOW())")) throw new Exception($conexion->error);

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
            "idLote" => $idLoteFinal ?: null,
            "lote" => $lote ? $lote["lote"] : null,
            "idBodegaOrigen" => $idBodegaOrigen,
            "idUbicacionOrigen" => $idUbicacionOrigen ?: null,
            "idBodegaDestino" => $idBodegaDestino,
            "idUbicacionDestino" => $idUbicacionDestino ?: null,
            "disponibleValidado" => $disponible
        ];
    }

    $conexion->commit();

    tr_responder("si", $modo === "CREADO" ? "Traslado guardado como borrador correctamente" : "Traslado actualizado como borrador correctamente", [
        "idDocumento" => $idDocumento,
        "idTraslado" => $idDocumento,
        "consecutivo" => $consecutivo,
        "fechaDocumento" => $fechaDocumento,
        "idTipoDocumento" => $idTipoDocumento,
        "tipoDocumento" => $tipoDocumento["nombre"],
        "idUsuarioRegistro" => $idUsuarioRegistro,
        "idOperador" => $idOperador,
        "idBodegaOrigen" => $idBodegaOrigen,
        "idUbicacionOrigen" => $idUbicacionOrigen ?: null,
        "idBodegaDestino" => $idBodegaDestino,
        "idUbicacionDestino" => $idUbicacionDestino ?: null,
        "estadoProceso" => "BORRADOR",
        "estadoProcesoTexto" => "Borrador",
        "editable" => true,
        "finalizable" => true,
        "totalProductos" => $totalProductos,
        "totalCantidad" => $totalCantidad,
        "detalles" => $detallesGuardados
    ], ["modo" => $modo]);
} catch (Throwable $e) {
    if (isset($conexion) && $conexion instanceof mysqli) $conexion->rollback();
    tr_responder("no", "Error guardando traslado de inventario", [], ["error" => $e->getMessage()], 500);
}
?>
