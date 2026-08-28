<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

/* =========================
 * HEADERS
 * ========================= */
header("Expires: Tue, 01 Jan 2000 00:00:00 GMT");
header("Last-Modified: " . gmdate("D, d M Y H:i:s") . " GMT");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Cache-Control, Pragma, Expires");
header("Access-Control-Max-Age: 0");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

/* =========================
 * HELPERS
 * ========================= */
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

function ordenarProductosJornada($a, $b) {
    $pa = normalizarTexto(trim($a["producto"] ?? ""));
    $pb = normalizarTexto(trim($b["producto"] ?? ""));

    if ($pa !== $pb) {
        return strcmp($pa, $pb);
    }

    $ca = normalizarTexto(trim($a["codigo"] ?? ""));
    $cb = normalizarTexto(trim($b["codigo"] ?? ""));

    if ($ca !== $cb) {
        return strcmp($ca, $cb);
    }

    $ua = normalizarTexto(trim($a["unidadCobertura"] ?? ""));
    $ub = normalizarTexto(trim($b["unidadCobertura"] ?? ""));

    return strcmp($ua, $ub);
}

function calcularPacUndDesdeTotal($totalCantidad, $uniCaja) {
    $totalEntero = (int)round((float)$totalCantidad);
    $uniCaja = (int)$uniCaja;

    if ($uniCaja > 0) {
        $pac = intdiv($totalEntero, $uniCaja);
        $und = $totalEntero % $uniCaja;
    } else {
        $pac = 0;
        $und = $totalEntero;
    }

    return [
        "totalEnteroCalculo" => $totalEntero,
        "pac" => $pac,
        "und" => $und
    ];
}

/* =========================
 * PARAMETROS
 * ========================= */
$idDespacho = isset($_GET["idDespacho"]) ? (int)$_GET["idDespacho"] : 0;
$tipo = isset($_GET["tipo"]) ? trim((string)$_GET["tipo"]) : "TOTAL_JORNADA_CONTRATO";
$categoria = isset($_GET["categoria"]) ? trim((string)$_GET["categoria"]) : "";

if ($idDespacho <= 0) {
    jexit(400, [
        "rpta" => "no",
        "mensaje" => "El parámetro idDespacho es obligatorio"
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
        "rpta" => "no",
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
        "rpta" => "no",
        "mensaje" => "No se pudo preparar la consulta del despacho",
        "error" => $mysqli->error
    ]);
}

$stmtDespacho->bind_param("i", $idDespacho);

if (!$stmtDespacho->execute()) {
    jexit(500, [
        "rpta" => "no",
        "mensaje" => "No se pudo ejecutar la consulta del despacho",
        "error" => $stmtDespacho->error
    ]);
}

$stmtDespacho->store_result();
$stmtDespacho->bind_result(
    $despachoId,
    $despachoCodigo,
    $despachoFechaDespacho,
    $despachoTipoPeriodo,
    $despachoDescripcion,
    $despachoEstado
);

if ($stmtDespacho->fetch()) {
    $despachoInfo = [
        "id" => isset($despachoId) ? (int)$despachoId : null,
        "codigo" => $despachoCodigo ?? "Sin código",
        "fechaDespacho" => $despachoFechaDespacho ?? "-",
        "tipoPeriodo" => $despachoTipoPeriodo ?? "-",
        "descripcion" => $despachoDescripcion ?? "Sin descripción",
        "estado" => $despachoEstado ?? "-"
    ];
}
$stmtDespacho->close();

if (!$despachoInfo) {
    jexit(404, [
        "rpta" => "no",
        "mensaje" => "El despacho no existe"
    ]);
}

/* =========================
 * CONSULTA PRINCIPAL
 *
 * REGLA:
 * - CONSOLIDAR POR PRODUCTO
 * - TRAER CODIGO DESDE ProductosCatalogo.codigo
 * - PAC / UND SE CALCULAN CON EmbalajeCatalogo.`uni/caja`
 * - NO USAR drp.cajasPacas / drp.unidades COMO FUENTE PRINCIPAL
 * ========================= */
$sql = "
    SELECT
        d.idDespacho,
        d.idProducto,

        COALESCE(NULLIF(TRIM(p.codigo), ''), '') AS codigo,
        COALESCE(NULLIF(TRIM(p.descripcion), ''), 'Sin producto') AS producto,
        COALESCE(NULLIF(TRIM(cp.nombre), ''), 'Sin categoría') AS categoria,

        COALESCE(
            MAX(NULLIF(TRIM(d.unidadCoberturaExcel), '')),
            ''
        ) AS unidadCobertura,

        SUM(COALESCE(d.cantidad, 0)) AS totalCantidad,

        p.idEmbalaje,
        e.producto_base,
        e.presentacion,
        e.embalaje,
        e.`uni/caja` AS uniCaja

    FROM DetalleRutaProducto d
    INNER JOIN ProductosCatalogo p
        ON p.id = d.idProducto
    LEFT JOIN GruposProducto gp
        ON gp.id = p.idGrupo
    LEFT JOIN CategoriasProducto cp
        ON cp.id = gp.idCategoria
    LEFT JOIN EmbalajeCatalogo e
        ON e.id = p.idEmbalaje

    WHERE d.idDespacho = ?
    AND  cp.id IN (24, 21)
