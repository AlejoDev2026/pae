<?php
declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
error_reporting(E_ALL);

date_default_timezone_set('America/Bogota');

header('Expires: Tue, 01 Jan 2000 00:00:00 GMT');
header('Last-Modified: ' . gmdate('D, d M Y H:i:s') . ' GMT');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Cache-Control, Pragma, Expires, Authorization');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../conexion.php';

if (!isset($conexion) || !$conexion instanceof mysqli) {
    http_response_code(500);
    echo json_encode([
        'rpta' => 'no',
        'mensaje' => 'No fue posible iniciar el servicio de ordenes de alistamiento',
        'error' => 'conexion_no_disponible',
        'data' => []
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$conexion->set_charset('utf8mb4');

final class OAException extends RuntimeException
{
    public $httpStatus;
    public $tipoError;
    public $datos;

    public function __construct(
        string $mensaje,
        int $httpStatus = 400,
        string $tipoError = 'validacion_funcional',
        array $datos = []
    ) {
        parent::__construct($mensaje);
        $this->httpStatus = $httpStatus;
        $this->tipoError = $tipoError;
        $this->datos = $datos;
    }
}

function oa_responder(
    string $rpta,
    string $mensaje,
    $data = [],
    array $extra = [],
    int $codigoHttp = 200
): void {
    http_response_code($codigoHttp);

    echo json_encode(array_merge([
        'rpta' => $rpta,
        'mensaje' => $mensaje,
        'data' => $data
    ], $extra), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function oa_lanzar(
    string $mensaje,
    int $codigoHttp = 400,
    string $tipoError = 'validacion_funcional',
    array $datos = []
): void {
    throw new OAException($mensaje, $codigoHttp, $tipoError, $datos);
}

function oa_manejar_error(Throwable $error, string $mensaje = 'Ocurrio un error procesando la orden de alistamiento'): void
{
    global $conexion;

    if (isset($conexion) && $conexion instanceof mysqli) {
        @$conexion->rollback();
    }

    if ($error instanceof OAException) {
        oa_responder(
            'no',
            $error->getMessage(),
            $error->datos,
            ['tipoError' => $error->tipoError],
            $error->httpStatus
        );
    }

    error_log('[OrdenesAlistamiento] ' . $error->getMessage());
    oa_responder('no', $mensaje, [], ['error' => 'error_interno_controlado'], 500);
}

function oa_iniciar_transaccion(): void
{
    global $conexion;

    if (!$conexion->begin_transaction()) {
        throw new RuntimeException('No fue posible iniciar la transaccion de la orden de alistamiento');
    }
}

function oa_confirmar_transaccion(): void
{
    global $conexion;

    if (!$conexion->commit()) {
        throw new RuntimeException('No fue posible confirmar la transaccion de la orden de alistamiento');
    }
}

function oa_validar_metodo(string $metodo): void
{
    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== strtoupper($metodo)) {
        oa_responder('no', 'Metodo no permitido', [], ['tipoError' => 'metodo_no_permitido'], 405);
    }
}

function oa_limpiar($valor): string
{
    return trim((string)($valor ?? ''));
}

function oa_decimal($valor): float
{
    if ($valor === null || $valor === '') {
        return 0.0;
    }

    $numero = (float)str_replace(',', '.', (string)$valor);
    if (!is_finite($numero)) {
        return 0.0;
    }

    return round($numero, 3);
}

function oa_decimal_entrada($valor, string $campo = 'cantidad'): float
{
    $texto = trim((string)($valor ?? ''));
    if (!preg_match('/^-?\d+(?:[\.,]\d{1,3})?$/', $texto)) {
        oa_lanzar(
            'La ' . $campo . ' debe ser un numero valido con maximo tres decimales',
            422,
            'cantidad_invalida'
        );
    }

    $numero = (float)str_replace(',', '.', $texto);
    if (!is_finite($numero) || abs($numero) > 99999999999.999) {
        oa_lanzar(
            'La ' . $campo . ' supera el rango permitido',
            422,
            'cantidad_fuera_de_rango'
        );
    }

    return round($numero, 3);
}

function oa_json(): array
{
    static $entrada = null;

    if ($entrada !== null) {
        return $entrada;
    }

    $raw = file_get_contents('php://input');
    $json = json_decode((string)$raw, true);
    $entrada = is_array($json) ? array_merge($_POST, $json) : $_POST;
    return $entrada;
}

function oa_parametro(string $nombre, $default = '')
{
    if (array_key_exists($nombre, $_GET)) {
        return $_GET[$nombre];
    }

    $entrada = oa_json();
    return array_key_exists($nombre, $entrada) ? $entrada[$nombre] : $default;
}

function oa_vincular(mysqli_stmt $stmt, string $tipos, array &$valores): void
{
    if ($tipos === '') {
        return;
    }

    if (strlen($tipos) !== count($valores)) {
        throw new RuntimeException('Cantidad de parametros inconsistente');
    }

    $referencias = [];
    $referencias[] = &$tipos;

    foreach ($valores as $indice => $valor) {
        $referencias[] = &$valores[$indice];
    }

    if (!call_user_func_array([$stmt, 'bind_param'], $referencias)) {
        throw new RuntimeException('No fue posible vincular los parametros de la consulta');
    }
}

function oa_consultar(string $sql, string $tipos = '', array $valores = []): array
{
    global $conexion;

    $stmt = $conexion->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('No fue posible preparar una consulta de ordenes de alistamiento');
    }

    try {
        oa_vincular($stmt, $tipos, $valores);
        if (!$stmt->execute()) {
            throw new RuntimeException('No fue posible ejecutar una consulta de ordenes de alistamiento');
        }

        $metadata = $stmt->result_metadata();
        if (!$metadata) {
            return [];
        }

        $fila = [];
        $referencias = [];
        $campos = [];

        while ($campo = $metadata->fetch_field()) {
            $nombre = $campo->name;
            $campos[] = $nombre;
            $fila[$nombre] = null;
            $referencias[] = &$fila[$nombre];
        }

        call_user_func_array([$stmt, 'bind_result'], $referencias);

        $resultado = [];
        while ($stmt->fetch()) {
            $copia = [];
            foreach ($campos as $nombre) {
                $copia[$nombre] = $fila[$nombre];
            }
            $resultado[] = $copia;
        }

        $metadata->free();
        return $resultado;
    } finally {
        $stmt->close();
    }
}

function oa_fila(string $sql, string $tipos = '', array $valores = []): ?array
{
    $filas = oa_consultar($sql, $tipos, $valores);
    return $filas[0] ?? null;
}

function oa_ejecutar(string $sql, string $tipos = '', array $valores = []): array
{
    global $conexion;

    $stmt = $conexion->prepare($sql);
    if (!$stmt) {
        throw new RuntimeException('No fue posible preparar una operacion de ordenes de alistamiento');
    }

    try {
        oa_vincular($stmt, $tipos, $valores);
        if (!$stmt->execute()) {
            throw new RuntimeException('No fue posible ejecutar una operacion de ordenes de alistamiento');
        }

        return [
            'insert_id' => (int)$stmt->insert_id,
            'affected_rows' => (int)$stmt->affected_rows
        ];
    } finally {
        $stmt->close();
    }
}

function oa_token_bearer(): string
{
    $cabecera = '';

    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $cabecera = (string)$_SERVER['HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $cabecera = (string)$_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (function_exists('getallheaders')) {
        $headers = getallheaders();
        $cabecera = (string)($headers['Authorization'] ?? $headers['authorization'] ?? '');
    }

    if (!preg_match('/^Bearer\s+(.+)$/i', trim($cabecera), $coincidencias)) {
        oa_lanzar('La sesion es obligatoria', 401, 'sesion_requerida');
    }

    return trim($coincidencias[1]);
}

function oa_usuario_autenticado(): array
{
    static $usuario = null;

    if ($usuario !== null) {
        return $usuario;
    }

    $token = oa_token_bearer();
    $usuario = oa_fila(
        "SELECT id, nombre, correo, rol, estado
         FROM usuarios
         WHERE tokenSesion = ? AND estado = 1
         LIMIT 1",
        's',
        [$token]
    );

    if (!$usuario) {
        oa_lanzar('La sesion no es valida o ya expiro', 401, 'sesion_invalida');
    }

    $usuario['id'] = (int)$usuario['id'];
    $usuario['rol'] = (int)$usuario['rol'];
    $usuario['estado'] = (int)$usuario['estado'];

    $idSolicitado = (int)oa_parametro('idUsuario', oa_parametro('idUsuarioRegistro', 0));
    if ($idSolicitado > 0 && $idSolicitado !== $usuario['id']) {
        oa_lanzar('El usuario enviado no corresponde a la sesion activa', 403, 'usuario_sesion_no_coincide');
    }

    return $usuario;
}

function oa_roles_administrativos(): array
{
    $roles = [1];

    if (defined('INVENTARIO_ROLES_ADMIN_ALISTAMIENTO')) {
        $config = constant('INVENTARIO_ROLES_ADMIN_ALISTAMIENTO');
        $valores = is_array($config) ? $config : explode(',', (string)$config);
        foreach ($valores as $valor) {
            $id = (int)$valor;
            if ($id > 0) {
                $roles[] = $id;
            }
        }
    }

    return array_values(array_unique($roles));
}

function oa_es_admin(array $usuario): bool
{
    return in_array((int)($usuario['rol'] ?? 0), oa_roles_administrativos(), true);
}

function oa_requerir_admin(array $usuario): void
{
    if (!oa_es_admin($usuario)) {
        oa_lanzar('No tiene permisos para realizar esta operacion', 403, 'permiso_administrativo_requerido');
    }
}

function oa_operador_por_usuario(int $idUsuario): ?array
{
    if ($idUsuario <= 0) {
        return null;
    }

    $fila = oa_fila(
        "SELECT
            io.id AS idOperador,
            io.idUsuario,
            io.codigo,
            io.documento,
            io.nombreCompleto,
            io.nombre,
            io.apellido,
            io.cargo,
            io.estado AS estadoOperador,
            u.estado AS estadoUsuario
         FROM InventarioOperadores io
         INNER JOIN usuarios u ON u.id = io.idUsuario
         WHERE io.idUsuario = ? AND io.estado = 1 AND u.estado = 1
         LIMIT 1",
        'i',
        [$idUsuario]
    );

    if (!$fila) {
        return null;
    }

    $fila['idOperador'] = (int)$fila['idOperador'];
    $fila['idUsuario'] = (int)$fila['idUsuario'];
    $fila['estadoOperador'] = (int)$fila['estadoOperador'];
    $fila['estadoUsuario'] = (int)$fila['estadoUsuario'];
    $nombre = oa_limpiar($fila['nombreCompleto'] ?? '');
    if ($nombre === '') {
        $nombre = oa_limpiar(($fila['nombre'] ?? '') . ' ' . ($fila['apellido'] ?? ''));
    }
    $fila['nombreCompleto'] = $nombre;

    return $fila;
}

function oa_validar_operador_activo(int $idOperador): array
{
    $fila = oa_fila(
        "SELECT
            io.id AS idOperador,
            io.idUsuario,
            io.codigo,
            io.documento,
            io.nombreCompleto,
            io.nombre,
            io.apellido,
            io.cargo,
            io.estado AS estadoOperador,
            u.estado AS estadoUsuario
         FROM InventarioOperadores io
         INNER JOIN usuarios u ON u.id = io.idUsuario
         WHERE io.id = ? AND io.estado = 1 AND u.estado = 1
         LIMIT 1",
        'i',
        [$idOperador]
    );

    if (!$fila) {
        oa_lanzar('El operador no existe o no esta habilitado', 422, 'operador_no_habilitado');
    }

    $fila['idOperador'] = (int)$fila['idOperador'];
    $fila['idUsuario'] = (int)$fila['idUsuario'];
    $fila['nombreCompleto'] = oa_limpiar($fila['nombreCompleto'] ?: (($fila['nombre'] ?? '') . ' ' . ($fila['apellido'] ?? '')));
    return $fila;
}

function oa_estado(string $codigo): array
{
    static $cache = [];

    if (isset($cache[$codigo])) {
        return $cache[$codigo];
    }

    $fila = oa_fila(
        'SELECT id, codigo, nombre, descripcion FROM Estados WHERE codigo = ? AND estado = 1 LIMIT 1',
        's',
        [$codigo]
    );

    if (!$fila) {
        throw new RuntimeException('No esta configurado el estado requerido: ' . $codigo);
    }

    $fila['id'] = (int)$fila['id'];
    $cache[$codigo] = $fila;
    return $fila;
}

function oa_estado_proceso(string $codigo): string
{
    $mapa = [
        'OA_ALIST_PENDIENTE_ASIGNAR' => 'PENDIENTE_ASIGNACION',
        'OA_ALIST_ASIGNADA' => 'ASIGNADA',
        'OA_ALIST_EN_PROCESO' => 'EN_ALISTAMIENTO',
        'OA_ALIST_PARCIAL' => 'ALISTADA_CON_PENDIENTES',
        'OA_ALIST_FINALIZADA' => 'ALISTADA_COMPLETA',
        'OA_ALIST_CANCELADA' => 'CANCELADA'
    ];

    return $mapa[$codigo] ?? $codigo;
}

function oa_estado_logistica_simple(string $codigo): string
{
    $mapa = [
        'OA_LOG_PENDIENTE' => 'PENDIENTE',
        'OA_LOG_PARCIAL' => 'EN_LOGISTICA_PARCIAL',
        'OA_LOG_EN_LOGISTICA' => 'EN_LOGISTICA',
        'OA_LOG_CANCELADA' => 'CANCELADA'
    ];

    return $mapa[$codigo] ?? $codigo;
}

function oa_consecutivo(string $prefijo): string
{
    return $prefijo . '-' . date('Ymd-His') . '-' . strtoupper(bin2hex(random_bytes(3)));
}

function oa_orden_base(int $idOrden, bool $bloquear = false): ?array
{
    $sql = "SELECT
                o.*,
                ea.codigo AS estadoAlistamientoCodigo,
                ea.nombre AS estadoAlistamientoNombre,
                el.codigo AS estadoLogisticaCodigo,
                el.nombre AS estadoLogisticaNombre,
                d.codigo AS codigoDespacho,
                d.fechaDespacho,
                d.fechaConsumoDesde,
                d.fechaConsumoHasta,
                d.contrato,
                d.tipoDespacho,
                d.tipoPeriodo,
                d.descripcion AS descripcionDespacho,
                op.codigo AS codigoOperador,
                op.nombreCompleto AS nombreOperador,
                op.cargo AS cargoOperador,
                op.idUsuario AS idUsuarioOperador
            FROM InventarioOrdenesAlistamiento o
            INNER JOIN Estados ea ON ea.id = o.idEstadoAlistamiento
            INNER JOIN Estados el ON el.id = o.idEstadoLogistica
            INNER JOIN DespachosInforme d ON d.id = o.idDespachoInforme
            LEFT JOIN InventarioOperadores op ON op.id = o.idOperadorAsignado
            WHERE o.id = ?
            LIMIT 1";

    if ($bloquear) {
        $sql .= ' FOR UPDATE';
    }

    return oa_fila($sql, 'i', [$idOrden]);
}

function oa_totales_orden(int $idOrden): array
{
    $fila = oa_fila(
        "SELECT
            COUNT(*) AS totalProductos,
            COALESCE(SUM(cantidadSolicitada), 0) AS cantidadSolicitada,
            COALESCE(SUM(cantidadReservada), 0) AS cantidadReservada,
            COALESCE(SUM(cantidadAlistada), 0) AS cantidadAlistada,
            COALESCE(SUM(cantidadPendiente), 0) AS cantidadPendiente,
            COALESCE(SUM(cantidadExcedente), 0) AS cantidadExcedente,
            COALESCE(SUM(cantidadEnviada), 0) AS cantidadEnviada
         FROM InventarioOrdenesAlistamientoDetalle
         WHERE idOrdenAlistamiento = ?",
        'i',
        [$idOrden]
    ) ?: [];

    $solicitada = oa_decimal($fila['cantidadSolicitada'] ?? 0);
    $reservada = oa_decimal($fila['cantidadReservada'] ?? 0);
    $alistada = oa_decimal($fila['cantidadAlistada'] ?? 0);
    $pendiente = oa_decimal($fila['cantidadPendiente'] ?? 0);
    $excedente = oa_decimal($fila['cantidadExcedente'] ?? 0);
    $enviada = oa_decimal($fila['cantidadEnviada'] ?? 0);

    return [
        'totalProductos' => (int)($fila['totalProductos'] ?? 0),
        'cantidadSolicitada' => $solicitada,
        'cantidadReservada' => $reservada,
        'cantidadAlistada' => $alistada,
        'cantidadPendiente' => $pendiente,
        'cantidadExcedente' => $excedente,
        'cantidadEnviada' => $enviada,
        'totalSolicitado' => $solicitada,
        'totalCantidad' => $solicitada,
        'totalReservado' => $reservada,
        'totalAlistado' => $alistada,
        'totalPendiente' => $pendiente,
        'totalExcedente' => $excedente,
        'totalEnviado' => $enviada
    ];
}

function oa_asignacion_activa(int $idOrden, bool $bloquear = false): ?array
{
    $sql = "SELECT a.*, op.idUsuario, op.codigo AS codigoOperador, op.nombreCompleto AS nombreOperador, op.cargo
            FROM InventarioOrdenesAlistamientoAsignaciones a
            INNER JOIN InventarioOperadores op ON op.id = a.idOperador
            WHERE a.idOrdenAlistamiento = ?
              AND a.estadoAsignacion IN ('ASIGNADA', 'EN_PROCESO')
            ORDER BY a.id DESC
            LIMIT 1";
    if ($bloquear) {
        $sql .= ' FOR UPDATE';
    }
    return oa_fila($sql, 'i', [$idOrden]);
}

function oa_capacidades(array $orden, array $usuario, ?array $operador, array $totales): array
{
    $estado = (string)($orden['estadoAlistamientoCodigo'] ?? '');
    $esAdmin = oa_es_admin($usuario);
    $esAsignado = $operador
        && (int)($orden['idOperadorAsignado'] ?? 0) === (int)$operador['idOperador'];
    $cancelada = $estado === 'OA_ALIST_CANCELADA';

    return [
        'puedeAsignar' => $esAdmin && $estado === 'OA_ALIST_PENDIENTE_ASIGNAR',
        'puedeReasignar' => $esAdmin
            && $totales['cantidadPendiente'] > 0
            && (
                $estado === 'OA_ALIST_ASIGNADA'
                || (
                    in_array($estado, ['OA_ALIST_PARCIAL', 'OA_ALIST_FINALIZADA'], true)
                    && $totales['cantidadAlistada'] <= $totales['cantidadEnviada'] + 0.0001
                )
            ),
        'puedeIniciar' => $esAsignado && $estado === 'OA_ALIST_ASIGNADA',
        'puedeGuardarAvance' => $esAsignado && $estado === 'OA_ALIST_EN_PROCESO',
        'puedeFinalizar' => $esAsignado && $estado === 'OA_ALIST_EN_PROCESO',
        'puedeEnviarLogistica' => $esAdmin
            && in_array($estado, ['OA_ALIST_PARCIAL', 'OA_ALIST_FINALIZADA'], true)
            && $totales['cantidadAlistada'] > $totales['cantidadEnviada'],
        'puedeAnular' => $esAdmin && !$cancelada && $totales['cantidadEnviada'] <= 0,
        'puedeVerHistorial' => $esAdmin || $esAsignado
    ];
}

function oa_formatear_orden(array $fila, array $usuario, ?array $operador = null): array
{
    $idOrden = (int)$fila['id'];
    $totales = oa_totales_orden($idOrden);
    $estadoAlistamientoCodigo = (string)$fila['estadoAlistamientoCodigo'];
    $estadoLogisticaCodigo = (string)$fila['estadoLogisticaCodigo'];

    $operadorData = null;
    if (!empty($fila['idOperadorAsignado'])) {
        $operadorData = [
            'idOperador' => (int)$fila['idOperadorAsignado'],
            'idUsuario' => $fila['idUsuarioOperador'] !== null ? (int)$fila['idUsuarioOperador'] : null,
            'codigo' => $fila['codigoOperador'],
            'nombre' => $fila['nombreOperador'],
            'nombreCompleto' => $fila['nombreOperador'],
            'cargo' => $fila['cargoOperador']
        ];
    }

    return [
        'id' => $idOrden,
        'idOrdenAlistamiento' => $idOrden,
        'codigo' => $fila['consecutivo'],
        'consecutivo' => $fila['consecutivo'],
        'idDespacho' => (int)$fila['idDespachoInforme'],
        'idDespachoInforme' => (int)$fila['idDespachoInforme'],
        'codigoDespacho' => $fila['codigoDespacho'],
        'tipoInforme' => $fila['tipoInforme'],
        'alcance' => $fila['alcance'],
        'hashFuente' => $fila['hashFuente'],
        'estadoProceso' => oa_estado_proceso($estadoAlistamientoCodigo),
        'estadoAlistamientoCodigo' => $estadoAlistamientoCodigo,
        'estadoAlistamiento' => $fila['estadoAlistamientoNombre'],
        'estadoLogisticaCodigo' => $estadoLogisticaCodigo,
        'estadoLogistica' => oa_estado_logistica_simple($estadoLogisticaCodigo),
        'estadoLogisticaNombre' => $fila['estadoLogisticaNombre'],
        'idOperadorAsignado' => $fila['idOperadorAsignado'] !== null ? (int)$fila['idOperadorAsignado'] : null,
        'operador' => $operadorData,
        'idUsuarioRegistro' => $fila['idUsuarioRegistro'] !== null ? (int)$fila['idUsuarioRegistro'] : null,
        'idUsuarioUltimaAsignacion' => $fila['idUsuarioUltimaAsignacion'] !== null ? (int)$fila['idUsuarioUltimaAsignacion'] : null,
        'fechaGeneracion' => $fila['fechaGeneracion'],
        'fechaUltimaAsignacion' => $fila['fechaUltimaAsignacion'],
        'fechaInicioAlistamiento' => $fila['fechaInicioAlistamiento'],
        'fechaFinalizacionAlistamiento' => $fila['fechaFinalizacionAlistamiento'],
        'fechaPrimerEnvioLogistica' => $fila['fechaPrimerEnvioLogistica'],
        'fechaUltimoEnvioLogistica' => $fila['fechaUltimoEnvioLogistica'],
        'observacion' => $fila['observacion'],
        'versionRegistro' => (int)$fila['versionRegistro'],
        'despacho' => [
            'id' => (int)$fila['idDespachoInforme'],
            'codigo' => $fila['codigoDespacho'],
            'fechaDespacho' => $fila['fechaDespacho'],
            'fechaConsumoDesde' => $fila['fechaConsumoDesde'],
            'fechaConsumoHasta' => $fila['fechaConsumoHasta'],
            'contrato' => $fila['contrato'],
            'tipoDespacho' => $fila['tipoDespacho'],
            'tipoPeriodo' => $fila['tipoPeriodo'],
            'descripcion' => $fila['descripcionDespacho']
        ],
        'totales' => $totales,
        'totalProductos' => $totales['totalProductos'],
        'cantidadSolicitada' => $totales['cantidadSolicitada'],
        'cantidadReservada' => $totales['cantidadReservada'],
        'cantidadAlistada' => $totales['cantidadAlistada'],
        'cantidadPendiente' => $totales['cantidadPendiente'],
        'cantidadExcedente' => $totales['cantidadExcedente'],
        'cantidadEnviada' => $totales['cantidadEnviada'],
        'capacidades' => oa_capacidades($fila, $usuario, $operador, $totales),
        'created_at' => $fila['created_at'],
        'updated_at' => $fila['updated_at']
    ];
}

function oa_validar_acceso_orden(array $orden, array $usuario, ?array $operador): void
{
    if (oa_es_admin($usuario)) {
        return;
    }

    if (!$operador || (int)($orden['idOperadorAsignado'] ?? 0) !== (int)$operador['idOperador']) {
        oa_lanzar('La orden no esta asignada al operador autenticado', 403, 'orden_no_asignada');
    }
}

function oa_registrar_historial(array $evento): int
{
    $valores = [
        (int)$evento['idOrdenAlistamiento'],
        $evento['idDetalleOrden'] ?? null,
        $evento['idAsignacion'] ?? null,
        $evento['idReservaAlistamiento'] ?? null,
        $evento['idEnvio'] ?? null,
        $evento['idMovimientoInventario'] ?? null,
        (string)$evento['evento'],
        $evento['idEstadoAlistamientoAnterior'] ?? null,
        $evento['idEstadoAlistamientoNuevo'] ?? null,
        $evento['idEstadoLogisticaAnterior'] ?? null,
        $evento['idEstadoLogisticaNuevo'] ?? null,
        array_key_exists('cantidad', $evento) && $evento['cantidad'] !== null ? oa_decimal($evento['cantidad']) : null,
        $evento['idUsuario'] ?? null,
        $evento['idOperador'] ?? null,
        $evento['observacion'] ?? null,
        !empty($evento['datos']) ? json_encode($evento['datos'], JSON_UNESCAPED_UNICODE) : null
    ];

    $resultado = oa_ejecutar(
        "INSERT INTO InventarioOrdenesAlistamientoHistorial
        (idOrdenAlistamiento, idDetalleOrden, idAsignacion, idReservaAlistamiento, idEnvio,
         idMovimientoInventario, evento, idEstadoAlistamientoAnterior, idEstadoAlistamientoNuevo,
         idEstadoLogisticaAnterior, idEstadoLogisticaNuevo, cantidad, idUsuario, idOperador,
         observacion, datos, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
        'iiiiiisiiiidiiss',
        $valores
    );

    return (int)$resultado['insert_id'];
}

function oa_registrar_movimiento(
    ?int $idDocumento,
    ?int $idDocumentoDetalle,
    int $idProducto,
    ?int $idLote,
    int $idBodega,
    ?int $idUbicacion,
    string $tipoMovimiento,
    float $cantidad,
    float $saldoAnterior,
    float $saldoNuevo,
    int $idUsuario,
    ?int $idOperador,
    ?string $observacion
): int {
    $resultado = oa_ejecutar(
        "INSERT INTO InventarioMovimientos
        (idDocumento, idDocumentoDetalle, idProducto, idLote, idBodega, idUbicacion,
         tipoMovimiento, cantidad, saldoAnterior, saldoNuevo, idUsuario, fechaMovimiento,
         observacion, idUsuarioRegistro, idOperador)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?)",
        'iiiiiisdddisii',
        [
            $idDocumento,
            $idDocumentoDetalle,
            $idProducto,
            $idLote,
            $idBodega,
            $idUbicacion,
            $tipoMovimiento,
            $cantidad,
            $saldoAnterior,
            $saldoNuevo,
            $idUsuario,
            $observacion,
            $idUsuario,
            $idOperador
        ]
    );

    return (int)$resultado['insert_id'];
}

function oa_producto_configurado(int $idProducto): ?array
{
    return oa_fila(
        "SELECT
            pc.id, pc.codigo, pc.descripcion, pc.idEmbalaje,
            pic.manejaLote, pic.manejaVencimiento, pic.unidadBaseInventario, pic.estado,
            e.presentacion, e.embalaje, e.`uni/caja` AS uniCaja
         FROM ProductosCatalogo pc
         INNER JOIN ProductosInventarioConfig pic ON pic.idProducto = pc.id AND pic.estado = 1
         LEFT JOIN EmbalajeCatalogo e ON e.id = pc.idEmbalaje
         WHERE pc.id = ? AND pc.estado = 1 AND COALESCE(pc.idEstado, 1) = 1
         LIMIT 1",
        'i',
        [$idProducto]
    );
}

function oa_existencias_disponibles(int $idProducto, bool $bloquear = true): array
{
    $producto = oa_producto_configurado($idProducto);
    if (!$producto) {
        return [];
    }

    $sql = "SELECT
                ex.id AS idExistencia,
                ex.idProducto,
                ex.idLote,
                ex.idBodega,
                ex.idUbicacion,
                ex.cantidadDisponible,
                ex.cantidadReservada,
                ex.cantidadBloqueada,
                b.codigo AS codigoBodega,
                b.nombre AS bodega,
                u.codigo AS codigoUbicacion,
                u.nombre AS ubicacion,
                l.lote,
                l.fechaVencimiento
            FROM InventarioExistencias ex
            INNER JOIN BodegasInventario b ON b.id = ex.idBodega AND b.estado = 1
            LEFT JOIN UbicacionesInventario u
                ON u.id = ex.idUbicacion AND u.idBodega = ex.idBodega
            LEFT JOIN InventarioLotes l
                ON l.id = ex.idLote AND l.idProducto = ex.idProducto
            WHERE ex.idProducto = ?
              AND ex.cantidadDisponible > 0
              AND (ex.idUbicacion IS NULL OR u.estado = 1)";

    if ((int)$producto['manejaLote'] === 1) {
        $sql .= " AND ex.idLote IS NOT NULL AND l.estado = 1";
    }

    if ((int)$producto['manejaVencimiento'] === 1) {
        $sql .= " AND (
            l.fechaVencimiento IS NULL OR l.fechaVencimiento = '' OR
            l.fechaVencimiento = '0000-00-00' OR l.fechaVencimiento >= CURDATE()
        )";
    }

    $sql .= " ORDER BY
        CASE
            WHEN l.fechaVencimiento IS NULL OR l.fechaVencimiento = '0000-00-00' THEN 2
            ELSE 1
        END,
        l.fechaVencimiento ASC,
        ex.id ASC";

    if ($bloquear) {
        $sql .= ' FOR UPDATE';
    }

    return oa_consultar($sql, 'i', [$idProducto]);
}

function oa_actualizar_existencia_reserva(int $idExistencia, float $cantidad): array
{
    $existencia = oa_fila(
        "SELECT id, idProducto, idLote, idBodega, idUbicacion,
                cantidadDisponible, cantidadReservada, cantidadBloqueada
         FROM InventarioExistencias
         WHERE id = ?
         LIMIT 1 FOR UPDATE",
        'i',
        [$idExistencia]
    );

    if (!$existencia) {
        oa_lanzar('La existencia seleccionada ya no esta disponible', 409, 'existencia_no_disponible');
    }

    $anterior = oa_decimal($existencia['cantidadDisponible']);
    if ($cantidad <= 0 || $anterior + 0.0001 < $cantidad) {
        oa_lanzar(
            'No hay existencia suficiente para respaldar la cantidad adicional',
            409,
            'stock_adicional_insuficiente',
            [
                'idExistencia' => $idExistencia,
                'cantidadAdicionalSolicitada' => $cantidad,
                'cantidadDisponibleAdicional' => $anterior
            ]
        );
    }

    $resultado = oa_ejecutar(
        "UPDATE InventarioExistencias
         SET cantidadDisponible = cantidadDisponible - ?,
             cantidadReservada = cantidadReservada + ?,
             updated_at = NOW()
         WHERE id = ? AND cantidadDisponible >= ?",
        'ddid',
        [$cantidad, $cantidad, $idExistencia, $cantidad]
    );

    if ($resultado['affected_rows'] !== 1) {
        oa_lanzar(
            'La existencia cambio mientras se registraba el alistamiento',
            409,
            'stock_adicional_insuficiente',
            ['idExistencia' => $idExistencia]
        );
    }

    $existencia['saldoDisponibleAnterior'] = $anterior;
    $existencia['saldoDisponibleNuevo'] = oa_decimal($anterior - $cantidad);
    return $existencia;
}

function oa_crear_reserva(
    int $idOrden,
    int $idDetalle,
    array $existencia,
    float $cantidad,
    int $idUsuario,
    ?int $idOperador,
    string $tipoMovimiento = 'RESERVA_ALISTAMIENTO'
): int {
    $idExistencia = (int)$existencia['idExistencia'];
    $actualizada = oa_actualizar_existencia_reserva($idExistencia, $cantidad);

    $resultado = oa_ejecutar(
        "INSERT INTO InventarioOrdenesAlistamientoReservas
        (idDetalleOrden, idExistencia, idBodega, idUbicacion, idLote,
         cantidadReservada, cantidadAlistada, cantidadLiberada, cantidadEnviada,
         estadoReserva, idUsuarioReserva, idUsuarioActualiza, versionRegistro,
         observacion, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 'RESERVADA', ?, ?, 1, NULL, NOW(), NOW())",
        'iiiiidii',
        [
            $idDetalle,
            $idExistencia,
            (int)$actualizada['idBodega'],
            $actualizada['idUbicacion'] !== null ? (int)$actualizada['idUbicacion'] : null,
            $actualizada['idLote'] !== null ? (int)$actualizada['idLote'] : null,
            $cantidad,
            $idUsuario,
            $idUsuario
        ]
    );

    $idReserva = (int)$resultado['insert_id'];
    $idMovimiento = oa_registrar_movimiento(
        null,
        null,
        (int)$actualizada['idProducto'],
        $actualizada['idLote'] !== null ? (int)$actualizada['idLote'] : null,
        (int)$actualizada['idBodega'],
        $actualizada['idUbicacion'] !== null ? (int)$actualizada['idUbicacion'] : null,
        $tipoMovimiento,
        $cantidad,
        (float)$actualizada['saldoDisponibleAnterior'],
        (float)$actualizada['saldoDisponibleNuevo'],
        $idUsuario,
        $idOperador,
        'Reserva asociada a la orden de alistamiento #' . $idOrden
    );

    oa_registrar_historial([
        'idOrdenAlistamiento' => $idOrden,
        'idDetalleOrden' => $idDetalle,
        'idReservaAlistamiento' => $idReserva,
        'idMovimientoInventario' => $idMovimiento,
        'evento' => $tipoMovimiento,
        'cantidad' => $cantidad,
        'idUsuario' => $idUsuario,
        'idOperador' => $idOperador,
        'datos' => [
            'idExistencia' => $idExistencia,
            'idBodega' => (int)$actualizada['idBodega'],
            'idUbicacion' => $actualizada['idUbicacion'] !== null ? (int)$actualizada['idUbicacion'] : null,
            'idLote' => $actualizada['idLote'] !== null ? (int)$actualizada['idLote'] : null
        ]
    ]);

    return $idReserva;
}

function oa_reservar_fefo(
    int $idOrden,
    int $idDetalle,
    int $idProducto,
    float $cantidadSolicitada,
    int $idUsuario,
    ?int $idOperador = null,
    string $tipoMovimiento = 'RESERVA_ALISTAMIENTO'
): float {
    $pendiente = oa_decimal($cantidadSolicitada);
    $reservado = 0.0;

    foreach (oa_existencias_disponibles($idProducto, true) as $existencia) {
        if ($pendiente <= 0) {
            break;
        }

        $disponible = oa_decimal($existencia['cantidadDisponible']);
        if ($disponible <= 0) {
            continue;
        }

        $tomar = oa_decimal(min($pendiente, $disponible));
        if ($tomar <= 0) {
            continue;
        }

        oa_crear_reserva(
            $idOrden,
            $idDetalle,
            $existencia,
            $tomar,
            $idUsuario,
            $idOperador,
            $tipoMovimiento
        );

        $reservado = oa_decimal($reservado + $tomar);
        $pendiente = oa_decimal($pendiente - $tomar);
    }

    return $reservado;
}

function oa_reservar_excedente_alistado_fefo(
    int $idOrden,
    int $idDetalle,
    int $idProducto,
    float $cantidadSolicitada,
    int $idUsuario,
    int $idOperador,
    ?string $observacion = null,
    ?int $idExistenciaPreferida = null
): array {
    $pendiente = oa_decimal($cantidadSolicitada);
    $reservado = 0.0;
    $reservasCreadas = [];

    $existencias = oa_existencias_disponibles($idProducto, true);
    if ($idExistenciaPreferida !== null && $idExistenciaPreferida > 0) {
        foreach ($existencias as $indice => $existencia) {
            if ((int)$existencia['idExistencia'] === $idExistenciaPreferida) {
                unset($existencias[$indice]);
                array_unshift($existencias, $existencia);
                break;
            }
        }
    }

    foreach ($existencias as $existencia) {
        if ($pendiente <= 0) {
            break;
        }

        $disponible = oa_decimal($existencia['cantidadDisponible']);
        if ($disponible <= 0) {
            continue;
        }

        $tomar = oa_decimal(min($pendiente, $disponible));
        if ($tomar <= 0) {
            continue;
        }

        $idReserva = oa_crear_reserva(
            $idOrden,
            $idDetalle,
            $existencia,
            $tomar,
            $idUsuario,
            $idOperador,
            'RESERVA_ALISTAMIENTO_EXCEDENTE'
        );

        oa_ejecutar(
            "UPDATE InventarioOrdenesAlistamientoReservas
             SET cantidadAlistada = ?, estadoReserva = 'ALISTADA',
                 idUsuarioActualiza = ?, observacion = COALESCE(?, observacion),
                 versionRegistro = versionRegistro + 1, updated_at = NOW()
             WHERE id = ?",
            'disi',
            [$tomar, $idUsuario, $observacion, $idReserva]
        );

        oa_registrar_historial([
            'idOrdenAlistamiento' => $idOrden,
            'idDetalleOrden' => $idDetalle,
            'idReservaAlistamiento' => $idReserva,
            'evento' => 'EXCEDENTE_ALISTADO_ASIGNADO_FEFO',
            'cantidad' => $tomar,
            'idUsuario' => $idUsuario,
            'idOperador' => $idOperador,
            'observacion' => $observacion,
            'datos' => [
                'idExistencia' => (int)$existencia['idExistencia'],
                'idBodega' => (int)$existencia['idBodega'],
                'idUbicacion' => $existencia['idUbicacion'] !== null
                    ? (int)$existencia['idUbicacion']
                    : null,
                'idLote' => $existencia['idLote'] !== null
                    ? (int)$existencia['idLote']
                    : null
            ]
        ]);

        $reservasCreadas[] = [
            'idReserva' => $idReserva,
            'idExistencia' => (int)$existencia['idExistencia'],
            'idBodega' => (int)$existencia['idBodega'],
            'idUbicacion' => $existencia['idUbicacion'] !== null
                ? (int)$existencia['idUbicacion']
                : null,
            'idLote' => $existencia['idLote'] !== null
                ? (int)$existencia['idLote']
                : null,
            'cantidad' => $tomar
        ];
        $reservado = oa_decimal($reservado + $tomar);
        $pendiente = oa_decimal($pendiente - $tomar);
    }

    if ($pendiente > 0.0001) {
        oa_lanzar(
            'No hay existencia adicional suficiente para respaldar todo el excedente',
            409,
            'stock_adicional_insuficiente',
            [
                'idProducto' => $idProducto,
                'cantidadAdicionalSolicitada' => oa_decimal($cantidadSolicitada),
                'cantidadAdicionalDisponible' => $reservado,
                'cantidadAdicionalFaltante' => $pendiente
            ]
        );
    }

    return [
        'cantidadReservada' => $reservado,
        'reservas' => $reservasCreadas
    ];
}

function oa_liberar_reserva(
    int $idOrden,
    array $reserva,
    float $cantidad,
    int $idUsuario,
    ?int $idOperador,
    string $evento = 'LIBERACION_RESERVA_ALISTAMIENTO',
    ?string $observacion = null
): int {
    $cantidad = oa_decimal($cantidad);
    if ($cantidad <= 0) {
        return 0;
    }

    $existencia = oa_fila(
        "SELECT id, idProducto, idLote, idBodega, idUbicacion,
                cantidadDisponible, cantidadReservada
         FROM InventarioExistencias
         WHERE id = ?
         LIMIT 1 FOR UPDATE",
        'i',
        [(int)$reserva['idExistencia']]
    );
    if (!$existencia
        || (int)$existencia['idProducto'] !== (int)$reserva['idProducto']
        || (int)$existencia['idBodega'] !== (int)$reserva['idBodega']
        || (int)($existencia['idUbicacion'] ?? 0) !== (int)($reserva['idUbicacion'] ?? 0)
        || (int)($existencia['idLote'] ?? 0) !== (int)($reserva['idLote'] ?? 0)) {
        oa_lanzar('La reserva no coincide con la existencia que debe liberarse', 409, 'reserva_existencia_inconsistente');
    }

    $reservadaExistencia = oa_decimal($existencia['cantidadReservada']);
    if ($reservadaExistencia + 0.0001 < $cantidad) {
        oa_lanzar('La existencia no conserva toda la cantidad reservada', 409, 'reserva_inventario_inconsistente', [
            'idExistencia' => (int)$existencia['id'],
            'cantidadReservadaExistencia' => $reservadaExistencia,
            'cantidadLiberar' => $cantidad
        ]);
    }

    $actualizada = oa_ejecutar(
        "UPDATE InventarioExistencias
         SET cantidadDisponible = cantidadDisponible + ?,
             cantidadReservada = cantidadReservada - ?, updated_at = NOW()
         WHERE id = ? AND cantidadReservada >= ?",
        'ddid',
        [$cantidad, $cantidad, (int)$existencia['id'], $cantidad]
    );
    if ($actualizada['affected_rows'] !== 1) {
        oa_lanzar('La reserva cambio mientras se intentaba liberar', 409, 'reserva_inventario_inconsistente');
    }

    $actualizadaReserva = oa_ejecutar(
        "UPDATE InventarioOrdenesAlistamientoReservas
         SET cantidadLiberada = cantidadLiberada + ?,
             idUsuarioActualiza = ?, versionRegistro = versionRegistro + 1,
             updated_at = NOW()
         WHERE id = ?
           AND cantidadAlistada + cantidadLiberada + ? <= cantidadReservada",
        'diid',
        [$cantidad, $idUsuario, (int)$reserva['id'], $cantidad]
    );
    if ($actualizadaReserva['affected_rows'] !== 1) {
        oa_lanzar('La cantidad ya no puede liberarse de la reserva', 409, 'reserva_no_liberable');
    }

    $saldoAnterior = oa_decimal($existencia['cantidadDisponible']);
    $saldoNuevo = oa_decimal($saldoAnterior + $cantidad);
    $idMovimiento = oa_registrar_movimiento(
        null,
        null,
        (int)$reserva['idProducto'],
        $reserva['idLote'] !== null ? (int)$reserva['idLote'] : null,
        (int)$reserva['idBodega'],
        $reserva['idUbicacion'] !== null ? (int)$reserva['idUbicacion'] : null,
        'LIBERACION_RESERVA_ALISTAMIENTO',
        $cantidad,
        $saldoAnterior,
        $saldoNuevo,
        $idUsuario,
        $idOperador,
        $observacion ?: 'Liberacion de reserva de la orden de alistamiento #' . $idOrden
    );
    oa_registrar_historial([
        'idOrdenAlistamiento' => $idOrden,
        'idDetalleOrden' => (int)$reserva['idDetalleOrden'],
        'idReservaAlistamiento' => (int)$reserva['id'],
        'idMovimientoInventario' => $idMovimiento,
        'evento' => $evento,
        'cantidad' => $cantidad,
        'idUsuario' => $idUsuario,
        'idOperador' => $idOperador,
        'observacion' => $observacion,
        'datos' => ['idExistencia' => (int)$existencia['id']]
    ]);

    return $idMovimiento;
}

function oa_recalcular_detalle(int $idDetalle): array
{
    $sumas = oa_fila(
        "SELECT
            COALESCE(SUM(cantidadReservada), 0) AS cantidadReservada,
            COALESCE(SUM(cantidadAlistada), 0) AS cantidadAlistada,
            COALESCE(SUM(cantidadEnviada), 0) AS cantidadEnviada
         FROM InventarioOrdenesAlistamientoReservas
         WHERE idDetalleOrden = ?",
        'i',
        [$idDetalle]
    ) ?: [];

    $reservada = oa_decimal($sumas['cantidadReservada'] ?? 0);
    $alistada = oa_decimal($sumas['cantidadAlistada'] ?? 0);
    $enviada = oa_decimal($sumas['cantidadEnviada'] ?? 0);

    oa_ejecutar(
        "UPDATE InventarioOrdenesAlistamientoDetalle
         SET cantidadReservada = ?, cantidadAlistada = ?, cantidadEnviada = ?, updated_at = NOW()
         WHERE id = ?",
        'dddi',
        [$reservada, $alistada, $enviada, $idDetalle]
    );

    return [
        'cantidadReservada' => $reservada,
        'cantidadAlistada' => $alistada,
        'cantidadEnviada' => $enviada
    ];
}

function oa_recalcular_orden(int $idOrden): void
{
    $detalles = oa_consultar(
        'SELECT id FROM InventarioOrdenesAlistamientoDetalle WHERE idOrdenAlistamiento = ? ORDER BY id',
        'i',
        [$idOrden]
    );

    foreach ($detalles as $detalle) {
        oa_recalcular_detalle((int)$detalle['id']);
    }
}

function oa_detalles_orden(int $idOrden): array
{
    return oa_consultar(
        "SELECT *
         FROM InventarioOrdenesAlistamientoDetalle
         WHERE idOrdenAlistamiento = ?
         ORDER BY productoSnapshot ASC, id ASC",
        'i',
        [$idOrden]
    );
}

function oa_reservas_detalle(int $idDetalle, bool $bloquear = false): array
{
    $sql = "SELECT
                r.*,
                b.codigo AS codigoBodega,
                b.nombre AS bodega,
                u.codigo AS codigoUbicacion,
                u.nombre AS ubicacion,
                l.lote,
                l.fechaVencimiento,
                ex.cantidadDisponible AS existenciaDisponible,
                ex.cantidadReservada AS existenciaReservada,
                ex.cantidadBloqueada AS existenciaBloqueada
            FROM InventarioOrdenesAlistamientoReservas r
            INNER JOIN InventarioExistencias ex ON ex.id = r.idExistencia
            INNER JOIN BodegasInventario b ON b.id = r.idBodega
            LEFT JOIN UbicacionesInventario u ON u.id = r.idUbicacion
            LEFT JOIN InventarioLotes l ON l.id = r.idLote
            WHERE r.idDetalleOrden = ?
            ORDER BY b.nombre, u.nombre, l.fechaVencimiento, r.id";
    if ($bloquear) {
        $sql .= ' FOR UPDATE';
    }
    return oa_consultar($sql, 'i', [$idDetalle]);
}

function oa_formatear_reserva(array $fila): array
{
    $reservada = oa_decimal($fila['cantidadReservada']);
    $alistada = oa_decimal($fila['cantidadAlistada']);
    $liberada = oa_decimal($fila['cantidadLiberada']);
    $enviada = oa_decimal($fila['cantidadEnviada']);

    return [
        'id' => (int)$fila['id'],
        'idReserva' => (int)$fila['id'],
        'idReservaAlistamiento' => (int)$fila['id'],
        'idDetalleOrden' => (int)$fila['idDetalleOrden'],
        'idExistencia' => (int)$fila['idExistencia'],
        'idBodega' => (int)$fila['idBodega'],
        'codigoBodega' => $fila['codigoBodega'] ?? null,
        'bodega' => $fila['bodega'] ?? null,
        'idUbicacion' => $fila['idUbicacion'] !== null ? (int)$fila['idUbicacion'] : null,
        'codigoUbicacion' => $fila['codigoUbicacion'] ?? null,
        'ubicacion' => $fila['ubicacion'] ?? null,
        'idLote' => $fila['idLote'] !== null ? (int)$fila['idLote'] : null,
        'lote' => $fila['lote'] ?? null,
        'fechaVencimiento' => $fila['fechaVencimiento'] ?? null,
        'cantidadReservada' => $reservada,
        'cantidadAlistada' => $alistada,
        'cantidadLiberada' => $liberada,
        'cantidadEnviada' => $enviada,
        'saldoReserva' => oa_decimal($fila['saldoReserva'] ?? ($reservada - $liberada - $enviada)),
        'capacidadAlistamiento' => oa_decimal($reservada - $liberada),
        'cantidadPendienteAlistar' => oa_decimal(max(($reservada - $liberada) - $alistada, 0)),
        'cantidadPendienteEnviar' => oa_decimal(max($alistada - $enviada, 0)),
        'estadoReserva' => $fila['estadoReserva'],
        'versionRegistro' => (int)$fila['versionRegistro'],
        'observacion' => $fila['observacion'],
        'existencia' => [
            'cantidadDisponible' => oa_decimal($fila['existenciaDisponible'] ?? 0),
            'cantidadReservada' => oa_decimal($fila['existenciaReservada'] ?? 0),
            'cantidadBloqueada' => oa_decimal($fila['existenciaBloqueada'] ?? 0)
        ]
    ];
}

function oa_formatear_detalle(array $fila, array $reservas = []): array
{
    $solicitada = oa_decimal($fila['cantidadSolicitada']);
    $reservada = oa_decimal($fila['cantidadReservada']);
    $alistada = oa_decimal($fila['cantidadAlistada']);
    $enviada = oa_decimal($fila['cantidadEnviada']);

    return [
        'id' => (int)$fila['id'],
        'idDetalleOrden' => (int)$fila['id'],
        'idOrdenAlistamiento' => (int)$fila['idOrdenAlistamiento'],
        'idProducto' => (int)$fila['idProducto'],
        'codigoProducto' => $fila['codigoProductoSnapshot'],
        'producto' => $fila['productoSnapshot'],
        'categoria' => $fila['categoriaSnapshot'],
        'unidad' => $fila['unidadSnapshot'],
        'presentacion' => $fila['presentacionSnapshot'],
        'embalaje' => $fila['embalajeSnapshot'],
        'uniCaja' => $fila['uniCajaSnapshot'] !== null ? oa_decimal($fila['uniCajaSnapshot']) : null,
        'pacSolicitado' => oa_decimal($fila['pacSolicitado']),
        'undSolicitado' => oa_decimal($fila['undSolicitado']),
        'cantidadSolicitada' => $solicitada,
        'cantidadReservada' => $reservada,
        'cantidadAlistada' => $alistada,
        'cantidadPendiente' => oa_decimal($fila['cantidadPendiente'] ?? max($solicitada - $alistada, 0)),
        'cantidadExcedente' => oa_decimal($fila['cantidadExcedente'] ?? max($alistada - $solicitada, 0)),
        'cantidadEnviada' => $enviada,
        'cantidadPendienteEnviar' => oa_decimal(max($alistada - $enviada, 0)),
        'observacion' => $fila['observacion'],
        'reservas' => $reservas
    ];
}

function oa_detalle_completo(int $idOrden, array $usuario, ?array $operador = null): array
{
    $orden = oa_orden_base($idOrden);
    if (!$orden) {
        oa_lanzar('La orden de alistamiento no existe', 404, 'orden_no_encontrada');
    }

    oa_validar_acceso_orden($orden, $usuario, $operador);

    $detalles = [];
    foreach (oa_detalles_orden($idOrden) as $detalle) {
        $reservas = array_map(
            'oa_formatear_reserva',
            oa_reservas_detalle((int)$detalle['id'])
        );
        $detalles[] = oa_formatear_detalle($detalle, $reservas);
    }

    $asignaciones = oa_consultar(
        "SELECT
            a.id, a.idOrdenAlistamiento, a.idOperador, a.idUsuarioAsigna,
            a.estadoAsignacion, a.fechaAsignacion, a.fechaInicio, a.fechaCierre,
            a.observacion, op.codigo AS codigoOperador,
            op.nombreCompleto AS nombreOperador, op.cargo
         FROM InventarioOrdenesAlistamientoAsignaciones a
         INNER JOIN InventarioOperadores op ON op.id = a.idOperador
         WHERE a.idOrdenAlistamiento = ?
         ORDER BY a.id DESC",
        'i',
        [$idOrden]
    );

    foreach ($asignaciones as &$asignacion) {
        $asignacion['id'] = (int)$asignacion['id'];
        $asignacion['idOrdenAlistamiento'] = (int)$asignacion['idOrdenAlistamiento'];
        $asignacion['idOperador'] = (int)$asignacion['idOperador'];
        $asignacion['idUsuarioAsigna'] = $asignacion['idUsuarioAsigna'] !== null
            ? (int)$asignacion['idUsuarioAsigna']
            : null;
        $asignacion['operador'] = [
            'idOperador' => $asignacion['idOperador'],
            'codigo' => $asignacion['codigoOperador'],
            'nombre' => $asignacion['nombreOperador'],
            'nombreCompleto' => $asignacion['nombreOperador'],
            'cargo' => $asignacion['cargo']
        ];
    }
    unset($asignacion);

    $envios = oa_consultar(
        "SELECT
            e.id, e.consecutivo, e.idDocumentoInventario, e.idBodegaOrigen,
            e.estadoEnvio, e.fechaGeneracion, e.fechaEnvioLogistica,
            e.cantidadTotal, e.idUsuarioGenera,
            e.observacion, b.codigo AS codigoBodega, b.nombre AS bodega,
            d.consecutivo AS codigoDocumento
         FROM InventarioOrdenesAlistamientoEnvios e
         INNER JOIN BodegasInventario b ON b.id = e.idBodegaOrigen
         INNER JOIN InventarioDocumentos d ON d.id = e.idDocumentoInventario
         WHERE e.idOrdenAlistamiento = ?
         ORDER BY e.id DESC",
        'i',
        [$idOrden]
    );

    foreach ($envios as &$envio) {
        $envio['id'] = (int)$envio['id'];
        $envio['idDocumentoInventario'] = (int)$envio['idDocumentoInventario'];
        $envio['idBodegaOrigen'] = (int)$envio['idBodegaOrigen'];
        $envio['idUsuarioGenera'] = $envio['idUsuarioGenera'] !== null
            ? (int)$envio['idUsuarioGenera']
            : null;
        $envio['cantidadTotal'] = oa_decimal($envio['cantidadTotal']);
    }
    unset($envio);

    $ordenFormateada = oa_formatear_orden($orden, $usuario, $operador);
    $ordenFormateada['detalles'] = $detalles;
    $ordenFormateada['asignaciones'] = $asignaciones;
    $ordenFormateada['envios'] = $envios;

    return $ordenFormateada;
}

?>
