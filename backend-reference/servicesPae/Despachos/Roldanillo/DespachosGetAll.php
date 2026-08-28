<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header("Expires: Tue, 01 Jan 2000 00:00:00 GMT");
header("Last-Modified: " . gmdate("D, d M Y H:i:s") . " GMT");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Cache-Control, Pragma, Expires");
header("Access-Control-Max-Age: 0");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit;
}

function jexit($code, $arr){
  http_response_code($code);
  echo json_encode($arr, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
  exit;
}

$mysqli = new mysqli("localhost", "accionpo_pae", "o#Ao0?ZEEec0s).i", "accionpo_pae");

if ($mysqli->connect_errno) {
  jexit(500, [
    "rpta" => "no",
    "mensaje" => "Error BD",
    "error" => $mysqli->connect_error
  ]);
}

$mysqli->set_charset("utf8mb4");

$page        = max(1, (int)($_GET["page"] ?? 1));
$limit       = (int)($_GET["limit"] ?? 20);
$limit       = ($limit <= 0) ? 20 : min($limit, 200);

$q           = trim((string)($_GET["q"] ?? ""));
$idEstado    = (int)($_GET["idEstado"] ?? 0);
$tipoPeriodo = trim((string)($_GET["tipoPeriodo"] ?? ""));
$fechaDesde  = trim((string)($_GET["fechaDesde"] ?? ""));
$fechaHasta  = trim((string)($_GET["fechaHasta"] ?? ""));
$contrato    = trim((string)($_GET["contrato"] ?? ""));

$offset = ($page - 1) * $limit;

$where  = [];
$types  = "";
$params = [];

/* =========================
   SOLO ROLDANILLO
========================= */
$where[] = "COALESCE(d.tipoDespacho, 'CLASICO') = 'ROLDANILLO'";

if ($idEstado > 0) {
  $where[] = "d.idEstado = ?";
  $types .= "i";
  $params[] = $idEstado;
}

if ($tipoPeriodo !== "") {
  $where[] = "d.tipoPeriodo = ?";
  $types .= "s";
  $params[] = $tipoPeriodo;
}

if ($fechaDesde !== "") {
  $where[] = "d.fechaDespacho >= ?";
  $types .= "s";
  $params[] = $fechaDesde;
}

if ($fechaHasta !== "") {
  $where[] = "d.fechaDespacho <= ?";
  $types .= "s";
  $params[] = $fechaHasta;
}

if ($contrato !== "") {
  $where[] = "d.tipoDespacho LIKE ?";
  $types .= "s";
  $params[] = "%" . $contrato . "%";
}

if ($q !== "") {
  $where[] = "(
    d.codigo LIKE ? OR
    d.descripcion LIKE ? OR
    d.contrato LIKE ? OR
    d.tipoDespacho LIKE ? OR
    e.codigo LIKE ? OR
    e.nombre LIKE ?
  )";

  $types .= "sssss";
  $like = "%" . $q . "%";

  $params[] = $like;
  $params[] = $like;
  $params[] = $like;
  $params[] = $like;
  $params[] = $like;
}

$whereSql = "WHERE " . implode(" AND ", $where);

/* =========================
   COUNT
========================= */
$sqlCount = "
  SELECT COUNT(*) AS total
  FROM DespachosInforme d
  LEFT JOIN Estados e ON e.id = d.idEstado
  $whereSql
";

$st = $mysqli->prepare($sqlCount);

if (!$st) {
  jexit(500, [
    "rpta" => "no",
    "mensaje" => "Error prepare COUNT",
    "error" => $mysqli->error
  ]);
}

if ($types !== "") {
  $st->bind_param($types, ...$params);
}

if (!$st->execute()) {
  jexit(500, [
    "rpta" => "no",
    "mensaje" => "Error execute COUNT",
    "error" => $st->error
  ]);
}

$total = 0;
$st->bind_result($totalTmp);

