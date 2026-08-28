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

$id = (int)val($data, "id", 0);
$idProducto = (int)val($data, "idProducto", 0);
$codigoBarras = val($data, "codigoBarras", "");
$tipoCodigo = strtoupper(val($data, "tipoCodigo", "UNIDAD"));
$principal = bit_val($data, "principal", 0);
$observacion = val($data, "observacion", "");
$estado = bit_val($data, "estado", 1);

if ($idProducto <= 0) {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El producto es obligatorio."
  ]);
}

if ($codigoBarras === "") {
  jexit(400, [
    "rpta" => false,
    "mensaje" => "El código de barras es obligatorio."
  ]);
}

if ($tipoCodigo === "") {
  $tipoCodigo = "UNIDAD";
}

$codigoBarras = preg_replace('/\s+/', '', $codigoBarras);
$tipoCodigo = preg_replace('/\s+/', '_', $tipoCodigo);

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

if ($id > 0) {
  $sqlCheck = "
    SELECT id
    FROM ProductosCodigosBarras
    WHERE codigoBarras = ?
      AND id <> ?
    LIMIT 1
  ";

  $stmtCheck = $mysqli->prepare($sqlCheck);

  if (!$stmtCheck) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error preparando validación de código de barras.",
      "error" => $mysqli->error
    ]);
  }

  $stmtCheck->bind_param("si", $codigoBarras, $id);

  if (!$stmtCheck->execute()) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error ejecutando validación de código de barras.",
      "error" => $stmtCheck->error
    ]);
  }

  $existe = stmt_fetch_one_assoc($stmtCheck);
  $stmtCheck->close();

  if ($existe) {
    jexit(409, [
      "rpta" => false,
      "mensaje" => "Ya existe otro registro con este código de barras."
    ]);
  }

  if ($principal === 1) {
    $sqlPrincipal = "
      UPDATE ProductosCodigosBarras
      SET principal = 0
      WHERE idProducto = ?
        AND id <> ?
    ";

    $stmtPrincipal = $mysqli->prepare($sqlPrincipal);

    if (!$stmtPrincipal) {
      jexit(500, [
        "rpta" => false,
        "mensaje" => "Error preparando actualización de código principal.",
        "error" => $mysqli->error
      ]);
    }

    $stmtPrincipal->bind_param("ii", $idProducto, $id);

    if (!$stmtPrincipal->execute()) {
      jexit(500, [
        "rpta" => false,
        "mensaje" => "Error actualizando código principal.",
        "error" => $stmtPrincipal->error
      ]);
    }

    $stmtPrincipal->close();
  }

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
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error preparando actualización de código de barras.",
      "error" => $mysqli->error
    ]);
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
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error actualizando código de barras.",
      "error" => $stmt->error
    ]);
  }

  $stmt->close();

  $mensaje = "Código de barras actualizado correctamente.";

} else {
  $sqlCheck = "
    SELECT id
    FROM ProductosCodigosBarras
    WHERE codigoBarras = ?
    LIMIT 1
  ";

  $stmtCheck = $mysqli->prepare($sqlCheck);

  if (!$stmtCheck) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error preparando validación de código de barras.",
      "error" => $mysqli->error
    ]);
  }

  $stmtCheck->bind_param("s", $codigoBarras);

  if (!$stmtCheck->execute()) {
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error ejecutando validación de código de barras.",
      "error" => $stmtCheck->error
    ]);
  }

  $existe = stmt_fetch_one_assoc($stmtCheck);
  $stmtCheck->close();

  if ($existe) {
    jexit(409, [
      "rpta" => false,
      "mensaje" => "Ya existe un registro con este código de barras."
    ]);
  }

  if ($principal === 1) {
    $sqlPrincipal = "
      UPDATE ProductosCodigosBarras
      SET principal = 0
      WHERE idProducto = ?
    ";

    $stmtPrincipal = $mysqli->prepare($sqlPrincipal);

    if (!$stmtPrincipal) {
      jexit(500, [
        "rpta" => false,
        "mensaje" => "Error preparando actualización de código principal.",
        "error" => $mysqli->error
      ]);
    }

    $stmtPrincipal->bind_param("i", $idProducto);

    if (!$stmtPrincipal->execute()) {
      jexit(500, [
        "rpta" => false,
        "mensaje" => "Error actualizando código principal.",
        "error" => $stmtPrincipal->error
      ]);
    }

    $stmtPrincipal->close();
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
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error preparando creación de código de barras.",
      "error" => $mysqli->error
    ]);
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
    jexit(500, [
      "rpta" => false,
      "mensaje" => "Error creando código de barras.",
      "error" => $stmt->error
    ]);
  }

  $id = $stmt->insert_id;
  $stmt->close();

  $mensaje = "Código de barras creado correctamente.";
}

$sqlGet = "
  SELECT
    cb.id,
    cb.idProducto,
    p.codigo AS codigoProducto,
    p.descripcion AS descripcionProducto,
    cb.codigoBarras,
    cb.tipoCodigo,
    cb.principal,
    cb.observacion,
    cb.estado,
    cb.created_at,
    cb.updated_at
  FROM ProductosCodigosBarras cb
  INNER JOIN ProductosCatalogo p ON p.id = cb.idProducto
  WHERE cb.id = ?
  LIMIT 1
";

$stmtGet = $mysqli->prepare($sqlGet);

if (!$stmtGet) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Código guardado, pero no se pudo consultar el registro.",
    "error" => $mysqli->error
  ]);
}

$stmtGet->bind_param("i", $id);

if (!$stmtGet->execute()) {
  jexit(500, [
    "rpta" => false,
    "mensaje" => "Código guardado, pero ocurrió un error consultando el registro.",
    "error" => $stmtGet->error
  ]);
}

$row = stmt_fetch_one_assoc($stmtGet);
$stmtGet->close();

if ($row) {
  $row["id"] = (int)$row["id"];
  $row["idProducto"] = (int)$row["idProducto"];
  $row["principal"] = (int)$row["principal"];
  $row["estado"] = (int)$row["estado"];
}

$mysqli->close();

jexit(200, [
  "rpta" => true,
  "mensaje" => $mensaje,
  "data" => $row
]);