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

function stmt_fetch_all_assoc($stmt) {
  $meta = $stmt->result_metadata();

  if (!$meta) {
    return [];
  }

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

function consultar($mysqli, $sql) {
  $stmt = $mysqli->prepare($sql);

  if (!$stmt) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error preparando consulta de datos del formulario.",
      "error" => $mysqli->error
    ]);
  }

  if (!$stmt->execute()) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error ejecutando consulta de datos del formulario.",
      "error" => $stmt->error
    ]);
  }

  $data = stmt_fetch_all_assoc($stmt);
  $stmt->close();

  return $data;
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

$grupos = consultar($mysqli, "
  SELECT
    g.id,
    g.codigo,
    g.idCategoria,
    c.nombre AS categoriaProducto,
    g.estado
  FROM GruposProducto g
  LEFT JOIN CategoriasProducto c
    ON c.id = g.idCategoria
  WHERE g.estado = 1
  ORDER BY c.nombre ASC, g.codigo ASC
");

$embalajes = consultar($mysqli, "
  SELECT
    id,
    producto_base AS productoBase,
    presentacion,
    embalaje,
    `uni/caja` AS uniCaja,
    estado
  FROM EmbalajeCatalogo
  WHERE estado = 1
  ORDER BY producto_base ASC, presentacion ASC, embalaje ASC
");

$tiposProducto = consultar($mysqli, "
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
  ORDER BY nombre ASC, codigo ASC
");

foreach ($grupos as &$row) {
  $row["id"] = (int)$row["id"];
  $row["idCategoria"] = isset($row["idCategoria"]) ? (int)$row["idCategoria"] : null;
  $row["estado"] = (int)$row["estado"];
}
unset($row);

foreach ($embalajes as &$row) {
  $row["id"] = (int)$row["id"];
  $row["estado"] = (int)$row["estado"];
}
unset($row);

foreach ($tiposProducto as &$row) {
  $row["id"] = (int)$row["id"];
  $row["manejaLote"] = (int)$row["manejaLote"];
  $row["manejaVencimiento"] = (int)$row["manejaVencimiento"];
  $row["requiereFechaVencimiento"] = (int)$row["requiereFechaVencimiento"];
  $row["requiereBodegaFria"] = (int)$row["requiereBodegaFria"];
  $row["estado"] = (int)$row["estado"];
}
unset($row);

$mysqli->close();

jexit(200, [
  "rpta" => true,
  "mensaje" => "Datos del formulario consultados correctamente.",
  "data" => [
    "grupos" => $grupos,
    "embalajes" => $embalajes,
    "tiposProducto" => $tiposProducto
  ]
]);