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
function jexit($code, $arr)
{
    http_response_code($code);

    echo json_encode(
        $arr,
        JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT
    );

    exit;
}

function normalizarTexto($texto)
{
    $texto = trim((string)$texto);
    $texto = preg_replace('/\s+/', ' ', $texto);
    $texto = mb_strtoupper($texto, "UTF-8");

    $texto = str_replace(
        [
            "Á", "É", "Í", "Ó", "Ú", "Ñ",
            "À", "È", "Ì", "Ò", "Ù",
            "Ä", "Ë", "Ï", "Ö", "Ü"
        ],
        [
            "A", "E", "I", "O", "U", "N",
            "A", "E", "I", "O", "U",
            "A", "E", "I", "O", "U"
        ],
        $texto
    );

    return trim($texto);
}

function ordenarProductos($a, $b)
{
    $pa = normalizarTexto($a["producto"] ?? "");
    $pb = normalizarTexto($b["producto"] ?? "");

    if ($pa === $pb) {
        $ua = normalizarTexto($a["unidadCobertura"] ?? "");
        $ub = normalizarTexto($b["unidadCobertura"] ?? "");

        return $ua <=> $ub;
    }

    return $pa <=> $pb;
}

function ordenarRutas($a, $b)
{
    $ra = (int)($a["ordenRuta"] ?? 999999);
    $rb = (int)($b["ordenRuta"] ?? 999999);

    if ($ra === $rb) {
        $na = normalizarTexto($a["ruta"] ?? "");
        $nb = normalizarTexto($b["ruta"] ?? "");

        return $na <=> $nb;
    }

    return $ra <=> $rb;
}

/**
 * Obtiene un orden numérico para la ruta agrupada.
 *
 * Ejemplos:
 * RA_001_ANSERMANUEVO -> 1
 * RA_011_TORO         -> 11
 *
 * Si el código no tiene número, utiliza el id de la ruta.
 */
function obtenerOrdenRuta($codigoRuta, $nombreRuta, $idRuta)
{
    $codigoRuta = trim((string)$codigoRuta);
    $nombreRuta = trim((string)$nombreRuta);

    if (
        $codigoRuta !== "" &&
        preg_match('/(\d+)/', $codigoRuta, $coincidencia)
    ) {
        return (int)$coincidencia[1];
    }

    if (
        $nombreRuta !== "" &&
        preg_match('/(\d+)/', $nombreRuta, $coincidencia)
    ) {
        return (int)$coincidencia[1];
    }

    if ((int)$idRuta > 0) {
        return (int)$idRuta;
    }

    return 999999;
}

/**
 * Convierte el campo uni/caja a entero.
 *
 * Ejemplos admitidos:
 * 12
 * 12 UND
 * CAJA X 12
 */
function parseUniCaja($valor)
{
    if ($valor === null) {
        return 0;
    }

    if (is_numeric($valor)) {
        return (int)round((float)$valor);
    }

    $valor = trim((string)$valor);

    if ($valor === "") {
        return 0;
    }

    if (preg_match('/(\d+)/', $valor, $coincidencia)) {
        return (int)$coincidencia[1];
    }

    return 0;
}

/**
 * Permite asociar parámetros dinámicos en mysqli.
 */
function bindParametrosDinamicos($stmt, $types, $values)
{
    if ($types === "" || empty($values)) {
        return true;
    }

    $params = [];
    $params[] = $types;

    foreach ($values as $index => $value) {
        $values[$index] = $value;
        $params[] = &$values[$index];
    }

    return call_user_func_array(
        [$stmt, "bind_param"],
        $params
    );
}

/* =========================
 * PARÁMETROS
 * ========================= */
$idDespacho = isset($_GET["idDespacho"])
    ? (int)$_GET["idDespacho"]
    : 0;

$tipo = isset($_GET["tipo"])
    ? trim((string)$_GET["tipo"])
    : "POR_RUTA";

$categoria = isset($_GET["categoria"])
    ? trim((string)$_GET["categoria"])
    : "";

