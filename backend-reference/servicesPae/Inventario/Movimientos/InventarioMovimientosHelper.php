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

function km_responder($rpta, $mensaje, $data = [], $extra = [], $codigoHttp = 200)
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

function km_limpiar_texto($valor)
{
    return trim((string)($valor ?? ""));
}

function km_parametro($nombre, $default = "")
{
    if (isset($_GET[$nombre])) {
        return km_limpiar_texto($_GET[$nombre]);
    }

    if (isset($_POST[$nombre])) {
        return km_limpiar_texto($_POST[$nombre]);
    }

    return $default;
}

function km_entrada_json()
{
    $raw = file_get_contents("php://input");
    $json = json_decode($raw, true);

    return is_array($json) ? $json : [];
}

function km_esc($valor)
{
    global $conexion;
    return $conexion->real_escape_string((string)($valor ?? ""));
}

function km_obtener_fila($sql)
{
    global $conexion;

    $res = $conexion->query($sql);

    if (!$res) {
        throw new Exception($conexion->error);
    }

    return $res->fetch_assoc() ?: null;
}

function km_obtener_filas($sql)
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

function km_numero($valor)
{
    return round(floatval($valor ?? 0), 3);
}

function km_bool($valor)
{
    $valor = strtoupper(km_limpiar_texto($valor));

    return in_array($valor, ["1", "SI", "S", "TRUE", "T", "YES", "Y"], true);
}

function km_fecha_sql($fecha, $finDia = false)
{
    $fecha = km_limpiar_texto($fecha);

    if ($fecha === "") {
        return "";
    }

    $fecha = substr($fecha, 0, 10);

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
        return "";
    }

    return $fecha . ($finDia ? " 23:59:59" : " 00:00:00");
}

function km_normalizar_texto($valor)
{
    $valor = strtoupper(trim((string)$valor));

    $reemplazos = [
        "Á" => "A",
        "É" => "E",
        "Í" => "I",
        "Ó" => "O",
        "Ú" => "U",
        "Ü" => "U",
        "Ñ" => "N",
    ];

    return strtr($valor, $reemplazos);
}

function km_sentido_movimiento($tipoMovimiento)
{
    $tipo = km_normalizar_texto($tipoMovimiento);

    if ($tipo === "") {
        return "NEUTRO";
    }

    if (strpos($tipo, "LIBER") !== false && strpos($tipo, "RESERV") !== false) {
        return "LIBERACION_RESERVA";
    }

    if (strpos($tipo, "RESERV") !== false) {
        return "RESERVA";
    }

    if (strpos($tipo, "BLOQUE") !== false) {
        return "BLOQUEO";
    }

    if (
        strpos($tipo, "SALIDA") !== false ||
        strpos($tipo, "EGRESO") !== false ||
        strpos($tipo, "DESCUENTO") !== false ||
        strpos($tipo, "AJUSTE_NEGATIVO") !== false ||
        strpos($tipo, "TRASLADO_SALIDA") !== false
    ) {
        return "SALIDA";
    }

    if (
        strpos($tipo, "ENTRADA") !== false ||
        strpos($tipo, "INGRESO") !== false ||
        strpos($tipo, "AJUSTE_POSITIVO") !== false ||
        strpos($tipo, "TRASLADO_ENTRADA") !== false ||
        strpos($tipo, "INVENTARIO_INICIAL") !== false
    ) {
        return "ENTRADA";
    }

    if (strpos($tipo, "TRASLADO") !== false) {
        return "TRASLADO";
    }

    if (strpos($tipo, "AJUSTE") !== false) {
        return "AJUSTE";
    }

    return "NEUTRO";
}

function km_signo_movimiento($tipoMovimiento)
{
    $sentido = km_sentido_movimiento($tipoMovimiento);

    if (in_array($sentido, ["ENTRADA", "LIBERACION_RESERVA"], true)) {
        return 1;
    }

    if (in_array($sentido, ["SALIDA", "RESERVA", "BLOQUEO"], true)) {
        return -1;
    }

    return 0;
}

function km_select_movimientos_sql()
{
    return "
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

            pic.idTipoProductoInventario AS idTipoProducto,
            pic.manejaLote,
            pic.manejaVencimiento,
            pic.stockMinimo,
            pic.stockMaximo,
            pic.unidadBaseInventario,

            tpi.nombre AS tipoProducto,

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
            d.idDespachoInforme,
            d.idBodegaOrigen,
            d.idUbicacionOrigen,
            d.idBodegaDestino,
            d.idUbicacionDestino,
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
    ";
}

