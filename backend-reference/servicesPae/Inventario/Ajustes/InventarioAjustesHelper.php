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

function aj_responder($rpta, $mensaje, $data = [], $extra = [], $codigoHttp = 200)
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

function aj_limpiar_texto($valor)
{
    return trim((string)($valor ?? ""));
}

function aj_parametro($nombre, $default = "")
{
    if (isset($_GET[$nombre])) {
        return aj_limpiar_texto($_GET[$nombre]);
    }

    if (isset($_POST[$nombre])) {
        return aj_limpiar_texto($_POST[$nombre]);
    }

    return $default;
}

function aj_entrada_json()
{
    $raw = file_get_contents("php://input");
    $json = json_decode($raw, true);

    return is_array($json) ? $json : [];
}

function aj_esc($valor)
{
    global $conexion;
    return $conexion->real_escape_string((string)($valor ?? ""));
}

function aj_fecha_o_null($valor)
{
    $valor = aj_limpiar_texto($valor);

    if ($valor === "") {
        return "NULL";
    }

    return "'" . aj_esc($valor) . "'";
}

function aj_texto_o_null($valor)
{
    $valor = aj_limpiar_texto($valor);

    if ($valor === "") {
        return "NULL";
    }

    return "'" . aj_esc($valor) . "'";
}

function aj_int_o_null($valor)
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

function aj_decimal_seguro($valor)
{
    if ($valor === null || $valor === "") {
        return 0;
    }

    return round(floatval(str_replace(",", ".", (string)$valor)), 3);
}

function aj_obtener_fila($sql)
{
    global $conexion;

    $res = $conexion->query($sql);

    if (!$res) {
        throw new Exception($conexion->error);
    }

    return $res->fetch_assoc() ?: null;
}

function aj_obtener_filas($sql)
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

function aj_obtener_valor($sql, $default = 0)
{
    global $conexion;

    $res = $conexion->query($sql);

    if (!$res) {
        throw new Exception($conexion->error);
    }

    $fila = $res->fetch_row();

    return $fila ? $fila[0] : $default;
}

function aj_normalizar_texto($valor)
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

function aj_normalizar_naturaleza($valor)
{
    $texto = aj_normalizar_texto($valor);

    if (strpos($texto, "AJUSTE") !== false) {
        return "AJUSTE";
    }

    if (strpos($texto, "ENTRADA") !== false || $texto === "ENT") {
        return "ENTRADA";
    }

    if (strpos($texto, "SALIDA") !== false || $texto === "SAL") {
        return "SALIDA";
    }

    if (strpos($texto, "TRASLADO") !== false || $texto === "TRA") {
        return "TRASLADO";
    }

    return $texto;
}

function aj_es_tipo_ajuste($fila)
{
    $naturaleza = aj_normalizar_naturaleza($fila["naturaleza"] ?? "");
    $tipoMovimiento = aj_normalizar_texto($fila["tipoMovimiento"] ?? "");
    $codigo = aj_normalizar_texto($fila["codigo"] ?? "");
    $nombre = aj_normalizar_texto($fila["nombre"] ?? "");
    $descripcion = aj_normalizar_texto($fila["descripcion"] ?? "");

    $texto = "$naturaleza $tipoMovimiento $codigo $nombre $descripcion";

    return $naturaleza === "AJUSTE" || strpos($texto, "AJUSTE") !== false;
}

function aj_resolver_tipo_ajuste($fila)
{
    $texto = aj_normalizar_texto(
        ($fila["tipoMovimiento"] ?? "") . " " .
        ($fila["naturaleza"] ?? "") . " " .
        ($fila["codigo"] ?? "") . " " .
        ($fila["nombre"] ?? "") . " " .
        ($fila["descripcion"] ?? "")
    );

    $negativos = [
        "NEGATIVO",
        "RESTA",
        "DESCUENTO",
        "SALIDA",
        "FALTANTE",
        "PERDIDA",
        "PERDIDAS",
        "BAJA",
        "MERMA",
        "DETERIORO",
        "VENCIMIENTO",
        "VENCIDO",
        "VENCIDA",
        "CADUCIDAD",
        "CADUCADO",
        "CADUCADA",
        "AVERIA",
        "AVERIADO",
        "AVERIADA",
        "DANO",
        "DANADO",
        "DANADA",
        "CONSUMO"
    ];

    foreach ($negativos as $palabra) {
        if (strpos($texto, $palabra) !== false) {
            return "NEGATIVO";
        }
    }

    $positivos = [
        "POSITIVO",
        "SUMA",
        "ENTRADA",
        "SOBRANTE",
        "SOBRANTES",
        "ADICION",
        "ADICIONAL",
        "INGRESO",
        "AUMENTO",
        "CORRECCION_POSITIVA"
    ];

    foreach ($positivos as $palabra) {
        if (strpos($texto, $palabra) !== false) {
            return "POSITIVO";
        }
    }

    return "";
}

