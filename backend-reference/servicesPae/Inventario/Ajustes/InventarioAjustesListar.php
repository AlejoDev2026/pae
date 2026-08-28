<?php
require_once __DIR__ . "/InventarioAjustesHelper.php";

try {
    $idUsuario = intval(aj_parametro("idUsuario", 0));
    $idOperador = intval(aj_parametro("idOperador", 0));
    $fechaDesde = aj_limpiar_texto(aj_parametro("fechaDesde", ""));
    $fechaHasta = aj_limpiar_texto(aj_parametro("fechaHasta", ""));
    $estadoProceso = strtoupper(aj_limpiar_texto(aj_parametro("estadoProceso", "")));
    $tipoAjusteFiltro = strtoupper(aj_limpiar_texto(aj_parametro("tipoAjuste", "")));
    $q = aj_limpiar_texto(aj_parametro("q", aj_parametro("busqueda", "")));
    $limite = intval(aj_parametro("limite", 100));

    if ($limite <= 0 || $limite > 500) {
        $limite = 100;
    }

    /*
        Importante:
        InventarioDocumentos es una tabla compartida por Entradas, Salidas,
        Traslados y Ajustes.

        Por eso NO se debe listar por tipoOrigen = 'MANUAL' ni por LIKE '%AJUSTE%'
        de forma amplia, porque puede traer documentos manuales antiguos o
        documentos que quedaron relacionados a un tipo documento de ajuste.

        Los ajustes creados por este módulo siempre generan consecutivo AJU-...
        y usan tipoMovimiento/codigo base AJUSTE_POSITIVO o AJUSTE_NEGATIVO.
    */
    $where = "
        d.consecutivo LIKE 'AJU-%'
        AND (
            td.tipoMovimiento IN ('AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO')
            OR td.codigo IN ('AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO')
        )
    ";

    if ($idUsuario > 0) {
        $where .= " AND d.idUsuarioRegistro = $idUsuario ";
    }

    if ($idOperador > 0) {
        $where .= " AND d.idOperador = $idOperador ";
    }

    if ($fechaDesde !== "") {
        $where .= " AND d.fechaDocumento >= '" . aj_esc($fechaDesde) . "' ";
    }

    if ($fechaHasta !== "") {
        $where .= " AND d.fechaDocumento <= '" . aj_esc($fechaHasta) . "' ";
    }

    if (in_array($estadoProceso, ["BORRADOR", "FINALIZADA", "ANULADA"], true)) {
        $where .= " AND d.estadoProceso = '" . aj_esc($estadoProceso) . "' ";
    }

    if ($q !== "") {
        $qEsc = aj_esc($q);
        $like = "%" . $qEsc . "%";
        $where .= "
            AND (
                d.consecutivo LIKE '$like'
                OR d.observacion LIKE '$like'
                OR td.nombre LIKE '$like'
                OR td.codigo LIKE '$like'
                OR us.nombre LIKE '$like'
                OR io.nombreCompleto LIKE '$like'
                OR io.codigo LIKE '$like'
                OR b.nombre LIKE '$like'
                OR u.nombre LIKE '$like'
            )
        ";
    }

    $filas = aj_obtener_filas("
        SELECT
            d.id,
            d.idTipoDocumento,
            d.idUsuarioRegistro,
            d.idOperador,
            d.consecutivo,
            d.fechaDocumento,
            d.idEstado,
            d.tipoOrigen,
            d.observacion,
            d.estadoProceso,
            d.fechaFinalizacion,
            d.idUsuarioFinaliza,
            d.idBodegaOrigen AS idBodega,
            d.idUbicacionOrigen AS idUbicacion,
            d.created_at,
            d.updated_at,

            td.codigo AS codigoTipoDocumento,
            td.nombre AS tipoDocumento,
            td.tipoMovimiento,
            td.naturaleza,
            td.descripcion,

            us.nombre AS usuarioRegistro,
            io.codigo AS codigoOperador,
            io.nombreCompleto AS operador,

            b.codigo AS codigoBodega,
            b.nombre AS bodega,
            u.codigo AS codigoUbicacion,
            u.nombre AS ubicacion,

            COUNT(DISTINCT dd.id) AS totalProductos,
            COALESCE(SUM(dd.cantidadSolicitada), 0) AS totalCantidad,
            COUNT(DISTINCT im.id) AS totalMovimientos

        FROM InventarioDocumentos d
        INNER JOIN TiposDocumentoInventario td
            ON td.id = d.idTipoDocumento
        LEFT JOIN usuarios us
            ON us.id = d.idUsuarioRegistro
        LEFT JOIN InventarioOperadores io
            ON io.id = d.idOperador
        LEFT JOIN BodegasInventario b
            ON b.id = d.idBodegaOrigen
        LEFT JOIN UbicacionesInventario u
            ON u.id = d.idUbicacionOrigen
        LEFT JOIN InventarioDocumentoDetalle dd
            ON dd.idDocumento = d.id
        LEFT JOIN InventarioMovimientos im
            ON im.idDocumento = d.id

        WHERE $where

        GROUP BY
            d.id,
            d.idTipoDocumento,
            d.idUsuarioRegistro,
            d.idOperador,
            d.consecutivo,
            d.fechaDocumento,
            d.idEstado,
            d.tipoOrigen,
            d.observacion,
            d.estadoProceso,
            d.fechaFinalizacion,
            d.idUsuarioFinaliza,
            d.idBodegaOrigen,
            d.idUbicacionOrigen,
            d.created_at,
            d.updated_at,
            td.codigo,
            td.nombre,
            td.tipoMovimiento,
            td.naturaleza,
            td.descripcion,
            us.nombre,
            io.codigo,
            io.nombreCompleto,
            b.codigo,
            b.nombre,
            u.codigo,
            u.nombre

        ORDER BY
            d.created_at DESC,
            d.id DESC

        LIMIT $limite
    ");

    $data = array_map("aj_formatear_documento", $filas);

    if (in_array($tipoAjusteFiltro, ["POSITIVO", "NEGATIVO"], true)) {
        $data = array_values(array_filter($data, function ($item) use ($tipoAjusteFiltro) {
            return $item["tipoAjuste"] === $tipoAjusteFiltro;
        }));
    }

    $resumen = [
        "totalAjustes" => count($data),
        "totalBorradores" => 0,
        "totalFinalizados" => 0,
        "totalPositivos" => 0,
        "totalNegativos" => 0,
        "totalProductos" => 0,
        "totalCantidad" => 0
    ];

    foreach ($data as $item) {
        if ($item["estadoProceso"] === "BORRADOR") {
            $resumen["totalBorradores"]++;
        }

        if ($item["estadoProceso"] === "FINALIZADA") {
            $resumen["totalFinalizados"]++;
        }

        if ($item["tipoAjuste"] === "POSITIVO") {
            $resumen["totalPositivos"]++;
        }

        if ($item["tipoAjuste"] === "NEGATIVO") {
            $resumen["totalNegativos"]++;
        }

        $resumen["totalProductos"] += intval($item["totalProductos"]);
        $resumen["totalCantidad"] += floatval($item["totalCantidad"]);
    }

    aj_responder(
        "si",
        "Ajustes de inventario consultados correctamente",
        $data,
        [
            "total" => count($data),
            "resumen" => $resumen
        ]
    );
} catch (Throwable $e) {
    aj_responder(
        "no",
        "Error consultando ajustes de inventario",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
