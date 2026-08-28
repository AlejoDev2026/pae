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

function ex_responder($rpta, $mensaje, $data = [], $extra = [], $codigoHttp = 200)
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

function ex_limpiar_texto($valor)
{
    return trim((string)($valor ?? ""));
}

function ex_parametro($nombre, $default = "")
{
    if (isset($_GET[$nombre])) {
        return ex_limpiar_texto($_GET[$nombre]);
    }

    if (isset($_POST[$nombre])) {
        return ex_limpiar_texto($_POST[$nombre]);
    }

    return $default;
}

function ex_entrada_json()
{
    $raw = file_get_contents("php://input");
    $json = json_decode($raw, true);

    return is_array($json) ? $json : [];
}

function ex_esc($valor)
{
    global $conexion;
    return $conexion->real_escape_string((string)($valor ?? ""));
}

function ex_obtener_fila($sql)
{
    global $conexion;

    $res = $conexion->query($sql);

    if (!$res) {
        throw new Exception($conexion->error);
    }

    return $res->fetch_assoc() ?: null;
}

function ex_obtener_filas($sql)
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

function ex_obtener_valor($sql, $default = 0)
{
    global $conexion;

    $res = $conexion->query($sql);

    if (!$res) {
        throw new Exception($conexion->error);
    }

    $fila = $res->fetch_row();

    return $fila ? $fila[0] : $default;
}

function ex_numero($valor)
{
    return round(floatval($valor ?? 0), 3);
}

function ex_bool($valor)
{
    $valor = strtoupper(ex_limpiar_texto($valor));

    return in_array($valor, ["1", "SI", "S", "TRUE", "T", "YES", "Y"], true);
}

function ex_fecha_vencimiento_info($fechaVencimiento)
{
    $fechaVencimiento = ex_limpiar_texto($fechaVencimiento);

    if ($fechaVencimiento === "" || $fechaVencimiento === "0000-00-00") {
        return [
            "fechaVencimiento" => null,
            "diasVencimiento" => null,
            "vencido" => false,
            "estadoVencimiento" => "SIN_FECHA",
            "estadoVencimientoTexto" => "Sin fecha",
            "alertaVencimiento" => "SIN_FECHA"
        ];
    }

    $fecha = substr($fechaVencimiento, 0, 10);
    $hoy = new DateTime(date("Y-m-d"));
    $vence = new DateTime($fecha);
    $diff = intval($hoy->diff($vence)->format("%r%a"));

    if ($diff < 0) {
        return [
            "fechaVencimiento" => $fecha,
            "diasVencimiento" => $diff,
            "vencido" => true,
            "estadoVencimiento" => "VENCIDO",
            "estadoVencimientoTexto" => "Vencido",
            "alertaVencimiento" => "VENCIDO"
        ];
    }

    if ($diff <= 30) {
        return [
            "fechaVencimiento" => $fecha,
            "diasVencimiento" => $diff,
            "vencido" => false,
            "estadoVencimiento" => "POR_VENCER",
            "estadoVencimientoTexto" => "Por vencer",
            "alertaVencimiento" => "POR_VENCER"
        ];
    }

    return [
        "fechaVencimiento" => $fecha,
        "diasVencimiento" => $diff,
        "vencido" => false,
        "estadoVencimiento" => "VIGENTE",
        "estadoVencimientoTexto" => "Vigente",
        "alertaVencimiento" => "VIGENTE"
    ];
}


function ex_estado_stock_info($disponible, $stockMinimo)
{
    $disponible = ex_numero($disponible);
    $stockMinimo = ex_numero($stockMinimo);
    $diferencia = ex_numero($disponible - $stockMinimo);

    if ($stockMinimo <= 0) {
        return [
            "stockMinimo" => $stockMinimo,
            "diferenciaStockMinimo" => null,
            "estadoStock" => "SIN_CONFIGURAR",
            "estadoStockTexto" => "Sin mínimo",
            "alertaStock" => false
        ];
    }

    if ($disponible <= 0) {
        return [
            "stockMinimo" => $stockMinimo,
            "diferenciaStockMinimo" => $diferencia,
            "estadoStock" => "SIN_STOCK",
            "estadoStockTexto" => "Sin stock",
            "alertaStock" => true
        ];
    }

    if ($disponible <= ($stockMinimo * 0.5)) {
        return [
            "stockMinimo" => $stockMinimo,
            "diferenciaStockMinimo" => $diferencia,
            "estadoStock" => "CRITICO",
            "estadoStockTexto" => "Crítico",
            "alertaStock" => true
        ];
    }

    if ($disponible < $stockMinimo) {
        return [
            "stockMinimo" => $stockMinimo,
            "diferenciaStockMinimo" => $diferencia,
            "estadoStock" => "BAJO",
            "estadoStockTexto" => "Bajo mínimo",
            "alertaStock" => true
        ];
    }

    return [
        "stockMinimo" => $stockMinimo,
        "diferenciaStockMinimo" => $diferencia,
        "estadoStock" => "OK",
        "estadoStockTexto" => "OK",
        "alertaStock" => false
    ];
}

