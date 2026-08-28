<?php
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");

ini_set('display_errors', 1);
error_reporting(E_ALL);

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit;
}

function jexit($code, $arr){
  http_response_code($code);
  echo json_encode($arr, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
  exit;
}

function post($key, $default = ""){
  return isset($_POST[$key]) ? trim((string)$_POST[$key]) : $default;
}

function generarCodigoDespacho($mysqli){
  $sql = "SELECT MAX(id) AS max_id FROM DespachosInforme";
  $rs = $mysqli->query($sql);

  if (!$rs) return "DSP-001";

  $row = $rs->fetch_assoc();
  $next = ((int)($row["max_id"] ?? 0)) + 1;

  return "DSP-" . str_pad((string)$next, 3, "0", STR_PAD_LEFT);
}

function validarFecha($fecha){
  if ($fecha === "") return false;
  $d = DateTime::createFromFormat("Y-m-d", $fecha);
  return $d && $d->format("Y-m-d") === $fecha;
}

/* =========================
   DB
========================= */
$mysqli = new mysqli("localhost","accionpo_pae","o#Ao0?ZEEec0s).i","accionpo_pae");
if ($mysqli->connect_errno) {
  jexit(500, [
    "rpta" => "no",
    "mensaje" => "Error BD",
    "error" => $mysqli->connect_error
  ]);
}
$mysqli->set_charset("utf8mb4");

/* =========================
   Validar método
========================= */
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  jexit(405, [
    "rpta" => "no",
    "mensaje" => "Método no permitido"
  ]);
}

/* =========================
   Params
========================= */
$fechaDespacho      = post("fechaDespacho");
$fechaConsumoDesde  = post("fechaConsumoDesde");
$fechaConsumoHasta  = post("fechaConsumoHasta");
$contrato           = mb_strtoupper(post("observacion", ""), "UTF-8");
$tipoPeriodo        = strtoupper(post("tipoPeriodo", "DIARIO"));
$descripcion        = post("descripcion", "");
$idEstado           = (int)post("idEstado", "1");

/* =========================
   Validaciones
========================= */
if ($fechaDespacho === "") {
  jexit(400, [
    "rpta" => "no",
    "mensaje" => "La fechaDespacho es obligatoria"
  ]);
}

if (!validarFecha($fechaDespacho)) {
  jexit(400, [
    "rpta" => "no",
    "mensaje" => "La fechaDespacho no tiene un formato válido"
  ]);
}

if ($fechaConsumoDesde === "") {
  jexit(400, [
    "rpta" => "no",
    "mensaje" => "La fechaConsumoDesde es obligatoria"
  ]);
}

if (!validarFecha($fechaConsumoDesde)) {
  jexit(400, [
    "rpta" => "no",
    "mensaje" => "La fechaConsumoDesde no tiene un formato válido"
  ]);
}

if ($fechaConsumoHasta === "") {
  jexit(400, [
    "rpta" => "no",
    "mensaje" => "La fechaConsumoHasta es obligatoria"
  ]);
}

if (!validarFecha($fechaConsumoHasta)) {
  jexit(400, [
    "rpta" => "no",
    "mensaje" => "La fechaConsumoHasta no tiene un formato válido"
  ]);
}

if ($fechaConsumoDesde > $fechaConsumoHasta) {
  jexit(400, [
    "rpta" => "no",
    "mensaje" => "La fechaConsumoDesde no puede ser mayor que la fechaConsumoHasta"
  ]);
}

if ($contrato === "") {
  jexit(400, [
    "rpta" => "no",
    "mensaje" => "El contrato es obligatorio"
  ]);
}

if (!in_array($tipoPeriodo, ["DIARIO", "SEMANAL", "MENSUAL"])) {
  jexit(400, [
    "rpta" => "no",
    "mensaje" => "El tipoPeriodo no es válido"
  ]);
}

if ($idEstado <= 0) {
  jexit(400, [
    "rpta" => "no",
    "mensaje" => "El idEstado es obligatorio"
  ]);
}

/* =========================
   Validar estado existente
========================= */
$sqlEstado = "SELECT id FROM Estados WHERE id = ? LIMIT 1";
$st = $mysqli->prepare($sqlEstado);
if (!$st) {
  jexit(500, [
    "rpta" => "no",
    "mensaje" => "Error prepare estado",
    "error" => $mysqli->error
  ]);
}

$st->bind_param("i", $idEstado);
$st->execute();
$st->store_result();

if ($st->num_rows === 0) {
  $st->close();
  jexit(400, [
    "rpta" => "no",
    "mensaje" => "El estado indicado no existe"
  ]);
}
$st->close();

/* =========================
   Crear despacho
========================= */
$codigo = generarCodigoDespacho($mysqli);

$mysqli->begin_transaction();

try {
  $sql = "
    INSERT INTO DespachosInforme
    (
      idJornada,
      codigo,
      fechaDespacho,
      fechaConsumoDesde,
      fechaConsumoHasta,
      contrato,
      tipoPeriodo,
      descripcion,
      idEstado
    )
    VALUES
    (
      NULL,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?,
      ?
    )
  ";

  $st = $mysqli->prepare($sql);
  if (!$st) {
    throw new Exception("Error prepare INSERT despacho: " . $mysqli->error);
  }

  $st->bind_param(
    "sssssssi",
    $codigo,
    $fechaDespacho,
    $fechaConsumoDesde,
    $fechaConsumoHasta,
    $contrato,
    $tipoPeriodo,
    $descripcion,
    $idEstado
  );

  if (!$st->execute()) {
    throw new Exception("Error execute INSERT despacho: " . $st->error);
  }

  $idDespacho = (int)$mysqli->insert_id;
  $st->close();

  $mysqli->commit();

  jexit(200, [
    "rpta" => "si",
    "mensaje" => "Despacho creado correctamente",
    "data" => [
      "idDespacho" => $idDespacho,
      "codigo" => $codigo,
      "fechaDespacho" => $fechaDespacho,
      "fechaConsumoDesde" => $fechaConsumoDesde,
      "fechaConsumoHasta" => $fechaConsumoHasta,
      "contrato" => $contrato,
      "tipoPeriodo" => $tipoPeriodo,
      "descripcion" => $descripcion,
      "idEstado" => $idEstado
    ]
  ]);

} catch (Exception $e) {
  $mysqli->rollback();

  jexit(500, [
    "rpta" => "no",
    "mensaje" => "No se pudo crear el despacho",
    "error" => $e->getMessage()
  ]);
}