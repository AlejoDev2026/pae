<?php
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");
header("Expires: 0");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: POST, OPTIONS");

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

function input_json() {
  $raw = file_get_contents("php://input");
  $json = json_decode($raw, true);
  return is_array($json) ? $json : [];
}

function val($data, $key, $default = "") {
  if (isset($_POST[$key])) return trim((string)$_POST[$key]);
  if (isset($data[$key])) return trim((string)$data[$key]);
  return $default;
}

function stmt_fetch_all_assoc($stmt) {
  $meta = $stmt->result_metadata();
  if (!$meta) return [];

  $fields = [];
  $row = [];
  $bind = [];

  while ($field = $meta->fetch_field()) {
    $fields[] = $field->name;
    $row[$field->name] = null;
    $bind[] = &$row[$field->name];
  }

  call_user_func_array([$stmt, "bind_result"], $bind);

  $data = [];

  while ($stmt->fetch()) {
    $item = [];
    foreach ($fields as $fieldName) {
      $item[$fieldName] = $row[$fieldName];
    }
    $data[] = $item;
  }

  return $data;
}

function stmt_fetch_one_assoc($stmt) {
  $rows = stmt_fetch_all_assoc($stmt);
  return count($rows) > 0 ? $rows[0] : null;
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

$data = input_json();

$id = (int)val($data, "id", 0);
$estado = (int)val($data, "estado", -1);

if ($id <= 0) {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El id de la bodega es obligatorio."
  ]);
}

if ($estado !== 0 && $estado !== 1) {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El estado debe ser 1 para activo o 0 para inactivo."
  ]);
}

$sqlExiste = "
  SELECT id
  FROM BodegasInventario
  WHERE id = ?
  LIMIT 1
";

$stmtExiste = $mysqli->prepare($sqlExiste);

if (!$stmtExiste) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Error preparando validación de bodega.",
    "error" => $mysqli->error
  ]);
}

$stmtExiste->bind_param("i", $id);

if (!$stmtExiste->execute()) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Error ejecutando validación de bodega.",
    "error" => $stmtExiste->error
  ]);
}

$existe = stmt_fetch_one_assoc($stmtExiste);
$stmtExiste->close();

if (!$existe) {
  jexit(404, [
    "rpta" => false,
    "mensaje" => "La bodega no existe."
  ]);
}

$sql = "
  UPDATE BodegasInventario
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
    "mensaje" => "Error cambiando estado de la bodega.",
    "error" => $stmt->error
  ]);
}

$stmt->close();
$mysqli->close();

jexit(200, [
  "rpta" => true,
  "mensaje" => $estado === 1 ? "Bodega activada correctamente." : "Bodega inactivada correctamente.",
  "data" => [
    "id" => $id,
    "estado" => $estado
  ]
]);