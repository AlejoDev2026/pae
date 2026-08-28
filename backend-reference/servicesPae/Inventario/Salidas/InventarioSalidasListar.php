<?php
require_once __DIR__ . "/InventarioSalidasHelper.php";

try {
    $idUsuario = intval(sal_parametro("idUsuario", 0));
    $idOperador = intval(sal_parametro("idOperador", 0));
    $fechaDesde = sal_limpiar_texto(sal_parametro("fechaDesde", ""));
    $fechaHasta = sal_limpiar_texto(sal_parametro("fechaHasta", ""));
    $estadoProceso = strtoupper(sal_limpiar_texto(sal_parametro("estadoProceso", "")));
    $q = sal_limpiar_texto(sal_parametro("q", sal_parametro("busqueda", "")));
    $limite = intval(sal_parametro("limite", 100));

    if ($limite <= 0 || $limite > 500) {
        $limite = 100;
    }

    $where = "
        d.tipoOrigen = 'MANUAL'
        AND (
            td.naturaleza = 'SALIDA'
            OR td.naturaleza = 'SALIDA_INVENTARIO'
            OR td.naturaleza = 'SALIDA DE INVENTARIO'
            OR td.naturaleza LIKE '%SALIDA%'
        )
    ";

    if ($idUsuario > 0) {
        $where .= " AND d.idUsuarioRegistro = $idUsuario ";
    }

    if ($idOperador > 0) {
        $where .= " AND d.idOperador = $idOperador ";
    }

    if ($fechaDesde !== "") {
        $where .= " AND d.fechaDocumento >= '" . sal_esc($fechaDesde) . "' ";
    }

    if ($fechaHasta !== "") {
        $where .= " AND d.fechaDocumento <= '" . sal_esc($fechaHasta) . "' ";
    }

    if (in_array($estadoProceso, ["BORRADOR", "FINALIZADA", "ANULADA"], true)) {
        $where .= " AND d.estadoProceso = '" . sal_esc($estadoProceso) . "' ";
    }

    if ($q !== "") {
        $qEsc = sal_esc($q);
        $like = "%" . $qEsc . "%";
        $where .= "
            AND (
                d.consecutivo LIKE '$like'
                OR d.observacion LIKE '$like'
                OR td.nombre LIKE '$like'
                OR u.nombre LIKE '$like'
                OR io.nombreCompleto LIKE '$like'
                OR io.codigo LIKE '$like'
            )
        ";
    }

    $filas = sal_obtener_filas("
        SELECT
            d.id,
            d.idTipoDocumento,
            d.idUsuarioRegistro,
            d.idOperador,
            d.consecutivo,
            d.fechaDocumento,
            d.idResponsable,
            d.idOperadorAsignado,
            d.idEstado,
            d.tipoOrigen,
            d.observacion,
            d.estadoProceso,
            d.fechaFinalizacion,
            d.idUsuarioFinaliza,
            d.created_at,
            d.updated_at,

            td.codigo AS codigoTipoDocumento,
            td.nombre AS tipoDocumento,
            td.tipoMovimiento,
            td.naturaleza,
            COALESCE(td.permiteLoteVencido, 0) AS permiteLoteVencido,

            u.nombre AS usuarioRegistro,
            io.codigo AS codigoOperador,
            io.nombreCompleto AS operador,

            COUNT(DISTINCT dd.id) AS totalProductos,
            COALESCE(SUM(dd.cantidadSolicitada), 0) AS totalCantidad,
            COUNT(DISTINCT im.id) AS totalMovimientos

        FROM InventarioDocumentos d
        INNER JOIN TiposDocumentoInventario td
            ON td.id = d.idTipoDocumento
        LEFT JOIN usuarios u
            ON u.id = d.idUsuarioRegistro
        LEFT JOIN InventarioOperadores io
            ON io.id = d.idOperador
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
            d.idResponsable,
            d.idOperadorAsignado,
            d.idEstado,
            d.tipoOrigen,
            d.observacion,
            d.estadoProceso,
            d.fechaFinalizacion,
            d.idUsuarioFinaliza,
            d.created_at,
            d.updated_at,
            td.codigo,
            td.nombre,
            td.tipoMovimiento,
            td.naturaleza,
            td.permiteLoteVencido,
            u.nombre,
            io.codigo,
            io.nombreCompleto

        ORDER BY
            d.created_at DESC,
            d.id DESC

        LIMIT $limite
    ");

    $data = array_map("sal_formatear_documento", $filas);

    $resumen = [
        "totalSalidas" => count($data),
        "totalBorradores" => 0,
        "totalFinalizadas" => 0,
        "totalProductos" => 0,
        "totalCantidad" => 0
    ];

    foreach ($data as $item) {
        if ($item["estadoProceso"] === "BORRADOR") {
            $resumen["totalBorradores"]++;
        }

        if ($item["estadoProceso"] === "FINALIZADA") {
            $resumen["totalFinalizadas"]++;
        }

        $resumen["totalProductos"] += intval($item["totalProductos"]);
        $resumen["totalCantidad"] += floatval($item["totalCantidad"]);
    }

    sal_responder(
        "si",
        "Salidas de inventario consultadas correctamente",
        $data,
        [
            "total" => count($data),
            "resumen" => $resumen
        ]
    );
} catch (Throwable $e) {
    sal_responder(
        "no",
        "Error consultando salidas de inventario",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
