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
    echo json_encode($arr, JSON_UNESCAPED_UNICODE);
    exit;
}

function normalizarTexto($texto) {
    $texto = trim((string)$texto);
    $texto = preg_replace('/\s+/', ' ', $texto);
    $texto = mb_strtoupper($texto, "UTF-8");
    $texto = str_replace(
        ["Á", "É", "Í", "Ó", "Ú", "Ñ", "À", "È", "Ì", "Ò", "Ù", "Ä", "Ë", "Ï", "Ö", "Ü"],
        ["A", "E", "I", "O", "U", "N", "A", "E", "I", "O", "U", "A", "E", "I", "O", "U"],
        $texto
    );
    return $texto;
}

function aNumero($valor) {
    if ($valor === null || $valor === '') {
        return 0;
    }

    if (is_numeric($valor)) {
        return (float)$valor;
    }

    $valor = str_replace(['.', ','], ['', '.'], (string)$valor);
    return is_numeric($valor) ? (float)$valor : 0;
}

function productoMostrar($row) {
    $candidatos = [
        $row["descripcionMostrada"] ?? "",
        $row["descripcionProducto"] ?? "",
        $row["productoExcel"] ?? "",
        trim(($row["producto_base"] ?? "") . " " . ($row["presentacion"] ?? "")),
    ];

    foreach ($candidatos as $txt) {
        $txt = trim((string)$txt);
        if ($txt !== "") {
            return $txt;
        }
    }

    return "SIN PRODUCTO";
}

function unidadMostrar($row) {
    $candidatos = [
        $row["unidadCoberturaExcel"] ?? "",
        $row["presentacion"] ?? "",
        $row["embalaje"] ?? "",
    ];

    foreach ($candidatos as $txt) {
        $txt = trim((string)$txt);
        if ($txt !== "") {
            return $txt;
        }
    }

    return "";
}

function obtenerOrdenRutaAgrupada($codigoRuta, $nombreRuta, $idRuta) {
    $codigoRuta = trim((string)$codigoRuta);
    $nombreRuta = trim((string)$nombreRuta);

    if ($codigoRuta !== "" && preg_match('/(\d+)/', $codigoRuta, $m)) {
        return (int)$m[1];
    }

    if ($nombreRuta !== "" && preg_match('/(\d+)/', $nombreRuta, $m)) {
        return (int)$m[1];
    }

    if ((int)$idRuta > 0) {
        return (int)$idRuta;
    }

    return 999999;
}

function ordenarRutaNombre($nombre) {
    $normal = normalizarTexto($nombre);

    if (preg_match('/RUTA[\s_\-]*([0-9]+)/i', $normal, $m)) {
        return [0, (int)$m[1], $normal];
    }

    return [1, 999999, $normal];
}

function bindParametrosDinamicos($stmt, $types, $values) {
    if ($types === "" || empty($values)) {
        return true;
    }

    $params = [];
    $params[] = $types;

    foreach ($values as $index => $value) {
        $values[$index] = $value;
        $params[] = &$values[$index];
    }

    return call_user_func_array([$stmt, "bind_param"], $params);
}

/* =========================
 * PARAMETROS
 * ========================= */
$idDespacho  = isset($_GET["idDespacho"]) ? (int)$_GET["idDespacho"] : 0;
$idCategoria = isset($_GET["idCategoria"]) ? (int)$_GET["idCategoria"] : 0;

/*
 * En este servicio Roldanillo idRuta representa RutasAgrupadas.id.
 * Se conserva el nombre del parámetro para no romper el front.
 */
$idRuta      = isset($_GET["idRuta"]) ? (int)$_GET["idRuta"] : 0;
$ruta        = isset($_GET["ruta"]) ? trim((string)$_GET["ruta"]) : "";

if ($idDespacho <= 0) {
    jexit(400, [
        "ok" => false,
        "mensaje" => "El parámetro idDespacho es obligatorio"
    ]);
}

if ($idCategoria <= 0) {
    jexit(400, [
        "ok" => false,
        "mensaje" => "El parámetro idCategoria es obligatorio"
    ]);
}

/* =========================
 * CONEXION
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
        "mensaje" => "No se pudo conectar a la base de datos",
        "error" => $mysqli->connect_error
    ]);
}

$mysqli->set_charset("utf8mb4");

/* =========================
 * INFO DEL DESPACHO
 * ========================= */
$despachoInfo = null;

