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

function responder($rpta, $mensaje, $data = [], $extra = [], $codigoHttp = 200)
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

if (!isset($conexion) || !$conexion instanceof mysqli) {
    responder(
        "no",
        "No se encontró la conexión a la base de datos",
        [],
        ["error" => "La variable \$conexion no está disponible"],
        500
    );
}

$conexion->set_charset("utf8mb4");

function limpiarTexto($valor)
{
    return trim((string)($valor ?? ""));
}

function entradaJson()
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

function parametro($nombre, $default = "")
{
    if (isset($_GET[$nombre])) {
        return limpiarTexto($_GET[$nombre]);
    }

    if (isset($_POST[$nombre])) {
        return limpiarTexto($_POST[$nombre]);
    }

    $json = entradaJson();

    if (array_key_exists($nombre, $json)) {
        return is_string($json[$nombre])
            ? limpiarTexto($json[$nombre])
            : $json[$nombre];
    }

    return $default;
}

function esc($valor)
{
    global $conexion;

    return $conexion->real_escape_string((string)($valor ?? ""));
}

function obtenerFila($sql)
{
    global $conexion;

    $resultado = $conexion->query($sql);

    if (!$resultado) {
        throw new Exception($conexion->error);
    }

    return $resultado->fetch_assoc() ?: null;
}

function obtenerFilas($sql)
{
    global $conexion;

    $resultado = $conexion->query($sql);

    if (!$resultado) {
        throw new Exception($conexion->error);
    }

    $data = [];

    while ($fila = $resultado->fetch_assoc()) {
        $data[] = $fila;
    }

    return $data;
}

function numeroSeguro($valor)
{
    return round(floatval($valor ?? 0), 3);
}

function fechaValida($valor, $permitirHora = true)
{
    $valor = limpiarTexto($valor);

    if ($valor === "") {
        return "";
    }

    if (!$permitirHora) {
        $fecha = DateTime::createFromFormat("Y-m-d", substr($valor, 0, 10));

        return (
            $fecha
            && $fecha->format("Y-m-d") === substr($valor, 0, 10)
        )
            ? $fecha->format("Y-m-d")
            : "";
    }

    $valor = str_replace("T", " ", $valor);

    foreach (["Y-m-d H:i:s", "Y-m-d H:i", "Y-m-d"] as $formato) {
        $fecha = DateTime::createFromFormat($formato, $valor);

        if ($fecha && $fecha->format($formato) === $valor) {
            return $fecha->format("Y-m-d H:i:s");
        }
    }

    return "";
}


