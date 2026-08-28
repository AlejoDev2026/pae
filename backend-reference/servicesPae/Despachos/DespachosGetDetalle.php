<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

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
    http_response_code($code);
    echo json_encode($arr, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

function getParam($key, $default = "") {
    return isset($_GET[$key]) ? trim((string)$_GET[$key]) : $default;
}

/* =========================
   DB
========================= */
$mysqli = new mysqli("localhost", "accionpo_pae", "o#Ao0?ZEEec0s).i", "accionpo_pae");
if ($mysqli->connect_errno) {
    jexit(500, [
        "rpta" => "no",
        "mensaje" => "Error de conexión a la base de datos",
        "error" => $mysqli->connect_error
    ]);
}
$mysqli->set_charset("utf8mb4");

/* =========================
   Validar método
========================= */
if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    jexit(405, [
        "rpta" => "no",
        "mensaje" => "Método no permitido"
    ]);
}

/* =========================
   Params
========================= */
$idDespacho = (int)getParam("idDespacho", "0");

if ($idDespacho <= 0) {
    jexit(400, [
        "rpta" => "no",
        "mensaje" => "El idDespacho es obligatorio"
    ]);
}

/* =========================
   1. Cabecera del despacho
========================= */
$sqlDespacho = "
    SELECT
        d.id,
        d.idJornada,
        d.codigo,
        d.fechaDespacho,
        d.fechaConsumoDesde,
        d.fechaConsumoHasta,
        d.contrato,
        d.tipoPeriodo,
        d.descripcion,
        d.idEstado,
        d.created_at,
        d.updated_at,

        e.codigo AS estado_codigo,
        e.nombre AS estado_nombre,
        e.descripcion AS estado_descripcion,
        e.estado AS estado_activo

    FROM DespachosInforme d
    LEFT JOIN Estados e ON e.id = d.idEstado
    WHERE d.id = ?
    LIMIT 1
";

$st = $mysqli->prepare($sqlDespacho);
if (!$st) {
    jexit(500, [
        "rpta" => "no",
        "mensaje" => "Error prepare despacho",
        "error" => $mysqli->error
    ]);
}

$st->bind_param("i", $idDespacho);

if (!$st->execute()) {
    jexit(500, [
        "rpta" => "no",
        "mensaje" => "Error execute despacho",
        "error" => $st->error
    ]);
}

$st->store_result();
$st->bind_result(
    $despacho_id,
    $despacho_idJornada,
    $despacho_codigo,
    $despacho_fechaDespacho,
    $despacho_fechaConsumoDesde,
    $despacho_fechaConsumoHasta,
    $despacho_contrato,
    $despacho_tipoPeriodo,
    $despacho_descripcion,
    $despacho_idEstado,
    $despacho_created_at,
    $despacho_updated_at,
    $despacho_estado_codigo,
    $despacho_estado_nombre,
    $despacho_estado_descripcion,
    $despacho_estado_activo
);

$despacho = null;
if ($st->fetch()) {
    $despacho = [
        "id" => $despacho_id,
        "idJornada" => $despacho_idJornada,
        "codigo" => $despacho_codigo,
        "fechaDespacho" => $despacho_fechaDespacho,
        "fechaConsumoDesde" => $despacho_fechaConsumoDesde,
        "fechaConsumoHasta" => $despacho_fechaConsumoHasta,
        "contrato" => $despacho_contrato,
        "tipoPeriodo" => $despacho_tipoPeriodo,
        "descripcion" => $despacho_descripcion,
        "idEstado" => $despacho_idEstado,
        "created_at" => $despacho_created_at,
        "updated_at" => $despacho_updated_at,
        "estado_codigo" => $despacho_estado_codigo,
        "estado_nombre" => $despacho_estado_nombre,
        "estado_descripcion" => $despacho_estado_descripcion,
        "estado_activo" => $despacho_estado_activo
    ];
}
$st->close();

