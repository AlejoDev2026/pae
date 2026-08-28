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
header("Access-Control-Allow-Headers: Content-Type, Cache-Control, Pragma, Expires, Authorization");
header("Access-Control-Max-Age: 0");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

require_once __DIR__ . "/../conexion.php";

if (!isset($conexion) || !$conexion instanceof mysqli) {
    http_response_code(500);
    echo json_encode([
        "rpta" => "no",
        "mensaje" => "No se encontró la conexión a la base de datos",
        "data" => [],
        "error" => "La variable \$conexion no está disponible"
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

$conexion->set_charset("utf8mb4");

function tr_responder($rpta, $mensaje, $data = [], $extra = [], $codigoHttp = 200) {
    http_response_code($codigoHttp);
    echo json_encode(array_merge([
        "rpta" => $rpta,
        "mensaje" => $mensaje,
        "data" => $data
    ], $extra), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function tr_limpiar($v) { return trim((string)($v ?? "")); }
function tr_parametro($k, $d = "") { return isset($_GET[$k]) ? tr_limpiar($_GET[$k]) : (isset($_POST[$k]) ? tr_limpiar($_POST[$k]) : $d); }
function tr_json() { $j = json_decode(file_get_contents("php://input"), true); return is_array($j) ? $j : []; }
function tr_esc($v) { global $conexion; return $conexion->real_escape_string((string)($v ?? "")); }
function tr_fecha($v) { $v = tr_limpiar($v); return $v === "" ? "NULL" : "'" . tr_esc($v) . "'"; }
function tr_texto($v) { $v = tr_limpiar($v); return $v === "" ? "NULL" : "'" . tr_esc($v) . "'"; }
function tr_int_null($v) { $v = intval($v ?? 0); return $v > 0 ? (string)$v : "NULL"; }
function tr_dec($v) { return round(floatval(str_replace(",", ".", (string)($v ?? 0))), 3); }

function tr_fila($sql) {
    global $conexion;
    $res = $conexion->query($sql);
    if (!$res) throw new Exception($conexion->error);
    return $res->fetch_assoc() ?: null;
}

function tr_filas($sql) {
    global $conexion;
    $res = $conexion->query($sql);
    if (!$res) throw new Exception($conexion->error);
    $data = [];
    while ($row = $res->fetch_assoc()) $data[] = $row;
    return $data;
}

function tr_valor($sql, $default = 0) {
    global $conexion;
    $res = $conexion->query($sql);
    if (!$res) throw new Exception($conexion->error);
    $row = $res->fetch_row();
    return $row ? $row[0] : $default;
}

function tr_normalizar($v) {
    $v = strtoupper(trim((string)$v));
    return strtr($v, ["Á"=>"A", "É"=>"E", "Í"=>"I", "Ó"=>"O", "Ú"=>"U", "Ü"=>"U", "Ñ"=>"N"]);
}

function tr_nat($v) {
    $t = tr_normalizar($v);
    if ($t === "TRA" || strpos($t, "TRASLADO") !== false || strpos($t, "TRANSFERENCIA") !== false) return "TRASLADO";
    if ($t === "SAL" || strpos($t, "SALIDA") !== false) return "SALIDA";
    if ($t === "ENT" || strpos($t, "ENTRADA") !== false) return "ENTRADA";
    if (strpos($t, "AJUSTE") !== false) return "AJUSTE";
    if (strpos($t, "INICIAL") !== false || strpos($t, "APERTURA") !== false) return "INVENTARIO_INICIAL";
    return $t;
}

function tr_es_traslado($naturaleza, $tipoMovimiento = "") {
    return tr_nat($naturaleza) === "TRASLADO" || tr_nat($tipoMovimiento) === "TRASLADO";
}

function tr_lote_vencido($fecha) {
    $fecha = tr_limpiar($fecha);
    if ($fecha === "" || $fecha === "0000-00-00") return false;
    return substr($fecha, 0, 10) < date("Y-m-d");
}

function tr_consecutivo() {
    $prefijo = "TRA-" . date("Ymd") . "-";
    $row = tr_fila("SELECT consecutivo FROM InventarioDocumentos WHERE consecutivo LIKE '" . tr_esc($prefijo) . "%' ORDER BY id DESC LIMIT 1");
    $n = 1;
    if ($row && !empty($row["consecutivo"])) {
        $p = explode("-", $row["consecutivo"]);
        $n = intval(end($p)) + 1;
    }
    return $prefijo . str_pad((string)$n, 6, "0", STR_PAD_LEFT);
}

function tr_operador_usuario($idUsuario) {
    if ($idUsuario <= 0) return null;
    return tr_fila("SELECT io.id AS idOperador, io.idUsuario, io.codigo, io.nombre, io.apellido, io.nombreCompleto, io.cargo, io.estado AS estadoOperador, u.estado AS estadoUsuario
        FROM InventarioOperadores io INNER JOIN usuarios u ON u.id = io.idUsuario
        WHERE io.idUsuario = $idUsuario AND io.estado = 1 AND u.estado = 1 LIMIT 1");
}

function tr_tipo_documento($idTipoDocumento) {
    return tr_fila("SELECT id, codigo, nombre, naturaleza, tipoMovimiento, afectaInventario, requiereOrigen, requiereDestino, permiteManual, descripcion, estado
        FROM TiposDocumentoInventario WHERE id = $idTipoDocumento LIMIT 1");
}

function tr_validar_tipo_documento($idTipoDocumento) {
    if ($idTipoDocumento <= 0) throw new Exception("Debe seleccionar el tipo de traslado");
    $tipo = tr_tipo_documento($idTipoDocumento);
    if (!$tipo) throw new Exception("El tipo de documento de traslado no existe");
    if (intval($tipo["estado"]) !== 1) throw new Exception("El tipo de documento de traslado está inactivo");
    if (intval($tipo["afectaInventario"]) !== 1) throw new Exception("El tipo de documento de traslado debe afectar inventario");
    if (!tr_es_traslado($tipo["naturaleza"], $tipo["tipoMovimiento"])) throw new Exception("El tipo de documento seleccionado no corresponde a un traslado de inventario");
    return $tipo;
}

function tr_producto($idProducto) {
    return tr_fila("SELECT pc.id, pc.codigo, pc.descripcion, pic.manejaLote, pic.manejaVencimiento, pic.unidadBaseInventario, pic.estado AS estadoInventario
        FROM ProductosCatalogo pc INNER JOIN ProductosInventarioConfig pic ON pic.idProducto = pc.id
        WHERE pc.id = $idProducto AND pc.estado = 1 AND COALESCE(pc.idEstado, 1) = 1 AND pic.estado = 1 LIMIT 1");
}

function tr_bodega($id) {
    return tr_fila("SELECT id, codigo, nombre FROM BodegasInventario WHERE id = $id AND estado = 1 LIMIT 1");
}

function tr_ubicacion($id, $idBodega) {
    if ($id <= 0) return null;
    return tr_fila("SELECT id, idBodega, codigo, nombre FROM UbicacionesInventario WHERE id = $id AND idBodega = $idBodega AND estado = 1 LIMIT 1");
}

function tr_validar_origen_destino($bo, $uo, $bd, $ud) {
    if ($bo <= 0) throw new Exception("Debe seleccionar la bodega origen");
    if ($bd <= 0) throw new Exception("Debe seleccionar la bodega destino");
    if ($bo === $bd && intval($uo) === intval($ud)) throw new Exception("El origen y el destino del traslado no pueden ser iguales");
    if (!tr_bodega($bo)) throw new Exception("La bodega origen no existe o está inactiva");
    if (!tr_bodega($bd)) throw new Exception("La bodega destino no existe o está inactiva");
    if ($uo > 0 && !tr_ubicacion($uo, $bo)) throw new Exception("La ubicación origen no pertenece a la bodega origen o está inactiva");
    if ($ud > 0 && !tr_ubicacion($ud, $bd)) throw new Exception("La ubicación destino no pertenece a la bodega destino o está inactiva");
}

function tr_existencia($idProducto, $idLote, $idBodega, $idUbicacion, $lock = true) {
    $condLote = $idLote > 0 ? "idLote = $idLote" : "idLote IS NULL";
    $condUbi = $idUbicacion > 0 ? "idUbicacion = $idUbicacion" : "idUbicacion IS NULL";
    $fu = $lock ? "FOR UPDATE" : "";
    return tr_fila("SELECT id, cantidadDisponible, cantidadReservada, cantidadBloqueada FROM InventarioExistencias
        WHERE idProducto = $idProducto AND $condLote AND idBodega = $idBodega AND $condUbi LIMIT 1 $fu");
}

function tr_lote($idProducto, $idLote) {
    if ($idLote <= 0) return null;
    return tr_fila("SELECT id, idProducto, lote, fechaFabricacion, fechaVencimiento, fechaIngreso, estado
        FROM InventarioLotes WHERE id = $idLote AND idProducto = $idProducto AND estado = 1 LIMIT 1");
}

function tr_validar_lote($detalle, $producto) {
    if (intval($producto["manejaLote"]) !== 1) return null;
    $idLote = intval($detalle["idLote"] ?? 0);
    if ($idLote <= 0) throw new Exception("Debe seleccionar un lote disponible para el producto " . $producto["descripcion"]);
    $lote = tr_lote(intval($producto["id"]), $idLote);
    if (!$lote) throw new Exception("El lote seleccionado no existe o no pertenece al producto " . $producto["descripcion"]);
    return $lote;
}

function tr_movs_doc($idDocumento) {
    return intval(tr_valor("SELECT COUNT(*) FROM InventarioMovimientos WHERE idDocumento = $idDocumento"));
}

function tr_estado_texto($estado) {
    $estado = strtoupper(tr_limpiar($estado));
    if ($estado === "FINALIZADA") return "Finalizada";
    if ($estado === "ANULADA") return "Anulada";
    return "Borrador";
}

function tr_doc($r) {
    $estado = $r["estadoProceso"] ?? "BORRADOR";
    $movs = intval($r["totalMovimientos"] ?? 0);
    return [
        "id" => intval($r["id"]),
        "idDocumento" => intval($r["id"]),
        "idTraslado" => intval($r["id"]),
        "consecutivo" => $r["consecutivo"],
        "fechaDocumento" => $r["fechaDocumento"],
        "idTipoDocumento" => intval($r["idTipoDocumento"]),
        "tipoDocumento" => $r["tipoDocumento"] ?? null,
        "codigoTipoDocumento" => $r["codigoTipoDocumento"] ?? null,
        "tipoMovimiento" => $r["tipoMovimiento"] ?? null,
        "naturaleza" => $r["naturaleza"] ?? null,
        "idBodegaOrigen" => $r["idBodegaOrigen"] !== null ? intval($r["idBodegaOrigen"]) : null,
        "bodegaOrigen" => $r["bodegaOrigen"] ?? null,
        "codigoBodegaOrigen" => $r["codigoBodegaOrigen"] ?? null,
        "idUbicacionOrigen" => $r["idUbicacionOrigen"] !== null ? intval($r["idUbicacionOrigen"]) : null,
        "ubicacionOrigen" => $r["ubicacionOrigen"] ?? null,
        "codigoUbicacionOrigen" => $r["codigoUbicacionOrigen"] ?? null,
        "idBodegaDestino" => $r["idBodegaDestino"] !== null ? intval($r["idBodegaDestino"]) : null,
        "bodegaDestino" => $r["bodegaDestino"] ?? null,
        "codigoBodegaDestino" => $r["codigoBodegaDestino"] ?? null,
        "idUbicacionDestino" => $r["idUbicacionDestino"] !== null ? intval($r["idUbicacionDestino"]) : null,
        "ubicacionDestino" => $r["ubicacionDestino"] ?? null,
        "codigoUbicacionDestino" => $r["codigoUbicacionDestino"] ?? null,
        "idUsuarioRegistro" => $r["idUsuarioRegistro"] !== null ? intval($r["idUsuarioRegistro"]) : null,
        "usuarioRegistro" => $r["usuarioRegistro"] ?? null,
        "idOperador" => $r["idOperador"] !== null ? intval($r["idOperador"]) : null,
        "operador" => $r["operador"] ?? null,
        "codigoOperador" => $r["codigoOperador"] ?? null,
        "idResponsable" => $r["idResponsable"] !== null ? intval($r["idResponsable"]) : null,
        "idOperadorAsignado" => $r["idOperadorAsignado"] !== null ? intval($r["idOperadorAsignado"]) : null,
        "idEstado" => $r["idEstado"] !== null ? intval($r["idEstado"]) : null,
        "tipoOrigen" => $r["tipoOrigen"] ?? null,
        "observacion" => $r["observacion"] ?? null,
        "estadoProceso" => $estado,
        "estadoProcesoTexto" => tr_estado_texto($estado),
        "editable" => $estado === "BORRADOR" && $movs === 0,
        "finalizable" => $estado === "BORRADOR" && $movs === 0,
        "totalProductos" => intval($r["totalProductos"] ?? 0),
        "totalCantidad" => floatval($r["totalCantidad"] ?? 0),
        "totalMovimientos" => $movs,
        "fechaFinalizacion" => $r["fechaFinalizacion"] ?? null,
        "idUsuarioFinaliza" => $r["idUsuarioFinaliza"] !== null ? intval($r["idUsuarioFinaliza"]) : null,
        "created_at" => $r["created_at"] ?? null,
        "updated_at" => $r["updated_at"] ?? null
    ];
}
?>