$sqlDespacho = "
    SELECT
        d.id,
        d.codigo,
        d.fechaDespacho,
        d.tipoPeriodo,
        d.descripcion,
        COALESCE(d.tipoDespacho, 'CLASICO') AS tipoDespacho,
        e.nombre AS estado
    FROM DespachosInforme d
    LEFT JOIN Estados e
        ON e.id = d.idEstado
    WHERE d.id = ?
    LIMIT 1
";

$stmtDespacho = $mysqli->prepare($sqlDespacho);

if (!$stmtDespacho) {
    jexit(500, [
        "ok" => false,
        "mensaje" => "No se pudo preparar la consulta del despacho",
        "error" => $mysqli->error
    ]);
}

$stmtDespacho->bind_param("i", $idDespacho);

if (!$stmtDespacho->execute()) {
    $error = $stmtDespacho->error;
    $stmtDespacho->close();
    $mysqli->close();

    jexit(500, [
        "ok" => false,
        "mensaje" => "No se pudo ejecutar la consulta del despacho",
        "error" => $error
    ]);
}

$stmtDespacho->store_result();
$stmtDespacho->bind_result(
    $despachoId,
    $despachoCodigo,
    $despachoFecha,
    $despachoTipoPeriodo,
    $despachoDescripcion,
    $despachoTipoDespacho,
    $despachoEstado
);

if ($stmtDespacho->fetch()) {
    $despachoInfo = [
        "id" => isset($despachoId) ? (int)$despachoId : null,
        "codigo" => $despachoCodigo ?? "Sin código",
        "fechaDespacho" => $despachoFecha ?? "-",
        "tipoPeriodo" => $despachoTipoPeriodo ?? "-",
        "descripcion" => $despachoDescripcion ?? "Sin descripción",
        "tipoDespacho" => $despachoTipoDespacho ?? "CLASICO",
        "estado" => $despachoEstado ?? "-"
    ];
}
$stmtDespacho->close();

if (!$despachoInfo) {
    $mysqli->close();
    jexit(404, [
        "ok" => false,
        "mensaje" => "El despacho no existe"
    ]);
}

/* =========================
 * INFO DE LA CATEGORIA
 * ========================= */
$categoriaInfo = null;

$sqlCategoria = "
    SELECT
        cp.id,
        cp.nombre
    FROM CategoriasProducto cp
    WHERE cp.id = ?
    LIMIT 1
";

$stmtCategoria = $mysqli->prepare($sqlCategoria);

if (!$stmtCategoria) {
    $mysqli->close();
    jexit(500, [
        "ok" => false,
        "mensaje" => "No se pudo preparar la consulta de la categoría",
        "error" => $mysqli->error
    ]);
}

$stmtCategoria->bind_param("i", $idCategoria);

if (!$stmtCategoria->execute()) {
    $error = $stmtCategoria->error;
    $stmtCategoria->close();
    $mysqli->close();

    jexit(500, [
        "ok" => false,
        "mensaje" => "No se pudo ejecutar la consulta de la categoría",
        "error" => $error
    ]);
}

$stmtCategoria->store_result();
$stmtCategoria->bind_result(
    $categoriaIdRow,
    $categoriaNombreRow
);

if ($stmtCategoria->fetch()) {
    $categoriaInfo = [
        "id" => isset($categoriaIdRow) ? (int)$categoriaIdRow : null,
        "nombre" => $categoriaNombreRow ?? "Sin categoría"
    ];
}
$stmtCategoria->close();

if (!$categoriaInfo) {
    $mysqli->close();
    jexit(404, [
        "ok" => false,
        "mensaje" => "La categoría no existe"
    ]);
}

/* =========================
 * CONSULTA PRINCIPAL ROLDANILLO
 *
 * REGLA:
 * - FILTRAR POR DESPACHO + CATEGORIA
 * - CONSOLIDAR POR RUTA AGRUPADA + COLEGIO + PRODUCTO
 * - SUMAR AM + PM + JORNADA_UNICA DEL MISMO DESPACHO
 * - RUTA SALE DE RutasAgrupadas
 * - COLEGIO SALE DE RutasAgrupadasColegios
 *
 * RELACION:
 * DetalleRutaProducto.idColegio
 *   -> ColegiosDespacho.id
 *   -> ColegiosDespacho.codigo
 *   -> RutasAgrupadasColegios.codigoColegio
 *   -> RutasAgrupadas.id
 * ========================= */
