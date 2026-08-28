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

function parametro($nombre, $default = "")
{
    return $_GET[$nombre] ?? $_POST[$nombre] ?? $default;
}

function esc($valor)
{
    global $conexion;
    return $conexion->real_escape_string((string)$valor);
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

function resolverOperador($idOperador, $idUsuario)
{
    if ($idOperador > 0) {
        return obtenerFila("
            SELECT id, idUsuario, codigo, documento, nombreCompleto, nombre, apellido, cargo
            FROM InventarioOperadores
            WHERE id = $idOperador AND estado = 1
            LIMIT 1
        ");
    }

    if ($idUsuario > 0) {
        return obtenerFila("
            SELECT id, idUsuario, codigo, documento, nombreCompleto, nombre, apellido, cargo
            FROM InventarioOperadores
            WHERE idUsuario = $idUsuario AND estado = 1
            LIMIT 1
        ");
    }

    return null;
}

try {
    if ($_SERVER["REQUEST_METHOD"] !== "GET") {
        responder("no", "Método no permitido. Debe utilizar GET", [], [], 405);
    }

    $idOperadorEntrada = intval(parametro("idOperador", 0));
    $idUsuario = intval(parametro("idUsuario", 0));
    $estadoProceso = strtoupper(limpiarTexto(parametro("estadoProceso", "")));
    $q = limpiarTexto(parametro("q", parametro("busqueda", "")));
    $pagina = max(1, intval(parametro("pagina", 1)));
    $limite = intval(parametro("limite", 50));
    if ($limite <= 0 || $limite > 200) {
        $limite = 50;
    }
    $offset = ($pagina - 1) * $limite;

    $operador = resolverOperador($idOperadorEntrada, $idUsuario);
    if (!$operador) {
        responder("no", "No se encontró un operador activo asociado al usuario", [], [], 404);
    }

    $idOperador = intval($operador["id"]);
    $where = ["
        (
            s.idOperador = $idOperador
            OR s.idOperadorAsignado = $idOperador
            OR EXISTS (
                SELECT 1
                FROM InventarioConteoResponsables cr
                WHERE cr.idSolicitudConteo = s.id
                  AND cr.idOperador = $idOperador
                  AND cr.estado = 1
            )
        )
    "];

    $estadosValidos = [
        "PENDIENTE", "EN_PROCESO", "ENVIADO", "DEVUELTO",
        "APROBADO", "FINALIZADO", "ANULADO"
    ];

    if ($estadoProceso !== "" && in_array($estadoProceso, $estadosValidos, true)) {
        $estadoEsc = esc($estadoProceso);
        $where[] = "s.estadoProceso = '$estadoEsc'";
    }

    if ($q !== "") {
        $like = "%" . esc($q) . "%";
        $where[] = "(
            s.codigo LIKE '$like'
            OR o.codigo LIKE '$like'
            OR o.nombre LIKE '$like'
            OR b.codigo LIKE '$like'
            OR b.nombre LIKE '$like'
        )";
    }

    $whereSql = implode(" AND ", $where);

    $totalFila = obtenerFila("
        SELECT COUNT(*) AS total
        FROM InventarioSolicitudesConteo s
        INNER JOIN InventarioOrdenesConteo o ON o.id = s.idOrdenConteo
        INNER JOIN BodegasInventario b ON b.id = s.idBodega
        WHERE $whereSql
    ");
    $total = intval($totalFila["total"] ?? 0);

    $filas = obtenerFilas("
        SELECT
            s.id,
            s.codigo,
            s.idOrdenConteo,
            s.idBodega,
            s.idOperador,
            s.idOperadorAsignado,
            s.estadoProceso,
            s.fechaCorteAplicada,
            s.fechaInicioConteo,
            s.fechaUltimoGuardado,
            s.fechaEnvio,
            s.fechaRevision,
            s.fechaFinalizacion,
            s.numeroRevision,
            s.resultadoVisible,
            s.observacion,
            s.observacionRevision,

            o.codigo AS codigoOrden,
            o.nombre AS nombreOrden,
            o.fechaCorte,
            o.fechaInicio,
            o.fechaLimite,
            o.tipoConteo,
            o.estadoProceso AS estadoOrden,
            o.mostrarResultadoBodegas,

            b.codigo AS codigoBodega,
            b.nombre AS bodega,

            (
                SELECT COUNT(*)
                FROM InventarioConteoDetalle d
                WHERE d.idSolicitudConteo = s.id
            ) AS totalDetalles,

            (
                SELECT COUNT(*)
                FROM InventarioConteoDetalle d
                WHERE d.idSolicitudConteo = s.id
                  AND d.conteoRealizado = 1
            ) AS totalContados,

            (
                SELECT COUNT(*)
                FROM InventarioConteoDetalle d
                WHERE d.idSolicitudConteo = s.id
                  AND d.conteoRealizado = 1
                  AND ABS(d.diferencia) >= 0.0005
            ) AS totalDiferencias,

            EXISTS (
                SELECT 1
                FROM InventarioConteoResponsables cr
                WHERE cr.idSolicitudConteo = s.id
                  AND cr.idOperador = $idOperador
                  AND cr.estado = 1
                  AND cr.puedeFinalizar = 1
            ) AS permisoFinalizar

        FROM InventarioSolicitudesConteo s
        INNER JOIN InventarioOrdenesConteo o ON o.id = s.idOrdenConteo
        INNER JOIN BodegasInventario b ON b.id = s.idBodega
        WHERE $whereSql
        ORDER BY
            FIELD(s.estadoProceso, 'DEVUELTO', 'EN_PROCESO', 'PENDIENTE', 'ENVIADO', 'APROBADO', 'FINALIZADO', 'ANULADO'),
            o.fechaInicio DESC,
            b.nombre ASC
        LIMIT $limite OFFSET $offset
    ");

    $ahora = time();
    $data = [];
    $resumen = [
        "total" => $total,
        "pendientes" => 0,
        "enProceso" => 0,
        "enviados" => 0,
        "devueltos" => 0,
        "finalizados" => 0
    ];

    foreach ($filas as $fila) {
        $totalDetalles = intval($fila["totalDetalles"]);
        $totalContados = intval($fila["totalContados"]);
        $porcentaje = $totalDetalles > 0
            ? round(($totalContados * 100) / $totalDetalles, 2)
            : 0;

        $fechaInicioTs = $fila["fechaInicio"] ? strtotime($fila["fechaInicio"]) : null;
        $fechaLimiteTs = $fila["fechaLimite"] ? strtotime($fila["fechaLimite"]) : null;
        $dentroPeriodo = ($fechaInicioTs === null || $ahora >= $fechaInicioTs)
            && ($fechaLimiteTs === null || $ahora <= $fechaLimiteTs);

        $resultadoVisible = intval($fila["resultadoVisible"]) === 1
            && intval($fila["mostrarResultadoBodegas"]) === 1
            && $fila["estadoOrden"] === "FINALIZADA";

        $puedeIniciar = in_array($fila["estadoOrden"], ["ABIERTA", "EN_CONTEO"], true)
            && in_array($fila["estadoProceso"], ["PENDIENTE", "DEVUELTO"], true)
            && $dentroPeriodo;

        $puedeContinuar = in_array($fila["estadoOrden"], ["ABIERTA", "EN_CONTEO"], true)
            && $fila["estadoProceso"] === "EN_PROCESO"
            && $dentroPeriodo;

        $esPrincipal = intval($fila["permisoFinalizar"]) === 1
            || intval($fila["idOperador"]) === $idOperador
            || intval($fila["idOperadorAsignado"]) === $idOperador;
        $puedeEnviar = $fila["estadoProceso"] === "EN_PROCESO"
            && $totalDetalles > 0
            && $totalDetalles === $totalContados
            && $esPrincipal;

        switch ($fila["estadoProceso"]) {
            case "PENDIENTE": $resumen["pendientes"]++; break;
            case "EN_PROCESO": $resumen["enProceso"]++; break;
            case "ENVIADO": $resumen["enviados"]++; break;
            case "DEVUELTO": $resumen["devueltos"]++; break;
            case "APROBADO":
            case "FINALIZADO": $resumen["finalizados"]++; break;
        }

        $data[] = [
            "id" => intval($fila["id"]),
            "idSolicitudConteo" => intval($fila["id"]),
            "codigo" => $fila["codigo"],
            "idOrdenConteo" => intval($fila["idOrdenConteo"]),
            "codigoOrden" => $fila["codigoOrden"],
            "nombreOrden" => $fila["nombreOrden"],
            "idBodega" => intval($fila["idBodega"]),
            "codigoBodega" => $fila["codigoBodega"],
            "bodega" => $fila["bodega"],
            "tipoConteo" => $fila["tipoConteo"],
            "estadoProceso" => $fila["estadoProceso"],
            "estadoOrden" => $fila["estadoOrden"],
            "fechaCorte" => $fila["fechaCorte"],
            "fechaCorteAplicada" => $fila["fechaCorteAplicada"],
            "fechaInicio" => $fila["fechaInicio"],
            "fechaLimite" => $fila["fechaLimite"],
            "fechaInicioConteo" => $fila["fechaInicioConteo"],
            "fechaUltimoGuardado" => $fila["fechaUltimoGuardado"],
            "fechaEnvio" => $fila["fechaEnvio"],
            "numeroRevision" => intval($fila["numeroRevision"]),
            "observacion" => $fila["observacion"],
            "observacionRevision" => $fila["observacionRevision"],
            "totalDetalles" => $totalDetalles,
            "totalContados" => $totalContados,
            "totalPendientes" => max(0, $totalDetalles - $totalContados),
            "porcentajeAvance" => $porcentaje,
            "totalDiferencias" => $resultadoVisible ? intval($fila["totalDiferencias"]) : null,
            "resultadoVisible" => $resultadoVisible,
            "dentroPeriodo" => $dentroPeriodo,
            "puedeIniciar" => $puedeIniciar,
            "puedeContinuar" => $puedeContinuar,
            "puedeEnviar" => $puedeEnviar,
            "esPrincipal" => $esPrincipal
        ];
    }

    $nombreOperador = limpiarTexto($operador["nombreCompleto"]);
    if ($nombreOperador === "") {
        $nombreOperador = trim(limpiarTexto($operador["nombre"]) . " " . limpiarTexto($operador["apellido"]));
    }

    responder(
        "si",
        "Conteos asignados consultados correctamente",
        $data,
        [
            "operador" => [
                "id" => $idOperador,
                "idOperador" => $idOperador,
                "idUsuario" => $operador["idUsuario"] !== null ? intval($operador["idUsuario"]) : null,
                "codigo" => $operador["codigo"],
                "nombreCompleto" => $nombreOperador,
                "cargo" => $operador["cargo"]
            ],
            "resumen" => $resumen,
            "paginacion" => [
                "pagina" => $pagina,
                "limite" => $limite,
                "total" => $total,
                "totalPaginas" => $limite > 0 ? (int)ceil($total / $limite) : 1
            ]
        ]
    );
} catch (Throwable $e) {
    responder("no", "Error consultando los conteos asignados", [], ["error" => $e->getMessage()], 500);
}
?>
