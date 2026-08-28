<?php
date_default_timezone_set("America/Bogota");


$DB_HOST = "localhost";
$DB_NAME = "accionpo_pae";
$DB_USER = "accionpo_pae";
$DB_PASS = "o#Ao0?ZEEec0s).i";

$conexion = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);

if ($conexion->connect_errno) {
    http_response_code(500);

    echo json_encode([
        "rpta" => false,
        "mensaje" => "Error de conexión a la base de datos",
        "error" => $conexion->connect_error
    ], JSON_UNESCAPED_UNICODE);

    exit;
}

$conexion->set_charset("utf8mb4");

/*
|--------------------------------------------------------------------------
| Alias de conexión
|--------------------------------------------------------------------------
| Se dejan varios alias para mantener compatibilidad con servicios anteriores.
| Así cualquier servicio puede usar $conexion, $mysqli, $conn o $con.
|--------------------------------------------------------------------------
*/

$mysqli = $conexion;
$conn = $conexion;
$con = $conexion;
?>