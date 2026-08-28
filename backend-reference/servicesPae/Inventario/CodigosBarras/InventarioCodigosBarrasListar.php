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
$idProducto = isset($_GET["idProducto"]) ? (int)$_GET["idProducto"] : 0;
$tipoCodigo = isset($_GET["tipoCodigo"]) ? trim($_GET["tipoCodigo"]) : "";
$principal = isset($_GET["principal"]) ? trim($_GET["principal"]) : "";

$where = [];
$params = [];
$types = "";

if ($q !== "") {
  $where[] = "(
    cb.codigoBarras LIKE ?
    OR cb.tipoCodigo LIKE ?
    OR cb.observacion LIKE ?
    OR p.codigo LIKE ?
    OR p.descripcion LIKE ?
    OR t.nombre LIKE ?
    OR t.codigo LIKE ?
  )";

  $like = "%" . $q . "%";

  $params[] = $like;
  $params[] = $like;
  $params[] = $like;
  $params[] = $like;
  $params[] = $like;
  $params[] = $like;
  $params[] = $like;
  $types .= "sssssss";
}

if ($estado !== "") {
  $where[] = "cb.estado = ?";
  $params[] = (int)$estado;
  $types .= "i";
}

if ($idProducto > 0) {
  $where[] = "cb.idProducto = ?";
  $params[] = $idProducto;
  $types .= "i";
}

if ($tipoCodigo !== "") {
  $where[] = "cb.tipoCodigo = ?";
  $params[] = mb_strtoupper($tipoCodigo, "UTF-8");
  $types .= "s";
}

if ($principal !== "") {
  $where[] = "cb.principal = ?";
  $params[] = (int)$principal;
  $types .= "i";
}

$sql = "
  SELECT
    cb.id,
    cb.idProducto,
    cb.codigoBarras,
    cb.tipoCodigo,
    cb.principal,
    cb.observacion,
    cb.estado,
    cb.created_at,
    cb.updated_at,

    p.codigo AS codigoProducto,
    p.descripcion AS nombreProducto,
    p.estado AS estadoProducto,

    p.idGrupo,
    g.codigo AS codigoGrupo,
    g.idCategoria,
    c.nombre AS categoriaProducto,

    p.idEmbalaje,
    e.producto_base AS embalajeProductoBase,
    e.presentacion AS embalajePresentacion,
    e.embalaje AS embalajeNombre,
    e.`uni/caja` AS uniCaja,

    cfg.id AS idConfig,
    cfg.idTipoProductoInventario,
    t.codigo AS codigoTipoProductoInventario,
    t.nombre AS tipoProductoInventario,
    cfg.unidadBaseInventario
  FROM ProductosCodigosBarras cb
  INNER JOIN ProductosCatalogo p
    ON p.id = cb.idProducto
  LEFT JOIN ProductosInventarioConfig cfg
    ON cfg.idProducto = p.id
  LEFT JOIN TiposProductoInventario t
    ON t.id = cfg.idTipoProductoInventario
  LEFT JOIN GruposProducto g
    ON g.id = p.idGrupo
  LEFT JOIN CategoriasProducto c
    ON c.id = g.idCategoria
  LEFT JOIN EmbalajeCatalogo e
    ON e.id = p.idEmbalaje
";

if (count($where) > 0) {
  $sql .= " WHERE " . implode(" AND ", $where);
}

$sql .= "
  ORDER BY
    p.descripcion ASC,
    cb.principal DESC,
    cb.tipoCodigo ASC,
    cb.codigoBarras ASC
";

$stmt = $mysqli->prepare($sql);

if (!$stmt) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Error preparando consulta de códigos de barras.",
    "error" => $mysqli->error
  ]);
}

if (count($params) > 0) {
  $stmt->bind_param($types, ...$params);
}

if (!$stmt->execute()) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Error ejecutando consulta de códigos de barras.",
    "error" => $stmt->error
  ]);
}

$data = stmt_fetch_all_assoc($stmt);

foreach ($data as &$row) {
  $row["id"] = (int)$row["id"];
  $row["idProducto"] = (int)$row["idProducto"];
  $row["principal"] = (int)$row["principal"];
  $row["estado"] = (int)$row["estado"];
  $row["estadoProducto"] = (int)$row["estadoProducto"];
  $row["idGrupo"] = isset($row["idGrupo"]) ? (int)$row["idGrupo"] : null;
  $row["idCategoria"] = isset($row["idCategoria"]) ? (int)$row["idCategoria"] : null;
  $row["idEmbalaje"] = isset($row["idEmbalaje"]) ? (int)$row["idEmbalaje"] : null;
  $row["idConfig"] = isset($row["idConfig"]) ? (int)$row["idConfig"] : null;
  $row["idTipoProductoInventario"] = isset($row["idTipoProductoInventario"])
    ? (int)$row["idTipoProductoInventario"]
    : null;
}
unset($row);

$stmt->close();
$mysqli->close();

jexit(200, [
  "rpta" => true,
  "mensaje" => "Códigos de barras consultados correctamente.",
  "filtros" => [
    "q" => $q,
    "estado" => $estado,
    "idProducto" => $idProducto,
    "tipoCodigo" => $tipoCodigo,
    "principal" => $principal
  ],
  "total" => count($data),
  "data" => $data
]);