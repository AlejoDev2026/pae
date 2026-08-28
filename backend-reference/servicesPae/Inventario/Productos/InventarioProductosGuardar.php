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

function existe_id($mysqli, $tabla, $id) {
  $permitidas = [
    "ProductosCatalogo",
    "GruposProducto",
    "EmbalajeCatalogo",
    "TiposProductoInventario",
    "Estados"
  ];

  if (!in_array($tabla, $permitidas, true)) {
    return false;
  }

  $sql = "SELECT id FROM {$tabla} WHERE id = ? LIMIT 1";
  $stmt = $mysqli->prepare($sql);

  if (!$stmt) {
    return false;
  }

  $stmt->bind_param("i", $id);
  $stmt->execute();
  $stmt->store_result();

  $existe = $stmt->num_rows > 0;

  $stmt->close();

  return $existe;
}

function resolver_id_estado($mysqli, $estado) {
  $candidatos = $estado === 1 ? [1] : [2, 1];

  foreach ($candidatos as $idEstado) {
    if (existe_id($mysqli, "Estados", $idEstado)) {
      return $idEstado;
    }
  }

  return 1;
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

$idProducto = isset($input["idProducto"]) ? (int)$input["idProducto"] : 0;

$codigo = mb_strtoupper(limpiar($input["codigo"] ?? ""), "UTF-8");

$descripcion = limpiar($input["descripcion"] ?? "");
if ($descripcion === "") {
  $descripcion = limpiar($input["nombreProducto"] ?? "");
}

$idGrupo = isset($input["idGrupo"]) ? (int)$input["idGrupo"] : 0;
$idEmbalaje = isset($input["idEmbalaje"]) ? (int)$input["idEmbalaje"] : 0;
$observacionProducto = limpiar($input["observacionProducto"] ?? "");
$estadoProducto = isset($input["estadoProducto"])
  ? (int)$input["estadoProducto"]
  : (isset($input["estado"]) ? (int)$input["estado"] : 1);

$idTipoProductoInventario = isset($input["idTipoProductoInventario"])
  ? (int)$input["idTipoProductoInventario"]
  : 0;

$manejaLote = isset($input["manejaLote"]) ? (int)$input["manejaLote"] : 1;
$manejaVencimiento = isset($input["manejaVencimiento"]) ? (int)$input["manejaVencimiento"] : 1;

$stockMinimo = isset($input["stockMinimo"]) && $input["stockMinimo"] !== ""
  ? (float)$input["stockMinimo"]
  : 0;

$stockMaximo = isset($input["stockMaximo"]) && $input["stockMaximo"] !== "" && $input["stockMaximo"] !== null
  ? (float)$input["stockMaximo"]
  : null;

$unidadBaseInventario = mb_strtoupper(limpiar($input["unidadBaseInventario"] ?? "UND"), "UTF-8");
$observacionInventario = limpiar($input["observacionInventario"] ?? "");

$estadoConfig = isset($input["estadoConfig"])
  ? (int)$input["estadoConfig"]
  : $estadoProducto;

if ($codigo === "") {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El código del producto es obligatorio."
  ]);
}

if ($descripcion === "") {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El nombre o descripción del producto es obligatorio."
  ]);
}

if ($idGrupo <= 0) {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "Debes seleccionar el grupo del producto."
  ]);
}

if (!existe_id($mysqli, "GruposProducto", $idGrupo)) {
  jexit(404, [
    "rpta" => false,
    "mensaje" => "El grupo seleccionado no existe."
  ]);
}

if ($idEmbalaje > 0 && !existe_id($mysqli, "EmbalajeCatalogo", $idEmbalaje)) {
  jexit(404, [
    "rpta" => false,
    "mensaje" => "El embalaje seleccionado no existe."
  ]);
}

if ($idTipoProductoInventario > 0 && !existe_id($mysqli, "TiposProductoInventario", $idTipoProductoInventario)) {
  jexit(404, [
    "rpta" => false,
    "mensaje" => "El tipo de producto seleccionado no existe."
  ]);
}

$valoresBooleanos = [
  "estadoProducto" => $estadoProducto,
  "manejaLote" => $manejaLote,
  "manejaVencimiento" => $manejaVencimiento,
  "estadoConfig" => $estadoConfig
];

foreach ($valoresBooleanos as $campo => $valor) {
  if (!in_array($valor, [0, 1], true)) {
    jexit(400, [
      "rpta" => false,
      "mensaje" => "El campo {$campo} no es válido."
    ]);
  }
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
  jexit(400, [
    "rpta" => false,
    "mensaje" => "La unidad base de inventario es obligatoria."
  ]);
}

if ($idProducto > 0 && !existe_id($mysqli, "ProductosCatalogo", $idProducto)) {
  jexit(404, [
    "rpta" => false,
    "mensaje" => "El producto que intentas editar no existe."
  ]);
}

if ($idProducto > 0) {
  $sqlDuplicado = "
    SELECT id
    FROM ProductosCatalogo
    WHERE codigo = ?
      AND id <> ?
    LIMIT 1
  ";

  $stmtDuplicado = $mysqli->prepare($sqlDuplicado);

  if (!$stmtDuplicado) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error preparando validación de código duplicado.",
      "error" => $mysqli->error
    ]);
  }

  $stmtDuplicado->bind_param("si", $codigo, $idProducto);
} else {
  $sqlDuplicado = "
    SELECT id
    FROM ProductosCatalogo
    WHERE codigo = ?
    LIMIT 1
  ";

  $stmtDuplicado = $mysqli->prepare($sqlDuplicado);

  if (!$stmtDuplicado) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error preparando validación de código duplicado.",
      "error" => $mysqli->error
    ]);
  }

  $stmtDuplicado->bind_param("s", $codigo);
}

