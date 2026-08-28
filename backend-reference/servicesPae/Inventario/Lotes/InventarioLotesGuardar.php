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

function responder($rpta, $mensaje, $data = [], $extra = [], $codigoHttp = 200)
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

if (!isset($conexion) || !$conexion instanceof mysqli) {
    responder(
        "no",
        "No se encontró la conexión a la base de datos",
        [],
        ["error" => "La variable \$conexion no está disponible"],
        500
    );
}

$conexion->set_charset("utf8mb4");

function limpiarTexto($valor)
{
    return trim((string)($valor ?? ""));
}

function parametro($nombre, $default = "")
{
    if (isset($_GET[$nombre])) {
        return limpiarTexto($_GET[$nombre]);
    }

    if (isset($_POST[$nombre])) {
        return limpiarTexto($_POST[$nombre]);
    }

    return $default;
}

function entradaJson()
{
    $raw = file_get_contents("php://input");
    $json = json_decode($raw, true);

    if (!is_array($json)) {
        return [];
    }

    return $json;
}

function esc($valor)
{
    global $conexion;
    return $conexion->real_escape_string((string)($valor ?? ""));
}

function fechaONull($valor)
{
    $valor = limpiarTexto($valor);

    if ($valor === "") {
        return "NULL";
    }

    return "'" . esc($valor) . "'";
}

function textoONull($valor)
{
    $valor = limpiarTexto($valor);

    if ($valor === "") {
        return "NULL";
    }

    return "'" . esc($valor) . "'";
}

function intONull($valor)
{
    if ($valor === null || $valor === "") {
        return "NULL";
    }

    $valor = intval($valor);

    if ($valor <= 0) {
        return "NULL";
    }

    return (string)$valor;
}

function decimalSeguro($valor)
{
    if ($valor === null || $valor === "") {
        return 0;
    }

    return round(floatval(str_replace(",", ".", (string)$valor)), 3);
}

function obtenerFila($sql)
{
    global $conexion;

    $res = $conexion->query($sql);

    if (!$res) {
        throw new Exception($conexion->error);
    }

    return $res->fetch_assoc() ?: null;
}

function obtenerFilas($sql)
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

