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

function rutaAgrupadaCoincideConRutaExcel($rutaAgrupada, $nombreRutaExcel) {
    $rutaExcelNorm = normalizarTexto($nombreRutaExcel);
    if ($rutaExcelNorm === '') return false;

    $codigo = normalizarTexto($rutaAgrupada['codigoRutaAgrupada'] ?? '');
    $nombre = normalizarTexto($rutaAgrupada['nombreRutaAgrupada'] ?? '');
    $descripcion = normalizarTexto($rutaAgrupada['descripcionRutaAgrupada'] ?? '');

    foreach ([$codigo, $nombre, $descripcion] as $valor) {
        if ($valor === '') continue;
        if (strpos($rutaExcelNorm, $valor) !== false || strpos($valor, $rutaExcelNorm) !== false) {
            return true;
        }
    }

    return false;
}

function resolverRutaAgrupadaParaDetalle($row, $mapCodigoColegio, $mapNombreColegio) {
    $codigoColegio = trim((string)($row['colegioCodigo'] ?? ''));
    $nombreColegio = trim((string)($row['colegioNombre'] ?? ''));
    $nombreRutaExcel = trim((string)($row['nombreRutaExcel'] ?? ''));

    $codigoNorm = normalizarTexto($codigoColegio);
    $nombreNorm = normalizarTexto($nombreColegio);

    /*
     * Regla principal Roldanillo:
     * El cruce correcto debe hacerse por código CG del colegio.
     * Ese código viene de ColegiosDespacho.codigo y debe existir en
     * RutasAgrupadasColegios.codigoColegio.
     */
    if ($codigoNorm !== '' && isset($mapCodigoColegio[$codigoNorm])) {
        return $mapCodigoColegio[$codigoNorm];
    }

    /*
     * Respaldo por nombre:
     * Solo se acepta automático si el nombre del colegio existe una sola vez
     * en RutasAgrupadasColegios.
     */
    if ($nombreNorm !== '' && isset($mapNombreColegio[$nombreNorm])) {
        $candidatos = $mapNombreColegio[$nombreNorm];

        if (count($candidatos) === 1) {
            return $candidatos[0];
        }

        /*
         * Si hay varias sedes con el mismo nombre, se intenta desambiguar
         * usando la ruta/lista original del Excel guardada en RutasDespacho.
         */
        foreach ($candidatos as $candidato) {
            if (rutaAgrupadaCoincideConRutaExcel($candidato, $nombreRutaExcel)) {
                return $candidato;
            }
        }

        /*
         * Importante:
         * No retornamos el primer candidato porque puede mandar cantidades
         * a una ruta agrupada incorrecta. Mejor enviarlo al debug para revisión.
         */
        return null;
    }

    return null;
}

