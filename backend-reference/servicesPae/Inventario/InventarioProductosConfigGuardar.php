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

$idProducto = (int)val($data, "idProducto", 0);
$idTipoProductoInventarioRaw = val($data, "idTipoProductoInventario", "");
$idTipoProductoInventario = $idTipoProductoInventarioRaw === "" ? null : (int)$idTipoProductoInventarioRaw;

$manejaLote = bit_val($data, "manejaLote", 1);
$manejaVencimiento = bit_val($data, "manejaVencimiento", 1);
$stockMinimo = (float)val($data, "stockMinimo", 0);
$stockMaximoRaw = val($data, "stockMaximo", "");
$stockMaximo = $stockMaximoRaw === "" ? null : (float)$stockMaximoRaw;
$unidadBaseInventario = strtoupper(val($data, "unidadBaseInventario", "UND"));
$observacion = val($data, "observacion", "");
$estado = bit_val($data, "estado", 1);

if ($idProducto <= 0) {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El producto es obligatorio."
  ]);
}

if ($stockMinimo < 0) {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El stock mínimo no puede ser negativo."
  ]);
}

if ($stockMaximo !== null && $stockMaximo < 0) {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El stock máximo no puede ser negativo."
  ]);
}

if ($stockMaximo !== null && $stockMaximo < $stockMinimo) {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El stock máximo no puede ser menor al stock mínimo."
  ]);
}

if ($unidadBaseInventario === "") {
  $unidadBaseInventario = "UND";
}

$sqlProducto = "
  SELECT id
  FROM ProductosCatalogo
  WHERE id = ?
  LIMIT 1
";

$stmtProducto = $mysqli->prepare($sqlProducto);

if (!$stmtProducto) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Error preparando validación de producto.",
    "error" => $mysqli->error
  ]);
}

$stmtProducto->bind_param("i", $idProducto);

if (!$stmtProducto->execute()) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Error ejecutando validación de producto.",
    "error" => $stmtProducto->error
  ]);
}

$producto = stmt_fetch_one_assoc($stmtProducto);
$stmtProducto->close();

if (!$producto) {
  jexit(404, [
    "rpta" => false,
    "mensaje" => "El producto seleccionado no existe."
  ]);
}

if ($idTipoProductoInventario !== null && $idTipoProductoInventario > 0) {
  $sqlTipo = "
    SELECT id
    FROM TiposProductoInventario
    WHERE id = ?
    LIMIT 1
  ";

  $stmtTipo = $mysqli->prepare($sqlTipo);

  if (!$stmtTipo) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error preparando validación de tipo logístico.",
      "error" => $mysqli->error
    ]);
  }

  $stmtTipo->bind_param("i", $idTipoProductoInventario);

  if (!$stmtTipo->execute()) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error ejecutando validación de tipo logístico.",
      "error" => $stmtTipo->error
    ]);
  }

  $tipo = stmt_fetch_one_assoc($stmtTipo);
  $stmtTipo->close();

  if (!$tipo) {
    jexit(404, [
      "rpta" => false,
      "mensaje" => "El tipo logístico seleccionado no existe."
    ]);
  }
} else {
  $idTipoProductoInventario = null;
}

$sqlExiste = "
  SELECT id
  FROM ProductosInventarioConfig
  WHERE idProducto = ?
  LIMIT 1
";

$stmtExiste = $mysqli->prepare($sqlExiste);

if (!$stmtExiste) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Error preparando validación de configuración.",
    "error" => $mysqli->error
  ]);
}

$stmtExiste->bind_param("i", $idProducto);

if (!$stmtExiste->execute()) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Error ejecutando validación de configuración.",
    "error" => $stmtExiste->error
  ]);
}

$configActual = stmt_fetch_one_assoc($stmtExiste);
$stmtExiste->close();

