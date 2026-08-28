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

function limpiar($valor) {
  return isset($valor) ? trim((string)$valor) : "";
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

$id = isset($input["id"]) ? (int)$input["id"] : 0;
$codigo = mb_strtoupper(limpiar($input["codigo"] ?? ""), "UTF-8");
$nombre = limpiar($input["nombre"] ?? "");
$descripcion = limpiar($input["descripcion"] ?? "");

$manejaLote = isset($input["manejaLote"]) ? (int)$input["manejaLote"] : 0;
$manejaVencimiento = isset($input["manejaVencimiento"]) ? (int)$input["manejaVencimiento"] : 0;
$requiereFechaVencimiento = isset($input["requiereFechaVencimiento"])
  ? (int)$input["requiereFechaVencimiento"]
  : 0;
$requiereBodegaFria = isset($input["requiereBodegaFria"])
  ? (int)$input["requiereBodegaFria"]
  : 0;

$estado = isset($input["estado"]) ? (int)$input["estado"] : 1;

if ($codigo === "") {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El código es obligatorio."
  ]);
}

if ($nombre === "") {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El nombre es obligatorio."
  ]);
}

$booleanos = [
  "manejaLote" => $manejaLote,
  "manejaVencimiento" => $manejaVencimiento,
  "requiereFechaVencimiento" => $requiereFechaVencimiento,
  "requiereBodegaFria" => $requiereBodegaFria,
  "estado" => $estado
];

foreach ($booleanos as $campo => $valor) {
  if (!in_array($valor, [0, 1], true)) {
    jexit(400, [
      "rpta" => false,
      "mensaje" => "El campo {$campo} no es válido."
    ]);
  }
}

if ($requiereFechaVencimiento === 1 && $manejaVencimiento === 0) {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "Si requiere fecha de vencimiento, debe manejar vencimiento."
  ]);
}

if ($id > 0) {
  $sqlDuplicado = "
    SELECT id
    FROM TiposProductoInventario
    WHERE codigo = ?
      AND id <> ?
    LIMIT 1
  ";

  $stmtDuplicado = $mysqli->prepare($sqlDuplicado);

  if (!$stmtDuplicado) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error preparando validación de duplicado.",
      "error" => $mysqli->error
    ]);
  }

  $stmtDuplicado->bind_param("si", $codigo, $id);
} else {
  $sqlDuplicado = "
    SELECT id
    FROM TiposProductoInventario
    WHERE codigo = ?
    LIMIT 1
  ";

  $stmtDuplicado = $mysqli->prepare($sqlDuplicado);

  if (!$stmtDuplicado) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error preparando validación de duplicado.",
      "error" => $mysqli->error
    ]);
  }

  $stmtDuplicado->bind_param("s", $codigo);
}

if (!$stmtDuplicado->execute()) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Error ejecutando validación de duplicado.",
    "error" => $stmtDuplicado->error
  ]);
}

$stmtDuplicado->store_result();

if ($stmtDuplicado->num_rows > 0) {
  $stmtDuplicado->close();
  $mysqli->close();

  jexit(409, [
    "rpta" => false,
    "mensaje" => "Ya existe un tipo de producto con este código."
  ]);
}

$stmtDuplicado->close();

if ($id > 0) {
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
      "mensaje" => "Error preparando actualización del tipo de producto.",
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
      "mensaje" => "Error actualizando el tipo de producto.",
      "error" => $stmt->error
    ]);
  }

  $stmt->close();
  $mysqli->close();

  jexit(200, [
    "rpta" => true,
    "mensaje" => "Tipo de producto actualizado correctamente.",
    "data" => [
      "id" => $id
    ]
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
    "mensaje" => "Error preparando registro del tipo de producto.",
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
    "mensaje" => "Error guardando el tipo de producto.",
    "error" => $stmt->error
  ]);
}

$idInsertado = $stmt->insert_id;

$stmt->close();
$mysqli->close();

jexit(200, [
  "rpta" => true,
  "mensaje" => "Tipo de producto guardado correctamente.",
  "data" => [
    "id" => $idInsertado
  ]
]);