try {
    if ($_SERVER["REQUEST_METHOD"] !== "GET") {
        responder(
            "no",
            "Método no permitido. Debe utilizar GET",
            [],
            [],
            405
        );
    }

    $bodegas = obtenerFilas("
        SELECT
            id,
            codigo,
            nombre,
            descripcion,
            estado
        FROM BodegasInventario
        WHERE estado = 1
        ORDER BY nombre ASC
    ");

    $bodegasData = array_map(function ($fila) {
        return [
            "id" => intval($fila["id"]),
            "idBodega" => intval($fila["id"]),
            "codigo" => $fila["codigo"],
            "nombre" => $fila["nombre"],
            "descripcion" => $fila["descripcion"],
            "estado" => intval($fila["estado"])
        ];
    }, $bodegas);

    $operadores = obtenerFilas("
        SELECT
            id,
            idUsuario,
            codigo,
            documento,
            nombre,
            apellido,
            nombreCompleto,
            cargo,
            telefono,
            correo,
            estado
        FROM InventarioOperadores
        WHERE estado = 1
        ORDER BY
            COALESCE(NULLIF(nombreCompleto, ''), CONCAT(nombre, ' ', COALESCE(apellido, ''))) ASC
    ");

    $operadoresData = array_map(function ($fila) {
        $nombreCompleto = limpiarTexto($fila["nombreCompleto"]);

        if ($nombreCompleto === "") {
            $nombreCompleto = trim(
                limpiarTexto($fila["nombre"]) . " " . limpiarTexto($fila["apellido"])
            );
        }

        return [
            "id" => intval($fila["id"]),
            "idOperador" => intval($fila["id"]),
            "idUsuario" => $fila["idUsuario"] !== null
                ? intval($fila["idUsuario"])
                : null,
            "codigo" => $fila["codigo"],
            "documento" => $fila["documento"],
            "nombre" => $fila["nombre"],
            "apellido" => $fila["apellido"],
            "nombreCompleto" => $nombreCompleto,
            "cargo" => $fila["cargo"],
            "telefono" => $fila["telefono"],
            "correo" => $fila["correo"],
            "estado" => intval($fila["estado"])
        ];
    }, $operadores);

    $resumen = obtenerFila("
        SELECT
            COUNT(*) AS totalOrdenes,
            SUM(CASE WHEN estadoProceso = 'BORRADOR' THEN 1 ELSE 0 END) AS borradores,
            SUM(CASE WHEN estadoProceso = 'PROGRAMADA' THEN 1 ELSE 0 END) AS programadas,
            SUM(CASE WHEN estadoProceso IN ('ABIERTA', 'EN_CONTEO') THEN 1 ELSE 0 END) AS activas,
            SUM(CASE WHEN estadoProceso = 'EN_ANALISIS' THEN 1 ELSE 0 END) AS enAnalisis,
            SUM(CASE WHEN estadoProceso = 'FINALIZADA' THEN 1 ELSE 0 END) AS finalizadas
        FROM InventarioOrdenesConteo
    ");

    responder(
        "si",
        "Datos para órdenes de conteo consultados correctamente",
        [
            "bodegas" => $bodegasData,
            "operadores" => $operadoresData,
            "tiposConteo" => [
                [
                    "valor" => "CIEGO",
                    "nombre" => "CIEGO",
                    "descripcion" => "El responsable no visualiza la existencia teórica durante el conteo."
                ],
                [
                    "valor" => "GUIADO",
                    "nombre" => "GUIADO",
                    "descripcion" => "El responsable puede visualizar la existencia teórica."
                ]
            ],
            "estadosOrden" => [
                ["valor" => "BORRADOR", "nombre" => "BORRADOR"],
                ["valor" => "PROGRAMADA", "nombre" => "PROGRAMADA"],
                ["valor" => "ABIERTA", "nombre" => "ABIERTA"],
                ["valor" => "EN_CONTEO", "nombre" => "EN CONTEO"],
                ["valor" => "EN_ANALISIS", "nombre" => "EN ANÁLISIS"],
                ["valor" => "FINALIZADA", "nombre" => "FINALIZADA"],
                ["valor" => "ANULADA", "nombre" => "ANULADA"]
            ],
            "estadosConteoBodega" => [
                ["valor" => "PENDIENTE", "nombre" => "PENDIENTE"],
                ["valor" => "EN_PROCESO", "nombre" => "EN PROCESO"],
                ["valor" => "ENVIADO", "nombre" => "ENVIADO"],
                ["valor" => "DEVUELTO", "nombre" => "DEVUELTO"],
                ["valor" => "APROBADO", "nombre" => "APROBADO"],
                ["valor" => "FINALIZADO", "nombre" => "FINALIZADO"],
                ["valor" => "ANULADO", "nombre" => "ANULADO"]
            ],
            "configuracion" => [
                "resultadoVisiblePorDefecto" => 0,
                "permiteMultiplesResponsables" => 1,
                "exportacionSoloAdministrativa" => 1
            ],
            "resumen" => [
                "totalOrdenes" => intval($resumen["totalOrdenes"] ?? 0),
                "borradores" => intval($resumen["borradores"] ?? 0),
                "programadas" => intval($resumen["programadas"] ?? 0),
                "activas" => intval($resumen["activas"] ?? 0),
                "enAnalisis" => intval($resumen["enAnalisis"] ?? 0),
                "finalizadas" => intval($resumen["finalizadas"] ?? 0)
            ]
        ]
    );
} catch (Throwable $e) {
    responder(
        "no",
        "Error consultando los datos para órdenes de conteo",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
