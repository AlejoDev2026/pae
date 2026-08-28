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

    $idBodega = intval(parametro("idBodega", 0));

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

    if ($orden["estadoProceso"] !== "FINALIZADA") {
        responder(
            "no",
            "La orden debe estar FINALIZADA para previsualizar los ajustes",
            [],
            ["estadoProceso" => $orden["estadoProceso"]],
            409
        );
    }

    $filtroBodega = $idBodega > 0
        ? " AND s.idBodega = $idBodega "
        : "";

    $detalles = obtenerFilas("
        SELECT
            d.id,
            d.idSolicitudConteo,
            d.idProducto,
            d.idLote,
            d.idBodega,
            d.idUbicacion,
            d.cantidadSistema,
            d.cantidadDisponibleSistema,
            d.cantidadReservadaSistema,
            d.cantidadBloqueadaSistema,
            d.cantidadTotalSistema,
            d.cantidadFisica,
            d.diferencia,
            d.tipoDiferencia,
            d.estadoAnalisis,
            d.cantidadAjuste,
            d.idDocumentoDetalleAjuste,

            s.ajusteGenerado,
            s.idDocumentoAjuste,

            pc.codigo AS codigoProducto,
            pc.descripcion AS producto,
            COALESCE(pic.unidadBaseInventario, 'UND') AS unidad,

            il.lote,
            il.fechaVencimiento,

            b.codigo AS codigoBodega,
            b.nombre AS bodega,

            u.codigo AS codigoUbicacion,
            u.nombre AS ubicacion

        FROM InventarioConteoDetalle d
        INNER JOIN InventarioSolicitudesConteo s
            ON s.id = d.idSolicitudConteo
        INNER JOIN ProductosCatalogo pc
            ON pc.id = d.idProducto
        LEFT JOIN ProductosInventarioConfig pic
            ON pic.idProducto = d.idProducto
        LEFT JOIN InventarioLotes il
            ON il.id = d.idLote
        INNER JOIN BodegasInventario b
            ON b.id = d.idBodega
        LEFT JOIN UbicacionesInventario u
            ON u.id = d.idUbicacion
        WHERE s.idOrdenConteo = $idOrdenConteo
          AND s.estadoProceso = 'FINALIZADO'
          AND ABS(COALESCE(d.diferencia, 0)) >= 0.0005
          $filtroBodega
        ORDER BY
            b.nombre ASC,
            pc.descripcion ASC,
            il.lote ASC,
            u.nombre ASC,
            d.id ASC
    ");

    $data = [];
    $resumen = [
        "totalRegistros" => 0,
        "aplicables" => 0,
        "bloqueados" => 0,
        "yaProcesados" => 0,
        "sobrantes" => 0,
        "faltantes" => 0,
        "cantidadSobrante" => 0.0,
        "cantidadFaltante" => 0.0
    ];

    foreach ($detalles as $detalle) {
        $filasExistencia = obtenerExistenciasClave(
            intval($detalle["idProducto"]),
            $detalle["idLote"] !== null
                ? intval($detalle["idLote"])
                : null,
            intval($detalle["idBodega"]),
            $detalle["idUbicacion"] !== null
                ? intval($detalle["idUbicacion"])
                : null,
            false
        );

        $actual = resumirExistencias($filasExistencia);
        $diferencia = numeroSeguro($detalle["diferencia"]);

        $disponiblePropuesto = numeroSeguro(
            $actual["cantidadDisponible"] + $diferencia
        );

        $yaProcesado = (
            intval($detalle["ajusteGenerado"]) === 1
            || $detalle["idDocumentoDetalleAjuste"] !== null
        );

        $motivoBloqueo = null;

        if ($yaProcesado) {
            $motivoBloqueo = "El ajuste ya fue procesado";
        } elseif ($detalle["estadoAnalisis"] !== "VALIDADO") {
            $motivoBloqueo =
                "El análisis del producto debe estar VALIDADO";
        } elseif ($disponiblePropuesto < -0.0005) {
            $motivoBloqueo =
                "El faltante supera la cantidad disponible actual";
        }

        $aplicable = $motivoBloqueo === null;

        $resumen["totalRegistros"]++;

        if ($aplicable) {
            $resumen["aplicables"]++;
        } else {
            $resumen["bloqueados"]++;
        }

        if ($yaProcesado) {
            $resumen["yaProcesados"]++;
        }

        if ($diferencia > 0) {
            $resumen["sobrantes"]++;
            $resumen["cantidadSobrante"] += $diferencia;
        } else {
            $resumen["faltantes"]++;
            $resumen["cantidadFaltante"] += abs($diferencia);
        }

        $data[] = [
            "idDetalleConteo" => intval($detalle["id"]),
            "idSolicitudConteo" =>
                intval($detalle["idSolicitudConteo"]),
            "idProducto" => intval($detalle["idProducto"]),
            "codigoProducto" => $detalle["codigoProducto"],
            "producto" => $detalle["producto"],
            "unidad" => $detalle["unidad"] ?: "UND",
            "idLote" => $detalle["idLote"] !== null
                ? intval($detalle["idLote"])
                : null,
            "lote" => $detalle["lote"],
            "fechaVencimiento" => $detalle["fechaVencimiento"],
            "idBodega" => intval($detalle["idBodega"]),
            "codigoBodega" => $detalle["codigoBodega"],
            "bodega" => $detalle["bodega"],
            "idUbicacion" => $detalle["idUbicacion"] !== null
                ? intval($detalle["idUbicacion"])
                : null,
            "codigoUbicacion" => $detalle["codigoUbicacion"],
            "ubicacion" => $detalle["ubicacion"],
            "cantidadSistemaCorte" =>
                numeroSeguro($detalle["cantidadSistema"]),
            "cantidadFisica" =>
                numeroSeguro($detalle["cantidadFisica"]),
            "diferencia" => $diferencia,
            "tipoDiferencia" => $detalle["tipoDiferencia"],
            "estadoAnalisis" => $detalle["estadoAnalisis"],
            "cantidadDisponibleActual" =>
                $actual["cantidadDisponible"],
            "cantidadReservadaActual" =>
                $actual["cantidadReservada"],
            "cantidadBloqueadaActual" =>
                $actual["cantidadBloqueada"],
            "cantidadTotalActual" =>
                $actual["cantidadTotal"],
            "cantidadDisponiblePropuesta" =>
                max(0, $disponiblePropuesto),
            "cantidadTotalPropuesta" => numeroSeguro(
                max(0, $disponiblePropuesto)
                + $actual["cantidadReservada"]
                + $actual["cantidadBloqueada"]
            ),
            "inventarioCambioDespuesCorte" =>
                abs(
                    $actual["cantidadTotal"]
                    - numeroSeguro($detalle["cantidadSistema"])
                ) >= 0.0005,
            "ajusteGenerado" =>
                intval($detalle["ajusteGenerado"]),
            "idDocumentoAjuste" =>
                $detalle["idDocumentoAjuste"] !== null
                    ? intval($detalle["idDocumentoAjuste"])
                    : null,
            "idDocumentoDetalleAjuste" =>
                $detalle["idDocumentoDetalleAjuste"] !== null
                    ? intval($detalle["idDocumentoDetalleAjuste"])
                    : null,
            "aplicable" => $aplicable,
            "motivoBloqueo" => $motivoBloqueo
        ];
    }

    $resumen["cantidadSobrante"] =
        numeroSeguro($resumen["cantidadSobrante"]);

    $resumen["cantidadFaltante"] =
        numeroSeguro($resumen["cantidadFaltante"]);

    responder(
        "si",
        "Previsualización de ajustes generada correctamente",
        [
            "orden" => [
                "id" => intval($orden["id"]),
                "idOrdenConteo" => intval($orden["id"]),
                "codigo" => $orden["codigo"],
                "nombre" => $orden["nombre"],
                "fechaCorte" => $orden["fechaCorte"],
                "estadoProceso" => $orden["estadoProceso"]
            ],
            "resumen" => $resumen,
            "detalles" => $data
        ]
    );
} catch (Throwable $e) {
    responder(
        "no",
        "Error previsualizando los ajustes de conteo",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
