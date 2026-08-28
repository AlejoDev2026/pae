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

function sal_responder($rpta, $mensaje, $data = [], $extra = [], $codigoHttp = 200)
{
    http_response_code($codigoHttp);

    echo json_encode(
        array_merge([
            "rpta" => $rpta,
            "mensaje" => $mensaje,
            "data" => $data
        ], $extra),
        JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT
    );

    exit;
}

function sal_limpiar_texto($valor)
{
    return trim((string)($valor ?? ""));
}

function sal_parametro($nombre, $default = "")
{
    if (isset($_GET[$nombre])) {
        return sal_limpiar_texto($_GET[$nombre]);
    }

    if (isset($_POST[$nombre])) {
        return sal_limpiar_texto($_POST[$nombre]);
    }

    return $default;
}

function sal_entrada_json()
{
    $raw = file_get_contents("php://input");
    $json = json_decode($raw, true);

    if (!is_array($json)) {
        return [];
    }

    return $json;
}

function sal_esc($valor)
{
    global $conexion;
    return $conexion->real_escape_string((string)($valor ?? ""));
}

function sal_fecha_o_null($valor)
{
    $valor = sal_limpiar_texto($valor);

    if ($valor === "") {
        return "NULL";
    }

    return "'" . sal_esc($valor) . "'";
}

function sal_texto_o_null($valor)
{
    $valor = sal_limpiar_texto($valor);

    if ($valor === "") {
        return "NULL";
    }

    return "'" . sal_esc($valor) . "'";
}

function sal_int_o_null($valor)
{
    if ($valor === null || $valor === "") {
        return "NULL";
    }

    $valor = intval($valor);

    if ($valor <= 0) {
        return "NULL";
    }

    return (string)$valor;
}

function sal_decimal_seguro($valor)
{
    if ($valor === null || $valor === "") {
        return 0;
    }

    return round(floatval(str_replace(",", ".", (string)$valor)), 3);
}

function sal_obtener_fila($sql)
{
    global $conexion;

    $res = $conexion->query($sql);

    if (!$res) {
        throw new Exception($conexion->error);
    }

    return $res->fetch_assoc() ?: null;
}

function sal_obtener_filas($sql)
{
    global $conexion;

    $res = $conexion->query($sql);

    if (!$res) {
        throw new Exception($conexion->error);
    }

    $data = [];

    while ($fila = $res->fetch_assoc()) {
        $data[] = $fila;
    }

    return $data;
}

function sal_obtener_valor($sql, $default = 0)
{
    global $conexion;

    $res = $conexion->query($sql);

    if (!$res) {
        throw new Exception($conexion->error);
    }

    $fila = $res->fetch_row();

    if (!$fila) {
        return $default;
    }

    return $fila[0];
}

