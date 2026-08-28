<?php
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");

ini_set('display_errors', 1);
error_reporting(E_ALL);

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit;
}

function jexit($code, $arr){
  http_response_code($code);
  echo json_encode($arr, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
  exit;
}

function post($key, $default = ""){
  return isset($_POST[$key]) ? trim((string)$_POST[$key]) : $default;
}

function normText($txt){
  $txt = trim((string)$txt);
  $txt = preg_replace('/\s+/', ' ', $txt);
  $txt = mb_strtoupper($txt, 'UTF-8');

  $replacements = [
    'Á'=>'A','É'=>'E','Í'=>'I','Ó'=>'O','Ú'=>'U',
    'À'=>'A','È'=>'E','Ì'=>'I','Ò'=>'O','Ù'=>'U',
    'Ä'=>'A','Ë'=>'E','Ï'=>'I','Ö'=>'O','Ü'=>'U',
    'Ñ'=>'N'
  ];

  return strtr($txt, $replacements);
}

function normalizarPresentacion($txt){
  $txt = normText($txt);

  if ($txt === "") return "";

  $txt = preg_replace('/\s+/', ' ', $txt);
  $txt = str_replace(['.', ','], ['', '.'], $txt);

  $txt = preg_replace('/\bFRASCO(S)?\b/u', 'F', $txt);
  $txt = preg_replace('/\bBOLSA(S)?\b/u', 'B', $txt);
  $txt = preg_replace('/\bPAQUETE(S)?\b/u', 'PAQ', $txt);
  $txt = preg_replace('/\bPAQ\.\b/u', 'PAQ', $txt);
  $txt = preg_replace('/\bUNIDAD(ES)?\b/u', 'UND', $txt);
  $txt = preg_replace('/\bGRAMO(S)?\b/u', 'GR', $txt);
  $txt = preg_replace('/\bGRAM\b/u', 'GR', $txt);
  $txt = preg_replace('/\bG\b/u', 'GR', $txt);
  $txt = preg_replace('/\bMILILITRO(S)?\b/u', 'CC', $txt);
  $txt = preg_replace('/\bML\b/u', 'CC', $txt);
  $txt = preg_replace('/\bC C\b/u', 'CC', $txt);

  $txt = preg_replace('/\s*X\s*/u', ' X ', $txt);
  $txt = preg_replace('/\s+/', ' ', $txt);

  return trim($txt);
}

/**
 * Limpia nombres como:
 * - "SAL / LB" => "SAL"
 * - "ARROZ/KG" => "ARROZ"
 * - "AZUCAR / KG" => "AZUCAR"
 * - "MARGARINA / B X 170 G" => "MARGARINA"
 */
function limpiarNombreProductoBase($txt){
  $txt = normText($txt);

  if ($txt === "") {
    return "";
  }

  /*
   * Si el Excel trae el producto compuesto con presentación después de slash,
   * se toma únicamente el nombre base. Esto evita que productos como
   * "MARGARINA / B X 170 G" intenten buscarse como nombre completo.
   */
  if (strpos($txt, '/') !== false) {
    $partes = explode('/', $txt);
    $txt = trim((string)($partes[0] ?? $txt));
  }

  $txt = preg_replace('/\s+/', ' ', $txt);

  return trim($txt);
}

/**
 * Determina si el nombre es corto/genérico y no debe homologarse
 * por similitud abierta.
 */
function esNombreProductoGenericoOCorto($txt){
  $txt = limpiarNombreProductoBase($txt);

  if ($txt === "") {
    return true;
  }

  $genericos = [
    "SAL",
    "AZUCAR",
    "ARROZ",
    "PANELA",
    "ACEITE",
    "HARINA",
    "LENTEJA",
    "FRIJOL",
    "PASTA",
    "AVENA",
    "LECHE",
    "CAFE",
    "CHOCOLATE"
  ];

  if (in_array($txt, $genericos, true)) {
    return true;
  }

  return mb_strlen($txt, 'UTF-8') <= 4;
}

function resolverTipoArchivo($tipoArchivo, $nombreArchivo){
  $tipo = normText($tipoArchivo);
  $nombre = normText($nombreArchivo);

  if (in_array($tipo, ["AM", "PM", "JORNADA_UNICA"], true)) {
    return $tipo;
  }

  if (
    strpos($nombre, "JORNADA UNICA") !== false ||
    strpos($nombre, "JORNADA_UNICA") !== false
  ) {
    return "JORNADA_UNICA";
  }

  if (preg_match('/(^|[^A-Z])AM([^A-Z]|$)/', $nombre)) {
    return "AM";
  }

  if (preg_match('/(^|[^A-Z])PM([^A-Z]|$)/', $nombre)) {
    return "PM";
  }

  return "";
}

function resolverIdJornada($tipoArchivo){
  $tipo = normText($tipoArchivo);

  switch ($tipo) {
    case "AM":
      return 1;
    case "PM":
      return 2;
    case "JORNADA_UNICA":
      return 3;
    default:
      return 0;
  }
}

function obtenerDespacho($mysqli, $idDespacho){
  /*
   * Se trae tipoDespacho para poder aplicar reglas separadas.
   * CLASICO conserva la validación estricta original.
   * ROLDANILLO permite colegios con el mismo nombre en rutas/municipios distintos.
   */
  $sql = "
    SELECT id, COALESCE(tipoDespacho, 'CLASICO') AS tipoDespacho
    FROM DespachosInforme
    WHERE id = ?
    LIMIT 1
  ";

  $st = $mysqli->prepare($sql);
  if (!$st) return false;

  $st->bind_param("i", $idDespacho);
  if (!$st->execute()) {
    $st->close();
    return false;
  }

  $st->store_result();
  $st->bind_result($id, $tipoDespacho);

  $row = false;
  if ($st->fetch()) {
    $row = [
      "id" => (int)$id,
      "tipoDespacho" => normText($tipoDespacho ?: "CLASICO")
    ];
  }

  $st->close();
  return $row ?: false;
}

function separarCodigoNombreColegio($texto){
  $texto = trim((string)$texto);

  if ($texto === "") {
    return [
      "codigo" => null,
      "nombre" => null
    ];
  }

  if (preg_match('/^(\d{1,3}\/\d{2})\s+(.+)$/u', $texto, $m)) {
    return [
      "codigo" => trim($m[1]),
      "nombre" => trim($m[2])
    ];
  }

  return [
    "codigo" => null,
    "nombre" => $texto
  ];
}

function normalizarTextoCruceRoldanillo($txt){
  /*
   * Esta normalización DEBE coincidir con la usada para generar los códigos
   * cargados en RutasAgrupadasColegios.codigoColegio y ColegiosDespacho.codigo.
   *
   * Código esperado:
   *   CG- + SHA1(lista_normalizada . "|" . sede_normalizada) primeros 12 caracteres
   */
  $txt = trim((string)$txt);
  if ($txt === "") return "";

  $txt = mb_strtoupper($txt, 'UTF-8');

  $txt = str_replace(
    [
      'GOBERNACIÓN 2026 -',
      'GOBERNACION 2026 -',
      'GOBERNACIÓN 2026',
      'GOBERNACION 2026'
    ],
    '',
    $txt
  );

  $replacements = [
    'Á'=>'A','É'=>'E','Í'=>'I','Ó'=>'O','Ú'=>'U',
    'À'=>'A','È'=>'E','Ì'=>'I','Ò'=>'O','Ù'=>'U',
    'Ä'=>'A','Ë'=>'E','Ï'=>'I','Ö'=>'O','Ü'=>'U',
    'Ñ'=>'N'
  ];
  $txt = strtr($txt, $replacements);

  /*
   * Correcciones de escritura detectadas en las listas de Roldanillo.
   * Caso real:
   *   OBANDO RURALIDADA DISPERSA 1
   * debe cruzar como:
   *   OBANDO RURALIDAD DISPERSA 1
   */
  $txt = str_replace(
    [
      'RURALIDADA'
    ],
    [
      'RURALIDAD'
    ],
    $txt
  );

  $txt = str_replace(
    [
      'J UINICA',
      'J UNCA',
      'JORNADA UNICA',
      'JORNADA ÚNICA'
    ],
    'J UNICA',
    $txt
  );

  $txt = preg_replace('/[^A-Z0-9]+/', ' ', $txt);
  $txt = preg_replace('/\s+/', ' ', $txt);

  return trim($txt);
}

function generarCodigoColegioRoldanillo($nombreLista, $nombreColegio){
  $listaNorm = normalizarTextoCruceRoldanillo($nombreLista);
  $colegioNorm = normalizarTextoCruceRoldanillo($nombreColegio);

  if ($listaNorm === "" || $colegioNorm === "") {
    return "";
  }

  $base = $listaNorm . "|" . $colegioNorm;
  return "CG-" . strtoupper(substr(sha1($base), 0, 12));
}

function buscarColegioRoldanilloMapeado($mysqli, $nombreLista, $nombreColegio){
  $codigoGenerado = generarCodigoColegioRoldanillo($nombreLista, $nombreColegio);

  if ($codigoGenerado === "") {
    return null;
  }

  /*
   * Para ROLDANILLO no se crea el colegio en este servicio.
   * Debe existir previamente en:
   *   RutasAgrupadasColegios.codigoColegio
   *   ColegiosDespacho.codigo
   *
   * Así garantizamos que DetalleRutaProducto.idColegio apunte al colegio correcto
   * y que ese colegio esté relacionado con su ruta agrupada.
   */
  $sql = "
    SELECT
      cd.id AS idColegio,
      cd.codigo AS codigoColegio,
      cd.nombre AS nombreColegio,
      rac.idRutaAgrupada,
      ra.codigo AS codigoRutaAgrupada,
      ra.nombre AS nombreRutaAgrupada,
      rac.direccion AS municipioLista
    FROM ColegiosDespacho cd
    INNER JOIN RutasAgrupadasColegios rac
      ON rac.codigoColegio COLLATE utf8mb4_unicode_ci = cd.codigo COLLATE utf8mb4_unicode_ci
    INNER JOIN RutasAgrupadas ra
      ON ra.id = rac.idRutaAgrupada
    WHERE cd.codigo COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
      AND cd.estado = 1
      AND rac.estado = 1
      AND ra.estado = 1
    LIMIT 1
  ";

  $st = $mysqli->prepare($sql);
  if (!$st) {
    throw new Exception("Error prepare SELECT colegio Roldanillo: " . $mysqli->error);
  }

  $st->bind_param("s", $codigoGenerado);

  if (!$st->execute()) {
    $err = $st->error;
    $st->close();
    throw new Exception("Error execute SELECT colegio Roldanillo: " . $err);
  }

  $st->store_result();
  $st->bind_result(
    $idColegio,
    $codigoColegio,
    $nombreColegioDb,
    $idRutaAgrupada,
    $codigoRutaAgrupada,
    $nombreRutaAgrupada,
    $municipioLista
  );

  $row = null;
  if ($st->fetch()) {
    $row = [
      "idColegio" => (int)$idColegio,
      "codigoColegio" => $codigoColegio,
      "nombreColegio" => $nombreColegioDb,
      "idRutaAgrupada" => (int)$idRutaAgrupada,
      "codigoRutaAgrupada" => $codigoRutaAgrupada,
      "nombreRutaAgrupada" => $nombreRutaAgrupada,
      "municipioLista" => $municipioLista,
      "codigoGenerado" => $codigoGenerado,
      "nombreListaNorm" => normalizarTextoCruceRoldanillo($nombreLista),
      "nombreColegioNorm" => normalizarTextoCruceRoldanillo($nombreColegio)
    ];
  }

  $st->close();
  return $row;
}

function obtenerOCrearColegio($mysqli, $textoColegio, $tipoDespacho = "CLASICO", $nombreRuta = ""){
  $textoColegio = trim((string)$textoColegio);
  if ($textoColegio === "") return null;

  $tipoDespacho = normText($tipoDespacho ?: "CLASICO");

  $partes = separarCodigoNombreColegio($textoColegio);
  $codigo = $partes["codigo"];
  $nombre = $partes["nombre"];

  if (!$nombre || trim((string)$nombre) === "") {
    return null;
  }

  /*
   * Regla ROLDANILLO:
   * El Excel no trae código real de colegio/sede. El código debe generarse
   * con la misma regla usada en los scripts maestros:
   *   CG- + SHA1(lista_normalizada + "|" + sede_normalizada)
   *
   * En este punto $nombreRuta representa la lista detectada en el archivo,
   * por ejemplo: "Gobernacion 2026 - TORO RURALIDAD DISPERSA".
   */
  if ($tipoDespacho === "ROLDANILLO") {
    $colegioMapeado = buscarColegioRoldanilloMapeado($mysqli, $nombreRuta, $nombre);

    if ($colegioMapeado && !empty($colegioMapeado["idColegio"])) {
      return (int)$colegioMapeado["idColegio"];
    }

    $codigoGenerado = generarCodigoColegioRoldanillo($nombreRuta, $nombre);

    throw new Exception(json_encode([
      "tipo" => "colegio_roldanillo_no_mapeado",
      "mensaje" => "La sede educativa de Roldanillo no está mapeada en RutasAgrupadasColegios/ColegiosDespacho",
      "nombreLista" => $nombreRuta,
      "nombreListaNorm" => normalizarTextoCruceRoldanillo($nombreRuta),
      "colegio" => $textoColegio,
      "nombreColegio" => $nombre,
      "nombreColegioNorm" => normalizarTextoCruceRoldanillo($nombre),
      "codigoGenerado" => $codigoGenerado
    ], JSON_UNESCAPED_UNICODE));
  }

  /* =========================
     Flujo CLÁSICO original
  ========================= */
  $codigoNorm = $codigo ? normText($codigo) : null;
  $nombreNorm = $nombre ? normText($nombre) : null;

  if ($codigoNorm && $nombreNorm) {
    $sql = "
      SELECT id, codigo, nombre
      FROM ColegiosDespacho
      WHERE UPPER(TRIM(codigo)) = UPPER(TRIM(?))
        AND UPPER(TRIM(nombre)) = UPPER(TRIM(?))
      LIMIT 1
    ";

    $st = $mysqli->prepare($sql);
    if ($st) {
      $st->bind_param("ss", $codigo, $nombre);

      if ($st->execute()) {
        $st->store_result();
        $st->bind_result($id, $codigoDb, $nombreDb);

        if ($st->fetch()) {
          $st->close();
          return (int)$id;
        }
      }

      $st->close();
    }
  }

  if (!$codigoNorm && $nombreNorm) {
    $sql = "
      SELECT id
      FROM ColegiosDespacho
      WHERE UPPER(TRIM(nombre)) = UPPER(TRIM(?))
      LIMIT 1
    ";

    $st = $mysqli->prepare($sql);
    if ($st) {
      $st->bind_param("s", $nombre);

      if ($st->execute()) {
        $st->store_result();
        $st->bind_result($id);

        if ($st->fetch()) {
          $st->close();
          return (int)$id;
        }
      }

      $st->close();
    }
  }

  $sqlIns = "
    INSERT INTO ColegiosDespacho
    (codigo, nombre, estado)
    VALUES
    (?, ?, 1)
  ";

  $st = $mysqli->prepare($sqlIns);
  if (!$st) return null;

  $st->bind_param("ss", $codigo, $nombre);

  if (!$st->execute()) {
    $st->close();
    return null;
  }

  $id = (int)$mysqli->insert_id;
  $st->close();

  return $id;
}

function resolverProductoPorEmbalaje($mysqli, $nombreProducto, $unidadExcel){
  $productoNorm = limpiarNombreProductoBase($nombreProducto);
  $unidadNorm = normalizarPresentacion($unidadExcel);

  if ($productoNorm === "" || $unidadNorm === "") {
    return [
      "idProducto" => null,
      "score" => 0,
      "descripcion" => null,
      "metodo" => null,
      "idEmbalaje" => null,
      "productoBase" => null,
      "presentacion" => null
    ];
  }

  $sql = "
    SELECT 
      pc.id AS idProducto,
      pc.descripcion,
      pc.idEmbalaje,
      ec.producto_base,
      ec.presentacion
    FROM ProductosCatalogo pc
    INNER JOIN EmbalajeCatalogo ec
      ON ec.id = pc.idEmbalaje
    WHERE pc.estado = 1
      AND ec.estado = 1
  ";

  $rs = $mysqli->query($sql);
  if (!$rs) {
    return [
      "idProducto" => null,
      "score" => 0,
      "descripcion" => null,
      "metodo" => null,
      "idEmbalaje" => null,
      "productoBase" => null,
      "presentacion" => null
    ];
  }

  $candidatosExactos = [];
  $candidatosBase = [];

  while ($row = $rs->fetch_assoc()) {
    $productoBaseDb = trim((string)($row["producto_base"] ?? ""));
    $presentacionDb = trim((string)($row["presentacion"] ?? ""));
    $descripcionDb = trim((string)($row["descripcion"] ?? ""));

    $productoBaseNorm = normText($productoBaseDb);
    $presentacionNorm = normalizarPresentacion($presentacionDb);

    if ($productoBaseNorm === "" || $presentacionNorm === "") {
      continue;
    }

    if ($productoBaseNorm === $productoNorm && $presentacionNorm === $unidadNorm) {
      $candidatosExactos[] = [
        "idProducto" => (int)$row["idProducto"],
        "score" => 100,
        "descripcion" => $descripcionDb,
        "metodo" => "embalaje_exacto",
        "idEmbalaje" => (int)$row["idEmbalaje"],
        "productoBase" => $productoBaseDb,
        "presentacion" => $presentacionDb
      ];
      continue;
    }

    if ($productoBaseNorm === $productoNorm) {
      similar_text($unidadNorm, $presentacionNorm, $scoreUnidad);

      if (
        strpos($presentacionNorm, $unidadNorm) !== false ||
        strpos($unidadNorm, $presentacionNorm) !== false
      ) {
        $scoreUnidad = max($scoreUnidad, 95);
      }

      $candidatosBase[] = [
        "idProducto" => (int)$row["idProducto"],
        "score" => $scoreUnidad,
        "descripcion" => $descripcionDb,
        "metodo" => "embalaje_similar",
        "idEmbalaje" => (int)$row["idEmbalaje"],
        "productoBase" => $productoBaseDb,
        "presentacion" => $presentacionDb
      ];
    }
  }

  if (!empty($candidatosExactos)) {
    return $candidatosExactos[0];
  }

  usort($candidatosBase, function($a, $b){
    return $b["score"] <=> $a["score"];
  });

  if (!empty($candidatosBase) && $candidatosBase[0]["score"] >= 85) {
    return $candidatosBase[0];
  }

  return [
    "idProducto" => null,
    "score" => !empty($candidatosBase) ? $candidatosBase[0]["score"] : 0,
    "descripcion" => !empty($candidatosBase) ? $candidatosBase[0]["descripcion"] : null,
    "metodo" => !empty($candidatosBase) ? $candidatosBase[0]["metodo"] : null,
    "idEmbalaje" => !empty($candidatosBase) ? $candidatosBase[0]["idEmbalaje"] : null,
    "productoBase" => !empty($candidatosBase) ? $candidatosBase[0]["productoBase"] : null,
    "presentacion" => !empty($candidatosBase) ? $candidatosBase[0]["presentacion"] : null
  ];
}

function buscarProductoExactoPorDescripcion($mysqli, $nombreProducto){
  $nombreNorm = limpiarNombreProductoBase($nombreProducto);

  if ($nombreNorm === "") {
    return [
      "idProducto" => null,
      "score" => 0,
      "descripcion" => null,
      "metodo" => null,
      "idEmbalaje" => null,
      "productoBase" => null,
      "presentacion" => null
    ];
  }

  $sql = "
    SELECT 
      pc.id,
      pc.descripcion,
      pc.idEmbalaje,
      ec.producto_base,
      ec.presentacion
    FROM ProductosCatalogo pc
    LEFT JOIN EmbalajeCatalogo ec
      ON ec.id = pc.idEmbalaje
    WHERE pc.estado = 1
  ";

  $rs = $mysqli->query($sql);
  if (!$rs) {
    return [
      "idProducto" => null,
      "score" => 0,
      "descripcion" => null,
      "metodo" => null,
      "idEmbalaje" => null,
      "productoBase" => null,
      "presentacion" => null
    ];
  }

  while ($row = $rs->fetch_assoc()) {
    $descNorm = normText($row["descripcion"] ?? "");
    $baseNorm = normText($row["producto_base"] ?? "");

    if ($descNorm === $nombreNorm || $baseNorm === $nombreNorm) {
      return [
        "idProducto" => (int)$row["id"],
        "score" => 100,
        "descripcion" => $row["descripcion"] ?? null,
        "metodo" => "exacto_nombre",
        "idEmbalaje" => isset($row["idEmbalaje"]) ? (int)$row["idEmbalaje"] : null,
        "productoBase" => $row["producto_base"] ?? null,
        "presentacion" => $row["presentacion"] ?? null
      ];
    }
  }

  return [
    "idProducto" => null,
    "score" => 0,
    "descripcion" => null,
    "metodo" => null,
    "idEmbalaje" => null,
    "productoBase" => null,
    "presentacion" => null
  ];
}

function buscarProductoMejorCoincidenciaRespaldo($mysqli, $nombreProducto, $unidadExcel = ""){
  $nombre = limpiarNombreProductoBase($nombreProducto);
  $unidad = trim((string)$unidadExcel);

  if ($nombre === "") {
    return [
      "idProducto" => null,
      "score" => 0,
      "descripcion" => null,
      "metodo" => null,
      "idEmbalaje" => null,
      "productoBase" => null,
      "presentacion" => null
    ];
  }

  // Bloqueo para nombres muy cortos o genéricos:
  // no deben homologarse por similitud abierta
  if (esNombreProductoGenericoOCorto($nombre)) {
    return [
      "idProducto" => null,
      "score" => 0,
      "descripcion" => null,
      "metodo" => "bloqueado_generico",
      "idEmbalaje" => null,
      "productoBase" => null,
      "presentacion" => null
    ];
  }

  $textoBusqueda = trim($nombre . " " . $unidad);
  $textoBusquedaNorm = normText($textoBusqueda);

  $sql = "
    SELECT 
      pc.id,
      pc.descripcion,
      pc.idEmbalaje,
      ec.producto_base,
      ec.presentacion
    FROM ProductosCatalogo pc
    LEFT JOIN EmbalajeCatalogo ec
      ON ec.id = pc.idEmbalaje
    WHERE pc.estado = 1
  ";
  $rs = $mysqli->query($sql);

  $mejor = [
    "idProducto" => null,
    "score" => 0,
    "descripcion" => null,
    "metodo" => null,
    "idEmbalaje" => null,
    "productoBase" => null,
    "presentacion" => null
  ];

  if (!$rs) return $mejor;

  while ($row = $rs->fetch_assoc()) {
    $desc = trim((string)($row["descripcion"] ?? ""));
    $productoBase = trim((string)($row["producto_base"] ?? ""));
    $presentacion = trim((string)($row["presentacion"] ?? ""));

    $compuesto = trim($productoBase . " " . $presentacion);
    if ($compuesto === "") {
      $compuesto = $desc;
    }

    $compuestoNorm = normText($compuesto);

    if ($compuestoNorm === $textoBusquedaNorm) {
      return [
        "idProducto" => (int)$row["id"],
        "score" => 100,
        "descripcion" => $desc,
        "metodo" => "respaldo_exacto",
        "idEmbalaje" => isset($row["idEmbalaje"]) ? (int)$row["idEmbalaje"] : null,
        "productoBase" => $productoBase,
        "presentacion" => $presentacion
      ];
    }

    similar_text($textoBusquedaNorm, $compuestoNorm, $porcentaje);

    if (
      strpos($compuestoNorm, $textoBusquedaNorm) !== false ||
      strpos($textoBusquedaNorm, $compuestoNorm) !== false
    ) {
      $porcentaje = max($porcentaje, 90);
    }

    if ($porcentaje > $mejor["score"]) {
      $mejor = [
        "idProducto" => (int)$row["id"],
        "score" => $porcentaje,
        "descripcion" => $desc,
        "metodo" => "respaldo_similitud",
        "idEmbalaje" => isset($row["idEmbalaje"]) ? (int)$row["idEmbalaje"] : null,
        "productoBase" => $productoBase,
        "presentacion" => $presentacion
      ];
    }
  }

  if ($mejor["score"] < 80) {
    return [
      "idProducto" => null,
      "score" => $mejor["score"],
      "descripcion" => $mejor["descripcion"],
      "metodo" => $mejor["metodo"],
      "idEmbalaje" => $mejor["idEmbalaje"],
      "productoBase" => $mejor["productoBase"],
      "presentacion" => $mejor["presentacion"]
    ];
  }

  return $mejor;
}

function buscarProductoCatalogo($mysqli, $nombreProducto, $unidadExcel){
  $nombreLimpio = limpiarNombreProductoBase($nombreProducto);
  $unidadNorm = normalizarPresentacion($unidadExcel);

  /*
   * 1) Primero se intenta por embalaje: producto_base + presentación.
   * Esto evita que productos con varias presentaciones, por ejemplo
   * MARGARINA / B X 170 G, tomen cualquier registro que solo coincida por nombre base.
   */
  if ($nombreLimpio !== "" && $unidadNorm !== "") {
    $porEmbalaje = resolverProductoPorEmbalaje($mysqli, $nombreLimpio, $unidadExcel);
    if (!empty($porEmbalaje["idProducto"])) {
      return $porEmbalaje;
    }
  }

  // 2) Luego intento exacto por nombre/base.
  $exacto = buscarProductoExactoPorDescripcion($mysqli, $nombreLimpio);
  if (!empty($exacto["idProducto"])) {
    return $exacto;
  }

  // 3) Si es genérico/corto, NO usar similitud abierta.
  if (esNombreProductoGenericoOCorto($nombreLimpio)) {
    return [
      "idProducto" => null,
      "score" => 0,
      "descripcion" => null,
      "metodo" => "sin_homologacion_generico",
      "idEmbalaje" => null,
      "productoBase" => null,
      "presentacion" => null
    ];
  }

  // 4) Respaldo por similitud solo para nombres menos riesgosos.
  return buscarProductoMejorCoincidenciaRespaldo($mysqli, $nombreLimpio, $unidadExcel);
}

/**
 * AJUSTE:
 * - Busca la ruta solo por idDespacho + nombreRuta
 * - Ya no la separa por jornada
 * - Al crearla, conserva idJornada para respetar el esquema actual
 * - Lanza errores detallados si algo falla
 */
function obtenerOCrearRuta($mysqli, $idDespacho, $idJornada, $nombreRuta, $idEstado = 1){
  $nombreRuta = trim((string)$nombreRuta);
  if ($nombreRuta === "") {
    throw new Exception("Nombre de ruta vacío al intentar crear/obtener la ruta");
  }

  $sql = "
    SELECT id, idDespacho, idJornada, nombreRuta
    FROM RutasDespacho
    WHERE idDespacho = ?
      AND nombreRuta = ?
    LIMIT 1
  ";

  $st = $mysqli->prepare($sql);
  if (!$st) {
    throw new Exception("Error prepare SELECT ruta: " . $mysqli->error);
  }

  $st->bind_param("is", $idDespacho, $nombreRuta);

  if (!$st->execute()) {
    $err = $st->error;
    $st->close();
    throw new Exception("Error execute SELECT ruta: " . $err);
  }

  $st->store_result();
  $st->bind_result($id, $idDespachoDb, $idJornadaDb, $nombreRutaDb);

  $row = null;
  if ($st->fetch()) {
    $row = [
      "id" => $id,
      "idDespacho" => $idDespachoDb,
      "idJornada" => $idJornadaDb,
      "nombreRuta" => $nombreRutaDb
    ];
  }
  $st->close();

  if ($row) {
    return (int)$row["id"];
  }

  $sqlIns = "
    INSERT INTO RutasDespacho
    (idDespacho, idJornada, nombreRuta, ordenRuta, estado, idEstado)
    VALUES
    (?, ?, ?, NULL, 1, ?)
  ";

  $st = $mysqli->prepare($sqlIns);
  if (!$st) {
    throw new Exception("Error prepare INSERT ruta: " . $mysqli->error);
  }

  $st->bind_param("iisi", $idDespacho, $idJornada, $nombreRuta, $idEstado);

  if (!$st->execute()) {
    $err = $st->error;
    $st->close();
    throw new Exception(
      "Error execute INSERT ruta: " . $err .
      " | datos => idDespacho=" . $idDespacho .
      ", idJornada=" . $idJornada .
      ", nombreRuta=" . $nombreRuta .
      ", idEstado=" . $idEstado
    );
  }

  $idRuta = (int)$mysqli->insert_id;
  $st->close();

  return $idRuta;
}

function obtenerDetalleDuplicadoExistente(
  $mysqli,
  $idDespachoArchivo,
  $idRuta,
  $idColegio,
  $idProducto,
  $consecutivo
){
  if ($consecutivo === null) {
    $sql = "
      SELECT id
      FROM DetalleRutaProducto
      WHERE idDespachoArchivo = ?
        AND idRuta = ?
        AND idColegio = ?
        AND idProducto = ?
        AND consecutivo IS NULL
      LIMIT 1
    ";

    $st = $mysqli->prepare($sql);
    if (!$st) return false;

    $st->bind_param(
      "iiii",
      $idDespachoArchivo,
      $idRuta,
      $idColegio,
      $idProducto
    );
  } else {
    $sql = "
      SELECT id
      FROM DetalleRutaProducto
      WHERE idDespachoArchivo = ?
        AND idRuta = ?
        AND idColegio = ?
        AND idProducto = ?
        AND consecutivo = ?
      LIMIT 1
    ";

    $st = $mysqli->prepare($sql);
    if (!$st) return false;

    $st->bind_param(
      "iiiii",
      $idDespachoArchivo,
      $idRuta,
      $idColegio,
      $idProducto,
      $consecutivo
    );
  }

  if (!$st->execute()) {
    $st->close();
    return false;
  }

  $st->store_result();
  $st->bind_result($id);

  $row = false;
  if ($st->fetch()) {
    $row = ["id" => $id];
  }

  $st->close();
  return $row ?: false;
}

function validarColegioEnOtraRutaMismaJornada($mysqli, $idDespacho, $tipoArchivo, $idColegio, $idRutaActual, $tipoDespacho = "CLASICO"){
  $tipoDespacho = normText($tipoDespacho ?: "CLASICO");

  if ($tipoDespacho === "ROLDANILLO") {
    /*
     * En Roldanillo se permite que un mismo nombre de colegio aparezca en
     * rutas/municipios diferentes. La separación real se controla al crear
     * el colegio con código técnico por ruta cuando no viene código en Excel.
     */
    return false;
  }

  /*
   * Validación ajustada para múltiples archivos por despacho.
   *
   * Antes se validaba por RutasDespacho.idJornada. Eso puede fallar cuando una misma
   * ruta se reutiliza para AM, PM y JORNADA_UNICA, porque obtenerOCrearRuta() busca
   * la ruta por idDespacho + nombreRuta y conserva el idJornada con el que fue creada.
   *
   * Ahora la validación se hace contra DespachoArchivos.tipoArchivo, que representa
   * la jornada real del archivo que originó cada detalle.
   */
  $sql = "
    SELECT 
      drp.id AS idDetalle,
      drp.idRuta,
      rd.nombreRuta,
      da.tipoArchivo
    FROM DetalleRutaProducto drp
    INNER JOIN RutasDespacho rd ON rd.id = drp.idRuta
    INNER JOIN DespachoArchivos da ON da.id = drp.idDespachoArchivo
    WHERE drp.idDespacho = ?
      AND da.tipoArchivo = ?
      AND drp.idColegio = ?
      AND drp.idRuta <> ?
    LIMIT 1
  ";

  $st = $mysqli->prepare($sql);
  if (!$st) return false;

  $st->bind_param("isii", $idDespacho, $tipoArchivo, $idColegio, $idRutaActual);

  if (!$st->execute()) {
    $st->close();
    return false;
  }

  $st->store_result();
  $st->bind_result($idDetalle, $idRuta, $nombreRuta, $tipoArchivoExistente);

  $row = false;
  if ($st->fetch()) {
    $row = [
      "idDetalle" => $idDetalle,
      "idRuta" => $idRuta,
      "nombreRuta" => $nombreRuta,
      "tipoArchivo" => $tipoArchivoExistente
    ];
  }

  $st->close();
  return $row ?: false;
}

/* =========================
   DB
========================= */
$mysqli = new mysqli("localhost", "accionpo_pae", "o#Ao0?ZEEec0s).i", "accionpo_pae");
if ($mysqli->connect_errno) {
  jexit(500, [
    "rpta" => "no",
    "mensaje" => "Error BD",
    "error" => $mysqli->connect_error
  ]);
}
$mysqli->set_charset("utf8mb4");

/* =========================
   Validar método
========================= */
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  jexit(405, [
    "rpta" => "no",
    "mensaje" => "Método no permitido"
  ]);
}

