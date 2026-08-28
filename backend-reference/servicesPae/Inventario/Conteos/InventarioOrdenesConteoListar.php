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

    $q = limpiarTexto(parametro("q", parametro("busqueda", "")));
    $estadoProceso = strtoupper(limpiarTexto(parametro("estadoProceso", "")));
    $tipoConteo = strtoupper(limpiarTexto(parametro("tipoConteo", "")));
    $idBodega = intval(parametro("idBodega", 0));
    $fechaDesde = fechaValida(parametro("fechaDesde", ""), false);
    $fechaHasta = fechaValida(parametro("fechaHasta", ""), false);

    $pagina = intval(parametro("pagina", 1));
    $limite = intval(parametro("limite", 50));

    if ($pagina <= 0) {
        $pagina = 1;
    }

    if ($limite <= 0 || $limite > 500) {
        $limite = 50;
    }

    $offset = ($pagina - 1) * $limite;

    $estadosValidos = [
        "BORRADOR",
        "PROGRAMADA",
        "ABIERTA",
        "EN_CONTEO",
        "EN_ANALISIS",
        "FINALIZADA",
        "ANULADA"
    ];

    $tiposValidos = ["CIEGO", "GUIADO"];

    $where = ["1 = 1"];

    if ($q !== "") {
        $qEsc = esc($q);
        $like = "%" . $qEsc . "%";

        $where[] = "
            (
                o.codigo LIKE '$like'
                OR o.nombre LIKE '$like'
                OR o.descripcion LIKE '$like'
                OR EXISTS (
                    SELECT 1
                    FROM InventarioSolicitudesConteo sq
                    INNER JOIN BodegasInventario bq
                        ON bq.id = sq.idBodega
                    WHERE sq.idOrdenConteo = o.id
                      AND (
                          bq.codigo LIKE '$like'
                          OR bq.nombre LIKE '$like'
                      )
                )
            )
        ";
    }

    if ($estadoProceso !== "" && in_array($estadoProceso, $estadosValidos, true)) {
        $estadoEsc = esc($estadoProceso);
        $where[] = "o.estadoProceso = '$estadoEsc'";
    }

    if ($tipoConteo !== "" && in_array($tipoConteo, $tiposValidos, true)) {
        $tipoEsc = esc($tipoConteo);
        $where[] = "o.tipoConteo = '$tipoEsc'";
    }

    if ($idBodega > 0) {
        $where[] = "
            EXISTS (
                SELECT 1
                FROM InventarioSolicitudesConteo sb
                WHERE sb.idOrdenConteo = o.id
                  AND sb.idBodega = $idBodega
            )
        ";
    }

    if ($fechaDesde !== "") {
        $fechaDesdeEsc = esc($fechaDesde);
        $where[] = "DATE(o.fechaCorte) >= '$fechaDesdeEsc'";
    }

    if ($fechaHasta !== "") {
        $fechaHastaEsc = esc($fechaHasta);
        $where[] = "DATE(o.fechaCorte) <= '$fechaHastaEsc'";
    }

    $whereSql = implode(" AND ", $where);

    $conteo = obtenerFila("
        SELECT COUNT(*) AS total
        FROM InventarioOrdenesConteo o
        WHERE $whereSql
    ");

    $total = intval($conteo["total"] ?? 0);

    $filas = obtenerFilas("
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
            uf.nombre AS usuarioFinaliza,

            COUNT(DISTINCT s.id) AS totalBodegas,
            SUM(CASE WHEN s.estadoProceso = 'PENDIENTE' THEN 1 ELSE 0 END) AS pendientes,
            SUM(CASE WHEN s.estadoProceso = 'EN_PROCESO' THEN 1 ELSE 0 END) AS enProceso,
            SUM(CASE WHEN s.estadoProceso = 'ENVIADO' THEN 1 ELSE 0 END) AS enviados,
            SUM(CASE WHEN s.estadoProceso = 'DEVUELTO' THEN 1 ELSE 0 END) AS devueltos,
            SUM(CASE WHEN s.estadoProceso = 'APROBADO' THEN 1 ELSE 0 END) AS aprobados,
            SUM(CASE WHEN s.estadoProceso = 'FINALIZADO' THEN 1 ELSE 0 END) AS finalizados,
            SUM(CASE WHEN s.estadoProceso = 'ANULADO' THEN 1 ELSE 0 END) AS anulados,

            COUNT(DISTINCT CASE
                WHEN s.estadoProceso IN ('ENVIADO', 'APROBADO', 'FINALIZADO')
                THEN s.id
                ELSE NULL
            END) AS conteosCompletados,

            MIN(s.fechaEnvio) AS primeraFechaEnvio,
            MAX(s.fechaEnvio) AS ultimaFechaEnvio

        FROM InventarioOrdenesConteo o

        LEFT JOIN usuarios ur
            ON ur.id = o.idUsuarioRegistro

        LEFT JOIN usuarios ua
            ON ua.id = o.idUsuarioAnaliza

        LEFT JOIN usuarios uf
            ON uf.id = o.idUsuarioFinaliza

        LEFT JOIN InventarioSolicitudesConteo s
            ON s.idOrdenConteo = o.id

        WHERE $whereSql

        GROUP BY
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
            ur.nombre,
            ua.nombre,
            uf.nombre

        ORDER BY
            CASE o.estadoProceso
                WHEN 'EN_ANALISIS' THEN 1
                WHEN 'EN_CONTEO' THEN 2
                WHEN 'ABIERTA' THEN 3
                WHEN 'PROGRAMADA' THEN 4
                WHEN 'BORRADOR' THEN 5
                WHEN 'FINALIZADA' THEN 6
                ELSE 7
            END ASC,
            o.fechaCorte DESC,
            o.id DESC

        LIMIT $limite OFFSET $offset
    ");

    $ordenes = array_map(function ($fila) {
        $totalBodegas = intval($fila["totalBodegas"] ?? 0);
        $conteosCompletados = intval($fila["conteosCompletados"] ?? 0);

        $porcentajeAvance = $totalBodegas > 0
            ? round(($conteosCompletados / $totalBodegas) * 100, 2)
            : 0;

        return [
            "id" => intval($fila["id"]),
            "idOrdenConteo" => intval($fila["id"]),
            "codigo" => $fila["codigo"],
            "nombre" => $fila["nombre"],
            "descripcion" => $fila["descripcion"],
            "fechaCorte" => $fila["fechaCorte"],
            "fechaInicio" => $fila["fechaInicio"],
            "fechaLimite" => $fila["fechaLimite"],
            "tipoConteo" => $fila["tipoConteo"],
            "estadoProceso" => $fila["estadoProceso"],
            "mostrarResultadoBodegas" => intval($fila["mostrarResultadoBodegas"] ?? 0),
            "fechaInicioAnalisis" => $fila["fechaInicioAnalisis"],
            "fechaFinalizacionAnalisis" => $fila["fechaFinalizacionAnalisis"],
            "fechaPublicacionResultados" => $fila["fechaPublicacionResultados"],
            "idUsuarioRegistro" => $fila["idUsuarioRegistro"] !== null
                ? intval($fila["idUsuarioRegistro"])
                : null,
            "usuarioRegistro" => $fila["usuarioRegistro"],
            "idUsuarioAnaliza" => $fila["idUsuarioAnaliza"] !== null
                ? intval($fila["idUsuarioAnaliza"])
                : null,
            "usuarioAnaliza" => $fila["usuarioAnaliza"],
            "idUsuarioFinaliza" => $fila["idUsuarioFinaliza"] !== null
                ? intval($fila["idUsuarioFinaliza"])
                : null,
            "usuarioFinaliza" => $fila["usuarioFinaliza"],
            "observacion" => $fila["observacion"],
            "created_at" => $fila["created_at"],
            "updated_at" => $fila["updated_at"],
            "avance" => [
                "totalBodegas" => $totalBodegas,
                "pendientes" => intval($fila["pendientes"] ?? 0),
                "enProceso" => intval($fila["enProceso"] ?? 0),
                "enviados" => intval($fila["enviados"] ?? 0),
                "devueltos" => intval($fila["devueltos"] ?? 0),
                "aprobados" => intval($fila["aprobados"] ?? 0),
                "finalizados" => intval($fila["finalizados"] ?? 0),
                "anulados" => intval($fila["anulados"] ?? 0),
                "conteosCompletados" => $conteosCompletados,
                "porcentaje" => $porcentajeAvance
            ],
            "primeraFechaEnvio" => $fila["primeraFechaEnvio"],
            "ultimaFechaEnvio" => $fila["ultimaFechaEnvio"]
        ];
    }, $filas);

    responder(
        "si",
        "Órdenes de conteo consultadas correctamente",
        $ordenes,
        [
            "total" => $total,
            "pagina" => $pagina,
            "limite" => $limite,
            "totalPaginas" => $limite > 0
                ? intval(ceil($total / $limite))
                : 0,
            "filtros" => [
                "q" => $q,
                "estadoProceso" => $estadoProceso,
                "tipoConteo" => $tipoConteo,
                "idBodega" => $idBodega,
                "fechaDesde" => $fechaDesde,
                "fechaHasta" => $fechaHasta
            ]
        ]
    );
} catch (Throwable $e) {
    responder(
        "no",
        "Error consultando las órdenes de conteo",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