if ($configActual) {
  $idConfig = (int)$configActual["id"];

  $sql = "
    UPDATE ProductosInventarioConfig
    SET
      idTipoProductoInventario = ?,
      manejaLote = ?,
      manejaVencimiento = ?,
      stockMinimo = ?,
      stockMaximo = ?,
      unidadBaseInventario = ?,
      observacion = ?,
      estado = ?,
      updated_at = NOW()
    WHERE id = ?
  ";

  $stmt = $mysqli->prepare($sql);

  if (!$stmt) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error preparando actualización de configuración.",
      "error" => $mysqli->error
    ]);
  }

  $stmt->bind_param(
    "iiiddssii",
    $idTipoProductoInventario,
    $manejaLote,
    $manejaVencimiento,
    $stockMinimo,
    $stockMaximo,
    $unidadBaseInventario,
    $observacion,
    $estado,
    $idConfig
  );

  if (!$stmt->execute()) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error actualizando configuración del producto.",
      "error" => $stmt->error
    ]);
  }

  $stmt->close();

  $mensaje = "Configuración del producto actualizada correctamente.";

} else {
  $sql = "
    INSERT INTO ProductosInventarioConfig
    (
      idProducto,
      idTipoProductoInventario,
      manejaLote,
      manejaVencimiento,
      stockMinimo,
      stockMaximo,
      unidadBaseInventario,
      observacion,
      estado,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
  ";

  $stmt = $mysqli->prepare($sql);

  if (!$stmt) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error preparando creación de configuración.",
      "error" => $mysqli->error
    ]);
  }

  $stmt->bind_param(
    "iiiiddssi",
    $idProducto,
    $idTipoProductoInventario,
    $manejaLote,
    $manejaVencimiento,
    $stockMinimo,
    $stockMaximo,
    $unidadBaseInventario,
    $observacion,
    $estado
  );

  if (!$stmt->execute()) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error creando configuración del producto.",
      "error" => $stmt->error
    ]);
  }

  $idConfig = $stmt->insert_id;
  $stmt->close();

  $mensaje = "Configuración del producto creada correctamente.";
}

$sqlGet = "
  SELECT
    p.id AS idProducto,
    p.codigo AS codigoProducto,
    p.descripcion AS descripcionProducto,

    pic.id AS idConfig,
    pic.idTipoProductoInventario,
    t.codigo AS codigoTipoProductoInventario,
    t.nombre AS nombreTipoProductoInventario,

    pic.manejaLote,
    pic.manejaVencimiento,
    pic.stockMinimo,
    pic.stockMaximo,
    pic.unidadBaseInventario,
    pic.observacion,
    pic.estado AS estadoConfig,
    pic.created_at,
    pic.updated_at

  FROM ProductosInventarioConfig pic
  INNER JOIN ProductosCatalogo p ON p.id = pic.idProducto
  LEFT JOIN TiposProductoInventario t ON t.id = pic.idTipoProductoInventario
  WHERE pic.id = ?
  LIMIT 1
";

$stmtGet = $mysqli->prepare($sqlGet);

if (!$stmtGet) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Configuración guardada, pero no se pudo consultar el registro.",
    "error" => $mysqli->error
  ]);
}

$stmtGet->bind_param("i", $idConfig);

if (!$stmtGet->execute()) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Configuración guardada, pero ocurrió un error consultando el registro.",
    "error" => $stmtGet->error
  ]);
}

$row = stmt_fetch_one_assoc($stmtGet);
$stmtGet->close();

if ($row) {
  $row["idProducto"] = (int)$row["idProducto"];
  $row["idConfig"] = (int)$row["idConfig"];
  $row["idTipoProductoInventario"] = $row["idTipoProductoInventario"] !== null ? (int)$row["idTipoProductoInventario"] : null;
  $row["manejaLote"] = (int)$row["manejaLote"];
  $row["manejaVencimiento"] = (int)$row["manejaVencimiento"];
  $row["stockMinimo"] = (float)$row["stockMinimo"];
  $row["stockMaximo"] = $row["stockMaximo"] !== null ? (float)$row["stockMaximo"] : null;
  $row["estadoConfig"] = (int)$row["estadoConfig"];
}

$mysqli->close();

jexit(200, [
  "rpta" => true,
  "mensaje" => $mensaje,
  "data" => $row
]);