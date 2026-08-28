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
header("Access-Control-Allow-Headers: Content-Type, Cache-Control, Pragma, Expires");
header("Access-Control-Max-Age: 0");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

require_once __DIR__ . "/../conexion.php";

function responder($rpta, $mensaje, $extra = [], $code = 200) {
    http_response_code($code);

    echo json_encode(array_merge([
        "rpta" => $rpta,
        "mensaje" => $mensaje
    ], $extra), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

    exit;
}

if (!isset($conexion) || !$conexion instanceof mysqli) {
    responder("no", "No se encontró la conexión a la base de datos", [
        "error" => "Variable \$conexion no disponible"
    ], 500);
}

$conexion->set_charset("utf8mb4");

function inputData() {
    $json = json_decode(file_get_contents("php://input"), true);

    if (is_array($json)) {
        return array_merge($_POST, $json);
    }

    return $_POST;
}

function columnasTabla($conexion, $tabla) {
    $cols = [];
    $res = $conexion->query("SHOW COLUMNS FROM `$tabla`");

    if (!$res) {
        responder("no", "No se pudo leer la estructura de la tabla $tabla", [
            "error" => $conexion->error
        ], 500);
    }

    while ($row = $res->fetch_assoc()) {
        $cols[$row["Field"]] = $row;
    }

    return $cols;
}

function tieneColumna($cols, $nombre) {
    return array_key_exists($nombre, $cols);
}

function tipoColumna($cols, $nombre) {
    return isset($cols[$nombre]["Type"]) ? strtolower($cols[$nombre]["Type"]) : "";
}

function columnaEsNumerica($cols, $nombre) {
    $tipo = tipoColumna($cols, $nombre);

    return strpos($tipo, "int") !== false ||
           strpos($tipo, "decimal") !== false ||
           strpos($tipo, "double") !== false ||
           strpos($tipo, "float") !== false;
}

function estadoEsActivo($valor) {
    $v = strtolower(trim((string)$valor));

    return $v === "1" ||
           $v === "activo" ||
           $v === "activa" ||
           $v === "true" ||
           $v === "si" ||
           $v === "sí";
}

function normalizarEstadoTexto($valor) {
    return estadoEsActivo($valor) ? "Activo" : "Inactivo";
}

function normalizarEstadoNumero($valor) {
    return estadoEsActivo($valor) ? 1 : 0;
}

$tabla = "TiposDocumentoInventario";

/* ============================================================
   VALIDAR TABLA
============================================================ */

$resTabla = $conexion->query("SHOW TABLES LIKE '$tabla'");

if (!$resTabla || $resTabla->num_rows === 0) {
    responder("no", "La tabla $tabla no existe en la base de datos", [
        "error" => $conexion->error
    ], 500);
}

$cols = columnasTabla($conexion, $tabla);
$data = inputData();

/* ============================================================
   CAMPO ID
============================================================ */

$campoId = "";

if (tieneColumna($cols, "idTipoDocumento")) {
    $campoId = "idTipoDocumento";
} elseif (tieneColumna($cols, "id")) {
    $campoId = "id";
}

if ($campoId === "") {
    responder("no", "La tabla $tabla no tiene columna idTipoDocumento ni id", [], 500);
}

/* ============================================================
   CAMPO ESTADO
============================================================ */

$campoEstado = "";

if (tieneColumna($cols, "estado")) {
    $campoEstado = "estado";
} elseif (tieneColumna($cols, "idEstado")) {
    $campoEstado = "idEstado";
}

if ($campoEstado === "") {
    responder("no", "La tabla no tiene columna estado ni idEstado", [], 500);
}

/* ============================================================
   DATOS RECIBIDOS
============================================================ */

$id = 0;

if (isset($data["idTipoDocumento"])) {
    $id = intval($data["idTipoDocumento"]);
} elseif (isset($data["id"])) {
    $id = intval($data["id"]);
}

$estadoNuevo = isset($data["estado"]) ? trim((string)$data["estado"]) : "";

if ($id <= 0) {
    responder("no", "No se recibió el id del tipo de documento", [], 400);
}

/* ============================================================
   CONSULTAR ESTADO ACTUAL SIN get_result()
============================================================ */

$sqlGet = "SELECT `$campoEstado` FROM `$tabla` WHERE `$campoId` = ? LIMIT 1";

$stmtGet = $conexion->prepare($sqlGet);

if (!$stmtGet) {
    responder("no", "Error preparando consulta de estado", [
        "error" => $conexion->error,
        "sql" => $sqlGet
    ], 500);
}

$stmtGet->bind_param("i", $id);

if (!$stmtGet->execute()) {
    responder("no", "Error ejecutando consulta de estado", [
        "error" => $stmtGet->error
    ], 500);
}

$estadoActual = null;
$stmtGet->bind_result($estadoActual);

if (!$stmtGet->fetch()) {
    $stmtGet->close();

    responder("no", "No se encontró el tipo de documento", [
        "id" => $id,
        "idTipoDocumento" => $id
    ], 404);
}

$stmtGet->close();

/* ============================================================
   DEFINIR NUEVO ESTADO
============================================================ */

if ($estadoNuevo === "") {
    $estadoNuevo = estadoEsActivo($estadoActual) ? "Inactivo" : "Activo";
}

if ($campoEstado === "idEstado") {
    $valorGuardar = estadoEsActivo($estadoNuevo) ? 1 : 2;
    $tipoBind = "ii";
    $estadoTextoRespuesta = $valorGuardar === 1 ? "Activo" : "Inactivo";
    $estadoNumeroRespuesta = $valorGuardar === 1 ? 1 : 0;
} else {
    if (columnaEsNumerica($cols, "estado")) {
        $valorGuardar = normalizarEstadoNumero($estadoNuevo);
        $tipoBind = "ii";
        $estadoTextoRespuesta = $valorGuardar === 1 ? "Activo" : "Inactivo";
        $estadoNumeroRespuesta = $valorGuardar;
    } else {
        $valorGuardar = normalizarEstadoTexto($estadoNuevo);
        $tipoBind = "si";
        $estadoTextoRespuesta = $valorGuardar;
        $estadoNumeroRespuesta = $valorGuardar === "Activo" ? 1 : 0;
    }
}

/* ============================================================
   ACTUALIZAR
============================================================ */

$sql = "UPDATE `$tabla` SET `$campoEstado` = ?";

if (tieneColumna($cols, "updated_at")) {
    $sql .= ", `updated_at` = NOW()";
}

if (tieneColumna($cols, "fechaActualizacion")) {
    $sql .= ", `fechaActualizacion` = NOW()";
}

$sql .= " WHERE `$campoId` = ?";

$stmt = $conexion->prepare($sql);

if (!$stmt) {
    responder("no", "Error preparando actualización de estado", [
        "error" => $conexion->error,
        "sql" => $sql
    ], 500);
}

$stmt->bind_param($tipoBind, $valorGuardar, $id);

if (!$stmt->execute()) {
    responder("no", "Error cambiando el estado", [
        "error" => $stmt->error,
        "sql" => $sql
    ], 500);
}

$stmt->close();

responder("si", "Estado actualizado correctamente", [
    "id" => $id,
    "idTipoDocumento" => $id,
    "estado" => $estadoNumeroRespuesta,
    "estadoTexto" => $estadoTextoRespuesta
]);
?>