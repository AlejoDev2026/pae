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

function lv_responder($rpta, $mensaje, $data = [], $extra = [], $codigoHttp = 200)
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

function lv_limpiar_texto($valor)
{
    return trim((string)($valor ?? ""));
}

function lv_entrada_json()
{
    static $entrada = null;

    if ($entrada !== null) {
        return $entrada;
    }

    $raw = file_get_contents("php://input");
    $json = json_decode($raw, true);
    $entrada = is_array($json) ? $json : [];

    return $entrada;
}

function lv_parametro($nombre, $default = "")
{
    if (isset($_GET[$nombre])) {
        return lv_limpiar_texto($_GET[$nombre]);
    }

    if (isset($_POST[$nombre])) {
        return lv_limpiar_texto($_POST[$nombre]);
    }

    $json = lv_entrada_json();

    if (array_key_exists($nombre, $json)) {
        return is_string($json[$nombre])
            ? lv_limpiar_texto($json[$nombre])
            : $json[$nombre];
    }

    return $default;
}

function lv_esc($valor)
{
    global $conexion;
    return $conexion->real_escape_string((string)($valor ?? ""));
}

function lv_obtener_fila($sql)
{
    global $conexion;

    $res = $conexion->query($sql);

    if (!$res) {
        throw new Exception($conexion->error);
    }

    return $res->fetch_assoc() ?: null;
}

function lv_obtener_filas($sql)
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

function lv_numero($valor)
{
    return round(floatval($valor ?? 0), 3);
}

function lv_fecha_valida($fecha)
{
    $fecha = lv_limpiar_texto($fecha);

    if ($fecha === "") {
        return "";
    }

    $fecha = substr($fecha, 0, 10);

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
        return "";
    }

    $partes = explode("-", $fecha);

    if (count($partes) !== 3 || !checkdate(intval($partes[1]), intval($partes[2]), intval($partes[0]))) {
        return "";
    }

    return $fecha;
}

function lv_formatear_lote($fila)
{
    return [
        "id" => intval($fila["id"]),
        "idLote" => intval($fila["id"]),
        "idProducto" => intval($fila["idProducto"]),
        "codigoProducto" => $fila["codigoProducto"] ?? null,
        "producto" => $fila["producto"] ?? null,
        "descripcion" => $fila["producto"] ?? null,
        "idTipoProducto" => $fila["idTipoProducto"] !== null ? intval($fila["idTipoProducto"]) : null,
        "tipoProducto" => $fila["tipoProducto"] ?? null,
        "manejaLote" => intval($fila["manejaLote"] ?? 0),
        "manejaVencimiento" => intval($fila["manejaVencimiento"] ?? 0),
        "unidad" => $fila["unidadBaseInventario"] ?: "UND",
        "lote" => $fila["lote"] ?? null,
        "fechaFabricacion" => $fila["fechaFabricacion"] ?? null,
        "fechaVencimiento" => $fila["fechaVencimiento"] ?? null,
        "fechaIngreso" => $fila["fechaIngreso"] ?? null,
        "observacion" => $fila["observacion"] ?? null,
        "estado" => intval($fila["estado"] ?? 0),
        "estadoLote" => intval($fila["estado"] ?? 0),
        "clasificacionVencimiento" => $fila["clasificacionVencimiento"] ?? "SIN_VENCIMIENTO",
        "diasParaVencer" => $fila["diasParaVencer"] !== null ? intval($fila["diasParaVencer"]) : null,
        "cantidadDisponible" => lv_numero($fila["cantidadDisponible"] ?? 0),
        "cantidadReservada" => lv_numero($fila["cantidadReservada"] ?? 0),
        "cantidadBloqueada" => lv_numero($fila["cantidadBloqueada"] ?? 0),
        "cantidadTotal" => lv_numero($fila["cantidadTotal"] ?? 0),
        "totalBodegas" => intval($fila["totalBodegas"] ?? 0),
        "totalUbicaciones" => intval($fila["totalUbicaciones"] ?? 0),
        "bodegas" => $fila["bodegas"] ?? null,
        "created_at" => $fila["created_at"] ?? null,
        "updated_at" => $fila["updated_at"] ?? null
    ];
}


