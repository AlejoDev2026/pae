<?php
require_once __DIR__ . "/InventarioTrasladosHelper.php";

try {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") tr_responder("no", "Método no permitido", [], [], 405);

    $input = tr_json();
    $idDocumento = intval($input["idDocumento"] ?? $input["idTraslado"] ?? $input["id"] ?? 0);
    $idUsuarioFinaliza = intval($input["idUsuarioFinaliza"] ?? $input["idUsuario"] ?? $input["idUsuarioRegistro"] ?? 0);
    $idOperador = intval($input["idOperador"] ?? 0);
    $obsFinal = tr_limpiar($input["observacionFinalizacion"] ?? "");

    if ($idDocumento <= 0) tr_responder("no", "Debe enviar el traslado que desea finalizar");
    if ($idUsuarioFinaliza <= 0) tr_responder("no", "Debe enviar el usuario que finaliza el traslado");

    $conexion->begin_transaction();

    $doc = tr_fila("SELECT d.*, td.nombre AS tipoDocumento, td.codigo AS codigoTipoDocumento, td.tipoMovimiento, td.naturaleza, td.afectaInventario, td.estado AS estadoTipoDocumento
        FROM InventarioDocumentos d INNER JOIN TiposDocumentoInventario td ON td.id = d.idTipoDocumento
        WHERE d.id = $idDocumento LIMIT 1 FOR UPDATE");

    if (!$doc) throw new Exception("El traslado no existe");
    if ($doc["estadoProceso"] !== "BORRADOR") throw new Exception("Este traslado ya fue finalizado o anulado");
    if (intval($doc["estadoTipoDocumento"]) !== 1) throw new Exception("El tipo de documento del traslado está inactivo");
    if (intval($doc["afectaInventario"]) !== 1) throw new Exception("El tipo de documento del traslado no afecta inventario");
    if (!tr_es_traslado($doc["naturaleza"], $doc["tipoMovimiento"])) throw new Exception("El documento no corresponde a un traslado de inventario");
    if (tr_movs_doc($idDocumento) > 0) throw new Exception("Este traslado ya tiene movimientos registrados");

    $bo = intval($doc["idBodegaOrigen"] ?? 0);
    $uo = intval($doc["idUbicacionOrigen"] ?? 0);
    $bd = intval($doc["idBodegaDestino"] ?? 0);
    $ud = intval($doc["idUbicacionDestino"] ?? 0);
    tr_validar_origen_destino($bo, $uo, $bd, $ud);

    if ($idOperador <= 0) $idOperador = intval($doc["idOperador"] ?? 0);
    if ($idOperador <= 0) {
        $op = tr_operador_usuario($idUsuarioFinaliza);
        if (!$op) throw new Exception("El usuario no tiene operador activo para finalizar traslados de inventario");
        $idOperador = intval($op["idOperador"]);
    }

    $lineas = tr_filas("SELECT dd.id AS idDocumentoDetalle, dd.idProducto, dd.cantidadSolicitada, dd.cantidadProcesada, dd.unidad, dd.observacion AS observacionDetalle,
            dl.id AS idDetalleLote, dl.idLote, dl.idBodega, dl.idUbicacion, dl.cantidad, dl.observacion AS observacionLote,
            pc.descripcion AS producto, pc.codigo AS codigoProducto, pic.manejaLote, pic.manejaVencimiento,
            il.lote, il.fechaVencimiento
        FROM InventarioDocumentoDetalle dd
        INNER JOIN InventarioDocumentoDetalleLotes dl ON dl.idDocumentoDetalle = dd.id
        INNER JOIN ProductosCatalogo pc ON pc.id = dd.idProducto
        INNER JOIN ProductosInventarioConfig pic ON pic.idProducto = pc.id AND pic.estado = 1
        LEFT JOIN InventarioLotes il ON il.id = dl.idLote
        WHERE dd.idDocumento = $idDocumento
        ORDER BY dd.id ASC, dl.id ASC");

    if (count($lineas) === 0) throw new Exception("El traslado no tiene productos para finalizar");

    $totalCantidad = 0;
    $totalProductos = 0;
    $movimientos = [];

    foreach ($lineas as $i => $linea) {
        $n = $i + 1;
        $idProducto = intval($linea["idProducto"]);
        $idDetalle = intval($linea["idDocumentoDetalle"]);
        $idLote = intval($linea["idLote"] ?? 0);
        $cantidad = tr_dec($linea["cantidad"] ?? 0);

        if ($cantidad <= 0) throw new Exception("La línea $n debe tener una cantidad mayor a cero");
        $producto = tr_producto($idProducto);
        if (!$producto) throw new Exception("El producto " . ($linea["producto"] ?? $idProducto) . " no está activo o configurado para inventario");
        if (intval($producto["manejaLote"]) === 1 && $idLote <= 0) throw new Exception("El producto " . $producto["descripcion"] . " requiere lote antes de finalizar");
        tr_validar_lote(["idLote" => $idLote], $producto);

        $exOrigen = tr_existencia($idProducto, $idLote, $bo, $uo, true);
        if (!$exOrigen) throw new Exception("No hay existencia disponible en origen para el producto " . $producto["descripcion"]);

        $saldoOrigenAntes = floatval($exOrigen["cantidadDisponible"]);
        if ($cantidad > $saldoOrigenAntes) throw new Exception("La cantidad solicitada para " . $producto["descripcion"] . " supera la existencia disponible en origen. Disponible: " . $saldoOrigenAntes);

        $saldoOrigenNuevo = $saldoOrigenAntes - $cantidad;
        $idExOrigen = intval($exOrigen["id"]);

        if (!$conexion->query("UPDATE InventarioExistencias SET cantidadDisponible = $saldoOrigenNuevo, updated_at = NOW() WHERE id = $idExOrigen LIMIT 1")) throw new Exception($conexion->error);

        $exDestino = tr_existencia($idProducto, $idLote, $bd, $ud, true);
        if ($exDestino) {
            $saldoDestinoAntes = floatval($exDestino["cantidadDisponible"]);
            $saldoDestinoNuevo = $saldoDestinoAntes + $cantidad;
            $idExDestino = intval($exDestino["id"]);
            if (!$conexion->query("UPDATE InventarioExistencias SET cantidadDisponible = $saldoDestinoNuevo, updated_at = NOW() WHERE id = $idExDestino LIMIT 1")) throw new Exception($conexion->error);
        } else {
            $saldoDestinoAntes = 0;
            $saldoDestinoNuevo = $cantidad;
            if (!$conexion->query("INSERT INTO InventarioExistencias (idProducto, idLote, idBodega, idUbicacion, cantidadDisponible, cantidadReservada, cantidadBloqueada, created_at, updated_at)
                VALUES ($idProducto, " . tr_int_null($idLote) . ", $bd, " . tr_int_null($ud) . ", $cantidad, 0, 0, NOW(), NOW())")) throw new Exception($conexion->error);
        }

        $obsMov = $linea["observacionDetalle"] ?: $obsFinal;

        if (!$conexion->query("INSERT INTO InventarioMovimientos
            (idDocumento, idDocumentoDetalle, idProducto, idLote, idBodega, idUbicacion, tipoMovimiento, cantidad, saldoAnterior, saldoNuevo, idUsuario, fechaMovimiento, observacion, idUsuarioRegistro, idOperador)
            VALUES ($idDocumento, $idDetalle, $idProducto, " . tr_int_null($idLote) . ", $bo, " . tr_int_null($uo) . ", 'SALIDA_TRASLADO', $cantidad, $saldoOrigenAntes, $saldoOrigenNuevo, $idUsuarioFinaliza, NOW(), " . tr_texto($obsMov) . ", $idUsuarioFinaliza, $idOperador)")) throw new Exception($conexion->error);
        $idMovSalida = intval($conexion->insert_id);

        if (!$conexion->query("INSERT INTO InventarioMovimientos
            (idDocumento, idDocumentoDetalle, idProducto, idLote, idBodega, idUbicacion, tipoMovimiento, cantidad, saldoAnterior, saldoNuevo, idUsuario, fechaMovimiento, observacion, idUsuarioRegistro, idOperador)
            VALUES ($idDocumento, $idDetalle, $idProducto, " . tr_int_null($idLote) . ", $bd, " . tr_int_null($ud) . ", 'ENTRADA_TRASLADO', $cantidad, $saldoDestinoAntes, $saldoDestinoNuevo, $idUsuarioFinaliza, NOW(), " . tr_texto($obsMov) . ", $idUsuarioFinaliza, $idOperador)")) throw new Exception($conexion->error);
        $idMovEntrada = intval($conexion->insert_id);

        $movimientos[] = [
            "idMovimientoSalida" => $idMovSalida,
            "idMovimientoEntrada" => $idMovEntrada,
            "idDocumentoDetalle" => $idDetalle,
            "idProducto" => $idProducto,
            "producto" => $producto["descripcion"],
            "idLote" => $idLote ?: null,
            "lote" => $linea["lote"] ?? null,
            "cantidad" => $cantidad,
            "origen" => ["idBodega" => $bo, "idUbicacion" => $uo ?: null, "saldoAnterior" => $saldoOrigenAntes, "saldoNuevo" => $saldoOrigenNuevo],
            "destino" => ["idBodega" => $bd, "idUbicacion" => $ud ?: null, "saldoAnterior" => $saldoDestinoAntes, "saldoNuevo" => $saldoDestinoNuevo]
        ];

        $totalCantidad += $cantidad;
        $totalProductos++;
    }

    if (!$conexion->query("UPDATE InventarioDocumentoDetalle SET cantidadProcesada = cantidadSolicitada, updated_at = NOW() WHERE idDocumento = $idDocumento")) throw new Exception($conexion->error);
    if (!$conexion->query("UPDATE InventarioDocumentos SET estadoProceso = 'FINALIZADA', fechaFinalizacion = NOW(), idUsuarioFinaliza = $idUsuarioFinaliza, idOperador = $idOperador, idEstado = 1, updated_at = NOW() WHERE id = $idDocumento LIMIT 1")) throw new Exception($conexion->error);

    $conexion->commit();

    tr_responder("si", "Traslado finalizado correctamente", [
        "idDocumento" => $idDocumento,
        "idTraslado" => $idDocumento,
        "consecutivo" => $doc["consecutivo"],
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
    ]);
} catch (Throwable $e) {
    if (isset($conexion) && $conexion instanceof mysqli) $conexion->rollback();
    tr_responder("no", "Error finalizando traslado de inventario", [], ["error" => $e->getMessage()], 500);
}
?>
