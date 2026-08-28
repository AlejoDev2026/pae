<?php
/* HOTFIX NOMBRES DE HOJAS EXCEL - 2026-07-26 */
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Cache-Control, Pragma, Expires, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

require_once __DIR__ . "/../conexion.php";

function responderError($mensaje, $extra = [], $codigoHttp = 500)
{
    if (!headers_sent()) header("Content-Type: application/json; charset=utf-8");
    http_response_code($codigoHttp);
    echo json_encode(array_merge([
        "rpta" => "no",
        "mensaje" => $mensaje,
        "data" => []
    ], $extra), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

if (!isset($conexion) || !$conexion instanceof mysqli) {
    responderError("No se encontró la conexión a la base de datos");
}
$conexion->set_charset("utf8mb4");

function limpiarTexto($valor) { return trim((string)($valor ?? "")); }
function parametro($nombre, $default = "") { return $_GET[$nombre] ?? $default; }
function esc($valor) { global $conexion; return $conexion->real_escape_string((string)($valor ?? "")); }
function obtenerFila($sql) {
    global $conexion;
    $r = $conexion->query($sql);
    if (!$r) throw new Exception($conexion->error);
    return $r->fetch_assoc() ?: null;
}
function obtenerFilas($sql) {
    global $conexion;
    $r = $conexion->query($sql);
    if (!$r) throw new Exception($conexion->error);
    $data = [];
    while ($f = $r->fetch_assoc()) $data[] = $f;
    return $data;
}
function validarUsuarioAdministrativo($idUsuario) {
    if ($idUsuario <= 0) responderError("Debe indicar el usuario administrativo", [], 400);
    $u = obtenerFila("SELECT id, nombre, rol, estado FROM usuarios WHERE id = $idUsuario LIMIT 1");
    if (!$u || intval($u["estado"]) !== 1) responderError("El usuario administrativo no existe o está inactivo", [], 403);
    if (defined("INVENTARIO_ROLES_ADMIN_CONTEOS")) {
        $config = constant("INVENTARIO_ROLES_ADMIN_CONTEOS");
        $roles = is_array($config) ? $config : explode(",", (string)$config);
        $roles = array_values(array_filter(array_map("intval", $roles), function ($id) { return $id > 0; }));
        if (count($roles) > 0 && !in_array(intval($u["rol"]), $roles, true)) {
            responderError("El usuario no tiene permisos administrativos para exportar conteos físicos", [], 403);
        }
    }
    return $u;
}
function xml($valor) {
    $valor = (string)($valor ?? "");
    $valor = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $valor);
    return htmlspecialchars($valor, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}
function letraColumna($numero) {
    $resultado = '';
    while ($numero > 0) {
        $numero--;
        $resultado = chr(65 + ($numero % 26)) . $resultado;
        $numero = intdiv($numero, 26);
    }
    return $resultado;
}
function textoHojaSubstr($texto, $inicio, $longitud)
{
    if (function_exists("mb_substr")) {
        return mb_substr(
            $texto,
            $inicio,
            $longitud,
            "UTF-8"
        );
    }

    return substr($texto, $inicio, $longitud);
}

function textoHojaLongitud($texto)
{
    if (function_exists("mb_strlen")) {
        return mb_strlen($texto, "UTF-8");
    }

    return strlen($texto);
}

function textoHojaMinuscula($texto)
{
    if (function_exists("mb_strtolower")) {
        return mb_strtolower($texto, "UTF-8");
    }

    return strtolower($texto);
}

function nombreHojaSeguro($nombre, &$usados)
{
    /*
     * Excel no permite estos caracteres en nombres de hojas:
     * \ / ? * [ ] :
     *
     * Se utiliza str_replace en vez de una expresión regular
     * para evitar que preg_replace devuelva NULL por un patrón
     * inválido en versiones antiguas de PHP/PCRE.
     */
    $nombre = limpiarTexto($nombre);

    $nombre = str_replace(
        ["\\", "/", "?", "*", "[", "]", ":"],
        " ",
        $nombre
    );

    $nombreNormalizado = preg_replace(
        "/\s+/u",
        " ",
        $nombre
    );

    if ($nombreNormalizado !== null) {
        $nombre = $nombreNormalizado;
    }

    $nombre = trim($nombre, " '");

    if ($nombre === "") {
        $nombre = "Hoja";
    }

    $base = textoHojaSubstr(
        $nombre,
        0,
        31
    );

    $candidato = $base;
    $indice = 2;

    while (
        isset(
            $usados[
                textoHojaMinuscula($candidato)
            ]
        )
    ) {
        $sufijo = " " . $indice;

        $longitudDisponible =
            31 - textoHojaLongitud($sufijo);

        $candidato =
            textoHojaSubstr(
                $base,
                0,
                $longitudDisponible
            )
            . $sufijo;

        $indice++;
    }

    $usados[
        textoHojaMinuscula($candidato)
    ] = true;

    return $candidato;
}
function celda($valor, $tipo = 's', $estilo = 0) {
    return ['v' => $valor, 't' => $tipo, 's' => $estilo];
}
function filaDatos($valores, $columnasNumericas = []) {
    $fila = [];
    foreach ($valores as $i => $valor) {
        if (in_array($i, $columnasNumericas, true)) {
            $fila[] = celda($valor === null || $valor === '' ? 0 : floatval($valor), 'n', 2);
        } else {
            $fila[] = celda($valor ?? '', 's', 0);
        }
    }
    return $fila;
}
function construirHojaXml($filas, $anchos, $headerRow, $merges = []) {
    $maxCols = 1;
    foreach ($filas as $fila) $maxCols = max($maxCols, count($fila));
    $maxRows = max(1, count($filas));
    $dimension = 'A1:' . letraColumna($maxCols) . $maxRows;

    $colsXml = '';
    foreach ($anchos as $i => $ancho) {
        $n = $i + 1;
        $colsXml .= '<col min="' . $n . '" max="' . $n . '" width="' . floatval($ancho) . '" customWidth="1"/>';
    }

    $sheetData = '';
    foreach ($filas as $r => $fila) {
        $rowNum = $r + 1;
        $altura = $rowNum === 1 ? ' ht="24" customHeight="1"' : ($rowNum === $headerRow ? ' ht="30" customHeight="1"' : '');
        $sheetData .= '<row r="' . $rowNum . '"' . $altura . '>';
        foreach ($fila as $c => $item) {
            if (!is_array($item) || !array_key_exists('v', $item)) $item = celda($item);
            $ref = letraColumna($c + 1) . $rowNum;
            $estilo = intval($item['s'] ?? 0);
            $tipo = $item['t'] ?? 's';
            $valor = $item['v'] ?? '';
            if ($tipo === 'n' && is_numeric($valor)) {
                $sheetData .= '<c r="' . $ref . '" s="' . $estilo . '" t="n"><v>' . xml(number_format(floatval($valor), 3, '.', '')) . '</v></c>';
            } else {
                $sheetData .= '<c r="' . $ref . '" s="' . $estilo . '" t="inlineStr"><is><t xml:space="preserve">' . xml($valor) . '</t></is></c>';
            }
        }
        $sheetData .= '</row>';
    }

    $mergeXml = '';
    if (count($merges) > 0) {
        $mergeXml = '<mergeCells count="' . count($merges) . '">';
        foreach ($merges as $merge) $mergeXml .= '<mergeCell ref="' . xml($merge) . '"/>';
        $mergeXml .= '</mergeCells>';
    }

    $autoFilter = $headerRow > 0 && $maxRows >= $headerRow
        ? '<autoFilter ref="A' . $headerRow . ':' . letraColumna($maxCols) . $maxRows . '"/>'
        : '';
    $pane = $headerRow > 0
        ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="' . $headerRow . '" topLeftCell="A' . ($headerRow + 1) . '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
        : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        . '<dimension ref="' . $dimension . '"/>'
        . $pane
        . '<sheetFormatPr defaultRowHeight="18"/>'
        . '<cols>' . $colsXml . '</cols>'
        . '<sheetData>' . $sheetData . '</sheetData>'
        . $autoFilter
        . $mergeXml
        . '<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>'
        . '</worksheet>';
}
function filasBase($titulo, $orden, $headers) {
    $totalCols = count($headers);
    return [
        [celda($titulo, 's', 4)],
        [celda('Orden: ' . $orden['codigo'] . ' - ' . $orden['nombre'], 's', 3)],
        [celda('Fecha de corte: ' . $orden['fechaCorte'] . ' | Estado: ' . $orden['estadoProceso'], 's', 3)],
        [celda('Generado: ' . date('Y-m-d H:i:s'), 's', 3)],
        [],
        array_map(function ($h) { return celda($h, 's', 1); }, $headers)
    ];
}

try {
    if ($_SERVER["REQUEST_METHOD"] !== "GET") responderError("Método no permitido. Debe utilizar GET", [], 405);
    if (!class_exists('ZipArchive')) responderError("El servidor no tiene habilitada la extensión ZipArchive necesaria para generar Excel", [], 500);

    $idOrdenConteo = intval(parametro('idOrdenConteo', parametro('id', 0)));
    $idUsuario = intval(parametro('idUsuario', parametro('idUsuarioAdministrador', 0)));
    if ($idOrdenConteo <= 0) responderError("Debe indicar la orden de conteo", [], 400);
    validarUsuarioAdministrativo($idUsuario);

    $orden = obtenerFila("
        SELECT id, codigo, nombre, descripcion, fechaCorte, fechaInicio, fechaLimite, tipoConteo, estadoProceso,
               fechaInicioAnalisis, fechaFinalizacionAnalisis, fechaPublicacionResultados
        FROM InventarioOrdenesConteo
        WHERE id = $idOrdenConteo
        LIMIT 1
    ");
    if (!$orden) responderError("La orden de conteo no existe", [], 404);
    if (!in_array($orden['estadoProceso'], ['EN_ANALISIS', 'FINALIZADA'], true)) {
        responderError("La exportación administrativa está disponible cuando la orden se encuentra EN_ANALISIS o FINALIZADA", ['estadoProceso' => $orden['estadoProceso']], 409);
    }

    $detalles = obtenerFilas("
        SELECT
            d.id, d.idSolicitudConteo, d.idProducto, d.idLote, d.idBodega, d.idUbicacion,
            d.cantidadDisponibleSistema, d.cantidadReservadaSistema, d.cantidadBloqueadaSistema,
            d.cantidadSistema, d.cantidadTotalSistema, d.cantidadFisica, d.diferencia,
            d.conteoRealizado, d.fechaConteo, d.tipoDiferencia, d.estadoAnalisis,
            d.observacion, d.observacionAnalisis,
            p.codigo AS codigoProducto, p.descripcion AS producto,
            COALESCE(pic.unidadBaseInventario, 'UND') AS unidad,
            l.lote, l.fechaVencimiento,
            b.codigo AS codigoBodega, b.nombre AS bodega,
            u.codigo AS codigoUbicacion, u.nombre AS ubicacion,
            s.codigo AS codigoConteoBodega, s.estadoProceso AS estadoConteoBodega,
            COALESCE(NULLIF(op.nombreCompleto, ''), TRIM(CONCAT(COALESCE(op.nombre, ''), ' ', COALESCE(op.apellido, '')))) AS responsableConteo
        FROM InventarioConteoDetalle d
        INNER JOIN InventarioSolicitudesConteo s ON s.id = d.idSolicitudConteo
        INNER JOIN ProductosCatalogo p ON p.id = d.idProducto
        INNER JOIN BodegasInventario b ON b.id = d.idBodega
        LEFT JOIN ProductosInventarioConfig pic ON pic.idProducto = p.id AND pic.estado = 1
        LEFT JOIN InventarioLotes l ON l.id = d.idLote
        LEFT JOIN UbicacionesInventario u ON u.id = d.idUbicacion
        LEFT JOIN InventarioOperadores op ON op.id = d.idOperadorCuenta
        WHERE s.idOrdenConteo = $idOrdenConteo
        ORDER BY b.nombre, COALESCE(u.nombre, 'SIN UBICACIÓN'), p.descripcion, COALESCE(l.lote, '')
    ");

    $avance = obtenerFilas("
        SELECT
            s.id AS idSolicitudConteo, s.codigo, s.estadoProceso, s.fechaInicioConteo,
            s.fechaUltimoGuardado, s.fechaEnvio, s.fechaRevision, s.fechaFinalizacion,
            s.numeroRevision, s.observacionRevision,
            b.codigo AS codigoBodega, b.nombre AS bodega,
            COALESCE(NULLIF(op.nombreCompleto, ''), TRIM(CONCAT(COALESCE(op.nombre, ''), ' ', COALESCE(op.apellido, '')))) AS responsablePrincipal,
            COUNT(d.id) AS totalDetalles,
            SUM(CASE WHEN d.conteoRealizado = 1 THEN 1 ELSE 0 END) AS totalContados,
            SUM(CASE WHEN d.conteoRealizado = 0 THEN 1 ELSE 0 END) AS totalPendientes,
            SUM(CASE WHEN d.conteoRealizado = 1 AND ABS(d.diferencia) >= 0.0005 THEN 1 ELSE 0 END) AS totalDiferencias,
            ROUND(COALESCE(SUM(d.cantidadSistema), 0), 3) AS cantidadSistema,
            ROUND(COALESCE(SUM(CASE WHEN d.conteoRealizado = 1 THEN d.cantidadFisica ELSE 0 END), 0), 3) AS cantidadFisica,
            ROUND(COALESCE(SUM(CASE WHEN d.conteoRealizado = 1 THEN d.diferencia ELSE 0 END), 0), 3) AS diferencia
        FROM InventarioSolicitudesConteo s
        INNER JOIN BodegasInventario b ON b.id = s.idBodega
        LEFT JOIN InventarioOperadores op ON op.id = COALESCE(s.idOperador, s.idOperadorAsignado)
        LEFT JOIN InventarioConteoDetalle d ON d.idSolicitudConteo = s.id
        WHERE s.idOrdenConteo = $idOrdenConteo
        GROUP BY s.id, b.id, op.id
        ORDER BY b.nombre
    ");

    $consolidado = obtenerFilas("
        SELECT
            d.idProducto, p.codigo AS codigoProducto, p.descripcion AS producto,
            COALESCE(pic.unidadBaseInventario, 'UND') AS unidad,
            COUNT(DISTINCT d.idBodega) AS totalBodegas,
            COUNT(DISTINCT d.idLote) AS totalLotes,
            ROUND(SUM(COALESCE(d.cantidadDisponibleSistema, 0)), 3) AS disponibleSistema,
            ROUND(SUM(COALESCE(d.cantidadReservadaSistema, 0)), 3) AS reservadaSistema,
            ROUND(SUM(COALESCE(d.cantidadBloqueadaSistema, 0)), 3) AS bloqueadaSistema,
            ROUND(SUM(d.cantidadSistema), 3) AS cantidadSistema,
            ROUND(SUM(CASE WHEN d.conteoRealizado = 1 THEN d.cantidadFisica ELSE 0 END), 3) AS cantidadFisica,
            ROUND(SUM(CASE WHEN d.conteoRealizado = 1 THEN d.diferencia ELSE 0 END), 3) AS diferencia,
            SUM(CASE WHEN d.conteoRealizado = 1 AND ABS(d.diferencia) >= 0.0005 THEN 1 ELSE 0 END) AS registrosConDiferencia
        FROM InventarioConteoDetalle d
        INNER JOIN InventarioSolicitudesConteo s ON s.id = d.idSolicitudConteo
        INNER JOIN ProductosCatalogo p ON p.id = d.idProducto
        LEFT JOIN ProductosInventarioConfig pic ON pic.idProducto = p.id AND pic.estado = 1
        WHERE s.idOrdenConteo = $idOrdenConteo
        GROUP BY d.idProducto, p.codigo, p.descripcion, pic.unidadBaseInventario
        ORDER BY p.descripcion
    ");

    $sheets = [];
    $usados = [];

    $headersCompleto = ['Código producto','Producto','Lote','Fecha vencimiento','Código bodega','Bodega','Código ubicación','Ubicación','Unidad','Disponible sistema','Reservada sistema','Bloqueada sistema','Total teórico','Cantidad física','Diferencia','Resultado','Estado análisis','Observación conteo','Observación análisis','Responsable conteo','Fecha conteo','Estado bodega'];
    $rowsCompleto = filasBase('INVENTARIO COMPLETO Y ANÁLISIS DE DIFERENCIAS', $orden, $headersCompleto);
    foreach ($detalles as $d) {
        $diferencia = round(floatval($d['diferencia'] ?? 0), 3);
        $resultado = intval($d['conteoRealizado']) !== 1 ? 'PENDIENTE' : (abs($diferencia) < 0.0005 ? 'SIN DIFERENCIA' : ($diferencia > 0 ? 'SOBRANTE' : 'FALTANTE'));
        $rowsCompleto[] = filaDatos([
            $d['codigoProducto'], $d['producto'], $d['lote'], $d['fechaVencimiento'],
            $d['codigoBodega'], $d['bodega'], $d['codigoUbicacion'], $d['ubicacion'], $d['unidad'],
            $d['cantidadDisponibleSistema'], $d['cantidadReservadaSistema'], $d['cantidadBloqueadaSistema'],
            $d['cantidadSistema'], intval($d['conteoRealizado']) === 1 ? $d['cantidadFisica'] : 0,
            intval($d['conteoRealizado']) === 1 ? $d['diferencia'] : 0,
            $resultado, $d['estadoAnalisis'], $d['observacion'], $d['observacionAnalisis'],
            $d['responsableConteo'], $d['fechaConteo'], $d['estadoConteoBodega']
        ], [9,10,11,12,13,14]);
    }
    $sheets[] = ['name' => nombreHojaSeguro('Inventario completo', $usados), 'rows' => $rowsCompleto, 'widths' => [16,36,18,17,16,25,17,25,10,16,16,16,16,16,14,18,18,35,35,25,19,17], 'header' => 6, 'merges' => ['A1:V1','A2:V2','A3:V3','A4:V4']];

    $headersConsolidado = ['Código producto','Producto','Unidad','Bodegas','Lotes','Disponible sistema','Reservada sistema','Bloqueada sistema','Total teórico','Cantidad física','Diferencia','Resultado','Registros con diferencia'];
    $rowsConsolidado = filasBase('CONSOLIDADO GENERAL POR PRODUCTO', $orden, $headersConsolidado);
    foreach ($consolidado as $c) {
        $dif = round(floatval($c['diferencia'] ?? 0), 3);
        $resultado = abs($dif) < 0.0005 ? 'SIN DIFERENCIA' : ($dif > 0 ? 'SOBRANTE' : 'FALTANTE');
        $rowsConsolidado[] = filaDatos([
            $c['codigoProducto'], $c['producto'], $c['unidad'], intval($c['totalBodegas']), intval($c['totalLotes']),
            $c['disponibleSistema'], $c['reservadaSistema'], $c['bloqueadaSistema'], $c['cantidadSistema'],
            $c['cantidadFisica'], $c['diferencia'], $resultado, intval($c['registrosConDiferencia'])
        ], [3,4,5,6,7,8,9,10,12]);
    }
    $sheets[] = ['name' => nombreHojaSeguro('Consolidado', $usados), 'rows' => $rowsConsolidado, 'widths' => [16,40,10,12,10,16,16,16,16,16,14,18,20], 'header' => 6, 'merges' => ['A1:M1','A2:M2','A3:M3','A4:M4']];

    $headersAvance = ['Código bodega','Bodega','Responsable','Estado','Productos','Contados','Pendientes','Avance %','Con diferencias','Total teórico','Cantidad física','Diferencia','Revisiones','Inicio','Último guardado','Envío','Revisión','Finalización','Observación revisión'];
    $rowsAvance = filasBase('AVANCE Y ESTADO POR BODEGA', $orden, $headersAvance);
    foreach ($avance as $a) {
        $total = intval($a['totalDetalles']);
        $contados = intval($a['totalContados']);
        $porcentaje = $total > 0 ? round(($contados * 100) / $total, 2) : (in_array($a['estadoProceso'], ['ENVIADO','APROBADO','FINALIZADO'], true) ? 100 : 0);
        $rowsAvance[] = filaDatos([
            $a['codigoBodega'], $a['bodega'], $a['responsablePrincipal'], $a['estadoProceso'],
            $total, $contados, intval($a['totalPendientes']), $porcentaje, intval($a['totalDiferencias']),
            $a['cantidadSistema'], $a['cantidadFisica'], $a['diferencia'], intval($a['numeroRevision']),
            $a['fechaInicioConteo'], $a['fechaUltimoGuardado'], $a['fechaEnvio'], $a['fechaRevision'], $a['fechaFinalizacion'], $a['observacionRevision']
        ], [4,5,6,7,8,9,10,11,12]);
    }
    $sheets[] = ['name' => nombreHojaSeguro('Avance por bodega', $usados), 'rows' => $rowsAvance, 'widths' => [16,28,25,16,12,12,12,12,16,16,16,14,12,19,19,19,19,19,35], 'header' => 6, 'merges' => ['A1:S1','A2:S2','A3:S3','A4:S4']];

    $porBodega = [];
    foreach ($detalles as $d) $porBodega[$d['bodega']][] = $d;
    foreach ($porBodega as $nombreBodega => $items) {
        $rows = filasBase('DETALLE DE BODEGA: ' . $nombreBodega, $orden, $headersCompleto);
        foreach ($items as $d) {
            $dif = round(floatval($d['diferencia'] ?? 0), 3);
            $resultado = intval($d['conteoRealizado']) !== 1 ? 'PENDIENTE' : (abs($dif) < 0.0005 ? 'SIN DIFERENCIA' : ($dif > 0 ? 'SOBRANTE' : 'FALTANTE'));
            $rows[] = filaDatos([
                $d['codigoProducto'], $d['producto'], $d['lote'], $d['fechaVencimiento'],
                $d['codigoBodega'], $d['bodega'], $d['codigoUbicacion'], $d['ubicacion'], $d['unidad'],
                $d['cantidadDisponibleSistema'], $d['cantidadReservadaSistema'], $d['cantidadBloqueadaSistema'],
                $d['cantidadSistema'], intval($d['conteoRealizado']) === 1 ? $d['cantidadFisica'] : 0,
                intval($d['conteoRealizado']) === 1 ? $d['diferencia'] : 0,
                $resultado, $d['estadoAnalisis'], $d['observacion'], $d['observacionAnalisis'],
                $d['responsableConteo'], $d['fechaConteo'], $d['estadoConteoBodega']
            ], [9,10,11,12,13,14]);
        }
        $sheets[] = ['name' => nombreHojaSeguro($nombreBodega, $usados), 'rows' => $rows, 'widths' => [16,36,18,17,16,25,17,25,10,16,16,16,16,16,14,18,18,35,35,25,19,17], 'header' => 6, 'merges' => ['A1:V1','A2:V2','A3:V3','A4:V4']];
    }

    $tmp = tempnam(sys_get_temp_dir(), 'conteo_xlsx_');
    if ($tmp === false) throw new Exception('No fue posible crear el archivo temporal');
    $zip = new ZipArchive();
    if ($zip->open($tmp, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) throw new Exception('No fue posible crear el archivo Excel');

    $contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        . '<Default Extension="xml" ContentType="application/xml"/>'
        . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
        . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
        . '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        . '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>';
    foreach ($sheets as $i => $sheet) $contentTypes .= '<Override PartName="/xl/worksheets/sheet' . ($i + 1) . '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    $contentTypes .= '</Types>';
    $zip->addFromString('[Content_Types].xml', $contentTypes);

    $zip->addFromString('_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>');

    $sheetsXml = '';
    $relsXml = '';
    foreach ($sheets as $i => $sheet) {
        $n = $i + 1;
        $sheetsXml .= '<sheet name="' . xml($sheet['name']) . '" sheetId="' . $n . '" r:id="rId' . $n . '"/>';
        $relsXml .= '<Relationship Id="rId' . $n . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' . $n . '.xml"/>';
        $zip->addFromString('xl/worksheets/sheet' . $n . '.xml', construirHojaXml($sheet['rows'], $sheet['widths'], $sheet['header'], $sheet['merges']));
    }
    $styleRid = count($sheets) + 1;
    $relsXml .= '<Relationship Id="rId' . $styleRid . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';

    $zip->addFromString('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>' . $sheetsXml . '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>');
    $zip->addFromString('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' . $relsXml . '</Relationships>');

    $styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        . '<numFmts count="1"><numFmt numFmtId="164" formatCode="0.000"/></numFmts>'
        . '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="15"/><name val="Calibri"/></font></fonts>'
        . '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1E293B"/><bgColor indexed="64"/></patternFill></fill></fills>'
        . '<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border></borders>'
        . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
        . '<cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"><alignment horizontal="right"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf></cellXfs>'
        . '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
    $zip->addFromString('xl/styles.xml', $styles);

    $nowIso = gmdate('Y-m-d\TH:i:s\Z');
    $zip->addFromString('docProps/core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' . xml('Conteo físico ' . $orden['codigo']) . '</dc:title><dc:creator>PAE Inventarios</dc:creator><cp:lastModifiedBy>PAE Inventarios</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">' . $nowIso . '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' . $nowIso . '</dcterms:modified></cp:coreProperties>');
    $zip->addFromString('docProps/app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>PAE Inventarios</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><Company>Acción por Colombia</Company><AppVersion>1.0</AppVersion></Properties>');
    $zip->close();

    $nombreSeguro = preg_replace('/[^A-Za-z0-9_-]+/', '_', $orden['codigo']);
    $nombreArchivo = 'Conteo_Fisico_' . $nombreSeguro . '_' . date('Ymd_His') . '.xlsx';

    header_remove('Content-Type');
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $nombreArchivo . '"; filename*=UTF-8\'\'' . rawurlencode($nombreArchivo));
    header('Content-Length: ' . filesize($tmp));
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    header('Pragma: no-cache');
    readfile($tmp);
    @unlink($tmp);
    exit;
} catch (Throwable $e) {
    if (isset($tmp) && is_string($tmp) && file_exists($tmp)) @unlink($tmp);
    responderError('Error generando la exportación administrativa', ['error' => $e->getMessage()], 500);
}
?>