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
    echo json_encode(array_merge([
        "rpta" => $rpta,
        "mensaje" => $mensaje,
        "data" => $data
    ], $extra), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

if (!isset($conexion) || !$conexion instanceof mysqli) {
    responder("no", "No se encontró la conexión a la base de datos", [], [], 500);
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
    if (isset($_GET[$nombre])) return $_GET[$nombre];
    if (isset($_POST[$nombre])) return $_POST[$nombre];
    $json = entradaJson();
    return array_key_exists($nombre, $json) ? $json[$nombre] : $default;
}

function obtenerFila($sql)
{
    global $conexion;
    $resultado = $conexion->query($sql);
    if (!$resultado) throw new Exception($conexion->error);
    return $resultado->fetch_assoc() ?: null;
}

function resolverOperador($idOperador, $idUsuario)
{
    if ($idOperador > 0) {
        return obtenerFila("
            SELECT id, idUsuario, codigo, nombreCompleto, nombre, apellido
            FROM InventarioOperadores
            WHERE id = $idOperador AND estado = 1
            LIMIT 1
        ");
    }
    if ($idUsuario > 0) {
        return obtenerFila("
            SELECT id, idUsuario, codigo, nombreCompleto, nombre, apellido
            FROM InventarioOperadores
            WHERE idUsuario = $idUsuario AND estado = 1
            LIMIT 1
        ");
    }
    return null;
}

try {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        responder("no", "Método no permitido. Debe utilizar POST", [], [], 405);
    }

    $idSolicitudConteo = intval(parametro("idSolicitudConteo", parametro("id", 0)));
    $idOperadorEntrada = intval(parametro("idOperador", 0));
    $idUsuarioEntrada = intval(parametro("idUsuario", 0));

    if ($idSolicitudConteo <= 0) {
        responder("no", "Debe indicar el conteo de la bodega", [], [], 400);
    }

    $operador = resolverOperador($idOperadorEntrada, $idUsuarioEntrada);
    if (!$operador) {
        responder("no", "No se encontró un operador activo asociado al usuario", [], [], 404);
    }

    $idOperador = intval($operador["id"]);
    $idUsuario = intval($operador["idUsuario"] ?? 0);

    $conexion->begin_transaction();

    try {
        $conteo = obtenerFila("
            SELECT
                s.id,
                s.codigo,
                s.idOrdenConteo,
                s.idBodega,
                s.idOperador,
                s.idOperadorAsignado,
                s.estadoProceso,
                s.fechaInicioConteo,
                o.codigo AS codigoOrden,
                o.nombre AS nombreOrden,
                o.estadoProceso AS estadoOrden,
                o.fechaInicio,
                o.fechaLimite,
                b.codigo AS codigoBodega,
                b.nombre AS bodega,
                EXISTS (
                    SELECT 1
                    FROM InventarioConteoResponsables cr
                    WHERE cr.idSolicitudConteo = s.id
                      AND cr.idOperador = $idOperador
                      AND cr.estado = 1
                ) AS asignado
            FROM InventarioSolicitudesConteo s
            INNER JOIN InventarioOrdenesConteo o ON o.id = s.idOrdenConteo
            INNER JOIN BodegasInventario b ON b.id = s.idBodega
            WHERE s.id = $idSolicitudConteo
            LIMIT 1
            FOR UPDATE
        ");

        if (!$conteo) {
            $conexion->rollback();
            responder("no", "El conteo de bodega no existe", [], [], 404);
        }

        $asignado = intval($conteo["asignado"]) === 1
            || intval($conteo["idOperador"]) === $idOperador
            || intval($conteo["idOperadorAsignado"]) === $idOperador;

        if (!$asignado) {
            $conexion->rollback();
            responder("no", "El operador no está asignado a este conteo", [], [], 403);
        }

        if ($conteo["estadoProceso"] === "EN_PROCESO") {
            $conexion->commit();
            responder(
                "si",
                "El conteo ya se encuentra en proceso",
                [
                    "idSolicitudConteo" => intval($conteo["id"]),
                    "codigo" => $conteo["codigo"],
                    "estadoProceso" => "EN_PROCESO",
                    "fechaInicioConteo" => $conteo["fechaInicioConteo"]
                ]
            );
        }

        if (!in_array($conteo["estadoProceso"], ["PENDIENTE", "DEVUELTO"], true)) {
            $conexion->rollback();
            responder(
                "no",
                "El conteo no se puede iniciar en su estado actual",
                [],
                ["estadoProceso" => $conteo["estadoProceso"]],
                409
            );
        }

        if (!in_array($conteo["estadoOrden"], ["ABIERTA", "EN_CONTEO"], true)) {
            $conexion->rollback();
            responder(
                "no",
                "La orden general todavía no está habilitada para conteo",
                [],
                ["estadoOrden" => $conteo["estadoOrden"]],
                409
            );
        }

        $ahora = time();
        if ($conteo["fechaInicio"] && $ahora < strtotime($conteo["fechaInicio"])) {
            $conexion->rollback();
            responder(
                "no",
                "El periodo de conteo todavía no ha iniciado",
                [],
                ["fechaInicio" => $conteo["fechaInicio"]],
                409
            );
        }

        if ($conteo["fechaLimite"] && $ahora > strtotime($conteo["fechaLimite"])) {
            $conexion->rollback();
            responder(
                "no",
                "El periodo permitido para realizar el conteo ya finalizó",
                [],
                ["fechaLimite" => $conteo["fechaLimite"]],
                409
            );
        }

        $estadoAnterior = $conteo["estadoProceso"];

        $stmt = $conexion->prepare("
            UPDATE InventarioSolicitudesConteo
            SET
                estadoProceso = 'EN_PROCESO',
                fechaInicioConteo = COALESCE(fechaInicioConteo, NOW()),
                fechaUltimoGuardado = NOW(),
                resultadoVisible = 0
            WHERE id = ?
        ");
        if (!$stmt) throw new Exception($conexion->error);
        $stmt->bind_param("i", $idSolicitudConteo);
        if (!$stmt->execute()) throw new Exception($stmt->error);
        $stmt->close();

        $stmtOrden = $conexion->prepare("
            UPDATE InventarioOrdenesConteo
            SET estadoProceso = 'EN_CONTEO'
            WHERE id = ?
              AND estadoProceso = 'ABIERTA'
        ");
        if (!$stmtOrden) throw new Exception($conexion->error);
        $idOrdenConteo = intval($conteo["idOrdenConteo"]);
        $stmtOrden->bind_param("i", $idOrdenConteo);
        if (!$stmtOrden->execute()) throw new Exception($stmtOrden->error);
        $stmtOrden->close();

        $stmtHistorial = $conexion->prepare("
            INSERT INTO InventarioConteoHistorial
            (
                idOrdenConteo,
                idSolicitudConteo,
                accion,
                estadoAnterior,
                estadoNuevo,
                descripcion,
                idUsuario,
                idOperador
            )
            VALUES
            (
                ?, ?, 'CONTEO_INICIADO', ?, 'EN_PROCESO',
                'Inicio del conteo físico de la bodega',
                NULLIF(?, 0), ?
            )
        ");
        if (!$stmtHistorial) throw new Exception($conexion->error);
        $stmtHistorial->bind_param(
            "iisii",
            $idOrdenConteo,
            $idSolicitudConteo,
            $estadoAnterior,
            $idUsuario,
            $idOperador
        );
        if (!$stmtHistorial->execute()) throw new Exception($stmtHistorial->error);
        $stmtHistorial->close();

        $resumen = obtenerFila("
            SELECT
                COUNT(*) AS totalDetalles,
                SUM(CASE WHEN conteoRealizado = 1 THEN 1 ELSE 0 END) AS totalContados
            FROM InventarioConteoDetalle
            WHERE idSolicitudConteo = $idSolicitudConteo
        ");

        $conexion->commit();

        responder(
            "si",
            "Conteo iniciado correctamente",
            [
                "idSolicitudConteo" => $idSolicitudConteo,
                "codigo" => $conteo["codigo"],
                "idOrdenConteo" => $idOrdenConteo,
                "codigoOrden" => $conteo["codigoOrden"],
                "nombreOrden" => $conteo["nombreOrden"],
                "idBodega" => intval($conteo["idBodega"]),
                "codigoBodega" => $conteo["codigoBodega"],
                "bodega" => $conteo["bodega"],
                "estadoProceso" => "EN_PROCESO",
                "fechaInicioConteo" => date("Y-m-d H:i:s"),
                "totalDetalles" => intval($resumen["totalDetalles"] ?? 0),
                "totalContados" => intval($resumen["totalContados"] ?? 0)
            ]
        );
    } catch (Throwable $e) {
        $conexion->rollback();
        throw $e;
    }
} catch (Throwable $e) {
    responder("no", "Error iniciando el conteo de la bodega", [], ["error" => $e->getMessage()], 500);
}
?>
