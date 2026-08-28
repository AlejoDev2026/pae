<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// --- buffer para evitar "headers already sent" por warnings/notices ---
ob_start();

// --- Cabeceras anti-caché ---
header("Expires: Tue, 01 Jan 2000 00:00:00 GMT");
header("Last-Modified: " . gmdate("D, d M Y H:i:s") . " GMT");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

// --- CORS + JSON ---
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Cache-Control, Pragma, Expires");
header("Access-Control-Max-Age: 0");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

function jexit($code, $arr) {
    if (ob_get_length()) {
        ob_clean();
    }
    http_response_code($code);
    echo json_encode($arr, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function num($value) {
    return is_null($value) ? 0 : (float)$value;
}

function numInt($value) {
    return is_null($value) ? 0 : (int)$value;
}

function fetchAllAssoc($mysqli, $sql) {
    $result = $mysqli->query($sql);
    if (!$result) {
        throw new Exception("Error SQL: " . $mysqli->error . " | Query: " . $sql);
    }

    $rows = [];
    while ($row = $result->fetch_assoc()) {
        $rows[] = $row;
    }
    $result->free();

    return $rows;
}

function fetchOneAssoc($mysqli, $sql) {
    $result = $mysqli->query($sql);
    if (!$result) {
        throw new Exception("Error SQL: " . $mysqli->error . " | Query: " . $sql);
    }

    $row = $result->fetch_assoc();
    $result->free();

    return $row ?: [];
}

try {
    /* =========================
     * CONEXIÓN
     * ========================= */
  $mysqli = @new mysqli(
    "localhost",
    "accionpo_pae",
    "o#Ao0?ZEEec0s).i",
    "accionpo_pae"
);
    if ($mysqli->connect_errno) {
        jexit(500, [
            "ok" => false,
            "mensaje" => "No se pudo conectar a la base de datos.",
            "error" => $mysqli->connect_error
        ]);
    }

    $mysqli->set_charset("utf8mb4");

    // =========================
    // FILTROS OPCIONALES
    // =========================
    $fechaInicio = isset($_GET["fechaInicio"]) ? trim($_GET["fechaInicio"]) : "";
    $fechaFin    = isset($_GET["fechaFin"]) ? trim($_GET["fechaFin"]) : "";

    $where = [];

    if ($fechaInicio !== "" && $fechaFin !== "") {
        $fechaInicioEsc = $mysqli->real_escape_string($fechaInicio);
        $fechaFinEsc = $mysqli->real_escape_string($fechaFin);
        $where[] = "d.fechaDespacho BETWEEN '{$fechaInicioEsc}' AND '{$fechaFinEsc}'";
    }

    $whereSql = !empty($where) ? "WHERE " . implode(" AND ", $where) : "";

    // =========================
    // RESUMEN GENERAL
    // =========================
    $sqlResumenGeneral = "
        SELECT
            COUNT(DISTINCT d.id) AS totalDespachos,
            COUNT(DISTINCT da.id) AS totalArchivos,
            COUNT(DISTINCT r.id) AS totalRutas,
            COUNT(DISTINCT drp.idProducto) AS totalProductos,
            COUNT(DISTINCT drp.idColegio) AS totalColegios,
            COUNT(DISTINCT drp.idSede) AS totalSedes,
            SUM(drp.cantidad) AS totalCantidad,
            SUM(drp.totalCoberturaRuta) AS totalCoberturaRuta,
            SUM(drp.cajasPacas) AS totalCajasPacas,
            SUM(drp.unidades) AS totalUnidades
        FROM DespachosInforme d
        LEFT JOIN DespachoArchivos da
            ON da.idDespacho = d.id
        LEFT JOIN RutasDespacho r
            ON r.idDespacho = d.id
        LEFT JOIN DetalleRutaProducto drp
            ON drp.idDespacho = d.id
        {$whereSql}
    ";
    $resumenGeneral = fetchOneAssoc($mysqli, $sqlResumenGeneral);

    // =========================
    // RESUMEN POR JORNADA
    // =========================
    $sqlJornadas = "
        SELECT
            da.tipoArchivo AS jornada,
            COUNT(DISTINCT da.id) AS totalArchivos,
            COUNT(DISTINCT drp.idProducto) AS totalProductos,
            COUNT(DISTINCT drp.idRuta) AS totalRutas,
            SUM(drp.cantidad) AS totalCantidad,
            SUM(drp.totalCoberturaRuta) AS totalCoberturaRuta,
            SUM(drp.cajasPacas) AS totalCajasPacas,
            SUM(drp.unidades) AS totalUnidades
        FROM DespachoArchivos da
        INNER JOIN DespachosInforme d
            ON d.id = da.idDespacho
        LEFT JOIN DetalleRutaProducto drp
            ON drp.idDespachoArchivo = da.id
        {$whereSql}
        GROUP BY da.tipoArchivo
        ORDER BY FIELD(da.tipoArchivo, 'AM', 'PM', 'JORNADA_UNICA')
    ";
    $resumenJornadas = fetchAllAssoc($mysqli, $sqlJornadas);

    // =========================
    // RESUMEN POR CATEGORÍA
    // =========================
    $sqlCategorias = "
        SELECT
            c.id,
            c.nombre,
            COUNT(DISTINCT drp.idProducto) AS totalProductos,
            SUM(drp.cantidad) AS totalCantidad,
            SUM(drp.totalCoberturaRuta) AS totalCoberturaRuta,
            SUM(drp.cajasPacas) AS totalCajasPacas,
            SUM(drp.unidades) AS totalUnidades
        FROM DetalleRutaProducto drp
        INNER JOIN DespachosInforme d
            ON d.id = drp.idDespacho
        INNER JOIN ProductosCatalogo p
            ON p.id = drp.idProducto
        LEFT JOIN GruposProducto g
            ON g.id = p.idGrupo
        LEFT JOIN CategoriasProducto c
            ON c.id = g.idCategoria
        {$whereSql}
        GROUP BY c.id, c.nombre
        ORDER BY totalCantidad DESC, c.nombre ASC
    ";
    $categorias = fetchAllAssoc($mysqli, $sqlCategorias);

    // =========================
    // TOP 10 RUTAS
    // =========================
    $sqlTopRutas = "
        SELECT
            r.id,
            r.nombreRuta,
            r.ordenRuta,
            COUNT(DISTINCT drp.idProducto) AS totalProductos,
            COUNT(DISTINCT drp.idColegio) AS totalColegios,
            COUNT(DISTINCT drp.idSede) AS totalSedes,
            SUM(drp.cantidad) AS totalCantidad,
            SUM(drp.totalCoberturaRuta) AS totalCoberturaRuta,
            SUM(drp.cajasPacas) AS totalCajasPacas,
            SUM(drp.unidades) AS totalUnidades
        FROM RutasDespacho r
        INNER JOIN DespachosInforme d
            ON d.id = r.idDespacho
        LEFT JOIN DetalleRutaProducto drp
            ON drp.idRuta = r.id
        {$whereSql}
        GROUP BY r.id, r.nombreRuta, r.ordenRuta
        ORDER BY totalCantidad DESC, r.nombreRuta ASC
        LIMIT 10
    ";
    $topRutas = fetchAllAssoc($mysqli, $sqlTopRutas);

    // =========================
    // TOP 10 PRODUCTOS
    // =========================
    $sqlTopProductos = "
        SELECT
            p.id,
            p.codigo,
            p.descripcion,
            COUNT(DISTINCT drp.idRuta) AS totalRutas,
            SUM(drp.cantidad) AS totalCantidad,
            SUM(drp.totalCoberturaRuta) AS totalCoberturaRuta,
            SUM(drp.cajasPacas) AS totalCajasPacas,
            SUM(drp.unidades) AS totalUnidades
        FROM ProductosCatalogo p
        INNER JOIN DetalleRutaProducto drp
            ON drp.idProducto = p.id
        INNER JOIN DespachosInforme d
            ON d.id = drp.idDespacho
        {$whereSql}
        GROUP BY p.id, p.codigo, p.descripcion
        ORDER BY totalCantidad DESC, p.descripcion ASC
        LIMIT 10
    ";
    $topProductos = fetchAllAssoc($mysqli, $sqlTopProductos);

    // =========================
    // ÚLTIMOS DESPACHOS
    // =========================
    $sqlUltimosDespachos = "
        SELECT
            d.id,
            d.codigo,
            d.fechaDespacho,
            d.tipoPeriodo,
            d.descripcion,
            d.idEstado,
            COUNT(DISTINCT da.id) AS totalArchivos,
            COUNT(DISTINCT r.id) AS totalRutas,
            COUNT(DISTINCT drp.idProducto) AS totalProductos,
            SUM(drp.cantidad) AS totalCantidad
        FROM DespachosInforme d
        LEFT JOIN DespachoArchivos da
            ON da.idDespacho = d.id
        LEFT JOIN RutasDespacho r
            ON r.idDespacho = d.id
        LEFT JOIN DetalleRutaProducto drp
            ON drp.idDespacho = d.id
        {$whereSql}
        GROUP BY d.id, d.codigo, d.fechaDespacho, d.tipoPeriodo, d.descripcion, d.idEstado
        ORDER BY d.fechaDespacho DESC, d.id DESC
        LIMIT 10
    ";
    $ultimosDespachos = fetchAllAssoc($mysqli, $sqlUltimosDespachos);

    // =========================
    // ÚLTIMOS ARCHIVOS
    // =========================
    $sqlUltimosArchivos = "
        SELECT
            da.id,
            da.idDespacho,
            da.tipoArchivo,
            da.nombreArchivo,
            da.hojasDetectadas,
            da.rutasDetectadas,
            da.idEstado,
            da.mensajeError,
            da.created_at,
            da.updated_at,
            d.codigo AS codigoDespacho,
            d.fechaDespacho
        FROM DespachoArchivos da
        INNER JOIN DespachosInforme d
            ON d.id = da.idDespacho
        {$whereSql}
        ORDER BY da.created_at DESC, da.id DESC
        LIMIT 10
    ";
    $ultimosArchivos = fetchAllAssoc($mysqli, $sqlUltimosArchivos);

    jexit(200, [
        "ok" => true,
        "filtros" => [
            "fechaInicio" => $fechaInicio !== "" ? $fechaInicio : null,
            "fechaFin" => $fechaFin !== "" ? $fechaFin : null,
        ],
        "resumenGeneral" => [
            "totalDespachos" => numInt($resumenGeneral["totalDespachos"] ?? 0),
            "totalArchivos" => numInt($resumenGeneral["totalArchivos"] ?? 0),
            "totalRutas" => numInt($resumenGeneral["totalRutas"] ?? 0),
            "totalProductos" => numInt($resumenGeneral["totalProductos"] ?? 0),
            "totalColegios" => numInt($resumenGeneral["totalColegios"] ?? 0),
            "totalSedes" => numInt($resumenGeneral["totalSedes"] ?? 0),
            "totalCantidad" => num($resumenGeneral["totalCantidad"] ?? 0),
            "totalCoberturaRuta" => num($resumenGeneral["totalCoberturaRuta"] ?? 0),
            "totalCajasPacas" => num($resumenGeneral["totalCajasPacas"] ?? 0),
            "totalUnidades" => num($resumenGeneral["totalUnidades"] ?? 0),
        ],
        "resumenJornadas" => array_map(function ($row) {
            return [
                "jornada" => $row["jornada"] ?? "",
                "totalArchivos" => numInt($row["totalArchivos"] ?? 0),
                "totalProductos" => numInt($row["totalProductos"] ?? 0),
                "totalRutas" => numInt($row["totalRutas"] ?? 0),
                "totalCantidad" => num($row["totalCantidad"] ?? 0),
                "totalCoberturaRuta" => num($row["totalCoberturaRuta"] ?? 0),
                "totalCajasPacas" => num($row["totalCajasPacas"] ?? 0),
                "totalUnidades" => num($row["totalUnidades"] ?? 0),
            ];
        }, $resumenJornadas),
        "categorias" => array_map(function ($row) {
            return [
                "id" => numInt($row["id"] ?? 0),
                "nombre" => !empty($row["nombre"]) ? $row["nombre"] : "Sin categoría",
                "totalProductos" => numInt($row["totalProductos"] ?? 0),
                "totalCantidad" => num($row["totalCantidad"] ?? 0),
                "totalCoberturaRuta" => num($row["totalCoberturaRuta"] ?? 0),
                "totalCajasPacas" => num($row["totalCajasPacas"] ?? 0),
                "totalUnidades" => num($row["totalUnidades"] ?? 0),
            ];
        }, $categorias),
        "topRutas" => array_map(function ($row) {
            return [
                "id" => numInt($row["id"] ?? 0),
                "nombreRuta" => $row["nombreRuta"] ?? "",
                "ordenRuta" => isset($row["ordenRuta"]) ? (int)$row["ordenRuta"] : null,
                "totalProductos" => numInt($row["totalProductos"] ?? 0),
                "totalColegios" => numInt($row["totalColegios"] ?? 0),
                "totalSedes" => numInt($row["totalSedes"] ?? 0),
                "totalCantidad" => num($row["totalCantidad"] ?? 0),
                "totalCoberturaRuta" => num($row["totalCoberturaRuta"] ?? 0),
                "totalCajasPacas" => num($row["totalCajasPacas"] ?? 0),
                "totalUnidades" => num($row["totalUnidades"] ?? 0),
            ];
        }, $topRutas),
        "topProductos" => array_map(function ($row) {
            return [
                "id" => numInt($row["id"] ?? 0),
                "codigo" => $row["codigo"] ?? "",
                "descripcion" => $row["descripcion"] ?? "",
                "totalRutas" => numInt($row["totalRutas"] ?? 0),
                "totalCantidad" => num($row["totalCantidad"] ?? 0),
                "totalCoberturaRuta" => num($row["totalCoberturaRuta"] ?? 0),
                "totalCajasPacas" => num($row["totalCajasPacas"] ?? 0),
                "totalUnidades" => num($row["totalUnidades"] ?? 0),
            ];
        }, $topProductos),
        "ultimosDespachos" => array_map(function ($row) {
            return [
                "id" => numInt($row["id"] ?? 0),
                "codigo" => $row["codigo"] ?? "",
                "fechaDespacho" => $row["fechaDespacho"] ?? null,
                "tipoPeriodo" => $row["tipoPeriodo"] ?? "",
                "descripcion" => $row["descripcion"] ?? "",
                "idEstado" => numInt($row["idEstado"] ?? 0),
                "totalArchivos" => numInt($row["totalArchivos"] ?? 0),
                "totalRutas" => numInt($row["totalRutas"] ?? 0),
                "totalProductos" => numInt($row["totalProductos"] ?? 0),
                "totalCantidad" => num($row["totalCantidad"] ?? 0),
            ];
        }, $ultimosDespachos),
        "ultimosArchivos" => array_map(function ($row) {
            return [
                "id" => numInt($row["id"] ?? 0),
                "idDespacho" => numInt($row["idDespacho"] ?? 0),
                "codigoDespacho" => $row["codigoDespacho"] ?? "",
                "fechaDespacho" => $row["fechaDespacho"] ?? null,
                "tipoArchivo" => $row["tipoArchivo"] ?? "",
                "nombreArchivo" => $row["nombreArchivo"] ?? "",
                "hojasDetectadas" => numInt($row["hojasDetectadas"] ?? 0),
                "rutasDetectadas" => numInt($row["rutasDetectadas"] ?? 0),
                "idEstado" => numInt($row["idEstado"] ?? 0),
                "mensajeError" => $row["mensajeError"] ?? "",
                "created_at" => $row["created_at"] ?? null,
                "updated_at" => $row["updated_at"] ?? null,
            ];
        }, $ultimosArchivos),
    ]);

} catch (Throwable $e) {
    jexit(500, [
        "ok" => false,
        "mensaje" => "Error interno al consultar el dashboard general.",
        "error" => $e->getMessage(),
        "linea" => $e->getLine(),
        "archivo" => $e->getFile(),
    ]);
}