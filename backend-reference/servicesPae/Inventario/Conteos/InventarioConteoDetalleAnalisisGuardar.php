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

function normalizarDetalles($entrada)
{
    if (is_string($entrada)) {
        $json = json_decode($entrada, true);
        $entrada = is_array($json) ? $json : [];
    }
    return is_array($entrada) ? $entrada : [];
}

try {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        responder("no", "Método no permitido. Debe utilizar POST", [], [], 405);
    }

    $idOrdenConteo = intval(parametro("idOrdenConteo", 0));
    $idUsuario = intval(parametro("idUsuario", parametro("idUsuarioAdministrador", 0)));
    $detalles = normalizarDetalles(parametro("detalles", []));

    if ($idOrdenConteo <= 0) responder("no", "Debe indicar la orden de conteo", [], [], 400);
    if (count($detalles) === 0) responder("no", "Debe enviar por lo menos un detalle para analizar", [], [], 400);

    validarUsuarioAdministrativo($idUsuario);
    $estadosValidos = ["PENDIENTE", "VALIDADO", "OBSERVADO", "AJUSTADO"];

    $conexion->begin_transaction();
    try {
        $orden = obtenerFila("
            SELECT id, codigo, estadoProceso
            FROM InventarioOrdenesConteo
            WHERE id = $idOrdenConteo
            LIMIT 1
            FOR UPDATE
        ");
        if (!$orden) {
            $conexion->rollback();
            responder("no", "La orden de conteo no existe", [], [], 404);
        }
        if ($orden["estadoProceso"] !== "EN_ANALISIS") {
            $conexion->rollback();
            responder("no", "La orden debe estar EN_ANALISIS para registrar la revisión", [], ["estadoProceso" => $orden["estadoProceso"]], 409);
        }

        $stmt = $conexion->prepare("
            UPDATE InventarioConteoDetalle d
            INNER JOIN InventarioSolicitudesConteo s ON s.id = d.idSolicitudConteo
            SET
                d.estadoAnalisis = ?,
                d.observacionAnalisis = NULLIF(?, ''),
                d.idUsuarioAnaliza = ?,
                d.fechaAnalisis = NOW()
            WHERE d.id = ?
              AND s.idOrdenConteo = ?
        ");
        if (!$stmt) throw new Exception($conexion->error);

        $guardados = [];
        $solicitudesAfectadas = [];

        foreach ($detalles as $item) {
            if (!is_array($item)) continue;

            $idDetalle = intval($item["idDetalleConteo"] ?? $item["id"] ?? 0);
            $estado = strtoupper(limpiarTexto($item["estadoAnalisis"] ?? "PENDIENTE"));
            $observacion = limpiarTexto($item["observacionAnalisis"] ?? $item["observacion"] ?? "");

            if ($idDetalle <= 0 || !in_array($estado, $estadosValidos, true)) continue;
            if ($estado === "OBSERVADO" && $observacion === "") {
                throw new Exception("Los detalles observados deben incluir una observación administrativa");
            }

            $actual = obtenerFila("
                SELECT
                    d.id,
                    d.idSolicitudConteo,
                    d.diferencia,
                    d.idDocumentoDetalleAjuste,
                    s.estadoProceso
                FROM InventarioConteoDetalle d
                INNER JOIN InventarioSolicitudesConteo s ON s.id = d.idSolicitudConteo
                WHERE d.id = $idDetalle
                  AND s.idOrdenConteo = $idOrdenConteo
                LIMIT 1
                FOR UPDATE
            ");
            if (!$actual) throw new Exception("Uno de los detalles no pertenece a la orden indicada");
            if (!in_array($actual["estadoProceso"], ["ENVIADO", "APROBADO"], true)) {
                throw new Exception("El conteo de la bodega aún no está disponible para análisis");
            }
            if ($estado === "AJUSTADO" && empty($actual["idDocumentoDetalleAjuste"])) {
                throw new Exception("Un detalle solo puede marcarse AJUSTADO cuando tenga un documento de ajuste relacionado");
            }

            $stmt->bind_param("ssiii", $estado, $observacion, $idUsuario, $idDetalle, $idOrdenConteo);
            if (!$stmt->execute()) throw new Exception($stmt->error);

            $idSolicitud = intval($actual["idSolicitudConteo"]);
            $solicitudesAfectadas[$idSolicitud] = $idSolicitud;
            $guardados[] = [
                "idDetalleConteo" => $idDetalle,
                "idSolicitudConteo" => $idSolicitud,
                "estadoAnalisis" => $estado,
                "observacionAnalisis" => $observacion
            ];
        }
        $stmt->close();

        if (count($guardados) === 0) throw new Exception("No se encontraron detalles válidos para actualizar");

        foreach ($solicitudesAfectadas as $idSolicitud) {
            $conexion->query("
                UPDATE InventarioSolicitudesConteo
                SET fechaRevision = NOW(), idUsuarioRevisa = $idUsuario
                WHERE id = $idSolicitud
            ");
        }

        $datos = json_encode(["detalles" => $guardados], JSON_UNESCAPED_UNICODE);
        $stmtHist = $conexion->prepare("
            INSERT INTO InventarioConteoHistorial
            (idOrdenConteo, accion, estadoAnterior, estadoNuevo, descripcion, datos, idUsuario)
            VALUES (?, 'ANALISIS_DETALLE_GUARDADO', 'EN_ANALISIS', 'EN_ANALISIS',
                    'Registro de revisión administrativa por detalle', ?, ?)
        ");
        if (!$stmtHist) throw new Exception($conexion->error);
        $stmtHist->bind_param("isi", $idOrdenConteo, $datos, $idUsuario);
        if (!$stmtHist->execute()) throw new Exception($stmtHist->error);
        $stmtHist->close();

        $conexion->query("
            UPDATE InventarioOrdenesConteo
            SET idUsuarioAnaliza = COALESCE(idUsuarioAnaliza, $idUsuario),
                fechaInicioAnalisis = COALESCE(fechaInicioAnalisis, NOW())
            WHERE id = $idOrdenConteo
        ");

        $resumen = obtenerFila("
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN COALESCE(d.estadoAnalisis, 'PENDIENTE') = 'PENDIENTE' THEN 1 ELSE 0 END) AS pendientes,
                SUM(CASE WHEN d.estadoAnalisis = 'VALIDADO' THEN 1 ELSE 0 END) AS validados,
                SUM(CASE WHEN d.estadoAnalisis = 'OBSERVADO' THEN 1 ELSE 0 END) AS observados,
                SUM(CASE WHEN d.estadoAnalisis = 'AJUSTADO' THEN 1 ELSE 0 END) AS ajustados
            FROM InventarioConteoDetalle d
            INNER JOIN InventarioSolicitudesConteo s ON s.id = d.idSolicitudConteo
            WHERE s.idOrdenConteo = $idOrdenConteo
        ");

        $conexion->commit();
        responder("si", "Análisis administrativo guardado correctamente", [
            "idOrdenConteo" => $idOrdenConteo,
            "totalGuardados" => count($guardados),
            "guardados" => $guardados,
            "resumen" => array_map("intval", $resumen ?: [])
        ]);
    } catch (Throwable $e) {
        $conexion->rollback();
        throw $e;
    }
} catch (Throwable $e) {
    responder("no", "Error guardando el análisis administrativo", [], ["error" => $e->getMessage()], 500);
}
?>
