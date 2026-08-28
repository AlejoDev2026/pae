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

require_once __DIR__ . "/../conexion.php";

function responder($rpta, $mensaje, $data = [], $extra = []) {
    echo json_encode(array_merge([
        "rpta" => $rpta,
        "mensaje" => $mensaje,
        "data" => $data
    ], $extra), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

if (!isset($conexion) || !$conexion instanceof mysqli) {
    responder("no", "No se encontró la conexión a la base de datos", [], [
        "error" => "Variable \$conexion no disponible"
    ]);
}

$conexion->set_charset("utf8mb4");

$tabla = "TiposDocumentoInventario";

/* ============================================================
   VALIDAR TABLA
============================================================ */

$existeTabla = false;
$resTabla = $conexion->query("SHOW TABLES LIKE '$tabla'");

if ($resTabla && $resTabla->num_rows > 0) {
    $existeTabla = true;
}

if (!$existeTabla) {
    responder("no", "La tabla $tabla no existe en la base de datos", [], [
        "error" => $conexion->error
    ]);
}

/* ============================================================
   OBTENER COLUMNAS
============================================================ */

$columnas = [];
$resColumnas = $conexion->query("SHOW COLUMNS FROM `$tabla`");

if (!$resColumnas) {
    responder("no", "No se pudieron consultar las columnas de la tabla", [], [
        "error" => $conexion->error
    ]);
}

while ($col = $resColumnas->fetch_assoc()) {
    $columnas[] = $col["Field"];
}

function tieneColumna($columnas, $campo) {
    return in_array($campo, $columnas);
}

$campoId = tieneColumna($columnas, "idTipoDocumento")
    ? "idTipoDocumento"
    : (tieneColumna($columnas, "id") ? "id" : "");

if ($campoId === "") {
    responder("no", "La tabla no tiene columna idTipoDocumento ni id");
}

/* ============================================================
   SELECT DINÁMICO
============================================================ */

$select = [];

$select[] = "`$campoId` AS idTipoDocumento";
$select[] = "`$campoId` AS id";

$select[] = tieneColumna($columnas, "codigo")
    ? "`codigo`"
    : "'' AS codigo";

$select[] = tieneColumna($columnas, "nombre")
    ? "`nombre`"
    : "'' AS nombre";

$select[] = tieneColumna($columnas, "descripcion")
    ? "`descripcion`"
    : "'' AS descripcion";

$select[] = tieneColumna($columnas, "naturaleza")
    ? "`naturaleza`"
    : "'' AS naturaleza";

$select[] = tieneColumna($columnas, "tipoMovimiento")
    ? "`tipoMovimiento`"
    : "'' AS tipoMovimiento";

$select[] = tieneColumna($columnas, "afectaInventario")
    ? "`afectaInventario`"
    : "1 AS afectaInventario";

$select[] = tieneColumna($columnas, "requiereOrigen")
    ? "`requiereOrigen`"
    : "0 AS requiereOrigen";

$select[] = tieneColumna($columnas, "requiereDestino")
    ? "`requiereDestino`"
    : "0 AS requiereDestino";

$select[] = tieneColumna($columnas, "permiteManual")
    ? "`permiteManual`"
    : "1 AS permiteManual";

if (tieneColumna($columnas, "estado")) {
    $select[] = "`estado`";
} elseif (tieneColumna($columnas, "idEstado")) {
    $select[] = "`idEstado` AS estado";
} else {
    $select[] = "1 AS estado";
}

if (tieneColumna($columnas, "created_at")) {
    $select[] = "`created_at`";
} else {
    $select[] = "NULL AS created_at";
}

if (tieneColumna($columnas, "updated_at")) {
    $select[] = "`updated_at`";
} else {
    $select[] = "NULL AS updated_at";
}

/* ============================================================
   FILTROS
============================================================ */

$id = isset($_GET["id"]) ? intval($_GET["id"]) : 0;
$q = isset($_GET["q"]) ? trim($_GET["q"]) : "";

$where = " WHERE 1=1 ";

if ($id > 0) {
    $where .= " AND `$campoId` = $id ";
}

if ($q !== "") {
    $qSeguro = $conexion->real_escape_string($q);

    $condicionesBusqueda = [];

    if (tieneColumna($columnas, "codigo")) {
        $condicionesBusqueda[] = "`codigo` LIKE '%$qSeguro%'";
    }

    if (tieneColumna($columnas, "nombre")) {
        $condicionesBusqueda[] = "`nombre` LIKE '%$qSeguro%'";
    }

    if (tieneColumna($columnas, "descripcion")) {
        $condicionesBusqueda[] = "`descripcion` LIKE '%$qSeguro%'";
    }

    if (tieneColumna($columnas, "naturaleza")) {
        $condicionesBusqueda[] = "`naturaleza` LIKE '%$qSeguro%'";
    }

    if (tieneColumna($columnas, "tipoMovimiento")) {
        $condicionesBusqueda[] = "`tipoMovimiento` LIKE '%$qSeguro%'";
    }

    if (count($condicionesBusqueda) > 0) {
        $where .= " AND (" . implode(" OR ", $condicionesBusqueda) . ") ";
    }
}

/* ============================================================
   ORDEN
============================================================ */

$orderBy = " ORDER BY ";

if (tieneColumna($columnas, "nombre")) {
    $orderBy .= "`nombre` ASC";
} elseif (tieneColumna($columnas, "codigo")) {
    $orderBy .= "`codigo` ASC";
} else {
    $orderBy .= "`$campoId` DESC";
}

/* ============================================================
   CONSULTA
============================================================ */

$sql = "
    SELECT 
        " . implode(", ", $select) . "
    FROM `$tabla`
    $where
    $orderBy
";

$res = $conexion->query($sql);

if (!$res) {
    responder("no", "Error consultando los tipos de documento", [], [
        "error" => $conexion->error,
        "sql" => $sql
    ]);
}

$data = [];

while ($row = $res->fetch_assoc()) {
    $estadoOriginal = $row["estado"];

    $estadoTexto = "Activo";
    $estadoNumero = 1;

    $estadoNormalizado = strtolower(trim((string)$estadoOriginal));

    if (
        $estadoNormalizado === "0" ||
        $estadoNormalizado === "2" ||
        $estadoNormalizado === "inactivo" ||
        $estadoNormalizado === "inactiva" ||
        $estadoNormalizado === "false"
    ) {
        $estadoTexto = "Inactivo";
        $estadoNumero = 0;
    }

    $row["estado"] = $estadoNumero;
    $row["estadoTexto"] = $estadoTexto;

    $row["afectaInventario"] = intval($row["afectaInventario"] ?? 1);
    $row["requiereOrigen"] = intval($row["requiereOrigen"] ?? 0);
    $row["requiereDestino"] = intval($row["requiereDestino"] ?? 0);
    $row["permiteManual"] = intval($row["permiteManual"] ?? 1);

    $data[] = $row;
}

responder("si", "Tipos de documento consultados correctamente", $data);
?>