function ex_formatear_existencia($fila)
{
    $disponible = ex_numero($fila["cantidadDisponible"] ?? 0);
    $reservada = ex_numero($fila["cantidadReservada"] ?? 0);
    $bloqueada = ex_numero($fila["cantidadBloqueada"] ?? 0);
    $total = ex_numero($disponible + $reservada + $bloqueada);

    $vencimiento = ex_fecha_vencimiento_info($fila["fechaVencimiento"] ?? null);
    $stock = ex_estado_stock_info($disponible, $fila["stockMinimo"] ?? 0);

    $estadoExistencia = "SIN_STOCK";
    $estadoExistenciaTexto = "Sin stock";

    if ($disponible > 0) {
        $estadoExistencia = "DISPONIBLE";
        $estadoExistenciaTexto = "Disponible";
    } elseif ($reservada > 0) {
        $estadoExistencia = "RESERVADA";
        $estadoExistenciaTexto = "Reservada";
    } elseif ($bloqueada > 0) {
        $estadoExistencia = "BLOQUEADA";
        $estadoExistenciaTexto = "Bloqueada";
    }

    return [
        "id" => intval($fila["id"]),
        "idExistencia" => intval($fila["id"]),
        "idProducto" => intval($fila["idProducto"]),
        "codigoProducto" => $fila["codigoProducto"] ?? null,
        "producto" => $fila["producto"] ?? null,
        "descripcion" => $fila["producto"] ?? null,
        "idTipoProducto" => isset($fila["idTipoProducto"]) && $fila["idTipoProducto"] !== null ? intval($fila["idTipoProducto"]) : null,
        "tipoProducto" => $fila["tipoProducto"] ?? null,
        "manejaLote" => intval($fila["manejaLote"] ?? 0),
        "manejaVencimiento" => intval($fila["manejaVencimiento"] ?? 0),
        "unidad" => ($fila["unidadBaseInventario"] ?? "") ?: "UND",
        "stockMinimo" => $stock["stockMinimo"],
        "stockMaximo" => isset($fila["stockMaximo"]) && $fila["stockMaximo"] !== null ? ex_numero($fila["stockMaximo"]) : null,
        "diferenciaStockMinimo" => $stock["diferenciaStockMinimo"],
        "estadoStock" => $stock["estadoStock"],
        "estadoStockTexto" => $stock["estadoStockTexto"],
        "alertaStock" => $stock["alertaStock"],

        "idLote" => isset($fila["idLote"]) && $fila["idLote"] !== null ? intval($fila["idLote"]) : null,
        "lote" => $fila["lote"] ?? null,
        "fechaFabricacion" => $fila["fechaFabricacion"] ?? null,
        "fechaIngreso" => $fila["fechaIngreso"] ?? null,
        "fechaVencimiento" => $vencimiento["fechaVencimiento"],
        "diasVencimiento" => $vencimiento["diasVencimiento"],
        "vencido" => $vencimiento["vencido"],
        "estadoVencimiento" => $vencimiento["estadoVencimiento"],
        "estadoVencimientoTexto" => $vencimiento["estadoVencimientoTexto"],
        "alertaVencimiento" => $vencimiento["alertaVencimiento"],
        "estadoLote" => isset($fila["estadoLote"]) && $fila["estadoLote"] !== null ? intval($fila["estadoLote"]) : null,

        "idBodega" => intval($fila["idBodega"]),
        "codigoBodega" => $fila["codigoBodega"] ?? null,
        "bodega" => $fila["bodega"] ?? null,

        "idUbicacion" => isset($fila["idUbicacion"]) && $fila["idUbicacion"] !== null ? intval($fila["idUbicacion"]) : null,
        "codigoUbicacion" => $fila["codigoUbicacion"] ?? null,
        "ubicacion" => $fila["ubicacion"] ?? null,

        "cantidadDisponible" => $disponible,
        "cantidadReservada" => $reservada,
        "cantidadBloqueada" => $bloqueada,
        "cantidadTotal" => $total,

        "estadoExistencia" => $estadoExistencia,
        "estadoExistenciaTexto" => $estadoExistenciaTexto,

        "ultimoMovimiento" => $fila["ultimoMovimiento"] ?? null,
        "created_at" => $fila["created_at"] ?? null,
        "updated_at" => $fila["updated_at"] ?? null
    ];
}

function ex_base_existencias_sql()
{
    return "
        FROM InventarioExistencias e
        INNER JOIN ProductosCatalogo pc
            ON pc.id = e.idProducto
        LEFT JOIN ProductosInventarioConfig pic
            ON pic.idProducto = pc.id
        LEFT JOIN TiposProductoInventario tpi
            ON tpi.id = pic.idTipoProductoInventario
        LEFT JOIN InventarioLotes il
            ON il.id = e.idLote
        INNER JOIN BodegasInventario b
            ON b.id = e.idBodega
        LEFT JOIN UbicacionesInventario u
            ON u.id = e.idUbicacion
        LEFT JOIN (
            SELECT
                idProducto,
                idLote,
                idBodega,
                idUbicacion,
                MAX(fechaMovimiento) AS ultimoMovimiento
            FROM InventarioMovimientos
            GROUP BY
                idProducto,
                idLote,
                idBodega,
                idUbicacion
        ) um
            ON um.idProducto = e.idProducto
            AND (
                (um.idLote = e.idLote)
                OR (um.idLote IS NULL AND e.idLote IS NULL)
            )
            AND um.idBodega = e.idBodega
            AND (
                (um.idUbicacion = e.idUbicacion)
                OR (um.idUbicacion IS NULL AND e.idUbicacion IS NULL)
            )
    ";
}

function ex_select_existencias_sql()
{
    return "
        SELECT
            e.id,
            e.idProducto,
            e.idLote,
            e.idBodega,
            e.idUbicacion,
            e.cantidadDisponible,
            e.cantidadReservada,
            e.cantidadBloqueada,
            NULL AS created_at,
            e.updated_at,

            pc.codigo AS codigoProducto,
            pc.descripcion AS producto,

            pic.idTipoProductoInventario AS idTipoProducto,
            pic.manejaLote,
            pic.manejaVencimiento,
            pic.unidadBaseInventario,
            pic.stockMinimo,
            pic.stockMaximo,

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

            um.ultimoMovimiento
    ";
}
?>