try {
    if ($_SERVER["REQUEST_METHOD"] !== "GET") {
        jexit(405, [
            "ok" => false,
            "mensaje" => "Método no permitido."
        ]);
    }

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
    // 1) DESPACHO ROLDANILLO
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
            COALESCE(di.tipoDespacho, 'CLASICO') AS tipoDespacho,
            di.idEstado,
            di.created_at,
            di.updated_at
        FROM DespachosInforme di
        WHERE di.id = :idDespacho
          AND COALESCE(di.tipoDespacho, 'CLASICO') = 'ROLDANILLO'
        LIMIT 1
    ";
    $stmtDespacho = $pdo->prepare($sqlDespacho);
    $stmtDespacho->execute([':idDespacho' => $idDespacho]);
    $despacho = $stmtDespacho->fetch();

    if (!$despacho) {
        jexit(404, [
            "ok" => false,
            "mensaje" => "No se encontró el despacho solicitado o no corresponde a ROLDANILLO."
        ]);
    }

    // =========================
    // 2) ESTRUCTURA BASE DE RUTAS AGRUPADAS Y MAPAS DE COLEGIOS
    // =========================
    $sqlRutasBase = "
        SELECT
            ra.id AS idRutaAgrupada,
            ra.codigo AS codigoRutaAgrupada,
            ra.nombre AS nombreRutaAgrupada,
            COALESCE(ra.descripcion, '') AS descripcionRutaAgrupada
        FROM RutasAgrupadas ra
        WHERE ra.estado = 1
        ORDER BY ra.nombre ASC
    ";
    $rutasBaseRows = $pdo->query($sqlRutasBase)->fetchAll();

    $rutas = [];
    foreach ($rutasBaseRows as $row) {
        $rutaKey = 'RUTA_' . (int)$row['idRutaAgrupada'];
        $rutas[$rutaKey] = inicializarRuta($row);
    }

    $sqlColegiosAgrupados = "
        SELECT
            rac.id AS idRutaAgrupadaColegio,
            rac.idRutaAgrupada,
            rac.codigoColegio,
            rac.nombreColegio,
            COALESCE(rac.direccion, '') AS direccionColegio,
            ra.codigo AS codigoRutaAgrupada,
            ra.nombre AS nombreRutaAgrupada,
            COALESCE(ra.descripcion, '') AS descripcionRutaAgrupada
        FROM RutasAgrupadasColegios rac
        INNER JOIN RutasAgrupadas ra
            ON ra.id = rac.idRutaAgrupada
           AND ra.estado = 1
        WHERE rac.estado = 1
    ";
    $colegiosAgrupadosRows = $pdo->query($sqlColegiosAgrupados)->fetchAll();

    $mapCodigoColegio = [];
    $mapNombreColegio = [];

    foreach ($colegiosAgrupadosRows as $row) {
        $item = [
            "idRutaAgrupada" => (int)$row["idRutaAgrupada"],
            "codigoRutaAgrupada" => (string)$row["codigoRutaAgrupada"],
            "nombreRutaAgrupada" => (string)$row["nombreRutaAgrupada"],
            "descripcionRutaAgrupada" => (string)$row["descripcionRutaAgrupada"],
            "codigoColegio" => (string)$row["codigoColegio"],
            "nombreColegio" => (string)$row["nombreColegio"],
            "direccionColegio" => (string)$row["direccionColegio"]
        ];

        $codigoNorm = normalizarTexto($row['codigoColegio'] ?? '');
        $nombreNorm = normalizarTexto($row['nombreColegio'] ?? '');

        if ($codigoNorm !== '') {
            $mapCodigoColegio[$codigoNorm] = $item;
        }

        if ($nombreNorm !== '') {
            if (!isset($mapNombreColegio[$nombreNorm])) {
                $mapNombreColegio[$nombreNorm] = [];
            }
            $mapNombreColegio[$nombreNorm][] = $item;
        }
    }

    // =========================
    // 3) MOVIMIENTOS REALES DEL DESPACHO
    //    Compatible con múltiples archivos por AM, PM y JORNADA_UNICA.
    //    Se consolida todo por idDespacho, sin depender de un solo archivo por jornada.
    // =========================
    $sqlDetalle = "
        SELECT
            d.id AS idDetalle,
            d.idDespacho,
            d.idDespachoArchivo,
            d.idRuta,
            d.idColegio,
            d.idProducto,
            COALESCE(d.cantidad, 0) AS cantidad,
            COALESCE(d.productoExcel, '') AS productoExcel,
            COALESCE(d.unidadCoberturaExcel, '') AS unidadCoberturaExcel,
            COALESCE(d.descripcionMostrada, '') AS descripcionMostrada,
            d.consecutivo,

            da.tipoArchivo,
            da.nombreArchivo,

            r.nombreRuta AS nombreRutaExcel,
            r.idJornada,
            r.ordenRuta,

            c.codigo AS colegioCodigo,
            c.nombre AS colegioNombre,

            p.codigo AS codigoProducto,
            COALESCE(p.descripcion, '') AS descripcionProductoCatalogo,

            gp.idCategoria,

            COALESCE(e.`uni/caja`, '0') AS uniCajaRaw

        FROM DetalleRutaProducto d
        INNER JOIN DespachoArchivos da
            ON da.id = d.idDespachoArchivo
           AND da.idDespacho = d.idDespacho
        LEFT JOIN RutasDespacho r
            ON r.id = d.idRuta
        LEFT JOIN ColegiosDespacho c
            ON c.id = d.idColegio
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
            CASE da.tipoArchivo
                WHEN 'AM' THEN 1
                WHEN 'PM' THEN 2
                WHEN 'JORNADA_UNICA' THEN 3
                ELSE 99
            END,
            da.id ASC,
            COALESCE(r.nombreRuta, '') ASC,
            COALESCE(c.nombre, '') ASC,
            COALESCE(p.descripcion, d.productoExcel, '') ASC
    ";

    $stmtDetalle = $pdo->prepare($sqlDetalle);
    $stmtDetalle->execute([
        ':idDespacho' => $idDespacho,
        ':idCategoria' => $idCategoria
    ]);
    $detalleRows = $stmtDetalle->fetchAll();

    $detallesSinRutaAgrupada = [];

    // =========================
    // 4) CONSOLIDAR POR RUTA + PRODUCTO
    //    Y POR RUTA + COLEGIO + PRODUCTO
    // =========================
    foreach ($detalleRows as $row) {
        $rutaAgrupada = resolverRutaAgrupadaParaDetalle($row, $mapCodigoColegio, $mapNombreColegio);

        if (!$rutaAgrupada) {
            $detallesSinRutaAgrupada[] = [
                "idDetalle" => (int)$row["idDetalle"],
                "archivo" => $row["nombreArchivo"],
                "tipoArchivo" => $row["tipoArchivo"],
                "nombreRutaExcel" => $row["nombreRutaExcel"],
                "codigoColegio" => $row["colegioCodigo"],
                "nombreColegio" => $row["colegioNombre"],
                "producto" => $row["descripcionProductoCatalogo"] ?: $row["productoExcel"]
            ];
            continue;
        }

        $rutaKey = 'RUTA_' . (int)$rutaAgrupada['idRutaAgrupada'];

        if (!isset($rutas[$rutaKey])) {
            $rutas[$rutaKey] = inicializarRuta($rutaAgrupada);
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

        $codigoColegio = trim((string)($rutaAgrupada['codigoColegio'] ?: $row['colegioCodigo']));
        $nombreColegio = trim((string)($rutaAgrupada['nombreColegio'] ?: $row['colegioNombre']));

        $colegioKey = $codigoColegio !== ''
            ? 'COL_' . normalizarTexto($codigoColegio)
            : 'COL_' . normalizarTexto($nombreColegio);

        $productoKey = ($idProducto > 0)
            ? 'PROD_' . $idProducto
            : normalizarTexto($producto . '||' . $unidad);

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

        if ((int)$rutas[$rutaKey]["productos"][$productoKey]["uniCaja"] <= 0 && $uniCaja > 0) {
            $rutas[$rutaKey]["productos"][$productoKey]["uniCaja"] = $uniCaja;
        }

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

        if ((int)$rutas[$rutaKey]["colegios"][$colegioKey]["productos"][$productoKey]["uniCaja"] <= 0 && $uniCaja > 0) {
            $rutas[$rutaKey]["colegios"][$colegioKey]["productos"][$productoKey]["uniCaja"] = $uniCaja;
        }
    }

    // =========================
    // 5) LIMPIAR RUTAS VACÍAS Y RECALCULAR PAC / UND
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
        "mensaje" => "Informe consolidado Roldanillo generado correctamente.",
        "despacho" => [
            "id" => (int)$despacho["id"],
            "codigo" => $despacho["codigo"],
            "fechaDespacho" => $despacho["fechaDespacho"],
            "fechaConsumoDesde" => $despacho["fechaConsumoDesde"],
            "fechaConsumoHasta" => $despacho["fechaConsumoHasta"],
            "contrato" => $despacho["contrato"],
            "tipoPeriodo" => $despacho["tipoPeriodo"],
            "descripcion" => $despacho["descripcion"],
            "tipoDespacho" => $despacho["tipoDespacho"],
            "idEstado" => isset($despacho["idEstado"]) ? (int)$despacho["idEstado"] : null,
            "created_at" => $despacho["created_at"] ?? null,
            "updated_at" => $despacho["updated_at"] ?? null
        ],
        "filtro" => [
            "idCategoria" => $idCategoria
        ],
        "rutas" => array_values($rutasFiltradas),
        "resumen" => $resumenGeneral,
        "debug" => [
            "totalDetallesLeidos" => count($detalleRows),
            "totalDetallesSinRutaAgrupada" => count($detallesSinRutaAgrupada),
            "detallesSinRutaAgrupada" => $detallesSinRutaAgrupada
        ]
    ]);

} catch (Throwable $e) {
    jexit(500, [
        "ok" => false,
        "mensaje" => "Error interno al generar el informe consolidado Roldanillo.",
        "error" => $e->getMessage(),
        "linea" => $e->getLine(),
        "archivo" => $e->getFile()
    ]);
}
