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

/**
 * Convierte un mysqli_stmt ejecutado en array asociativo
 * sin usar get_result(), para servidores sin mysqlnd.
 */
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

$q = isset($_GET["q"]) ? trim($_GET["q"]) : "";
$estado = isset($_GET["estado"]) ? trim($_GET["estado"]) : "";

$where = [];
$params = [];
$types = "";

if ($q !== "") {
  $where[] = "(codigo LIKE ? OR nombre LIKE ? OR descripcion LIKE ?)";
  $like = "%" . $q . "%";
  $params[] = $like;
  $params[] = $like;
  $params[] = $like;
  $types .= "sss";
}

if ($estado !== "") {
  $where[] = "estado = ?";
  $params[] = (int)$estado;
  $types .= "i";
}

$sql = "
  SELECT
    id,
    codigo,
    nombre,
    descripcion,
    estado,
    created_at,
    updated_at
  FROM BodegasInventario
";

if (count($where) > 0) {
  $sql .= " WHERE " . implode(" AND ", $where);
}

$sql .= " ORDER BY nombre ASC, codigo ASC";

$stmt = $mysqli->prepare($sql);

if (!$stmt) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Error preparando consulta de bodegas.",
    "error" => $mysqli->error
  ]);
}

if (count($params) > 0) {
  $stmt->bind_param($types, ...$params);
}

if (!$stmt->execute()) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Error ejecutando consulta de bodegas.",
    "error" => $stmt->error
  ]);
}

$data = stmt_fetch_all_assoc($stmt);

foreach ($data as &$row) {
  $row["id"] = (int)$row["id"];
  $row["estado"] = (int)$row["estado"];
}
unset($row);

$stmt->close();
$mysqli->close();

jexit(200, [
  "rpta" => true,
  "mensaje" => "Bodegas consultadas correctamente.",
  "filtros" => [
    "q" => $q,
    "estado" => $estado
  ],
  "total" => count($data),
  "data" => $data
]);