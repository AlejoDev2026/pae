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

try {
    if ($_SERVER["REQUEST_METHOD"] !== "GET") {
        responder("no", "Método no permitido. Debe utilizar GET", [], [], 405);
    }

    $idOrdenConteo = intval(parametro("idOrdenConteo", parametro("id", 0)));
    $idUsuario = intval(parametro("idUsuario", parametro("idUsuarioAdministrador", 0)));
    $idBodega = intval(parametro("idBodega", 0));
    $q = limpiarTexto(parametro("q", parametro("busqueda", "")));
    $tipoDiferencia = strtoupper(limpiarTexto(parametro("tipoDiferencia", "")));
    $estadoAnalisis = strtoupper(limpiarTexto(parametro("estadoAnalisis", "")));
    $pagina = max(1, intval(parametro("pagina", 1)));
    $limite = intval(parametro("limite", 200));
    if ($limite <= 0 || $limite > 1000) $limite = 200;
    $offset = ($pagina - 1) * $limite;

    if ($idOrdenConteo <= 0) {
        responder("no", "Debe indicar la orden de conteo", [], [], 400);
    }

    validarUsuarioAdministrativo($idUsuario);

    $orden = obtenerFila("
        SELECT
            o.*,
            ur.nombre AS usuarioRegistro,
            ua.nombre AS usuarioAnaliza,
            uf.nombre AS usuarioFinaliza
        FROM InventarioOrdenesConteo o
        LEFT JOIN usuarios ur ON ur.id = o.idUsuarioRegistro
        LEFT JOIN usuarios ua ON ua.id = o.idUsuarioAnaliza
        LEFT JOIN usuarios uf ON uf.id = o.idUsuarioFinaliza
        WHERE o.id = $idOrdenConteo
        LIMIT 1
    ");

    if (!$orden) {
        responder("no", "La orden de conteo no existe", [], [], 404);
    }

    $bodegas = obtenerFilas("
        SELECT
            s.id AS idSolicitudConteo,
            s.codigo,
            s.idBodega,
            s.estadoProceso,
            s.fechaInicioConteo,
            s.fechaUltimoGuardado,
            s.fechaEnvio,
            s.fechaRevision,
            s.fechaFinalizacion,
            s.numeroRevision,
            s.observacion,
            s.observacionRevision,
            b.codigo AS codigoBodega,
            b.nombre AS bodega,
            COALESCE(NULLIF(op.nombreCompleto, ''), TRIM(CONCAT(COALESCE(op.nombre, ''), ' ', COALESCE(op.apellido, '')))) AS responsablePrincipal,
            COUNT(d.id) AS totalDetalles,
            SUM(CASE WHEN d.conteoRealizado = 1 THEN 1 ELSE 0 END) AS totalContados,
            SUM(CASE WHEN d.conteoRealizado = 0 THEN 1 ELSE 0 END) AS totalPendientes,
            SUM(CASE WHEN d.conteoRealizado = 1 AND ABS(d.diferencia) >= 0.0005 THEN 1 ELSE 0 END) AS totalDiferencias,
            SUM(CASE WHEN d.diferencia > 0.0005 THEN 1 ELSE 0 END) AS totalSobrantes,
            SUM(CASE WHEN d.diferencia < -0.0005 THEN 1 ELSE 0 END) AS totalFaltantes,
            ROUND(COALESCE(SUM(d.cantidadSistema), 0), 3) AS cantidadSistema,
            ROUND(COALESCE(SUM(CASE WHEN d.conteoRealizado = 1 THEN d.cantidadFisica ELSE 0 END), 0), 3) AS cantidadFisica,
            ROUND(COALESCE(SUM(CASE WHEN d.conteoRealizado = 1 THEN d.diferencia ELSE 0 END), 0), 3) AS diferencia
        FROM InventarioSolicitudesConteo s
        INNER JOIN BodegasInventario b ON b.id = s.idBodega
        LEFT JOIN InventarioOperadores op ON op.id = COALESCE(s.idOperador, s.idOperadorAsignado)
        LEFT JOIN InventarioConteoDetalle d ON d.idSolicitudConteo = s.id
        WHERE s.idOrdenConteo = $idOrdenConteo
        GROUP BY s.id, b.id, op.id
        ORDER BY b.nombre ASC
    ");

    $resumen = [
        "totalBodegas" => count($bodegas),
        "pendientes" => 0,
        "enProceso" => 0,
        "enviadas" => 0,
        "devueltas" => 0,
        "aprobadas" => 0,
        "finalizadas" => 0,
        "totalDetalles" => 0,
        "totalContados" => 0,
        "totalPendientesConteo" => 0,
        "totalDiferencias" => 0,
        "totalSobrantes" => 0,
        "totalFaltantes" => 0,
        "cantidadSistema" => 0,
        "cantidadFisica" => 0,
        "diferencia" => 0
    ];

    foreach ($bodegas as &$bodega) {
        $bodega["idSolicitudConteo"] = intval($bodega["idSolicitudConteo"]);
        $bodega["idBodega"] = intval($bodega["idBodega"]);
        foreach (["totalDetalles", "totalContados", "totalPendientes", "totalDiferencias", "totalSobrantes", "totalFaltantes", "numeroRevision"] as $campo) {
            $bodega[$campo] = intval($bodega[$campo] ?? 0);
        }
        foreach (["cantidadSistema", "cantidadFisica", "diferencia"] as $campo) {
            $bodega[$campo] = round(floatval($bodega[$campo] ?? 0), 3);
        }
        $bodega["porcentajeAvance"] = $bodega["totalDetalles"] > 0
            ? round(($bodega["totalContados"] * 100) / $bodega["totalDetalles"], 2)
            : ($bodega["estadoProceso"] === "ENVIADO" || $bodega["estadoProceso"] === "APROBADO" || $bodega["estadoProceso"] === "FINALIZADO" ? 100 : 0);

        switch ($bodega["estadoProceso"]) {
            case "PENDIENTE": $resumen["pendientes"]++; break;
            case "EN_PROCESO": $resumen["enProceso"]++; break;
            case "ENVIADO": $resumen["enviadas"]++; break;
            case "DEVUELTO": $resumen["devueltas"]++; break;
            case "APROBADO": $resumen["aprobadas"]++; break;
            case "FINALIZADO": $resumen["finalizadas"]++; break;
        }

        $resumen["totalDetalles"] += $bodega["totalDetalles"];
        $resumen["totalContados"] += $bodega["totalContados"];
        $resumen["totalPendientesConteo"] += $bodega["totalPendientes"];
        $resumen["totalDiferencias"] += $bodega["totalDiferencias"];
        $resumen["totalSobrantes"] += $bodega["totalSobrantes"];
        $resumen["totalFaltantes"] += $bodega["totalFaltantes"];
        $resumen["cantidadSistema"] += $bodega["cantidadSistema"];
        $resumen["cantidadFisica"] += $bodega["cantidadFisica"];
        $resumen["diferencia"] += $bodega["diferencia"];
    }
    unset($bodega);

    foreach (["cantidadSistema", "cantidadFisica", "diferencia"] as $campo) {
        $resumen[$campo] = round($resumen[$campo], 3);
    }
    $resumen["porcentajeAvance"] = $resumen["totalDetalles"] > 0
        ? round(($resumen["totalContados"] * 100) / $resumen["totalDetalles"], 2)
        : 0;

    $consolidado = obtenerFilas("
        SELECT
            d.idProducto,
            p.codigo AS codigoProducto,
            p.descripcion AS producto,
            COALESCE(pic.unidadBaseInventario, 'UND') AS unidad,
            COUNT(DISTINCT d.idBodega) AS totalBodegas,
            COUNT(DISTINCT d.idLote) AS totalLotes,
            COUNT(*) AS totalRegistros,
            ROUND(SUM(COALESCE(d.cantidadDisponibleSistema, 0)), 3) AS disponibleSistema,
            ROUND(SUM(COALESCE(d.cantidadReservadaSistema, 0)), 3) AS reservadaSistema,
            ROUND(SUM(COALESCE(d.cantidadBloqueadaSistema, 0)), 3) AS bloqueadaSistema,
            ROUND(SUM(d.cantidadSistema), 3) AS cantidadSistema,
            ROUND(SUM(CASE WHEN d.conteoRealizado = 1 THEN d.cantidadFisica ELSE 0 END), 3) AS cantidadFisica,
            ROUND(SUM(CASE WHEN d.conteoRealizado = 1 THEN d.diferencia ELSE 0 END), 3) AS diferencia,
            SUM(CASE WHEN d.conteoRealizado = 1 AND ABS(d.diferencia) >= 0.0005 THEN 1 ELSE 0 END) AS registrosConDiferencia
        FROM InventarioConteoDetalle d
        INNER JOIN InventarioSolicitudesConteo s ON s.id = d.idSolicitudConteo
        INNER JOIN ProductosCatalogo p ON p.id = d.idProducto
        LEFT JOIN ProductosInventarioConfig pic ON pic.idProducto = p.id AND pic.estado = 1
        WHERE s.idOrdenConteo = $idOrdenConteo
        GROUP BY d.idProducto, p.codigo, p.descripcion, pic.unidadBaseInventario
        ORDER BY p.descripcion ASC
    ");

    foreach ($consolidado as &$fila) {
        foreach (["idProducto", "totalBodegas", "totalLotes", "totalRegistros", "registrosConDiferencia"] as $campo) {
            $fila[$campo] = intval($fila[$campo] ?? 0);
        }
        foreach (["disponibleSistema", "reservadaSistema", "bloqueadaSistema", "cantidadSistema", "cantidadFisica", "diferencia"] as $campo) {
            $fila[$campo] = round(floatval($fila[$campo] ?? 0), 3);
        }
        $fila["resultado"] = abs($fila["diferencia"]) < 0.0005
            ? "SIN_DIFERENCIA"
            : ($fila["diferencia"] > 0 ? "SOBRANTE" : "FALTANTE");
    }
    unset($fila);

    $where = ["s.idOrdenConteo = $idOrdenConteo"];
    if ($idBodega > 0) $where[] = "d.idBodega = $idBodega";

    if ($q !== "") {
        $like = "%" . esc($q) . "%";
        $where[] = "(
            p.codigo LIKE '$like'
            OR p.descripcion LIKE '$like'
            OR COALESCE(l.lote, '') LIKE '$like'
            OR b.codigo LIKE '$like'
            OR b.nombre LIKE '$like'
            OR COALESCE(u.codigo, '') LIKE '$like'
            OR COALESCE(u.nombre, '') LIKE '$like'
        )";
    }

    if (in_array($tipoDiferencia, ["PENDIENTE", "SIN_DIFERENCIA", "SOBRANTE", "FALTANTE"], true)) {
        $tipoEsc = esc($tipoDiferencia);
        $where[] = "COALESCE(d.tipoDiferencia, 'PENDIENTE') = '$tipoEsc'";
    }

    if (in_array($estadoAnalisis, ["PENDIENTE", "VALIDADO", "OBSERVADO", "AJUSTADO"], true)) {
        $estadoEsc = esc($estadoAnalisis);
        $where[] = "COALESCE(d.estadoAnalisis, 'PENDIENTE') = '$estadoEsc'";
    }

    $whereSql = implode(" AND ", $where);

    $totalFila = obtenerFila("
        SELECT COUNT(*) AS total
        FROM InventarioConteoDetalle d
        INNER JOIN InventarioSolicitudesConteo s ON s.id = d.idSolicitudConteo
        INNER JOIN ProductosCatalogo p ON p.id = d.idProducto
        INNER JOIN BodegasInventario b ON b.id = d.idBodega
        LEFT JOIN InventarioLotes l ON l.id = d.idLote
        LEFT JOIN UbicacionesInventario u ON u.id = d.idUbicacion
        WHERE $whereSql
    ");
    $total = intval($totalFila["total"] ?? 0);

    $detalles = obtenerFilas("
        SELECT
            d.id AS idDetalleConteo,
            d.idSolicitudConteo,
            d.idProducto,
            d.idLote,
            d.idBodega,
            d.idUbicacion,
            d.cantidadDisponibleSistema,
            d.cantidadReservadaSistema,
            d.cantidadBloqueadaSistema,
            d.cantidadSistema,
            d.cantidadTotalSistema,
            d.cantidadFisica,
            d.diferencia,
            d.conteoRealizado,
            d.fechaConteo,
            d.tipoDiferencia,
            d.estadoAnalisis,
            d.observacion,
            d.observacionAnalisis,
            d.fechaAnalisis,
            d.cantidadAjuste,
            p.codigo AS codigoProducto,
            p.descripcion AS producto,
            COALESCE(pic.unidadBaseInventario, 'UND') AS unidad,
            l.lote,
            l.fechaVencimiento,
            b.codigo AS codigoBodega,
            b.nombre AS bodega,
            u.codigo AS codigoUbicacion,
            u.nombre AS ubicacion,
            s.codigo AS codigoConteoBodega,
            s.estadoProceso AS estadoConteoBodega,
            COALESCE(NULLIF(op.nombreCompleto, ''), TRIM(CONCAT(COALESCE(op.nombre, ''), ' ', COALESCE(op.apellido, '')))) AS responsableConteo,
            ua.nombre AS usuarioAnaliza
        FROM InventarioConteoDetalle d
        INNER JOIN InventarioSolicitudesConteo s ON s.id = d.idSolicitudConteo
        INNER JOIN ProductosCatalogo p ON p.id = d.idProducto
        INNER JOIN BodegasInventario b ON b.id = d.idBodega
        LEFT JOIN ProductosInventarioConfig pic ON pic.idProducto = p.id AND pic.estado = 1
        LEFT JOIN InventarioLotes l ON l.id = d.idLote
        LEFT JOIN UbicacionesInventario u ON u.id = d.idUbicacion
        LEFT JOIN InventarioOperadores op ON op.id = d.idOperadorCuenta
        LEFT JOIN usuarios ua ON ua.id = d.idUsuarioAnaliza
        WHERE $whereSql
        ORDER BY b.nombre ASC, COALESCE(u.nombre, 'SIN UBICACIÓN') ASC, p.descripcion ASC, COALESCE(l.lote, '') ASC
        LIMIT $limite OFFSET $offset
    ");

    foreach ($detalles as &$detalle) {
        foreach (["idDetalleConteo", "idSolicitudConteo", "idProducto", "idBodega"] as $campo) {
            $detalle[$campo] = intval($detalle[$campo]);
        }
        foreach (["idLote", "idUbicacion"] as $campo) {
            $detalle[$campo] = $detalle[$campo] !== null ? intval($detalle[$campo]) : null;
        }
        $detalle["conteoRealizado"] = intval($detalle["conteoRealizado"]) === 1;
        foreach (["cantidadDisponibleSistema", "cantidadReservadaSistema", "cantidadBloqueadaSistema", "cantidadSistema", "cantidadTotalSistema", "cantidadFisica", "diferencia", "cantidadAjuste"] as $campo) {
            $detalle[$campo] = $detalle[$campo] !== null ? round(floatval($detalle[$campo]), 3) : null;
        }
        $detalle["resultado"] = !$detalle["conteoRealizado"]
            ? "PENDIENTE"
            : (abs($detalle["diferencia"]) < 0.0005
                ? "SIN_DIFERENCIA"
                : ($detalle["diferencia"] > 0 ? "SOBRANTE" : "FALTANTE"));
    }
    unset($detalle);

    responder(
        "si",
        "Análisis de la orden consultado correctamente",
        [
            "orden" => [
                "id" => intval($orden["id"]),
                "codigo" => $orden["codigo"],
                "nombre" => $orden["nombre"],
                "descripcion" => $orden["descripcion"],
                "fechaCorte" => $orden["fechaCorte"],
                "fechaInicio" => $orden["fechaInicio"],
                "fechaLimite" => $orden["fechaLimite"],
                "tipoConteo" => $orden["tipoConteo"],
                "estadoProceso" => $orden["estadoProceso"],
                "mostrarResultadoBodegas" => intval($orden["mostrarResultadoBodegas"]) === 1,
                "fechaInicioAnalisis" => $orden["fechaInicioAnalisis"],
                "fechaFinalizacionAnalisis" => $orden["fechaFinalizacionAnalisis"],
                "fechaPublicacionResultados" => $orden["fechaPublicacionResultados"],
                "usuarioRegistro" => $orden["usuarioRegistro"],
                "usuarioAnaliza" => $orden["usuarioAnaliza"],
                "usuarioFinaliza" => $orden["usuarioFinaliza"]
            ],
            "resumen" => $resumen,
            "bodegas" => $bodegas,
            "consolidadoProductos" => $consolidado,
            "detalles" => $detalles
        ],
        [
            "paginacion" => [
                "pagina" => $pagina,
                "limite" => $limite,
                "total" => $total,
                "totalPaginas" => $limite > 0 ? (int)ceil($total / $limite) : 1
            ],
            "analisisDisponible" => in_array($orden["estadoProceso"], ["EN_ANALISIS", "FINALIZADA"], true),
            "puedeExportar" => in_array($orden["estadoProceso"], ["EN_ANALISIS", "FINALIZADA"], true)
        ]
    );
} catch (Throwable $e) {
    responder("no", "Error consultando el análisis de la orden", [], ["error" => $e->getMessage()], 500);
}
?>