if ($st->fetch()) {
  $total = (int)$totalTmp;
}

$st->close();

$totalPaginas = max(1, (int)ceil($total / $limit));

/* =========================
   LIST
========================= */
$sql = "
  SELECT
    d.id,
    d.idJornada,
    d.codigo,
    d.fechaDespacho,
    d.fechaConsumoDesde,
    d.fechaConsumoHasta,
    d.contrato,
    d.tipoPeriodo,
    d.tipoDespacho,
    d.descripcion,
    d.idEstado,
    d.created_at,
    d.updated_at,

    e.codigo AS estado_codigo,
    e.nombre AS estado_nombre,
    e.descripcion AS estado_descripcion,
    e.estado AS estado_activo

  FROM DespachosInforme d
  LEFT JOIN Estados e ON e.id = d.idEstado

  $whereSql
  ORDER BY d.id DESC
  LIMIT ? OFFSET ?
";

$st = $mysqli->prepare($sql);

if (!$st) {
  jexit(500, [
    "rpta" => "no",
    "mensaje" => "Error prepare LIST",
    "error" => $mysqli->error
  ]);
}

$types2 = $types . "ii";
$params2 = $params;
$params2[] = $limit;
$params2[] = $offset;

$st->bind_param($types2, ...$params2);

if (!$st->execute()) {
  jexit(500, [
    "rpta" => "no",
    "mensaje" => "Error execute LIST",
    "error" => $st->error
  ]);
}

$st->store_result();

$st->bind_result(
  $id,
  $idJornada,
  $codigo,
  $fechaDespacho,
  $fechaConsumoDesde,
  $fechaConsumoHasta,
  $contratoRow,
  $tipoPeriodoRow,
  $tipoDespachoRow,
  $descripcion,
  $idEstadoRow,
  $createdAt,
  $updatedAt,
  $estadoCodigo,
  $estadoNombre,
  $estadoDescripcion,
  $estadoActivo
);

$data = [];

while ($st->fetch()) {
  $data[] = [
    "id" => (int)$id,
    "idJornada" => $idJornada !== null ? (int)$idJornada : null,
    "codigo" => $codigo,

    "fechaDespacho" => $fechaDespacho,
    "fechaConsumoDesde" => $fechaConsumoDesde,
    "fechaConsumoHasta" => $fechaConsumoHasta,

    "contrato" => $contratoRow,
    "tipoPeriodo" => $tipoPeriodoRow,
    "tipoDespacho" => $tipoDespachoRow,
    "descripcion" => $descripcion,

    "estado" => [
      "idEstado" => $idEstadoRow !== null ? (int)$idEstadoRow : null,
      "codigo" => $estadoCodigo,
      "nombre" => $estadoNombre,
      "descripcion" => $estadoDescripcion,
      "activo" => $estadoActivo !== null ? (int)$estadoActivo : null
    ],

    "fechas" => [
      "created_at" => $createdAt,
      "updated_at" => $updatedAt
    ]
  ];
}

$st->close();

jexit(200, [
  "rpta" => "si",
  "mensaje" => "Despachos Roldanillo consultados correctamente",
  "filtros" => [
    "page" => $page,
    "limit" => $limit,
    "tipoDespacho" => "ROLDANILLO",
    "q" => $q,
    "idEstado" => $idEstado > 0 ? $idEstado : null,
    "tipoPeriodo" => $tipoPeriodo !== "" ? $tipoPeriodo : null,
    "fechaDesde" => $fechaDesde !== "" ? $fechaDesde : null,
    "fechaHasta" => $fechaHasta !== "" ? $fechaHasta : null,
    "contrato" => $contrato !== "" ? $contrato : null
  ],
  "paginacion" => [
    "total" => $total,
    "page" => $page,
    "limit" => $limit,
    "totalPages" => $totalPaginas,
    "offset" => $offset
  ],
  "data" => $data
]);