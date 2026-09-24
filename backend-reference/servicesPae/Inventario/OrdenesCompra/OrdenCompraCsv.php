<?php
// Lector puro: no abre conexiones ni ejecuta escrituras.
function ocTexto($texto, $maximo, $campo)
{
    $texto = trim($texto);
    if ($texto === '') {
        if ($campo === 'empresa') {
            throw new InvalidArgumentException('No se encontró el nombre de la empresa en el encabezado del CSV. Revisa que el archivo incluya el encabezado completo de la orden.');
        }
        throw new InvalidArgumentException("El campo $campo está vacío en el CSV.");
    }
    $longitud = preg_match_all('/./us', $texto);
    if ($longitud === false) {
        throw new InvalidArgumentException("No se pudo leer la codificación del campo $campo.");
    }
    if ($longitud > $maximo) {
        throw new InvalidArgumentException("El campo $campo contiene $longitud caracteres; el máximo permitido es $maximo. Revisa la separación de las celdas del CSV.");
    }
    return $texto;
}

function ocNumero($texto, $decimales, $campo)
{
    // El formato de origen usa coma de miles y punto decimal.
    if (!preg_match('/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,' . $decimales . '})?$/D', $texto)) {
        throw new InvalidArgumentException("El valor de $campo no tiene el formato numérico esperado.");
    }
    $valor = str_replace(',', '', $texto);
    if ((float)$valor > 999999999999.99) {
        throw new InvalidArgumentException("El valor de $campo supera el límite permitido.");
    }
    return number_format((float)$valor, $decimales, '.', '');
}

function ocFecha($texto, $campo)
{
    $fecha = DateTime::createFromFormat('!d/m/Y', $texto);
    if (!$fecha || $fecha->format('d/m/Y') !== $texto) {
        throw new InvalidArgumentException("La fecha de $campo no es válida.");
    }
    return $fecha->format('Y-m-d');
}

