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

function normalizarDetalles($entrada)
{
    if (isset($entrada["detalles"]) && is_array($entrada["detalles"])) {
        return $entrada["detalles"];
    }

    if (isset($entrada["items"]) && is_array($entrada["items"])) {
        return $entrada["items"];
    }

    if (
        isset($entrada["idDetalleConteo"])
        || isset($entrada["idDetalle"])
        || isset($entrada["idProducto"])
    ) {
        return [$entrada];
    }

    return [];
}

function tipoDiferencia($diferencia)
{
    if (abs($diferencia) < 0.0005) return "SIN_DIFERENCIA";
    return $diferencia > 0 ? "SOBRANTE" : "FALTANTE";
}

try {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        responder("no", "Método no permitido. Debe utilizar POST", [], [], 405);
    }

    $entrada = entradaJson();
    $idSolicitudConteo = intval($entrada["idSolicitudConteo"] ?? parametro("idSolicitudConteo", 0));
    $idOperadorEntrada = intval($entrada["idOperador"] ?? parametro("idOperador", 0));
    $idUsuarioEntrada = intval($entrada["idUsuario"] ?? parametro("idUsuario", 0));
    $detallesEntrada = normalizarDetalles($entrada);

    if ($idSolicitudConteo <= 0) {
        responder("no", "Debe indicar el conteo de la bodega", [], [], 400);
    }

    if (count($detallesEntrada) === 0) {
        responder("no", "Debe enviar al menos un producto contado", [], [], 400);
    }

    if (count($detallesEntrada) > 500) {
        responder("no", "No puede guardar más de 500 productos por solicitud", [], [], 400);
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
                o.estadoProceso AS estadoOrden,
                o.fechaLimite,
                EXISTS (
                    SELECT 1
                    FROM InventarioConteoResponsables cr
                    WHERE cr.idSolicitudConteo = s.id
                      AND cr.idOperador = $idOperador
                      AND cr.estado = 1
                ) AS asignado
            FROM InventarioSolicitudesConteo s
            INNER JOIN InventarioOrdenesConteo o ON o.id = s.idOrdenConteo
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

        if ($conteo["estadoProceso"] !== "EN_PROCESO") {
            $conexion->rollback();
            responder(
                "no",
                "El conteo debe estar EN_PROCESO para registrar cantidades",
                [],
                ["estadoProceso" => $conteo["estadoProceso"]],
                409
            );
        }

        if (!in_array($conteo["estadoOrden"], ["ABIERTA", "EN_CONTEO"], true)) {
            $conexion->rollback();
            responder(
                "no",
                "La orden general no permite continuar registrando el conteo",
                [],
                ["estadoOrden" => $conteo["estadoOrden"]],
                409
            );
        }

        if ($conteo["fechaLimite"] && time() > strtotime($conteo["fechaLimite"])) {
            $conexion->rollback();
            responder(
                "no",
                "El tiempo permitido para registrar el conteo ya finalizó",
                [],
                ["fechaLimite" => $conteo["fechaLimite"]],
                409
            );
        }

        $idBodega = intval($conteo["idBodega"]);

        $stmtActualizar = $conexion->prepare("
            UPDATE InventarioConteoDetalle
            SET
                cantidadFisica = ?,
                diferencia = ?,
                conteoRealizado = 1,
                fechaConteo = NOW(),
                idUsuarioCuenta = NULLIF(?, 0),
                idOperadorCuenta = ?,
                tipoDiferencia = ?,
                estadoAnalisis = 'PENDIENTE',
                observacion = NULLIF(?, ''),
                observacionAnalisis = NULL,
                idUsuarioAnaliza = NULL,
                fechaAnalisis = NULL,
                cantidadAjuste = NULL,
                idDocumentoDetalleAjuste = NULL
            WHERE id = ?
              AND idSolicitudConteo = ?
        ");
        if (!$stmtActualizar) throw new Exception($conexion->error);

        $stmtInsertar = $conexion->prepare("
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
                fechaConteo,
                idUsuarioCuenta,
                idOperadorCuenta,
                tipoDiferencia,
                estadoAnalisis,
                observacion
            )
            VALUES
            (
                ?, ?, NULLIF(?, 0), ?, NULLIF(?, 0),
                0.000, 0.000, 0.000, 0.000, 0.000,
                ?, ?, 1, NOW(), NULLIF(?, 0), ?, ?, 'PENDIENTE', NULLIF(?, '')
            )
        ");
        if (!$stmtInsertar) throw new Exception($conexion->error);

        $guardados = [];

        foreach ($detallesEntrada as $indice => $item) {
            if (!is_array($item)) {
                throw new Exception("El detalle de la posición " . ($indice + 1) . " no es válido");
            }

            $idDetalleConteo = intval($item["idDetalleConteo"] ?? $item["idDetalle"] ?? $item["id"] ?? 0);
            $cantidadEntrada = $item["cantidadFisica"] ?? $item["cantidad"] ?? null;
            $observacion = limpiarTexto($item["observacion"] ?? "");

            if ($cantidadEntrada === null || $cantidadEntrada === "" || !is_numeric($cantidadEntrada)) {
                throw new Exception("La cantidad física del detalle " . ($indice + 1) . " no es válida");
            }

            $cantidadFisica = round(floatval($cantidadEntrada), 3);
            if ($cantidadFisica < 0) {
                throw new Exception("La cantidad física no puede ser negativa");
            }

            $detalle = null;

            if ($idDetalleConteo > 0) {
                $detalle = obtenerFila("
                    SELECT
                        id,
                        idProducto,
                        idLote,
                        idBodega,
                        idUbicacion,
                        cantidadSistema
                    FROM InventarioConteoDetalle
                    WHERE id = $idDetalleConteo
                      AND idSolicitudConteo = $idSolicitudConteo
                    LIMIT 1
                    FOR UPDATE
                ");

                if (!$detalle) {
                    throw new Exception("Uno de los detalles no pertenece al conteo indicado");
                }
            } else {
                $idProducto = intval($item["idProducto"] ?? 0);
                $idLote = intval($item["idLote"] ?? 0);
                $idUbicacion = intval($item["idUbicacion"] ?? 0);

                if ($idProducto <= 0) {
                    throw new Exception("Debe indicar el producto del nuevo registro");
                }

                $producto = obtenerFila("
                    SELECT id, codigo, descripcion
                    FROM ProductosCatalogo
                    WHERE id = $idProducto
                      AND estado = 1
                    LIMIT 1
                ");
                if (!$producto) {
                    throw new Exception("El producto indicado no existe o está inactivo");
                }

                if ($idLote > 0) {
                    $lote = obtenerFila("
                        SELECT id
                        FROM InventarioLotes
                        WHERE id = $idLote
                          AND idProducto = $idProducto
                        LIMIT 1
                    ");
                    if (!$lote) {
                        throw new Exception("El lote indicado no pertenece al producto");
                    }
                }

                if ($idUbicacion > 0) {
                    $ubicacion = obtenerFila("
                        SELECT id
                        FROM UbicacionesInventario
                        WHERE id = $idUbicacion
                          AND idBodega = $idBodega
                          AND estado = 1
                        LIMIT 1
                    ");
                    if (!$ubicacion) {
                        throw new Exception("La ubicación indicada no pertenece a la bodega del conteo");
                    }
                }

                $detalle = obtenerFila("
                    SELECT
                        id,
                        idProducto,
                        idLote,
                        idBodega,
                        idUbicacion,
                        cantidadSistema
                    FROM InventarioConteoDetalle
                    WHERE idSolicitudConteo = $idSolicitudConteo
                      AND idProducto = $idProducto
                      AND idLote <=> " . ($idLote > 0 ? $idLote : "NULL") . "
                      AND idBodega = $idBodega
                      AND idUbicacion <=> " . ($idUbicacion > 0 ? $idUbicacion : "NULL") . "
                    LIMIT 1
                    FOR UPDATE
                ");

                if (!$detalle) {
                    $diferencia = $cantidadFisica;
                    $tipo = tipoDiferencia($diferencia);

                    $stmtInsertar->bind_param(
                        "iiiiiddiiss",
                        $idSolicitudConteo,
                        $idProducto,
                        $idLote,
                        $idBodega,
                        $idUbicacion,
                        $cantidadFisica,
                        $diferencia,
                        $idUsuario,
                        $idOperador,
                        $tipo,
                        $observacion
                    );

                    if (!$stmtInsertar->execute()) {
                        throw new Exception($stmtInsertar->error);
                    }

                    $idDetalleConteo = intval($stmtInsertar->insert_id);
                    $guardados[] = [
                        "idDetalleConteo" => $idDetalleConteo,
                        "idProducto" => $idProducto,
                        "cantidadFisica" => $cantidadFisica,
                        "diferencia" => $diferencia,
                        "tipoDiferencia" => $tipo,
                        "nuevoHallazgo" => true
                    ];
                    continue;
                }

                $idDetalleConteo = intval($detalle["id"]);
            }

            $cantidadSistema = round(floatval($detalle["cantidadSistema"]), 3);
            $diferencia = round($cantidadFisica - $cantidadSistema, 3);
            $tipo = tipoDiferencia($diferencia);

            $stmtActualizar->bind_param(
                "ddiissii",
                $cantidadFisica,
                $diferencia,
                $idUsuario,
                $idOperador,
                $tipo,
                $observacion,
                $idDetalleConteo,
                $idSolicitudConteo
            );

            if (!$stmtActualizar->execute()) {
                throw new Exception($stmtActualizar->error);
            }

            $guardados[] = [
                "idDetalleConteo" => $idDetalleConteo,
                "idProducto" => intval($detalle["idProducto"]),
                "cantidadFisica" => $cantidadFisica,
                "diferencia" => $diferencia,
                "tipoDiferencia" => $tipo,
                "nuevoHallazgo" => false
            ];
        }

        $stmtActualizar->close();
        $stmtInsertar->close();

        $stmtSolicitud = $conexion->prepare("
            UPDATE InventarioSolicitudesConteo
            SET fechaUltimoGuardado = NOW()
            WHERE id = ?
        ");
        if (!$stmtSolicitud) throw new Exception($conexion->error);
        $stmtSolicitud->bind_param("i", $idSolicitudConteo);
        if (!$stmtSolicitud->execute()) throw new Exception($stmtSolicitud->error);
        $stmtSolicitud->close();

        $datosHistorial = json_encode([
            "totalGuardados" => count($guardados),
            "detalles" => array_map(function ($fila) {
                return [
                    "idDetalleConteo" => $fila["idDetalleConteo"],
                    "nuevoHallazgo" => $fila["nuevoHallazgo"]
                ];
            }, $guardados)
        ], JSON_UNESCAPED_UNICODE);

        $stmtHistorial = $conexion->prepare("
            INSERT INTO InventarioConteoHistorial
            (
                idOrdenConteo,
                idSolicitudConteo,
                accion,
                estadoAnterior,
                estadoNuevo,
                descripcion,
                datos,
                idUsuario,
                idOperador
            )
            VALUES
            (
                ?, ?, 'CONTEO_GUARDADO', 'EN_PROCESO', 'EN_PROCESO',
                'Registro o actualización de cantidades físicas',
                ?, NULLIF(?, 0), ?
            )
        ");
        if (!$stmtHistorial) throw new Exception($conexion->error);
        $idOrdenConteo = intval($conteo["idOrdenConteo"]);
        $stmtHistorial->bind_param(
            "iisii",
            $idOrdenConteo,
            $idSolicitudConteo,
            $datosHistorial,
            $idUsuario,
            $idOperador
        );
        if (!$stmtHistorial->execute()) throw new Exception($stmtHistorial->error);
        $stmtHistorial->close();

        $resumen = obtenerFila("
            SELECT
                COUNT(*) AS totalDetalles,
                SUM(CASE WHEN conteoRealizado = 1 THEN 1 ELSE 0 END) AS totalContados,
                SUM(CASE WHEN conteoRealizado = 0 THEN 1 ELSE 0 END) AS totalPendientes
            FROM InventarioConteoDetalle
            WHERE idSolicitudConteo = $idSolicitudConteo
        ");

        $conexion->commit();

        $totalDetalles = intval($resumen["totalDetalles"] ?? 0);
        $totalContados = intval($resumen["totalContados"] ?? 0);

        responder(
            "si",
            count($guardados) === 1
                ? "Cantidad física guardada correctamente"
                : "Cantidades físicas guardadas correctamente",
            [
                "idSolicitudConteo" => $idSolicitudConteo,
                "totalGuardados" => count($guardados),
                "guardados" => $guardados,
                "resumen" => [
                    "totalDetalles" => $totalDetalles,
                    "totalContados" => $totalContados,
                    "totalPendientes" => intval($resumen["totalPendientes"] ?? 0),
                    "porcentajeAvance" => $totalDetalles > 0
                        ? round(($totalContados * 100) / $totalDetalles, 2)
                        : 0
                ]
            ]
        );
    } catch (Throwable $e) {
        $conexion->rollback();
        throw $e;
    }
} catch (Throwable $e) {
    responder("no", "Error guardando el conteo físico", [], ["error" => $e->getMessage()], 500);
}
?>
