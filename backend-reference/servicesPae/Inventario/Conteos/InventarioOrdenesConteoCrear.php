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


function normalizarBodegas($entrada)
{
    if (is_string($entrada)) {
        $json = json_decode($entrada, true);
        $entrada = is_array($json) ? $json : [];
    }

    if (!is_array($entrada)) {
        return [];
    }

    $resultado = [];
    $vistos = [];

    foreach ($entrada as $item) {
        if (is_numeric($item)) {
            $item = [
                "idBodega" => intval($item),
                "idOperador" => 0,
                "responsables" => [],
                "observacion" => ""
            ];
        }

        if (!is_array($item)) {
            continue;
        }

        $idBodega = intval($item["idBodega"] ?? $item["id"] ?? 0);

        if ($idBodega <= 0 || isset($vistos[$idBodega])) {
            continue;
        }

        $idOperador = intval(
            $item["idOperador"]
            ?? $item["idOperadorPrincipal"]
            ?? $item["idOperadorAsignado"]
            ?? 0
        );

        $responsablesEntrada = $item["responsables"] ?? [];
        $responsables = [];

        if (is_array($responsablesEntrada)) {
            foreach ($responsablesEntrada as $responsable) {
                $idResponsable = is_array($responsable)
                    ? intval($responsable["idOperador"] ?? $responsable["id"] ?? 0)
                    : intval($responsable);

                if ($idResponsable > 0) {
                    $responsables[$idResponsable] = $idResponsable;
                }
            }
        }

        if ($idOperador > 0) {
            $responsables[$idOperador] = $idOperador;
        } elseif (count($responsables) > 0) {
            $idOperador = intval(array_values($responsables)[0]);
        }

        $resultado[] = [
            "idBodega" => $idBodega,
            "idOperador" => $idOperador,
            "responsables" => array_values($responsables),
            "observacion" => limpiarTexto($item["observacion"] ?? "")
        ];

        $vistos[$idBodega] = true;
    }

    return $resultado;
}

