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

function existe_estado($mysqli, $idEstado) {
  $sql = "SELECT id FROM Estados WHERE id = ? LIMIT 1";
  $stmt = $mysqli->prepare($sql);

  if (!$stmt) {
    return false;
  }

  $stmt->bind_param("i", $idEstado);
  $stmt->execute();
  $stmt->store_result();

  $existe = $stmt->num_rows > 0;

  $stmt->close();

  return $existe;
}

function resolver_id_estado($mysqli, $estado) {
  $candidatos = $estado === 1 ? [1] : [2, 1];

  foreach ($candidatos as $idEstado) {
    if (existe_estado($mysqli, $idEstado)) {
      return $idEstado;
    }
  }

  return 1;
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

$idProducto = isset($input["idProducto"])
  ? (int)$input["idProducto"]
  : (isset($input["id"]) ? (int)$input["id"] : 0);

$estado = isset($input["estado"]) ? (int)$input["estado"] : -1;

if ($idProducto <= 0) {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El ID del producto es obligatorio."
  ]);
}

if (!in_array($estado, [0, 1], true)) {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El estado no es válido."
  ]);
}

$idEstado = resolver_id_estado($mysqli, $estado);

$mysqli->begin_transaction();

try {
  $sqlProducto = "
    UPDATE ProductosCatalogo
    SET
      estado = ?,
      idEstado = ?,
      updated_at = NOW()
    WHERE id = ?
  ";

  $stmtProducto = $mysqli->prepare($sqlProducto);

  if (!$stmtProducto) {
    throw new Exception("Error preparando cambio de estado del producto: " . $mysqli->error);
  }

  $stmtProducto->bind_param("iii", $estado, $idEstado, $idProducto);

  if (!$stmtProducto->execute()) {
    throw new Exception("Error cambiando estado del producto: " . $stmtProducto->error);
  }

  $stmtProducto->close();

  $sqlConfig = "
    UPDATE ProductosInventarioConfig
    SET
      estado = ?,
      updated_at = NOW()
    WHERE idProducto = ?
  ";

  $stmtConfig = $mysqli->prepare($sqlConfig);

  if (!$stmtConfig) {
    throw new Exception("Error preparando cambio de estado de configuración: " . $mysqli->error);
  }

  $stmtConfig->bind_param("ii", $estado, $idProducto);

  if (!$stmtConfig->execute()) {
    throw new Exception("Error cambiando estado de configuración: " . $stmtConfig->error);
  }

  $stmtConfig->close();

  $mysqli->commit();
  $mysqli->close();

  jexit(200, [
    "rpta" => true,
    "mensaje" => "Estado actualizado correctamente.",
    "data" => [
      "idProducto" => $idProducto,
      "estado" => $estado
    ]
  ]);
} catch (Exception $e) {
  $mysqli->rollback();

  $error = $e->getMessage();

  $mysqli->close();

  jexit(500, [
    "rpta" => false,
    "mensaje" => "No se pudo cambiar el estado del producto.",
    "error" => $error
  ]);
}