if (!$despacho) {
    jexit(404, [
        "rpta" => "no",
        "mensaje" => "El despacho no existe"
    ]);
}

/* =========================
   2. Archivos del despacho
========================= */
$sqlArchivos = "
    SELECT
        da.id,
        da.idDespacho,
        da.tipoArchivo,
        da.nombreArchivo,
        da.hashArchivo,
        da.hojasDetectadas,
        da.rutasDetectadas,
        da.idEstado,
        da.mensajeError
    FROM DespachoArchivos da
    WHERE da.idDespacho = ?
    ORDER BY
        CASE da.tipoArchivo
            WHEN 'AM' THEN 1
            WHEN 'PM' THEN 2
            WHEN 'JORNADA_UNICA' THEN 3
            ELSE 99
        END,
        da.id ASC
";

$st = $mysqli->prepare($sqlArchivos);
if (!$st) {
    jexit(500, [
        "rpta" => "no",
        "mensaje" => "Error prepare archivos",
        "error" => $mysqli->error
    ]);
}

$st->bind_param("i", $idDespacho);

if (!$st->execute()) {
    jexit(500, [
        "rpta" => "no",
        "mensaje" => "Error execute archivos",
        "error" => $st->error
    ]);
}

$st->store_result();
$st->bind_result(
    $archivo_id,
    $archivo_idDespacho,
    $archivo_tipoArchivo,
    $archivo_nombreArchivo,
    $archivo_hashArchivo,
    $archivo_hojasDetectadas,
    $archivo_rutasDetectadas,
    $archivo_idEstado,
    $archivo_mensajeError
);

$archivos = [];
$archivosMap = [];

while ($st->fetch()) {
    $archivoItem = [
        "idDespachoArchivo" => (int)$archivo_id,
        "idDespacho" => (int)$archivo_idDespacho,
        "tipoArchivo" => $archivo_tipoArchivo,
        "nombreArchivo" => $archivo_nombreArchivo,
        "hashArchivo" => $archivo_hashArchivo,
        "hojasDetectadas" => (int)($archivo_hojasDetectadas ?? 0),
        "rutasDetectadas" => (int)($archivo_rutasDetectadas ?? 0),
        "idEstado" => $archivo_idEstado !== null ? (int)$archivo_idEstado : null,
        "mensajeError" => $archivo_mensajeError,
        "rutas" => []
    ];

    $archivos[] = $archivoItem;
    $archivosMap[(int)$archivo_id] = count($archivos) - 1;
}
$st->close();

/* =========================
   3. Detalle completo del despacho
========================= */
$sqlDetalle = "
    SELECT
        drp.id AS idDetalle,
        drp.idDespacho,
        drp.idDespachoArchivo,
        drp.idRuta,
        drp.idColegio,
        drp.idProducto,
        drp.productoExcel,
        drp.unidadCoberturaExcel,
        drp.descripcionMostrada,
        drp.consecutivo,
        drp.cantidad,
        drp.totalCoberturaRuta,
        drp.cajasPacas,
        drp.unidades,
        drp.observacion,

        da.tipoArchivo,
        da.nombreArchivo,

        rd.nombreRuta,
        rd.idJornada,
        rd.ordenRuta,

        cd.codigo AS colegioCodigo,
        cd.nombre AS colegioNombre,

        pc.descripcion AS productoDescripcion,
        pc.idGrupo AS productoIdGrupo,

        gp.id AS grupoId,
        gp.codigo AS grupoCodigo,
        gp.idCategoria AS grupoIdCategoria,

        cp.id AS categoriaId,
        cp.nombre AS categoriaNombre

    FROM DetalleRutaProducto drp
    INNER JOIN DespachoArchivos da
        ON da.id = drp.idDespachoArchivo
    LEFT JOIN RutasDespacho rd
        ON rd.id = drp.idRuta
    LEFT JOIN ColegiosDespacho cd
        ON cd.id = drp.idColegio
    LEFT JOIN ProductosCatalogo pc
        ON pc.id = drp.idProducto
    LEFT JOIN GruposProducto gp
        ON gp.id = pc.idGrupo
    LEFT JOIN CategoriasProducto cp
        ON cp.id = gp.idCategoria
    WHERE drp.idDespacho = ?
    ORDER BY
        CASE da.tipoArchivo
            WHEN 'AM' THEN 1
            WHEN 'PM' THEN 2
            WHEN 'JORNADA_UNICA' THEN 3
            ELSE 99
        END,
        drp.idDespachoArchivo ASC,
        COALESCE(rd.nombreRuta, ''),
        COALESCE(drp.consecutivo, 0),
        COALESCE(cd.nombre, ''),
        COALESCE(drp.descripcionMostrada, drp.productoExcel, pc.descripcion, '')