";

$paramTypes = "i";
$paramValues = [$idDespacho];

if ($categoria !== "") {
    $sql .= " AND UPPER(TRIM(cp.nombre)) = ? ";
    $paramTypes .= "s";
    $paramValues[] = normalizarTexto($categoria);
}

$sql .= "
    GROUP BY
        d.idDespacho,
        d.idProducto,
        p.codigo,
        p.descripcion,
        cp.nombre,
        p.idEmbalaje,
        e.producto_base,
        e.presentacion,
        e.embalaje,
        e.`uni/caja`

    ORDER BY
        p.codigo ASC,
        p.descripcion ASC
";

$stmt = $mysqli->prepare($sql);

if (!$stmt) {
    jexit(500, [
        "rpta" => "no",
        "mensaje" => "No se pudo preparar la consulta principal",
        "error" => $mysqli->error
    ]);
}

$stmt->bind_param($paramTypes, ...$paramValues);

if (!$stmt->execute()) {
    jexit(500, [
        "rpta" => "no",
        "mensaje" => "No se pudo ejecutar la consulta principal",
        "error" => $stmt->error
    ]);
}

$stmt->store_result();
$stmt->bind_result(
    $rowIdDespacho,
    $rowIdProducto,
    $rowCodigo,
    $rowProducto,
    $rowCategoria,
    $rowUnidadCobertura,
    $rowTotalCantidad,
    $rowIdEmbalaje,
    $rowProductoBase,
    $rowPresentacion,
    $rowEmbalaje,
    $rowUniCaja
);

/* =========================
 * CONSOLIDADO FINAL
 * ========================= */
$productos = [];
$productosSet = [];

$totalCantidadGeneral = 0;
$totalPacGeneral = 0;
$totalUndGeneral = 0;

while ($stmt->fetch()) {
    $idProducto = (int)($rowIdProducto ?? 0);
    $codigo = trim((string)($rowCodigo ?? ""));
    $producto = trim((string)($rowProducto ?? "Sin producto"));
    $categoriaProducto = trim((string)($rowCategoria ?? "Sin categoría"));
    $unidadCobertura = trim((string)($rowUnidadCobertura ?? ""));
//   $totalPacOriginal = (float)($rowTotalCantidad ?? 0);

//     $uniCajaRaw = $rowUniCaja ?? null;
//     $uniCaja = is_numeric($uniCajaRaw) ? (int)round((float)$uniCajaRaw) : 0;
    
//     // Como d.cantidad viene en PAC, convertimos a unidades reales.
//     $totalCantidad = $uniCaja > 0
//         ? ($totalPacOriginal * $uniCaja)
//         : $totalPacOriginal;
    
//     $calc = calcularPacUndDesdeTotal($totalCantidad, $uniCaja);

$totalCantidad = (float)($rowTotalCantidad ?? 0);

$uniCajaRaw = $rowUniCaja ?? null;
$uniCaja = is_numeric($uniCajaRaw) ? (int)round((float)$uniCajaRaw) : 0;

$calc = calcularPacUndDesdeTotal($totalCantidad, $uniCaja);

    $item = [
        "idProducto" => $idProducto,
        "codigo" => $codigo,
        "producto" => $producto,
        "categoria" => $categoriaProducto,
        "unidadCobertura" => $unidadCobertura,
        "total" => $totalCantidad,
        // "totalPacOriginal" => $totalPacOriginal,
        "totalEnteroCalculo" => $calc["totalEnteroCalculo"],
        "uniCaja" => $uniCaja,
        "pac" => $calc["pac"],
        "und" => $calc["und"],

        // 👇 esto te deja listo el formato donde observación 1 = PAC y observación 2 = UND
        "observacionPac" => $calc["pac"],
        "observacionUnd" => $calc["und"],

        "embalaje" => [
            "idEmbalaje" => isset($rowIdEmbalaje) ? (int)$rowIdEmbalaje : null,
            "producto_base" => $rowProductoBase ?? null,
            "presentacion" => $rowPresentacion ?? null,
            "embalaje" => $rowEmbalaje ?? null
        ]
    ];

    $productos[] = $item;

    $productoKey = $idProducto . "||" . normalizarTexto($producto);
    $productosSet[$productoKey] = true;

    $totalCantidadGeneral += $totalCantidad;
    $totalPacGeneral += $calc["pac"];
    $totalUndGeneral += $calc["und"];
}

$stmt->close();

usort($productos, "ordenarProductosJornada");

$mysqli->close();

/* =========================
 * RESPUESTA
 * ========================= */
jexit(200, [
    "rpta" => "si",
    "mensaje" => "Informe total jornada / contrato generado correctamente",
    "data" => [
        "despacho" => $despachoInfo,
        "tipo" => $tipo,
        "categoria" => $categoria,
        "productos" => $productos,

        // para no romper pantallas que esperen estas llaves
        "jornadas" => [],
        "rutas" => [],

        "resumen" => [
            "totalJornadas" => 0,
            "totalRutas" => 0,
            "totalProductos" => count($productosSet),
            "totalCantidad" => $totalCantidadGeneral,
            "totalPac" => $totalPacGeneral,
            "totalUnd" => $totalUndGeneral
        ]
    ]
]);