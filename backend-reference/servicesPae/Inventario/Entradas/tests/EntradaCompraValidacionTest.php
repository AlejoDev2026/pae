<?php
// Doble de conexión para probar reglas de recepción; no sustituye pruebas MySQL.
require_once __DIR__ . '/../EntradaCompraHelper.php';
set_error_handler(function($n,$m,$f,$l) { throw new ErrorException($m,0,$n,$f,$l); });
function inv_obtener_producto_inventario($id) { return $id === 10 ? ['codigo'=>'F001'] : null; }
class MetaCompraPrueba {
    private $fila;
    function __construct($fila) { $this->fila=$fila; }
    function fetch_fields() { return array_map(function($k){ return (object)['name'=>$k]; }, array_keys($this->fila)); }
    function free() {}
}
class StatementCompraPrueba {
    private $sql; private $args=[]; private $rows=[]; private $refs=[];
    function __construct($sql) { $this->sql=$sql; }
    function bind_param($tipos, &...$args) { $this->args=$args; }
    function execute() {
        if (strpos($this->sql,'SELECT id, numero')===0) $this->rows=[['id'=>1,'numero'=>'OC1']];
        elseif (strpos($this->sql,'SELECT codigo, cantidad')===0) $this->rows=$this->args[0]==100 && $this->args[1]==1 ? [['codigo'=>'F001','cantidad'=>10]] : [];
        else $this->rows=[['cantidadSolicitada'=>4]];
        return true;
    }
    function result_metadata() { return new MetaCompraPrueba($this->rows[0] ?? ['codigo'=>null,'cantidad'=>null]); }
    function bind_result(&...$args) { foreach ($args as &$arg) $this->refs[]=&$arg; }
    function fetch() { if (!$this->rows) return false; $row=array_values(array_shift($this->rows)); foreach($row as $i=>$v) $this->refs[$i]=$v; return true; }
    function close() {}
}
class ConexionCompraPrueba { function prepare($sql) { return new StatementCompraPrueba($sql); } }
$conexion=new ConexionCompraPrueba();
function lineaCompra($cantidad,$id=100,$producto=10) { return ['idOrdenCompraDetalle'=>$id,'idProducto'=>$producto,'cantidad'=>$cantidad]; }
ecValidar(1,[lineaCompra(2),lineaCompra(4)]); // Dos lotes, exactamente las seis pendientes.
$casos = [[lineaCompra(7)], [lineaCompra(4),lineaCompra(3)], [lineaCompra(1,999)], [lineaCompra(1,100,99)], [lineaCompra(-1)], [lineaCompra(0)], [lineaCompra('abc')], [lineaCompra(1.1234)]];
foreach ($casos as $caso) {
    try { ecValidar(1,$caso); throw new RuntimeException('Se aceptó una recepción inválida.'); }
    catch (InvalidArgumentException $e) {}
}
echo "OK: cantidad pendiente, suma de lotes, código/producto, renglón y cantidades inválidas.\n";