function ocLeerCsv($contenido)
{
    if (!is_string($contenido) || $contenido === '' || strlen($contenido) > 5 * 1024 * 1024 || strpos($contenido, "\0") !== false) {
        throw new InvalidArgumentException('Selecciona un CSV válido de hasta 5 MB.');
    }
    $contenido = preg_replace('/^\xEF\xBB\xBF/', '', $contenido);
    if (!preg_match('//u', $contenido)) {
        $contenido = iconv('Windows-1252', 'UTF-8', $contenido);
        if ($contenido === false) throw new InvalidArgumentException('No se pudo leer la codificación del CSV.');
    }
    $stream = fopen('php://temp', 'r+');
    if ($stream === false) throw new RuntimeException('No se pudo abrir el lector temporal del CSV.');
    $contenidoNormalizado = str_replace(["\r\n", "\r"], "\n", $contenido);
    if (fwrite($stream, $contenidoNormalizado) !== strlen($contenidoNormalizado) || !rewind($stream)) {
        fclose($stream);
        throw new RuntimeException('No se pudo preparar la lectura del CSV.');
    }
    // PHP < 7.4 rechaza escape vacío y devuelve false antes de leer filas.
    // NUL no puede aparecer en la entrada validada: conserva las barras literales
    // y las comillas dobles del CSV, sin activar escapes con barra inversa.
    $escapeCsv = PHP_VERSION_ID >= 70400 ? '' : "\0";
    $orden = [];
    $productos = [];
    $enDetalle = false;
    $fila = 0;
    $etiquetas = ['PROVEEDOR' => 'proveedor', 'NIT' => 'nitProveedor', 'TELEFONO' => 'telefono',
        'CIUDAD' => 'ciudad', 'ESTADO' => 'estadoOrigen', 'FECHA' => 'fecha', 'VENCIMIENTO' => 'vencimiento',
        'SUBTOTAL' => 'subtotal', 'DESCUENTO' => 'descuento', 'SUBTOTAL - DCT' => 'subtotalDescuento',
        'IVA' => 'iva', 'RETEFUENTE' => 'retefuente', 'RETEICA' => 'reteica', 'RETEIVA' => 'reteiva',
        'RETECREE' => 'retecree', 'TOTAL' => 'total'];
    $asignar = function ($campo, $valor) use (&$orden) {
        if (isset($orden[$campo]) && $orden[$campo] !== $valor) {
            throw new InvalidArgumentException("El archivo contiene valores distintos para $campo; carga una sola orden completa.");
        }
        $orden[$campo] = $valor;
    };
    try {
        while (($celdas = fgetcsv($stream, 0, ';', '"', $escapeCsv)) !== false) {
            $fila++;
            // Las columnas impresas no coinciden con las columnas de las líneas de producto.
            // Los ocho valores no vacíos de cada producto conservan su orden semántico.
            $valores = array_values(array_filter(array_map(function ($v) { return trim((string)$v); }, $celdas), function ($v) { return $v !== ''; }));
            if (!$valores) continue;
            $primero = $valores[0];
            if (count($valores) === 1 && ($primero === ($orden['empresa'] ?? null) || $primero === ($orden['direccionEmpresa'] ?? null))) continue;
            if ($primero === 'ITEM') {
                if ($valores !== ['ITEM', 'UBI', 'DESCRIPCION', 'COSTO', 'PESO', 'CANTIDAD', 'VR.UNITARIO', 'VR.TOTAL']) {
                    throw new InvalidArgumentException("Encabezado de productos no reconocido en la fila $fila.");
                }
                $enDetalle = true;
                continue;
            }
            if (isset($etiquetas[$primero])) {
                for ($i = 0; $i < count($valores); $i += 2) {
                    if (!isset($etiquetas[$valores[$i]], $valores[$i + 1])) {
                        throw new InvalidArgumentException("Datos incompletos en la fila $fila.");
                    }
                    $asignar($etiquetas[$valores[$i]], $valores[$i + 1]);
                }
                if ($primero === 'SUBTOTAL' || $primero === 'TOTAL') $enDetalle = false;
                continue;
            }
            if (preg_match('/^ORDEN DE COMPRA\s+(.+?)\s+No\.$/i', $primero, $m)) {
                if (count($valores) !== 2) throw new InvalidArgumentException('No se identifica el número de la orden.');
                $asignar('tipoDocumento', strtoupper(trim($m[1])));
                $asignar('numero', $valores[1]);
                continue;
            }
            if (strpos($primero, 'Nota Orden de Compra:') === 0) {
                $asignar('observacion', trim(substr(implode(' ', $valores), strlen('Nota Orden de Compra:'))));
                continue;
            }
            if (preg_match('/^PAGINA:\s*\d+ de \d+$/i', $primero)) continue;
            if (preg_match('/^Nit\.\s*(.+)$/i', $primero, $m)) {
                $asignar('nitEmpresa', $m[1]);
                continue;
            }
            $impresion = false;
            foreach ($valores as $valor) {
                if (strpos($valor, 'FECHA Y HORA DE IMPRESIÓN ') === 0) {
                    $asignar('impresion', substr($valor, strlen('FECHA Y HORA DE IMPRESIÓN ')));
                    $impresion = true;
                }
            }
            if ($impresion) {
                if (strpos($primero, 'FECHA Y HORA') !== 0) $asignar('empresa', $primero);
                continue;
            }
            if (!$enDetalle && !isset($orden['tipoDocumento']) && count($valores) === 1) {
                $asignar(isset($orden['empresa']) ? 'direccionEmpresa' : 'empresa', $primero);
                continue;
            }
            if ($enDetalle) {
                if (count($valores) !== 8) {
                    throw new InvalidArgumentException("La fila $fila no contiene los ocho campos del producto. No se ha importado ninguna línea.");
                }
                $productos[] = [
                    'renglon' => count($productos) + 1, 'filaArchivo' => $fila,
                    'codigo' => ocTexto($valores[0], 80, "código, fila $fila"),
                    'ubicacionOrigen' => ocTexto($valores[1], 80, "UBI, fila $fila"),
                    'descripcion' => ocTexto($valores[2], 500, "descripción, fila $fila"),
                    'costo' => ocNumero($valores[3], 2, "costo, fila $fila"),
                    'peso' => ocNumero($valores[4], 3, "peso, fila $fila"),
                    'cantidad' => ocNumero($valores[5], 3, "cantidad, fila $fila"),
                    'valorUnitario' => ocNumero($valores[6], 2, "valor unitario, fila $fila"),
                    'valorTotal' => ocNumero($valores[7], 2, "valor total, fila $fila")
                ];
                if ((float)$valores[5] <= 0) throw new InvalidArgumentException("La cantidad debe ser mayor que cero en la fila $fila.");
                continue;
            }
            // No omitir silenciosamente contenido desconocido o productos fuera del detalle.
            throw new InvalidArgumentException("No se reconoce la estructura de la fila $fila. Revisa el formato del archivo.");
        }
        if (!feof($stream)) {
            throw new RuntimeException('La lectura del CSV se interrumpió antes del final del archivo.');
        }
        if ($fila === 0) {
            throw new InvalidArgumentException('No se pudo leer ninguna fila del CSV. Revisa el contenido del archivo.');
        }
    } finally {
        fclose($stream);
    }
    foreach (['empresa' => 255, 'nitEmpresa' => 30, 'direccionEmpresa' => 255, 'tipoDocumento' => 30,
        'numero' => 80, 'estadoOrigen' => 60, 'impresion' => 150, 'proveedor' => 255,
        'nitProveedor' => 30, 'telefono' => 80, 'ciudad' => 120] as $campo => $limite) {
        $orden[$campo] = ocTexto($orden[$campo] ?? '', $limite, $campo);
    }
    foreach (['fecha', 'vencimiento'] as $campo) $orden[$campo] = ocFecha($orden[$campo] ?? '', $campo);
    foreach (['subtotal', 'descuento', 'subtotalDescuento', 'iva', 'retefuente', 'reteica', 'reteiva', 'retecree', 'total'] as $campo) {
        $orden[$campo] = ocNumero($orden[$campo] ?? '', 2, $campo);
    }
    $orden['observacion'] = $orden['observacion'] ?? '';
    if (strlen($orden['observacion']) > 60000) throw new InvalidArgumentException('La observación es demasiado larga.');
    if (!$productos) throw new InvalidArgumentException('El archivo no contiene productos.');
    // Las diferencias contables se muestran sin reinterpretar impuestos del proveedor.
    $advertencias = [];
    $suma = array_sum(array_column($productos, 'valorTotal'));
    if (abs($suma - (float)$orden['subtotal']) > 0.02) {
        throw new InvalidArgumentException('La suma de los productos no coincide con el subtotal. Revisa que el CSV esté completo.');
    }
    foreach ($productos as $p) {
        if (abs(round((float)$p['cantidad'] * (float)$p['valorUnitario'], 2) - (float)$p['valorTotal']) > 0.02) {
            $advertencias[] = "El importe del renglón {$p['renglon']} difiere de cantidad por valor unitario.";
        }
    }
    if ($orden['estadoOrigen'] === 'PARCIAL') $advertencias[] = 'La orden indica PARCIAL; el CSV no identifica cantidades recibidas ni pendientes.';
    $orden['productos'] = $productos;
    $orden['advertencias'] = $advertencias;
    return $orden;
}