try {
    $idLote = intval(lv_parametro("idLote", lv_parametro("id", 0)));

    if ($idLote <= 0) {
        lv_responder(
            "no",
            "Debe enviar el idLote",
            [],
            [],
            400
        );
    }

    $filaLote = lv_obtener_fila("
        SELECT
            il.id,
            il.idProducto,
            pc.codigo AS codigoProducto,
            pc.descripcion AS producto,
            pic.idTipoProductoInventario AS idTipoProducto,
            tpi.nombre AS tipoProducto,
            COALESCE(pic.manejaLote, 1) AS manejaLote,
            COALESCE(pic.manejaVencimiento, 1) AS manejaVencimiento,
            COALESCE(pic.unidadBaseInventario, 'UND') AS unidadBaseInventario,
            il.lote,
            il.fechaFabricacion,
            il.fechaVencimiento,
            il.fechaIngreso,
            il.observacion,
            il.estado,
            il.created_at,
            il.updated_at,

            CASE
                WHEN il.fechaVencimiento IS NULL THEN 'SIN_VENCIMIENTO'
                WHEN il.fechaVencimiento < CURDATE() THEN 'VENCIDO'
                WHEN il.fechaVencimiento <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'CRITICO'
                WHEN il.fechaVencimiento <= DATE_ADD(CURDATE(), INTERVAL 60 DAY) THEN 'PROXIMO'
                ELSE 'VIGENTE'
            END AS clasificacionVencimiento,

            CASE
                WHEN il.fechaVencimiento IS NULL THEN NULL
                ELSE DATEDIFF(il.fechaVencimiento, CURDATE())
            END AS diasParaVencer,

            COALESCE(SUM(e.cantidadDisponible), 0) AS cantidadDisponible,
            COALESCE(SUM(e.cantidadReservada), 0) AS cantidadReservada,
            COALESCE(SUM(e.cantidadBloqueada), 0) AS cantidadBloqueada,

            COALESCE(SUM(
                e.cantidadDisponible
                + e.cantidadReservada
                + e.cantidadBloqueada
            ), 0) AS cantidadTotal,

            COUNT(DISTINCT e.idBodega) AS totalBodegas,
            COUNT(DISTINCT e.idUbicacion) AS totalUbicaciones,
            GROUP_CONCAT(
                DISTINCT CONCAT(
                    COALESCE(b.codigo, ''),
                    CASE WHEN b.codigo IS NOT NULL THEN ' - ' ELSE '' END,
                    COALESCE(b.nombre, '')
                )
                ORDER BY b.nombre
                SEPARATOR ', '
            ) AS bodegas

        FROM InventarioLotes il
        INNER JOIN ProductosCatalogo pc
            ON pc.id = il.idProducto
        LEFT JOIN ProductosInventarioConfig pic
            ON pic.idProducto = pc.id
        LEFT JOIN TiposProductoInventario tpi
            ON tpi.id = pic.idTipoProductoInventario
        LEFT JOIN InventarioExistencias e
            ON e.idLote = il.id
           AND e.idProducto = il.idProducto
        LEFT JOIN BodegasInventario b
            ON b.id = e.idBodega
        LEFT JOIN UbicacionesInventario u
            ON u.id = e.idUbicacion
        WHERE il.id = $idLote
        GROUP BY
            il.id,
            il.idProducto,
            pc.codigo,
            pc.descripcion,
            pic.idTipoProductoInventario,
            tpi.nombre,
            pic.manejaLote,
            pic.manejaVencimiento,
            pic.unidadBaseInventario,
            il.lote,
            il.fechaFabricacion,
            il.fechaVencimiento,
            il.fechaIngreso,
            il.observacion,
            il.estado,
            il.created_at,
            il.updated_at
        LIMIT 1
    ");

    if (!$filaLote) {
        lv_responder(
            "no",
            "El lote no fue encontrado",
            [],
            [],
            404
        );
    }

    $lote = lv_formatear_lote($filaLote);

    $filasExistencias = lv_obtener_filas("
        SELECT
            e.id,
            e.idProducto,
            e.idLote,
            e.idBodega,
            e.idUbicacion,
            e.cantidadDisponible,
            e.cantidadReservada,
            e.cantidadBloqueada,
            e.created_at,
            e.updated_at,
            b.codigo AS codigoBodega,
            b.nombre AS bodega,
            u.codigo AS codigoUbicacion,
            u.nombre AS ubicacion
        FROM InventarioExistencias e
        INNER JOIN BodegasInventario b
            ON b.id = e.idBodega
        LEFT JOIN UbicacionesInventario u
            ON u.id = e.idUbicacion
        WHERE e.idLote = $idLote
        ORDER BY
            b.nombre ASC,
            u.nombre ASC
    ");

    $existencias = array_map(function ($fila) {
        $disponible = lv_numero($fila["cantidadDisponible"]);
        $reservada = lv_numero($fila["cantidadReservada"]);
        $bloqueada = lv_numero($fila["cantidadBloqueada"]);

        return [
            "id" => intval($fila["id"]),
            "idExistencia" => intval($fila["id"]),
            "idProducto" => intval($fila["idProducto"]),
            "idLote" => $fila["idLote"] !== null ? intval($fila["idLote"]) : null,
            "idBodega" => intval($fila["idBodega"]),
            "codigoBodega" => $fila["codigoBodega"],
            "bodega" => $fila["bodega"],
            "idUbicacion" => $fila["idUbicacion"] !== null ? intval($fila["idUbicacion"]) : null,
            "codigoUbicacion" => $fila["codigoUbicacion"],
            "ubicacion" => $fila["ubicacion"],
            "cantidadDisponible" => $disponible,
            "cantidadReservada" => $reservada,
            "cantidadBloqueada" => $bloqueada,
            "cantidadTotal" => lv_numero($disponible + $reservada + $bloqueada),
            "created_at" => $fila["created_at"],
            "updated_at" => $fila["updated_at"]
        ];
    }, $filasExistencias);

    $filasMovimientos = lv_obtener_filas("
        SELECT
            m.id,
            m.idDocumento,
            m.idDocumentoDetalle,
            m.idProducto,
            m.idLote,
            m.idBodega,
            m.idUbicacion,
            m.tipoMovimiento,
            m.cantidad,
            m.saldoAnterior,
            m.saldoNuevo,
            m.fechaMovimiento,
            m.observacion,
            m.idUsuario,
            m.idUsuarioRegistro,
            m.idOperador,

            d.consecutivo,
            d.fechaDocumento,
            d.estadoProceso,

            td.codigo AS codigoTipoDocumento,
            td.nombre AS tipoDocumento,
            td.naturaleza,

            b.codigo AS codigoBodega,
            b.nombre AS bodega,

            u.codigo AS codigoUbicacion,
            u.nombre AS ubicacion,

            usu.nombre AS usuario,
            usr.nombre AS usuarioRegistro,

            io.codigo AS codigoOperador,
            io.nombreCompleto AS operador

        FROM InventarioMovimientos m
        LEFT JOIN InventarioDocumentos d
            ON d.id = m.idDocumento
        LEFT JOIN TiposDocumentoInventario td
            ON td.id = d.idTipoDocumento
        INNER JOIN BodegasInventario b
            ON b.id = m.idBodega
        LEFT JOIN UbicacionesInventario u
            ON u.id = m.idUbicacion
        LEFT JOIN usuarios usu
            ON usu.id = m.idUsuario
        LEFT JOIN usuarios usr
            ON usr.id = m.idUsuarioRegistro
        LEFT JOIN InventarioOperadores io
            ON io.id = m.idOperador
        WHERE m.idLote = $idLote
        ORDER BY m.fechaMovimiento DESC, m.id DESC
        LIMIT 20
    ");

    $ultimosMovimientos = array_map(function ($fila) {
        return [
            "id" => intval($fila["id"]),
            "idMovimiento" => intval($fila["id"]),
            "idDocumento" => $fila["idDocumento"] !== null ? intval($fila["idDocumento"]) : null,
            "idDocumentoDetalle" => $fila["idDocumentoDetalle"] !== null ? intval($fila["idDocumentoDetalle"]) : null,
            "idProducto" => intval($fila["idProducto"]),
            "idLote" => $fila["idLote"] !== null ? intval($fila["idLote"]) : null,
            "idBodega" => intval($fila["idBodega"]),
            "codigoBodega" => $fila["codigoBodega"],
            "bodega" => $fila["bodega"],
            "idUbicacion" => $fila["idUbicacion"] !== null ? intval($fila["idUbicacion"]) : null,
            "codigoUbicacion" => $fila["codigoUbicacion"],
            "ubicacion" => $fila["ubicacion"],
            "tipoMovimiento" => $fila["tipoMovimiento"],
            "cantidad" => lv_numero($fila["cantidad"]),
            "saldoAnterior" => lv_numero($fila["saldoAnterior"]),
            "saldoNuevo" => lv_numero($fila["saldoNuevo"]),
            "fechaMovimiento" => $fila["fechaMovimiento"],
            "observacion" => $fila["observacion"],
            "idUsuario" => $fila["idUsuario"] !== null ? intval($fila["idUsuario"]) : null,
            "usuario" => $fila["usuario"],
            "idUsuarioRegistro" => $fila["idUsuarioRegistro"] !== null ? intval($fila["idUsuarioRegistro"]) : null,
            "usuarioRegistro" => $fila["usuarioRegistro"],
            "idOperador" => $fila["idOperador"] !== null ? intval($fila["idOperador"]) : null,
            "codigoOperador" => $fila["codigoOperador"],
            "operador" => $fila["operador"],
            "consecutivo" => $fila["consecutivo"],
            "fechaDocumento" => $fila["fechaDocumento"],
            "estadoProceso" => $fila["estadoProceso"],
            "codigoTipoDocumento" => $fila["codigoTipoDocumento"],
            "tipoDocumento" => $fila["tipoDocumento"],
            "naturaleza" => $fila["naturaleza"]
        ];
    }, $filasMovimientos);

    lv_responder(
        "si",
        "Detalle del lote consultado correctamente",
        [
            "lote" => $lote,
            "existencias" => $existencias,
            "ultimosMovimientos" => $ultimosMovimientos
        ],
        [
            "totalExistencias" => count($existencias),
            "totalMovimientosMostrados" => count($ultimosMovimientos)
        ]
    );
} catch (Throwable $e) {
    lv_responder(
        "no",
        "Error consultando el detalle del lote",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
