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
        "No se encontr¨® la conexi¨®n a la base de datos",
        [],
        ["error" => "La variable \$conexion no est¨¢ disponible"],
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
            "M¨¦todo no permitido. Debe utilizar GET",
            [],
            [],
            405
        );
    }

    $idOrdenConteo = intval(
        parametro("idOrdenConteo", parametro("id", 0))
    );

    if ($idOrdenConteo <= 0) {
        responder(
            "no",
            "Debe enviar el idOrdenConteo",
            [],
            [],
            400
        );
    }

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
            o.fechaInicioAnalisis,
            o.fechaFinalizacionAnalisis,
            o.fechaPublicacionResultados,
            o.idUsuarioRegistro,
            o.idUsuarioAnaliza,
            o.idUsuarioFinaliza,
            o.observacion,
            o.created_at,
            o.updated_at,

            ur.nombre AS usuarioRegistro,
            ua.nombre AS usuarioAnaliza,
            uf.nombre AS usuarioFinaliza

        FROM InventarioOrdenesConteo o

        LEFT JOIN usuarios ur
            ON ur.id = o.idUsuarioRegistro

        LEFT JOIN usuarios ua
            ON ua.id = o.idUsuarioAnaliza

        LEFT JOIN usuarios uf
            ON uf.id = o.idUsuarioFinaliza

        WHERE o.id = $idOrdenConteo
        LIMIT 1
    ");

    if (!$orden) {
        responder(
            "no",
            "La orden de conteo no fue encontrada",
            [],
            [],
            404
        );
    }

    $filasConteos = obtenerFilas("
        SELECT
            s.id,
            s.idOrdenConteo,
            s.codigo,
            s.origenConteo,
            s.fechaSolicitud,
            s.fechaCorteAplicada,
            s.fechaInicioConteo,
            s.fechaUltimoGuardado,
            s.fechaEnvio,
            s.fechaRevision,
            s.fechaFinalizacion,
            s.idResponsable,
            s.idOperadorAsignado,
            s.idBodega,
            s.idEstado,
            s.estadoProceso,
            s.idUsuarioRegistro,
            s.idOperador,
            s.idUsuarioRevisa,
            s.observacion,
            s.observacionRevision,
            s.numeroRevision,
            s.resultadoVisible,
            s.idDocumentoAjuste,
            s.ajusteGenerado,
            s.created_at,
            s.updated_at,

            b.codigo AS codigoBodega,
            b.nombre AS bodega,

            op.codigo AS codigoOperadorPrincipal,
            COALESCE(
                NULLIF(op.nombreCompleto, ''),
                CONCAT(op.nombre, ' ', COALESCE(op.apellido, ''))
            ) AS operadorPrincipal,

            ur.nombre AS usuarioRegistro,
            uv.nombre AS usuarioRevisa,

            COUNT(DISTINCT d.id) AS totalProductos,

            SUM(CASE
                WHEN d.conteoRealizado = 1
                THEN 1 ELSE 0
            END) AS totalContados,

            SUM(CASE
                WHEN d.conteoRealizado = 0
                THEN 1 ELSE 0
            END) AS totalPendientes,

            SUM(CASE
                WHEN d.conteoRealizado = 1
                 AND ABS(COALESCE(d.diferencia, 0)) > 0.0005
                THEN 1 ELSE 0
            END) AS totalConDiferencia,

            SUM(CASE
                WHEN d.conteoRealizado = 1
                 AND COALESCE(d.diferencia, 0) > 0.0005
                THEN 1 ELSE 0
            END) AS totalSobrantes,

            SUM(CASE
                WHEN d.conteoRealizado = 1
                 AND COALESCE(d.diferencia, 0) < -0.0005
                THEN 1 ELSE 0
            END) AS totalFaltantes,

            COALESCE(SUM(
                COALESCE(
                    d.cantidadTotalSistema,
                    d.cantidadSistema,
                    0
                )
            ), 0) AS cantidadTeorica,

            COALESCE(SUM(
                CASE
                    WHEN d.conteoRealizado = 1
                    THEN COALESCE(d.cantidadFisica, 0)
                    ELSE 0
                END
            ), 0) AS cantidadFisica,

            COALESCE(SUM(
                CASE
                    WHEN d.conteoRealizado = 1
                    THEN COALESCE(d.diferencia, 0)
                    ELSE 0
                END
            ), 0) AS diferenciaNeta,

            COALESCE(SUM(
                CASE
                    WHEN d.conteoRealizado = 1
                    THEN ABS(COALESCE(d.diferencia, 0))
                    ELSE 0
                END
            ), 0) AS diferenciaAbsoluta

        FROM InventarioSolicitudesConteo s

        INNER JOIN BodegasInventario b
            ON b.id = s.idBodega

        LEFT JOIN InventarioOperadores op
            ON op.id = COALESCE(
                NULLIF(s.idOperador, 0),
                NULLIF(s.idOperadorAsignado, 0)
            )

        LEFT JOIN usuarios ur
            ON ur.id = s.idUsuarioRegistro

        LEFT JOIN usuarios uv
            ON uv.id = s.idUsuarioRevisa

        LEFT JOIN InventarioConteoDetalle d
            ON d.idSolicitudConteo = s.id

        WHERE s.idOrdenConteo = $idOrdenConteo

        GROUP BY
            s.id,
            s.idOrdenConteo,
            s.codigo,
            s.origenConteo,
            s.fechaSolicitud,
            s.fechaCorteAplicada,
            s.fechaInicioConteo,
            s.fechaUltimoGuardado,
            s.fechaEnvio,
            s.fechaRevision,
            s.fechaFinalizacion,
            s.idResponsable,
            s.idOperadorAsignado,
            s.idBodega,
            s.idEstado,
            s.estadoProceso,
            s.idUsuarioRegistro,
            s.idOperador,
            s.idUsuarioRevisa,
            s.observacion,
            s.observacionRevision,
            s.numeroRevision,
            s.resultadoVisible,
            s.idDocumentoAjuste,
            s.ajusteGenerado,
            s.created_at,
            s.updated_at,
            b.codigo,
            b.nombre,
            op.codigo,
            op.nombreCompleto,
            op.nombre,
            op.apellido,
            ur.nombre,
            uv.nombre

        ORDER BY b.nombre ASC
    ");

    $idsSolicitudes = array_map(
        function ($fila) { return intval($fila["id"]); },
        $filasConteos
    );

    $responsablesPorSolicitud = [];

    if (count($idsSolicitudes) > 0) {
        $idsSql = implode(",", $idsSolicitudes);

        $filasResponsables = obtenerFilas("
            SELECT
                r.id,
                r.idSolicitudConteo,
                r.idOperador,
                r.esPrincipal,
                r.puedeFinalizar,
                r.estado,
                r.created_at,
                r.updated_at,

                op.idUsuario,
                op.codigo,
                op.documento,
                op.cargo,
                op.telefono,
                op.correo,
                COALESCE(
                    NULLIF(op.nombreCompleto, ''),
                    CONCAT(op.nombre, ' ', COALESCE(op.apellido, ''))
                ) AS nombreCompleto

            FROM InventarioConteoResponsables r

            INNER JOIN InventarioOperadores op
                ON op.id = r.idOperador

            WHERE r.idSolicitudConteo IN ($idsSql)

            ORDER BY
                r.idSolicitudConteo ASC,
                r.esPrincipal DESC,
                nombreCompleto ASC
        ");

        foreach ($filasResponsables as $responsable) {
            $idSolicitud = intval($responsable["idSolicitudConteo"]);

            if (!isset($responsablesPorSolicitud[$idSolicitud])) {
                $responsablesPorSolicitud[$idSolicitud] = [];
            }

            $responsablesPorSolicitud[$idSolicitud][] = [
                "id" => intval($responsable["id"]),
                "idResponsableConteo" => intval($responsable["id"]),
                "idSolicitudConteo" => $idSolicitud,
                "idOperador" => intval($responsable["idOperador"]),
                "idUsuario" => $responsable["idUsuario"] !== null
                    ? intval($responsable["idUsuario"])
                    : null,
                "codigo" => $responsable["codigo"],
                "documento" => $responsable["documento"],
                "nombreCompleto" => $responsable["nombreCompleto"],
                "cargo" => $responsable["cargo"],
                "telefono" => $responsable["telefono"],
                "correo" => $responsable["correo"],
                "esPrincipal" => intval($responsable["esPrincipal"]),
                "puedeFinalizar" => intval($responsable["puedeFinalizar"]),
                "estado" => intval($responsable["estado"]),
                "created_at" => $responsable["created_at"],
                "updated_at" => $responsable["updated_at"]
            ];
        }
    }

    $conteos = [];
    $resumen = [
        "totalBodegas" => 0,
        "pendientes" => 0,
        "enProceso" => 0,
        "enviados" => 0,
        "devueltos" => 0,
        "aprobados" => 0,
        "finalizados" => 0,
        "anulados" => 0,
        "totalProductos" => 0,
        "totalContados" => 0,
        "totalPendientesProductos" => 0,
        "totalConDiferencia" => 0,
        "totalSobrantes" => 0,
        "totalFaltantes" => 0,
        "cantidadTeorica" => 0,
        "cantidadFisica" => 0,
        "diferenciaNeta" => 0,
        "diferenciaAbsoluta" => 0
    ];

    foreach ($filasConteos as $fila) {
        $idSolicitud = intval($fila["id"]);
        $estadoProceso = $fila["estadoProceso"] ?: "PENDIENTE";
        $totalProductos = intval($fila["totalProductos"] ?? 0);
        $totalContados = intval($fila["totalContados"] ?? 0);
        $totalPendientes = intval($fila["totalPendientes"] ?? 0);

        $porcentajeAvance = $totalProductos > 0
            ? round(($totalContados / $totalProductos) * 100, 2)
            : 0;

        $conteos[] = [
            "id" => $idSolicitud,
            "idSolicitudConteo" => $idSolicitud,
            "idOrdenConteo" => intval($fila["idOrdenConteo"]),
            "codigo" => $fila["codigo"],
            "origenConteo" => $fila["origenConteo"],
            "fechaSolicitud" => $fila["fechaSolicitud"],
            "fechaCorteAplicada" => $fila["fechaCorteAplicada"],
            "fechaInicioConteo" => $fila["fechaInicioConteo"],
            "fechaUltimoGuardado" => $fila["fechaUltimoGuardado"],
            "fechaEnvio" => $fila["fechaEnvio"],
            "fechaRevision" => $fila["fechaRevision"],
            "fechaFinalizacion" => $fila["fechaFinalizacion"],
            "idBodega" => intval($fila["idBodega"]),
            "codigoBodega" => $fila["codigoBodega"],
            "bodega" => $fila["bodega"],
            "estadoProceso" => $estadoProceso,
            "idOperadorPrincipal" => $fila["idOperador"] !== null
                ? intval($fila["idOperador"])
                : (
                    $fila["idOperadorAsignado"] !== null
                    ? intval($fila["idOperadorAsignado"])
                    : null
                ),
            "codigoOperadorPrincipal" => $fila["codigoOperadorPrincipal"],
            "operadorPrincipal" => $fila["operadorPrincipal"],
            "idUsuarioRegistro" => $fila["idUsuarioRegistro"] !== null
                ? intval($fila["idUsuarioRegistro"])
                : null,
            "usuarioRegistro" => $fila["usuarioRegistro"],
            "idUsuarioRevisa" => $fila["idUsuarioRevisa"] !== null
                ? intval($fila["idUsuarioRevisa"])
                : null,
            "usuarioRevisa" => $fila["usuarioRevisa"],
            "observacion" => $fila["observacion"],
            "observacionRevision" => $fila["observacionRevision"],
            "numeroRevision" => intval($fila["numeroRevision"] ?? 0),
            "resultadoVisible" => intval($fila["resultadoVisible"] ?? 0),
            "idDocumentoAjuste" => $fila["idDocumentoAjuste"] !== null
                ? intval($fila["idDocumentoAjuste"])
                : null,
            "ajusteGenerado" => intval($fila["ajusteGenerado"] ?? 0),
            "responsables" => $responsablesPorSolicitud[$idSolicitud] ?? [],
            "avance" => [
                "totalProductos" => $totalProductos,
                "totalContados" => $totalContados,
                "totalPendientes" => $totalPendientes,
                "porcentaje" => $porcentajeAvance
            ],
            "analisis" => [
                "totalConDiferencia" => intval($fila["totalConDiferencia"] ?? 0),
                "totalSobrantes" => intval($fila["totalSobrantes"] ?? 0),
                "totalFaltantes" => intval($fila["totalFaltantes"] ?? 0),
                "cantidadTeorica" => numeroSeguro($fila["cantidadTeorica"]),
                "cantidadFisica" => numeroSeguro($fila["cantidadFisica"]),
                "diferenciaNeta" => numeroSeguro($fila["diferenciaNeta"]),
                "diferenciaAbsoluta" => numeroSeguro($fila["diferenciaAbsoluta"])
            ],
            "created_at" => $fila["created_at"],
            "updated_at" => $fila["updated_at"]
        ];

        $resumen["totalBodegas"]++;

        $mapaEstados = [
            "PENDIENTE" => "pendientes",
            "EN_PROCESO" => "enProceso",
            "ENVIADO" => "enviados",
            "DEVUELTO" => "devueltos",
            "APROBADO" => "aprobados",
            "FINALIZADO" => "finalizados",
            "ANULADO" => "anulados"
        ];

        if (isset($mapaEstados[$estadoProceso])) {
            $resumen[$mapaEstados[$estadoProceso]]++;
        }

        $resumen["totalProductos"] += $totalProductos;
        $resumen["totalContados"] += $totalContados;
        $resumen["totalPendientesProductos"] += $totalPendientes;
        $resumen["totalConDiferencia"] += intval($fila["totalConDiferencia"] ?? 0);
        $resumen["totalSobrantes"] += intval($fila["totalSobrantes"] ?? 0);
        $resumen["totalFaltantes"] += intval($fila["totalFaltantes"] ?? 0);
        $resumen["cantidadTeorica"] += floatval($fila["cantidadTeorica"] ?? 0);
        $resumen["cantidadFisica"] += floatval($fila["cantidadFisica"] ?? 0);
        $resumen["diferenciaNeta"] += floatval($fila["diferenciaNeta"] ?? 0);
        $resumen["diferenciaAbsoluta"] += floatval($fila["diferenciaAbsoluta"] ?? 0);
    }

    foreach ([
        "cantidadTeorica",
        "cantidadFisica",
        "diferenciaNeta",
        "diferenciaAbsoluta"
    ] as $campoNumero) {
        $resumen[$campoNumero] = numeroSeguro($resumen[$campoNumero]);
    }

    $resumen["porcentajeAvanceGeneral"] = $resumen["totalProductos"] > 0
        ? round(
            ($resumen["totalContados"] / $resumen["totalProductos"]) * 100,
            2
        )
        : 0;

    $historial = obtenerFilas("
        SELECT
            h.id,
            h.idOrdenConteo,
            h.idSolicitudConteo,
            h.idDetalleConteo,
            h.accion,
            h.estadoAnterior,
            h.estadoNuevo,
            h.descripcion,
            h.datos,
            h.idUsuario,
            h.idOperador,
            h.created_at,

            u.nombre AS usuario,

            COALESCE(
                NULLIF(op.nombreCompleto, ''),
                CONCAT(op.nombre, ' ', COALESCE(op.apellido, ''))
            ) AS operador

        FROM InventarioConteoHistorial h

        LEFT JOIN usuarios u
            ON u.id = h.idUsuario

        LEFT JOIN InventarioOperadores op
            ON op.id = h.idOperador

        WHERE h.idOrdenConteo = $idOrdenConteo

        ORDER BY h.created_at DESC, h.id DESC

        LIMIT 50
    ");

    $historialData = array_map(function ($fila) {
        $datos = null;

        if ($fila["datos"] !== null && $fila["datos"] !== "") {
            $json = json_decode($fila["datos"], true);
            $datos = is_array($json) ? $json : $fila["datos"];
        }

        return [
            "id" => intval($fila["id"]),
            "idHistorial" => intval($fila["id"]),
            "idOrdenConteo" => $fila["idOrdenConteo"] !== null
                ? intval($fila["idOrdenConteo"])
                : null,
            "idSolicitudConteo" => $fila["idSolicitudConteo"] !== null
                ? intval($fila["idSolicitudConteo"])
                : null,
            "idDetalleConteo" => $fila["idDetalleConteo"] !== null
                ? intval($fila["idDetalleConteo"])
                : null,
            "accion" => $fila["accion"],
            "estadoAnterior" => $fila["estadoAnterior"],
            "estadoNuevo" => $fila["estadoNuevo"],
            "descripcion" => $fila["descripcion"],
            "datos" => $datos,
            "idUsuario" => $fila["idUsuario"] !== null
                ? intval($fila["idUsuario"])
                : null,
            "usuario" => $fila["usuario"],
            "idOperador" => $fila["idOperador"] !== null
                ? intval($fila["idOperador"])
                : null,
            "operador" => $fila["operador"],
            "created_at" => $fila["created_at"]
        ];
    }, $historial);

    responder(
        "si",
        "Detalle de la orden de conteo consultado correctamente",
        [
            "orden" => [
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
                "mostrarResultadoBodegas" => intval($orden["mostrarResultadoBodegas"] ?? 0),
                "fechaInicioAnalisis" => $orden["fechaInicioAnalisis"],
                "fechaFinalizacionAnalisis" => $orden["fechaFinalizacionAnalisis"],
                "fechaPublicacionResultados" => $orden["fechaPublicacionResultados"],
                "idUsuarioRegistro" => $orden["idUsuarioRegistro"] !== null
                    ? intval($orden["idUsuarioRegistro"])
                    : null,
                "usuarioRegistro" => $orden["usuarioRegistro"],
                "idUsuarioAnaliza" => $orden["idUsuarioAnaliza"] !== null
                    ? intval($orden["idUsuarioAnaliza"])
                    : null,
                "usuarioAnaliza" => $orden["usuarioAnaliza"],
                "idUsuarioFinaliza" => $orden["idUsuarioFinaliza"] !== null
                    ? intval($orden["idUsuarioFinaliza"])
                    : null,
                "usuarioFinaliza" => $orden["usuarioFinaliza"],
                "observacion" => $orden["observacion"],
                "created_at" => $orden["created_at"],
                "updated_at" => $orden["updated_at"]
            ],
            "resumen" => $resumen,
            "conteosBodega" => $conteos,
            "historial" => $historialData
        ],
        [
            "totalBodegas" => count($conteos),
            "totalHistorialMostrado" => count($historialData)
        ]
    );
} catch (Throwable $e) {
    responder(
        "no",
        "Error consultando el detalle de la orden de conteo",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>