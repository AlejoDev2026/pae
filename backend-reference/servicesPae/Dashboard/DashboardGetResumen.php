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

function tableExists($mysqli, $table) {
    static $cache = [];
    if (array_key_exists($table, $cache)) {
        return $cache[$table];
    }
    $tableEsc = $mysqli->real_escape_string($table);
    $row = fetchOneAssoc($mysqli, "SHOW TABLES LIKE '{$tableEsc}'");
    $cache[$table] = !empty($row);
    return $cache[$table];
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
    $modoCompacto = isset($_GET["compacto"]) && (string)$_GET["compacto"] === "1";

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
            dg.totalDespachos,
            ar.totalArchivos,
            ru.totalRutas,
            de.totalProductos,
            de.totalColegios,
            de.totalSedes,
            de.totalCantidad,
            de.totalCoberturaRuta,
            de.totalCajasPacas,
            de.totalUnidades
        FROM
            (SELECT COUNT(*) AS totalDespachos FROM DespachosInforme d {$whereSql}) dg
        CROSS JOIN
            (SELECT COUNT(*) AS totalArchivos
             FROM DespachoArchivos da
             INNER JOIN DespachosInforme d ON d.id = da.idDespacho
             {$whereSql}) ar
        CROSS JOIN
            (SELECT COUNT(*) AS totalRutas
             FROM RutasDespacho r
             INNER JOIN DespachosInforme d ON d.id = r.idDespacho
             {$whereSql}) ru
        CROSS JOIN
            (SELECT
                COUNT(DISTINCT drp.idProducto) AS totalProductos,
                COUNT(DISTINCT drp.idColegio) AS totalColegios,
                COUNT(DISTINCT drp.idSede) AS totalSedes,
                SUM(drp.cantidad) AS totalCantidad,
                SUM(drp.totalCoberturaRuta) AS totalCoberturaRuta,
                SUM(drp.cajasPacas) AS totalCajasPacas,
                SUM(drp.unidades) AS totalUnidades
             FROM DetalleRutaProducto drp
             INNER JOIN DespachosInforme d ON d.id = drp.idDespacho
             {$whereSql}) de
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
    $resumenJornadas = $modoCompacto ? [] : fetchAllAssoc($mysqli, $sqlJornadas);

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
    $categorias = $modoCompacto ? [] : fetchAllAssoc($mysqli, $sqlCategorias);

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
    $topRutas = $modoCompacto ? [] : fetchAllAssoc($mysqli, $sqlTopRutas);

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
    $topProductos = $modoCompacto ? [] : fetchAllAssoc($mysqli, $sqlTopProductos);

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
            (SELECT COUNT(*) FROM DespachoArchivos da WHERE da.idDespacho = d.id) AS totalArchivos,
            (SELECT COUNT(*) FROM RutasDespacho r WHERE r.idDespacho = d.id) AS totalRutas,
            (SELECT COUNT(DISTINCT drp.idProducto) FROM DetalleRutaProducto drp WHERE drp.idDespacho = d.id) AS totalProductos,
            (SELECT SUM(drp.cantidad) FROM DetalleRutaProducto drp WHERE drp.idDespacho = d.id) AS totalCantidad
        FROM DespachosInforme d
        {$whereSql}
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
    $ultimosArchivos = $modoCompacto ? [] : fetchAllAssoc($mysqli, $sqlUltimosArchivos);

    // =========================
    // INVENTARIO Y VENCIMIENTOS
    // =========================
    $inventario = [
        "resumen" => [
            "totalProductos" => 0,
            "productosSinExistencia" => 0,
            "productosBajoMinimo" => 0,
            "cantidadDisponible" => 0,
            "cantidadReservada" => 0,
            "cantidadBloqueada" => 0,
            "cantidadTotal" => 0,
            "porcentajeDisponible" => 0,
        ],
        "vencimientos" => [
            "lotesVencidos" => 0,
            "productosVencidos" => 0,
            "cantidadVencida" => 0,
            "lotesCriticos" => 0,
            "productosCriticos" => 0,
            "cantidadCritica" => 0,
            "lotesProximos" => 0,
            "productosProximos" => 0,
            "cantidadProxima" => 0,
        ],
        "alertasVencimiento" => [],
        "alertasPorBodega" => [],
        "ordenesAlistamiento" => [
            "total" => 0,
            "pendientesAsignacion" => 0,
            "asignadas" => 0,
            "enAlistamiento" => 0,
            "conPendientes" => 0,
            "completas" => 0,
            "enLogistica" => 0,
        ],
    ];

    if (tableExists($mysqli, "InventarioExistencias")) {
        $resumenInventario = fetchOneAssoc($mysqli, "
            SELECT
                COUNT(DISTINCT x.idProducto) AS totalProductos,
                SUM(CASE WHEN x.cantidadTotal <= 0 THEN 1 ELSE 0 END) AS productosSinExistencia,
                SUM(CASE
                    WHEN x.stockMinimo > 0 AND x.cantidadDisponible < x.stockMinimo
                    THEN 1 ELSE 0
                END) AS productosBajoMinimo,
                SUM(x.cantidadDisponible) AS cantidadDisponible,
                SUM(x.cantidadReservada) AS cantidadReservada,
                SUM(x.cantidadBloqueada) AS cantidadBloqueada,
                SUM(x.cantidadTotal) AS cantidadTotal
            FROM (
                SELECT
                    e.idProducto,
                    COALESCE(pic.stockMinimo, 0) AS stockMinimo,
                    SUM(COALESCE(e.cantidadDisponible, 0)) AS cantidadDisponible,
                    SUM(COALESCE(e.cantidadReservada, 0)) AS cantidadReservada,
                    SUM(COALESCE(e.cantidadBloqueada, 0)) AS cantidadBloqueada,
                    SUM(COALESCE(e.cantidadDisponible, 0) + COALESCE(e.cantidadReservada, 0) + COALESCE(e.cantidadBloqueada, 0)) AS cantidadTotal
                FROM InventarioExistencias e
                LEFT JOIN ProductosInventarioConfig pic ON pic.idProducto = e.idProducto
                GROUP BY e.idProducto, pic.stockMinimo
            ) x
        ");

        $totalInventario = num($resumenInventario["cantidadTotal"] ?? 0);
        $disponibleInventario = num($resumenInventario["cantidadDisponible"] ?? 0);
        $inventario["resumen"] = [
            "totalProductos" => numInt($resumenInventario["totalProductos"] ?? 0),
            "productosSinExistencia" => numInt($resumenInventario["productosSinExistencia"] ?? 0),
            "productosBajoMinimo" => numInt($resumenInventario["productosBajoMinimo"] ?? 0),
            "cantidadDisponible" => $disponibleInventario,
            "cantidadReservada" => num($resumenInventario["cantidadReservada"] ?? 0),
            "cantidadBloqueada" => num($resumenInventario["cantidadBloqueada"] ?? 0),
            "cantidadTotal" => $totalInventario,
            "porcentajeDisponible" => $totalInventario > 0 ? round(($disponibleInventario / $totalInventario) * 100, 2) : 0,
        ];
    }

    if (tableExists($mysqli, "InventarioLotes") && tableExists($mysqli, "InventarioExistencias")) {
        $resumenVencimientos = fetchOneAssoc($mysqli, "
            SELECT
                COUNT(DISTINCT CASE WHEN x.fechaVencimiento < CURDATE() AND x.cantidadTotal > 0 THEN x.idLote END) AS lotesVencidos,
                COUNT(DISTINCT CASE WHEN x.fechaVencimiento < CURDATE() AND x.cantidadTotal > 0 THEN x.idProducto END) AS productosVencidos,
                SUM(CASE WHEN x.fechaVencimiento < CURDATE() THEN x.cantidadDisponible ELSE 0 END) AS cantidadVencida,
                COUNT(DISTINCT CASE WHEN x.fechaVencimiento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND x.cantidadTotal > 0 THEN x.idLote END) AS lotesCriticos,
                COUNT(DISTINCT CASE WHEN x.fechaVencimiento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) AND x.cantidadTotal > 0 THEN x.idProducto END) AS productosCriticos,
                SUM(CASE WHEN x.fechaVencimiento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN x.cantidadDisponible ELSE 0 END) AS cantidadCritica,
                COUNT(DISTINCT CASE WHEN x.fechaVencimiento BETWEEN DATE_ADD(CURDATE(), INTERVAL 31 DAY) AND DATE_ADD(CURDATE(), INTERVAL 60 DAY) AND x.cantidadTotal > 0 THEN x.idLote END) AS lotesProximos,
                COUNT(DISTINCT CASE WHEN x.fechaVencimiento BETWEEN DATE_ADD(CURDATE(), INTERVAL 31 DAY) AND DATE_ADD(CURDATE(), INTERVAL 60 DAY) AND x.cantidadTotal > 0 THEN x.idProducto END) AS productosProximos,
                SUM(CASE WHEN x.fechaVencimiento BETWEEN DATE_ADD(CURDATE(), INTERVAL 31 DAY) AND DATE_ADD(CURDATE(), INTERVAL 60 DAY) THEN x.cantidadDisponible ELSE 0 END) AS cantidadProxima
            FROM (
                SELECT l.id AS idLote, l.idProducto, l.fechaVencimiento,
                    SUM(COALESCE(e.cantidadDisponible, 0)) AS cantidadDisponible,
                    SUM(COALESCE(e.cantidadDisponible, 0) + COALESCE(e.cantidadReservada, 0) + COALESCE(e.cantidadBloqueada, 0)) AS cantidadTotal
                FROM InventarioLotes l
                LEFT JOIN InventarioExistencias e ON e.idLote = l.id AND e.idProducto = l.idProducto
                WHERE l.estado = 1 AND l.fechaVencimiento IS NOT NULL AND l.fechaVencimiento <> '0000-00-00'
                GROUP BY l.id, l.idProducto, l.fechaVencimiento
            ) x
        ");
        $inventario["vencimientos"] = [
            "lotesVencidos" => numInt($resumenVencimientos["lotesVencidos"] ?? 0),
            "productosVencidos" => numInt($resumenVencimientos["productosVencidos"] ?? 0),
            "cantidadVencida" => num($resumenVencimientos["cantidadVencida"] ?? 0),
            "lotesCriticos" => numInt($resumenVencimientos["lotesCriticos"] ?? 0),
            "productosCriticos" => numInt($resumenVencimientos["productosCriticos"] ?? 0),
            "cantidadCritica" => num($resumenVencimientos["cantidadCritica"] ?? 0),
            "lotesProximos" => numInt($resumenVencimientos["lotesProximos"] ?? 0),
            "productosProximos" => numInt($resumenVencimientos["productosProximos"] ?? 0),
            "cantidadProxima" => num($resumenVencimientos["cantidadProxima"] ?? 0),
        ];

        $alertasVencimiento = fetchAllAssoc($mysqli, "
            SELECT p.id AS idProducto, p.codigo, p.descripcion AS producto,
                l.id AS idLote, l.lote, l.fechaVencimiento,
                DATEDIFF(l.fechaVencimiento, CURDATE()) AS diasParaVencer,
                b.nombre AS bodega, u.nombre AS ubicacion,
                SUM(COALESCE(e.cantidadDisponible, 0)) AS cantidadDisponible,
                CASE WHEN l.fechaVencimiento < CURDATE() THEN 'VENCIDO'
                     WHEN l.fechaVencimiento <= DATE_ADD(CURDATE(), INTERVAL 30 DAY) THEN 'CRITICO'
                     ELSE 'PROXIMO' END AS clasificacion
            FROM InventarioLotes l
            INNER JOIN ProductosCatalogo p ON p.id = l.idProducto
            INNER JOIN InventarioExistencias e ON e.idLote = l.id AND e.idProducto = l.idProducto
            INNER JOIN BodegasInventario b ON b.id = e.idBodega
            LEFT JOIN UbicacionesInventario u ON u.id = e.idUbicacion
            WHERE l.estado = 1
              AND l.fechaVencimiento IS NOT NULL AND l.fechaVencimiento <> '0000-00-00'
              AND l.fechaVencimiento <= DATE_ADD(CURDATE(), INTERVAL 60 DAY)
              AND e.cantidadDisponible > 0
            GROUP BY p.id, p.codigo, p.descripcion, l.id, l.lote, l.fechaVencimiento, b.id, b.nombre, u.id, u.nombre
            ORDER BY l.fechaVencimiento ASC, cantidadDisponible DESC
            LIMIT 12
        ");
        $inventario["alertasVencimiento"] = array_map(function ($row) {
            return [
                "idProducto" => numInt($row["idProducto"] ?? 0), "codigo" => $row["codigo"] ?? "",
                "producto" => $row["producto"] ?? "", "idLote" => numInt($row["idLote"] ?? 0),
                "lote" => $row["lote"] ?? "", "fechaVencimiento" => $row["fechaVencimiento"] ?? null,
                "diasParaVencer" => numInt($row["diasParaVencer"] ?? 0), "bodega" => $row["bodega"] ?? "",
                "ubicacion" => $row["ubicacion"] ?? "", "cantidadDisponible" => num($row["cantidadDisponible"] ?? 0),
                "clasificacion" => $row["clasificacion"] ?? "PROXIMO",
            ];
        }, $alertasVencimiento);

        $inventario["alertasPorBodega"] = array_map(function ($row) {
            return [
                "idBodega" => numInt($row["idBodega"] ?? 0), "bodega" => $row["bodega"] ?? "",
                "lotesVencidos" => numInt($row["lotesVencidos"] ?? 0),
                "lotesPorVencer" => numInt($row["lotesPorVencer"] ?? 0),
                "cantidadComprometida" => num($row["cantidadComprometida"] ?? 0),
            ];
        }, fetchAllAssoc($mysqli, "
            SELECT b.id AS idBodega, b.nombre AS bodega,
                COUNT(DISTINCT CASE WHEN l.fechaVencimiento < CURDATE() THEN l.id END) AS lotesVencidos,
                COUNT(DISTINCT CASE WHEN l.fechaVencimiento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY) THEN l.id END) AS lotesPorVencer,
                SUM(e.cantidadDisponible) AS cantidadComprometida
            FROM InventarioExistencias e
            INNER JOIN InventarioLotes l ON l.id = e.idLote AND l.idProducto = e.idProducto
            INNER JOIN BodegasInventario b ON b.id = e.idBodega
            WHERE e.cantidadDisponible > 0 AND l.estado = 1
              AND l.fechaVencimiento <= DATE_ADD(CURDATE(), INTERVAL 60 DAY)
            GROUP BY b.id, b.nombre
            ORDER BY cantidadComprometida DESC
            LIMIT 8
        "));
    }

    if (tableExists($mysqli, "InventarioOrdenesAlistamiento") && tableExists($mysqli, "Estados")) {
        $ordenes = fetchOneAssoc($mysqli, "
            SELECT COUNT(*) AS total,
                SUM(CASE WHEN ea.codigo = 'OA_ALIST_PENDIENTE_ASIGNAR' THEN 1 ELSE 0 END) AS pendientesAsignacion,
                SUM(CASE WHEN ea.codigo = 'OA_ALIST_ASIGNADA' THEN 1 ELSE 0 END) AS asignadas,
                SUM(CASE WHEN ea.codigo = 'OA_ALIST_EN_PROCESO' THEN 1 ELSE 0 END) AS enAlistamiento,
                SUM(CASE WHEN ea.codigo = 'OA_ALIST_PARCIAL' THEN 1 ELSE 0 END) AS conPendientes,
                SUM(CASE WHEN ea.codigo = 'OA_ALIST_FINALIZADA' THEN 1 ELSE 0 END) AS completas,
                SUM(CASE WHEN el.codigo = 'OA_LOG_EN_LOGISTICA' THEN 1 ELSE 0 END) AS enLogistica
            FROM InventarioOrdenesAlistamiento o
            INNER JOIN Estados ea ON ea.id = o.idEstadoAlistamiento
            INNER JOIN Estados el ON el.id = o.idEstadoLogistica
        ");
        foreach ($inventario["ordenesAlistamiento"] as $key => $value) {
            $inventario["ordenesAlistamiento"][$key] = numInt($ordenes[$key] ?? 0);
        }
    }

    jexit(200, [
        "ok" => true,
        "filtros" => [
            "fechaInicio" => $fechaInicio !== "" ? $fechaInicio : null,
            "fechaFin" => $fechaFin !== "" ? $fechaFin : null,
            "compacto" => $modoCompacto,
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
        "inventario" => $inventario,
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