function km_base_movimientos_sql()
{
    return "
        FROM InventarioMovimientos m
        INNER JOIN ProductosCatalogo pc
            ON pc.id = m.idProducto
        LEFT JOIN ProductosInventarioConfig pic
            ON pic.idProducto = pc.id
        LEFT JOIN TiposProductoInventario tpi
            ON tpi.id = pic.idTipoProductoInventario
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
    ";
}

function km_formatear_movimiento($fila)
{
    $sentido = km_sentido_movimiento($fila["tipoMovimiento"] ?? "");
    $signo = km_signo_movimiento($fila["tipoMovimiento"] ?? "");

    return [
        "id" => intval($fila["id"]),
        "idMovimiento" => intval($fila["id"]),
        "idDocumento" => $fila["idDocumento"] !== null ? intval($fila["idDocumento"]) : null,
        "idDocumentoDetalle" => $fila["idDocumentoDetalle"] !== null ? intval($fila["idDocumentoDetalle"]) : null,

        "idProducto" => intval($fila["idProducto"]),
        "codigoProducto" => $fila["codigoProducto"] ?? null,
        "producto" => $fila["producto"] ?? null,
        "descripcion" => $fila["producto"] ?? null,
        "idTipoProducto" => $fila["idTipoProducto"] !== null ? intval($fila["idTipoProducto"]) : null,
        "tipoProducto" => $fila["tipoProducto"] ?? null,
        "manejaLote" => intval($fila["manejaLote"] ?? 0),
        "manejaVencimiento" => intval($fila["manejaVencimiento"] ?? 0),
        "stockMinimo" => km_numero($fila["stockMinimo"] ?? 0),
        "stockMaximo" => $fila["stockMaximo"] !== null ? km_numero($fila["stockMaximo"]) : null,
        "unidad" => $fila["unidadBaseInventario"] ?: "UND",

        "idLote" => $fila["idLote"] !== null ? intval($fila["idLote"]) : null,
        "lote" => $fila["lote"] ?? null,
        "fechaFabricacion" => $fila["fechaFabricacion"] ?? null,
        "fechaVencimiento" => $fila["fechaVencimiento"] ?? null,
        "fechaIngreso" => $fila["fechaIngreso"] ?? null,
        "estadoLote" => $fila["estadoLote"] !== null ? intval($fila["estadoLote"]) : null,

        "idBodega" => intval($fila["idBodega"]),
        "codigoBodega" => $fila["codigoBodega"] ?? null,
        "bodega" => $fila["bodega"] ?? null,

        "idUbicacion" => $fila["idUbicacion"] !== null ? intval($fila["idUbicacion"]) : null,
        "codigoUbicacion" => $fila["codigoUbicacion"] ?? null,
        "ubicacion" => $fila["ubicacion"] ?? null,

        "tipoMovimiento" => $fila["tipoMovimiento"] ?? null,
        "sentidoMovimiento" => $sentido,
        "signoMovimiento" => $signo,
        "cantidad" => km_numero($fila["cantidad"] ?? 0),
        "cantidadFirmada" => km_numero(($signo ?: 1) * floatval($fila["cantidad"] ?? 0)),
        "saldoAnterior" => km_numero($fila["saldoAnterior"] ?? 0),
        "saldoNuevo" => km_numero($fila["saldoNuevo"] ?? 0),

        "idUsuario" => $fila["idUsuario"] !== null ? intval($fila["idUsuario"]) : null,
        "usuario" => $fila["usuario"] ?? null,
        "idUsuarioRegistro" => $fila["idUsuarioRegistro"] !== null ? intval($fila["idUsuarioRegistro"]) : null,
        "usuarioRegistro" => $fila["usuarioRegistro"] ?? null,

        "idOperador" => $fila["idOperador"] !== null ? intval($fila["idOperador"]) : null,
        "codigoOperador" => $fila["codigoOperador"] ?? null,
        "operador" => $fila["operador"] ?? null,

        "fechaMovimiento" => $fila["fechaMovimiento"] ?? null,
        "observacion" => $fila["observacion"] ?? null,

        "consecutivo" => $fila["consecutivo"] ?? null,
        "fechaDocumento" => $fila["fechaDocumento"] ?? null,
        "estadoProceso" => $fila["estadoProceso"] ?? null,
        "tipoOrigen" => $fila["tipoOrigen"] ?? null,
        "idDespachoInforme" => $fila["idDespachoInforme"] !== null ? intval($fila["idDespachoInforme"]) : null,
        "idBodegaOrigen" => $fila["idBodegaOrigen"] !== null ? intval($fila["idBodegaOrigen"]) : null,
        "idUbicacionOrigen" => $fila["idUbicacionOrigen"] !== null ? intval($fila["idUbicacionOrigen"]) : null,
        "idBodegaDestino" => $fila["idBodegaDestino"] !== null ? intval($fila["idBodegaDestino"]) : null,
        "idUbicacionDestino" => $fila["idUbicacionDestino"] !== null ? intval($fila["idUbicacionDestino"]) : null,
        "fechaFinalizacion" => $fila["fechaFinalizacion"] ?? null,

        "idTipoDocumento" => $fila["idTipoDocumento"] !== null ? intval($fila["idTipoDocumento"]) : null,
        "codigoTipoDocumento" => $fila["codigoTipoDocumento"] ?? null,
        "tipoDocumento" => $fila["tipoDocumento"] ?? null,
        "naturaleza" => $fila["naturaleza"] ?? null,
        "tipoMovimientoDocumento" => $fila["tipoMovimientoDocumento"] ?? null
    ];
}

