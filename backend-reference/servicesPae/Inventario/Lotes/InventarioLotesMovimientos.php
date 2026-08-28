<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header("Expires: Tue, 01 Jan 2000 00:00:00 GMT");
header("Last-Modified: " . gmdate("D, d M Y H:i:s") . " GMT");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Cache-Control, Pragma, Expires, Authorization");
header("Access-Control-Max-Age: 0");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

require_once __DIR__ . "/../conexion.php";

if (!isset($conexion) || !$conexion instanceof mysqli) {
    http_response_code(500);
    echo json_encode([
        "rpta" => "no",
        "mensaje" => "No se encontró la conexión a la base de datos",
        "data" => [],
        "error" => "La variable \$conexion no está disponible"
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

$conexion->set_charset("utf8mb4");

function lv_responder($rpta, $mensaje, $data = [], $extra = [], $codigoHttp = 200)
{
    http_response_code($codigoHttp);

    echo json_encode(
        array_merge([
            "rpta" => $rpta,
            "mensaje" => $mensaje,
            "data" => $data
        ], $extra),
        JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT
    );

    exit;
}

function lv_limpiar_texto($valor)
{
    return trim((string)($valor ?? ""));
}

function lv_entrada_json()
{
    static $entrada = null;

    if ($entrada !== null) {
        return $entrada;
    }

    $raw = file_get_contents("php://input");
    $json = json_decode($raw, true);
    $entrada = is_array($json) ? $json : [];

    return $entrada;
}

function lv_parametro($nombre, $default = "")
{
    if (isset($_GET[$nombre])) {
        return lv_limpiar_texto($_GET[$nombre]);
    }

    if (isset($_POST[$nombre])) {
        return lv_limpiar_texto($_POST[$nombre]);
    }

    $json = lv_entrada_json();

    if (array_key_exists($nombre, $json)) {
        return is_string($json[$nombre])
            ? lv_limpiar_texto($json[$nombre])
            : $json[$nombre];
    }

    return $default;
}

function lv_esc($valor)
{
    global $conexion;
    return $conexion->real_escape_string((string)($valor ?? ""));
}

function lv_obtener_fila($sql)
{
    global $conexion;

    $res = $conexion->query($sql);

    if (!$res) {
        throw new Exception($conexion->error);
    }

    return $res->fetch_assoc() ?: null;
}

function lv_obtener_filas($sql)
{
    global $conexion;

    $res = $conexion->query($sql);

    if (!$res) {
        throw new Exception($conexion->error);
    }

    $data = [];

    while ($fila = $res->fetch_assoc()) {
        $data[] = $fila;
    }

    return $data;
}

function lv_numero($valor)
{
    return round(floatval($valor ?? 0), 3);
}

function lv_fecha_valida($fecha)
{
    $fecha = lv_limpiar_texto($fecha);

    if ($fecha === "") {
        return "";
    }

    $fecha = substr($fecha, 0, 10);

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
        return "";
    }

    $partes = explode("-", $fecha);

    if (count($partes) !== 3 || !checkdate(intval($partes[1]), intval($partes[2]), intval($partes[0]))) {
        return "";
    }

    return $fecha;
}

function lv_formatear_lote($fila)
{
    return [
        "id" => intval($fila["id"]),
        "idLote" => intval($fila["id"]),
        "idProducto" => intval($fila["idProducto"]),
        "codigoProducto" => $fila["codigoProducto"] ?? null,
        "producto" => $fila["producto"] ?? null,
        "descripcion" => $fila["producto"] ?? null,
        "idTipoProducto" => $fila["idTipoProducto"] !== null ? intval($fila["idTipoProducto"]) : null,
        "tipoProducto" => $fila["tipoProducto"] ?? null,
        "manejaLote" => intval($fila["manejaLote"] ?? 0),
        "manejaVencimiento" => intval($fila["manejaVencimiento"] ?? 0),
        "unidad" => $fila["unidadBaseInventario"] ?: "UND",
        "lote" => $fila["lote"] ?? null,
        "fechaFabricacion" => $fila["fechaFabricacion"] ?? null,
        "fechaVencimiento" => $fila["fechaVencimiento"] ?? null,
        "fechaIngreso" => $fila["fechaIngreso"] ?? null,
        "observacion" => $fila["observacion"] ?? null,
        "estado" => intval($fila["estado"] ?? 0),
        "estadoLote" => intval($fila["estado"] ?? 0),
        "clasificacionVencimiento" => $fila["clasificacionVencimiento"] ?? "SIN_VENCIMIENTO",
        "diasParaVencer" => $fila["diasParaVencer"] !== null ? intval($fila["diasParaVencer"]) : null,
        "cantidadDisponible" => lv_numero($fila["cantidadDisponible"] ?? 0),
        "cantidadReservada" => lv_numero($fila["cantidadReservada"] ?? 0),
        "cantidadBloqueada" => lv_numero($fila["cantidadBloqueada"] ?? 0),
        "cantidadTotal" => lv_numero($fila["cantidadTotal"] ?? 0),
        "totalBodegas" => intval($fila["totalBodegas"] ?? 0),
        "totalUbicaciones" => intval($fila["totalUbicaciones"] ?? 0),
        "bodegas" => $fila["bodegas"] ?? null,
        "created_at" => $fila["created_at"] ?? null,
        "updated_at" => $fila["updated_at"] ?? null
    ];
}


try {
    $idLote = intval(lv_parametro("idLote", 0));
    $idBodega = intval(lv_parametro("idBodega", 0));
    $idUbicacion = intval(lv_parametro("idUbicacion", 0));
    $tipoMovimiento = strtoupper(lv_limpiar_texto(lv_parametro("tipoMovimiento", "")));
    $fechaDesde = lv_fecha_valida(lv_parametro("fechaDesde", ""));
    $fechaHasta = lv_fecha_valida(lv_parametro("fechaHasta", ""));

    $pagina = intval(lv_parametro("pagina", 1));
    $limite = intval(lv_parametro("limite", 100));

    if ($idLote <= 0) {
        lv_responder(
            "no",
            "Debe enviar el idLote para consultar los movimientos",
            [],
            [],
            400
        );
    }

    if ($pagina <= 0) {
        $pagina = 1;
    }

    if ($limite <= 0 || $limite > 1000) {
        $limite = 100;
    }

    $offset = ($pagina - 1) * $limite;

    $lote = lv_obtener_fila("
        SELECT
            il.id,
            il.idProducto,
            il.lote,
            il.fechaFabricacion,
            il.fechaVencimiento,
            il.fechaIngreso,
            il.estado,
            pc.codigo AS codigoProducto,
            pc.descripcion AS producto
        FROM InventarioLotes il
        INNER JOIN ProductosCatalogo pc
            ON pc.id = il.idProducto
        WHERE il.id = $idLote
        LIMIT 1
    ");

    if (!$lote) {
        lv_responder(
            "no",
            "El lote no fue encontrado",
            [],
            [],
            404
        );
    }

    $where = "m.idLote = $idLote";

    if ($idBodega > 0) {
        $where .= " AND m.idBodega = $idBodega ";
    }

    if ($idUbicacion > 0) {
        $where .= " AND m.idUbicacion = $idUbicacion ";
    }

    if ($tipoMovimiento !== "") {
        $tipoEsc = lv_esc($tipoMovimiento);
        $where .= " AND UPPER(m.tipoMovimiento) = '$tipoEsc' ";
    }

    if ($fechaDesde !== "") {
        $fechaDesdeEsc = lv_esc($fechaDesde . " 00:00:00");
        $where .= " AND m.fechaMovimiento >= '$fechaDesdeEsc' ";
    }

    if ($fechaHasta !== "") {
        $fechaHastaEsc = lv_esc($fechaHasta . " 23:59:59");
        $where .= " AND m.fechaMovimiento <= '$fechaHastaEsc' ";
    }

    $resumenGeneral = lv_obtener_fila("
        SELECT
            COUNT(*) AS total,
            COALESCE(SUM(m.cantidad), 0) AS cantidadMovida
        FROM InventarioMovimientos m
        WHERE $where
    ");

    $total = intval($resumenGeneral["total"] ?? 0);
    $cantidadMovidaTotal = lv_numero($resumenGeneral["cantidadMovida"] ?? 0);

    $primerMovimiento = lv_obtener_fila("
        SELECT
            m.saldoAnterior,
            m.saldoNuevo
        FROM InventarioMovimientos m
        WHERE $where
        ORDER BY
            m.fechaMovimiento ASC,
            m.id ASC
        LIMIT 1
    ");

    $ultimoMovimiento = lv_obtener_fila("
        SELECT
            m.saldoAnterior,
            m.saldoNuevo
        FROM InventarioMovimientos m
        WHERE $where
        ORDER BY
            m.fechaMovimiento DESC,
            m.id DESC
        LIMIT 1
    ");

    $filas = lv_obtener_filas("
        SELECT
            m.id,
            m.idDocumento,
            m.idDocumentoDetalle,
            m.idProducto,
            m.idLote,
            m.idBodega,
            m.idUbicacion,
            m.tipoMovimiento,
            m.cantidad,
            m.saldoAnterior,
            m.saldoNuevo,
            m.idUsuario,
            m.fechaMovimiento,
            m.observacion,
            m.idUsuarioRegistro,
            m.idOperador,

            pc.codigo AS codigoProducto,
            pc.descripcion AS producto,

            il.lote,
            il.fechaFabricacion,
            il.fechaVencimiento,
            il.fechaIngreso,
            il.estado AS estadoLote,

            b.codigo AS codigoBodega,
            b.nombre AS bodega,

            u.codigo AS codigoUbicacion,
            u.nombre AS ubicacion,

            d.consecutivo,
            d.fechaDocumento,
            d.estadoProceso,
            d.tipoOrigen,
            d.fechaFinalizacion,

            td.id AS idTipoDocumento,
            td.codigo AS codigoTipoDocumento,
            td.nombre AS tipoDocumento,
            td.naturaleza,
            td.tipoMovimiento AS tipoMovimientoDocumento,

            usu.nombre AS usuario,
            usr.nombre AS usuarioRegistro,

            io.codigo AS codigoOperador,
            io.nombreCompleto AS operador

        FROM InventarioMovimientos m
        INNER JOIN ProductosCatalogo pc
            ON pc.id = m.idProducto
        LEFT JOIN InventarioLotes il
            ON il.id = m.idLote
        INNER JOIN BodegasInventario b
            ON b.id = m.idBodega
        LEFT JOIN UbicacionesInventario u
            ON u.id = m.idUbicacion
        LEFT JOIN InventarioDocumentos d
            ON d.id = m.idDocumento
        LEFT JOIN TiposDocumentoInventario td
            ON td.id = d.idTipoDocumento
        LEFT JOIN usuarios usu
            ON usu.id = m.idUsuario
        LEFT JOIN usuarios usr
            ON usr.id = m.idUsuarioRegistro
        LEFT JOIN InventarioOperadores io
            ON io.id = m.idOperador
        WHERE $where
        ORDER BY
            m.fechaMovimiento ASC,
            m.id ASC
        LIMIT $limite OFFSET $offset
    ");

    $movimientos = array_map(function ($fila) {
        return [
            "id" => intval($fila["id"]),
            "idMovimiento" => intval($fila["id"]),
            "idDocumento" => $fila["idDocumento"] !== null ? intval($fila["idDocumento"]) : null,
            "idDocumentoDetalle" => $fila["idDocumentoDetalle"] !== null ? intval($fila["idDocumentoDetalle"]) : null,
            "idProducto" => intval($fila["idProducto"]),
            "codigoProducto" => $fila["codigoProducto"],
            "producto" => $fila["producto"],
            "descripcion" => $fila["producto"],
            "idLote" => $fila["idLote"] !== null ? intval($fila["idLote"]) : null,
            "lote" => $fila["lote"],
            "fechaFabricacion" => $fila["fechaFabricacion"],
            "fechaVencimiento" => $fila["fechaVencimiento"],
            "fechaIngreso" => $fila["fechaIngreso"],
            "estadoLote" => $fila["estadoLote"] !== null ? intval($fila["estadoLote"]) : null,
            "idBodega" => intval($fila["idBodega"]),
            "codigoBodega" => $fila["codigoBodega"],
            "bodega" => $fila["bodega"],
            "idUbicacion" => $fila["idUbicacion"] !== null ? intval($fila["idUbicacion"]) : null,
            "codigoUbicacion" => $fila["codigoUbicacion"],
            "ubicacion" => $fila["ubicacion"],
            "tipoMovimiento" => $fila["tipoMovimiento"],
            "cantidad" => lv_numero($fila["cantidad"]),
            "saldoAnterior" => lv_numero($fila["saldoAnterior"]),
            "saldoNuevo" => lv_numero($fila["saldoNuevo"]),
            "idUsuario" => $fila["idUsuario"] !== null ? intval($fila["idUsuario"]) : null,
            "usuario" => $fila["usuario"],
            "idUsuarioRegistro" => $fila["idUsuarioRegistro"] !== null ? intval($fila["idUsuarioRegistro"]) : null,
            "usuarioRegistro" => $fila["usuarioRegistro"],
            "idOperador" => $fila["idOperador"] !== null ? intval($fila["idOperador"]) : null,
            "codigoOperador" => $fila["codigoOperador"],
            "operador" => $fila["operador"],
            "fechaMovimiento" => $fila["fechaMovimiento"],
            "observacion" => $fila["observacion"],
            "consecutivo" => $fila["consecutivo"],
            "fechaDocumento" => $fila["fechaDocumento"],
            "estadoProceso" => $fila["estadoProceso"],
            "tipoOrigen" => $fila["tipoOrigen"],
            "fechaFinalizacion" => $fila["fechaFinalizacion"],
            "idTipoDocumento" => $fila["idTipoDocumento"] !== null ? intval($fila["idTipoDocumento"]) : null,
            "codigoTipoDocumento" => $fila["codigoTipoDocumento"],
            "tipoDocumento" => $fila["tipoDocumento"],
            "naturaleza" => $fila["naturaleza"],
            "tipoMovimientoDocumento" => $fila["tipoMovimientoDocumento"]
        ];
    }, $filas);

    $saldoInicial = $primerMovimiento
        ? lv_numero($primerMovimiento["saldoAnterior"])
        : null;

    $saldoFinal = $ultimoMovimiento
        ? lv_numero($ultimoMovimiento["saldoNuevo"])
        : null;

    $cantidadMovidaMostrada = 0;

    foreach ($movimientos as $movimiento) {
        $cantidadMovidaMostrada += floatval($movimiento["cantidad"]);
    }

    lv_responder(
        "si",
        "Movimientos del lote consultados correctamente",
        [
            "lote" => [
                "idLote" => intval($lote["id"]),
                "idProducto" => intval($lote["idProducto"]),
                "codigoProducto" => $lote["codigoProducto"],
                "producto" => $lote["producto"],
                "lote" => $lote["lote"],
                "fechaFabricacion" => $lote["fechaFabricacion"],
                "fechaVencimiento" => $lote["fechaVencimiento"],
                "fechaIngreso" => $lote["fechaIngreso"],
                "estado" => intval($lote["estado"])
            ],
            "resumen" => [
                "totalMovimientos" => $total,
                "totalMovimientosMostrados" => count($movimientos),
                "cantidadMovida" => $cantidadMovidaTotal,
                "cantidadMovidaMostrada" => lv_numero($cantidadMovidaMostrada),
                "saldoInicial" => $saldoInicial,
                "saldoFinal" => $saldoFinal
            ],
            "movimientos" => $movimientos
        ],
        [
            "total" => $total,
            "pagina" => $pagina,
            "limite" => $limite,
            "totalPaginas" => intval(ceil($total / $limite)),
            "filtros" => [
                "idLote" => $idLote,
                "idBodega" => $idBodega,
                "idUbicacion" => $idUbicacion,
                "tipoMovimiento" => $tipoMovimiento,
                "fechaDesde" => $fechaDesde,
                "fechaHasta" => $fechaHasta
            ]
        ]
    );
} catch (Throwable $e) {
    lv_responder(
        "no",
        "Error consultando los movimientos del lote",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
