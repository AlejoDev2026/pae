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

function ordenarProductos($a, $b) {
    $pa = normalizarTexto($a["producto"] ?? "");
    $pb = normalizarTexto($b["producto"] ?? "");

    if ($pa === $pb) {
        $ua = normalizarTexto($a["unidadCobertura"] ?? "");
        $ub = normalizarTexto($b["unidadCobertura"] ?? "");
        return $ua <=> $ub;
    }

    return $pa <=> $pb;
}

function ordenarRutas($a, $b) {
    $ra = (int)($a["ordenRuta"] ?? 999999);
    $rb = (int)($b["ordenRuta"] ?? 999999);

    if ($ra === $rb) {
        $na = normalizarTexto($a["ruta"] ?? "");
        $nb = normalizarTexto($b["ruta"] ?? "");
        return $na <=> $nb;
    }

    return $ra <=> $rb;
}

/* =========================
 * PARAMETROS
 * ========================= */
$idDespacho = isset($_GET["idDespacho"]) ? (int)$_GET["idDespacho"] : 0;
$tipo = isset($_GET["tipo"]) ? trim((string)$_GET["tipo"]) : "POR_RUTA";
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
 * CONSULTA PRINCIPAL
 *
 * REGLA:
 * - CONSOLIDAR SOLO POR RUTA + PRODUCTO
 * - SIN SEPARAR POR JORNADA
 * - SUMAR CANTIDAD DE TODAS LAS JORNADAS
 * - LUEGO CALCULAR PAC / UND CON uni/caja
 * ========================= */
$sql = "
    SELECT
        d.idDespacho,
        d.idRuta,
        r.nombreRuta,
        COALESCE(r.ordenRuta, 999999) AS ordenRuta,

        d.idProducto,
        p.descripcion AS producto,
        cp.nombre AS categoria,

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
    INNER JOIN RutasDespacho r
        ON r.id = d.idRuta
    INNER JOIN ProductosCatalogo p
        ON p.id = d.idProducto
    LEFT JOIN GruposProducto gp
        ON gp.id = p.idGrupo
    LEFT JOIN CategoriasProducto cp
        ON cp.id = gp.idCategoria
    LEFT JOIN EmbalajeCatalogo e
        ON e.id = p.idEmbalaje

    WHERE d.idDespacho = ?
";

$paramTypes = "i";
$paramValues = [$idDespacho];

if ($tipo === "POR_CATEGORIA" && $categoria !== "") {
    $sql .= " AND UPPER(TRIM(cp.nombre)) = ? ";
    $paramTypes .= "s";
    $paramValues[] = normalizarTexto($categoria);
}

$sql .= "
    GROUP BY
        d.idDespacho,
        d.idRuta,
        r.nombreRuta,
        r.ordenRuta,
        d.idProducto,
        p.descripcion,
        cp.nombre,
        p.idEmbalaje,
        e.producto_base,
        e.presentacion,
        e.embalaje,
        e.`uni/caja`

    ORDER BY
        COALESCE(r.ordenRuta, 999999) ASC,
        r.nombreRuta ASC,
        p.descripcion ASC
";

$stmt = $mysqli->prepare($sql);

if (!$stmt) {
    jexit(500, [
        "rpta" => "no",
        "mensaje" => "No se pudo preparar la consulta",
        "error" => $mysqli->error
    ]);
}

$stmt->bind_param($paramTypes, ...$paramValues);

if (!$stmt->execute()) {
    jexit(500, [
        "rpta" => "no",
        "mensaje" => "No se pudo ejecutar la consulta",
        "error" => $stmt->error
    ]);
}

