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
$idBodega = (int)val($data, "idBodega", 0);
$codigo = strtoupper(val($data, "codigo", ""));
$nombre = val($data, "nombre", "");
$descripcion = val($data, "descripcion", "");
$estado = (int)val($data, "estado", 1);

if ($idBodega <= 0) {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "La bodega es obligatoria."
  ]);
}

if ($codigo === "") {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El código de la ubicación es obligatorio."
  ]);
}

if ($nombre === "") {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El nombre de la ubicación es obligatorio."
  ]);
}

if ($estado !== 0 && $estado !== 1) {
  $estado = 1;
}

$codigo = preg_replace('/\s+/', '-', $codigo);

$sqlBodega = "
  SELECT id
  FROM BodegasInventario
  WHERE id = ?
  LIMIT 1
";

$stmtBodega = $mysqli->prepare($sqlBodega);

if (!$stmtBodega) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Error preparando validación de bodega.",
    "error" => $mysqli->error
  ]);
}

$stmtBodega->bind_param("i", $idBodega);

if (!$stmtBodega->execute()) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Error ejecutando validación de bodega.",
    "error" => $stmtBodega->error
  ]);
}

$bodega = stmt_fetch_one_assoc($stmtBodega);
$stmtBodega->close();

if (!$bodega) {
  jexit(404, [
    "rpta" => false,
    "mensaje" => "La bodega seleccionada no existe."
  ]);
}

if ($id > 0) {
  $sqlCheck = "
    SELECT id
    FROM UbicacionesInventario
    WHERE idBodega = ?
      AND codigo = ?
      AND id <> ?
    LIMIT 1
  ";

  $stmtCheck = $mysqli->prepare($sqlCheck);

  if (!$stmtCheck) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error preparando validación de código.",
      "error" => $mysqli->error
    ]);
  }

  $stmtCheck->bind_param("isi", $idBodega, $codigo, $id);

  if (!$stmtCheck->execute()) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error ejecutando validación de código.",
      "error" => $stmtCheck->error
    ]);
  }

  $existe = stmt_fetch_one_assoc($stmtCheck);
  $stmtCheck->close();

  if ($existe) {
    jexit(409, [
      "rpta" => false,
      "mensaje" => "Ya existe otra ubicación con este código en la bodega seleccionada."
    ]);
  }

  $sql = "
    UPDATE UbicacionesInventario
    SET
      idBodega = ?,
      codigo = ?,
      nombre = ?,
      descripcion = ?,
      estado = ?,
      updated_at = NOW()
    WHERE id = ?
  ";

  $stmt = $mysqli->prepare($sql);

  if (!$stmt) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error preparando actualización de ubicación.",
      "error" => $mysqli->error
    ]);
  }

  $stmt->bind_param("isssii", $idBodega, $codigo, $nombre, $descripcion, $estado, $id);

  if (!$stmt->execute()) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error actualizando ubicación.",
      "error" => $stmt->error
    ]);
  }

  $stmt->close();

  $mensaje = "Ubicación actualizada correctamente.";

} else {
  $sqlCheck = "
    SELECT id
    FROM UbicacionesInventario
    WHERE idBodega = ?
      AND codigo = ?
    LIMIT 1
  ";

  $stmtCheck = $mysqli->prepare($sqlCheck);

  if (!$stmtCheck) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error preparando validación de código.",
      "error" => $mysqli->error
    ]);
  }

  $stmtCheck->bind_param("is", $idBodega, $codigo);

  if (!$stmtCheck->execute()) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error ejecutando validación de código.",
      "error" => $stmtCheck->error
    ]);
  }

  $existe = stmt_fetch_one_assoc($stmtCheck);
  $stmtCheck->close();

  if ($existe) {
    jexit(409, [
      "rpta" => false,
      "mensaje" => "Ya existe una ubicación con este código en la bodega seleccionada."
    ]);
  }

  $sql = "
    INSERT INTO UbicacionesInventario
    (idBodega, codigo, nombre, descripcion, estado, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, NOW(), NOW())
  ";

  $stmt = $mysqli->prepare($sql);

  if (!$stmt) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error preparando creación de ubicación.",
      "error" => $mysqli->error
    ]);
  }

  $stmt->bind_param("isssi", $idBodega, $codigo, $nombre, $descripcion, $estado);

  if (!$stmt->execute()) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error creando ubicación.",
      "error" => $stmt->error
    ]);
  }

  $id = $stmt->insert_id;
  $stmt->close();

  $mensaje = "Ubicación creada correctamente.";
}

$sqlGet = "
  SELECT
    u.id,
    u.idBodega,
    b.codigo AS codigoBodega,
    b.nombre AS nombreBodega,
    u.codigo,
    u.nombre,
    u.descripcion,
    u.estado,
    u.created_at,
    u.updated_at
  FROM UbicacionesInventario u
  INNER JOIN BodegasInventario b ON b.id = u.idBodega
  WHERE u.id = ?
  LIMIT 1
";

$stmtGet = $mysqli->prepare($sqlGet);

if (!$stmtGet) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Ubicación guardada, pero no se pudo consultar el registro.",
    "error" => $mysqli->error
  ]);
}

$stmtGet->bind_param("i", $id);

if (!$stmtGet->execute()) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Ubicación guardada, pero ocurrió un error consultando el registro.",
    "error" => $stmtGet->error
  ]);
}

$row = stmt_fetch_one_assoc($stmtGet);
$stmtGet->close();

if ($row) {
  $row["id"] = (int)$row["id"];
  $row["idBodega"] = (int)$row["idBodega"];
  $row["estado"] = (int)$row["estado"];
}

$mysqli->close();

jexit(200, [
  "rpta" => true,
  "mensaje" => $mensaje,
  "data" => $row
]);