try {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        responder("no", "Método no permitido", [], [], 405);
    }

    $input = entradaJson();

    $id = intval($input["idLote"] ?? $input["id"] ?? 0);
    $idProducto = intval($input["idProducto"] ?? 0);
    $lote = limpiarTexto($input["lote"] ?? "");
    $fechaFabricacion = limpiarTexto($input["fechaFabricacion"] ?? "");
    $fechaVencimiento = limpiarTexto($input["fechaVencimiento"] ?? "");
    $fechaIngreso = limpiarTexto($input["fechaIngreso"] ?? date("Y-m-d"));
    $observacion = limpiarTexto($input["observacion"] ?? "");
    $estado = intval($input["estado"] ?? 1);

    if ($idProducto <= 0) {
        responder("no", "Debe seleccionar el producto asociado al lote");
    }

    if ($lote === "") {
        responder("no", "Debe ingresar el número o código del lote");
    }

    if ($estado !== 1) {
        $estado = 0;
    }

    $producto = obtenerFila("
        SELECT
            pc.id,
            pc.codigo,
            pc.descripcion,
            COALESCE(pic.manejaVencimiento, 1) AS manejaVencimiento
        FROM ProductosCatalogo pc
        LEFT JOIN ProductosInventarioConfig pic
            ON pic.idProducto = pc.id
        WHERE pc.id = $idProducto
        LIMIT 1
    ");

    if (!$producto) {
        responder("no", "El producto seleccionado no existe");
    }

    $loteEsc = esc($lote);

    $duplicado = obtenerFila("
        SELECT
            id,
            idProducto,
            lote,
            fechaFabricacion,
            fechaVencimiento,
            fechaIngreso,
            observacion,
            estado
        FROM InventarioLotes
        WHERE idProducto = $idProducto
            AND lote = '$loteEsc'
            " . ($id > 0 ? " AND id <> $id " : "") . "
        LIMIT 1
    ");

    if ($duplicado && $id <= 0) {
        responder(
            "si",
            "El lote ya existía. Se retorna el lote existente para asociarlo a la entrada.",
            [
                "idLote" => intval($duplicado["id"]),
                "id" => intval($duplicado["id"]),
                "idProducto" => intval($duplicado["idProducto"]),
                "lote" => (string)$duplicado["lote"],
                "fechaFabricacion" => $duplicado["fechaFabricacion"],
                "fechaVencimiento" => $duplicado["fechaVencimiento"],
                "fechaIngreso" => $duplicado["fechaIngreso"],
                "observacion" => $duplicado["observacion"],
                "estado" => intval($duplicado["estado"]),
                "estadoTexto" => intval($duplicado["estado"]) === 1 ? "Activo" : "Inactivo",
                "codigoProducto" => $producto["codigo"],
                "nombreProducto" => $producto["descripcion"],
                "existente" => 1
            ]
        );
    }

    if ($duplicado && $id > 0) {
        responder("no", "Ya existe otro lote con ese código para el mismo producto");
    }

    if ($id > 0) {
        $sql = "
            UPDATE InventarioLotes
            SET
                idProducto = $idProducto,
                lote = '$loteEsc',
                fechaFabricacion = " . fechaONull($fechaFabricacion) . ",
                fechaVencimiento = " . fechaONull($fechaVencimiento) . ",
                fechaIngreso = " . fechaONull($fechaIngreso) . ",
                observacion = " . textoONull($observacion) . ",
                estado = $estado,
                updated_at = NOW()
            WHERE id = $id
            LIMIT 1
        ";

        if (!$conexion->query($sql)) {
            throw new Exception($conexion->error);
        }

        $idLote = $id;
        $mensaje = "Lote actualizado correctamente";
    } else {
        $sql = "
            INSERT INTO InventarioLotes
            (
                idProducto,
                lote,
                fechaFabricacion,
                fechaVencimiento,
                fechaIngreso,
                observacion,
                estado,
                created_at,
                updated_at
            )
            VALUES
            (
                $idProducto,
                '$loteEsc',
                " . fechaONull($fechaFabricacion) . ",
                " . fechaONull($fechaVencimiento) . ",
                " . fechaONull($fechaIngreso) . ",
                " . textoONull($observacion) . ",
                $estado,
                NOW(),
                NOW()
            )
        ";

        if (!$conexion->query($sql)) {
            throw new Exception($conexion->error);
        }

        $idLote = intval($conexion->insert_id);
        $mensaje = "Lote creado correctamente";
    }

    $loteGuardado = obtenerFila("
        SELECT
            l.id,
            l.idProducto,
            l.lote,
            l.fechaFabricacion,
            l.fechaVencimiento,
            l.fechaIngreso,
            l.observacion,
            l.estado,
            pc.codigo AS codigoProducto,
            pc.descripcion AS nombreProducto
        FROM InventarioLotes l
        INNER JOIN ProductosCatalogo pc
            ON pc.id = l.idProducto
        WHERE l.id = $idLote
        LIMIT 1
    ");

    responder(
        "si",
        $mensaje,
        [
            "idLote" => intval($loteGuardado["id"]),
            "id" => intval($loteGuardado["id"]),
            "idProducto" => intval($loteGuardado["idProducto"]),
            "lote" => (string)$loteGuardado["lote"],
            "fechaFabricacion" => $loteGuardado["fechaFabricacion"],
            "fechaVencimiento" => $loteGuardado["fechaVencimiento"],
            "fechaIngreso" => $loteGuardado["fechaIngreso"],
            "observacion" => $loteGuardado["observacion"],
            "estado" => intval($loteGuardado["estado"]),
            "estadoTexto" => intval($loteGuardado["estado"]) === 1 ? "Activo" : "Inactivo",
            "codigoProducto" => $loteGuardado["codigoProducto"],
            "nombreProducto" => $loteGuardado["nombreProducto"],
            "existente" => 0
        ]
    );
} catch (Throwable $e) {
    responder(
        "no",
        "Error guardando lote",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
