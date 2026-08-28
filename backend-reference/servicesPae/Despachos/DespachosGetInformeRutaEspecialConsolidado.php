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
header("Access-Control-Allow-Headers: Content-Type, Cache-Control, Pragma, Expires");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

function jexit($code, $arr) {
    http_response_code($code);
    echo json_encode($arr, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

function normalizarTexto($texto) {
    $texto = trim((string)$texto);
    if ($texto === '') return '';

    $texto = mb_strtoupper($texto, 'UTF-8');
    $reemplazos = [
        'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U',
        'À' => 'A', 'È' => 'E', 'Ì' => 'I', 'Ò' => 'O', 'Ù' => 'U',
        'Ä' => 'A', 'Ë' => 'E', 'Ï' => 'I', 'Ö' => 'O', 'Ü' => 'U',
        'Ñ' => 'N'
    ];
    $texto = strtr($texto, $reemplazos);
    $texto = preg_replace('/\s+/', ' ', $texto);
    return trim($texto);
}

function safeFloat($value) {
    if ($value === null || $value === '') return 0.0;
    return (float)$value;
}

function parseUniCaja($raw) {
    $raw = trim((string)$raw);
    if ($raw === '') return 0;

    if (preg_match('/(\d+)/', $raw, $m)) {
        return (int)$m[1];
    }

    return 0;
}

function inicializarRuta($ruta) {
    return [
        "idRutaAgrupada" => (int)$ruta["idRutaAgrupada"],
        "codigoRutaAgrupada" => (string)$ruta["codigoRutaAgrupada"],
        "nombreRutaAgrupada" => (string)$ruta["nombreRutaAgrupada"],
        "descripcionRutaAgrupada" => (string)$ruta["descripcionRutaAgrupada"],
        "colegios" => [],
        "productos" => [],
        "resumen" => [
            "totalColegios" => 0,
            "totalProductos" => 0,
            "totalCantidad" => 0,
            "totalPac" => 0,
            "totalUnd" => 0
        ]
    ];
}

try {
    $idDespacho = isset($_GET['idDespacho']) ? (int)$_GET['idDespacho'] : 0;
    $idCategoria = isset($_GET['idCategoria']) ? (int)$_GET['idCategoria'] : 21;

    if ($idDespacho <= 0) {
        jexit(400, [
            "ok" => false,
            "mensaje" => "Debes enviar un idDespacho válido."
        ]);
    }

    $host = "localhost";
    $db   = "accionpo_pae";
    $user = "accionpo_pae";
    $pass = "o#Ao0?ZEEec0s).i";

    $dsn = "mysql:host={$host};dbname={$db};charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    // =========================
    // 1) DESPACHO
    // =========================
    $sqlDespacho = "
        SELECT
            di.id,
            di.codigo,
            di.fechaDespacho,
            di.fechaConsumoDesde,
            di.fechaConsumoHasta,
            di.contrato,
            di.tipoPeriodo,
            di.descripcion,
            di.idEstado,
            di.created_at,
            di.updated_at
        FROM DespachosInforme di
        WHERE di.id = :idDespacho
        LIMIT 1
    ";
    $stmtDespacho = $pdo->prepare($sqlDespacho);
    $stmtDespacho->execute([':idDespacho' => $idDespacho]);
    $despacho = $stmtDespacho->fetch();

    if (!$despacho) {
        jexit(404, [
            "ok" => false,
            "mensaje" => "No se encontró el despacho solicitado."
        ]);
    }

    // =========================
    // 2) ESTRUCTURA BASE SOLO DE RUTAS
    // =========================
    $sqlRutasBase = "
        SELECT
            ra.id AS idRutaAgrupada,
            ra.codigo AS codigoRutaAgrupada,
            ra.nombre AS nombreRutaAgrupada,
            COALESCE(ra.descripcion, '') AS descripcionRutaAgrupada
        FROM RutasAgrupadas ra
        WHERE ra.estado = 1
        ORDER BY
            ra.nombre ASC
    ";
    $stmtRutasBase = $pdo->query($sqlRutasBase);
    $rutasBaseRows = $stmtRutasBase->fetchAll();

    $rutas = [];
    foreach ($rutasBaseRows as $row) {
        $rutaKey = 'RUTA_' . (int)$row['idRutaAgrupada'];
        if (!isset($rutas[$rutaKey])) {
            $rutas[$rutaKey] = inicializarRuta($row);
        }
    }

    // =========================
    // 3) MOVIMIENTOS REALES DEL DESPACHO
    // =========================
    $sqlDetalle = "
        SELECT
            rac.codigoColegio,
            COALESCE(rac.nombreColegio, '') AS nombreColegio,

            ra.id AS idRutaAgrupada,
            ra.codigo AS codigoRutaAgrupada,
            ra.nombre AS nombreRutaAgrupada,
            COALESCE(ra.descripcion, '') AS descripcionRutaAgrupada,

            d.idProducto,
            COALESCE(d.cantidad, 0) AS cantidad,
            COALESCE(d.productoExcel, '') AS productoExcel,
            COALESCE(d.unidadCoberturaExcel, '') AS unidadCoberturaExcel,
            COALESCE(d.descripcionMostrada, '') AS descripcionMostrada,

            p.codigo AS codigoProducto,
            COALESCE(p.descripcion, '') AS descripcionProductoCatalogo,

            gp.idCategoria,

            COALESCE(e.`uni/caja`, '0') AS uniCajaRaw

        FROM DetalleRutaProducto d
        INNER JOIN RutasDespacho r
            ON r.id = d.idRuta
        LEFT JOIN ColegiosDespacho c
            ON c.id = d.idColegio
        LEFT JOIN SedesDespacho s
            ON s.id = d.idSede
        INNER JOIN RutasAgrupadasColegios rac
            ON rac.codigoColegio = COALESCE(NULLIF(TRIM(c.codigo), ''), NULLIF(TRIM(s.codigo), ''))
           AND rac.estado = 1
        INNER JOIN RutasAgrupadas ra
            ON ra.id = rac.idRutaAgrupada
           AND ra.estado = 1
        INNER JOIN ProductosCatalogo p
            ON p.id = d.idProducto
           AND p.estado = 1
        INNER JOIN GruposProducto gp
            ON gp.id = p.idGrupo
           AND gp.idCategoria = :idCategoria
           AND gp.estado = 1
        LEFT JOIN EmbalajeCatalogo e
            ON e.id = p.idEmbalaje
           AND e.estado = 1
        WHERE d.idDespacho = :idDespacho
        ORDER BY
            ra.nombre ASC,
            rac.nombreColegio ASC,
            p.descripcion ASC
    ";

    $stmtDetalle = $pdo->prepare($sqlDetalle);
    $stmtDetalle->execute([
        ':idDespacho' => $idDespacho,
        ':idCategoria' => $idCategoria
    ]);
    $detalleRows = $stmtDetalle->fetchAll();

    // =========================
    // 4) CONSOLIDAR POR RUTA + PRODUCTO
    //    Y POR RUTA + COLEGIO + PRODUCTO
    // =========================
    foreach ($detalleRows as $row) {
        $rutaKey = 'RUTA_' . (int)$row['idRutaAgrupada'];

        if (!isset($rutas[$rutaKey])) {
            $rutas[$rutaKey] = inicializarRuta($row);
        }

        $idProducto = (int)$row['idProducto'];

        $producto = trim((string)$row['descripcionMostrada']);
        if ($producto === '') $producto = trim((string)$row['descripcionProductoCatalogo']);
        if ($producto === '') $producto = trim((string)$row['productoExcel']);
        if ($producto === '') $producto = 'PRODUCTO #' . $idProducto;

        $unidad = trim((string)$row['unidadCoberturaExcel']);
        $codigoProducto = trim((string)$row['codigoProducto']);
        $cantidad = safeFloat($row['cantidad']);
        $uniCaja = parseUniCaja($row['uniCajaRaw']);

        $codigoColegio = trim((string)$row['codigoColegio']);
        $nombreColegio = trim((string)$row['nombreColegio']);

        $colegioKey = $codigoColegio !== ''
            ? 'COL_' . normalizarTexto($codigoColegio)
            : 'COL_' . normalizarTexto($nombreColegio);

        $productoKey = ($idProducto > 0)
            ? 'PROD_' . $idProducto
            : normalizarTexto($producto . '||' . $unidad);

        // =========================
        // 4.1) CONSOLIDADO POR RUTA + PRODUCTO
        // =========================
        if (!isset($rutas[$rutaKey]["productos"][$productoKey])) {
            $rutas[$rutaKey]["productos"][$productoKey] = [
                "idProducto" => $idProducto,
                "codigoProducto" => $codigoProducto,
                "producto" => $producto,
                "unidad" => $unidad,
                "idCategoria" => (int)$row['idCategoria'],
                "uniCaja" => $uniCaja,
                "cantidad" => 0,
                "pac" => 0,
                "und" => 0
            ];
        }

        $rutas[$rutaKey]["productos"][$productoKey]["cantidad"] += $cantidad;

        if (
            (int)$rutas[$rutaKey]["productos"][$productoKey]["uniCaja"] <= 0
            && $uniCaja > 0
        ) {
            $rutas[$rutaKey]["productos"][$productoKey]["uniCaja"] = $uniCaja;
        }

        // =========================
        // 4.2) CONSOLIDADO POR COLEGIO + PRODUCTO
        // =========================
        if (!isset($rutas[$rutaKey]["colegios"][$colegioKey])) {
            $rutas[$rutaKey]["colegios"][$colegioKey] = [
                "codigoColegio" => $codigoColegio,
                "nombreColegio" => $nombreColegio,
                "productos" => [],
                "resumen" => [
                    "totalProductos" => 0,
                    "totalCantidad" => 0,
                    "totalPac" => 0,
                    "totalUnd" => 0
                ]
            ];
        }

        if (!isset($rutas[$rutaKey]["colegios"][$colegioKey]["productos"][$productoKey])) {
            $rutas[$rutaKey]["colegios"][$colegioKey]["productos"][$productoKey] = [
                "idProducto" => $idProducto,
                "codigoProducto" => $codigoProducto,
                "producto" => $producto,
                "unidad" => $unidad,
                "idCategoria" => (int)$row['idCategoria'],
                "uniCaja" => $uniCaja,
                "cantidad" => 0,
                "pac" => 0,
                "und" => 0
            ];
        }

        $rutas[$rutaKey]["colegios"][$colegioKey]["productos"][$productoKey]["cantidad"] += $cantidad;

        if (
            (int)$rutas[$rutaKey]["colegios"][$colegioKey]["productos"][$productoKey]["uniCaja"] <= 0
            && $uniCaja > 0
        ) {
            $rutas[$rutaKey]["colegios"][$colegioKey]["productos"][$productoKey]["uniCaja"] = $uniCaja;
        }
    }

    // =========================
    // 5) LIMPIAR RUTAS VACÍAS Y RECALCULAR
    // =========================
    $resumenGeneral = [
        "totalRutas" => 0,
        "totalProductos" => 0,
        "totalCantidad" => 0,
        "totalPac" => 0,
        "totalUnd" => 0
    ];

    $rutasFiltradas = [];

    foreach ($rutas as $rutaKey => $ruta) {
        $ruta["resumen"] = [
            "totalColegios" => 0,
            "totalProductos" => 0,
            "totalCantidad" => 0,
            "totalPac" => 0,
            "totalUnd" => 0
        ];

        // =========================
        // 5.1) RECALCULAR PRODUCTOS DE LA RUTA
        // =========================
        foreach ($ruta["productos"] as $productoKey => $producto) {
            $cantidadTotal = safeFloat($producto["cantidad"]);

            if ($cantidadTotal <= 0) {
                unset($ruta["productos"][$productoKey]);
                continue;
            }

            $cantidadEntera = (int)round($cantidadTotal);
            $uniCaja = (int)$producto["uniCaja"];

            if ($uniCaja > 0) {
                $producto["pac"] = intdiv($cantidadEntera, $uniCaja);
                $producto["und"] = $cantidadEntera % $uniCaja;
            } else {
                $producto["pac"] = 0;
                $producto["und"] = $cantidadEntera;
            }

            $ruta["productos"][$productoKey] = $producto;

            $ruta["resumen"]["totalProductos"]++;
            $ruta["resumen"]["totalCantidad"] += $cantidadTotal;
            $ruta["resumen"]["totalPac"] += (int)$producto["pac"];
            $ruta["resumen"]["totalUnd"] += (int)$producto["und"];
        }

        // =========================
        // 5.2) RECALCULAR COLEGIOS
        // =========================
        foreach ($ruta["colegios"] as $colegioKey => $colegio) {
            $colegio["resumen"] = [
                "totalProductos" => 0,
                "totalCantidad" => 0,
                "totalPac" => 0,
                "totalUnd" => 0
            ];

            foreach ($colegio["productos"] as $productoKey => $producto) {
                $cantidadTotal = safeFloat($producto["cantidad"]);

                if ($cantidadTotal <= 0) {
                    unset($colegio["productos"][$productoKey]);
                    continue;
                }

                $cantidadEntera = (int)round($cantidadTotal);
                $uniCaja = (int)$producto["uniCaja"];

                if ($uniCaja > 0) {
                    $producto["pac"] = intdiv($cantidadEntera, $uniCaja);
                    $producto["und"] = $cantidadEntera % $uniCaja;
                } else {
                    $producto["pac"] = 0;
                    $producto["und"] = $cantidadEntera;
                }

                $colegio["productos"][$productoKey] = $producto;

                $colegio["resumen"]["totalProductos"]++;
                $colegio["resumen"]["totalCantidad"] += $cantidadTotal;
                $colegio["resumen"]["totalPac"] += (int)$producto["pac"];
                $colegio["resumen"]["totalUnd"] += (int)$producto["und"];
            }

            if (empty($colegio["productos"])) {
                unset($ruta["colegios"][$colegioKey]);
                continue;
            }

            $colegio["productos"] = array_values($colegio["productos"]);
            usort($colegio["productos"], function ($a, $b) {
                return strcasecmp($a["producto"], $b["producto"]);
            });

            $ruta["colegios"][$colegioKey] = $colegio;
        }

        if (empty($ruta["productos"])) {
            continue;
        }

        $ruta["productos"] = array_values($ruta["productos"]);
        usort($ruta["productos"], function ($a, $b) {
            return strcasecmp($a["producto"], $b["producto"]);
        });

        $ruta["colegios"] = array_values($ruta["colegios"]);
        usort($ruta["colegios"], function ($a, $b) {
            return strcasecmp($a["nombreColegio"], $b["nombreColegio"]);
        });

        $ruta["resumen"]["totalColegios"] = count($ruta["colegios"]);

        $rutasFiltradas[$rutaKey] = $ruta;

        $resumenGeneral["totalRutas"]++;
        $resumenGeneral["totalProductos"] += (int)$ruta["resumen"]["totalProductos"];
        $resumenGeneral["totalCantidad"] += (float)$ruta["resumen"]["totalCantidad"];
        $resumenGeneral["totalPac"] += (int)$ruta["resumen"]["totalPac"];
        $resumenGeneral["totalUnd"] += (int)$ruta["resumen"]["totalUnd"];
    }

    uasort($rutasFiltradas, function ($a, $b) {
        return strcasecmp($a["nombreRutaAgrupada"], $b["nombreRutaAgrupada"]);
    });

    jexit(200, [
        "ok" => true,
        "mensaje" => "Informe consolidado por rutas especiales generado correctamente.",
        "despacho" => [
            "id" => (int)$despacho["id"],
            "codigo" => $despacho["codigo"],
            "fechaDespacho" => $despacho["fechaDespacho"],
            "fechaConsumoDesde" => $despacho["fechaConsumoDesde"] ?? null,
            "fechaConsumoHasta" => $despacho["fechaConsumoHasta"] ?? null,
            "contrato" => $despacho["contrato"] ?? null,
            "tipoPeriodo" => $despacho["tipoPeriodo"] ?? null,
            "descripcion" => $despacho["descripcion"],
            "idEstado" => isset($despacho["idEstado"]) ? (int)$despacho["idEstado"] : null,
            "created_at" => $despacho["created_at"] ?? null,
            "updated_at" => $despacho["updated_at"] ?? null
        ],
        "filtro" => [
            "idCategoria" => $idCategoria
        ],
        "rutas" => array_values($rutasFiltradas),
        "resumen" => $resumenGeneral
    ]);

} catch (Throwable $e) {
    jexit(500, [
        "ok" => false,
        "mensaje" => "Error interno al generar el informe consolidado por rutas especiales.",
        "error" => $e->getMessage(),
        "linea" => $e->getLine(),
        "archivo" => $e->getFile()
    ]);
}
