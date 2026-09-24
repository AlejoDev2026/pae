<?php
require_once __DIR__ . "/InventarioEntradasHelper.php";

try {
    $idUsuario = intval(inv_parametro("idUsuario", 0));
    $idOperador = intval(inv_parametro("idOperador", 0));
    $fechaDesde = inv_limpiar_texto(inv_parametro("fechaDesde", ""));
    $fechaHasta = inv_limpiar_texto(inv_parametro("fechaHasta", ""));
    $estadoProceso = strtoupper(inv_limpiar_texto(inv_parametro("estadoProceso", "")));
    $q = inv_limpiar_texto(inv_parametro("q", inv_parametro("busqueda", "")));
    $limite = intval(inv_parametro("limite", 100));

    if ($limite <= 0 || $limite > 500) {
        $limite = 100;
    }

    $where = "
        td.naturaleza IN ('ENTRADA', 'INVENTARIO_INICIAL')
        AND d.tipoOrigen IN ('MANUAL', 'ORDEN_COMPRA')
    ";

    if ($idUsuario > 0) {
        $where .= " AND d.idUsuarioRegistro = $idUsuario ";
    }

    if ($idOperador > 0) {
        $where .= " AND d.idOperador = $idOperador ";
    }

    if ($fechaDesde !== "") {
        $where .= " AND d.fechaDocumento >= '" . inv_esc($fechaDesde) . "' ";
    }

    if ($fechaHasta !== "") {
        $where .= " AND d.fechaDocumento <= '" . inv_esc($fechaHasta) . "' ";
    }

    if (in_array($estadoProceso, ["BORRADOR", "FINALIZADA", "ANULADA"], true)) {
        $where .= " AND d.estadoProceso = '" . inv_esc($estadoProceso) . "' ";
    }

    if ($q !== "") {
        $qEsc = inv_esc($q);
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

    $filas = inv_obtener_filas("
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
            u.nombre,
            io.codigo,
            io.nombreCompleto

        ORDER BY
            d.created_at DESC,
            d.id DESC

        LIMIT $limite
    ");

    $data = array_map("inv_formatear_documento", $filas);

    require_once __DIR__ . '/EntradaCompraHelper.php';
    require_once __DIR__ . '/../OrdenesCompra/RecepcionCompraSql.php';
    foreach ($data as &$entrada) {
        if ($entrada['tipoOrigen'] === 'ORDEN_COMPRA') {
            $recepcion = ecConsulta('SELECT ' . ocPendienteSql('r.idOrdenCompra') . ' AS pendiente FROM InventarioEntradaCompra r WHERE r.idDocumento = ?', [$entrada['idDocumento']]);
            $entrada['compraConPendientes'] = !empty($recepcion[0]['pendiente']);
        }
    }
    unset($entrada);

    $resumen = [
        "totalEntradas" => count($data),
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

    inv_responder(
        "si",
        "Entradas de inventario consultadas correctamente",
        $data,
        [
            "total" => count($data),
            "resumen" => $resumen
        ]
    );
} catch (Throwable $e) {
    inv_responder(
        "no",
        "Error consultando entradas de inventario",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