$idCategoria = isset($_GET["idCategoria"])
    ? (int)$_GET["idCategoria"]
    : 0;

if ($idDespacho <= 0) {
    jexit(400, [
        "rpta" => "no",
        "mensaje" => "El parámetro idDespacho es obligatorio"
    ]);
}

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
        "rpta" => "no",
        "mensaje" => "No se pudo conectar a la base de datos",
        "error" => $mysqli->connect_error
    ]);
}

$mysqli->set_charset("utf8mb4");

/* =========================
 * CONSULTAR DESPACHO
 *
 * Conserva exactamente los campos
 * del primer servicio.
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
    $error = $mysqli->error;
    $mysqli->close();

    jexit(500, [
        "rpta" => "no",
        "mensaje" => "No se pudo preparar la consulta del despacho",
        "error" => $error
    ]);
}

$stmtDespacho->bind_param("i", $idDespacho);

if (!$stmtDespacho->execute()) {
    $error = $stmtDespacho->error;

    $stmtDespacho->close();
    $mysqli->close();

    jexit(500, [
        "rpta" => "no",
        "mensaje" => "No se pudo consultar el despacho",
        "error" => $error
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
        "id" => (int)$despachoId,
        "codigo" => $despachoCodigo ?? "Sin código",
        "fechaDespacho" => $despachoFechaDespacho ?? "-",
        "tipoPeriodo" => $despachoTipoPeriodo ?? "-",
        "descripcion" => $despachoDescripcion ?? "Sin descripción",
        "estado" => $despachoEstado ?? "-"
    ];
}

$stmtDespacho->close();

if (!$despachoInfo) {
    $mysqli->close();

    jexit(404, [
        "rpta" => "no",
        "mensaje" => "No se encontró el despacho solicitado"
    ]);
}

/* =========================
 * CONSULTA PRINCIPAL
 *
 * RELACIÓN:
 *
 * DetalleRutaProducto
 *   -> ColegiosDespacho / SedesDespacho
 *   -> RutasAgrupadasColegios
 *   -> RutasAgrupadas
 *
 * CONSOLIDACIÓN:
 *
 * Ruta agrupada + producto
 *
 * Los colegios se utilizan para identificar
 * a qué ruta agrupada pertenece cada detalle,
 * pero no se devuelven en la respuesta.
 * ========================= */
$sql = "
    SELECT
        d.idDespacho,

        ra.id AS idRutaAgrupada,
        ra.codigo AS codigoRutaAgrupada,
        ra.nombre AS nombreRutaAgrupada,
        COALESCE(ra.descripcion, '') AS descripcionRutaAgrupada,

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

    LEFT JOIN ColegiosDespacho c
        ON c.id = d.idColegio

    LEFT JOIN SedesDespacho s
        ON s.id = d.idSede

    INNER JOIN RutasAgrupadasColegios rac
        ON (
            (
                NULLIF(TRIM(c.codigo), '') IS NOT NULL
                AND TRIM(rac.codigoColegio) = TRIM(c.codigo)
            )
            OR
            (
                NULLIF(TRIM(s.codigo), '') IS NOT NULL
                AND TRIM(rac.codigoColegio) = TRIM(s.codigo)
            )
        )
       AND rac.estado = 1

    INNER JOIN RutasAgrupadas ra
        ON ra.id = rac.idRutaAgrupada
       AND ra.estado = 1

    INNER JOIN ProductosCatalogo p
        ON p.id = d.idProducto
       AND p.estado = 1

    INNER JOIN GruposProducto gp
        ON gp.id = p.idGrupo
       AND gp.estado = 1

    LEFT JOIN CategoriasProducto cp
        ON cp.id = gp.idCategoria

    LEFT JOIN EmbalajeCatalogo e
        ON e.id = p.idEmbalaje
       AND e.estado = 1

    WHERE d.idDespacho = ?
";

$paramTypes = "i";
$paramValues = [$idDespacho];

/* =========================
 * FILTRO OPCIONAL DE CATEGORÍA
 * ========================= */