$sql = "
    SELECT
        ra.id AS idRutaAgrupada,
        ra.codigo AS codigoRutaAgrupada,
        ra.nombre AS nombreRutaAgrupada,
        COALESCE(ra.descripcion, '') AS descripcionRutaAgrupada,

        rac.codigoColegio,
        COALESCE(NULLIF(TRIM(rac.nombreColegio), ''), COALESCE(c.nombre, 'SIN COLEGIO')) AS nombreColegio,
        COALESCE(rac.direccion, '') AS direccionColegio,

        p.id AS idProducto,
        COALESCE(NULLIF(TRIM(p.codigo), ''), '') AS codigoProducto,

        d.productoExcel,
        d.descripcionMostrada,
        d.unidadCoberturaExcel,
        p.descripcion AS descripcionProducto,

        e.producto_base,
        e.presentacion,
        e.embalaje,
        e.`uni/caja` AS uniCaja,

        SUM(COALESCE(d.cantidad, 0)) AS cantidadTotal

    FROM DetalleRutaProducto d

    INNER JOIN ColegiosDespacho c
        ON c.id = d.idColegio

    INNER JOIN RutasAgrupadasColegios rac
        ON NULLIF(TRIM(c.codigo), '') IS NOT NULL
       AND TRIM(rac.codigoColegio) COLLATE utf8mb4_unicode_ci
         = TRIM(c.codigo) COLLATE utf8mb4_unicode_ci
       AND rac.estado = 1

    INNER JOIN RutasAgrupadas ra
        ON ra.id = rac.idRutaAgrupada
       AND ra.estado = 1

    INNER JOIN ProductosCatalogo p
        ON p.id = d.idProducto

    INNER JOIN GruposProducto gp
        ON gp.id = p.idGrupo

    INNER JOIN CategoriasProducto cp
        ON cp.id = gp.idCategoria

    LEFT JOIN EmbalajeCatalogo e
        ON e.id = p.idEmbalaje

    WHERE d.idDespacho = ?
      AND cp.id = ?
";

$paramTypes = "ii";
$paramValues = [$idDespacho, $idCategoria];

if ($idRuta > 0) {
    $sql .= " AND ra.id = ? ";
    $paramTypes .= "i";
    $paramValues[] = $idRuta;
}

if ($ruta !== "") {
    $rutaNorm = normalizarTexto($ruta);

    $sql .= "
      AND (
          UPPER(TRIM(ra.nombre)) COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
          OR UPPER(TRIM(ra.codigo)) COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
          OR UPPER(TRIM(COALESCE(ra.descripcion, ''))) COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
      )
    ";

    $paramTypes .= "sss";
    $paramValues[] = $rutaNorm;
    $paramValues[] = $rutaNorm;
    $paramValues[] = $rutaNorm;
}

$sql .= "
    GROUP BY
        ra.id,
        ra.codigo,
        ra.nombre,
        ra.descripcion,

        rac.codigoColegio,
        COALESCE(NULLIF(TRIM(rac.nombreColegio), ''), COALESCE(c.nombre, 'SIN COLEGIO')),
        rac.direccion,

        p.id,
        p.codigo,
        d.productoExcel,
        d.descripcionMostrada,
        d.unidadCoberturaExcel,
        p.descripcion,
        e.producto_base,
        e.presentacion,
        e.embalaje,
        e.`uni/caja`

    ORDER BY
        ra.codigo ASC,
        ra.nombre ASC,
        COALESCE(NULLIF(TRIM(rac.nombreColegio), ''), COALESCE(c.nombre, 'SIN COLEGIO')) ASC,
        p.descripcion ASC
";

$stmt = $mysqli->prepare($sql);

if (!$stmt) {
    $error = $mysqli->error;
    $mysqli->close();

    jexit(500, [
        "ok" => false,
        "mensaje" => "No se pudo preparar la consulta principal",
        "error" => $error
    ]);
}

if (!bindParametrosDinamicos($stmt, $paramTypes, $paramValues)) {
    $error = $stmt->error;
    $stmt->close();
    $mysqli->close();

    jexit(500, [
        "ok" => false,
        "mensaje" => "No se pudieron asociar los parámetros de la consulta principal",
        "error" => $error
    ]);
}

if (!$stmt->execute()) {
    $error = $stmt->error;
    $stmt->close();
    $mysqli->close();

    jexit(500, [
        "ok" => false,
        "mensaje" => "No se pudo ejecutar la consulta principal",
        "error" => $error
    ]);
}

