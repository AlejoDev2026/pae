<?php
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
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

function inv_responder($rpta, $mensaje, $data = [], $extra = [], $codigoHttp = 200)
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

function inv_limpiar_texto($valor)
{
    return trim((string)($valor ?? ""));
}

function inv_parametro($nombre, $default = "")
{
    if (isset($_GET[$nombre])) {
        return inv_limpiar_texto($_GET[$nombre]);
    }

    if (isset($_POST[$nombre])) {
        return inv_limpiar_texto($_POST[$nombre]);
    }

    return $default;
}

function inv_entrada_json()
{
    $raw = file_get_contents("php://input");
    $json = json_decode($raw, true);

    if (!is_array($json)) {
        return [];
    }

    return $json;
}

function inv_esc($valor)
{
    global $conexion;
    return $conexion->real_escape_string((string)($valor ?? ""));
}

function inv_fecha_o_null($valor)
{
    $valor = inv_limpiar_texto($valor);

    if ($valor === "") {
        return "NULL";
    }

    return "'" . inv_esc($valor) . "'";
}

function inv_texto_o_null($valor)
{
    $valor = inv_limpiar_texto($valor);

    if ($valor === "") {
        return "NULL";
    }

    return "'" . inv_esc($valor) . "'";
}

function inv_int_o_null($valor)
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

function inv_decimal_seguro($valor)
{
    if ($valor === null || $valor === "") {
        return 0;
    }

    return round(floatval(str_replace(",", ".", (string)$valor)), 3);
}

function inv_obtener_fila($sql)
{
    global $conexion;

    $res = $conexion->query($sql);

    if (!$res) {
        throw new Exception($conexion->error);
    }

    return $res->fetch_assoc() ?: null;
}

function inv_obtener_filas($sql)
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

function inv_obtener_valor($sql, $default = 0)
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