if ($idCategoria > 0) {
    $sql .= "
        AND gp.idCategoria = ?
    ";

    $paramTypes .= "i";
    $paramValues[] = $idCategoria;
} elseif (
    $tipo === "POR_CATEGORIA" &&
    $categoria !== ""
) {
    $sql .= "
        AND UPPER(TRIM(cp.nombre)) = ?
    ";

    $paramTypes .= "s";
    $paramValues[] = mb_strtoupper(
        trim($categoria),
        "UTF-8"
    );
}

/* =========================
 * AGRUPACIÓN
 *
 * Aquí se suman todos los detalles
 * de todos los colegios configurados
 * dentro de la misma ruta agrupada.
 * ========================= */
$sql .= "
    GROUP BY
        d.idDespacho,

        ra.id,
        ra.codigo,
        ra.nombre,
        ra.descripcion,

        d.idProducto,
        p.descripcion,
        cp.nombre,

        p.idEmbalaje,
        e.producto_base,
        e.presentacion,
        e.embalaje,
        e.`uni/caja`

    ORDER BY
        ra.nombre ASC,
        p.descripcion ASC
";

$stmt = $mysqli->prepare($sql);

if (!$stmt) {
    $error = $mysqli->error;
    $mysqli->close();

    jexit(500, [
        "rpta" => "no",
        "mensaje" => "No se pudo preparar la consulta principal",
        "error" => $error
    ]);
}

if (!bindParametrosDinamicos(
    $stmt,
    $paramTypes,
    $paramValues
)) {
    $error = $stmt->error;

    $stmt->close();
    $mysqli->close();

    jexit(500, [
        "rpta" => "no",
        "mensaje" => "No se pudieron asociar los parámetros de la consulta",
        "error" => $error
    ]);
}

if (!$stmt->execute()) {
    $error = $stmt->error;

    $stmt->close();
    $mysqli->close();

    jexit(500, [
        "rpta" => "no",
        "mensaje" => "No se pudo ejecutar la consulta principal",
        "error" => $error
    ]);
}

$stmt->store_result();

$stmt->bind_result(
    $rowIdDespacho,

    $rowIdRutaAgrupada,
    $rowCodigoRutaAgrupada,
    $rowNombreRutaAgrupada,
    $rowDescripcionRutaAgrupada,

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
 * CONSTRUIR RUTAS
 *
 * Mantiene las etiquetas exactas
 * del primer servicio.
 * ========================= */
$rutasMap = [];
$productosGlobalesSet = [];

while ($stmt->fetch()) {
    $idRuta = (int)$rowIdRutaAgrupada;
    $codigoRuta = trim((string)$rowCodigoRutaAgrupada);
    $nombreRuta = trim((string)$rowNombreRutaAgrupada);

    if ($nombreRuta === "") {
        $nombreRuta = $codigoRuta !== ""
            ? $codigoRuta
            : "Sin ruta";
    }

    $ordenRuta = obtenerOrdenRuta(
        $codigoRuta,
        $nombreRuta,
        $idRuta
    );

    /*
     * La ruta se unifica exclusivamente
     * por RutasAgrupadas.id.
     */
    $rutaKey = (string)$idRuta;

    $idProducto = (int)$rowIdProducto;
    $producto = trim((string)$rowProducto);

    if ($producto === "") {
        $producto = "Sin producto";
    }

    $categoriaProducto = trim((string)$rowCategoria);

    if ($categoriaProducto === "") {
        $categoriaProducto = "Sin categoría";
    }

    $unidadCobertura = trim(
        (string)$rowUnidadCobertura
    );

    $totalCantidad = (float)$rowTotalCantidad;
    $uniCaja = parseUniCaja($rowUniCaja);

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

    /*
     * Los productos se unifican por idProducto.
     */
    $productoKey = (string)$idProducto;

    $productoKeyGlobal =
        $idProducto . "||" . normalizarTexto($producto);

    $productosGlobalesSet[$productoKeyGlobal] = true;

    if (
        !isset(
            $rutasMap[$rutaKey]["productos"][$productoKey]
        )
    ) {
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
                "idEmbalaje" => $rowIdEmbalaje !== null
                    ? (int)$rowIdEmbalaje
                    : null,

                "producto_base" => $rowProductoBase,
                "presentacion" => $rowPresentacion,
                "embalaje" => $rowEmbalaje
            ]
        ];
    }

    /*
     * SQL ya entrega el total consolidado por
     * ruta agrupada y producto.
     *
     * Se conserva += como protección adicional.
     */
    $rutasMap[$rutaKey]["productos"][$productoKey]["total"]
        += $totalCantidad;

    if (
        $rutasMap[$rutaKey]["productos"][$productoKey]["unidadCobertura"] === ""
        &&
        $unidadCobertura !== ""
    ) {
        $rutasMap[$rutaKey]["productos"][$productoKey]["unidadCobertura"]
            = $unidadCobertura;
    }

    if (
        (int)$rutasMap[$rutaKey]["productos"][$productoKey]["uniCaja"] <= 0
        &&
        $uniCaja > 0
    ) {
        $rutasMap[$rutaKey]["productos"][$productoKey]["uniCaja"]
            = $uniCaja;
    }
}

