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

function existe_producto($mysqli, $idProducto) {
  $sql = "
    SELECT id
    FROM ProductosCatalogo
    WHERE id = ?
    LIMIT 1
  ";

  $stmt = $mysqli->prepare($sql);

  if (!$stmt) {
    return false;
  }

  $stmt->bind_param("i", $idProducto);
  $stmt->execute();
  $stmt->store_result();

  $existe = $stmt->num_rows > 0;

  $stmt->close();

  return $existe;
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
$idProducto = isset($input["idProducto"]) ? (int)$input["idProducto"] : 0;
$codigoBarras = limpiar($input["codigoBarras"] ?? "");
$tipoCodigo = mb_strtoupper(limpiar($input["tipoCodigo"] ?? "UNIDAD"), "UTF-8");
$principal = isset($input["principal"]) ? (int)$input["principal"] : 0;
$observacion = limpiar($input["observacion"] ?? "");
$estado = isset($input["estado"]) ? (int)$input["estado"] : 1;

if ($idProducto <= 0) {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "Debes seleccionar un producto."
  ]);
}

if (!existe_producto($mysqli, $idProducto)) {
  jexit(404, [
    "rpta" => false,
    "mensaje" => "El producto seleccionado no existe."
  ]);
}

if ($codigoBarras === "") {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El código de barras es obligatorio."
  ]);
}

if ($tipoCodigo === "") {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El tipo de código es obligatorio."
  ]);
}

if (!in_array($principal, [0, 1], true)) {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El valor principal no es válido."
  ]);
}

if (!in_array($estado, [0, 1], true)) {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El estado no es válido."
  ]);
}

if ($id > 0) {
  $sqlDuplicado = "
    SELECT id
    FROM ProductosCodigosBarras
    WHERE codigoBarras = ?
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

  $stmtDuplicado->bind_param("si", $codigoBarras, $id);
} else {
  $sqlDuplicado = "
    SELECT id
    FROM ProductosCodigosBarras
    WHERE codigoBarras = ?
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

  $stmtDuplicado->bind_param("s", $codigoBarras);
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
    "mensaje" => "Ya existe un producto con este código de barras."
  ]);
}

$stmtDuplicado->close();

if ($id > 0) {
  $sqlExiste = "
    SELECT id
    FROM ProductosCodigosBarras
    WHERE id = ?
    LIMIT 1
  ";

  $stmtExiste = $mysqli->prepare($sqlExiste);

  if (!$stmtExiste) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error preparando validación del registro.",
      "error" => $mysqli->error
    ]);
  }

  $stmtExiste->bind_param("i", $id);

  if (!$stmtExiste->execute()) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error ejecutando validación del registro.",
      "error" => $stmtExiste->error
    ]);
  }

  $stmtExiste->store_result();

  if ($stmtExiste->num_rows === 0) {
    $stmtExiste->close();
    $mysqli->close();

    jexit(404, [
      "rpta" => false,
      "mensaje" => "El código de barras que intentas editar no existe."
    ]);
  }

  $stmtExiste->close();
}

$mysqli->begin_transaction();

try {
  if ($principal === 1) {
    $sqlQuitarPrincipal = "
      UPDATE ProductosCodigosBarras
      SET
        principal = 0,
        updated_at = NOW()
      WHERE idProducto = ?
    ";

    if ($id > 0) {
      $sqlQuitarPrincipal .= " AND id <> ?";
    }

    $stmtQuitarPrincipal = $mysqli->prepare($sqlQuitarPrincipal);

    if (!$stmtQuitarPrincipal) {
      throw new Exception("Error preparando actualización de principal: " . $mysqli->error);
    }

    if ($id > 0) {
      $stmtQuitarPrincipal->bind_param("ii", $idProducto, $id);
    } else {
      $stmtQuitarPrincipal->bind_param("i", $idProducto);
    }

    if (!$stmtQuitarPrincipal->execute()) {
      throw new Exception("Error actualizando principal: " . $stmtQuitarPrincipal->error);
    }

    $stmtQuitarPrincipal->close();
  }

  if ($estado === 0) {
    $principal = 0;
  }

  if ($id > 0) {
    $sql = "
      UPDATE ProductosCodigosBarras
      SET
        idProducto = ?,
        codigoBarras = ?,
        tipoCodigo = ?,
        principal = ?,
        observacion = ?,
        estado = ?,
        updated_at = NOW()
      WHERE id = ?
    ";

    $stmt = $mysqli->prepare($sql);

    if (!$stmt) {
      throw new Exception("Error preparando actualización de código de barras: " . $mysqli->error);
    }

    $stmt->bind_param(
      "issisii",
      $idProducto,
      $codigoBarras,
      $tipoCodigo,
      $principal,
      $observacion,
      $estado,
      $id
    );

    if (!$stmt->execute()) {
      throw new Exception("Error actualizando código de barras: " . $stmt->error);
    }

    $stmt->close();

    $mysqli->commit();
    $mysqli->close();

    jexit(200, [
      "rpta" => true,
      "mensaje" => "Código de barras actualizado correctamente.",
      "data" => [
        "id" => $id,
        "idProducto" => $idProducto
      ]
    ]);
  }

  $sql = "
    INSERT INTO ProductosCodigosBarras
    (
      idProducto,
      codigoBarras,
      tipoCodigo,
      principal,
      observacion,
      estado,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
  ";

  $stmt = $mysqli->prepare($sql);

  if (!$stmt) {
    throw new Exception("Error preparando registro de código de barras: " . $mysqli->error);
  }

  $stmt->bind_param(
    "issisi",
    $idProducto,
    $codigoBarras,
    $tipoCodigo,
    $principal,
    $observacion,
    $estado
  );

  if (!$stmt->execute()) {
    throw new Exception("Error guardando código de barras: " . $stmt->error);
  }

  $idInsertado = $stmt->insert_id;

  $stmt->close();

  $mysqli->commit();
  $mysqli->close();

  jexit(200, [
    "rpta" => true,
    "mensaje" => "Código de barras guardado correctamente.",
    "data" => [
      "id" => $idInsertado,
      "idProducto" => $idProducto
    ]
  ]);
} catch (Exception $e) {
  $mysqli->rollback();

  $error = $e->getMessage();

  $mysqli->close();

  jexit(500, [
    "rpta" => false,
    "mensaje" => "No se pudo guardar el código de barras.",
    "error" => $error
  ]);
}