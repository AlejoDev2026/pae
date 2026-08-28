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

    if ($idOrdenConteo <= 0) {
        responder(
            "no",
            "Debe indicar la orden de conteo",
            [],
            [],
            400
        );
    }

    $orden = obtenerFila("
        SELECT
            id,
            codigo,
            nombre,
            fechaCorte,
            estadoProceso,
            fechaFinalizacionAnalisis,
            mostrarResultadoBodegas
        FROM InventarioOrdenesConteo
        WHERE id = $idOrdenConteo
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

    $documentos = obtenerFilas("
        SELECT
            s.id AS idSolicitudConteo,
            s.idBodega,
            s.ajusteGenerado,
            s.idDocumentoAjuste,

            b.codigo AS codigoBodega,
            b.nombre AS bodega,

            doc.consecutivo,
            doc.fechaDocumento,
            doc.estadoProceso AS estadoDocumento,
            doc.fechaFinalizacion,
            doc.idUsuarioRegistro,
            doc.idUsuarioFinaliza,
            doc.tipoOrigen,
            doc.observacion AS observacionDocumento,

            td.id AS idTipoDocumento,
            td.codigo AS codigoTipoDocumento,
            td.nombre AS tipoDocumento,

            ur.nombre AS usuarioRegistro,
            uf.nombre AS usuarioFinaliza,

            COUNT(DISTINCT dd.id) AS totalDetallesDocumento,
            COUNT(DISTINCT m.id) AS totalMovimientos,
            ROUND(
                SUM(
                    CASE
                        WHEN m.tipoMovimiento LIKE 'AJUSTE_POSITIVO%'
                        THEN m.cantidad
                        ELSE 0
                    END
                ),
                3
            ) AS totalPositivo,
            ROUND(
                SUM(
                    CASE
                        WHEN m.tipoMovimiento LIKE 'AJUSTE_NEGATIVO%'
                        THEN m.cantidad
                        ELSE 0
                    END
                ),
                3
            ) AS totalNegativo

        FROM InventarioSolicitudesConteo s
        INNER JOIN BodegasInventario b
            ON b.id = s.idBodega
        LEFT JOIN InventarioDocumentos doc
            ON doc.id = s.idDocumentoAjuste
        LEFT JOIN TiposDocumentoInventario td
            ON td.id = doc.idTipoDocumento
        LEFT JOIN usuarios ur
            ON ur.id = doc.idUsuarioRegistro
        LEFT JOIN usuarios uf
            ON uf.id = doc.idUsuarioFinaliza
        LEFT JOIN InventarioDocumentoDetalle dd
            ON dd.idDocumento = doc.id
        LEFT JOIN InventarioMovimientos m
            ON m.idDocumento = doc.id
        WHERE s.idOrdenConteo = $idOrdenConteo
          AND s.estadoProceso = 'FINALIZADO'
        GROUP BY
            s.id,
            s.idBodega,
            s.ajusteGenerado,
            s.idDocumentoAjuste,
            b.codigo,
            b.nombre,
            doc.consecutivo,
            doc.fechaDocumento,
            doc.estadoProceso,
            doc.fechaFinalizacion,
            doc.idUsuarioRegistro,
            doc.idUsuarioFinaliza,
            doc.tipoOrigen,
            doc.observacion,
            td.id,
            td.codigo,
            td.nombre,
            ur.nombre,
            uf.nombre
        ORDER BY b.nombre ASC
    ");

    $detalles = obtenerFilas("
        SELECT
            d.id AS idDetalleConteo,
            d.idSolicitudConteo,
            d.idProducto,
            d.idLote,
            d.idBodega,
            d.idUbicacion,
            d.cantidadSistema,
            d.cantidadFisica,
            d.diferencia,
            d.cantidadAjuste,
            d.estadoAnalisis,
            d.idDocumentoDetalleAjuste,

            s.idDocumentoAjuste,

            pc.codigo AS codigoProducto,
            pc.descripcion AS producto,

            il.lote,

            b.codigo AS codigoBodega,
            b.nombre AS bodega,

            u.codigo AS codigoUbicacion,
            u.nombre AS ubicacion,

            doc.consecutivo,
            dd.cantidadProcesada,
            dd.unidad,
            dd.observacion AS observacionDetalle,

            m.id AS idMovimiento,
            m.tipoMovimiento,
            m.cantidad AS cantidadMovimiento,
            m.saldoAnterior,
            m.saldoNuevo,
            m.fechaMovimiento

        FROM InventarioConteoDetalle d
        INNER JOIN InventarioSolicitudesConteo s
            ON s.id = d.idSolicitudConteo
        INNER JOIN ProductosCatalogo pc
            ON pc.id = d.idProducto
        LEFT JOIN InventarioLotes il
            ON il.id = d.idLote
        INNER JOIN BodegasInventario b
            ON b.id = d.idBodega
        LEFT JOIN UbicacionesInventario u
            ON u.id = d.idUbicacion
        LEFT JOIN InventarioDocumentoDetalle dd
            ON dd.id = d.idDocumentoDetalleAjuste
        LEFT JOIN InventarioDocumentos doc
            ON doc.id = dd.idDocumento
        LEFT JOIN InventarioMovimientos m
            ON m.idDocumentoDetalle =
                d.idDocumentoDetalleAjuste
        WHERE s.idOrdenConteo = $idOrdenConteo
          AND (
              ABS(COALESCE(d.diferencia, 0)) >= 0.0005
              OR d.idDocumentoDetalleAjuste IS NOT NULL
          )
        ORDER BY
            b.nombre ASC,
            pc.descripcion ASC,
            il.lote ASC,
            u.nombre ASC,
            d.id ASC
    ");

    $resumen = obtenerFila("
        SELECT
            COUNT(DISTINCT s.id) AS totalBodegas,
            SUM(
                CASE WHEN s.ajusteGenerado = 1
                THEN 1 ELSE 0 END
            ) AS bodegasProcesadas,
            SUM(
                CASE WHEN s.ajusteGenerado = 0
                THEN 1 ELSE 0 END
            ) AS bodegasPendientes,
            COUNT(DISTINCT s.idDocumentoAjuste)
                AS totalDocumentos,
            COUNT(DISTINCT d.idDocumentoDetalleAjuste)
                AS totalDetallesAjustados,
            ROUND(
                SUM(
                    CASE
                        WHEN d.cantidadAjuste > 0
                        THEN d.cantidadAjuste
                        ELSE 0
                    END
                ),
                3
            ) AS totalPositivo,
            ROUND(
                ABS(
                    SUM(
                        CASE
                            WHEN d.cantidadAjuste < 0
                            THEN d.cantidadAjuste
                            ELSE 0
                        END
                    )
                ),
                3
            ) AS totalNegativo
        FROM InventarioSolicitudesConteo s
        LEFT JOIN InventarioConteoDetalle d
            ON d.idSolicitudConteo = s.id
        WHERE s.idOrdenConteo = $idOrdenConteo
          AND s.estadoProceso = 'FINALIZADO'
    ");

    $documentos = array_map(function ($fila) {
        return [
            "idSolicitudConteo" =>
                intval($fila["idSolicitudConteo"]),
            "idBodega" => intval($fila["idBodega"]),
            "codigoBodega" => $fila["codigoBodega"],
            "bodega" => $fila["bodega"],
            "ajusteGenerado" =>
                intval($fila["ajusteGenerado"]),
            "idDocumentoAjuste" =>
                $fila["idDocumentoAjuste"] !== null
                    ? intval($fila["idDocumentoAjuste"])
                    : null,
            "consecutivo" => $fila["consecutivo"],
            "fechaDocumento" => $fila["fechaDocumento"],
            "estadoDocumento" =>
                $fila["estadoDocumento"],
            "fechaFinalizacion" =>
                $fila["fechaFinalizacion"],
            "idTipoDocumento" =>
                $fila["idTipoDocumento"] !== null
                    ? intval($fila["idTipoDocumento"])
                    : null,
            "codigoTipoDocumento" =>
                $fila["codigoTipoDocumento"],
            "tipoDocumento" => $fila["tipoDocumento"],
            "usuarioRegistro" =>
                $fila["usuarioRegistro"],
            "usuarioFinaliza" =>
                $fila["usuarioFinaliza"],
            "tipoOrigen" => $fila["tipoOrigen"],
            "observacionDocumento" =>
                $fila["observacionDocumento"],
            "totalDetallesDocumento" =>
                intval($fila["totalDetallesDocumento"]),
            "totalMovimientos" =>
                intval($fila["totalMovimientos"]),
            "totalPositivo" =>
                numeroSeguro($fila["totalPositivo"]),
            "totalNegativo" =>
                numeroSeguro($fila["totalNegativo"])
        ];
    }, $documentos);

    $detalles = array_map(function ($fila) {
        return [
            "idDetalleConteo" =>
                intval($fila["idDetalleConteo"]),
            "idSolicitudConteo" =>
                intval($fila["idSolicitudConteo"]),
            "idProducto" => intval($fila["idProducto"]),
            "codigoProducto" => $fila["codigoProducto"],
            "producto" => $fila["producto"],
            "idLote" => $fila["idLote"] !== null
                ? intval($fila["idLote"])
                : null,
            "lote" => $fila["lote"],
            "idBodega" => intval($fila["idBodega"]),
            "codigoBodega" => $fila["codigoBodega"],
            "bodega" => $fila["bodega"],
            "idUbicacion" =>
                $fila["idUbicacion"] !== null
                    ? intval($fila["idUbicacion"])
                    : null,
            "codigoUbicacion" =>
                $fila["codigoUbicacion"],
            "ubicacion" => $fila["ubicacion"],
            "cantidadSistema" =>
                numeroSeguro($fila["cantidadSistema"]),
            "cantidadFisica" =>
                numeroSeguro($fila["cantidadFisica"]),
            "diferencia" =>
                numeroSeguro($fila["diferencia"]),
            "cantidadAjuste" =>
                $fila["cantidadAjuste"] !== null
                    ? numeroSeguro($fila["cantidadAjuste"])
                    : null,
            "estadoAnalisis" =>
                $fila["estadoAnalisis"],
            "idDocumentoAjuste" =>
                $fila["idDocumentoAjuste"] !== null
                    ? intval($fila["idDocumentoAjuste"])
                    : null,
            "idDocumentoDetalleAjuste" =>
                $fila["idDocumentoDetalleAjuste"] !== null
                    ? intval(
                        $fila["idDocumentoDetalleAjuste"]
                    )
                    : null,
            "consecutivo" => $fila["consecutivo"],
            "cantidadProcesada" =>
                $fila["cantidadProcesada"] !== null
                    ? numeroSeguro(
                        $fila["cantidadProcesada"]
                    )
                    : null,
            "unidad" => $fila["unidad"],
            "observacionDetalle" =>
                $fila["observacionDetalle"],
            "idMovimiento" =>
                $fila["idMovimiento"] !== null
                    ? intval($fila["idMovimiento"])
                    : null,
            "tipoMovimiento" =>
                $fila["tipoMovimiento"],
            "cantidadMovimiento" =>
                $fila["cantidadMovimiento"] !== null
                    ? numeroSeguro(
                        $fila["cantidadMovimiento"]
                    )
                    : null,
            "saldoAnterior" =>
                $fila["saldoAnterior"] !== null
                    ? numeroSeguro(
                        $fila["saldoAnterior"]
                    )
                    : null,
            "saldoNuevo" =>
                $fila["saldoNuevo"] !== null
                    ? numeroSeguro($fila["saldoNuevo"])
                    : null,
            "fechaMovimiento" =>
                $fila["fechaMovimiento"]
        ];
    }, $detalles);

    responder(
        "si",
        "Ajustes relacionados con la orden consultados correctamente",
        [
            "orden" => [
                "id" => intval($orden["id"]),
                "idOrdenConteo" => intval($orden["id"]),
                "codigo" => $orden["codigo"],
                "nombre" => $orden["nombre"],
                "fechaCorte" => $orden["fechaCorte"],
                "estadoProceso" => $orden["estadoProceso"],
                "fechaFinalizacionAnalisis" =>
                    $orden["fechaFinalizacionAnalisis"],
                "mostrarResultadoBodegas" =>
                    intval(
                        $orden["mostrarResultadoBodegas"]
                    )
            ],
            "resumen" => [
                "totalBodegas" =>
                    intval($resumen["totalBodegas"] ?? 0),
                "bodegasProcesadas" =>
                    intval(
                        $resumen["bodegasProcesadas"]
                        ?? 0
                    ),
                "bodegasPendientes" =>
                    intval(
                        $resumen["bodegasPendientes"]
                        ?? 0
                    ),
                "totalDocumentos" =>
                    intval(
                        $resumen["totalDocumentos"]
                        ?? 0
                    ),
                "totalDetallesAjustados" =>
                    intval(
                        $resumen["totalDetallesAjustados"]
                        ?? 0
                    ),
                "totalPositivo" =>
                    numeroSeguro(
                        $resumen["totalPositivo"] ?? 0
                    ),
                "totalNegativo" =>
                    numeroSeguro(
                        $resumen["totalNegativo"] ?? 0
                    )
            ],
            "documentos" => $documentos,
            "detalles" => $detalles
        ]
    );
} catch (Throwable $e) {
    responder(
        "no",
        "Error consultando los ajustes de la orden",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
