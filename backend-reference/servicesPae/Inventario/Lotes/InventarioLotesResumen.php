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
    $idProducto = intval(lv_parametro("idProducto", 0));
    $idTipoProducto = intval(lv_parametro("idTipoProducto", 0));
    $idBodega = intval(lv_parametro("idBodega", 0));
    $idUbicacion = intval(lv_parametro("idUbicacion", 0));
    $estado = lv_parametro("estado", 1);

    $whereLote = "1 = 1";
    $whereExistencia = "1 = 1";

    if ($idProducto > 0) {
        $whereLote .= " AND il.idProducto = $idProducto ";
    }

    if ($idTipoProducto > 0) {
        $whereLote .= " AND pic.idTipoProductoInventario = $idTipoProducto ";
    }

    if ($estado !== "" && in_array((string)$estado, ["0", "1"], true)) {
        $whereLote .= " AND il.estado = " . intval($estado) . " ";
    }

    $filtrosExistenciaLote = [
        "ex.idLote = il.id",
        "ex.idProducto = il.idProducto"
    ];

    if ($idBodega > 0) {
        $whereExistencia .= " AND e.idBodega = $idBodega ";
        $filtrosExistenciaLote[] = "ex.idBodega = $idBodega";
    }

    if ($idUbicacion > 0) {
        $whereExistencia .= " AND e.idUbicacion = $idUbicacion ";
        $filtrosExistenciaLote[] = "ex.idUbicacion = $idUbicacion";
    }

    if ($idBodega > 0 || $idUbicacion > 0) {
        $whereLote .= "
            AND EXISTS (
                SELECT 1
                FROM InventarioExistencias ex
                WHERE " . implode(" AND ", $filtrosExistenciaLote) . "
            )
        ";
    }

    $resumen = lv_obtener_fila("
        SELECT
            COUNT(*) AS totalLotes,
            SUM(CASE WHEN x.estado = 1 THEN 1 ELSE 0 END) AS totalLotesActivos,
            SUM(CASE WHEN x.estado = 0 THEN 1 ELSE 0 END) AS totalLotesInactivos,

            SUM(CASE
                WHEN x.fechaVencimiento IS NOT NULL
                 AND x.fechaVencimiento < CURDATE()
                THEN 1 ELSE 0
            END) AS totalVencidos,

            SUM(CASE
                WHEN x.fechaVencimiento IS NOT NULL
                 AND x.fechaVencimiento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                THEN 1 ELSE 0
            END) AS totalCriticos,

            SUM(CASE
                WHEN x.fechaVencimiento IS NOT NULL
                 AND x.fechaVencimiento BETWEEN DATE_ADD(CURDATE(), INTERVAL 31 DAY)
                                             AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
                THEN 1 ELSE 0
            END) AS totalProximos,

            SUM(CASE
                WHEN x.fechaVencimiento > DATE_ADD(CURDATE(), INTERVAL 60 DAY)
                THEN 1 ELSE 0
            END) AS totalVigentes,

            SUM(CASE
                WHEN x.fechaVencimiento IS NULL
                THEN 1 ELSE 0
            END) AS totalSinVencimiento,

            SUM(CASE
                WHEN x.cantidadTotal <= 0
                THEN 1 ELSE 0
            END) AS totalSinExistencia,

            SUM(CASE
                WHEN x.fechaVencimiento IS NOT NULL
                 AND x.fechaVencimiento < CURDATE()
                THEN x.cantidadDisponible ELSE 0
            END) AS cantidadDisponibleVencida,

            SUM(CASE
                WHEN x.fechaVencimiento IS NOT NULL
                 AND x.fechaVencimiento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
                THEN x.cantidadDisponible ELSE 0
            END) AS cantidadDisponibleCritica,

            SUM(x.cantidadDisponible) AS cantidadDisponible,
            SUM(x.cantidadReservada) AS cantidadReservada,
            SUM(x.cantidadBloqueada) AS cantidadBloqueada,
            SUM(x.cantidadTotal) AS cantidadTotal

        FROM (
            SELECT
                il.id,
                il.estado,
                il.fechaVencimiento,
                SUM(CASE WHEN $whereExistencia THEN COALESCE(e.cantidadDisponible, 0) ELSE 0 END) AS cantidadDisponible,
                SUM(CASE WHEN $whereExistencia THEN COALESCE(e.cantidadReservada, 0) ELSE 0 END) AS cantidadReservada,
                SUM(CASE WHEN $whereExistencia THEN COALESCE(e.cantidadBloqueada, 0) ELSE 0 END) AS cantidadBloqueada,
                SUM(CASE
                    WHEN $whereExistencia
                    THEN COALESCE(e.cantidadDisponible, 0)
                       + COALESCE(e.cantidadReservada, 0)
                       + COALESCE(e.cantidadBloqueada, 0)
                    ELSE 0
                END) AS cantidadTotal
            FROM InventarioLotes il
            LEFT JOIN ProductosInventarioConfig pic
                ON pic.idProducto = il.idProducto
            LEFT JOIN InventarioExistencias e
                ON e.idLote = il.id
               AND e.idProducto = il.idProducto
            WHERE $whereLote
            GROUP BY il.id, il.estado, il.fechaVencimiento
        ) x
    ");

    $data = [
        "totalLotes" => intval($resumen["totalLotes"] ?? 0),
        "totalLotesActivos" => intval($resumen["totalLotesActivos"] ?? 0),
        "totalLotesInactivos" => intval($resumen["totalLotesInactivos"] ?? 0),
        "totalVencidos" => intval($resumen["totalVencidos"] ?? 0),
        "totalCriticos" => intval($resumen["totalCriticos"] ?? 0),
        "totalProximos" => intval($resumen["totalProximos"] ?? 0),
        "totalVigentes" => intval($resumen["totalVigentes"] ?? 0),
        "totalSinVencimiento" => intval($resumen["totalSinVencimiento"] ?? 0),
        "totalSinExistencia" => intval($resumen["totalSinExistencia"] ?? 0),
        "cantidadDisponibleVencida" => lv_numero($resumen["cantidadDisponibleVencida"] ?? 0),
        "cantidadDisponibleCritica" => lv_numero($resumen["cantidadDisponibleCritica"] ?? 0),
        "cantidadDisponible" => lv_numero($resumen["cantidadDisponible"] ?? 0),
        "cantidadReservada" => lv_numero($resumen["cantidadReservada"] ?? 0),
        "cantidadBloqueada" => lv_numero($resumen["cantidadBloqueada"] ?? 0),
        "cantidadTotal" => lv_numero($resumen["cantidadTotal"] ?? 0),
        "diasCritico" => 30,
        "diasProximo" => 60
    ];

    lv_responder(
        "si",
        "Resumen de lotes y vencimientos consultado correctamente",
        $data,
        [
            "filtros" => [
                "idProducto" => $idProducto,
                "idTipoProducto" => $idTipoProducto,
                "idBodega" => $idBodega,
                "idUbicacion" => $idUbicacion,
                "estado" => $estado
            ]
        ]
    );
} catch (Throwable $e) {
    lv_responder(
        "no",
        "Error consultando el resumen de lotes y vencimientos",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
