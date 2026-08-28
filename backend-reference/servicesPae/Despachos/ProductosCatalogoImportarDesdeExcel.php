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

function norm($value){
    $value = trim((string)($value ?? ""));
    $value = preg_replace('/\s+/u', ' ', $value);
    return $value;
}

function requiredArray($data, $key){
    return isset($data[$key]) && is_array($data[$key]) ? $data[$key] : [];
}

function requiredString($row, $key){
    return norm($row[$key] ?? "");
}

function normKey($txt){
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

/* =========================
   DB
========================= */
$mysqli = new mysqli("localhost", "accionpo_pae", "o#Ao0?ZEEec0s).i", "accionpo_pae");
if ($mysqli->connect_errno) {
    jexit(500, [
        "ok" => false,
        "mensaje" => "Error de conexión a base de datos",
        "error" => $mysqli->connect_error
    ]);
}
$mysqli->set_charset("utf8mb4");

/* =========================
   Validar método
========================= */
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    jexit(405, [
        "ok" => false,
        "mensaje" => "Método no permitido"
    ]);
}

/* =========================
   Leer JSON
========================= */
$raw = file_get_contents("php://input");
$data = json_decode($raw, true);

if (!is_array($data)) {
    jexit(400, [
        "ok" => false,
        "mensaje" => "JSON inválido"
    ]);
}

$hoja = requiredString($data, "hoja");
$vaciarTabla = !empty($data["vaciarTabla"]);

$categorias = requiredArray($data, "categorias");
$grupos = requiredArray($data, "grupos");
$productos = requiredArray($data, "productos");

if (!count($productos)) {
    jexit(400, [
        "ok" => false,
        "mensaje" => "No se recibieron productos para importar"
    ]);
}

$mysqli->begin_transaction();

