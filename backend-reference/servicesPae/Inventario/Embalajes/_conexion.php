<?php
declare(strict_types=1);

require_once __DIR__ . '/../conexion.php';

function embalajesJson(int $status, array $payload): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function embalajesConexion(): mysqli
{
    global $conexion;
    if (!isset($conexion) || !($conexion instanceof mysqli)) {
        embalajesJson(500, ['rpta' => 'no', 'mensaje' => 'No fue posible inicializar la conexión de base de datos.']);
    }
    return $conexion;
}

function embalajesCors(): void
{
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}
