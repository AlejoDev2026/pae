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

function responder($rpta, $mensaje, $extra = [], $code = 200) {
    http_response_code($code);

    echo json_encode(array_merge([
        "rpta" => $rpta,
        "mensaje" => $mensaje
    ], $extra), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

    exit;
}

if (!isset($conexion) || !$conexion instanceof mysqli) {
    responder("no", "No se encontró la conexión a la base de datos", [
        "error" => "Variable \$conexion no disponible"
    ], 500);
}

$conexion->set_charset("utf8mb4");

function inputData() {
    $json = json_decode(file_get_contents("php://input"), true);

    if (is_array($json)) {
        return array_merge($_POST, $json);
    }

    return $_POST;
}

function val($data, $key, $default = "") {
    return isset($data[$key]) ? trim((string)$data[$key]) : $default;
}

function intValCampo($data, $key, $default = 0) {
    if (!isset($data[$key])) return $default;

    $v = strtolower(trim((string)$data[$key]));

    if ($v === "true" || $v === "si" || $v === "sí" || $v === "activo" || $v === "activa") {
        return 1;
    }

    if ($v === "false" || $v === "no" || $v === "inactivo" || $v === "inactiva") {
        return 0;
    }

    return intval($data[$key]);
}

function bindParams($stmt, $types, &$params) {
    if (count($params) === 0) return;

    $refs = [];
    $refs[] = $types;

    foreach ($params as $key => $value) {
        $refs[] = &$params[$key];
    }

    call_user_func_array([$stmt, "bind_param"], $refs);
}

function columnasTabla($conexion, $tabla) {
    $cols = [];
    $res = $conexion->query("SHOW COLUMNS FROM `$tabla`");

    if (!$res) {
        responder("no", "No se pudo leer la estructura de la tabla $tabla", [
            "error" => $conexion->error
        ], 500);
    }

    while ($row = $res->fetch_assoc()) {
        $cols[$row["Field"]] = $row;
    }

    return $cols;
}

function tieneColumna($cols, $nombre) {
    return array_key_exists($nombre, $cols);
}

function tipoColumna($cols, $nombre) {
    return isset($cols[$nombre]["Type"]) ? strtolower($cols[$nombre]["Type"]) : "";
}

function columnaEsNumerica($cols, $nombre) {
    $tipo = tipoColumna($cols, $nombre);

    return strpos($tipo, "int") !== false ||
           strpos($tipo, "decimal") !== false ||
           strpos($tipo, "double") !== false ||
           strpos($tipo, "float") !== false;
}

function estadoTexto($valor) {
    $v = strtolower(trim((string)$valor));

    if ($v === "0" || $v === "2" || $v === "inactivo" || $v === "inactiva" || $v === "false") {
        return "Inactivo";
    }

    return "Activo";
}

function estadoNumero($valor) {
    return estadoTexto($valor) === "Activo" ? 1 : 0;
}

function normalizarTextoDocumento($valor) {
    $valor = strtoupper(trim((string)$valor));

    $reemplazos = [
        "Á" => "A",
        "É" => "E",
        "Í" => "I",
        "Ó" => "O",
        "Ú" => "U",
        "Ü" => "U",
        "Ñ" => "N",
    ];

    return strtr($valor, $reemplazos);
}

function naturalezaDocumentoNormalizada($naturaleza) {
    $texto = normalizarTextoDocumento($naturaleza);

    if (
        strpos($texto, "SALIDA") !== false ||
        $texto === "SAL" ||
        $texto === "SALIDA_INVENTARIO" ||
        $texto === "SALIDA INVENTARIO"
    ) {
        return "SALIDA";
    }

    if (
        strpos($texto, "ENTRADA") !== false ||
        $texto === "ENT" ||
        $texto === "ENTRADA_INVENTARIO" ||
        $texto === "ENTRADA INVENTARIO"
    ) {
        return "ENTRADA";
    }

    if (
        strpos($texto, "TRASLADO") !== false ||
        strpos($texto, "TRANSFERENCIA") !== false
    ) {
        return "TRASLADO";
    }

    if (strpos($texto, "AJUSTE") !== false) {
        return "AJUSTE";
    }

    if (
        strpos($texto, "INICIAL") !== false ||
        strpos($texto, "APERTURA") !== false
    ) {
        return "INVENTARIO_INICIAL";
    }

    return $texto;
}

function esNaturalezaSalidaInventario($naturaleza) {
    return naturalezaDocumentoNormalizada($naturaleza) === "SALIDA";
}

function calcularPermiteLoteVencido($naturaleza, $codigo, $nombre, $descripcion = "") {
    if (!esNaturalezaSalidaInventario($naturaleza)) {
        return 0;
    }

    $texto = normalizarTextoDocumento($codigo . " " . $nombre . " " . $descripcion);

    $palabrasPermitenVencidos = [
        "BAJA",
        "MERMA",
        "DETERIORO",
        "VENCIMIENTO",
        "VENCIDO",
        "VENCIDA",
        "VENC",
        "CADUCIDAD",
        "CADUCADO",
        "CADUCADA",
        "PERDIDA",
        "PERDIDAS",
        "DANO",
        "DANADO",
        "DANADA",
        "AVERIA",
        "AVERIADO",
        "AVERIADA"
    ];

    foreach ($palabrasPermitenVencidos as $palabra) {
        if (strpos($texto, $palabra) !== false) {
            return 1;
        }
    }

    return 0;
}

$tabla = "TiposDocumentoInventario";

/* ============================================================
   VALIDAR TABLA
============================================================ */

$resTabla = $conexion->query("SHOW TABLES LIKE '$tabla'");

if (!$resTabla || $resTabla->num_rows === 0) {
    responder("no", "La tabla $tabla no existe en la base de datos", [
        "error" => $conexion->error
    ], 500);
}

$cols = columnasTabla($conexion, $tabla);
$data = inputData();

/* ============================================================
   CAMPO ID
============================================================ */

$campoId = "";

if (tieneColumna($cols, "idTipoDocumento")) {
    $campoId = "idTipoDocumento";
} elseif (tieneColumna($cols, "id")) {
    $campoId = "id";
}

if ($campoId === "") {
    responder("no", "La tabla $tabla no tiene columna idTipoDocumento ni id", [], 500);
}

/* ============================================================
   DATOS RECIBIDOS
============================================================ */

$id = intval(val($data, "idTipoDocumento", val($data, "id", "0")));

$codigo = strtoupper(val($data, "codigo"));
$nombre = strtoupper(val($data, "nombre"));
$descripcion = val($data, "descripcion");

$naturaleza = naturalezaDocumentoNormalizada(val($data, "naturaleza", "ENTRADA"));
$tipoMovimiento = naturalezaDocumentoNormalizada(val($data, "tipoMovimiento", $naturaleza));

$afectaInventario = intValCampo($data, "afectaInventario", 1);
$requiereOrigen = intValCampo($data, "requiereOrigen", 0);
$requiereDestino = intValCampo($data, "requiereDestino", 0);
$permiteManual = intValCampo($data, "permiteManual", 1);

/*
   Campo interno para módulo Salidas:
   - No depende de la pantalla.
   - Se calcula automáticamente al crear/editar según naturaleza + código/nombre/descripción.
   - Solo aplica para naturaleza SALIDA.
   - BAJA / MERMA / DETERIORO / VENCIMIENTO / CADUCIDAD permiten lotes vencidos.
*/
$permiteLoteVencido = calcularPermiteLoteVencido(
    $naturaleza,
    $codigo,
    $nombre,
    $descripcion
);

$estadoRecibido = val($data, "estado", "1");

if ($codigo === "") {
    responder("no", "El código del tipo de documento es obligatorio", [], 400);
}

if ($nombre === "") {
    responder("no", "El nombre del tipo de documento es obligatorio", [], 400);
}

/* ============================================================
   VALIDAR DUPLICADO SIN get_result()
============================================================ */

if (tieneColumna($cols, "codigo")) {
    $sqlDup = "SELECT `$campoId` FROM `$tabla` WHERE `codigo` = ?";

    $paramsDup = [$codigo];
    $typesDup = "s";

    if ($id > 0) {
        $sqlDup .= " AND `$campoId` <> ?";
        $paramsDup[] = $id;
        $typesDup .= "i";
    }

    $sqlDup .= " LIMIT 1";

    $stmtDup = $conexion->prepare($sqlDup);

    if (!$stmtDup) {
        responder("no", "Error preparando validación de duplicado", [
            "error" => $conexion->error
        ], 500);
    }

    bindParams($stmtDup, $typesDup, $paramsDup);

    if (!$stmtDup->execute()) {
        responder("no", "Error ejecutando validación de duplicado", [
            "error" => $stmtDup->error
        ], 500);
    }

    $idDuplicado = null;
    $stmtDup->bind_result($idDuplicado);

    if ($stmtDup->fetch()) {
        $stmtDup->close();

        responder("no", "Ya existe un tipo de documento con ese código", [
            "idDuplicado" => $idDuplicado
        ], 409);
    }

    $stmtDup->close();
}

/* ============================================================
   CAMPOS PERMITIDOS
============================================================ */

$camposPermitidos = [
    "codigo" => $codigo,
    "nombre" => $nombre,
    "descripcion" => $descripcion,
    "naturaleza" => $naturaleza,
    "tipoMovimiento" => $tipoMovimiento,
    "afectaInventario" => $afectaInventario,
    "requiereOrigen" => $requiereOrigen,
    "requiereDestino" => $requiereDestino,
    "permiteManual" => $permiteManual,
    "permiteLoteVencido" => $permiteLoteVencido,
];

/* ============================================================
   VALOR DE ESTADO SEGÚN ESTRUCTURA
============================================================ */

$campoEstado = "";

if (tieneColumna($cols, "estado")) {
    $campoEstado = "estado";
} elseif (tieneColumna($cols, "idEstado")) {
    $campoEstado = "idEstado";
}

$valorEstado = null;
$tipoEstado = "";

if ($campoEstado === "estado") {
    if (columnaEsNumerica($cols, "estado")) {
        $valorEstado = estadoNumero($estadoRecibido);
        $tipoEstado = "i";
    } else {
        $valorEstado = estadoTexto($estadoRecibido);
        $tipoEstado = "s";
    }
}

if ($campoEstado === "idEstado") {
    $valorEstado = estadoNumero($estadoRecibido) === 1 ? 1 : 2;
    $tipoEstado = "i";
}

/* ============================================================
   ACTUALIZAR
============================================================ */

if ($id > 0) {
    $sets = [];
    $params = [];
    $types = "";

    foreach ($camposPermitidos as $campo => $valor) {
        if (tieneColumna($cols, $campo)) {
            $sets[] = "`$campo` = ?";
            $params[] = $valor;
            $types .= is_int($valor) ? "i" : "s";
        }
    }

    if ($campoEstado !== "") {
        $sets[] = "`$campoEstado` = ?";
        $params[] = $valorEstado;
        $types .= $tipoEstado;
    }

    if (tieneColumna($cols, "updated_at")) {
        $sets[] = "`updated_at` = NOW()";
    }

    if (tieneColumna($cols, "fechaActualizacion")) {
        $sets[] = "`fechaActualizacion` = NOW()";
    }

    if (count($sets) === 0) {
        responder("no", "No hay columnas válidas para actualizar", [], 500);
    }

    $params[] = $id;
    $types .= "i";

    $sql = "UPDATE `$tabla` SET " . implode(", ", $sets) . " WHERE `$campoId` = ?";

    $stmt = $conexion->prepare($sql);

    if (!$stmt) {
        responder("no", "Error preparando actualización", [
            "error" => $conexion->error,
            "sql" => $sql
        ], 500);
    }

    bindParams($stmt, $types, $params);

    if (!$stmt->execute()) {
        responder("no", "Error actualizando el tipo de documento", [
            "error" => $stmt->error,
            "sql" => $sql
        ], 500);
    }

    $stmt->close();

    responder("si", "Tipo de documento actualizado correctamente", [
        "id" => $id,
        "idTipoDocumento" => $id,
        "naturaleza" => $naturaleza,
        "tipoMovimiento" => $tipoMovimiento,
        "permiteLoteVencido" => $permiteLoteVencido
    ]);
}

/* ============================================================
   INSERTAR
============================================================ */

$insertCampos = [];
$placeholders = [];
$params = [];
$types = "";

foreach ($camposPermitidos as $campo => $valor) {
    if (tieneColumna($cols, $campo)) {
        $insertCampos[] = "`$campo`";
        $placeholders[] = "?";
        $params[] = $valor;
        $types .= is_int($valor) ? "i" : "s";
    }
}

if ($campoEstado !== "") {
    $insertCampos[] = "`$campoEstado`";
    $placeholders[] = "?";
    $params[] = $valorEstado;
    $types .= $tipoEstado;
}

if (tieneColumna($cols, "created_at")) {
    $insertCampos[] = "`created_at`";
    $placeholders[] = "NOW()";
}

if (tieneColumna($cols, "updated_at")) {
    $insertCampos[] = "`updated_at`";
    $placeholders[] = "NOW()";
}

if (tieneColumna($cols, "fechaCreacion")) {
    $insertCampos[] = "`fechaCreacion`";
    $placeholders[] = "NOW()";
}

if (tieneColumna($cols, "fechaActualizacion")) {
    $insertCampos[] = "`fechaActualizacion`";
    $placeholders[] = "NOW()";
}

if (count($insertCampos) === 0) {
    responder("no", "No hay columnas válidas para insertar", [], 500);
}

$sql = "INSERT INTO `$tabla` (" . implode(", ", $insertCampos) . ") 
        VALUES (" . implode(", ", $placeholders) . ")";

$stmt = $conexion->prepare($sql);

if (!$stmt) {
    responder("no", "Error preparando inserción", [
        "error" => $conexion->error,
        "sql" => $sql
    ], 500);
}

bindParams($stmt, $types, $params);

if (!$stmt->execute()) {
    responder("no", "Error guardando el tipo de documento", [
        "error" => $stmt->error,
        "sql" => $sql
    ], 500);
}

$idInsertado = $stmt->insert_id;
$stmt->close();

responder("si", "Tipo de documento creado correctamente", [
    "id" => $idInsertado,
    "idTipoDocumento" => $idInsertado,
    "naturaleza" => $naturaleza,
    "tipoMovimiento" => $tipoMovimiento,
    "permiteLoteVencido" => $permiteLoteVencido
]);
?>