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
    $bodegas = lv_obtener_filas("
        SELECT
            id,
            codigo,
            nombre,
            descripcion,
            estado
        FROM BodegasInventario
        WHERE estado = 1
        ORDER BY nombre ASC
    ");

    $bodegasData = array_map(function ($fila) {
        return [
            "id" => intval($fila["id"]),
            "codigo" => $fila["codigo"],
            "nombre" => $fila["nombre"],
            "descripcion" => $fila["descripcion"],
            "estado" => intval($fila["estado"])
        ];
    }, $bodegas);

    $ubicaciones = lv_obtener_filas("
        SELECT
            u.id,
            u.idBodega,
            u.codigo,
            u.nombre,
            u.descripcion,
            u.estado,
            b.codigo AS codigoBodega,
            b.nombre AS bodega
        FROM UbicacionesInventario u
        INNER JOIN BodegasInventario b
            ON b.id = u.idBodega
        WHERE u.estado = 1
          AND b.estado = 1
        ORDER BY
            b.nombre ASC,
            u.nombre ASC
    ");

    $ubicacionesData = array_map(function ($fila) {
        return [
            "id" => intval($fila["id"]),
            "idBodega" => intval($fila["idBodega"]),
            "codigo" => $fila["codigo"],
            "nombre" => $fila["nombre"],
            "descripcion" => $fila["descripcion"],
            "estado" => intval($fila["estado"]),
            "codigoBodega" => $fila["codigoBodega"],
            "bodega" => $fila["bodega"]
        ];
    }, $ubicaciones);

    $tiposProducto = lv_obtener_filas("
        SELECT
            id,
            codigo,
            nombre,
            descripcion,
            manejaLote,
            manejaVencimiento,
            requiereFechaVencimiento,
            requiereBodegaFria,
            estado
        FROM TiposProductoInventario
        WHERE estado = 1
        ORDER BY nombre ASC
    ");

    $tiposProductoData = array_map(function ($fila) {
        return [
            "id" => intval($fila["id"]),
            "codigo" => $fila["codigo"],
            "nombre" => $fila["nombre"],
            "descripcion" => $fila["descripcion"],
            "manejaLote" => intval($fila["manejaLote"]),
            "manejaVencimiento" => intval($fila["manejaVencimiento"]),
            "requiereFechaVencimiento" => intval($fila["requiereFechaVencimiento"]),
            "requiereBodegaFria" => intval($fila["requiereBodegaFria"]),
            "estado" => intval($fila["estado"])
        ];
    }, $tiposProducto);

    lv_responder(
        "si",
        "Datos para lotes y vencimientos consultados correctamente",
        [
            "bodegas" => $bodegasData,
            "ubicaciones" => $ubicacionesData,
            "tiposProducto" => $tiposProductoData,
            "estadosLote" => [
                ["valor" => 1, "nombre" => "ACTIVO"],
                ["valor" => 0, "nombre" => "INACTIVO"]
            ],
            "clasificaciones" => [
                ["valor" => "", "nombre" => "TODOS"],
                ["valor" => "VENCIDO", "nombre" => "VENCIDOS"],
                ["valor" => "CRITICO", "nombre" => "CRÍTICOS - HASTA 30 DÍAS"],
                ["valor" => "PROXIMO", "nombre" => "PRÓXIMOS - DE 31 A 60 DÍAS"],
                ["valor" => "VIGENTE", "nombre" => "VIGENTES - MÁS DE 60 DÍAS"],
                ["valor" => "SIN_VENCIMIENTO", "nombre" => "SIN FECHA DE VENCIMIENTO"],
                ["valor" => "SIN_EXISTENCIA", "nombre" => "SIN EXISTENCIA"]
            ],
            "configuracionAlertas" => [
                "diasCritico" => 30,
                "diasProximo" => 60
            ]
        ]
    );
} catch (Throwable $e) {
    lv_responder(
        "no",
        "Error consultando los datos para lotes y vencimientos",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
