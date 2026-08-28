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
        ["Á", "É", "Í", "Ó", "Ú", "Ñ"],
        ["A", "E", "I", "O", "U", "N"],
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

function ordenarRutaNombre($nombre) {
    $normal = normalizarTexto($nombre);

    if (preg_match('/RUTA\s*([0-9]+)/i', $normal, $m)) {
        return [0, (int)$m[1], $normal];
    }

    return [1, 999999, $normal];
}

/* =========================
 * PARAMETROS
 * ========================= */
$idDespacho  = isset($_GET["idDespacho"]) ? (int)$_GET["idDespacho"] : 0;
$idCategoria = isset($_GET["idCategoria"]) ? (int)$_GET["idCategoria"] : 0;
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
 * Basado en el archivo que sí te funciona
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
    jexit(500, [
        "ok" => false,
        "mensaje" => "No se pudo ejecutar la consulta del despacho",
        "error" => $stmtDespacho->error
    ]);
}

$stmtDespacho->store_result();
$stmtDespacho->bind_result(
    $despachoId,
    $despachoCodigo,
    $despachoFecha,
    $despachoTipoPeriodo,
    $despachoDescripcion,
    $despachoEstado
);

if ($stmtDespacho->fetch()) {
    $despachoInfo = [
        "id" => isset($despachoId) ? (int)$despachoId : null,
        "codigo" => $despachoCodigo ?? "Sin código",
        "fechaDespacho" => $despachoFecha ?? "-",
        "tipoPeriodo" => $despachoTipoPeriodo ?? "-",
        "descripcion" => $despachoDescripcion ?? "Sin descripción",
        "estado" => $despachoEstado ?? "-"
    ];
}
$stmtDespacho->close();

if (!$despachoInfo) {
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
    jexit(500, [
        "ok" => false,
        "mensaje" => "No se pudo preparar la consulta de la categoría",
        "error" => $mysqli->error
    ]);
}

$stmtCategoria->bind_param("i", $idCategoria);

if (!$stmtCategoria->execute()) {
    jexit(500, [
        "ok" => false,
        "mensaje" => "No se pudo ejecutar la consulta de la categoría",
        "error" => $stmtCategoria->error
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
    jexit(404, [
        "ok" => false,
        "mensaje" => "La categoría no existe"
    ]);
}

/* =========================
 * CONSULTA PRINCIPAL
 *
 * REGLA:
 * - FILTRAR POR DESPACHO + CATEGORIA
 * - CONSOLIDAR POR RUTA + COLEGIO + PRODUCTO
 * - SUMAR AM + PM + JORNADA_UNICA (ya quedan en DetalleRutaProducto para el mismo despacho)
 * - LOS COLEGIOS IRAN COMO COLUMNAS DINAMICAS EN EL FRONT / EXCEL
 * ========================= */
$sql = "
    SELECT
        r.id AS idRuta,
        r.nombreRuta,
        MIN(COALESCE(r.ordenRuta, 999999)) AS ordenRuta,

        COALESCE(c.id, 0) AS idColegio,
        COALESCE(c.nombre, 'SIN COLEGIO') AS nombreColegio,

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
    INNER JOIN RutasDespacho r
        ON r.id = d.idRuta
    LEFT JOIN ColegiosDespacho c
        ON c.id = d.idColegio
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
    $sql .= " AND r.id = ? ";
    $paramTypes .= "i";
    $paramValues[] = $idRuta;
}

if ($ruta !== "") {
    $sql .= " AND UPPER(TRIM(r.nombreRuta)) = ? ";
    $paramTypes .= "s";
    $paramValues[] = normalizarTexto($ruta);
}

$sql .= "
    GROUP BY
        r.id,
        r.nombreRuta,
        COALESCE(c.id, 0),
        COALESCE(c.nombre, 'SIN COLEGIO'),
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
        MIN(COALESCE(r.ordenRuta, 999999)) ASC,
        r.nombreRuta ASC,
        COALESCE(c.nombre, 'SIN COLEGIO') ASC,
        p.descripcion ASC
";

$stmt = $mysqli->prepare($sql);

if (!$stmt) {
    jexit(500, [
        "ok" => false,
        "mensaje" => "No se pudo preparar la consulta principal",
        "error" => $mysqli->error
    ]);
}

$stmt->bind_param($paramTypes, ...$paramValues);

if (!$stmt->execute()) {
    jexit(500, [
        "ok" => false,
        "mensaje" => "No se pudo ejecutar la consulta principal",
        "error" => $stmt->error
    ]);
}

$stmt->store_result();
$stmt->bind_result(
    $rowIdRuta,
    $rowNombreRuta,
    $rowOrdenRuta,
    $rowIdColegio,
    $rowNombreColegio,
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

while ($stmt->fetch()) {
    $row = [
        "idRuta" => $rowIdRuta,
        "nombreRuta" => $rowNombreRuta,
        "ordenRuta" => $rowOrdenRuta,
        "idColegio" => $rowIdColegio,
        "nombreColegio" => $rowNombreColegio,
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

    $idRutaActual = isset($row["idRuta"]) ? (int)$row["idRuta"] : 0;
    $nombreRutaActual = trim((string)($row["nombreRuta"] ?? "SIN RUTA"));
    $ordenRuta = isset($row["ordenRuta"]) ? (int)$row["ordenRuta"] : 999999;

    $idColegioActual = isset($row["idColegio"]) ? (int)$row["idColegio"] : 0;
    $nombreColegio = trim((string)($row["nombreColegio"] ?? "SIN COLEGIO"));

    $idProductoActual = isset($row["idProducto"]) ? (int)$row["idProducto"] : 0;
    $codigoProducto = trim((string)($row["codigoProducto"] ?? ""));
    $producto = productoMostrar($row);
    $unidad = unidadMostrar($row);
    $cantidad = aNumero($row["cantidadTotal"] ?? 0);

    $rutaKey = $idRutaActual > 0 ? (string)$idRutaActual : $nombreRutaActual;

    if (!isset($rutas[$rutaKey])) {
        $rutas[$rutaKey] = [
            "idRuta" => $idRutaActual,
            "ruta" => $nombreRutaActual,
            "ordenRuta" => $ordenRuta,
            "colegiosMap" => [],
            "productosMap" => []
        ];
    }

    if (!isset($rutas[$rutaKey]["colegiosMap"][$nombreColegio])) {
        $rutas[$rutaKey]["colegiosMap"][$nombreColegio] = [
            "idColegio" => $idColegioActual,
            "nombre" => $nombreColegio
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

    $rutas[$rutaKey]["productosMap"][$idProductoActual]["cantidadesPorColegio"][$nombreColegio] = $cantidad;
    $rutas[$rutaKey]["productosMap"][$idProductoActual]["totalCoberturaRuta"] += $cantidad;
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
    "mensaje" => "Informe consolidado por ruta y colegio generado correctamente",
    "filtros" => [
        "idDespacho" => $idDespacho,
        "idCategoria" => $idCategoria,
        "idRuta" => $idRuta > 0 ? $idRuta : null,
        "ruta" => $ruta !== "" ? $ruta : null
    ],
    "despacho" => $despachoInfo,
    "categoria" => $categoriaInfo,
    "rutas" => $salidaRutas
]);