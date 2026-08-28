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
$idTipoProductoInventario = isset($_GET["idTipoProductoInventario"]) ? (int)$_GET["idTipoProductoInventario"] : 0;
$soloConfigurados = isset($_GET["soloConfigurados"]) ? (int)$_GET["soloConfigurados"] : 0;

$where = [];
$params = [];
$types = "";

if ($q !== "") {
  $where[] = "(p.codigo LIKE ? OR p.descripcion LIKE ? OR g.codigo LIKE ? OR c.nombre LIKE ? OR t.nombre LIKE ? OR t.codigo LIKE ?)";
  $like = "%" . $q . "%";
  $params[] = $like;
  $params[] = $like;
  $params[] = $like;
  $params[] = $like;
  $params[] = $like;
  $params[] = $like;
  $types .= "ssssss";
}

if ($estado !== "") {
  $where[] = "COALESCE(pic.estado, p.estado, 1) = ?";
  $params[] = (int)$estado;
  $types .= "i";
}

if ($idTipoProductoInventario > 0) {
  $where[] = "pic.idTipoProductoInventario = ?";
  $params[] = $idTipoProductoInventario;
  $types .= "i";
}

if ($soloConfigurados === 1) {
  $where[] = "pic.id IS NOT NULL";
}

$sql = "
  SELECT
    p.id AS idProducto,
    p.codigo AS codigoProducto,
    p.descripcion AS descripcionProducto,
    p.estado AS estadoProducto,

    g.id AS idGrupo,
    g.codigo AS codigoGrupo,
    g.codigo AS nombreGrupo,

    c.id AS idCategoria,
    c.nombre AS nombreCategoria,

    e.id AS idEmbalaje,
    e.producto_base AS embalajeProductoBase,
    e.presentacion AS embalajePresentacion,
    e.embalaje AS embalajeNombre,
    e.`uni/caja` AS unidadesPorCaja,

    pic.id AS idConfig,
    pic.idTipoProductoInventario,
    t.codigo AS codigoTipoProductoInventario,
    t.nombre AS nombreTipoProductoInventario,

    COALESCE(pic.manejaLote, 1) AS manejaLote,
    COALESCE(pic.manejaVencimiento, 1) AS manejaVencimiento,
    COALESCE(pic.stockMinimo, 0) AS stockMinimo,
    pic.stockMaximo,
    COALESCE(pic.unidadBaseInventario, 'UND') AS unidadBaseInventario,
    pic.observacion,
    COALESCE(pic.estado, 1) AS estadoConfig

  FROM ProductosCatalogo p
  LEFT JOIN GruposProducto g ON g.id = p.idGrupo
  LEFT JOIN CategoriasProducto c ON c.id = g.idCategoria
  LEFT JOIN EmbalajeCatalogo e ON e.id = p.idEmbalaje
  LEFT JOIN ProductosInventarioConfig pic ON pic.idProducto = p.id
  LEFT JOIN TiposProductoInventario t ON t.id = pic.idTipoProductoInventario
";

if (count($where) > 0) {
  $sql .= " WHERE " . implode(" AND ", $where);
}

$sql .= " ORDER BY p.descripcion ASC, p.codigo ASC";

$stmt = $mysqli->prepare($sql);

if (!$stmt) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Error preparando consulta de configuración de productos.",
    "error" => $mysqli->error
  ]);
}

if (count($params) > 0) {
  $stmt->bind_param($types, ...$params);
}

if (!$stmt->execute()) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Error ejecutando consulta de configuración de productos.",
    "error" => $stmt->error
  ]);
}

$data = stmt_fetch_all_assoc($stmt);

foreach ($data as &$row) {
  $row["idProducto"] = (int)$row["idProducto"];
  $row["estadoProducto"] = isset($row["estadoProducto"]) ? (int)$row["estadoProducto"] : null;

  $row["idGrupo"] = $row["idGrupo"] !== null ? (int)$row["idGrupo"] : null;
  $row["idCategoria"] = $row["idCategoria"] !== null ? (int)$row["idCategoria"] : null;
  $row["idEmbalaje"] = $row["idEmbalaje"] !== null ? (int)$row["idEmbalaje"] : null;

  $row["unidadesPorCaja"] = $row["unidadesPorCaja"] !== null ? (float)$row["unidadesPorCaja"] : null;

  $row["idConfig"] = $row["idConfig"] !== null ? (int)$row["idConfig"] : null;
  $row["idTipoProductoInventario"] = $row["idTipoProductoInventario"] !== null ? (int)$row["idTipoProductoInventario"] : null;

  $row["manejaLote"] = (int)$row["manejaLote"];
  $row["manejaVencimiento"] = (int)$row["manejaVencimiento"];
  $row["stockMinimo"] = (float)$row["stockMinimo"];
  $row["stockMaximo"] = $row["stockMaximo"] !== null ? (float)$row["stockMaximo"] : null;
  $row["estadoConfig"] = (int)$row["estadoConfig"];
}
unset($row);

$stmt->close();
$mysqli->close();

jexit(200, [
  "rpta" => true,
  "mensaje" => "Configuración de productos consultada correctamente.",
  "filtros" => [
    "q" => $q,
    "estado" => $estado,
    "idTipoProductoInventario" => $idTipoProductoInventario,
    "soloConfigurados" => $soloConfigurados
  ],
  "total" => count($data),
  "data" => $data
]);