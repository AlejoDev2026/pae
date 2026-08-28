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

    $idSolicitudConteo = intval(parametro("idSolicitudConteo", parametro("id", 0)));
    $idUsuario = intval(parametro("idUsuario", parametro("idUsuarioAdministrador", 0)));
    $observacion = limpiarTexto(parametro("observacion", parametro("observacionRevision", "")));

    if ($idSolicitudConteo <= 0) responder("no", "Debe indicar el conteo de la bodega", [], [], 400);
    if ($observacion === "") responder("no", "Debe indicar el motivo de la devolución", [], [], 400);
    validarUsuarioAdministrativo($idUsuario);

    $conexion->begin_transaction();
    try {
        $conteo = obtenerFila("
            SELECT s.id, s.codigo, s.idOrdenConteo, s.estadoProceso, b.nombre AS bodega, o.estadoProceso AS estadoOrden
            FROM InventarioSolicitudesConteo s
            INNER JOIN InventarioOrdenesConteo o ON o.id = s.idOrdenConteo
            INNER JOIN BodegasInventario b ON b.id = s.idBodega
            WHERE s.id = $idSolicitudConteo
            LIMIT 1
            FOR UPDATE
        ");
        if (!$conteo) {
            $conexion->rollback();
            responder("no", "El conteo de la bodega no existe", [], [], 404);
        }
        if (!in_array($conteo["estadoOrden"], ["EN_ANALISIS", "EN_CONTEO"], true)) {
            $conexion->rollback();
            responder("no", "La orden no permite devolver conteos en su estado actual", [], ["estadoOrden" => $conteo["estadoOrden"]], 409);
        }
        if (!in_array($conteo["estadoProceso"], ["ENVIADO", "APROBADO"], true)) {
            $conexion->rollback();
            responder("no", "Solo se pueden devolver conteos enviados o aprobados", [], ["estadoProceso" => $conteo["estadoProceso"]], 409);
        }

        $estadoAnterior = $conteo["estadoProceso"];
        $stmt = $conexion->prepare("
            UPDATE InventarioSolicitudesConteo
            SET estadoProceso = 'DEVUELTO',
                fechaRevision = NOW(),
                idUsuarioRevisa = ?,
                observacionRevision = ?,
                numeroRevision = numeroRevision + 1,
                resultadoVisible = 0
            WHERE id = ?
        ");
        if (!$stmt) throw new Exception($conexion->error);
        $stmt->bind_param("isi", $idUsuario, $observacion, $idSolicitudConteo);
        if (!$stmt->execute()) throw new Exception($stmt->error);
        $stmt->close();

        $idOrdenConteo = intval($conteo["idOrdenConteo"]);
        $conexion->query("
            UPDATE InventarioOrdenesConteo
            SET estadoProceso = 'EN_CONTEO', mostrarResultadoBodegas = 0
            WHERE id = $idOrdenConteo
        ");

        $stmtHist = $conexion->prepare("
            INSERT INTO InventarioConteoHistorial
            (idOrdenConteo, idSolicitudConteo, accion, estadoAnterior, estadoNuevo, descripcion, idUsuario)
            VALUES (?, ?, 'CONTEO_DEVUELTO', ?, 'DEVUELTO', ?, ?)
        ");
        if (!$stmtHist) throw new Exception($conexion->error);
        $stmtHist->bind_param("iissi", $idOrdenConteo, $idSolicitudConteo, $estadoAnterior, $observacion, $idUsuario);
        if (!$stmtHist->execute()) throw new Exception($stmtHist->error);
        $stmtHist->close();

        $conexion->commit();
        responder("si", "Conteo devuelto para corrección", [
            "idOrdenConteo" => $idOrdenConteo,
            "idSolicitudConteo" => $idSolicitudConteo,
            "bodega" => $conteo["bodega"],
            "estadoProceso" => "DEVUELTO",
            "observacionRevision" => $observacion
        ]);
    } catch (Throwable $e) {
        $conexion->rollback();
        throw $e;
    }
} catch (Throwable $e) {
    responder("no", "Error devolviendo el conteo", [], ["error" => $e->getMessage()], 500);
}
?>
