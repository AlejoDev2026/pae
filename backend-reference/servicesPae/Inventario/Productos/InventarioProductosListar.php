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
$idGrupo = isset($_GET["idGrupo"]) ? (int)$_GET["idGrupo"] : 0;
$idTipoProductoInventario = isset($_GET["idTipoProductoInventario"])
  ? (int)$_GET["idTipoProductoInventario"]
  : 0;

$where = [];
$params = [];
$types = "";

if ($q !== "") {
  $where[] = "(
    p.codigo LIKE ?
    OR p.descripcion LIKE ?
    OR p.observacion LIKE ?
    OR g.codigo LIKE ?
    OR c.nombre LIKE ?
    OR t.codigo LIKE ?
    OR t.nombre LIKE ?
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
  $where[] = "p.estado = ?";
  $params[] = (int)$estado;
  $types .= "i";
}

if ($idGrupo > 0) {
  $where[] = "p.idGrupo = ?";
  $params[] = $idGrupo;
  $types .= "i";
}

if ($idTipoProductoInventario > 0) {
  $where[] = "cfg.idTipoProductoInventario = ?";
  $params[] = $idTipoProductoInventario;
  $types .= "i";
}

$sql = "
  SELECT
    p.id AS idProducto,
    p.codigo,
    p.descripcion AS nombreProducto,
    p.descripcion,
    p.idGrupo,
    g.codigo AS codigoGrupo,
    g.idCategoria,
    c.nombre AS categoriaProducto,

    p.idEmbalaje,
    e.producto_base AS embalajeProductoBase,
    e.presentacion AS embalajePresentacion,
    e.embalaje AS embalajeNombre,
    e.`uni/caja` AS uniCaja,

    p.observacion AS observacionProducto,
    p.estado AS estadoProducto,
    p.idEstado,
    p.created_at AS productoCreatedAt,
    p.updated_at AS productoUpdatedAt,

    cfg.id AS idConfig,
    cfg.idTipoProductoInventario,
    t.codigo AS codigoTipoProductoInventario,
    t.nombre AS tipoProductoInventario,

    cfg.manejaLote,
    cfg.manejaVencimiento,
    cfg.stockMinimo,
    cfg.stockMaximo,
    cfg.unidadBaseInventario,
    cfg.observacion AS observacionInventario,
    cfg.estado AS estadoConfig,
    cfg.created_at AS configCreatedAt,
    cfg.updated_at AS configUpdatedAt
  FROM ProductosCatalogo p
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

$sql .= " ORDER BY p.descripcion ASC, p.codigo ASC";

$stmt = $mysqli->prepare($sql);

if (!$stmt) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Error preparando consulta de productos.",
    "error" => $mysqli->error
  ]);
}

if (count($params) > 0) {
  $stmt->bind_param($types, ...$params);
}

if (!$stmt->execute()) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Error ejecutando consulta de productos.",
    "error" => $stmt->error
  ]);
}

$data = stmt_fetch_all_assoc($stmt);

foreach ($data as &$row) {
  $row["idProducto"] = (int)$row["idProducto"];
  $row["idGrupo"] = isset($row["idGrupo"]) ? (int)$row["idGrupo"] : null;
  $row["idCategoria"] = isset($row["idCategoria"]) ? (int)$row["idCategoria"] : null;
  $row["idEmbalaje"] = isset($row["idEmbalaje"]) ? (int)$row["idEmbalaje"] : null;
  $row["estadoProducto"] = (int)$row["estadoProducto"];
  $row["idEstado"] = isset($row["idEstado"]) ? (int)$row["idEstado"] : null;

  $row["idConfig"] = isset($row["idConfig"]) ? (int)$row["idConfig"] : null;
  $row["idTipoProductoInventario"] = isset($row["idTipoProductoInventario"])
    ? (int)$row["idTipoProductoInventario"]
    : null;

  $row["manejaLote"] = isset($row["manejaLote"]) ? (int)$row["manejaLote"] : 0;
  $row["manejaVencimiento"] = isset($row["manejaVencimiento"]) ? (int)$row["manejaVencimiento"] : 0;
  $row["stockMinimo"] = isset($row["stockMinimo"]) ? (float)$row["stockMinimo"] : 0;
  $row["stockMaximo"] = $row["stockMaximo"] !== null ? (float)$row["stockMaximo"] : null;
  $row["estadoConfig"] = isset($row["estadoConfig"]) ? (int)$row["estadoConfig"] : null;

  $row["configuradoInventario"] = $row["idConfig"] !== null ? 1 : 0;
}
unset($row);

$stmt->close();
$mysqli->close();

jexit(200, [
  "rpta" => true,
  "mensaje" => "Productos consultados correctamente.",
  "filtros" => [
    "q" => $q,
    "estado" => $estado,
    "idGrupo" => $idGrupo,
    "idTipoProductoInventario" => $idTipoProductoInventario
  ],
  "total" => count($data),
  "data" => $data
]);