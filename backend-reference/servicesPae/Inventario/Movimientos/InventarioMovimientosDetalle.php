<?php
require_once __DIR__ . "/InventarioMovimientosHelper.php";

try {
    $idMovimiento = intval(km_parametro("idMovimiento", km_parametro("id", 0)));
    $idDocumento = intval(km_parametro("idDocumento", 0));

    if ($idMovimiento <= 0 && $idDocumento <= 0) {
        km_responder(
            "no",
            "Debe enviar idMovimiento o idDocumento",
            [],
            [],
            400
        );
    }

    $movimiento = null;

    if ($idMovimiento > 0) {
        $fila = km_obtener_fila(
            km_select_movimientos_sql() .
            km_base_movimientos_sql() .
            " WHERE m.id = $idMovimiento LIMIT 1"
        );

        if (!$fila) {
            km_responder("no", "El movimiento no fue encontrado", [], [], 404);
        }

        $movimiento = km_formatear_movimiento($fila);

        if (!$idDocumento && $movimiento["idDocumento"]) {
            $idDocumento = intval($movimiento["idDocumento"]);
        }
    }

    $documento = null;
    $detallesDocumento = [];
    $movimientosDocumento = [];

    if ($idDocumento > 0) {
        $documento = km_obtener_fila("
            SELECT
                d.id,
                d.idTipoDocumento,
                td.codigo AS codigoTipoDocumento,
                td.nombre AS tipoDocumento,
                td.naturaleza,
                td.tipoMovimiento AS tipoMovimientoDocumento,
                d.idUsuarioRegistro,
                u.nombre AS usuarioRegistro,
                d.idOperador,
                io.codigo AS codigoOperador,
                io.nombreCompleto AS operador,
                d.consecutivo,
                d.fechaDocumento,
                d.idResponsable,
                d.idOperadorAsignado,
                d.idEstado,
                d.idDespachoInforme,
                d.tipoOrigen,
                d.observacion,
                d.estadoProceso,
                d.fechaFinalizacion,
                d.idUsuarioFinaliza,
                d.idBodegaOrigen,
                bo.nombre AS bodegaOrigen,
                d.idUbicacionOrigen,
                uo.nombre AS ubicacionOrigen,
                d.idBodegaDestino,
                bd.nombre AS bodegaDestino,
                d.idUbicacionDestino,
                ud.nombre AS ubicacionDestino,
                d.created_at,
                d.updated_at
            FROM InventarioDocumentos d
            LEFT JOIN TiposDocumentoInventario td
                ON td.id = d.idTipoDocumento
            LEFT JOIN usuarios u
                ON u.id = d.idUsuarioRegistro
            LEFT JOIN InventarioOperadores io
                ON io.id = d.idOperador
            LEFT JOIN BodegasInventario bo
                ON bo.id = d.idBodegaOrigen
            LEFT JOIN UbicacionesInventario uo
                ON uo.id = d.idUbicacionOrigen
            LEFT JOIN BodegasInventario bd
                ON bd.id = d.idBodegaDestino
            LEFT JOIN UbicacionesInventario ud
                ON ud.id = d.idUbicacionDestino
            WHERE d.id = $idDocumento
            LIMIT 1
        ");

        if ($documento) {
            $documento = [
                "idDocumento" => intval($documento["id"]),
                "idTipoDocumento" => intval($documento["idTipoDocumento"]),
                "codigoTipoDocumento" => $documento["codigoTipoDocumento"],
                "tipoDocumento" => $documento["tipoDocumento"],
                "naturaleza" => $documento["naturaleza"],
                "tipoMovimientoDocumento" => $documento["tipoMovimientoDocumento"],
                "idUsuarioRegistro" => $documento["idUsuarioRegistro"] !== null ? intval($documento["idUsuarioRegistro"]) : null,
                "usuarioRegistro" => $documento["usuarioRegistro"],
                "idOperador" => $documento["idOperador"] !== null ? intval($documento["idOperador"]) : null,
                "codigoOperador" => $documento["codigoOperador"],
                "operador" => $documento["operador"],
                "consecutivo" => $documento["consecutivo"],
                "fechaDocumento" => $documento["fechaDocumento"],
                "idResponsable" => $documento["idResponsable"] !== null ? intval($documento["idResponsable"]) : null,
                "idOperadorAsignado" => $documento["idOperadorAsignado"] !== null ? intval($documento["idOperadorAsignado"]) : null,
                "idEstado" => $documento["idEstado"] !== null ? intval($documento["idEstado"]) : null,
                "idDespachoInforme" => $documento["idDespachoInforme"] !== null ? intval($documento["idDespachoInforme"]) : null,
                "tipoOrigen" => $documento["tipoOrigen"],
                "observacion" => $documento["observacion"],
                "estadoProceso" => $documento["estadoProceso"],
                "fechaFinalizacion" => $documento["fechaFinalizacion"],
                "idUsuarioFinaliza" => $documento["idUsuarioFinaliza"] !== null ? intval($documento["idUsuarioFinaliza"]) : null,
                "idBodegaOrigen" => $documento["idBodegaOrigen"] !== null ? intval($documento["idBodegaOrigen"]) : null,
                "bodegaOrigen" => $documento["bodegaOrigen"],
                "idUbicacionOrigen" => $documento["idUbicacionOrigen"] !== null ? intval($documento["idUbicacionOrigen"]) : null,
                "ubicacionOrigen" => $documento["ubicacionOrigen"],
                "idBodegaDestino" => $documento["idBodegaDestino"] !== null ? intval($documento["idBodegaDestino"]) : null,
                "bodegaDestino" => $documento["bodegaDestino"],
                "idUbicacionDestino" => $documento["idUbicacionDestino"] !== null ? intval($documento["idUbicacionDestino"]) : null,
                "ubicacionDestino" => $documento["ubicacionDestino"],
                "created_at" => $documento["created_at"],
                "updated_at" => $documento["updated_at"]
            ];
        }

        $detalles = km_obtener_filas("
            SELECT
                dd.id,
                dd.idDocumento,
                dd.idProducto,
                pc.codigo AS codigoProducto,
                pc.descripcion AS producto,
                dd.cantidadSolicitada,
                dd.cantidadProcesada,
                dd.unidad,
                dd.observacion,
                dd.created_at,
                dd.updated_at
            FROM InventarioDocumentoDetalle dd
            INNER JOIN ProductosCatalogo pc
                ON pc.id = dd.idProducto
            WHERE dd.idDocumento = $idDocumento
            ORDER BY dd.id ASC
        ");

        $detallesDocumento = array_map(function ($fila) {
            return [
                "idDocumentoDetalle" => intval($fila["id"]),
                "idDocumento" => intval($fila["idDocumento"]),
                "idProducto" => intval($fila["idProducto"]),
                "codigoProducto" => $fila["codigoProducto"],
                "producto" => $fila["producto"],
                "cantidadSolicitada" => km_numero($fila["cantidadSolicitada"]),
                "cantidadProcesada" => km_numero($fila["cantidadProcesada"]),
                "unidad" => $fila["unidad"],
                "observacion" => $fila["observacion"],
                "created_at" => $fila["created_at"],
                "updated_at" => $fila["updated_at"]
            ];
        }, $detalles);

        $movimientosFilas = km_obtener_filas(
            km_select_movimientos_sql() .
            km_base_movimientos_sql() .
            "
                WHERE m.idDocumento = $idDocumento
                ORDER BY m.fechaMovimiento ASC, m.id ASC
            "
        );

        $movimientosDocumento = array_map("km_formatear_movimiento", $movimientosFilas);
    }

    km_responder(
        "si",
        "Detalle de movimiento consultado correctamente",
        [
            "movimiento" => $movimiento,
            "documento" => $documento,
            "detallesDocumento" => $detallesDocumento,
            "movimientosDocumento" => $movimientosDocumento,
            "resumenDocumento" => km_resumen_desde_movimientos($movimientosDocumento)
        ],
        [
            "totalMovimientosDocumento" => count($movimientosDocumento),
            "totalDetallesDocumento" => count($detallesDocumento)
        ]
    );
} catch (Throwable $e) {
    km_responder(
        "no",
        "Error consultando detalle de movimiento",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