function generarCodigoOrden()
{
    global $conexion;

    $base = "OCF-" . date("Ymd-His");
    $codigo = $base;
    $intento = 0;

    while ($intento < 20) {
        $codigoEsc = $conexion->real_escape_string($codigo);
        $existe = obtenerFila("
            SELECT id
            FROM InventarioOrdenesConteo
            WHERE codigo = '$codigoEsc'
            LIMIT 1
        ");

        if (!$existe) {
            return $codigo;
        }

        $codigo = $base . "-" . random_int(100, 999);
        $intento++;
    }

    throw new Exception("No fue posible generar un código único para la orden");
}

try {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        responder(
            "no",
            "Método no permitido. Debe utilizar POST",
            [],
            [],
            405
        );
    }

    $entrada = entradaJson();

    $codigo = strtoupper(limpiarTexto($entrada["codigo"] ?? parametro("codigo", "")));
    $nombre = limpiarTexto($entrada["nombre"] ?? parametro("nombre", ""));
    $descripcion = limpiarTexto($entrada["descripcion"] ?? parametro("descripcion", ""));
    $fechaCorte = fechaValida($entrada["fechaCorte"] ?? parametro("fechaCorte", ""));
    $fechaInicio = fechaValida($entrada["fechaInicio"] ?? parametro("fechaInicio", ""));
    $fechaLimite = fechaValida($entrada["fechaLimite"] ?? parametro("fechaLimite", ""));
    $tipoConteo = strtoupper(limpiarTexto(
        $entrada["tipoConteo"] ?? parametro("tipoConteo", "CIEGO")
    ));
    $estadoProceso = strtoupper(limpiarTexto(
        $entrada["estadoProceso"] ?? parametro("estadoProceso", "BORRADOR")
    ));
    /*
     * Los responsables de bodega no pueden ver resultados ni diferencias
     * hasta que la administración finalice y publique el análisis.
     */
    $mostrarResultadoBodegas = 0;
    $idUsuarioRegistro = intval(
        $entrada["idUsuarioRegistro"]
        ?? parametro("idUsuarioRegistro", 0)
    );
    $observacion = limpiarTexto($entrada["observacion"] ?? parametro("observacion", ""));

    $bodegasEntrada = $entrada["bodegas"]
        ?? $entrada["idBodegas"]
        ?? parametro("bodegas", []);

    $bodegas = normalizarBodegas($bodegasEntrada);

    if ($nombre === "") {
        responder(
            "no",
            "Debe ingresar el nombre de la orden de conteo",
            [],
            [],
            400
        );
    }

    if ($fechaCorte === "") {
        responder(
            "no",
            "Debe ingresar una fecha y hora de corte válida",
            [],
            [],
            400
        );
    }

    if ($fechaInicio === "") {
        $fechaInicio = $fechaCorte;
    }

    if (!in_array($tipoConteo, ["CIEGO", "GUIADO"], true)) {
        responder(
            "no",
            "El tipo de conteo debe ser CIEGO o GUIADO",
            [],
            [],
            400
        );
    }

    if (!in_array($estadoProceso, ["BORRADOR", "PROGRAMADA"], true)) {
        responder(
            "no",
            "Al crear una orden, el estado debe ser BORRADOR o PROGRAMADA",
            [],
            [],
            400
        );
    }

    if (strtotime($fechaInicio) < strtotime($fechaCorte)) {
        responder(
            "no",
            "La fecha de inicio no puede ser anterior a la fecha de corte",
            [],
            [],
            400
        );
    }

    if ($fechaLimite !== "" && strtotime($fechaLimite) < strtotime($fechaInicio)) {
        responder(
            "no",
            "La fecha límite no puede ser anterior a la fecha de inicio",
            [],
            [],
            400
        );
    }

    if (count($bodegas) === 0) {
        responder(
            "no",
            "Debe seleccionar al menos una bodega para la orden",
            [],
            [],
            400
        );
    }

    $idsBodegas = array_map(
        function ($item) { return intval($item["idBodega"]); },
        $bodegas
    );

    $idsBodegasSql = implode(",", $idsBodegas);

    $bodegasValidas = obtenerFilas("
        SELECT id, codigo, nombre
        FROM BodegasInventario
        WHERE estado = 1
          AND id IN ($idsBodegasSql)
    ");

    $mapaBodegas = [];

    foreach ($bodegasValidas as $bodegaValida) {
        $mapaBodegas[intval($bodegaValida["id"])] = $bodegaValida;
    }

    if (count($mapaBodegas) !== count($idsBodegas)) {
        responder(
            "no",
            "Una o más bodegas seleccionadas no existen o están inactivas",
            [],
            [],
            400
        );
    }

    $idsOperadores = [];

    foreach ($bodegas as $bodega) {
        if (
            $estadoProceso === "PROGRAMADA"
            && intval($bodega["idOperador"]) <= 0
        ) {
            responder(
                "no",
                "Cada bodega debe tener un responsable principal para programar la orden",
                [],
                ["idBodega" => intval($bodega["idBodega"])],
                400
            );
        }

        foreach ($bodega["responsables"] as $idOperador) {
            $idOperador = intval($idOperador);

            if ($idOperador > 0) {
                $idsOperadores[$idOperador] = $idOperador;
            }
        }
    }

    if (count($idsOperadores) > 0) {
        $idsOperadoresSql = implode(",", array_values($idsOperadores));

        $operadoresValidos = obtenerFilas("
            SELECT id
            FROM InventarioOperadores
            WHERE estado = 1
              AND id IN ($idsOperadoresSql)
        ");

        $mapaOperadores = [];

        foreach ($operadoresValidos as $operadorValido) {
            $mapaOperadores[intval($operadorValido["id"])] = true;
        }

        foreach ($idsOperadores as $idOperador) {
            if (!isset($mapaOperadores[$idOperador])) {
                responder(
                    "no",
                    "Uno o más responsables no existen o están inactivos",
                    [],
                    ["idOperador" => $idOperador],
                    400
                );
            }
        }
    }

    if ($idUsuarioRegistro > 0) {
        $usuario = obtenerFila("
            SELECT id
            FROM usuarios
            WHERE id = $idUsuarioRegistro
            LIMIT 1
        ");

        if (!$usuario) {
            responder(
                "no",
                "El usuario que registra la orden no fue encontrado",
                [],
                [],
                400
            );
        }
    }

    if ($codigo === "") {
        $codigo = generarCodigoOrden();
    } else {
        if (!preg_match('/^[A-Z0-9\-_]+$/', $codigo)) {
            responder(
                "no",
                "El código solo puede contener letras, números, guiones y guion bajo",
                [],
                [],
                400
            );
        }

        $codigoEsc = esc($codigo);

        $codigoExistente = obtenerFila("
            SELECT id
            FROM InventarioOrdenesConteo
            WHERE codigo = '$codigoEsc'
            LIMIT 1
        ");

        if ($codigoExistente) {
            responder(
                "no",
                "Ya existe una orden con el código ingresado",
                [],
                [],
                409
            );
        }
    }

    $conexion->begin_transaction();

    try {
        $stmtOrden = $conexion->prepare("
            INSERT INTO InventarioOrdenesConteo
            (
                codigo,
                nombre,
                descripcion,
                fechaCorte,
                fechaInicio,
                fechaLimite,
                tipoConteo,
                estadoProceso,
                mostrarResultadoBodegas,
                idUsuarioRegistro,
                observacion
            )
            VALUES
            (
                ?,
                ?,
                NULLIF(?, ''),
                ?,
                NULLIF(?, ''),
                NULLIF(?, ''),
                ?,
                ?,
                ?,
                NULLIF(?, 0),
                NULLIF(?, '')
            )
        ");

        if (!$stmtOrden) {
            throw new Exception($conexion->error);
        }

        $stmtOrden->bind_param(
            "ssssssssiis",
            $codigo,
            $nombre,
            $descripcion,
            $fechaCorte,
            $fechaInicio,
            $fechaLimite,
            $tipoConteo,
            $estadoProceso,
            $mostrarResultadoBodegas,
            $idUsuarioRegistro,
            $observacion
        );

        if (!$stmtOrden->execute()) {
            throw new Exception($stmtOrden->error);
        }

        $idOrdenConteo = intval($stmtOrden->insert_id);
        $stmtOrden->close();

        $stmtSolicitud = $conexion->prepare("
            INSERT INTO InventarioSolicitudesConteo
            (
                idOrdenConteo,
                codigo,
                origenConteo,
                fechaSolicitud,
                fechaCorteAplicada,
                idOperadorAsignado,
                idBodega,
                estadoProceso,
                observacion,
                idUsuarioRegistro,
                idOperador,
                resultadoVisible,
                ajusteGenerado
            )
            VALUES
            (
                ?,
                ?,
                'ORDEN',
                ?,
                ?,
                NULLIF(?, 0),
                ?,
                'PENDIENTE',
                NULLIF(?, ''),
                NULLIF(?, 0),
                NULLIF(?, 0),
                0,
                0
            )
        ");

        if (!$stmtSolicitud) {
            throw new Exception($conexion->error);
        }

        $stmtResponsable = $conexion->prepare("
            INSERT INTO InventarioConteoResponsables
            (
                idSolicitudConteo,
                idOperador,
                esPrincipal,
                puedeFinalizar,
                estado
            )
            VALUES (?, ?, ?, ?, 1)
        ");

        if (!$stmtResponsable) {
            throw new Exception($conexion->error);
        }

        $solicitudesCreadas = [];
        $fechaSolicitud = date("Y-m-d");

        foreach ($bodegas as $bodega) {
            $idBodega = intval($bodega["idBodega"]);
            $idOperador = intval($bodega["idOperador"]);
            $observacionBodega = limpiarTexto($bodega["observacion"]);
            $codigoSolicitud = $codigo . "-B" . $idBodega;

            $stmtSolicitud->bind_param(
                "isssiisii",
                $idOrdenConteo,
                $codigoSolicitud,
                $fechaSolicitud,
                $fechaCorte,
                $idOperador,
                $idBodega,
                $observacionBodega,
                $idUsuarioRegistro,
                $idOperador
            );

            if (!$stmtSolicitud->execute()) {
                throw new Exception($stmtSolicitud->error);
            }

            $idSolicitudConteo = intval($stmtSolicitud->insert_id);

            foreach ($bodega["responsables"] as $idResponsable) {
                $idResponsable = intval($idResponsable);
                $esPrincipal = $idResponsable === $idOperador ? 1 : 0;
                $puedeFinalizar = $esPrincipal;

                $stmtResponsable->bind_param(
                    "iiii",
                    $idSolicitudConteo,
                    $idResponsable,
                    $esPrincipal,
                    $puedeFinalizar
                );

                if (!$stmtResponsable->execute()) {
                    throw new Exception($stmtResponsable->error);
                }
            }

            $solicitudesCreadas[] = [
                "idSolicitudConteo" => $idSolicitudConteo,
                "codigo" => $codigoSolicitud,
                "idBodega" => $idBodega,
                "codigoBodega" => $mapaBodegas[$idBodega]["codigo"],
                "bodega" => $mapaBodegas[$idBodega]["nombre"],
                "idOperadorPrincipal" => $idOperador > 0 ? $idOperador : null,
                "totalResponsables" => count($bodega["responsables"]),
                "estadoProceso" => "PENDIENTE"
            ];
        }

        $stmtSolicitud->close();
        $stmtResponsable->close();

        $datosHistorial = json_encode([
            "codigo" => $codigo,
            "nombre" => $nombre,
            "tipoConteo" => $tipoConteo,
            "estadoProceso" => $estadoProceso,
            "totalBodegas" => count($solicitudesCreadas)
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
                'ORDEN_CREADA',
                NULL,
                ?,
                'Creación de la orden general de conteo físico',
                ?,
                NULLIF(?, 0)
            )
        ");

        if (!$stmtHistorial) {
            throw new Exception($conexion->error);
        }

        $stmtHistorial->bind_param(
            "issi",
            $idOrdenConteo,
            $estadoProceso,
            $datosHistorial,
            $idUsuarioRegistro
        );

        if (!$stmtHistorial->execute()) {
            throw new Exception($stmtHistorial->error);
        }

        $stmtHistorial->close();

        $conexion->commit();

        responder(
            "si",
            "Orden de conteo creada correctamente",
            [
                "id" => $idOrdenConteo,
                "idOrdenConteo" => $idOrdenConteo,
                "codigo" => $codigo,
                "nombre" => $nombre,
                "fechaCorte" => $fechaCorte,
                "fechaInicio" => $fechaInicio,
                "fechaLimite" => $fechaLimite !== "" ? $fechaLimite : null,
                "tipoConteo" => $tipoConteo,
                "estadoProceso" => $estadoProceso,
                "mostrarResultadoBodegas" => $mostrarResultadoBodegas,
                "totalBodegas" => count($solicitudesCreadas),
                "conteosBodega" => $solicitudesCreadas
            ]
        );
    } catch (Throwable $e) {
        $conexion->rollback();
        throw $e;
    }
} catch (Throwable $e) {
    responder(
        "no",
        "Error creando la orden de conteo",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>