function inv_generar_consecutivo_entrada()
{
    $prefijo = "ENT-" . date("Ymd") . "-";

    $fila = inv_obtener_fila("
        SELECT consecutivo
        FROM InventarioDocumentos
        WHERE consecutivo LIKE '" . inv_esc($prefijo) . "%'
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

function inv_obtener_operador_por_usuario($idUsuario)
{
    if ($idUsuario <= 0) {
        return null;
    }

    return inv_obtener_fila("
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

function inv_obtener_tipo_documento_entrada($idTipoDocumento)
{
    return inv_obtener_fila("
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
            estado
        FROM TiposDocumentoInventario
        WHERE id = $idTipoDocumento
        LIMIT 1
    ");
}

function inv_obtener_tipo_documento_entrada_mercancia()
{
    return inv_obtener_fila("
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
        WHERE
            estado = 1
            AND permiteManual = 1
            AND afectaInventario = 1
            AND naturaleza = 'ENTRADA'
            AND codigo = 'ENT_MERCANCIA'
        LIMIT 1
    ");
}

function inv_validar_tipo_documento_entrada($idTipoDocumento)
{
    if ($idTipoDocumento <= 0) {
        throw new Exception("No se pudo identificar el tipo de documento Entrada de mercancía");
    }

    $tipoDocumento = inv_obtener_tipo_documento_entrada($idTipoDocumento);

    if (!$tipoDocumento) {
        throw new Exception("El tipo de documento de entrada no existe");
    }

    if (intval($tipoDocumento["estado"]) !== 1) {
        throw new Exception("El tipo de documento de entrada está inactivo");
    }

    if (!in_array($tipoDocumento["naturaleza"], ["ENTRADA", "INVENTARIO_INICIAL"], true)) {
        throw new Exception("El tipo de documento no corresponde a una entrada de inventario");
    }

    if (intval($tipoDocumento["afectaInventario"]) !== 1) {
        throw new Exception("El tipo de documento de entrada debe afectar inventario");
    }

    return $tipoDocumento;
}

function inv_obtener_producto_inventario($idProducto)
{
    return inv_obtener_fila("
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

function inv_validar_bodega($idBodega)
{
    return inv_obtener_fila("
        SELECT id, codigo, nombre
        FROM BodegasInventario
        WHERE id = $idBodega
            AND estado = 1
        LIMIT 1
    ");
}

function inv_validar_ubicacion($idUbicacion, $idBodega)
{
    if ($idUbicacion <= 0) {
        return null;
    }

    return inv_obtener_fila("
        SELECT id, idBodega, codigo, nombre
        FROM UbicacionesInventario
        WHERE id = $idUbicacion
            AND idBodega = $idBodega
            AND estado = 1
        LIMIT 1
    ");
}

function inv_obtener_o_crear_lote($detalle, $producto)
{
    global $conexion;

    $idProducto = intval($producto["id"]);
    $manejaLote = intval($producto["manejaLote"]) === 1;
    $manejaVencimiento = intval($producto["manejaVencimiento"]) === 1;

    if (!$manejaLote) {
        return null;
    }

    $idLote = intval($detalle["idLote"] ?? 0);

    if ($idLote > 0) {
        $lote = inv_obtener_fila("
            SELECT id, idProducto, lote, fechaVencimiento, estado
            FROM InventarioLotes
            WHERE id = $idLote
                AND idProducto = $idProducto
                AND estado = 1
            LIMIT 1
        ");

        if (!$lote) {
            throw new Exception("El lote seleccionado no existe o no pertenece al producto " . $producto["descripcion"]);
        }

        if ($manejaVencimiento && empty($lote["fechaVencimiento"])) {
            throw new Exception("El producto " . $producto["descripcion"] . " maneja vencimiento y el lote seleccionado no tiene fecha de vencimiento");
        }

        return intval($lote["id"]);
    }

    $loteTexto = inv_limpiar_texto($detalle["lote"] ?? ($detalle["numeroLote"] ?? ""));
    $fechaFabricacion = inv_limpiar_texto($detalle["fechaFabricacion"] ?? "");
    $fechaVencimiento = inv_limpiar_texto($detalle["fechaVencimiento"] ?? "");
    $fechaIngreso = inv_limpiar_texto($detalle["fechaIngreso"] ?? date("Y-m-d"));
    $observacion = inv_limpiar_texto($detalle["observacionLote"] ?? "");

    if ($loteTexto === "") {
        throw new Exception("Debe seleccionar o crear un lote para el producto " . $producto["descripcion"]);
    }

    if ($manejaVencimiento && $fechaVencimiento === "") {
        throw new Exception("Debe ingresar la fecha de vencimiento para el lote del producto " . $producto["descripcion"]);
    }

    $loteEsc = inv_esc($loteTexto);

    $loteExistente = inv_obtener_fila("
        SELECT id
        FROM InventarioLotes
        WHERE idProducto = $idProducto
            AND lote = '$loteEsc'
        LIMIT 1
    ");

    if ($loteExistente) {
        return intval($loteExistente["id"]);
    }

    $sqlInsertLote = "
        INSERT INTO InventarioLotes
        (
            idProducto,
            lote,
            fechaFabricacion,
            fechaVencimiento,
            fechaIngreso,
            observacion,
            estado,
            created_at,
            updated_at
        )
        VALUES
        (
            $idProducto,
            '$loteEsc',
            " . inv_fecha_o_null($fechaFabricacion) . ",
            " . inv_fecha_o_null($fechaVencimiento) . ",
            " . inv_fecha_o_null($fechaIngreso) . ",
            " . inv_texto_o_null($observacion) . ",
            1,
            NOW(),
            NOW()
        )
    ";

    if (!$conexion->query($sqlInsertLote)) {
        throw new Exception($conexion->error);
    }

    return intval($conexion->insert_id);
}

function inv_obtener_existencia_actual($idProducto, $idLote, $idBodega, $idUbicacion)
{
    $condLote = $idLote > 0
        ? "idLote = $idLote"
        : "idLote IS NULL";

    $condUbicacion = $idUbicacion > 0
        ? "idUbicacion = $idUbicacion"
        : "idUbicacion IS NULL";

    return inv_obtener_fila("
        SELECT id, cantidadDisponible
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

function inv_contar_movimientos_documento($idDocumento)
{
    return intval(inv_obtener_valor("
        SELECT COUNT(*)
        FROM InventarioMovimientos
        WHERE idDocumento = $idDocumento
    "));
}

function inv_estado_proceso_texto($estado)
{
    $estado = strtoupper(inv_limpiar_texto($estado));

    if ($estado === "FINALIZADA") {
        return "Finalizada";
    }

    if ($estado === "ANULADA") {
        return "Anulada";
    }

    return "Borrador";
}

function inv_formatear_documento($fila)
{
    $estadoProceso = $fila["estadoProceso"] ?? "BORRADOR";
    $movimientos = intval($fila["totalMovimientos"] ?? 0);

    return [
        "id" => intval($fila["id"]),
        "idDocumento" => intval($fila["id"]),
        "idEntrada" => intval($fila["id"]),
        "consecutivo" => $fila["consecutivo"],
        "fechaDocumento" => $fila["fechaDocumento"],
        "idTipoDocumento" => intval($fila["idTipoDocumento"]),
        "tipoDocumento" => $fila["tipoDocumento"] ?? null,
        "codigoTipoDocumento" => $fila["codigoTipoDocumento"] ?? null,
        "tipoMovimiento" => $fila["tipoMovimiento"] ?? null,
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
        "estadoProcesoTexto" => inv_estado_proceso_texto($estadoProceso),
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