/* =========================
   Params
========================= */
$idDespacho = (int)post("idDespacho", "0");
$archivosProcesadosRaw = post("archivosProcesados", "");

/* =========================
   Validaciones
========================= */
if ($idDespacho <= 0) {
  jexit(400, [
    "rpta" => "no",
    "mensaje" => "El idDespacho es obligatorio"
  ]);
}

if ($archivosProcesadosRaw === "") {
  jexit(400, [
    "rpta" => "no",
    "mensaje" => "Los archivos procesados son obligatorios"
  ]);
}

$payload = json_decode($archivosProcesadosRaw, true);

if (!is_array($payload) || !isset($payload["archivos"]) || !is_array($payload["archivos"])) {
  jexit(400, [
    "rpta" => "no",
    "mensaje" => "El JSON de archivosProcesados no es válido"
  ]);
}

$despacho = obtenerDespacho($mysqli, $idDespacho);
if (!$despacho) {
  jexit(404, [
    "rpta" => "no",
    "mensaje" => "El despacho no existe"
  ]);
}

$tipoDespacho = normText($despacho["tipoDespacho"] ?? "CLASICO");

$mysqli->begin_transaction();

try {
  $totalArchivos = 0;
  $totalRutas = 0;
  $totalDetalles = 0;
  $productosNoRelacionados = [];

  foreach ($payload["archivos"] as $archivo) {
    $tipoArchivoRaw = trim((string)($archivo["tipoArchivo"] ?? ""));
    $nombreArchivo = trim((string)($archivo["nombreArchivo"] ?? ""));
    $hashArchivo = trim((string)($archivo["hashArchivo"] ?? ""));
    $hojasDetectadas = (int)($archivo["hojasDetectadas"] ?? 0);
    $rutasDetectadas = (int)($archivo["rutasDetectadas"] ?? 0);
    $rutas = isset($archivo["rutas"]) && is_array($archivo["rutas"]) ? $archivo["rutas"] : [];

    $tipoArchivo = resolverTipoArchivo($tipoArchivoRaw, $nombreArchivo);

    if ($tipoArchivo === "") {
      throw new Exception("No se pudo determinar el tipo de archivo para: " . $nombreArchivo);
    }

    $idJornada = resolverIdJornada($tipoArchivo);

    if ($idJornada <= 0) {
      throw new Exception("No se pudo determinar la jornada para el archivo: " . $nombreArchivo);
    }

    $sqlArchivo = "
      INSERT INTO DespachoArchivos
      (idDespacho, tipoArchivo, nombreArchivo, hashArchivo, hojasDetectadas, rutasDetectadas, idEstado, mensajeError)
      VALUES
      (?, ?, ?, ?, ?, ?, 1, NULL)
    ";

    $st = $mysqli->prepare($sqlArchivo);
    if (!$st) {
      throw new Exception("Error prepare INSERT archivo: " . $mysqli->error);
    }

    $st->bind_param(
      "isssii",
      $idDespacho,
      $tipoArchivo,
      $nombreArchivo,
      $hashArchivo,
      $hojasDetectadas,
      $rutasDetectadas
    );

    if (!$st->execute()) {
      throw new Exception("Error execute INSERT archivo: " . $st->error);
    }

    $idDespachoArchivo = (int)$mysqli->insert_id;
    $st->close();
    $totalArchivos++;

    foreach ($rutas as $rutaData) {
      $nombreRuta = trim((string)($rutaData["ruta"] ?? "Ruta ?"));
      $nombreListaCruce = trim((string)($rutaData["lista"] ?? $rutaData["nombreLista"] ?? $rutaData["ruta"] ?? $nombreRuta));
      if ($nombreListaCruce === "") {
        $nombreListaCruce = $nombreRuta;
      }
      $items = isset($rutaData["items"]) && is_array($rutaData["items"]) ? $rutaData["items"] : [];

      $idRuta = obtenerOCrearRuta($mysqli, $idDespacho, $idJornada, $nombreRuta, 1);
      if (!$idRuta) {
        throw new Exception("No se pudo crear/obtener la ruta: " . $nombreRuta);
      }

      $totalRutas++;

      foreach ($items as $item) {
        $consecutivo = isset($item["consecutivo"]) && $item["consecutivo"] !== null
          ? (int)$item["consecutivo"]
          : null;

        $productoNombre = trim((string)($item["producto"] ?? ""));
        $unidadExcel = trim((string)($item["unidad"] ?? ""));
        $cantidades = isset($item["cantidades"]) && is_array($item["cantidades"]) ? $item["cantidades"] : [];
        $totalCoberturaRuta = (float)($item["totalCoberturaRuta"] ?? 0);
        $cajasPacas = (float)($item["cajasPacas"] ?? 0);
        $unidades = (float)($item["unidades"] ?? 0);
        $lineaExcel = isset($item["lineaExcel"]) && $item["lineaExcel"] !== null
          ? (int)$item["lineaExcel"]
          : null;
        $hojaExcel = trim((string)($item["hojaExcel"] ?? ""));

        $productoMatch = buscarProductoCatalogo($mysqli, $productoNombre, $unidadExcel);
        $idProducto = $productoMatch["idProducto"];

        if (!$idProducto) {
          $productosNoRelacionados[] = [
            "archivo" => $nombreArchivo,
            "tipoArchivo" => $tipoArchivo,
            "idJornada" => $idJornada,
            "ruta" => $nombreRuta,
            "productoExcel" => $productoNombre,
            "unidadExcel" => $unidadExcel,
            "mejorCoincidencia" => $productoMatch["descripcion"],
            "presentacionCoincidente" => $productoMatch["presentacion"] ?? null,
            "productoBaseCoincidente" => $productoMatch["productoBase"] ?? null,
            "metodo" => $productoMatch["metodo"] ?? null,
            "score" => round((float)$productoMatch["score"], 2),
            "lineaExcel" => $lineaExcel,
            "hojaExcel" => $hojaExcel
          ];
          continue;
        }

        foreach ($cantidades as $colegioTexto => $cantidad) {
          $cantidad = (float)$cantidad;
          if ($cantidad == 0) continue;

          $idColegio = obtenerOCrearColegio($mysqli, $colegioTexto, $tipoDespacho, $nombreListaCruce);
          if (!$idColegio) {
            throw new Exception("No se pudo crear/obtener el colegio: " . $colegioTexto);
          }

          $conflictoRutaColegio = validarColegioEnOtraRutaMismaJornada(
            $mysqli,
            $idDespacho,
            $tipoArchivo,
            $idColegio,
            $idRuta,
            $tipoDespacho
          );

          if ($conflictoRutaColegio) {
            throw new Exception(json_encode([
              "tipo" => "colegio_en_otra_ruta",
              "mensaje" => "El colegio ya está asignado a otra ruta en la misma jornada del despacho",
              "archivo" => $nombreArchivo,
              "tipoArchivo" => $tipoArchivo,
              "idDespacho" => $idDespacho,
              "idJornada" => $idJornada,
              "rutaActual" => $nombreRuta,
              "idRutaActual" => $idRuta,
              "rutaExistente" => $conflictoRutaColegio["nombreRuta"] ?? null,
              "idRutaExistente" => isset($conflictoRutaColegio["idRuta"]) ? (int)$conflictoRutaColegio["idRuta"] : null,
              "colegio" => $colegioTexto,
              "idColegio" => $idColegio,
              "producto" => $productoNombre,
              "unidadExcel" => $unidadExcel,
              "idProducto" => $idProducto,
              "consecutivo" => $consecutivo,
              "cantidad" => $cantidad,
              "lineaExcel" => $lineaExcel,
              "hojaExcel" => $hojaExcel
            ], JSON_UNESCAPED_UNICODE));
          }

          $observacion = null;
          if (($productoMatch["score"] ?? 0) < 100) {
            $observacion = "Homologado por " . ($productoMatch["metodo"] ?? "similitud") . " (" . round((float)$productoMatch["score"], 2) . "%)";
          }

          $duplicado = obtenerDetalleDuplicadoExistente(
            $mysqli,
            $idDespachoArchivo,
            $idRuta,
            $idColegio,
            $idProducto,
            $consecutivo
          );

          if ($duplicado) {
            throw new Exception(json_encode([
              "tipo" => "duplicado_detalle",
              "mensaje" => "Se intentó insertar un detalle duplicado",
              "archivo" => $nombreArchivo,
              "tipoArchivo" => $tipoArchivo,
              "idDespacho" => $idDespacho,
              "idDespachoArchivo" => $idDespachoArchivo,
              "idJornada" => $idJornada,
              "ruta" => $nombreRuta,
              "idRuta" => $idRuta,
              "colegio" => $colegioTexto,
              "idColegio" => $idColegio,
              "producto" => $productoNombre,
              "unidadExcel" => $unidadExcel,
              "idProducto" => $idProducto,
              "consecutivo" => $consecutivo,
              "cantidad" => $cantidad,
              "totalCoberturaRuta" => $totalCoberturaRuta,
              "cajasPacas" => $cajasPacas,
              "unidades" => $unidades,
              "lineaExcel" => $lineaExcel,
              "hojaExcel" => $hojaExcel,
              "idDetalleExistente" => (int)$duplicado["id"]
            ], JSON_UNESCAPED_UNICODE));
          }

          $sqlDetalle = "
              INSERT INTO DetalleRutaProducto
              (
                idDespacho,
                idDespachoArchivo,
                idCarga,
                idRuta,
                idColegio,
                idProducto,
                productoExcel,
                unidadCoberturaExcel,
                consecutivo,
                cantidad,
                totalCoberturaRuta,
                cajasPacas,
                unidades,
                observacion
              )
              VALUES
              (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ";

          $st = $mysqli->prepare($sqlDetalle);
          if (!$st) {
            throw new Exception("Error prepare INSERT detalle: " . $mysqli->error);
          }

          $st->bind_param(
            "iiiiissidddds",
            $idDespacho,
            $idDespachoArchivo,
            $idRuta,
            $idColegio,
            $idProducto,
            $productoNombre,
            $unidadExcel,
            $consecutivo,
            $cantidad,
            $totalCoberturaRuta,
            $cajasPacas,
            $unidades,
            $observacion
          );

          if (!$st->execute()) {
            throw new Exception("Error execute INSERT detalle: " . $st->error);
          }

          $st->close();
          $totalDetalles++;
        }
      }
    }
  }

  $mysqli->commit();

  jexit(200, [
    "rpta" => "si",
    "mensaje" => "Detalle del despacho guardado correctamente",
    "data" => [
      "idDespacho" => $idDespacho,
      "tipoDespacho" => $tipoDespacho,
      "archivosRegistrados" => $totalArchivos,
      "rutasRegistradas" => $totalRutas,
      "detallesRegistrados" => $totalDetalles,
      "productosNoRelacionados" => $productosNoRelacionados
    ]
  ]);

} catch (Exception $e) {
  $mysqli->rollback();

  $rawMessage = $e->getMessage();
  $decoded = json_decode($rawMessage, true);

  if (is_array($decoded) && ($decoded["tipo"] ?? "") === "duplicado_detalle") {
    jexit(409, [
      "rpta" => "no",
      "mensaje" => "Se encontró un detalle duplicado",
      "error" => $decoded["mensaje"] ?? "Detalle duplicado",

      // Datos principales para mostrar fácil en el front
      "tipoError" => "duplicado_detalle",
      "archivo" => $decoded["archivo"] ?? null,
      "tipoArchivo" => $decoded["tipoArchivo"] ?? null,
      "colegio" => $decoded["colegio"] ?? null,
      "idColegio" => $decoded["idColegio"] ?? null,
      "ruta" => $decoded["ruta"] ?? null,
      "idRuta" => $decoded["idRuta"] ?? null,
      "producto" => $decoded["producto"] ?? null,
      "unidadExcel" => $decoded["unidadExcel"] ?? null,
      "consecutivo" => $decoded["consecutivo"] ?? null,
      "cantidad" => $decoded["cantidad"] ?? null,
      "lineaExcel" => $decoded["lineaExcel"] ?? null,
      "hojaExcel" => $decoded["hojaExcel"] ?? null,
      "idDetalleExistente" => $decoded["idDetalleExistente"] ?? null,

      // Objeto completo para depuración
      "duplicado" => $decoded
    ]);
  }

  if (is_array($decoded) && ($decoded["tipo"] ?? "") === "colegio_roldanillo_no_mapeado") {
    jexit(409, [
      "rpta" => "no",
      "mensaje" => "La sede educativa de Roldanillo no está mapeada",
      "error" => $decoded["mensaje"] ?? "Colegio Roldanillo no mapeado",
      "tipoError" => "colegio_roldanillo_no_mapeado",
      "nombreLista" => $decoded["nombreLista"] ?? null,
      "nombreListaNorm" => $decoded["nombreListaNorm"] ?? null,
      "colegio" => $decoded["colegio"] ?? null,
      "nombreColegio" => $decoded["nombreColegio"] ?? null,
      "nombreColegioNorm" => $decoded["nombreColegioNorm"] ?? null,
      "codigoGenerado" => $decoded["codigoGenerado"] ?? null,
      "detalle" => $decoded
    ]);
  }

  if (is_array($decoded) && ($decoded["tipo"] ?? "") === "colegio_en_otra_ruta") {
    jexit(409, [
      "rpta" => "no",
      "mensaje" => "El colegio ya está asignado a otra ruta en la misma jornada",
      "error" => $decoded["mensaje"] ?? "Conflicto de colegio y ruta",

      // Datos principales para mostrar fácil en el front
      "tipoError" => "colegio_en_otra_ruta",
      "archivo" => $decoded["archivo"] ?? null,
      "tipoArchivo" => $decoded["tipoArchivo"] ?? null,
      "colegio" => $decoded["colegio"] ?? null,
      "idColegio" => $decoded["idColegio"] ?? null,
      "rutaActual" => $decoded["rutaActual"] ?? null,
      "idRutaActual" => $decoded["idRutaActual"] ?? null,
      "rutaExistente" => $decoded["rutaExistente"] ?? null,
      "idRutaExistente" => $decoded["idRutaExistente"] ?? null,
      "producto" => $decoded["producto"] ?? null,
      "unidadExcel" => $decoded["unidadExcel"] ?? null,
      "consecutivo" => $decoded["consecutivo"] ?? null,
      "cantidad" => $decoded["cantidad"] ?? null,
      "lineaExcel" => $decoded["lineaExcel"] ?? null,
      "hojaExcel" => $decoded["hojaExcel"] ?? null,

      // Objeto completo para depuración
      "conflicto" => $decoded
    ]);
  }

  jexit(500, [
    "rpta" => "no",
    "mensaje" => "No se pudo guardar el detalle del despacho",
    "error" => $rawMessage,
    "tipoError" => "error_general_servicio"
  ]);
}