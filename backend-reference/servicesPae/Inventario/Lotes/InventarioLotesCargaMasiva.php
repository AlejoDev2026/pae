<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

require_once __DIR__ . "/../conexion.php";

function lcm_responder($rpta, $mensaje, $data = [], $codigo = 200)
{
    http_response_code($codigo);
    echo json_encode([
        "rpta" => $rpta,
        "mensaje" => $mensaje,
        "data" => $data
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function lcm_fecha($valor)
{
    $valor = trim((string)$valor);
    if ($valor === "") return null;

    $fecha = DateTime::createFromFormat("!Y-m-d", $valor);
    if (!$fecha || $fecha->format("Y-m-d") !== $valor) return false;
    return $valor;
}

try {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        lcm_responder("no", "Método no permitido.", [], 405);
    }
    if (!isset($conexion) || !($conexion instanceof mysqli)) {
        throw new Exception("No se encontró la conexión de base de datos.");
    }

    $entrada = json_decode(file_get_contents("php://input"), true);
    if (!is_array($entrada)) {
        lcm_responder("no", "La información de la carga no es válida.", [], 400);
    }

    $accion = $entrada["accion"] ?? "previsualizar";
    $registros = $entrada["registros"] ?? [];
    if (!in_array($accion, ["previsualizar", "importar"], true)) {
        lcm_responder("no", "La acción solicitada no es válida.", [], 422);
    }
    if (!is_array($registros) || count($registros) === 0 || count($registros) > 500) {
        lcm_responder("no", "La carga debe incluir entre 1 y 500 lotes.", [], 422);
    }

    $conexion->set_charset("utf8mb4");
    $errores = [];
    $validos = [];
    $vistos = [];
    $repeticiones = [];
    $buscarProducto = $conexion->prepare(
        "SELECT pc.id, pc.codigo, pc.descripcion, pic.manejaVencimiento
         FROM ProductosCatalogo pc
         INNER JOIN ProductosInventarioConfig pic ON pic.idProducto = pc.id
         WHERE pc.codigo = ? AND pc.estado = 1 AND pic.estado = 1
         LIMIT 1"
    );
    $buscarExistente = $conexion->prepare(
        "SELECT id, fechaVencimiento FROM InventarioLotes
         WHERE idProducto = ? AND lote = ? LIMIT 1"
    );

    foreach ($registros as $indice => $registro) {
        $fila = intval($registro["fila"] ?? ($indice + 2));
        $codigo = trim((string)($registro["codigo"] ?? ""));
        $loteOriginal = trim((string)($registro["lote"] ?? ""));
        $fecha = lcm_fecha($registro["fechaVencimiento"] ?? "");

        if ($codigo === "" || strlen($codigo) > 120 || $loteOriginal === "" || $fecha === false) {
            $errores[] = ["fila" => $fila, "codigo" => $codigo, "lote" => $loteOriginal, "motivo" => "Código, lote o fecha de vencimiento inválidos."];
            continue;
        }

        $claveOriginal = $codigo . "|" . $loteOriginal;
        $numeroVersion = intval($repeticiones[$claveOriginal] ?? 0);
        $repeticiones[$claveOriginal] = $numeroVersion + 1;
        $lote = $numeroVersion === 0
            ? $loteOriginal
            : $loteOriginal . "-V" . $numeroVersion;
        if (strlen($lote) > 120) {
            $errores[] = ["fila" => $fila, "codigo" => $codigo, "lote" => $loteOriginal, "motivo" => "El lote supera los 120 caracteres al agregar su versión."];
            continue;
        }

        $clave = $codigo . "|" . $lote;
        if (isset($vistos[$clave])) {
            $errores[] = ["fila" => $fila, "codigo" => $codigo, "lote" => $lote, "motivo" => "El lote normalizado está repetido en el archivo."];
            continue;
        }
        $vistos[$clave] = $fecha;

        $buscarProducto->bind_param("s", $codigo);
        $buscarProducto->execute();
        $buscarProducto->bind_result($productoIdDb, $productoCodigoDb, $productoDescripcionDb, $manejaVencimientoDb);
        $producto = $buscarProducto->fetch()
            ? ["id" => $productoIdDb, "codigo" => $productoCodigoDb, "descripcion" => $productoDescripcionDb, "manejaVencimiento" => $manejaVencimientoDb]
            : null;
        $buscarProducto->free_result();
        if (!$producto) {
            $errores[] = ["fila" => $fila, "codigo" => $codigo, "lote" => $lote, "motivo" => "No existe un producto activo configurado con este ITEM."];
            continue;
        }
        if (intval($producto["manejaVencimiento"]) === 1 && $fecha === null) {
            $errores[] = ["fila" => $fila, "codigo" => $codigo, "lote" => $lote, "motivo" => "El producto requiere fecha de vencimiento."];
            continue;
        }

        $idProducto = intval($producto["id"]);
        $buscarExistente->bind_param("is", $idProducto, $lote);
        $buscarExistente->execute();
        $buscarExistente->bind_result($idExistenteDb, $fechaExistenteDb);
        $existente = $buscarExistente->fetch()
            ? ["id" => $idExistenteDb, "fechaVencimiento" => $fechaExistenteDb]
            : null;
        $buscarExistente->free_result();
        if ($existente) {
            $fechaExistente = $existente["fechaVencimiento"] ?: null;
            if ($fechaExistente !== $fecha) {
                $errores[] = ["fila" => $fila, "codigo" => $codigo, "lote" => $lote, "motivo" => "Ya existe con una fecha de vencimiento diferente; no se sobrescribirá."];
            }
            continue;
        }

        $validos[] = ["fila" => $fila, "idProducto" => $idProducto, "codigo" => $codigo, "producto" => $producto["descripcion"], "lote" => $lote, "loteOriginal" => $loteOriginal, "fechaVencimiento" => $fecha];
    }
    $buscarProducto->close();
    $buscarExistente->close();

    $resultado = ["total" => count($registros), "listos" => count($validos), "omitidos" => count($registros) - count($validos) - count($errores), "errores" => $errores, "registros" => $validos];
    if ($accion === "previsualizar") {
        lcm_responder("si", $errores ? "Hay registros que requieren corrección." : "Carga validada. Puede confirmar la importación.", $resultado);
    }
    if ($errores) {
        lcm_responder("no", "Hay registros que requieren corrección.", $resultado, 422);
    }

    date_default_timezone_set("America/Bogota");
    $fechaIngreso = date("Y-m-d");
    $conexion->begin_transaction();
    try {
        $insertar = $conexion->prepare(
            "INSERT INTO InventarioLotes (idProducto, lote, fechaVencimiento, fechaIngreso, estado, created_at, updated_at)
             VALUES (?, ?, NULLIF(?, ''), ?, 1, NOW(), NOW())"
        );
        foreach ($validos as $registro) {
            $fechaVencimiento = $registro["fechaVencimiento"] ?? "";
            $insertar->bind_param("isss", $registro["idProducto"], $registro["lote"], $fechaVencimiento, $fechaIngreso);
            $insertar->execute();
        }
        $insertar->close();
        $conexion->commit();
    } catch (Throwable $errorTransaccion) {
        $conexion->rollback();
        throw $errorTransaccion;
    }

    lcm_responder("si", count($validos) . " lote(s) creados correctamente.", $resultado);
} catch (Throwable $error) {
    error_log("[InventarioLotesCargaMasiva] " . $error->getMessage());
    lcm_responder("no", "No fue posible procesar la carga de lotes.", [], 500);
}
?>
