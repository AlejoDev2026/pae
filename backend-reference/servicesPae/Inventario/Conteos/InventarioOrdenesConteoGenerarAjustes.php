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

function generarConsecutivoAjuste(
    $idOrdenConteo,
    $idSolicitudConteo
) {
    global $conexion;

    $base = sprintf(
        "ACF-%s-%06d-%06d",
        date("Ymd"),
        intval($idOrdenConteo),
        intval($idSolicitudConteo)
    );

    $codigo = $base;
    $intento = 0;

    while ($intento < 100) {
        $codigoEsc = esc($codigo);

        $existe = obtenerFila("
            SELECT id
            FROM InventarioDocumentos
            WHERE consecutivo = '$codigoEsc'
            LIMIT 1
        ");

        if (!$existe) {
            return $codigo;
        }

        $intento++;
        $codigo = $base . "-" . $intento;
    }

    throw new Exception(
        "No fue posible generar el consecutivo del ajuste"
    );
}

function aplicarDiferenciaDisponible(
    $idProducto,
    $idLote,
    $idBodega,
    $idUbicacion,
    $diferencia
) {
    global $conexion;

    $filas = obtenerExistenciasClave(
        $idProducto,
        $idLote,
        $idBodega,
        $idUbicacion,
        true
    );

    $resumenAnterior = resumirExistencias($filas);
    $diferencia = numeroSeguro($diferencia);

    $saldoAnterior = $resumenAnterior["cantidadDisponible"];
    $saldoNuevo = numeroSeguro($saldoAnterior + $diferencia);

    if ($saldoNuevo < -0.0005) {
        throw new Exception(
            "El ajuste negativo supera la cantidad disponible actual"
        );
    }

    if ($diferencia > 0) {
        if (count($filas) > 0) {
            $idExistencia = intval($filas[0]["id"]);
            $nuevoValorFila = numeroSeguro(
                floatval($filas[0]["cantidadDisponible"])
                + $diferencia
            );

            $stmt = $conexion->prepare("
                UPDATE InventarioExistencias
                SET cantidadDisponible = ?
                WHERE id = ?
            ");

            if (!$stmt) {
                throw new Exception($conexion->error);
            }

            $stmt->bind_param(
                "di",
                $nuevoValorFila,
                $idExistencia
            );

            if (!$stmt->execute()) {
                throw new Exception($stmt->error);
            }

            $stmt->close();
        } else {
            $stmt = $conexion->prepare("
                INSERT INTO InventarioExistencias
                (
                    idProducto,
                    idLote,
                    idBodega,
                    idUbicacion,
                    cantidadDisponible,
                    cantidadReservada,
                    cantidadBloqueada
                )
                VALUES
                (
                    ?,
                    NULLIF(?, 0),
                    ?,
                    NULLIF(?, 0),
                    ?,
                    0.000,
                    0.000
                )
            ");

            if (!$stmt) {
                throw new Exception($conexion->error);
            }

            $idLoteSql = intval($idLote ?? 0);
            $idUbicacionSql = intval($idUbicacion ?? 0);

            $stmt->bind_param(
                "iiiid",
                $idProducto,
                $idLoteSql,
                $idBodega,
                $idUbicacionSql,
                $diferencia
            );

            if (!$stmt->execute()) {
                throw new Exception($stmt->error);
            }

            $stmt->close();
        }
    } elseif ($diferencia < 0) {
        $pendiente = abs($diferencia);

        foreach ($filas as $fila) {
            if ($pendiente < 0.0005) {
                break;
            }

            $disponibleFila = numeroSeguro(
                $fila["cantidadDisponible"]
            );

            if ($disponibleFila <= 0) {
                continue;
            }

            $descontar = min($disponibleFila, $pendiente);
            $nuevoValorFila = numeroSeguro(
                $disponibleFila - $descontar
            );

            $idExistencia = intval($fila["id"]);

            $stmt = $conexion->prepare("
                UPDATE InventarioExistencias
                SET cantidadDisponible = ?
                WHERE id = ?
            ");

            if (!$stmt) {
                throw new Exception($conexion->error);
            }

            $stmt->bind_param(
                "di",
                $nuevoValorFila,
                $idExistencia
            );

            if (!$stmt->execute()) {
                throw new Exception($stmt->error);
            }

            $stmt->close();

            $pendiente = numeroSeguro(
                $pendiente - $descontar
            );
        }

        if ($pendiente >= 0.0005) {
            throw new Exception(
                "No fue posible descontar completamente el faltante"
            );
        }
    }

    return [
        "saldoAnterior" => numeroSeguro($saldoAnterior),
        "saldoNuevo" => max(0, numeroSeguro($saldoNuevo)),
        "cantidadReservada" =>
            $resumenAnterior["cantidadReservada"],
        "cantidadBloqueada" =>
            $resumenAnterior["cantidadBloqueada"]
    ];
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

    $idOrdenConteo = intval(
        parametro("idOrdenConteo", parametro("id", 0))
    );

    $idUsuario = intval(
        parametro(
            "idUsuario",
            parametro("idUsuarioAdministrador", 0)
        )
    );

    $idTipoDocumento = intval(
        parametro("idTipoDocumento", 0)
    );

    $confirmar = valorBooleano(
        parametro("confirmar", false)
    );

    $observacionGeneral = limpiarTexto(
        parametro("observacion", "")
    );

    if ($idOrdenConteo <= 0) {
        responder(
            "no",
            "Debe indicar la orden de conteo",
            [],
            [],
            400
        );
    }

    if (!$confirmar) {
        responder(
            "no",
            "Debe confirmar expresamente la generación de los ajustes",
            [],
            ["requiereConfirmacion" => true],
            409
        );
    }

    validarUsuarioAdministrativo($idUsuario);

    $tipoDocumento = obtenerTipoDocumentoAjuste(
        $idTipoDocumento
    );

    if (!$tipoDocumento) {
        responder(
            "no",
            "No existe un tipo de documento activo para ajustes de inventario",
            [],
            [
                "accionRequerida" =>
                    "Crear o activar un tipo de documento de naturaleza AJUSTE que afecte inventario"
            ],
            409
        );
    }

    $idTipoDocumento = intval($tipoDocumento["id"]);

    $conexion->begin_transaction();

    try {
        $orden = obtenerFila("
            SELECT
                id,
                codigo,
                nombre,
                fechaCorte,
                estadoProceso,
                mostrarResultadoBodegas
            FROM InventarioOrdenesConteo
            WHERE id = $idOrdenConteo
            LIMIT 1
            FOR UPDATE
        ");

        if (!$orden) {
            $conexion->rollback();

            responder(
                "no",
                "La orden de conteo no existe",
                [],
                [],
                404
            );
        }

        if ($orden["estadoProceso"] !== "FINALIZADA") {
            $conexion->rollback();

            responder(
                "no",
                "La orden debe estar FINALIZADA para aplicar sus ajustes",
                [],
                ["estadoProceso" => $orden["estadoProceso"]],
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
                s.ajusteGenerado,
                s.idDocumentoAjuste,

                b.codigo AS codigoBodega,
                b.nombre AS bodega

            FROM InventarioSolicitudesConteo s
            INNER JOIN BodegasInventario b
                ON b.id = s.idBodega
            WHERE s.idOrdenConteo = $idOrdenConteo
              AND s.estadoProceso = 'FINALIZADO'
            ORDER BY s.id ASC
            FOR UPDATE
        ");

        if (count($solicitudes) === 0) {
            throw new Exception(
                "La orden no tiene conteos finalizados"
            );
        }

        $documentosGenerados = [];
        $bodegasSinDiferencias = [];
        $totalMovimientos = 0;
        $totalDetallesAjustados = 0;

        foreach ($solicitudes as $solicitud) {
            $idSolicitud = intval($solicitud["id"]);
            $idBodega = intval($solicitud["idBodega"]);

            if (intval($solicitud["ajusteGenerado"]) === 1) {
                continue;
            }

            if ($solicitud["idDocumentoAjuste"] !== null) {
                throw new Exception(
                    "La bodega " . $solicitud["bodega"] .
                    " ya tiene un documento relacionado sin marcar como procesado"
                );
            }

            $pendientesAnalisis = obtenerFila("
                SELECT COUNT(*) AS total
                FROM InventarioConteoDetalle
                WHERE idSolicitudConteo = $idSolicitud
                  AND COALESCE(estadoAnalisis, 'PENDIENTE')
                      NOT IN ('VALIDADO', 'AJUSTADO')
            ");

            if (
                intval($pendientesAnalisis["total"] ?? 0) > 0
            ) {
                throw new Exception(
                    "La bodega " . $solicitud["bodega"] .
                    " todavía tiene productos pendientes de análisis"
                );
            }

            $detalles = obtenerFilas("
                SELECT
                    d.id,
                    d.idProducto,
                    d.idLote,
                    d.idBodega,
                    d.idUbicacion,
                    d.cantidadSistema,
                    d.cantidadFisica,
                    d.diferencia,
                    d.estadoAnalisis,
                    d.idDocumentoDetalleAjuste,

                    pc.codigo AS codigoProducto,
                    pc.descripcion AS producto,

                    COALESCE(
                        pic.unidadBaseInventario,
                        'UND'
                    ) AS unidad,

                    il.lote,

                    u.codigo AS codigoUbicacion,
                    u.nombre AS ubicacion

                FROM InventarioConteoDetalle d
                INNER JOIN ProductosCatalogo pc
                    ON pc.id = d.idProducto
                LEFT JOIN ProductosInventarioConfig pic
                    ON pic.idProducto = d.idProducto
                LEFT JOIN InventarioLotes il
                    ON il.id = d.idLote
                LEFT JOIN UbicacionesInventario u
                    ON u.id = d.idUbicacion
                WHERE d.idSolicitudConteo = $idSolicitud
                  AND ABS(COALESCE(d.diferencia, 0)) >= 0.0005
                ORDER BY d.id ASC
                FOR UPDATE
            ");

            if (count($detalles) === 0) {
                $stmtSinDiferencia = $conexion->prepare("
                    UPDATE InventarioSolicitudesConteo
                    SET ajusteGenerado = 1,
                        idDocumentoAjuste = NULL
                    WHERE id = ?
                ");

                if (!$stmtSinDiferencia) {
                    throw new Exception($conexion->error);
                }

                $stmtSinDiferencia->bind_param(
                    "i",
                    $idSolicitud
                );

                if (!$stmtSinDiferencia->execute()) {
                    throw new Exception(
                        $stmtSinDiferencia->error
                    );
                }

                $stmtSinDiferencia->close();

                $bodegasSinDiferencias[] = [
                    "idSolicitudConteo" => $idSolicitud,
                    "idBodega" => $idBodega,
                    "codigoBodega" =>
                        $solicitud["codigoBodega"],
                    "bodega" => $solicitud["bodega"]
                ];

                continue;
            }

            foreach ($detalles as $detalleValidar) {
                if (
                    $detalleValidar["estadoAnalisis"]
                    !== "VALIDADO"
                ) {
                    throw new Exception(
                        "El producto " .
                        $detalleValidar["producto"] .
                        " debe estar VALIDADO antes de generar el ajuste"
                    );
                }

                if (
                    $detalleValidar["idDocumentoDetalleAjuste"]
                    !== null
                ) {
                    throw new Exception(
                        "El producto " .
                        $detalleValidar["producto"] .
                        " ya tiene un ajuste relacionado"
                    );
                }

                $filasExistencia = obtenerExistenciasClave(
                    intval($detalleValidar["idProducto"]),
                    $detalleValidar["idLote"] !== null
                        ? intval($detalleValidar["idLote"])
                        : null,
                    intval($detalleValidar["idBodega"]),
                    $detalleValidar["idUbicacion"] !== null
                        ? intval($detalleValidar["idUbicacion"])
                        : null,
                    true
                );

                $actual = resumirExistencias(
                    $filasExistencia
                );

                $saldoPropuesto = numeroSeguro(
                    $actual["cantidadDisponible"]
                    + floatval($detalleValidar["diferencia"])
                );

                if ($saldoPropuesto < -0.0005) {
                    throw new Exception(
                        "No se puede aplicar el faltante de " .
                        $detalleValidar["producto"] .
                        " en " . $solicitud["bodega"] .
                        ": supera la cantidad disponible actual"
                    );
                }
            }

            $consecutivo = generarConsecutivoAjuste(
                $idOrdenConteo,
                $idSolicitud
            );

            $tipoOrigen = sprintf(
                "CONTEO_FISICO:%d:%d",
                $idOrdenConteo,
                $idSolicitud
            );

            $idOperador = intval(
                $solicitud["idOperador"]
                ?? $solicitud["idOperadorAsignado"]
                ?? 0
            );

            $observacionDocumento =
                "Ajuste automático por conteo físico " .
                $orden["codigo"] .
                " - " . $solicitud["bodega"];

            if ($observacionGeneral !== "") {
                $observacionDocumento .=
                    ". " . $observacionGeneral;
            }

            $stmtDocumento = $conexion->prepare("
                INSERT INTO InventarioDocumentos
                (
                    idTipoDocumento,
                    idUsuarioRegistro,
                    idOperador,
                    consecutivo,
                    fechaDocumento,
                    idEstado,
                    tipoOrigen,
                    observacion,
                    estadoProceso,
                    fechaFinalizacion,
                    idUsuarioFinaliza,
                    idBodegaOrigen,
                    idUbicacionOrigen
                )
                VALUES
                (
                    ?,
                    ?,
                    NULLIF(?, 0),
                    ?,
                    CURDATE(),
                    1,
                    ?,
                    ?,
                    'FINALIZADA',
                    NOW(),
                    ?,
                    ?,
                    NULL
                )
            ");

            if (!$stmtDocumento) {
                throw new Exception($conexion->error);
            }

            $stmtDocumento->bind_param(
                "iiisssii",
                $idTipoDocumento,
                $idUsuario,
                $idOperador,
                $consecutivo,
                $tipoOrigen,
                $observacionDocumento,
                $idUsuario,
                $idBodega
            );

            if (!$stmtDocumento->execute()) {
                throw new Exception($stmtDocumento->error);
            }

            $idDocumento = intval(
                $conexion->insert_id
            );

            $stmtDocumento->close();

            $detallesDocumento = [];

            foreach ($detalles as $detalle) {
                $idDetalleConteo = intval($detalle["id"]);
                $idProducto = intval($detalle["idProducto"]);
                $idLote = $detalle["idLote"] !== null
                    ? intval($detalle["idLote"])
                    : null;
                $idUbicacion =
                    $detalle["idUbicacion"] !== null
                        ? intval($detalle["idUbicacion"])
                        : null;

                $diferencia = numeroSeguro(
                    $detalle["diferencia"]
                );

                $cantidadAbsoluta = numeroSeguro(
                    abs($diferencia)
                );

                $tipoMovimiento = $diferencia > 0
                    ? "AJUSTE_POSITIVO_CONTEO"
                    : "AJUSTE_NEGATIVO_CONTEO";

                $sentido = $diferencia > 0
                    ? "SOBRANTE"
                    : "FALTANTE";

                $observacionDetalle = sprintf(
                    "%s por conteo físico. Sistema al corte: %.3f. Físico: %.3f. Diferencia: %.3f.",
                    $sentido,
                    numeroSeguro($detalle["cantidadSistema"]),
                    numeroSeguro($detalle["cantidadFisica"]),
                    $diferencia
                );

                $stmtDetalle = $conexion->prepare("
                    INSERT INTO InventarioDocumentoDetalle
                    (
                        idDocumento,
                        idProducto,
                        cantidadSolicitada,
                        cantidadProcesada,
                        unidad,
                        observacion
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                ");

                if (!$stmtDetalle) {
                    throw new Exception($conexion->error);
                }

                $unidad = limpiarTexto(
                    $detalle["unidad"] ?: "UND"
                );

                $stmtDetalle->bind_param(
                    "iiddss",
                    $idDocumento,
                    $idProducto,
                    $cantidadAbsoluta,
                    $cantidadAbsoluta,
                    $unidad,
                    $observacionDetalle
                );

                if (!$stmtDetalle->execute()) {
                    throw new Exception($stmtDetalle->error);
                }

                $idDocumentoDetalle = intval(
                    $conexion->insert_id
                );

                $stmtDetalle->close();

                $stmtDetalleLote = $conexion->prepare("
                    INSERT INTO InventarioDocumentoDetalleLotes
                    (
                        idDocumentoDetalle,
                        idLote,
                        idBodega,
                        idUbicacion,
                        cantidad,
                        observacion
                    )
                    VALUES
                    (
                        ?,
                        NULLIF(?, 0),
                        ?,
                        NULLIF(?, 0),
                        ?,
                        ?
                    )
                ");

                if (!$stmtDetalleLote) {
                    throw new Exception($conexion->error);
                }

                $idLoteSql = intval($idLote ?? 0);
                $idUbicacionSql = intval(
                    $idUbicacion ?? 0
                );

                $stmtDetalleLote->bind_param(
                    "iiiids",
                    $idDocumentoDetalle,
                    $idLoteSql,
                    $idBodega,
                    $idUbicacionSql,
                    $cantidadAbsoluta,
                    $observacionDetalle
                );

                if (!$stmtDetalleLote->execute()) {
                    throw new Exception(
                        $stmtDetalleLote->error
                    );
                }

                $stmtDetalleLote->close();

                $saldos = aplicarDiferenciaDisponible(
                    $idProducto,
                    $idLote,
                    $idBodega,
                    $idUbicacion,
                    $diferencia
                );

                $observacionMovimiento =
                    $observacionDetalle .
                    " Orden: " . $orden["codigo"] .
                    ". Bodega: " .
                    $solicitud["bodega"] . ".";

                $stmtMovimiento = $conexion->prepare("
                    INSERT INTO InventarioMovimientos
                    (
                        idDocumento,
                        idDocumentoDetalle,
                        idProducto,
                        idLote,
                        idBodega,
                        idUbicacion,
                        tipoMovimiento,
                        cantidad,
                        saldoAnterior,
                        saldoNuevo,
                        idUsuario,
                        fechaMovimiento,
                        observacion,
                        idUsuarioRegistro,
                        idOperador
                    )
                    VALUES
                    (
                        ?,
                        ?,
                        ?,
                        NULLIF(?, 0),
                        ?,
                        NULLIF(?, 0),
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        NOW(),
                        ?,
                        ?,
                        NULLIF(?, 0)
                    )
                ");

                if (!$stmtMovimiento) {
                    throw new Exception($conexion->error);
                }

                $stmtMovimiento->bind_param(
                    "iiiiiisdddisii",
                    $idDocumento,
                    $idDocumentoDetalle,
                    $idProducto,
                    $idLoteSql,
                    $idBodega,
                    $idUbicacionSql,
                    $tipoMovimiento,
                    $cantidadAbsoluta,
                    $saldos["saldoAnterior"],
                    $saldos["saldoNuevo"],
                    $idUsuario,
                    $observacionMovimiento,
                    $idUsuario,
                    $idOperador
                );

                if (!$stmtMovimiento->execute()) {
                    throw new Exception(
                        $stmtMovimiento->error
                    );
                }

                $idMovimiento = intval(
                    $conexion->insert_id
                );

                $stmtMovimiento->close();

                $stmtConteo = $conexion->prepare("
                    UPDATE InventarioConteoDetalle
                    SET
                        cantidadAjuste = ?,
                        idDocumentoDetalleAjuste = ?,
                        estadoAnalisis = 'AJUSTADO',
                        idUsuarioAnaliza = ?,
                        fechaAnalisis = NOW()
                    WHERE id = ?
                ");

                if (!$stmtConteo) {
                    throw new Exception($conexion->error);
                }

                $stmtConteo->bind_param(
                    "diii",
                    $diferencia,
                    $idDocumentoDetalle,
                    $idUsuario,
                    $idDetalleConteo
                );

                if (!$stmtConteo->execute()) {
                    throw new Exception(
                        $stmtConteo->error
                    );
                }

                $stmtConteo->close();

                $detallesDocumento[] = [
                    "idDetalleConteo" =>
                        $idDetalleConteo,
                    "idDocumentoDetalle" =>
                        $idDocumentoDetalle,
                    "idMovimiento" => $idMovimiento,
                    "idProducto" => $idProducto,
                    "codigoProducto" =>
                        $detalle["codigoProducto"],
                    "producto" => $detalle["producto"],
                    "idLote" => $idLote,
                    "lote" => $detalle["lote"],
                    "idUbicacion" => $idUbicacion,
                    "ubicacion" => $detalle["ubicacion"],
                    "tipoMovimiento" =>
                        $tipoMovimiento,
                    "cantidadAjuste" => $diferencia,
                    "saldoAnterior" =>
                        $saldos["saldoAnterior"],
                    "saldoNuevo" =>
                        $saldos["saldoNuevo"]
                ];

                $totalMovimientos++;
                $totalDetallesAjustados++;
            }

            $stmtSolicitud = $conexion->prepare("
                UPDATE InventarioSolicitudesConteo
                SET
                    ajusteGenerado = 1,
                    idDocumentoAjuste = ?
                WHERE id = ?
            ");

            if (!$stmtSolicitud) {
                throw new Exception($conexion->error);
            }

            $stmtSolicitud->bind_param(
                "ii",
                $idDocumento,
                $idSolicitud
            );

            if (!$stmtSolicitud->execute()) {
                throw new Exception(
                    $stmtSolicitud->error
                );
            }

            $stmtSolicitud->close();

            $datosHistorial = json_encode([
                "idDocumento" => $idDocumento,
                "consecutivo" => $consecutivo,
                "idTipoDocumento" => $idTipoDocumento,
                "tipoDocumento" =>
                    $tipoDocumento["nombre"],
                "totalDetalles" =>
                    count($detallesDocumento)
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
                    idUsuario
                )
                VALUES
                (
                    ?,
                    ?,
                    'AJUSTE_INVENTARIO_GENERADO',
                    'FINALIZADO',
                    'FINALIZADO',
                    ?,
                    ?,
                    ?
                )
            ");

            if (!$stmtHistorial) {
                throw new Exception($conexion->error);
            }

            $descripcionHistorial =
                "Documento de ajuste generado para " .
                $solicitud["bodega"];

            $stmtHistorial->bind_param(
                "iissi",
                $idOrdenConteo,
                $idSolicitud,
                $descripcionHistorial,
                $datosHistorial,
                $idUsuario
            );

            if (!$stmtHistorial->execute()) {
                throw new Exception(
                    $stmtHistorial->error
                );
            }

            $stmtHistorial->close();

            $documentosGenerados[] = [
                "idDocumento" => $idDocumento,
                "consecutivo" => $consecutivo,
                "idSolicitudConteo" => $idSolicitud,
                "idBodega" => $idBodega,
                "codigoBodega" =>
                    $solicitud["codigoBodega"],
                "bodega" => $solicitud["bodega"],
                "totalDetalles" =>
                    count($detallesDocumento),
                "detalles" => $detallesDocumento
            ];
        }

        $resumenProcesados = obtenerFila("
            SELECT
                COUNT(*) AS totalBodegas,
                SUM(
                    CASE WHEN ajusteGenerado = 1
                    THEN 1 ELSE 0 END
                ) AS procesadas,
                SUM(
                    CASE WHEN ajusteGenerado = 0
                    THEN 1 ELSE 0 END
                ) AS pendientes
            FROM InventarioSolicitudesConteo
            WHERE idOrdenConteo = $idOrdenConteo
              AND estadoProceso = 'FINALIZADO'
        ");

        $datosOrden = json_encode([
            "documentosGenerados" =>
                array_map(
                    fn($item) => [
                        "idDocumento" =>
                            $item["idDocumento"],
                        "consecutivo" =>
                            $item["consecutivo"],
                        "idSolicitudConteo" =>
                            $item["idSolicitudConteo"],
                        "idBodega" =>
                            $item["idBodega"],
                        "totalDetalles" =>
                            $item["totalDetalles"]
                    ],
                    $documentosGenerados
                ),
            "bodegasSinDiferencias" =>
                $bodegasSinDiferencias,
            "totalMovimientos" => $totalMovimientos
        ], JSON_UNESCAPED_UNICODE);

        $stmtHistorialOrden = $conexion->prepare("
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
                'AJUSTES_ORDEN_PROCESADOS',
                'FINALIZADA',
                'FINALIZADA',
                'Procesamiento de diferencias del conteo sobre existencias',
                ?,
                ?
            )
        ");

        if (!$stmtHistorialOrden) {
            throw new Exception($conexion->error);
        }

        $stmtHistorialOrden->bind_param(
            "isi",
            $idOrdenConteo,
            $datosOrden,
            $idUsuario
        );

        if (!$stmtHistorialOrden->execute()) {
            throw new Exception(
                $stmtHistorialOrden->error
            );
        }

        $stmtHistorialOrden->close();

        $conexion->commit();

        responder(
            "si",
            "Ajustes de inventario generados correctamente",
            [
                "idOrdenConteo" => $idOrdenConteo,
                "codigoOrden" => $orden["codigo"],
                "idTipoDocumento" => $idTipoDocumento,
                "tipoDocumento" =>
                    $tipoDocumento["nombre"],
                "totalDocumentos" =>
                    count($documentosGenerados),
                "totalMovimientos" =>
                    $totalMovimientos,
                "totalDetallesAjustados" =>
                    $totalDetallesAjustados,
                "documentos" =>
                    $documentosGenerados,
                "bodegasSinDiferencias" =>
                    $bodegasSinDiferencias,
                "totalBodegas" =>
                    intval(
                        $resumenProcesados["totalBodegas"]
                        ?? 0
                    ),
                "bodegasProcesadas" =>
                    intval(
                        $resumenProcesados["procesadas"]
                        ?? 0
                    ),
                "bodegasPendientes" =>
                    intval(
                        $resumenProcesados["pendientes"]
                        ?? 0
                    )
            ]
        );
    } catch (Throwable $e) {
        $conexion->rollback();
        throw $e;
    }
} catch (Throwable $e) {
    responder(
        "no",
        "Error generando los ajustes de inventario",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