$stmt->store_result();
$stmt->bind_result(
    $rowIdRutaAgrupada,
    $rowCodigoRutaAgrupada,
    $rowNombreRutaAgrupada,
    $rowDescripcionRutaAgrupada,
    $rowCodigoColegio,
    $rowNombreColegio,
    $rowDireccionColegio,
    $rowIdProducto,
    $rowCodigoProducto,
    $rowProductoExcel,
    $rowDescripcionMostrada,
    $rowUnidadCoberturaExcel,
    $rowDescripcionProducto,
    $rowProductoBase,
    $rowPresentacion,
    $rowEmbalaje,
    $rowUniCaja,
    $rowCantidadTotal
);

/* =========================
 * CONSOLIDADO FINAL
 * ========================= */
$rutas = [];
$totalCantidadGeneral = 0;
$productosGlobales = [];
$colegiosGlobales = [];

while ($stmt->fetch()) {
    $row = [
        "idRutaAgrupada" => $rowIdRutaAgrupada,
        "codigoRutaAgrupada" => $rowCodigoRutaAgrupada,
        "nombreRutaAgrupada" => $rowNombreRutaAgrupada,
        "descripcionRutaAgrupada" => $rowDescripcionRutaAgrupada,
        "codigoColegio" => $rowCodigoColegio,
        "nombreColegio" => $rowNombreColegio,
        "direccionColegio" => $rowDireccionColegio,
        "idProducto" => $rowIdProducto,
        "codigoProducto" => $rowCodigoProducto,
        "productoExcel" => $rowProductoExcel,
        "descripcionMostrada" => $rowDescripcionMostrada,
        "unidadCoberturaExcel" => $rowUnidadCoberturaExcel,
        "descripcionProducto" => $rowDescripcionProducto,
        "producto_base" => $rowProductoBase,
        "presentacion" => $rowPresentacion,
        "embalaje" => $rowEmbalaje,
        "uniCaja" => $rowUniCaja,
        "cantidadTotal" => $rowCantidadTotal
    ];

    $idRutaActual = isset($row["idRutaAgrupada"]) ? (int)$row["idRutaAgrupada"] : 0;
    $codigoRutaActual = trim((string)($row["codigoRutaAgrupada"] ?? ""));
    $nombreRutaActual = trim((string)($row["nombreRutaAgrupada"] ?? "SIN RUTA"));
    $descripcionRuta = trim((string)($row["descripcionRutaAgrupada"] ?? ""));
    $ordenRuta = obtenerOrdenRutaAgrupada($codigoRutaActual, $nombreRutaActual, $idRutaActual);

    $codigoColegio = trim((string)($row["codigoColegio"] ?? ""));
    $nombreColegio = trim((string)($row["nombreColegio"] ?? "SIN COLEGIO"));
    $direccionColegio = trim((string)($row["direccionColegio"] ?? ""));

    /*
     * Se mantiene el nombre como llave para que el front actual no se rompa.
     * Se agrega colegiosDetalle para tener código/dirección disponibles si luego se necesitan.
     */
    $colegioKey = $nombreColegio !== "" ? $nombreColegio : ($codigoColegio !== "" ? $codigoColegio : "SIN COLEGIO");

    $idProductoActual = isset($row["idProducto"]) ? (int)$row["idProducto"] : 0;
    $codigoProducto = trim((string)($row["codigoProducto"] ?? ""));
    $producto = productoMostrar($row);
    $unidad = unidadMostrar($row);
    $cantidad = aNumero($row["cantidadTotal"] ?? 0);

    $rutaKey = $idRutaActual > 0 ? (string)$idRutaActual : $nombreRutaActual;

    if (!isset($rutas[$rutaKey])) {
        $rutas[$rutaKey] = [
            "idRuta" => $idRutaActual,
            "idRutaAgrupada" => $idRutaActual,
            "codigoRutaAgrupada" => $codigoRutaActual,
            "nombreRutaAgrupada" => $nombreRutaActual,
            "descripcionRutaAgrupada" => $descripcionRuta,
            "ruta" => $nombreRutaActual,
            "ordenRuta" => $ordenRuta,
            "colegiosMap" => [],
            "productosMap" => []
        ];
    }

    if (!isset($rutas[$rutaKey]["colegiosMap"][$colegioKey])) {
        $rutas[$rutaKey]["colegiosMap"][$colegioKey] = [
            "idColegio" => 0,
            "codigoColegio" => $codigoColegio,
            "nombre" => $colegioKey,
            "nombreColegio" => $nombreColegio,
            "direccion" => $direccionColegio
        ];
    }

    if (!isset($rutas[$rutaKey]["productosMap"][$idProductoActual])) {
        $rutas[$rutaKey]["productosMap"][$idProductoActual] = [
            "idProducto" => $idProductoActual,
            "codigoProducto" => $codigoProducto,
            "producto" => $producto,
            "unidad" => $unidad,
            "producto_base" => $row["producto_base"] ?? null,
            "presentacion" => $row["presentacion"] ?? null,
            "embalaje" => $row["embalaje"] ?? null,
            "uniCaja" => $row["uniCaja"] ?? null,
            "cantidadesPorColegio" => [],
            "totalCoberturaRuta" => 0,
            "lotes" => "",
            "vencimiento" => "",
            "observacion" => ""
        ];
    }

    if (!isset($rutas[$rutaKey]["productosMap"][$idProductoActual]["cantidadesPorColegio"][$colegioKey])) {
        $rutas[$rutaKey]["productosMap"][$idProductoActual]["cantidadesPorColegio"][$colegioKey] = 0;
    }

    $rutas[$rutaKey]["productosMap"][$idProductoActual]["cantidadesPorColegio"][$colegioKey] += $cantidad;
    $rutas[$rutaKey]["productosMap"][$idProductoActual]["totalCoberturaRuta"] += $cantidad;

    $totalCantidadGeneral += $cantidad;
    $productosGlobales[$idProductoActual . "||" . normalizarTexto($producto)] = true;
    $colegiosGlobales[$codigoColegio !== "" ? $codigoColegio : ($rutaKey . "||" . $colegioKey)] = true;
}

