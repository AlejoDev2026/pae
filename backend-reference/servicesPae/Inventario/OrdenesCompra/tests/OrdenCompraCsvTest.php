<?php
require_once __DIR__ . '/../OrdenCompraCsv.php';
set_error_handler(function ($nivel, $mensaje, $archivo, $linea) {
    throw new ErrorException($mensaje, 0, $nivel, $archivo, $linea);
});

function comprobar($condicion, $mensaje)
{
    if (!$condicion) throw new RuntimeException($mensaje);
}
function rechazar($contenido, $mensaje)
{
    try { ocLeerCsv($contenido); } catch (InvalidArgumentException $e) { return; }
    throw new RuntimeException($mensaje);
}

$cabecera = "EMPRESA DE PRUEBA;;;;;;;;;;;;;;;;;;FECHA Y HORA DE IMPRESIÓN 27/07/2026 9:38:23 a. m.\n"
    . "PAGINA: 1 de 1\nNit. 900000000-1\nCL 18 2 31\nORDEN DE COMPRA O1 No.;;;;17913\n"
    . "PROVEEDOR;;;;PROVEEDOR DE PRUEBA;;;;ESTADO;;;PARCIAL\nNIT;;;;890000000\nFECHA;;;22/07/2026\n"
    . "TELEFONO;;;4455555\nCIUDAD;;;;MEDELLÍN;;;;VENCIMIENTO;;;24/07/2026\n";
$encabezado = 'ITEM;;;UBI;;;DESCRIPCION;;COSTO;;PESO;;;;;;CANTIDAD;;;;;;;;;VR.UNITARIO;;;;;VR.TOTAL';
$linea = 'F111020;;3;;BEBIDA LECHE UHT;4,611.18;0;;;;;4;;;;;;;;4,325.00;;;;17,300.00;;;';
function cierre($subtotal) {
    return "\nSUBTOTAL;;;;$subtotal\nNota Orden de Compra: INGRESO JAMUNDI\nDESCUENTO;;;;0.00\nSUBTOTAL - DCT;;;;$subtotal\n"
        . "IVA;;;;0.00\nRETEFUENTE;;;;0.00\nRETEICA;;;;0.00\nRETEIVA;;;;0.00\nRETECREE;;;;0.00\nTOTAL;;;;$subtotal\n";
}
$csv = $cabecera . $encabezado . "\n" . $linea . cierre('17,300.00');
$orden = ocLeerCsv($csv);
comprobar(ocTexto('FUNDACION ACCION POR COLOMBIA', 255, 'empresa') === 'FUNDACION ACCION POR COLOMBIA', 'Debe aceptar la empresa del archivo original.');
foreach (['' => 'No se encontró el nombre de la empresa', str_repeat('A', 256) => '256 caracteres'] as $texto => $esperado) {
    try {
        ocTexto($texto, 255, 'empresa');
        throw new RuntimeException('Debe rechazar la empresa inválida.');
    } catch (InvalidArgumentException $e) {
        comprobar(strpos($e->getMessage(), $esperado) !== false, 'Debe distinguir empresa ausente de longitud excesiva.');
    }
}
comprobar(count($orden['productos']) === 1, 'Debe leer un producto.');
comprobar($orden['productos'][0]['costo'] === '4611.18', 'Debe conservar el costo independiente.');
comprobar($orden['productos'][0]['peso'] === '0.000', 'No debe descartar los ceros.');
comprobar($orden['fecha'] === '2026-07-22', 'Debe convertir fechas.');
comprobar(ocLeerCsv("\xEF\xBB\xBF" . $csv)['ciudad'] === 'MEDELLÍN', 'Debe soportar BOM UTF-8.');
comprobar(ocLeerCsv(iconv('UTF-8', 'Windows-1252', $csv))['ciudad'] === 'MEDELLÍN', 'Debe soportar Windows-1252.');
comprobar(ocLeerCsv(str_replace("\n", "\r\n", $csv))['numero'] === '17913', 'Debe soportar CRLF.');
$muchas = $cabecera . $encabezado . "\n";
for ($i = 0; $i < 300; $i++) {
    if ($i === 150) $muchas .= $cabecera . $encabezado . "\n";
    $muchas .= $linea . "\n";
}
$muchas .= cierre('5,190,000.00');
comprobar(count(ocLeerCsv($muchas)['productos']) === 300, 'Debe leer todos los productos y encabezados repetidos.');
$comillas = str_replace('BEBIDA LECHE UHT', '"LECHE; ENTERA"', $csv);
comprobar(ocLeerCsv($comillas)['productos'][0]['descripcion'] === 'LECHE; ENTERA', 'Debe respetar separadores entre comillas.');
$barra = str_replace('BEBIDA LECHE UHT', '"LECHE ' . chr(92) . '"', $csv);
comprobar(ocLeerCsv($barra)['productos'][0]['descripcion'] === 'LECHE ' . chr(92), 'Debe conservar la barra antes de una comilla de cierre en PHP 7.3 y 8.3.');
$dobles = str_replace('BEBIDA LECHE UHT', '"LECHE ""ENTERA"""', $csv);
comprobar(ocLeerCsv($dobles)['productos'][0]['descripcion'] === 'LECHE "ENTERA"', 'Debe leer comillas duplicadas.');
rechazar(str_replace('4,611.18', '', $csv), 'Debe rechazar campos faltantes.');
rechazar(str_replace('22/07/2026', '31/02/2026', $csv), 'Debe rechazar fechas imposibles.');
rechazar(str_replace('4,611.18', '4.611,18', $csv), 'Debe rechazar números de otro formato.');
rechazar(str_replace(';;;;;4;;;;;;;;', ';;;;;0;;;;;;;;', $csv), 'Debe rechazar cantidad cero.');
rechazar($cabecera . $encabezado . cierre('0.00'), 'Debe rechazar una orden sin productos.');
rechazar($cabecera . $encabezado . "\n" . $linea . cierre('34,600.00'), 'Debe detectar productos faltantes por subtotal.');
rechazar($csv . "ORDEN DE COMPRA O1 No.;;;;99999\n", 'Debe rechazar dos órdenes distintas.');
rechazar($csv . "CONTENIDO DESCONOCIDO\n", 'No debe omitir contenido desconocido.');
if (isset($argv[1])) {
    $real = ocLeerCsv(file_get_contents($argv[1]));
    comprobar($real['numero'] === '17913' && count($real['productos']) === 2, 'Debe leer la orden real.');
    comprobar($real['total'] === '205524.00', 'Debe conservar el total del archivo real.');
    comprobar(array_sum(array_column($real['productos'], 'cantidad')) === 48.0, 'Debe leer las 48 unidades reales.');
}
echo "OK: lector CSV, 300 productos, encabezados repetidos, codificaciones y rechazos.\n";