function sal_normalizar_texto($valor)
{
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

function sal_normalizar_naturaleza($valor)
{
    $texto = sal_normalizar_texto($valor);

    if (
        $texto === "SALIDA" ||
        $texto === "SAL" ||
        strpos($texto, "SALIDA") !== false
    ) {
        return "SALIDA";
    }

    if (
        $texto === "ENTRADA" ||
        $texto === "ENT" ||
        strpos($texto, "ENTRADA") !== false
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

function sal_es_tipo_salida($naturaleza)
{
    return sal_normalizar_naturaleza($naturaleza) === "SALIDA";
}

function sal_lote_vencido($fechaVencimiento)
{
    $fechaVencimiento = sal_limpiar_texto($fechaVencimiento);

    if ($fechaVencimiento === "" || $fechaVencimiento === "0000-00-00") {
        return false;
    }

    return substr($fechaVencimiento, 0, 10) < date("Y-m-d");
}

function sal_generar_consecutivo_salida()
{
    $prefijo = "SAL-" . date("Ymd") . "-";

    $fila = sal_obtener_fila("
        SELECT consecutivo
        FROM InventarioDocumentos
        WHERE consecutivo LIKE '" . sal_esc($prefijo) . "%'
        ORDER BY id DESC
        LIMIT 1
    ");

    $numero = 1;

    if ($fila && !empty($fila["consecutivo"])) {
        $partes = explode("-", $fila["consecutivo"]);
        $ultimo = intval(end($partes));
        $numero = $ultimo + 1;
    }

    return $prefijo . str_pad((string)$numero, 6, "0", STR_PAD_LEFT);
}

function sal_obtener_operador_por_usuario($idUsuario)
{
    if ($idUsuario <= 0) {
        return null;
    }

    return sal_obtener_fila("
        SELECT
            io.id AS idOperador,
            io.idUsuario,
            io.codigo,
            io.nombre,
            io.apellido,
            io.nombreCompleto,
            io.cargo,
            io.estado AS estadoOperador,
            u.estado AS estadoUsuario
        FROM InventarioOperadores io
        INNER JOIN usuarios u
            ON u.id = io.idUsuario
        WHERE
            io.idUsuario = $idUsuario
            AND io.estado = 1
            AND u.estado = 1
        LIMIT 1
    ");
}

function sal_obtener_tipo_documento_salida($idTipoDocumento)
{
    return sal_obtener_fila("
        SELECT
            id,
            codigo,
            nombre,
            naturaleza,
            tipoMovimiento,
            afectaInventario,
            requiereOrigen,
            requiereDestino,
            permiteManual,
            COALESCE(permiteLoteVencido, 0) AS permiteLoteVencido,
            descripcion,
            estado
        FROM TiposDocumentoInventario
        WHERE id = $idTipoDocumento
        LIMIT 1
    ");
}

function sal_validar_tipo_documento_salida($idTipoDocumento)
{
    if ($idTipoDocumento <= 0) {
        throw new Exception("Debe seleccionar el tipo de salida");
    }

    $tipoDocumento = sal_obtener_tipo_documento_salida($idTipoDocumento);

    if (!$tipoDocumento) {
        throw new Exception("El tipo de documento de salida no existe");
    }

    if (intval($tipoDocumento["estado"]) !== 1) {
        throw new Exception("El tipo de documento de salida está inactivo");
    }

    if (intval($tipoDocumento["afectaInventario"]) !== 1) {
        throw new Exception("El tipo de documento de salida debe afectar inventario");
    }

    if (!sal_es_tipo_salida($tipoDocumento["naturaleza"])) {
        throw new Exception("El tipo de documento seleccionado no corresponde a una salida de inventario");
    }

    return $tipoDocumento;
}

function sal_obtener_producto_inventario($idProducto)
{
    return sal_obtener_fila("
        SELECT
            pc.id,
            pc.codigo,
            pc.descripcion,
            pic.manejaLote,
            pic.manejaVencimiento,
            pic.unidadBaseInventario,
            pic.estado AS estadoInventario
        FROM ProductosCatalogo pc
        INNER JOIN ProductosInventarioConfig pic
            ON pic.idProducto = pc.id
        WHERE
            pc.id = $idProducto
            AND pc.estado = 1
            AND COALESCE(pc.idEstado, 1) = 1
            AND pic.estado = 1
        LIMIT 1
    ");
}

function sal_validar_bodega($idBodega)
{
    return sal_obtener_fila("
        SELECT id, codigo, nombre
        FROM BodegasInventario
        WHERE id = $idBodega
            AND estado = 1
        LIMIT 1
    ");
}

function sal_validar_ubicacion($idUbicacion, $idBodega)
{
    if ($idUbicacion <= 0) {
        return null;
    }

    return sal_obtener_fila("
        SELECT id, idBodega, codigo, nombre
        FROM UbicacionesInventario
        WHERE id = $idUbicacion
            AND idBodega = $idBodega
            AND estado = 1
        LIMIT 1
    ");
}

function sal_obtener_existencia_actual($idProducto, $idLote, $idBodega, $idUbicacion)
{
    $condLote = $idLote > 0
        ? "idLote = $idLote"
        : "idLote IS NULL";

    $condUbicacion = $idUbicacion > 0
        ? "idUbicacion = $idUbicacion"
        : "idUbicacion IS NULL";

    return sal_obtener_fila("
        SELECT
            id,
            cantidadDisponible,
            cantidadReservada,
            cantidadBloqueada
        FROM InventarioExistencias
        WHERE
            idProducto = $idProducto
            AND $condLote
            AND idBodega = $idBodega
            AND $condUbicacion
        LIMIT 1
        FOR UPDATE
    ");
}

function sal_obtener_existencia_actual_sin_lock($idProducto, $idLote, $idBodega, $idUbicacion)
{
    $condLote = $idLote > 0
        ? "idLote = $idLote"
        : "idLote IS NULL";

    $condUbicacion = $idUbicacion > 0
        ? "idUbicacion = $idUbicacion"
        : "idUbicacion IS NULL";

    return sal_obtener_fila("
        SELECT
            id,
            cantidadDisponible,
            cantidadReservada,
            cantidadBloqueada
        FROM InventarioExistencias
        WHERE
            idProducto = $idProducto
            AND $condLote
            AND idBodega = $idBodega
            AND $condUbicacion
        LIMIT 1
    ");
}

function sal_validar_lote_salida($detalle, $producto, $tipoDocumento)
{
    $manejaLote = intval($producto["manejaLote"]) === 1;
    $manejaVencimiento = intval($producto["manejaVencimiento"]) === 1;
    $permiteLoteVencido = intval($tipoDocumento["permiteLoteVencido"] ?? 0) === 1;

    if (!$manejaLote) {
        return null;
    }

    $idProducto = intval($producto["id"]);
    $idLote = intval($detalle["idLote"] ?? 0);

    if ($idLote <= 0) {
        throw new Exception("Debe seleccionar un lote disponible para el producto " . $producto["descripcion"]);
    }

    $lote = sal_obtener_fila("
        SELECT
            id,
            idProducto,
            lote,
            fechaVencimiento,
            estado
        FROM InventarioLotes
        WHERE
            id = $idLote
            AND idProducto = $idProducto
            AND estado = 1
        LIMIT 1
    ");

    if (!$lote) {
        throw new Exception("El lote seleccionado no existe o no pertenece al producto " . $producto["descripcion"]);
    }

    if ($manejaVencimiento && sal_lote_vencido($lote["fechaVencimiento"]) && !$permiteLoteVencido) {
        throw new Exception(
            "El lote " . $lote["lote"] . " del producto " . $producto["descripcion"] .
            " está vencido y este tipo de salida no permite lotes vencidos"
        );
    }

    return $lote;
}

function sal_contar_movimientos_documento($idDocumento)
{
    return intval(sal_obtener_valor("
        SELECT COUNT(*)
        FROM InventarioMovimientos
        WHERE idDocumento = $idDocumento
    "));
}

function sal_estado_proceso_texto($estado)
{
    $estado = strtoupper(sal_limpiar_texto($estado));

    if ($estado === "FINALIZADA") {
        return "Finalizada";
    }

    if ($estado === "ANULADA") {
        return "Anulada";
    }

    return "Borrador";
}

function sal_formatear_documento($fila)
{
    $estadoProceso = $fila["estadoProceso"] ?? "BORRADOR";
    $movimientos = intval($fila["totalMovimientos"] ?? 0);

    return [
        "id" => intval($fila["id"]),
        "idDocumento" => intval($fila["id"]),
        "idSalida" => intval($fila["id"]),
        "consecutivo" => $fila["consecutivo"],
        "fechaDocumento" => $fila["fechaDocumento"],
        "idTipoDocumento" => intval($fila["idTipoDocumento"]),
        "tipoDocumento" => $fila["tipoDocumento"] ?? null,
        "codigoTipoDocumento" => $fila["codigoTipoDocumento"] ?? null,
        "tipoMovimiento" => $fila["tipoMovimiento"] ?? null,
        "naturaleza" => $fila["naturaleza"] ?? null,
        "permiteLoteVencido" => intval($fila["permiteLoteVencido"] ?? 0),
        "idUsuarioRegistro" => $fila["idUsuarioRegistro"] !== null ? intval($fila["idUsuarioRegistro"]) : null,
        "usuarioRegistro" => $fila["usuarioRegistro"] ?? null,
        "idOperador" => $fila["idOperador"] !== null ? intval($fila["idOperador"]) : null,
        "operador" => $fila["operador"] ?? null,
        "codigoOperador" => $fila["codigoOperador"] ?? null,
        "idResponsable" => $fila["idResponsable"] !== null ? intval($fila["idResponsable"]) : null,
        "idOperadorAsignado" => $fila["idOperadorAsignado"] !== null ? intval($fila["idOperadorAsignado"]) : null,
        "idEstado" => $fila["idEstado"] !== null ? intval($fila["idEstado"]) : null,
        "tipoOrigen" => $fila["tipoOrigen"] ?? null,
        "observacion" => $fila["observacion"] ?? null,
        "estadoProceso" => $estadoProceso,
        "estadoProcesoTexto" => sal_estado_proceso_texto($estadoProceso),
        "editable" => $estadoProceso === "BORRADOR" && $movimientos === 0,
        "finalizable" => $estadoProceso === "BORRADOR" && $movimientos === 0,
        "totalProductos" => intval($fila["totalProductos"] ?? 0),
        "totalCantidad" => floatval($fila["totalCantidad"] ?? 0),
        "totalMovimientos" => $movimientos,
        "fechaFinalizacion" => $fila["fechaFinalizacion"] ?? null,
        "idUsuarioFinaliza" => $fila["idUsuarioFinaliza"] !== null ? intval($fila["idUsuarioFinaliza"]) : null,
        "created_at" => $fila["created_at"] ?? null,
        "updated_at" => $fila["updated_at"] ?? null
    ];
}
?>