function km_where_movimientos_desde_parametros()
{
    $q = km_limpiar_texto(km_parametro("q", km_parametro("busqueda", "")));
    $idProducto = intval(km_parametro("idProducto", 0));
    $idBodega = intval(km_parametro("idBodega", 0));
    $idUbicacion = intval(km_parametro("idUbicacion", 0));
    $idLote = intval(km_parametro("idLote", 0));
    $idTipoProducto = intval(km_parametro("idTipoProducto", 0));
    $idDocumento = intval(km_parametro("idDocumento", 0));
    $idTipoDocumento = intval(km_parametro("idTipoDocumento", 0));
    $idOperador = intval(km_parametro("idOperador", 0));
    $idUsuario = intval(km_parametro("idUsuario", 0));
    $tipoMovimiento = strtoupper(km_limpiar_texto(km_parametro("tipoMovimiento", "")));
    $naturaleza = strtoupper(km_limpiar_texto(km_parametro("naturaleza", "")));
    $estadoProceso = strtoupper(km_limpiar_texto(km_parametro("estadoProceso", "")));
    $fechaDesde = km_fecha_sql(km_parametro("fechaDesde", ""), false);
    $fechaHasta = km_fecha_sql(km_parametro("fechaHasta", ""), true);

    $where = "1 = 1";

    if ($q !== "") {
        $qEsc = km_esc($q);
        $like = "%" . $qEsc . "%";

        $where .= "
            AND (
                pc.codigo LIKE '$like'
                OR pc.descripcion LIKE '$like'
                OR il.lote LIKE '$like'
                OR b.codigo LIKE '$like'
                OR b.nombre LIKE '$like'
                OR u.codigo LIKE '$like'
                OR u.nombre LIKE '$like'
                OR d.consecutivo LIKE '$like'
                OR td.codigo LIKE '$like'
                OR td.nombre LIKE '$like'
                OR m.tipoMovimiento LIKE '$like'
                OR io.nombreCompleto LIKE '$like'
                OR io.codigo LIKE '$like'
            )
        ";
    }

    if ($idProducto > 0) {
        $where .= " AND m.idProducto = $idProducto ";
    }

    if ($idBodega > 0) {
        $where .= " AND m.idBodega = $idBodega ";
    }

    if ($idUbicacion > 0) {
        $where .= " AND m.idUbicacion = $idUbicacion ";
    }

    if ($idLote > 0) {
        $where .= " AND m.idLote = $idLote ";
    }

    if ($idTipoProducto > 0) {
        $where .= " AND pic.idTipoProductoInventario = $idTipoProducto ";
    }

    if ($idDocumento > 0) {
        $where .= " AND m.idDocumento = $idDocumento ";
    }

    if ($idTipoDocumento > 0) {
        $where .= " AND d.idTipoDocumento = $idTipoDocumento ";
    }

    if ($idOperador > 0) {
        $where .= " AND m.idOperador = $idOperador ";
    }

    if ($idUsuario > 0) {
        $where .= " AND (m.idUsuario = $idUsuario OR m.idUsuarioRegistro = $idUsuario) ";
    }

    if ($tipoMovimiento !== "") {
        $tipoEsc = km_esc($tipoMovimiento);
        $where .= " AND UPPER(m.tipoMovimiento) = '$tipoEsc' ";
    }

    if ($naturaleza !== "") {
        $naturalezaEsc = km_esc($naturaleza);
        $where .= " AND UPPER(td.naturaleza) = '$naturalezaEsc' ";
    }

    if ($estadoProceso !== "") {
        $estadoEsc = km_esc($estadoProceso);
        $where .= " AND UPPER(d.estadoProceso) = '$estadoEsc' ";
    }

    if ($fechaDesde !== "") {
        $fechaDesdeEsc = km_esc($fechaDesde);
        $where .= " AND m.fechaMovimiento >= '$fechaDesdeEsc' ";
    }

    if ($fechaHasta !== "") {
        $fechaHastaEsc = km_esc($fechaHasta);
        $where .= " AND m.fechaMovimiento <= '$fechaHastaEsc' ";
    }

    return [
        "where" => $where,
        "filtros" => [
            "q" => $q,
            "idProducto" => $idProducto,
            "idBodega" => $idBodega,
            "idUbicacion" => $idUbicacion,
            "idLote" => $idLote,
            "idTipoProducto" => $idTipoProducto,
            "idDocumento" => $idDocumento,
            "idTipoDocumento" => $idTipoDocumento,
            "idOperador" => $idOperador,
            "idUsuario" => $idUsuario,
            "tipoMovimiento" => $tipoMovimiento,
            "naturaleza" => $naturaleza,
            "estadoProceso" => $estadoProceso,
            "fechaDesde" => km_parametro("fechaDesde", ""),
            "fechaHasta" => km_parametro("fechaHasta", "")
        ]
    ];
}