if (!$stmtDuplicado->execute()) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Error ejecutando validación de código duplicado.",
    "error" => $stmtDuplicado->error
  ]);
}

$stmtDuplicado->store_result();

if ($stmtDuplicado->num_rows > 0) {
  $stmtDuplicado->close();
  $mysqli->close();

  jexit(409, [
    "rpta" => false,
    "mensaje" => "Ya existe un producto con este código."
  ]);
}

$stmtDuplicado->close();

$idEstado = resolver_id_estado($mysqli, $estadoProducto);

$mysqli->begin_transaction();

try {
  if ($idProducto > 0) {
    $sqlProducto = "
      UPDATE ProductosCatalogo
      SET
        codigo = ?,
        descripcion = ?,
        idGrupo = ?,
        idEmbalaje = NULLIF(?, 0),
        observacion = ?,
        estado = ?,
        idEstado = ?,
        updated_at = NOW()
      WHERE id = ?
    ";

    $stmtProducto = $mysqli->prepare($sqlProducto);

    if (!$stmtProducto) {
      throw new Exception("Error preparando actualización de producto: " . $mysqli->error);
    }

    $stmtProducto->bind_param(
      "ssiisiii",
      $codigo,
      $descripcion,
      $idGrupo,
      $idEmbalaje,
      $observacionProducto,
      $estadoProducto,
      $idEstado,
      $idProducto
    );

    if (!$stmtProducto->execute()) {
      throw new Exception("Error actualizando producto: " . $stmtProducto->error);
    }

    $stmtProducto->close();
  } else {
    $sqlProducto = "
      INSERT INTO ProductosCatalogo
      (
        codigo,
        descripcion,
        idGrupo,
        idEmbalaje,
        observacion,
        estado,
        idEstado,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, NULLIF(?, 0), ?, ?, ?, NOW(), NOW())
    ";

    $stmtProducto = $mysqli->prepare($sqlProducto);

    if (!$stmtProducto) {
      throw new Exception("Error preparando registro de producto: " . $mysqli->error);
    }

    $stmtProducto->bind_param(
      "ssiisii",
      $codigo,
      $descripcion,
      $idGrupo,
      $idEmbalaje,
      $observacionProducto,
      $estadoProducto,
      $idEstado
    );

    if (!$stmtProducto->execute()) {
      throw new Exception("Error guardando producto: " . $stmtProducto->error);
    }

    $idProducto = $stmtProducto->insert_id;
    $stmtProducto->close();
  }

  $sqlExisteConfig = "
    SELECT id
    FROM ProductosInventarioConfig
    WHERE idProducto = ?
    LIMIT 1
  ";

  $stmtExisteConfig = $mysqli->prepare($sqlExisteConfig);

  if (!$stmtExisteConfig) {
    throw new Exception("Error preparando validación de configuración: " . $mysqli->error);
  }

  $stmtExisteConfig->bind_param("i", $idProducto);

  if (!$stmtExisteConfig->execute()) {
    throw new Exception("Error validando configuración: " . $stmtExisteConfig->error);
  }

  $stmtExisteConfig->store_result();
  $existeConfig = $stmtExisteConfig->num_rows > 0;
  $stmtExisteConfig->close();

  if ($existeConfig) {
    $sqlConfig = "
      UPDATE ProductosInventarioConfig
      SET
        idTipoProductoInventario = NULLIF(?, 0),
        manejaLote = ?,
        manejaVencimiento = ?,
        stockMinimo = ?,
        stockMaximo = ?,
        unidadBaseInventario = ?,
        observacion = ?,
        estado = ?,
        updated_at = NOW()
      WHERE idProducto = ?
    ";

    $stmtConfig = $mysqli->prepare($sqlConfig);

    if (!$stmtConfig) {
      throw new Exception("Error preparando actualización de configuración: " . $mysqli->error);
    }

    $stmtConfig->bind_param(
      "iiiddssii",
      $idTipoProductoInventario,
      $manejaLote,
      $manejaVencimiento,
      $stockMinimo,
      $stockMaximo,
      $unidadBaseInventario,
      $observacionInventario,
      $estadoConfig,
      $idProducto
    );

    if (!$stmtConfig->execute()) {
      throw new Exception("Error actualizando configuración: " . $stmtConfig->error);
    }

    $stmtConfig->close();
  } else {
    $sqlConfig = "
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
      VALUES (?, NULLIF(?, 0), ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ";

    $stmtConfig = $mysqli->prepare($sqlConfig);

    if (!$stmtConfig) {
      throw new Exception("Error preparando registro de configuración: " . $mysqli->error);
    }

    $stmtConfig->bind_param(
      "iiiiddssi",
      $idProducto,
      $idTipoProductoInventario,
      $manejaLote,
      $manejaVencimiento,
      $stockMinimo,
      $stockMaximo,
      $unidadBaseInventario,
      $observacionInventario,
      $estadoConfig
    );

    if (!$stmtConfig->execute()) {
      throw new Exception("Error guardando configuración: " . $stmtConfig->error);
    }

    $stmtConfig->close();
  }

  $mysqli->commit();

  $mysqli->close();

  jexit(200, [
    "rpta" => true,
    "mensaje" => $input["idProducto"] > 0
      ? "Producto actualizado correctamente."
      : "Producto creado correctamente.",
    "data" => [
      "idProducto" => $idProducto
    ]
  ]);
} catch (Exception $e) {
  $mysqli->rollback();

  $error = $e->getMessage();

  $mysqli->close();

  jexit(500, [
    "rpta" => false,
    "mensaje" => "No se pudo guardar el producto.",
    "error" => $error
  ]);
}