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

function parametro($nombre, $default = "")
{
    if (isset($_GET[$nombre])) {
        return limpiarTexto($_GET[$nombre]);
    }

    if (isset($_POST[$nombre])) {
        return limpiarTexto($_POST[$nombre]);
    }

    return $default;
}

function esc($valor)
{
    global $conexion;
    return $conexion->real_escape_string((string)($valor ?? ""));
}

function decimalSeguro($valor)
{
    if ($valor === null || $valor === "") {
        return 0;
    }

    return round(floatval(str_replace(",", ".", (string)$valor)), 3);
}

function obtenerFilas($sql)
{
    global $conexion;

    $res = $conexion->query($sql);

    if (!$res) {
        throw new Exception($conexion->error);
    }

    $data = [];

    while ($fila = $res->fetch_assoc()) {
        $data[] = $fila;
    }

    return $data;
}

function fechaValida($fecha)
{
    $fecha = limpiarTexto($fecha);

    if ($fecha === "") {
        return "";
    }

    $fecha = substr($fecha, 0, 10);

    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)) {
        return "";
    }

    return $fecha;
}

try {
    /*
     * Parámetros originales utilizados por Entradas.
     */
    $q = parametro("q", parametro("busqueda", ""));
    $idProducto = intval(parametro("idProducto", 0));
    $estado = parametro("estado", "");
    $limite = intval(parametro("limite", 100));

    /*
     * Filtros nuevos para el módulo de Control / Lotes y vencimientos.
     * Todos son opcionales para mantener compatibilidad con Entradas.
     */
    $idBodega = intval(parametro("idBodega", 0));
    $idUbicacion = intval(parametro("idUbicacion", 0));
    $idTipoProducto = intval(parametro("idTipoProducto", 0));
    $clasificacion = strtoupper(limpiarTexto(parametro("clasificacion", "")));
    $fechaDesde = fechaValida(parametro("fechaDesde", ""));
    $fechaHasta = fechaValida(parametro("fechaHasta", ""));
    $soloConExistencia = intval(parametro("soloConExistencia", 0));

    if ($limite <= 0 || $limite > 500) {
        $limite = 100;
    }

    $where = [
        "1 = 1"
    ];

    $having = [
        "1 = 1"
    ];

    if ($idProducto > 0) {
        $where[] = "l.idProducto = $idProducto";
    }

    if ($idBodega > 0) {
        $where[] = "ie.idBodega = $idBodega";
    }

    if ($idUbicacion > 0) {
        $where[] = "ie.idUbicacion = $idUbicacion";
    }

    if ($idTipoProducto > 0) {
        $where[] = "pic.idTipoProductoInventario = $idTipoProducto";
    }

    if ($estado !== "") {
        $where[] = "l.estado = " . intval($estado);
    }

    if ($fechaDesde !== "") {
        $fechaDesdeEsc = esc($fechaDesde);
        $where[] = "l.fechaVencimiento >= '$fechaDesdeEsc'";
    }

    if ($fechaHasta !== "") {
        $fechaHastaEsc = esc($fechaHasta);
        $where[] = "l.fechaVencimiento <= '$fechaHastaEsc'";
    }

    if ($q !== "") {
        $qEsc = esc($q);
        $like = "%" . $qEsc . "%";

        $where[] = "
            (
                l.lote LIKE '$like'
                OR pc.codigo LIKE '$like'
                OR pc.descripcion LIKE '$like'
            )
        ";
    }

    switch ($clasificacion) {
        case "VENCIDO":
            $where[] = "
                l.fechaVencimiento IS NOT NULL
                AND l.fechaVencimiento < CURDATE()
            ";
            break;

        case "CRITICO":
            $where[] = "
                l.fechaVencimiento BETWEEN CURDATE()
                AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
            ";
            break;

        case "PROXIMO":
            $where[] = "
                l.fechaVencimiento BETWEEN DATE_ADD(CURDATE(), INTERVAL 31 DAY)
                AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
            ";
            break;

        case "VIGENTE":
            $where[] = "
                l.fechaVencimiento > DATE_ADD(CURDATE(), INTERVAL 60 DAY)
            ";
            break;

        case "SIN_VENCIMIENTO":
            $where[] = "l.fechaVencimiento IS NULL";
            break;

        case "SIN_EXISTENCIA":
            $having[] = "
                (
                    COALESCE(SUM(ie.cantidadDisponible), 0)
                    + COALESCE(SUM(ie.cantidadReservada), 0)
                    + COALESCE(SUM(ie.cantidadBloqueada), 0)
                ) <= 0
            ";
            break;
    }

    if ($soloConExistencia === 1) {
        $having[] = "
            (
                COALESCE(SUM(ie.cantidadDisponible), 0)
                + COALESCE(SUM(ie.cantidadReservada), 0)
                + COALESCE(SUM(ie.cantidadBloqueada), 0)
            ) > 0
        ";
    }

    $sql = "
        SELECT
            l.id,
            l.idProducto,
            l.lote,
            l.fechaFabricacion,
            l.fechaVencimiento,
            l.fechaIngreso,
            l.observacion,
            l.estado,
            l.created_at,
            l.updated_at,

            pc.codigo AS codigoProducto,
            pc.descripcion AS nombreProducto,

            pic.idTipoProductoInventario AS idTipoProducto,
            tpi.nombre AS tipoProducto,
            pic.manejaLote,
            pic.manejaVencimiento,
            pic.unidadBaseInventario,

            COALESCE(SUM(ie.cantidadDisponible), 0) AS cantidadDisponible,
            COALESCE(SUM(ie.cantidadReservada), 0) AS cantidadReservada,
            COALESCE(SUM(ie.cantidadBloqueada), 0) AS cantidadBloqueada,

            (
                COALESCE(SUM(ie.cantidadDisponible), 0)
                + COALESCE(SUM(ie.cantidadReservada), 0)
                + COALESCE(SUM(ie.cantidadBloqueada), 0)
            ) AS cantidadTotal,

            CASE
                WHEN l.fechaVencimiento IS NULL THEN 'SIN_VENCIMIENTO'
                WHEN l.fechaVencimiento < CURDATE() THEN 'VENCIDO'
                WHEN l.fechaVencimiento <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'CRITICO'
                WHEN l.fechaVencimiento <= DATE_ADD(CURDATE(), INTERVAL 60 DAY) THEN 'PROXIMO'
                ELSE 'VIGENTE'
            END AS clasificacionVencimiento,

            CASE
                WHEN l.fechaVencimiento IS NULL THEN NULL
                ELSE DATEDIFF(l.fechaVencimiento, CURDATE())
            END AS diasParaVencer

        FROM InventarioLotes l

        INNER JOIN ProductosCatalogo pc
            ON pc.id = l.idProducto

        LEFT JOIN ProductosInventarioConfig pic
            ON pic.idProducto = pc.id

        LEFT JOIN TiposProductoInventario tpi
            ON tpi.id = pic.idTipoProductoInventario

        LEFT JOIN InventarioExistencias ie
            ON ie.idLote = l.id
            AND ie.idProducto = l.idProducto

        WHERE " . implode(" AND ", $where) . "

        GROUP BY
            l.id,
            l.idProducto,
            l.lote,
            l.fechaFabricacion,
            l.fechaVencimiento,
            l.fechaIngreso,
            l.observacion,
            l.estado,
            l.created_at,
            l.updated_at,
            pc.codigo,
            pc.descripcion,
            pic.idTipoProductoInventario,
            tpi.nombre,
            pic.manejaLote,
            pic.manejaVencimiento,
            pic.unidadBaseInventario

        HAVING " . implode(" AND ", $having) . "

        ORDER BY
            CASE
                WHEN l.fechaVencimiento IS NULL THEN 2
                WHEN l.fechaVencimiento < CURDATE() THEN 0
                ELSE 1
            END ASC,
            l.fechaVencimiento ASC,
            pc.descripcion ASC,
            l.lote ASC

        LIMIT $limite
    ";

    $filas = obtenerFilas($sql);

    $data = [];

    foreach ($filas as $fila) {
        $cantidadDisponible = decimalSeguro($fila["cantidadDisponible"]);
        $cantidadReservada = decimalSeguro($fila["cantidadReservada"]);
        $cantidadBloqueada = decimalSeguro($fila["cantidadBloqueada"]);
        $cantidadTotal = decimalSeguro($fila["cantidadTotal"]);

        $diasParaVencer = $fila["diasParaVencer"] !== null
            ? intval($fila["diasParaVencer"])
            : null;

        $clasificacionFila = (string)($fila["clasificacionVencimiento"] ?? "SIN_VENCIMIENTO");

        $data[] = [
            /*
             * Campos originales. No se eliminan ni se renombran para conservar
             * compatibilidad con el flujo de Entradas.
             */
            "idLote" => intval($fila["id"]),
            "id" => intval($fila["id"]),
            "idProducto" => intval($fila["idProducto"]),
            "lote" => (string)$fila["lote"],
            "fechaFabricacion" => $fila["fechaFabricacion"],
            "fechaVencimiento" => $fila["fechaVencimiento"],
            "fechaIngreso" => $fila["fechaIngreso"],
            "observacion" => $fila["observacion"],
            "estado" => intval($fila["estado"]),
            "estadoTexto" => intval($fila["estado"]) === 1 ? "Activo" : "Inactivo",
            "created_at" => $fila["created_at"],
            "updated_at" => $fila["updated_at"],

            "codigoProducto" => (string)$fila["codigoProducto"],
            "nombreProducto" => (string)$fila["nombreProducto"],
            "producto" => (string)$fila["nombreProducto"],

            "manejaLote" => intval($fila["manejaLote"] ?? 1),
            "manejaVencimiento" => intval($fila["manejaVencimiento"] ?? 1),
            "unidadBaseInventario" => (string)($fila["unidadBaseInventario"] ?? "UND"),

            "cantidadDisponible" => $cantidadDisponible,
            "cantidadReservada" => $cantidadReservada,
            "cantidadBloqueada" => $cantidadBloqueada,

            /*
             * Campos nuevos para el módulo de Control.
             */
            "idTipoProducto" => $fila["idTipoProducto"] !== null
                ? intval($fila["idTipoProducto"])
                : null,
            "tipoProducto" => $fila["tipoProducto"],
            "cantidadTotal" => $cantidadTotal,
            "clasificacionVencimiento" => $clasificacionFila,
            "diasParaVencer" => $diasParaVencer,
            "estaVencido" => $clasificacionFila === "VENCIDO" ? 1 : 0,
            "proximoAVencer" => in_array(
                $clasificacionFila,
                ["CRITICO", "PROXIMO"],
                true
            ) ? 1 : 0,
            "tieneExistencia" => $cantidadTotal > 0 ? 1 : 0
        ];
    }

    responder(
        "si",
        "Lotes consultados correctamente",
        $data,
        [
            "total" => count($data),
            "filtros" => [
                "q" => $q,
                "idProducto" => $idProducto,
                "idBodega" => $idBodega,
                "idUbicacion" => $idUbicacion,
                "idTipoProducto" => $idTipoProducto,
                "estado" => $estado,
                "clasificacion" => $clasificacion,
                "fechaDesde" => $fechaDesde,
                "fechaHasta" => $fechaHasta,
                "soloConExistencia" => $soloConExistencia,
                "limite" => $limite
            ]
        ]
    );
} catch (Throwable $e) {
    responder(
        "no",
        "Error consultando lotes",
        [],
        ["error" => $e->getMessage()],
        500
    );
}
?>