function aj_lote_vencido($fechaVencimiento)
{
    $fechaVencimiento = aj_limpiar_texto($fechaVencimiento);

    if ($fechaVencimiento === "" || $fechaVencimiento === "0000-00-00") {
        return false;
    }

    return substr($fechaVencimiento, 0, 10) < date("Y-m-d");
}

function aj_generar_consecutivo_ajuste()
{
    $prefijo = "AJU-" . date("Ymd") . "-";

    $fila = aj_obtener_fila("
        SELECT consecutivo
        FROM InventarioDocumentos
        WHERE consecutivo LIKE '" . aj_esc($prefijo) . "%'
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

function aj_obtener_operador_por_usuario($idUsuario)
{
    if ($idUsuario <= 0) {
        return null;
    }

    return aj_obtener_fila("
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

function aj_obtener_tipo_documento($idTipoDocumento)
{
    return aj_obtener_fila("
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
            descripcion,
            estado
        FROM TiposDocumentoInventario
        WHERE id = $idTipoDocumento
        LIMIT 1
    ");
}

function aj_validar_tipo_documento($idTipoDocumento)
{
    if ($idTipoDocumento <= 0) {
        throw new Exception("Debe seleccionar el tipo de ajuste");
    }

    $tipoDocumento = aj_obtener_tipo_documento($idTipoDocumento);

    if (!$tipoDocumento) {
        throw new Exception("El tipo de documento de ajuste no existe");
    }

    if (intval($tipoDocumento["estado"]) !== 1) {
        throw new Exception("El tipo de documento de ajuste está inactivo");
    }

    if (intval($tipoDocumento["afectaInventario"]) !== 1) {
        throw new Exception("El tipo de documento de ajuste debe afectar inventario");
    }

    if (!aj_es_tipo_ajuste($tipoDocumento)) {
        throw new Exception("El tipo de documento seleccionado no corresponde a un ajuste de inventario");
    }

    $tipoAjuste = aj_resolver_tipo_ajuste($tipoDocumento);

    if (!in_array($tipoAjuste, ["POSITIVO", "NEGATIVO"], true)) {
        throw new Exception("No se pudo determinar si el ajuste es POSITIVO o NEGATIVO. Valida el código, nombre o tipoMovimiento del documento");
    }

    $tipoDocumento["tipoAjuste"] = $tipoAjuste;

    return $tipoDocumento;
}

function aj_obtener_producto_inventario($idProducto)
{
    return aj_obtener_fila("
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

function aj_validar_bodega($idBodega)
{
    return aj_obtener_fila("
        SELECT id, codigo, nombre
        FROM BodegasInventario
        WHERE id = $idBodega
            AND estado = 1
        LIMIT 1
    ");
}

function aj_validar_ubicacion($idUbicacion, $idBodega)
{
    if ($idUbicacion <= 0) {
        return null;
    }

    return aj_obtener_fila("
        SELECT id, idBodega, codigo, nombre
        FROM UbicacionesInventario
        WHERE id = $idUbicacion
            AND idBodega = $idBodega
            AND estado = 1
        LIMIT 1
    ");
}

function aj_obtener_existencia($idProducto, $idLote, $idBodega, $idUbicacion, $forUpdate = true)
{
    $condLote = $idLote > 0
        ? "idLote = $idLote"
        : "idLote IS NULL";

    $condUbicacion = $idUbicacion > 0
        ? "idUbicacion = $idUbicacion"
        : "idUbicacion IS NULL";

    $lock = $forUpdate ? "FOR UPDATE" : "";

    return aj_obtener_fila("
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
        $lock
    ");
}

function aj_obtener_lote_producto($idProducto, $idLote)
{
    if ($idLote <= 0) {
        return null;
    }

    return aj_obtener_fila("
        SELECT
            id,
            idProducto,
            lote,
            fechaFabricacion,
            fechaVencimiento,
            fechaIngreso,
            estado
        FROM InventarioLotes
        WHERE
            id = $idLote
            AND idProducto = $idProducto
            AND estado = 1
        LIMIT 1
    ");
}

function aj_validar_lote($detalle, $producto)
{
    $manejaLote = intval($producto["manejaLote"]) === 1;

    if (!$manejaLote) {
        return null;
    }

    $idProducto = intval($producto["id"]);
    $idLote = intval($detalle["idLote"] ?? 0);

    if ($idLote <= 0) {
        throw new Exception("Debe seleccionar un lote para el producto " . $producto["descripcion"]);
    }

    $lote = aj_obtener_lote_producto($idProducto, $idLote);

    if (!$lote) {
        throw new Exception("El lote seleccionado no existe o no pertenece al producto " . $producto["descripcion"]);
    }

    return $lote;
}

function aj_contar_movimientos_documento($idDocumento)
{
    return intval(aj_obtener_valor("
        SELECT COUNT(*)
        FROM InventarioMovimientos
        WHERE idDocumento = $idDocumento
    "));
}

function aj_estado_proceso_texto($estado)
{
    $estado = strtoupper(aj_limpiar_texto($estado));

    if ($estado === "FINALIZADA") {
        return "Finalizada";
    }

    if ($estado === "ANULADA") {
        return "Anulada";
    }

    return "Borrador";
}

function aj_formatear_documento($fila)
{
    $estadoProceso = $fila["estadoProceso"] ?? "BORRADOR";
    $movimientos = intval($fila["totalMovimientos"] ?? 0);

    $tipoAjuste = $fila["tipoAjuste"] ?? aj_resolver_tipo_ajuste($fila);

    return [
        "id" => intval($fila["id"]),
        "idDocumento" => intval($fila["id"]),
        "idAjuste" => intval($fila["id"]),
        "consecutivo" => $fila["consecutivo"],
        "fechaDocumento" => $fila["fechaDocumento"],
        "idTipoDocumento" => intval($fila["idTipoDocumento"]),
        "tipoDocumento" => $fila["tipoDocumento"] ?? null,
        "codigoTipoDocumento" => $fila["codigoTipoDocumento"] ?? null,
        "tipoMovimiento" => $fila["tipoMovimiento"] ?? null,
        "naturaleza" => $fila["naturaleza"] ?? null,
        "tipoAjuste" => $tipoAjuste,
        "idBodega" => $fila["idBodega"] !== null ? intval($fila["idBodega"]) : null,
        "bodega" => $fila["bodega"] ?? null,
        "codigoBodega" => $fila["codigoBodega"] ?? null,
        "idUbicacion" => $fila["idUbicacion"] !== null ? intval($fila["idUbicacion"]) : null,
        "ubicacion" => $fila["ubicacion"] ?? null,
        "codigoUbicacion" => $fila["codigoUbicacion"] ?? null,
        "idUsuarioRegistro" => $fila["idUsuarioRegistro"] !== null ? intval($fila["idUsuarioRegistro"]) : null,
        "usuarioRegistro" => $fila["usuarioRegistro"] ?? null,
        "idOperador" => $fila["idOperador"] !== null ? intval($fila["idOperador"]) : null,
        "operador" => $fila["operador"] ?? null,
        "codigoOperador" => $fila["codigoOperador"] ?? null,
        "idEstado" => $fila["idEstado"] !== null ? intval($fila["idEstado"]) : null,
        "tipoOrigen" => $fila["tipoOrigen"] ?? null,
        "observacion" => $fila["observacion"] ?? null,
        "estadoProceso" => $estadoProceso,
        "estadoProcesoTexto" => aj_estado_proceso_texto($estadoProceso),
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