$stmt->store_result();
$stmt->bind_result(
    $rowIdDespacho,
    $rowIdRuta,
    $rowNombreRuta,
    $rowOrdenRuta,
    $rowIdProducto,
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
 * CONSOLIDAR RUTAS Y PRODUCTOS
 * ========================= */
$rutasMap = [];
$productosGlobalesSet = [];

while ($stmt->fetch()) {
    $row = [
        "idDespacho" => $rowIdDespacho,
        "idRuta" => $rowIdRuta,
        "nombreRuta" => $rowNombreRuta,
        "ordenRuta" => $rowOrdenRuta,
        "idProducto" => $rowIdProducto,
        "producto" => $rowProducto,
        "categoria" => $rowCategoria,
        "unidadCobertura" => $rowUnidadCobertura,
        "totalCantidad" => $rowTotalCantidad,
        "idEmbalaje" => $rowIdEmbalaje,
        "producto_base" => $rowProductoBase,
        "presentacion" => $rowPresentacion,
        "embalaje" => $rowEmbalaje,
        "uniCaja" => $rowUniCaja
    ];

    $idRuta = (int)($row["idRuta"] ?? 0);
    $nombreRuta = trim((string)($row["nombreRuta"] ?? "Sin ruta"));
    $ordenRuta = (int)($row["ordenRuta"] ?? 999999);
    $rutaKey = (string)$idRuta;

    $idProducto = (int)($row["idProducto"] ?? 0);
    $producto = trim((string)($row["producto"] ?? "Sin producto"));
    $categoriaProducto = trim((string)($row["categoria"] ?? "Sin categoría"));
    $unidadCobertura = trim((string)($row["unidadCobertura"] ?? ""));
    $totalCantidad = (float)($row["totalCantidad"] ?? 0);

    $uniCajaRaw = $row["uniCaja"] ?? null;
    $uniCaja = is_numeric($uniCajaRaw) ? (int)round((float)$uniCajaRaw) : 0;

    if (!isset($rutasMap[$rutaKey])) {
        $rutasMap[$rutaKey] = [
            "idRuta" => $idRuta,
            "ruta" => $nombreRuta,
            "ordenRuta" => $ordenRuta,
            "productos" => [],
            "totalPac" => 0,
            "totalUnd" => 0,
            "totalRuta" => 0
        ];
    }

    $productoKey = (string)$idProducto;
    $productoKeyGlobal = $idProducto . "||" . normalizarTexto($producto);
    $productosGlobalesSet[$productoKeyGlobal] = true;

    if (!isset($rutasMap[$rutaKey]["productos"][$productoKey])) {
        $rutasMap[$rutaKey]["productos"][$productoKey] = [
            "idProducto" => $idProducto,
            "producto" => $producto,
            "categoria" => $categoriaProducto,
            "unidadCobertura" => $unidadCobertura,
            "total" => 0,
            "totalEnteroCalculo" => 0,
            "uniCaja" => $uniCaja,
            "pac" => 0,
            "und" => 0,
            "embalaje" => [
                "idEmbalaje" => isset($row["idEmbalaje"]) ? (int)$row["idEmbalaje"] : null,
                "producto_base" => $row["producto_base"] ?? null,
                "presentacion" => $row["presentacion"] ?? null,
                "embalaje" => $row["embalaje"] ?? null
            ]
        ];
    }

    $rutasMap[$rutaKey]["productos"][$productoKey]["total"] += $totalCantidad;

    if (
        $rutasMap[$rutaKey]["productos"][$productoKey]["unidadCobertura"] === "" &&
        $unidadCobertura !== ""
    ) {
        $rutasMap[$rutaKey]["productos"][$productoKey]["unidadCobertura"] = $unidadCobertura;
    }

    if (
        (int)$rutasMap[$rutaKey]["productos"][$productoKey]["uniCaja"] <= 0 &&
        $uniCaja > 0
    ) {
        $rutasMap[$rutaKey]["productos"][$productoKey]["uniCaja"] = $uniCaja;
    }
}

$stmt->close();

/* =========================
 * APLANAR PRODUCTOS Y CALCULAR
 * PAC / UND YA CONSOLIDADOS
 * ========================= */
$rutasFinal = array_values($rutasMap);

foreach ($rutasFinal as &$rutaItem) {
    $productosFinal = [];
    $rutaItem["totalPac"] = 0;
    $rutaItem["totalUnd"] = 0;
    $rutaItem["totalRuta"] = 0;

    foreach ($rutaItem["productos"] as $productoItem) {
        $total = (float)($productoItem["total"] ?? 0);
        $totalEnteroCalculo = (int)round($total);
        $uniCaja = (int)($productoItem["uniCaja"] ?? 0);

        if ($uniCaja > 0) {
            $pac = intdiv($totalEnteroCalculo, $uniCaja);
            $und = $totalEnteroCalculo % $uniCaja;
        } else {
            $pac = 0;
            $und = $totalEnteroCalculo;
        }

        $productoItem["total"] = $total;
        $productoItem["totalEnteroCalculo"] = $totalEnteroCalculo;
        $productoItem["pac"] = $pac;
        $productoItem["und"] = $und;

        $productosFinal[] = $productoItem;

        $rutaItem["totalRuta"] += $total;
        $rutaItem["totalPac"] += $pac;
        $rutaItem["totalUnd"] += $und;
    }

    usort($productosFinal, "ordenarProductos");
    $rutaItem["productos"] = $productosFinal;
}
unset($rutaItem);

usort($rutasFinal, "ordenarRutas");

/* =========================
 * RESUMEN GENERAL
 * ========================= */
$totalCantidadGeneral = 0;
$totalPacGeneral = 0;
$totalUndGeneral = 0;

foreach ($rutasFinal as $rutaItem) {
    $totalCantidadGeneral += (float)$rutaItem["totalRuta"];
    $totalPacGeneral += (float)$rutaItem["totalPac"];
    $totalUndGeneral += (float)$rutaItem["totalUnd"];
}

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

if ($stmtDespacho) {
    $stmtDespacho->bind_param("i", $idDespacho);

    if ($stmtDespacho->execute()) {
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
    }

    $stmtDespacho->close();
}

if (!$despachoInfo) {
    $despachoInfo = [
        "id" => $idDespacho,
        "codigo" => "Sin código",
        "fechaDespacho" => "-",
        "tipoPeriodo" => "-",
        "descripcion" => "Sin descripción",
        "estado" => "-"
    ];
}

$mysqli->close();

/* =========================
 * RESPUESTA
 * ========================= */
jexit(200, [
    "rpta" => "si",
    "mensaje" => "Informe generado correctamente",
    "data" => [
        "despacho" => $despachoInfo,
        "tipo" => $tipo,
        "categoria" => $tipo === "POR_CATEGORIA" ? $categoria : "",
        "jornadas" => [],
        "rutas" => $rutasFinal,
        "resumen" => [
            "totalJornadas" => 0,
            "totalRutas" => count($rutasFinal),
            "totalProductos" => count($productosGlobalesSet),
            "totalCantidad" => $totalCantidadGeneral,
            "totalPac" => $totalPacGeneral,
            "totalUnd" => $totalUndGeneral
        ]
    ]
]);