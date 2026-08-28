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
    if (isset($_GET[$nombre])) {
        return $_GET[$nombre];
    }
    if (isset($_POST[$nombre])) {
        return $_POST[$nombre];
    }

    $json = entradaJson();
    return array_key_exists($nombre, $json) ? $json[$nombre] : $default;
}

function valorBooleano($valor)
{
    if (is_bool($valor)) {
        return $valor;
    }
    return in_array(strtolower(limpiarTexto($valor)), ["1", "true", "si", "sí", "yes"], true);
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

try {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        responder("no", "Método no permitido. Debe utilizar POST", [], [], 405);
    }

    $idOrdenConteo = intval(parametro("idOrdenConteo", parametro("id", 0)));
    $idUsuario = intval(parametro("idUsuario", parametro("idUsuarioRegistro", 0)));
    $forzarApertura = valorBooleano(parametro("forzarApertura", false));

    if ($idOrdenConteo <= 0) {
        responder("no", "Debe indicar la orden de conteo", [], [], 400);
    }

    if ($idUsuario > 0) {
        $usuario = obtenerFila("SELECT id FROM usuarios WHERE id = $idUsuario LIMIT 1");
        if (!$usuario) {
            responder("no", "El usuario administrativo no fue encontrado", [], [], 400);
        }
    }

    $conexion->begin_transaction();

    try {
        $orden = obtenerFila("
            SELECT
                id,
                codigo,
                nombre,
                fechaCorte,
                fechaInicio,
                fechaLimite,
                tipoConteo,
                estadoProceso
            FROM InventarioOrdenesConteo
            WHERE id = $idOrdenConteo
            LIMIT 1
            FOR UPDATE
        ");

        if (!$orden) {
            $conexion->rollback();
            responder("no", "La orden de conteo no existe", [], [], 404);
        }

        if (in_array($orden["estadoProceso"], ["ABIERTA", "EN_CONTEO"], true)) {
            $conexion->commit();
            responder(
                "si",
                "La orden de conteo ya se encuentra abierta",
                [
                    "idOrdenConteo" => intval($orden["id"]),
                    "codigo" => $orden["codigo"],
                    "estadoProceso" => $orden["estadoProceso"]
                ]
            );
        }

        if (!in_array($orden["estadoProceso"], ["BORRADOR", "PROGRAMADA"], true)) {
            $conexion->rollback();
            responder(
                "no",
                "La orden no se puede abrir en su estado actual",
                [],
                ["estadoProceso" => $orden["estadoProceso"]],
                409
            );
        }

        if (!$forzarApertura && strtotime(date("Y-m-d H:i:s")) < strtotime($orden["fechaCorte"])) {
            $conexion->rollback();
            responder(
                "no",
                "La orden todavía no ha llegado a su fecha de corte",
                [],
                [
                    "fechaCorte" => $orden["fechaCorte"],
                    "puedeForzar" => true
                ],
                409
            );
        }

        $solicitudes = obtenerFilas("
            SELECT
                s.id,
                s.codigo,
                s.idBodega,
                s.idOperador,
                s.idOperadorAsignado,
                s.estadoProceso,
                b.codigo AS codigoBodega,
                b.nombre AS bodega
            FROM InventarioSolicitudesConteo s
            INNER JOIN BodegasInventario b
                ON b.id = s.idBodega
            WHERE s.idOrdenConteo = $idOrdenConteo
            ORDER BY b.nombre ASC
            FOR UPDATE
        ");

        if (count($solicitudes) === 0) {
            throw new Exception("La orden no tiene bodegas asignadas");
        }

        $stmtResponsable = $conexion->prepare("
            INSERT IGNORE INTO InventarioConteoResponsables
            (
                idSolicitudConteo,
                idOperador,
                esPrincipal,
                puedeFinalizar,
                estado
            )
            VALUES (?, ?, 1, 1, 1)
        ");

        if (!$stmtResponsable) {
            throw new Exception($conexion->error);
        }

        $stmtEliminar = $conexion->prepare("
            DELETE FROM InventarioConteoDetalle
            WHERE idSolicitudConteo = ?
        ");

        if (!$stmtEliminar) {
            throw new Exception($conexion->error);
        }

        $stmtSnapshot = $conexion->prepare("
            INSERT INTO InventarioConteoDetalle
            (
                idSolicitudConteo,
                idProducto,
                idLote,
                idBodega,
                idUbicacion,
                cantidadSistema,
                cantidadDisponibleSistema,
                cantidadReservadaSistema,
                cantidadBloqueadaSistema,
                cantidadTotalSistema,
                cantidadFisica,
                diferencia,
                conteoRealizado,
                tipoDiferencia,
                estadoAnalisis
            )
            SELECT
                ?,
                e.idProducto,
                e.idLote,
                e.idBodega,
                e.idUbicacion,
                ROUND(SUM(
                    e.cantidadDisponible
                    + e.cantidadReservada
                    + e.cantidadBloqueada
                ), 3),
                ROUND(SUM(e.cantidadDisponible), 3),
                ROUND(SUM(e.cantidadReservada), 3),
                ROUND(SUM(e.cantidadBloqueada), 3),
                ROUND(SUM(
                    e.cantidadDisponible
                    + e.cantidadReservada
                    + e.cantidadBloqueada
                ), 3),
                0.000,
                0.000,
                0,
                'PENDIENTE',
                'PENDIENTE'
            FROM InventarioExistencias e
            WHERE e.idBodega = ?
            GROUP BY
                e.idProducto,
                e.idLote,
                e.idBodega,
                e.idUbicacion
        ");

        if (!$stmtSnapshot) {
            throw new Exception($conexion->error);
        }

        $stmtActualizarSolicitud = $conexion->prepare("
            UPDATE InventarioSolicitudesConteo
            SET
                fechaCorteAplicada = NOW(),
                estadoProceso = 'PENDIENTE',
                resultadoVisible = 0,
                fechaInicioConteo = NULL,
                fechaUltimoGuardado = NULL,
                fechaEnvio = NULL,
                fechaRevision = NULL,
                fechaFinalizacion = NULL,
                observacionRevision = NULL,
                ajusteGenerado = 0,
                idDocumentoAjuste = NULL
            WHERE id = ?
        ");

        if (!$stmtActualizarSolicitud) {
            throw new Exception($conexion->error);
        }

        $totalDetalles = 0;
        $bodegasProcesadas = [];

        foreach ($solicitudes as $solicitud) {
            $idSolicitud = intval($solicitud["id"]);
            $idBodega = intval($solicitud["idBodega"]);

            if ($solicitud["estadoProceso"] !== "PENDIENTE") {
                throw new Exception(
                    "La bodega " . $solicitud["bodega"] .
                    " ya tiene actividad y no puede reconstruirse su fotografía"
                );
            }

            $conteoRealizado = obtenerFila("
                SELECT COUNT(*) AS total
                FROM InventarioConteoDetalle
                WHERE idSolicitudConteo = $idSolicitud
                  AND conteoRealizado = 1
            ");

            if (intval($conteoRealizado["total"] ?? 0) > 0) {
                throw new Exception(
                    "La bodega " . $solicitud["bodega"] .
                    " ya tiene productos contados"
                );
            }

            $idOperadorPrincipal = intval(
                $solicitud["idOperador"]
                ?? $solicitud["idOperadorAsignado"]
                ?? 0
            );

            $responsables = obtenerFila("
                SELECT COUNT(*) AS total
                FROM InventarioConteoResponsables
                WHERE idSolicitudConteo = $idSolicitud
                  AND estado = 1
            ");

            if (intval($responsables["total"] ?? 0) === 0) {
                if ($idOperadorPrincipal <= 0) {
                    throw new Exception(
                        "La bodega " . $solicitud["bodega"] .
                        " no tiene responsables asignados"
                    );
                }

                $stmtResponsable->bind_param("ii", $idSolicitud, $idOperadorPrincipal);
                if (!$stmtResponsable->execute()) {
                    throw new Exception($stmtResponsable->error);
                }
            }

            $stmtEliminar->bind_param("i", $idSolicitud);
            if (!$stmtEliminar->execute()) {
                throw new Exception($stmtEliminar->error);
            }

            $stmtSnapshot->bind_param("ii", $idSolicitud, $idBodega);
            if (!$stmtSnapshot->execute()) {
                throw new Exception($stmtSnapshot->error);
            }

            $detallesInsertados = intval($stmtSnapshot->affected_rows);
            $totalDetalles += $detallesInsertados;

            $stmtActualizarSolicitud->bind_param("i", $idSolicitud);
            if (!$stmtActualizarSolicitud->execute()) {
                throw new Exception($stmtActualizarSolicitud->error);
            }

            $bodegasProcesadas[] = [
                "idSolicitudConteo" => $idSolicitud,
                "idBodega" => $idBodega,
                "codigoBodega" => $solicitud["codigoBodega"],
                "bodega" => $solicitud["bodega"],
                "totalRegistrosFotografia" => $detallesInsertados
            ];
        }

        $stmtResponsable->close();
        $stmtEliminar->close();
        $stmtSnapshot->close();
        $stmtActualizarSolicitud->close();

        $stmtOrden = $conexion->prepare("
            UPDATE InventarioOrdenesConteo
            SET estadoProceso = 'ABIERTA'
            WHERE id = ?
        ");

        if (!$stmtOrden) {
            throw new Exception($conexion->error);
        }

        $stmtOrden->bind_param("i", $idOrdenConteo);
        if (!$stmtOrden->execute()) {
            throw new Exception($stmtOrden->error);
        }
        $stmtOrden->close();

        $datosHistorial = json_encode([
            "fechaCorteProgramada" => $orden["fechaCorte"],
            "fechaCorteAplicada" => date("Y-m-d H:i:s"),
            "totalBodegas" => count($bodegasProcesadas),
            "totalRegistrosFotografia" => $totalDetalles,
            "forzarApertura" => $forzarApertura
        ], JSON_UNESCAPED_UNICODE);

        $stmtHistorial = $conexion->prepare("
            INSERT INTO InventarioConteoHistorial
            (
                idOrdenConteo,
                accion,
                estadoAnterior,
                estadoNuevo,
                descripcion,
                datos,
                idUsuario
            )
            VALUES
            (
                ?,
                'ORDEN_ABIERTA',
                ?,
                'ABIERTA',
                'Apertura de la orden y generación de la fotografía de existencias',
                ?,
                NULLIF(?, 0)
            )
        ");

        if (!$stmtHistorial) {
            throw new Exception($conexion->error);
        }

        $estadoAnterior = $orden["estadoProceso"];
        $stmtHistorial->bind_param(
            "issi",
            $idOrdenConteo,
            $estadoAnterior,
            $datosHistorial,
            $idUsuario
        );

        if (!$stmtHistorial->execute()) {
            throw new Exception($stmtHistorial->error);
        }
        $stmtHistorial->close();

        $conexion->commit();

        responder(
            "si",
            "Orden abierta y fotografía de inventario generada correctamente",
            [
                "idOrdenConteo" => $idOrdenConteo,
                "codigo" => $orden["codigo"],
                "estadoProceso" => "ABIERTA",
                "fechaCorteProgramada" => $orden["fechaCorte"],
                "fechaCorteAplicada" => date("Y-m-d H:i:s"),
                "totalBodegas" => count($bodegasProcesadas),
                "totalRegistrosFotografia" => $totalDetalles,
                "bodegas" => $bodegasProcesadas
            ]
        );
    } catch (Throwable $e) {
        $conexion->rollback();
        throw $e;
    }
} catch (Throwable $e) {
    responder(
        "no",
        "Error abriendo la orden de conteo",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
