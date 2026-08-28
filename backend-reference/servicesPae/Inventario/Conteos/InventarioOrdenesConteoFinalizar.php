<?php
/* HOTFIX PHP 7.3 - CONTEOS FISICOS - 2026-07-26 */
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
    if ($entrada !== null) return $entrada;

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

function valorBooleano($valor)
{
    if (is_bool($valor)) return $valor;
    return in_array(strtolower(limpiarTexto($valor)), ["1", "true", "si", "sí", "yes"], true);
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
    if (!$resultado) throw new Exception($conexion->error);
    return $resultado->fetch_assoc() ?: null;
}

function obtenerFilas($sql)
{
    global $conexion;
    $resultado = $conexion->query($sql);
    if (!$resultado) throw new Exception($conexion->error);

    $data = [];
    while ($fila = $resultado->fetch_assoc()) $data[] = $fila;
    return $data;
}

function validarUsuarioAdministrativo($idUsuario)
{
    if ($idUsuario <= 0) {
        responder("no", "Debe indicar el usuario administrativo", [], [], 400);
    }

    $usuario = obtenerFila("
        SELECT id, nombre, correo, rol, estado
        FROM usuarios
        WHERE id = $idUsuario
        LIMIT 1
    ");

    if (!$usuario || intval($usuario["estado"]) !== 1) {
        responder("no", "El usuario administrativo no existe o está inactivo", [], [], 403);
    }

    /*
     * Control opcional por roles.
     * Para activarlo, definir en conexion.php, por ejemplo:
     * define('INVENTARIO_ROLES_ADMIN_CONTEOS', '1,2');
     */
    if (defined("INVENTARIO_ROLES_ADMIN_CONTEOS")) {
        $config = constant("INVENTARIO_ROLES_ADMIN_CONTEOS");
        $roles = is_array($config) ? $config : explode(",", (string)$config);
        $roles = array_values(array_filter(array_map("intval", $roles), function ($id) { return $id > 0; }));

        if (count($roles) > 0 && !in_array(intval($usuario["rol"]), $roles, true)) {
            responder("no", "El usuario no tiene permisos administrativos para conteos físicos", [], [], 403);
        }
    }

    return $usuario;
}

try {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        responder("no", "Método no permitido. Debe utilizar POST", [], [], 405);
    }

    $idOrdenConteo = intval(parametro("idOrdenConteo", parametro("id", 0)));
    $idUsuario = intval(parametro("idUsuario", parametro("idUsuarioAdministrador", 0)));
    $observacion = limpiarTexto(parametro("observacion", parametro("observacionFinalizacion", "")));
    $publicarResultados = valorBooleano(parametro("publicarResultados", true));

    if ($idOrdenConteo <= 0) responder("no", "Debe indicar la orden de conteo", [], [], 400);
    validarUsuarioAdministrativo($idUsuario);

    $conexion->begin_transaction();
    try {
        $orden = obtenerFila("
            SELECT id, codigo, nombre, estadoProceso, mostrarResultadoBodegas
            FROM InventarioOrdenesConteo
            WHERE id = $idOrdenConteo
            LIMIT 1
            FOR UPDATE
        ");
        if (!$orden) {
            $conexion->rollback();
            responder("no", "La orden de conteo no existe", [], [], 404);
        }

        if ($orden["estadoProceso"] === "FINALIZADA") {
            if ($publicarResultados && intval($orden["mostrarResultadoBodegas"]) !== 1) {
                $conexion->query("
                    UPDATE InventarioOrdenesConteo
                    SET mostrarResultadoBodegas = 1,
                        fechaPublicacionResultados = COALESCE(fechaPublicacionResultados, NOW())
                    WHERE id = $idOrdenConteo
                ");
                $conexion->query("
                    UPDATE InventarioSolicitudesConteo
                    SET resultadoVisible = 1
                    WHERE idOrdenConteo = $idOrdenConteo AND estadoProceso = 'FINALIZADO'
                ");
            }
            $conexion->commit();
            responder("si", "La orden ya se encuentra finalizada", [
                "idOrdenConteo" => $idOrdenConteo,
                "estadoProceso" => "FINALIZADA",
                "resultadosPublicados" => $publicarResultados || intval($orden["mostrarResultadoBodegas"]) === 1
            ]);
        }

        if ($orden["estadoProceso"] !== "EN_ANALISIS") {
            $conexion->rollback();
            responder("no", "La orden debe estar EN_ANALISIS para finalizarla", [], ["estadoProceso" => $orden["estadoProceso"]], 409);
        }

        $estados = obtenerFila("
            SELECT
                COUNT(*) AS totalBodegas,
                SUM(CASE WHEN estadoProceso = 'APROBADO' THEN 1 ELSE 0 END) AS aprobadas,
                SUM(CASE WHEN estadoProceso = 'ANULADO' THEN 1 ELSE 0 END) AS anuladas,
                SUM(CASE WHEN estadoProceso NOT IN ('APROBADO', 'ANULADO') THEN 1 ELSE 0 END) AS pendientes
            FROM InventarioSolicitudesConteo
            WHERE idOrdenConteo = $idOrdenConteo
        ");
        $totalBodegas = intval($estados["totalBodegas"] ?? 0);
        $aprobadas = intval($estados["aprobadas"] ?? 0);
        $pendientes = intval($estados["pendientes"] ?? 0);

        if ($totalBodegas === 0 || $aprobadas === 0) {
            $conexion->rollback();
            responder("no", "La orden no tiene conteos aprobados para finalizar", [], [], 409);
        }
        if ($pendientes > 0) {
            $conexion->rollback();
            responder("no", "Aún existen bodegas pendientes de aprobación", [], ["bodegasPendientes" => $pendientes], 409);
        }

        $analisisPendiente = obtenerFila("
            SELECT
                SUM(CASE WHEN COALESCE(d.estadoAnalisis, 'PENDIENTE') IN ('PENDIENTE', 'OBSERVADO') THEN 1 ELSE 0 END) AS total
            FROM InventarioConteoDetalle d
            INNER JOIN InventarioSolicitudesConteo s ON s.id = d.idSolicitudConteo
            WHERE s.idOrdenConteo = $idOrdenConteo
              AND s.estadoProceso = 'APROBADO'
        ");
        if (intval($analisisPendiente["total"] ?? 0) > 0) {
            $conexion->rollback();
            responder("no", "Existen productos con análisis pendiente u observado", [], ["totalPendientesAnalisis" => intval($analisisPendiente["total"])], 409);
        }

        $publicar = $publicarResultados ? 1 : 0;
        $stmt = $conexion->prepare("
            UPDATE InventarioOrdenesConteo
            SET estadoProceso = 'FINALIZADA',
                fechaFinalizacionAnalisis = NOW(),
                idUsuarioAnaliza = COALESCE(idUsuarioAnaliza, ?),
                idUsuarioFinaliza = ?,
                mostrarResultadoBodegas = ?,
                fechaPublicacionResultados = CASE WHEN ? = 1 THEN NOW() ELSE NULL END,
                observacion = CASE
                    WHEN ? = '' THEN observacion
                    WHEN observacion IS NULL OR observacion = '' THEN ?
                    ELSE CONCAT(observacion, '\nCierre: ', ?)
                END
            WHERE id = ?
        ");
        if (!$stmt) throw new Exception($conexion->error);
        $stmt->bind_param("iiiisssi", $idUsuario, $idUsuario, $publicar, $publicar, $observacion, $observacion, $observacion, $idOrdenConteo);
        if (!$stmt->execute()) throw new Exception($stmt->error);
        $stmt->close();

        $conexion->query("
            UPDATE InventarioSolicitudesConteo
            SET estadoProceso = 'FINALIZADO',
                fechaFinalizacion = NOW(),
                resultadoVisible = $publicar
            WHERE idOrdenConteo = $idOrdenConteo
              AND estadoProceso = 'APROBADO'
        ");
        if ($conexion->errno) throw new Exception($conexion->error);

        $resumen = obtenerFila("
            SELECT
                COUNT(*) AS totalRegistros,
                SUM(CASE WHEN ABS(d.diferencia) < 0.0005 THEN 1 ELSE 0 END) AS sinDiferencia,
                SUM(CASE WHEN d.diferencia > 0.0005 THEN 1 ELSE 0 END) AS sobrantes,
                SUM(CASE WHEN d.diferencia < -0.0005 THEN 1 ELSE 0 END) AS faltantes,
                ROUND(SUM(d.cantidadSistema), 3) AS cantidadSistema,
                ROUND(SUM(d.cantidadFisica), 3) AS cantidadFisica,
                ROUND(SUM(d.diferencia), 3) AS diferencia
            FROM InventarioConteoDetalle d
            INNER JOIN InventarioSolicitudesConteo s ON s.id = d.idSolicitudConteo
            WHERE s.idOrdenConteo = $idOrdenConteo
              AND s.estadoProceso = 'FINALIZADO'
        ");

        $datos = json_encode([
            "publicarResultados" => $publicarResultados,
            "resumen" => $resumen
        ], JSON_UNESCAPED_UNICODE);
        $stmtHist = $conexion->prepare("
            INSERT INTO InventarioConteoHistorial
            (idOrdenConteo, accion, estadoAnterior, estadoNuevo, descripcion, datos, idUsuario)
            VALUES (?, 'ORDEN_FINALIZADA', 'EN_ANALISIS', 'FINALIZADA', ?, ?, ?)
        ");
        if (!$stmtHist) throw new Exception($conexion->error);
        $stmtHist->bind_param("issi", $idOrdenConteo, $observacion, $datos, $idUsuario);
        if (!$stmtHist->execute()) throw new Exception($stmtHist->error);
        $stmtHist->close();

        $conexion->commit();

        $dataResumen = [];
        foreach (($resumen ?: []) as $campo => $valor) {
            $dataResumen[$campo] = in_array($campo, ["cantidadSistema", "cantidadFisica", "diferencia"], true)
                ? round(floatval($valor ?? 0), 3)
                : intval($valor ?? 0);
        }

        responder("si", "Orden de conteo finalizada correctamente", [
            "idOrdenConteo" => $idOrdenConteo,
            "codigo" => $orden["codigo"],
            "estadoProceso" => "FINALIZADA",
            "resultadosPublicados" => $publicarResultados,
            "resumen" => $dataResumen,
            "nota" => "La finalización del análisis no modifica existencias ni genera movimientos de inventario"
        ]);
    } catch (Throwable $e) {
        $conexion->rollback();
        throw $e;
    }
} catch (Throwable $e) {
    responder("no", "Error finalizando la orden de conteo", [], ["error" => $e->getMessage()], 500);
}
?>