try {
    $categoriasInsertadas = 0;
    $gruposInsertados = 0;
    $productosInsertados = 0;
    $productosActualizados = 0;
    $omitidos = [];

    /* =========================
       Vaciar tablas relacionadas
    ========================== */
    if ($vaciarTabla) {
        if (!$mysqli->query("DELETE FROM ProductosCatalogo")) {
            throw new Exception("No fue posible limpiar ProductosCatalogo: " . $mysqli->error);
        }

        if (!$mysqli->query("DELETE FROM GruposProducto")) {
            throw new Exception("No fue posible limpiar GruposProducto: " . $mysqli->error);
        }

        if (!$mysqli->query("DELETE FROM CategoriasProducto")) {
            throw new Exception("No fue posible limpiar CategoriasProducto: " . $mysqli->error);
        }

        $mysqli->query("ALTER TABLE ProductosCatalogo AUTO_INCREMENT = 1");
        $mysqli->query("ALTER TABLE GruposProducto AUTO_INCREMENT = 1");
        $mysqli->query("ALTER TABLE CategoriasProducto AUTO_INCREMENT = 1");
    }

    /* =========================
       Crear / obtener categorías iniciales
    ========================== */
    $mapCategorias = [];

    foreach ($categorias as $cat) {
        $nombre = requiredString($cat, "nombre");
        $idEstado = (int)($cat["idEstado"] ?? 1);

        if ($nombre === "") {
            continue;
        }

        $keyCat = normKey($nombre);
        if (isset($mapCategorias[$keyCat])) {
            continue;
        }

        $sql = "SELECT id FROM CategoriasProducto WHERE UPPER(TRIM(nombre)) = UPPER(TRIM(?)) LIMIT 1";
        $st = $mysqli->prepare($sql);
        if (!$st) {
            throw new Exception("Error prepare SELECT categoría: " . $mysqli->error);
        }

        $st->bind_param("s", $nombre);
        if (!$st->execute()) {
            throw new Exception("Error execute SELECT categoría: " . $st->error);
        }

        $st->store_result();
        $st->bind_result($idCategoriaExiste);
        $rowExiste = false;
        if ($st->fetch()) {
            $rowExiste = ["id" => $idCategoriaExiste];
        }
        $st->close();

        if ($rowExiste) {
            $mapCategorias[$keyCat] = (int)$rowExiste["id"];
            continue;
        }

        $sqlIns = "INSERT INTO CategoriasProducto (nombre, idEstado) VALUES (?, ?)";
        $st = $mysqli->prepare($sqlIns);
        if (!$st) {
            throw new Exception("Error prepare INSERT categoría: " . $mysqli->error);
        }

        $idEstadoFinal = $idEstado > 0 ? $idEstado : 1;
        $st->bind_param("si", $nombre, $idEstadoFinal);

        if (!$st->execute()) {
            throw new Exception("Error execute INSERT categoría: " . $st->error);
        }

        $mapCategorias[$keyCat] = (int)$mysqli->insert_id;
        $categoriasInsertadas++;
        $st->close();
    }

    /* =========================
       Crear / obtener grupos iniciales
    ========================== */
    $mapGrupos = [];

    foreach ($grupos as $grupo) {
        $codigo = requiredString($grupo, "codigo");
        $categoriaNombre = requiredString($grupo, "categoriaNombre");
        $estado = (int)($grupo["estado"] ?? 1);

        if ($codigo === "" || $categoriaNombre === "") {
            continue;
        }

        $keyCategoria = normKey($categoriaNombre);

        /* Crear categoría si no existe */
        if (!isset($mapCategorias[$keyCategoria])) {
            $sqlCat = "SELECT id FROM CategoriasProducto WHERE UPPER(TRIM(nombre)) = UPPER(TRIM(?)) LIMIT 1";
            $stCat = $mysqli->prepare($sqlCat);
            if (!$stCat) {
                throw new Exception("Error prepare SELECT categoría de grupo: " . $mysqli->error);
            }

            $stCat->bind_param("s", $categoriaNombre);
            if (!$stCat->execute()) {
                throw new Exception("Error execute SELECT categoría de grupo: " . $stCat->error);
            }

            $stCat->store_result();
            $stCat->bind_result($idCategoriaGrupoExiste);
            $rowCat = false;
            if ($stCat->fetch()) {
                $rowCat = ["id" => $idCategoriaGrupoExiste];
            }
            $stCat->close();

            if ($rowCat) {
                $mapCategorias[$keyCategoria] = (int)$rowCat["id"];
            } else {
                $sqlInsCat = "INSERT INTO CategoriasProducto (nombre, idEstado) VALUES (?, ?)";
                $stCat = $mysqli->prepare($sqlInsCat);
                if (!$stCat) {
                    throw new Exception("Error prepare INSERT categoría de grupo: " . $mysqli->error);
                }

                $idEstadoCategoria = 1;
                $stCat->bind_param("si", $categoriaNombre, $idEstadoCategoria);

                if (!$stCat->execute()) {
                    throw new Exception("Error execute INSERT categoría de grupo: " . $stCat->error);
                }

                $mapCategorias[$keyCategoria] = (int)$mysqli->insert_id;
                $categoriasInsertadas++;
                $stCat->close();
            }
        }

        $idCategoria = (int)$mapCategorias[$keyCategoria];
        $keyGrupo = normKey($codigo) . "||" . $idCategoria;

        if (isset($mapGrupos[$keyGrupo])) {
            continue;
        }

        $sql = "
            SELECT id
            FROM GruposProducto
            WHERE UPPER(TRIM(codigo)) = UPPER(TRIM(?))
              AND idCategoria = ?
            LIMIT 1
        ";
        $st = $mysqli->prepare($sql);
        if (!$st) {
            throw new Exception("Error prepare SELECT grupo: " . $mysqli->error);
        }

        $st->bind_param("si", $codigo, $idCategoria);
        if (!$st->execute()) {
            throw new Exception("Error execute SELECT grupo: " . $st->error);
        }

        $st->store_result();
        $st->bind_result($idGrupoExiste);
        $rowGrupoExiste = false;
        if ($st->fetch()) {
            $rowGrupoExiste = ["id" => $idGrupoExiste];
        }
        $st->close();

        if ($rowGrupoExiste) {
            $mapGrupos[$keyGrupo] = (int)$rowGrupoExiste["id"];
            continue;
        }

        $sqlIns = "INSERT INTO GruposProducto (codigo, idCategoria, estado) VALUES (?, ?, ?)";
        $st = $mysqli->prepare($sqlIns);
        if (!$st) {
            throw new Exception("Error prepare INSERT grupo: " . $mysqli->error);
        }

        $estadoFinal = $estado > 0 ? $estado : 1;
        $st->bind_param("sii", $codigo, $idCategoria, $estadoFinal);

        if (!$st->execute()) {
            throw new Exception("Error execute INSERT grupo: " . $st->error);
        }

        $mapGrupos[$keyGrupo] = (int)$mysqli->insert_id;
        $gruposInsertados++;
        $st->close();
    }

    /* =========================
       Insertar TODOS los productos
    ========================== */
    foreach ($productos as $index => $prod) {
        $codigo = requiredString($prod, "codigo");
        $descripcion = requiredString($prod, "descripcion");
        $grupoCodigo = requiredString($prod, "grupoCodigo");
        $categoriaNombre = requiredString($prod, "categoriaNombre");

        $idEmbalaje = isset($prod["idEmbalaje"]) && $prod["idEmbalaje"] !== "" ? (int)$prod["idEmbalaje"] : null;
        $observacion = isset($prod["observacion"]) ? norm($prod["observacion"]) : null;
        $estado = (int)($prod["estado"] ?? 1);
        $idEstado = (int)($prod["idEstado"] ?? 1);

        if ($codigo === "" || $descripcion === "" || $grupoCodigo === "" || $categoriaNombre === "") {
            $omitidos[] = [
                "indice" => $index,
                "codigo" => $codigo,
                "motivo" => "Producto incompleto"
            ];
            continue;
        }

        $keyCategoria = normKey($categoriaNombre);

        /* =========================================
           Crear categoría si no existe
        ========================================= */
        if (!isset($mapCategorias[$keyCategoria])) {
            $sqlCat = "SELECT id FROM CategoriasProducto WHERE UPPER(TRIM(nombre)) = UPPER(TRIM(?)) LIMIT 1";
            $stCat = $mysqli->prepare($sqlCat);
            if (!$stCat) {
                throw new Exception("Error prepare SELECT categoría producto: " . $mysqli->error);
            }

            $stCat->bind_param("s", $categoriaNombre);
            if (!$stCat->execute()) {
                throw new Exception("Error execute SELECT categoría producto: " . $stCat->error);
            }

            $stCat->store_result();
            $stCat->bind_result($idCategoriaProductoExiste);
            $rowCat = false;
            if ($stCat->fetch()) {
                $rowCat = ["id" => $idCategoriaProductoExiste];
            }
            $stCat->close();

            if ($rowCat) {
                $mapCategorias[$keyCategoria] = (int)$rowCat["id"];
            } else {
                $sqlInsCat = "INSERT INTO CategoriasProducto (nombre, idEstado) VALUES (?, ?)";
                $stCat = $mysqli->prepare($sqlInsCat);
                if (!$stCat) {
                    throw new Exception("Error prepare INSERT categoría producto: " . $mysqli->error);
                }

                $idEstadoCategoria = 1;
                $stCat->bind_param("si", $categoriaNombre, $idEstadoCategoria);

                if (!$stCat->execute()) {
                    throw new Exception("Error execute INSERT categoría producto: " . $stCat->error);
                }

                $mapCategorias[$keyCategoria] = (int)$mysqli->insert_id;
                $categoriasInsertadas++;
                $stCat->close();
            }
        }

        $idCategoria = (int)$mapCategorias[$keyCategoria];
        $keyGrupo = normKey($grupoCodigo) . "||" . $idCategoria;

        /* =========================================
           Crear grupo si no existe
        ========================================= */
        if (!isset($mapGrupos[$keyGrupo])) {
            $sqlGrupo = "
                SELECT id
                FROM GruposProducto
                WHERE UPPER(TRIM(codigo)) = UPPER(TRIM(?))
                  AND idCategoria = ?
                LIMIT 1
            ";
            $stGrupo = $mysqli->prepare($sqlGrupo);
            if (!$stGrupo) {
                throw new Exception("Error prepare SELECT grupo producto: " . $mysqli->error);
            }

            $stGrupo->bind_param("si", $grupoCodigo, $idCategoria);
            if (!$stGrupo->execute()) {
                throw new Exception("Error execute SELECT grupo producto: " . $stGrupo->error);
            }

            $stGrupo->store_result();
            $stGrupo->bind_result($idGrupoProductoExiste);
            $rowGrupo = false;
            if ($stGrupo->fetch()) {
                $rowGrupo = ["id" => $idGrupoProductoExiste];
            }
            $stGrupo->close();

            if ($rowGrupo) {
                $mapGrupos[$keyGrupo] = (int)$rowGrupo["id"];
            } else {
                $sqlInsGrupo = "INSERT INTO GruposProducto (codigo, idCategoria, estado) VALUES (?, ?, ?)";
                $stGrupo = $mysqli->prepare($sqlInsGrupo);
                if (!$stGrupo) {
                    throw new Exception("Error prepare INSERT grupo producto: " . $mysqli->error);
                }

                $estadoGrupo = 1;
                $stGrupo->bind_param("sii", $grupoCodigo, $idCategoria, $estadoGrupo);

                if (!$stGrupo->execute()) {
                    throw new Exception("Error execute INSERT grupo producto: " . $stGrupo->error);
                }

                $mapGrupos[$keyGrupo] = (int)$mysqli->insert_id;
                $gruposInsertados++;
                $stGrupo->close();
            }
        }

        $idGrupo = (int)$mapGrupos[$keyGrupo];

        $observacionFinal = ($observacion !== null && $observacion !== "") ? $observacion : null;
        $estadoFinal = $estado > 0 ? $estado : 1;
        $idEstadoFinal = $idEstado > 0 ? $idEstado : 1;

        $sqlIns = "
            INSERT INTO ProductosCatalogo
            (codigo, descripcion, idGrupo, idEmbalaje, observacion, estado, idEstado)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ";

        $st = $mysqli->prepare($sqlIns);
        if (!$st) {
            throw new Exception("Error prepare INSERT producto: " . $mysqli->error);
        }

        $st->bind_param(
            "ssiisii",
            $codigo,
            $descripcion,
            $idGrupo,
            $idEmbalaje,
            $observacionFinal,
            $estadoFinal,
            $idEstadoFinal
        );

        if (!$st->execute()) {
            throw new Exception("Error execute INSERT producto en índice {$index} (código {$codigo}): " . $st->error);
        }

        $productosInsertados++;
        $st->close();
    }

    $mysqli->commit();

    jexit(200, [
        "ok" => true,
        "mensaje" => "Catálogo importado correctamente",
        "hoja" => $hoja,
        "resumen" => [
            "categorias_recibidas" => count($categorias),
            "grupos_recibidos" => count($grupos),
            "productos_recibidos" => count($productos),
            "categorias_insertadas" => $categoriasInsertadas,
            "grupos_insertados" => $gruposInsertados,
            "productos_insertados" => $productosInsertados,
            "productos_actualizados" => $productosActualizados,
            "productos_omitidos" => count($omitidos)
        ],
        "omitidos" => $omitidos
    ]);

} catch (Throwable $e) {
    $mysqli->rollback();

    jexit(500, [
        "ok" => false,
        "mensaje" => "Error importando el catálogo",
        "error" => $e->getMessage()
    ]);
}