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

function bit_val($data, $key, $default = 0) {
  $v = val($data, $key, $default);
  return ((int)$v) === 1 ? 1 : 0;
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
$codigo = strtoupper(val($data, "codigo", ""));
$nombre = val($data, "nombre", "");
$descripcion = val($data, "descripcion", "");
$manejaLote = bit_val($data, "manejaLote", 1);
$manejaVencimiento = bit_val($data, "manejaVencimiento", 1);
$requiereFechaVencimiento = bit_val($data, "requiereFechaVencimiento", 1);
$requiereBodegaFria = bit_val($data, "requiereBodegaFria", 0);
$estado = bit_val($data, "estado", 1);

if ($codigo === "") {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El código del tipo de producto es obligatorio."
  ]);
}

if ($nombre === "") {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El nombre del tipo de producto es obligatorio."
  ]);
}

$codigo = preg_replace('/\s+/', '_', $codigo);

if ($id > 0) {
  $sqlCheck = "
    SELECT id
    FROM TiposProductoInventario
    WHERE codigo = ?
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

  $stmtCheck->bind_param("si", $codigo, $id);

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
      "mensaje" => "Ya existe otro tipo de producto con este código."
    ]);
  }

  $sql = "
    UPDATE TiposProductoInventario
    SET
      codigo = ?,
      nombre = ?,
      descripcion = ?,
      manejaLote = ?,
      manejaVencimiento = ?,
      requiereFechaVencimiento = ?,
      requiereBodegaFria = ?,
      estado = ?,
      updated_at = NOW()
    WHERE id = ?
  ";

  $stmt = $mysqli->prepare($sql);

  if (!$stmt) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error preparando actualización de tipo de producto.",
      "error" => $mysqli->error
    ]);
  }

  $stmt->bind_param(
    "sssiiiiii",
    $codigo,
    $nombre,
    $descripcion,
    $manejaLote,
    $manejaVencimiento,
    $requiereFechaVencimiento,
    $requiereBodegaFria,
    $estado,
    $id
  );

  if (!$stmt->execute()) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error actualizando tipo de producto.",
      "error" => $stmt->error
    ]);
  }

  $stmt->close();

  $mensaje = "Tipo de producto actualizado correctamente.";

} else {
  $sqlCheck = "
    SELECT id
    FROM TiposProductoInventario
    WHERE codigo = ?
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

  $stmtCheck->bind_param("s", $codigo);

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
      "mensaje" => "Ya existe un tipo de producto con este código."
    ]);
  }

  $sql = "
    INSERT INTO TiposProductoInventario
    (
      codigo,
      nombre,
      descripcion,
      manejaLote,
      manejaVencimiento,
      requiereFechaVencimiento,
      requiereBodegaFria,
      estado,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  ";

  $stmt = $mysqli->prepare($sql);

  if (!$stmt) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error preparando creación de tipo de producto.",
      "error" => $mysqli->error
    ]);
  }

  $stmt->bind_param(
    "sssiiiii",
    $codigo,
    $nombre,
    $descripcion,
    $manejaLote,
    $manejaVencimiento,
    $requiereFechaVencimiento,
    $requiereBodegaFria,
    $estado
  );

  if (!$stmt->execute()) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error creando tipo de producto.",
      "error" => $stmt->error
    ]);
  }

  $id = $stmt->insert_id;
  $stmt->close();

  $mensaje = "Tipo de producto creado correctamente.";
}

$sqlGet = "
  SELECT
    id,
    codigo,
    nombre,
    descripcion,
    manejaLote,
    manejaVencimiento,
    requiereFechaVencimiento,
    requiereBodegaFria,
    estado,
    created_at,
    updated_at
  FROM TiposProductoInventario
  WHERE id = ?
  LIMIT 1
";

$stmtGet = $mysqli->prepare($sqlGet);

if (!$stmtGet) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Tipo de producto guardado, pero no se pudo consultar el registro.",
    "error" => $mysqli->error
  ]);
}

$stmtGet->bind_param("i", $id);

if (!$stmtGet->execute()) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Tipo de producto guardado, pero ocurrió un error consultando el registro.",
    "error" => $stmtGet->error
  ]);
}

$row = stmt_fetch_one_assoc($stmtGet);
$stmtGet->close();

if ($row) {
  $row["id"] = (int)$row["id"];
  $row["manejaLote"] = (int)$row["manejaLote"];
  $row["manejaVencimiento"] = (int)$row["manejaVencimiento"];
  $row["requiereFechaVencimiento"] = (int)$row["requiereFechaVencimiento"];
  $row["requiereBodegaFria"] = (int)$row["requiereBodegaFria"];
  $row["estado"] = (int)$row["estado"];
}

$mysqli->close();

jexit(200, [
  "rpta" => true,
  "mensaje" => $mensaje,
  "data" => $row
]);