function km_resumen_desde_movimientos($data)
{
    $resumen = [
        "totalMovimientos" => count($data),
        "totalEntradas" => 0,
        "totalSalidas" => 0,
        "totalReservas" => 0,
        "totalLiberacionesReserva" => 0,
        "totalBloqueos" => 0,
        "totalOtros" => 0,

        "cantidadEntradas" => 0,
        "cantidadSalidas" => 0,
        "cantidadReservada" => 0,
        "cantidadLiberadaReserva" => 0,
        "cantidadBloqueada" => 0,
        "cantidadOtros" => 0,

        "productos" => [],
        "bodegas" => [],
        "lotes" => []
    ];

    foreach ($data as $movimiento) {
        $sentido = $movimiento["sentidoMovimiento"];
        $cantidad = floatval($movimiento["cantidad"] ?? 0);

        if ($movimiento["idProducto"]) {
            $resumen["productos"][$movimiento["idProducto"]] = true;
        }

        if ($movimiento["idBodega"]) {
            $resumen["bodegas"][$movimiento["idBodega"]] = true;
        }

        if ($movimiento["idLote"]) {
            $resumen["lotes"][$movimiento["idLote"]] = true;
        }

        if ($sentido === "ENTRADA") {
            $resumen["totalEntradas"]++;
            $resumen["cantidadEntradas"] += $cantidad;
        } elseif ($sentido === "SALIDA") {
            $resumen["totalSalidas"]++;
            $resumen["cantidadSalidas"] += $cantidad;
        } elseif ($sentido === "RESERVA") {
            $resumen["totalReservas"]++;
            $resumen["cantidadReservada"] += $cantidad;
        } elseif ($sentido === "LIBERACION_RESERVA") {
            $resumen["totalLiberacionesReserva"]++;
            $resumen["cantidadLiberadaReserva"] += $cantidad;
        } elseif ($sentido === "BLOQUEO") {
            $resumen["totalBloqueos"]++;
            $resumen["cantidadBloqueada"] += $cantidad;
        } else {
            $resumen["totalOtros"]++;
            $resumen["cantidadOtros"] += $cantidad;
        }
    }

    $resumen["totalProductos"] = count($resumen["productos"]);
    $resumen["totalBodegas"] = count($resumen["bodegas"]);
    $resumen["totalLotes"] = count($resumen["lotes"]);

    unset($resumen["productos"], $resumen["bodegas"], $resumen["lotes"]);

    foreach ([
        "cantidadEntradas",
        "cantidadSalidas",
        "cantidadReservada",
        "cantidadLiberadaReserva",
        "cantidadBloqueada",
        "cantidadOtros"
    ] as $campo) {
        $resumen[$campo] = km_numero($resumen[$campo]);
    }

    return $resumen;
}
?>