";

$st = $mysqli->prepare($sqlDetalle);
if (!$st) {
    jexit(500, [
        "rpta" => "no",
        "mensaje" => "Error prepare detalle",
        "error" => $mysqli->error
    ]);
}

$st->bind_param("i", $idDespacho);

if (!$st->execute()) {
    jexit(500, [
        "rpta" => "no",
        "mensaje" => "Error execute detalle",
        "error" => $st->error
    ]);
}

$st->store_result();
$st->bind_result(
    $row_idDetalle,
    $row_idDespacho,
    $row_idDespachoArchivo,
    $row_idRuta,
    $row_idColegio,
    $row_idProducto,
    $row_productoExcel,
    $row_unidadCoberturaExcel,
    $row_descripcionMostrada,
    $row_consecutivo,
    $row_cantidad,
    $row_totalCoberturaRuta,
    $row_cajasPacas,
    $row_unidades,
    $row_observacion,
    $row_tipoArchivo,
    $row_nombreArchivo,
    $row_nombreRuta,
    $row_idJornada,
    $row_ordenRuta,
    $row_colegioCodigo,
    $row_colegioNombre,
    $row_productoDescripcion,
    $row_productoIdGrupo,
    $row_grupoId,
    $row_grupoCodigo,
    $row_grupoIdCategoria,
    $row_categoriaId,
    $row_categoriaNombre
);

while ($st->fetch()) {
    $idDespachoArchivo = (int)$row_idDespachoArchivo;
    $idRuta = $row_idRuta !== null ? (int)$row_idRuta : 0;

    if (!isset($archivosMap[$idDespachoArchivo])) {
        continue;
    }

    $idxArchivo = $archivosMap[$idDespachoArchivo];

    if (!isset($archivos[$idxArchivo]["rutasMap"])) {
        $archivos[$idxArchivo]["rutasMap"] = [];
    }

    if (!isset($archivos[$idxArchivo]["rutasMap"][$idRuta])) {
        $archivos[$idxArchivo]["rutasMap"][$idRuta] = [
            "idRuta" => $row_idRuta !== null ? (int)$row_idRuta : null,
            "idJornada" => $row_idJornada !== null ? (int)$row_idJornada : null,
            "nombreRuta" => $row_nombreRuta ?: "Sin ruta",
            "ordenRuta" => $row_ordenRuta !== null ? (int)$row_ordenRuta : null,
            "detalles" => []
        ];
    }

    $archivos[$idxArchivo]["rutasMap"][$idRuta]["detalles"][] = [
        "idDetalle" => (int)$row_idDetalle,
        "productoExcel" => $row_productoExcel,
        "unidadCoberturaExcel" => $row_unidadCoberturaExcel,
        "descripcionMostrada" => $row_descripcionMostrada,
        "consecutivo" => $row_consecutivo !== null ? (int)$row_consecutivo : null,
        "cantidad" => (float)($row_cantidad ?? 0),
        "totalCoberturaRuta" => (float)($row_totalCoberturaRuta ?? 0),
        "cajasPacas" => (float)($row_cajasPacas ?? 0),
        "unidades" => (float)($row_unidades ?? 0),
        "observacion" => $row_observacion,

        "colegio" => [
            "idColegio" => $row_idColegio !== null ? (int)$row_idColegio : null,
            "codigo" => $row_colegioCodigo,
            "nombre" => $row_colegioNombre
        ],

        "producto" => [
            "idProducto" => $row_idProducto !== null ? (int)$row_idProducto : null,
            "descripcion" => $row_productoDescripcion,
            "idGrupo" => $row_productoIdGrupo !== null ? (int)$row_productoIdGrupo : null,
            "grupo" => [
                "idGrupo" => $row_grupoId !== null ? (int)$row_grupoId : null,
                "codigo" => $row_grupoCodigo,
                "idCategoria" => $row_grupoIdCategoria !== null ? (int)$row_grupoIdCategoria : null
            ],
            "categoria" => [
                "idCategoria" => $row_categoriaId !== null ? (int)$row_categoriaId : null,
                "nombre" => $row_categoriaNombre
            ]
        ]
    ];
}
$st->close();

