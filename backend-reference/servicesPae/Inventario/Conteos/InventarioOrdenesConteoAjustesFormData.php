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
        return $_GET[$nombre];
    }

    if (isset($_POST[$nombre])) {
        return $_POST[$nombre];
    }

    $json = entradaJson();

    return array_key_exists($nombre, $json)
        ? $json[$nombre]
        : $default;
}

function valorBooleano($valor)
{
    if (is_bool($valor)) {
        return $valor;
    }

    return in_array(
        strtolower(limpiarTexto($valor)),
        ["1", "true", "si", "sí", "yes"],
        true
    );
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

function validarUsuarioAdministrativo($idUsuario)
{
    if ($idUsuario <= 0) {
        responder(
            "no",
            "Debe indicar el usuario administrativo",
            [],
            [],
            400
        );
    }

    $usuario = obtenerFila("
        SELECT id, nombre, correo, rol, estado
        FROM usuarios
        WHERE id = $idUsuario
        LIMIT 1
    ");

    if (!$usuario || intval($usuario["estado"]) !== 1) {
        responder(
            "no",
            "El usuario administrativo no existe o está inactivo",
            [],
            [],
            403
        );
    }

    /*
     * Validación opcional por roles.
     * Ejemplo en conexion.php:
     * define('INVENTARIO_ROLES_ADMIN_CONTEOS', '1,2');
     */
    if (defined("INVENTARIO_ROLES_ADMIN_CONTEOS")) {
        $config = constant("INVENTARIO_ROLES_ADMIN_CONTEOS");
        $roles = is_array($config)
            ? $config
            : explode(",", (string)$config);

        $roles = array_values(
            array_filter(
                array_map("intval", $roles),
                fn($id) => $id > 0
            )
        );

        if (
            count($roles) > 0
            && !in_array(intval($usuario["rol"]), $roles, true)
        ) {
            responder(
                "no",
                "El usuario no tiene permisos administrativos para conteos físicos",
                [],
                [],
                403
            );
        }
    }

    return $usuario;
}

function condicionNullable($campo, $valor)
{
    if ($valor === null || intval($valor) <= 0) {
        return "$campo IS NULL";
    }

    return "$campo = " . intval($valor);
}

function obtenerExistenciasClave(
    $idProducto,
    $idLote,
    $idBodega,
    $idUbicacion,
    $bloquear = false
) {
    $forUpdate = $bloquear ? " FOR UPDATE " : "";

    return obtenerFilas("
        SELECT
            id,
            idProducto,
            idLote,
            idBodega,
            idUbicacion,
            cantidadDisponible,
            cantidadReservada,
            cantidadBloqueada
        FROM InventarioExistencias
        WHERE idProducto = " . intval($idProducto) . "
          AND idBodega = " . intval($idBodega) . "
          AND " . condicionNullable("idLote", $idLote) . "
          AND " . condicionNullable("idUbicacion", $idUbicacion) . "
        ORDER BY id ASC
        $forUpdate
    ");
}

function resumirExistencias($filas)
{
    $resumen = [
        "cantidadDisponible" => 0.0,
        "cantidadReservada" => 0.0,
        "cantidadBloqueada" => 0.0,
        "cantidadTotal" => 0.0
    ];

    foreach ($filas as $fila) {
        $resumen["cantidadDisponible"] += floatval(
            $fila["cantidadDisponible"] ?? 0
        );

        $resumen["cantidadReservada"] += floatval(
            $fila["cantidadReservada"] ?? 0
        );

        $resumen["cantidadBloqueada"] += floatval(
            $fila["cantidadBloqueada"] ?? 0
        );
    }

    foreach ($resumen as $campo => $valor) {
        $resumen[$campo] = round($valor, 3);
    }

    $resumen["cantidadTotal"] = round(
        $resumen["cantidadDisponible"]
        + $resumen["cantidadReservada"]
        + $resumen["cantidadBloqueada"],
        3
    );

    return $resumen;
}

function obtenerTipoDocumentoAjuste($idTipoDocumento = 0)
{
    $whereId = $idTipoDocumento > 0
        ? " AND id = " . intval($idTipoDocumento)
        : "";

    $tipo = obtenerFila("
        SELECT
            id,
            codigo,
            nombre,
            naturaleza,
            tipoMovimiento,
            afectaInventario,
            requiereOrigen,
            requiereDestino,
            permiteManual,
            estado
        FROM TiposDocumentoInventario
        WHERE naturaleza = 'AJUSTE'
          AND afectaInventario = 1
          AND estado = 1
          $whereId
        ORDER BY
            CASE WHEN codigo = 'AJUSTE_CONTEO_FISICO' THEN 0 ELSE 1 END,
            nombre ASC,
            id ASC
        LIMIT 1
    ");

    return $tipo ?: null;
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

    $idOrdenConteo = intval(
        parametro("idOrdenConteo", parametro("id", 0))
    );

    $tiposDocumento = obtenerFilas("
        SELECT
            id,
            codigo,
            nombre,
            naturaleza,
            tipoMovimiento,
            afectaInventario,
            requiereOrigen,
            requiereDestino,
            permiteManual,
            permiteLoteVencido,
            descripcion,
            estado
        FROM TiposDocumentoInventario
        WHERE naturaleza = 'AJUSTE'
          AND afectaInventario = 1
          AND estado = 1
        ORDER BY
            CASE WHEN codigo = 'AJUSTE_CONTEO_FISICO' THEN 0 ELSE 1 END,
            nombre ASC,
            id ASC
    ");

    $tiposDocumento = array_map(function ($fila) {
        return [
            "id" => intval($fila["id"]),
            "idTipoDocumento" => intval($fila["id"]),
            "codigo" => $fila["codigo"],
            "nombre" => $fila["nombre"],
            "naturaleza" => $fila["naturaleza"],
            "tipoMovimiento" => $fila["tipoMovimiento"],
            "afectaInventario" => intval($fila["afectaInventario"]),
            "requiereOrigen" => intval($fila["requiereOrigen"]),
            "requiereDestino" => intval($fila["requiereDestino"]),
            "permiteManual" => intval($fila["permiteManual"]),
            "permiteLoteVencido" => intval($fila["permiteLoteVencido"]),
            "descripcion" => $fila["descripcion"],
            "estado" => intval($fila["estado"])
        ];
    }, $tiposDocumento);

    $data = [
        "tiposDocumentoAjuste" => $tiposDocumento,
        "tipoDocumentoSugerido" => count($tiposDocumento) > 0
            ? $tiposDocumento[0]
            : null,
        "requiereTipoDocumento" => count($tiposDocumento) === 0,
        "orden" => null,
        "resumen" => null,
        "bodegas" => []
    ];

    if ($idOrdenConteo > 0) {
        $orden = obtenerFila("
            SELECT
                o.id,
                o.codigo,
                o.nombre,
                o.descripcion,
                o.fechaCorte,
                o.fechaInicio,
                o.fechaLimite,
                o.tipoConteo,
                o.estadoProceso,
                o.mostrarResultadoBodegas,
                o.fechaFinalizacionAnalisis,
                o.fechaPublicacionResultados,
                o.idUsuarioFinaliza,
                uf.nombre AS usuarioFinaliza
            FROM InventarioOrdenesConteo o
            LEFT JOIN usuarios uf
                ON uf.id = o.idUsuarioFinaliza
            WHERE o.id = $idOrdenConteo
            LIMIT 1
        ");

        if (!$orden) {
            responder(
                "no",
                "La orden de conteo no existe",
                [],
                [],
                404
            );
        }

        $resumen = obtenerFila("
            SELECT
                COUNT(DISTINCT s.id) AS totalBodegas,
                SUM(CASE WHEN s.ajusteGenerado = 1 THEN 1 ELSE 0 END)
                    AS bodegasConAjusteProcesado,
                SUM(CASE WHEN s.ajusteGenerado = 0 THEN 1 ELSE 0 END)
                    AS bodegasPendientesAjuste,

                COUNT(d.id) AS totalRegistros,
                SUM(
                    CASE WHEN ABS(COALESCE(d.diferencia, 0)) >= 0.0005
                    THEN 1 ELSE 0 END
                ) AS registrosConDiferencia,
                SUM(
                    CASE WHEN COALESCE(d.diferencia, 0) > 0.0005
                    THEN 1 ELSE 0 END
                ) AS sobrantes,
                SUM(
                    CASE WHEN COALESCE(d.diferencia, 0) < -0.0005
                    THEN 1 ELSE 0 END
                ) AS faltantes,
                ROUND(
                    SUM(
                        CASE WHEN COALESCE(d.diferencia, 0) > 0
                        THEN d.diferencia ELSE 0 END
                    ),
                    3
                ) AS cantidadSobrante,
                ROUND(
                    ABS(
                        SUM(
                            CASE WHEN COALESCE(d.diferencia, 0) < 0
                            THEN d.diferencia ELSE 0 END
                        )
                    ),
                    3
                ) AS cantidadFaltante
            FROM InventarioSolicitudesConteo s
            LEFT JOIN InventarioConteoDetalle d
                ON d.idSolicitudConteo = s.id
            WHERE s.idOrdenConteo = $idOrdenConteo
              AND s.estadoProceso = 'FINALIZADO'
        ");

        $bodegas = obtenerFilas("
            SELECT
                s.id AS idSolicitudConteo,
                s.idBodega,
                b.codigo AS codigoBodega,
                b.nombre AS bodega,
                s.estadoProceso,
                s.ajusteGenerado,
                s.idDocumentoAjuste,
                doc.consecutivo,
                doc.estadoProceso AS estadoDocumento,
                COUNT(d.id) AS totalRegistros,
                SUM(
                    CASE WHEN ABS(COALESCE(d.diferencia, 0)) >= 0.0005
                    THEN 1 ELSE 0 END
                ) AS registrosConDiferencia,
                ROUND(
                    SUM(
                        CASE WHEN d.diferencia > 0
                        THEN d.diferencia ELSE 0 END
                    ),
                    3
                ) AS cantidadSobrante,
                ROUND(
                    ABS(
                        SUM(
                            CASE WHEN d.diferencia < 0
                            THEN d.diferencia ELSE 0 END
                        )
                    ),
                    3
                ) AS cantidadFaltante
            FROM InventarioSolicitudesConteo s
            INNER JOIN BodegasInventario b
                ON b.id = s.idBodega
            LEFT JOIN InventarioConteoDetalle d
                ON d.idSolicitudConteo = s.id
            LEFT JOIN InventarioDocumentos doc
                ON doc.id = s.idDocumentoAjuste
            WHERE s.idOrdenConteo = $idOrdenConteo
              AND s.estadoProceso = 'FINALIZADO'
            GROUP BY
                s.id,
                s.idBodega,
                b.codigo,
                b.nombre,
                s.estadoProceso,
                s.ajusteGenerado,
                s.idDocumentoAjuste,
                doc.consecutivo,
                doc.estadoProceso
            ORDER BY b.nombre ASC
        ");

        $data["orden"] = [
            "id" => intval($orden["id"]),
            "idOrdenConteo" => intval($orden["id"]),
            "codigo" => $orden["codigo"],
            "nombre" => $orden["nombre"],
            "descripcion" => $orden["descripcion"],
            "fechaCorte" => $orden["fechaCorte"],
            "fechaInicio" => $orden["fechaInicio"],
            "fechaLimite" => $orden["fechaLimite"],
            "tipoConteo" => $orden["tipoConteo"],
            "estadoProceso" => $orden["estadoProceso"],
            "mostrarResultadoBodegas" =>
                intval($orden["mostrarResultadoBodegas"]),
            "fechaFinalizacionAnalisis" =>
                $orden["fechaFinalizacionAnalisis"],
            "fechaPublicacionResultados" =>
                $orden["fechaPublicacionResultados"],
            "idUsuarioFinaliza" =>
                $orden["idUsuarioFinaliza"] !== null
                    ? intval($orden["idUsuarioFinaliza"])
                    : null,
            "usuarioFinaliza" => $orden["usuarioFinaliza"]
        ];

        $data["resumen"] = [
            "totalBodegas" => intval($resumen["totalBodegas"] ?? 0),
            "bodegasConAjusteProcesado" =>
                intval($resumen["bodegasConAjusteProcesado"] ?? 0),
            "bodegasPendientesAjuste" =>
                intval($resumen["bodegasPendientesAjuste"] ?? 0),
            "totalRegistros" => intval($resumen["totalRegistros"] ?? 0),
            "registrosConDiferencia" =>
                intval($resumen["registrosConDiferencia"] ?? 0),
            "sobrantes" => intval($resumen["sobrantes"] ?? 0),
            "faltantes" => intval($resumen["faltantes"] ?? 0),
            "cantidadSobrante" =>
                numeroSeguro($resumen["cantidadSobrante"] ?? 0),
            "cantidadFaltante" =>
                numeroSeguro($resumen["cantidadFaltante"] ?? 0)
        ];

        $data["bodegas"] = array_map(function ($fila) {
            return [
                "idSolicitudConteo" =>
                    intval($fila["idSolicitudConteo"]),
                "idBodega" => intval($fila["idBodega"]),
                "codigoBodega" => $fila["codigoBodega"],
                "bodega" => $fila["bodega"],
                "estadoProceso" => $fila["estadoProceso"],
                "ajusteGenerado" => intval($fila["ajusteGenerado"]),
                "idDocumentoAjuste" =>
                    $fila["idDocumentoAjuste"] !== null
                        ? intval($fila["idDocumentoAjuste"])
                        : null,
                "consecutivo" => $fila["consecutivo"],
                "estadoDocumento" => $fila["estadoDocumento"],
                "totalRegistros" => intval($fila["totalRegistros"]),
                "registrosConDiferencia" =>
                    intval($fila["registrosConDiferencia"]),
                "cantidadSobrante" =>
                    numeroSeguro($fila["cantidadSobrante"]),
                "cantidadFaltante" =>
                    numeroSeguro($fila["cantidadFaltante"])
            ];
        }, $bodegas);
    }

    responder(
        "si",
        "Datos para ajustes de conteo consultados correctamente",
        $data
    );
} catch (Throwable $e) {
    responder(
        "no",
        "Error consultando los datos para ajustes de conteo",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