$stmt->close();

/* =========================
 * CALCULAR PAC Y UND
 *
 * Primero se suma todo el producto
 * dentro de la ruta agrupada.
 *
 * Después:
 *
 * PAC = total / uniCaja
 * UND = total % uniCaja
 * ========================= */
$rutasFinal = array_values($rutasMap);

foreach ($rutasFinal as &$rutaItem) {
    $productosFinal = [];

    $rutaItem["totalPac"] = 0;
    $rutaItem["totalUnd"] = 0;
    $rutaItem["totalRuta"] = 0;

    foreach ($rutaItem["productos"] as $productoItem) {
        $total = (float)(
            $productoItem["total"] ?? 0
        );

        /*
         * Conserva exactamente la regla
         * del primer servicio.
         */
        $totalEnteroCalculo = (int)round($total);

        $uniCaja = (int)(
            $productoItem["uniCaja"] ?? 0
        );

        if ($uniCaja > 0) {
            $pac = intdiv(
                $totalEnteroCalculo,
                $uniCaja
            );

            $und =
                $totalEnteroCalculo % $uniCaja;
        } else {
            $pac = 0;
            $und = $totalEnteroCalculo;
        }

        $productoItem["total"] = $total;
        $productoItem["totalEnteroCalculo"] =
            $totalEnteroCalculo;

        $productoItem["pac"] = $pac;
        $productoItem["und"] = $und;

        $productosFinal[] = $productoItem;

        $rutaItem["totalRuta"] += $total;
        $rutaItem["totalPac"] += $pac;
        $rutaItem["totalUnd"] += $und;
    }

    usort(
        $productosFinal,
        "ordenarProductos"
    );

    $rutaItem["productos"] = $productosFinal;
}

unset($rutaItem);

usort(
    $rutasFinal,
    "ordenarRutas"
);

/* =========================
 * RESUMEN GENERAL
 * ========================= */
$totalCantidadGeneral = 0;
$totalPacGeneral = 0;
$totalUndGeneral = 0;

foreach ($rutasFinal as $rutaItem) {
    $totalCantidadGeneral +=
        (float)$rutaItem["totalRuta"];

    $totalPacGeneral +=
        (float)$rutaItem["totalPac"];

    $totalUndGeneral +=
        (float)$rutaItem["totalUnd"];
}

$mysqli->close();

/* =========================
 * RESPUESTA
 *
 * Misma estructura exacta
 * del primer servicio.
 * ========================= */
jexit(200, [
    "rpta" => "si",
    "mensaje" => "Informe generado correctamente",
    "data" => [
        "despacho" => $despachoInfo,
        "tipo" => $tipo,

        "categoria" => $tipo === "POR_CATEGORIA"
            ? $categoria
            : "",

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