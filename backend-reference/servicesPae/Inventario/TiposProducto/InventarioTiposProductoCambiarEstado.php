<?php
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");
header("Expires: 0");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit;
}

ini_set("display_errors", 1);
error_reporting(E_ALL);

function jexit($code, $arr) {
  http_response_code($code);
  echo json_encode($arr, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  exit;
}

$DB_HOST = "localhost";
$DB_NAME = "accionpo_pae";
$DB_USER = "accionpo_pae";
$DB_PASS = "o#Ao0?ZEEec0s).i";

$mysqli = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);

if ($mysqli->connect_errno) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Error de conexión a la base de datos.",
    "error" => $mysqli->connect_error
  ]);
}

$mysqli->set_charset("utf8mb4");

$input = json_decode(file_get_contents("php://input"), true);

if (!is_array($input)) {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "No se recibieron datos válidos."
  ]);
}

$id = isset($input["id"]) ? (int)$input["id"] : 0;
$estado = isset($input["estado"]) ? (int)$input["estado"] : -1;

if ($id <= 0) {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El ID es obligatorio."
  ]);
}

if (!in_array($estado, [0, 1], true)) {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El estado no es válido."
  ]);
}

$sql = "
  UPDATE TiposProductoInventario
  SET
    estado = ?,
    updated_at = NOW()
  WHERE id = ?
";

$stmt = $mysqli->prepare($sql);

if (!$stmt) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Error preparando cambio de estado.",
    "error" => $mysqli->error
  ]);
}

$stmt->bind_param("ii", $estado, $id);

if (!$stmt->execute()) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Error cambiando el estado del tipo de producto.",
    "error" => $stmt->error
  ]);
}

$stmt->close();
$mysqli->close();

jexit(200, [
  "rpta" => true,
  "mensaje" => "Estado actualizado correctamente.",
  "data" => [
    "id" => $id,
    "estado" => $estado
  ]
]);