/* =========================
   4. Convertir rutasMap a rutas[]
========================= */
foreach ($archivos as &$archivo) {
    $rutasFinal = [];

    if (isset($archivo["rutasMap"]) && is_array($archivo["rutasMap"])) {
        foreach ($archivo["rutasMap"] as $rutaItem) {
            $rutasFinal[] = $rutaItem;
        }
    }

    usort($rutasFinal, function ($a, $b) {
        $aOrden = $a["ordenRuta"] ?? 999999;
        $bOrden = $b["ordenRuta"] ?? 999999;

        if ($aOrden === $bOrden) {
            return strcmp((string)$a["nombreRuta"], (string)$b["nombreRuta"]);
        }

        return $aOrden <=> $bOrden;
    });

    $archivo["rutas"] = $rutasFinal;
    unset($archivo["rutasMap"]);
}
unset($archivo);

/* =========================
   5. Agrupar por tipo
========================= */
$resultadoArchivos = [
    "AM" => [],
    "PM" => [],
    "JORNADA_UNICA" => []
];

foreach ($archivos as $archivo) {
    $tipo = $archivo["tipoArchivo"] ?? "";

    if (!isset($resultadoArchivos[$tipo])) {
        $resultadoArchivos[$tipo] = [];
    }

    $resultadoArchivos[$tipo][] = $archivo;
}

/* =========================
   6. Respuesta final
========================= */
jexit(200, [
    "rpta" => "si",
    "mensaje" => "Detalle del despacho consultado correctamente",
    "data" => [
        "despacho" => [
            "id" => (int)$despacho["id"],
            "idJornada" => $despacho["idJornada"] !== null ? (int)$despacho["idJornada"] : null,
            "codigo" => $despacho["codigo"],
            "fechaDespacho" => $despacho["fechaDespacho"],
            "fechaConsumoDesde" => $despacho["fechaConsumoDesde"],
            "fechaConsumoHasta" => $despacho["fechaConsumoHasta"],
            "contrato" => $despacho["contrato"],
            "tipoPeriodo" => $despacho["tipoPeriodo"],
            "descripcion" => $despacho["descripcion"],
            "estado" => [
                "idEstado" => $despacho["idEstado"] !== null ? (int)$despacho["idEstado"] : null,
                "codigo" => $despacho["estado_codigo"],
                "nombre" => $despacho["estado_nombre"],
                "descripcion" => $despacho["estado_descripcion"],
                "activo" => isset($despacho["estado_activo"]) ? (int)$despacho["estado_activo"] : null
            ],
            "fechas" => [
                "created_at" => $despacho["created_at"],
                "updated_at" => $despacho["updated_at"]
            ]
        ],
        "archivos" => $resultadoArchivos
    ]
]);