$stmt->close();

/* =========================
 * NORMALIZAR / ORDENAR SALIDA
 * ========================= */
$salidaRutas = array_values($rutas);

usort($salidaRutas, function ($a, $b) {
    if ((int)$a["ordenRuta"] !== (int)$b["ordenRuta"]) {
        return (int)$a["ordenRuta"] <=> (int)$b["ordenRuta"];
    }

    return ordenarRutaNombre($a["ruta"]) <=> ordenarRutaNombre($b["ruta"]);
});

foreach ($salidaRutas as &$rutaItem) {
    $colegios = array_values($rutaItem["colegiosMap"]);
    usort($colegios, function ($a, $b) {
        return strnatcasecmp(normalizarTexto($a["nombre"]), normalizarTexto($b["nombre"]));
    });

    $productos = array_values($rutaItem["productosMap"]);
    usort($productos, function ($a, $b) {
        $pa = normalizarTexto($a["producto"] ?? "");
        $pb = normalizarTexto($b["producto"] ?? "");
        return $pa <=> $pb;
    });

    foreach ($productos as &$productoItem) {
        $cantidadesOrdenadas = [];

        foreach ($colegios as $col) {
            $nombreCol = $col["nombre"];
            $cantidadesOrdenadas[$nombreCol] = aNumero(
                $productoItem["cantidadesPorColegio"][$nombreCol] ?? 0
            );
        }

        $productoItem["cantidadesPorColegio"] = $cantidadesOrdenadas;
    }
    unset($productoItem);

    $rutaItem["colegios"] = array_map(function ($c) {
        return $c["nombre"];
    }, $colegios);

    $rutaItem["colegiosDetalle"] = array_map(function ($c) {
        return [
            "codigoColegio" => $c["codigoColegio"],
            "nombreColegio" => $c["nombreColegio"],
            "direccion" => $c["direccion"]
        ];
    }, $colegios);

    $rutaItem["productos"] = $productos;

    unset($rutaItem["colegiosMap"], $rutaItem["productosMap"]);
}
unset($rutaItem);

$mysqli->close();

/* =========================
 * RESPUESTA
 * ========================= */
jexit(200, [
    "ok" => true,
    "mensaje" => "Informe consolidado Roldanillo por ruta agrupada y colegio generado correctamente",
    "filtros" => [
        "idDespacho" => $idDespacho,
        "idCategoria" => $idCategoria,
        "idRuta" => $idRuta > 0 ? $idRuta : null,
        "ruta" => $ruta !== "" ? $ruta : null
    ],
    "despacho" => $despachoInfo,
    "categoria" => $categoriaInfo,
    "rutas" => $salidaRutas,
    "resumen" => [
        "totalRutas" => count($salidaRutas),
        "totalColegios" => count($colegiosGlobales),
        "totalProductos" => count($productosGlobales),
        "totalCantidad" => $totalCantidadGeneral
    ]
]);
