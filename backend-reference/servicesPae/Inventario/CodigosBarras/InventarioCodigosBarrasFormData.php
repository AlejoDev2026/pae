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

$sqlProductos = "
  SELECT
    p.id,
    p.codigo,
    p.descripcion AS nombreProducto,
    p.estado,

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
  WHERE p.estado = 1
  ORDER BY p.descripcion ASC, p.codigo ASC
";

$stmt = $mysqli->prepare($sqlProductos);

if (!$stmt) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Error preparando consulta de productos.",
    "error" => $mysqli->error
  ]);
}

if (!$stmt->execute()) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Error ejecutando consulta de productos.",
    "error" => $stmt->error
  ]);
}

$productos = stmt_fetch_all_assoc($stmt);
$stmt->close();

foreach ($productos as &$row) {
  $row["id"] = (int)$row["id"];
  $row["estado"] = (int)$row["estado"];
  $row["idGrupo"] = isset($row["idGrupo"]) ? (int)$row["idGrupo"] : null;
  $row["idCategoria"] = isset($row["idCategoria"]) ? (int)$row["idCategoria"] : null;
  $row["idEmbalaje"] = isset($row["idEmbalaje"]) ? (int)$row["idEmbalaje"] : null;
  $row["idConfig"] = isset($row["idConfig"]) ? (int)$row["idConfig"] : null;
  $row["idTipoProductoInventario"] = isset($row["idTipoProductoInventario"])
    ? (int)$row["idTipoProductoInventario"]
    : null;
}
unset($row);

$mysqli->close();

jexit(200, [
  "rpta" => true,
  "mensaje" => "Datos del formulario consultados correctamente.",
  "data" => [
    "productos" => $productos,
    "tiposCodigo" => [
      [
        "codigo" => "UNIDAD",
        "nombre" => "Unidad"
      ],
      [
        "codigo" => "CAJA",
        "nombre" => "Caja"
      ],
      [
        "codigo" => "PAQUETE",
        "nombre" => "Paquete"
      ],
      [
        "codigo" => "BOLSA",
        "nombre" => "Bolsa"
      ],
      [
        "codigo" => "EMBALAJE",
        "nombre" => "Embalaje"
      ],
      [
        "codigo" => "OTRO",
        "nombre" => "Otro"
      ]
    ]
  ]
]);