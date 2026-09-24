import { useEffect, useRef, useState } from "react";
import { IoMenu } from "react-icons/io5";
import { FaArrowLeft, FaSave, FaTrash } from "react-icons/fa";
import { ConfirmacionOrdenCompra } from "./ConfirmacionOrdenCompra";
import { API_BASE } from "../../constants";
import { ListadoOrdenesCompra } from "./ListadoOrdenesCompra";

const endpoint = `${API_BASE}Inventario/OrdenesCompra/InventarioOrdenesCompra.php`;
const numero = (valor) => Number(valor).toLocaleString("es-CO", { maximumFractionDigits: 3 });
const boton = "rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";
const primario = "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-800 px-4 py-2 text-sm text-white hover:bg-blue-900 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";

export const OrdenesCompraInventario = ({ setSidebar }) => {
  const [vista, setVista] = useState("LISTADO");
  const [confirmacion, setConfirmacion] = useState(null);
  const [archivo, setArchivo] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [vistaPrevia, setVistaPrevia] = useState(false);
  const [listado, setListado] = useState({ ordenes: [], total: 0, pagina: 1 });
  const [busqueda, setBusqueda] = useState("");
  const [consulta, setConsulta] = useState("");
  const [ocupado, setOcupado] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [filtroProductos, setFiltroProductos] = useState("");
  const [paginaProductos, setPaginaProductos] = useState(1);
  const controlador = useRef(null);
  const bloqueo = useRef(false);
  const inputArchivo = useRef(null);

  async function solicitar(accion, campos = {}) {
    const form = new FormData();
    const usuario = JSON.parse(localStorage.getItem("us") || "{}");
    form.append("correoSesion", usuario?.correo || "");
    form.append("tokenSesion", localStorage.getItem("st") || "");
    form.append("accion", accion);
    Object.entries(campos).forEach(([clave, valor]) => form.append(clave, valor));
    controlador.current = new AbortController();
    const respuesta = await fetch(endpoint, { method: "POST", body: form, signal: controlador.current.signal });
    let json;
    try { json = await respuesta.json(); } catch { throw new Error("El servidor no devolvió una respuesta válida. Intenta nuevamente."); }
    if (!respuesta.ok || json.rpta !== "si") throw new Error(json.mensaje || "No se pudo completar la operación.");
    return json;
  }

  async function ejecutar(texto, tarea) {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(texto); setError(""); setMensaje("");
    try { await tarea(); } catch (e) {
      if (e.name !== "AbortError") setError(e.message || "No fue posible conectar con el servidor.");
    } finally { bloqueo.current = false; setOcupado(""); }
  }

  async function consultar(pagina = 1, texto = busqueda) {
    await ejecutar("Consultando…", async () => {
      const respuesta = await solicitar("listar", { busqueda: texto, pagina });
      setListado(respuesta.data); setConsulta(texto);
    });
  }

  useEffect(() => {
    // Carga inicial y cancelación al salir del módulo.
    const inicio = setTimeout(() => consultar(1, ""), 0);
    return () => { clearTimeout(inicio); controlador.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function seleccionar(evento) {
    const seleccionado = evento.target.files?.[0] || null;
    setArchivo(seleccionado);
    setDetalle(null); setVistaPrevia(false); setError(""); setMensaje("");
    if (seleccionado) previsualizar(seleccionado);
  }

  async function previsualizar(archivoSeleccionado) {
    if (!archivoSeleccionado || !archivoSeleccionado.name.toLowerCase().endsWith(".csv") || archivoSeleccionado.size > 5 * 1024 * 1024) {
      setError("Selecciona un archivo .csv de hasta 5 MB."); return;
    }
    setDetalle(null); setVistaPrevia(false);
    await ejecutar("Leyendo archivo…", async () => {
      const respuesta = await solicitar("previsualizar", { archivo: archivoSeleccionado });
      setDetalle(respuesta.data); setVistaPrevia(true); setFiltroProductos(""); setPaginaProductos(1);
    });
  }

  async function guardar() {
    if (!vistaPrevia || !archivo) return;
    await ejecutar("Guardando…", async () => {
      const respuesta = await solicitar("importar", { archivo });
      setVistaPrevia(false); setArchivo(null);
      if (inputArchivo.current) inputArchivo.current.value = "";
      setDetalle(null); setVista("LISTADO");
      setMensaje(`${respuesta.mensaje} Se guardaron ${respuesta.data.productos} renglones.`);
      const actualizado = await solicitar("listar", { busqueda: "", pagina: 1 });
      setListado(actualizado.data); setBusqueda(""); setConsulta("");
    });
  }

  async function ver(id) {
    setVista("DETALLE");
    setDetalle(null); setVistaPrevia(false);
    await ejecutar("Cargando detalle…", async () => {
      const respuesta = await solicitar("detalle", { id });
      setDetalle(respuesta.data); setFiltroProductos(""); setPaginaProductos(1);
    });
  }

  function borrarArchivo() {
    if (bloqueo.current) return;
    setArchivo(null); setDetalle(null); setVistaPrevia(false);
    setError(""); setMensaje(""); setFiltroProductos(""); setPaginaProductos(1);
    if (inputArchivo.current) inputArchivo.current.value = "";
    setConfirmacion(null);
  }

  const productos = (detalle?.productos || []).filter((p) => `${p.codigo} ${p.descripcion}`.toLowerCase().includes(filtroProductos.toLowerCase()));
  const visibles = productos.slice((paginaProductos - 1) * 25, paginaProductos * 25);

  return (
    <div className={`w-full min-w-0 h-dvh flex flex-col p-4 md:p-6 ${vista === "LISTADO" ? "overflow-y-auto gap-6" : "overflow-hidden gap-3"}`}>
      <header className={`shrink-0 flex flex-wrap items-center justify-between gap-3 ${vista === "LISTADO" ? "lg:hidden" : "rounded-lg bg-white p-3 md:px-4"}`}>
        <div className="flex min-w-0 items-center gap-3">
          {vista === "LISTADO" ? <button type="button" onClick={() => setSidebar(true)} className={`${boton} md:hidden`} aria-label="Abrir menú"><IoMenu size={22} /></button> :
            <button type="button" aria-label="Volver a órdenes" title="Volver a órdenes" className="shrink-0 rounded-lg border border-slate-300 p-2 text-slate-700 hover:bg-slate-100 focus:ring-2 focus:ring-blue-500 disabled:opacity-50" disabled={!!ocupado} onClick={() => { setVista("LISTADO"); setDetalle(null); setVistaPrevia(false); setArchivo(null); setError(""); }}><FaArrowLeft /></button>}
          <h1 className="text-base md:text-xl font-bold text-slate-800">{vista === "CARGA" ? "Cargar orden de compra" : vista === "DETALLE" ? "Detalle de orden de compra" : "Órdenes de compra"}</h1>
        </div>
        {vista === "CARGA" && <div className="ml-auto flex w-full min-w-0 flex-wrap items-end justify-end gap-2 xl:w-auto xl:flex-1 xl:max-w-2xl">
          <label className="flex min-w-0 flex-1 basis-56 flex-col gap-1 text-sm">
            <span className="text-xs text-slate-500">Archivo CSV (máx. 5 MB)</span>
            <input ref={inputArchivo} type="file" accept=".csv,text/csv" onChange={seleccionar} disabled={!!ocupado} className="block w-full min-w-0 rounded-md border border-slate-300 p-2 text-sm disabled:opacity-50" />
          </label>
          {vistaPrevia && <button type="button" className={primario} disabled={!!ocupado} onClick={() => setConfirmacion("GUARDAR")}>
            <FaSave aria-hidden="true" /><span>Guardar</span>
          </button>}
          <button type="button" aria-label="Borrar archivo cargado" title="Borrar archivo cargado" disabled={!!ocupado || !archivo} onClick={() => setConfirmacion("BORRAR")} className="shrink-0 rounded-lg border border-red-200 p-2.5 text-red-600 hover:bg-red-50 focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-40"><FaTrash aria-hidden="true" /></button>
        </div>}
      </header>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</div>}
      {mensaje && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-800">{mensaje}</div>}
      {ocupado && vista !== "LISTADO" && <p role="status" className="text-sm text-blue-700">{ocupado}</p>}
      {detalle && <section aria-label="Información de la orden" className="min-h-0 min-w-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">{vistaPrevia ? "Vista previa" : "Detalle guardado"}: {detalle.tipoDocumento} · {detalle.numero}</h2>
        </div>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 text-sm">
          {[["Proveedor", detalle.proveedor], ["NIT proveedor", detalle.nitProveedor], ["Teléfono", detalle.telefono],
            ["Ciudad", detalle.ciudad], ["Fecha", detalle.fecha], ["Vencimiento de la orden", detalle.vencimiento]].map(([label, valor]) =>
            <div key={label}><dt className="text-slate-500">{label}</dt><dd className="font-medium break-words">{valor}</dd></div>)}
        </dl>
        {detalle.estadoOrigen === "PARCIAL" && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">El estado PARCIAL proviene del archivo. Las cantidades recibidas y pendientes todavía no están determinadas.</p>}
        {(detalle.advertencias || []).filter((a) => !a.includes("PARCIAL")).map((a) => <p key={a} className="text-sm text-amber-800">{a}</p>)}
        <label className="block text-sm">Buscar producto o código
          <input value={filtroProductos} onChange={(e) => { setFiltroProductos(e.target.value); setPaginaProductos(1); }} className="mt-1 w-full rounded-lg border border-slate-300 p-2" />
        </label>
        <p className="text-sm text-slate-500">{detalle.productos.length} renglones en la orden · {productos.length} coinciden con la búsqueda</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100"><tr>{["#", "Código", "UBI origen", "Descripción", "Costo", "Peso", "Cantidad", "Valor unitario", "Valor total"].map((h, i) => <th key={h} className={`whitespace-nowrap p-3 ${i === 2 || i >= 4 ? "text-center" : "text-left"}`}>{h}</th>)}</tr></thead>
            <tbody>{visibles.map((p) => <tr key={p.renglon} className="border-b border-slate-100">
              <td className="p-3">{p.renglon}</td><td className="p-3">{p.codigo}</td><td className="p-3 text-center">{p.ubicacionOrigen}</td><td className="p-3 min-w-64">{p.descripcion}</td>
              {["costo", "peso", "cantidad", "valorUnitario", "valorTotal"].map((campo) => <td key={campo} className="p-3 whitespace-nowrap text-center">{numero(p[campo])}</td>)}
            </tr>)}</tbody>
          </table>
          {!productos.length && <p className="p-4 text-slate-500">No hay productos que coincidan.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" className={boton} disabled={paginaProductos === 1} onClick={() => setPaginaProductos((p) => p - 1)}>Anterior</button>
          <span>Página {paginaProductos} de {Math.max(1, Math.ceil(productos.length / 25))}</span>
          <button type="button" className={boton} disabled={paginaProductos * 25 >= productos.length} onClick={() => setPaginaProductos((p) => p + 1)}>Siguiente</button>
        </div>
        <p className="text-sm whitespace-pre-wrap break-words"><strong>Observación: </strong>{detalle.observacion || "Sin observación"}</p>
      </section>}
      {vista === "LISTADO" && <ListadoOrdenesCompra listado={listado} busqueda={busqueda} setBusqueda={setBusqueda} ocupado={ocupado} error={error} consultar={consultar} consulta={consulta} ver={ver}
        limpiar={() => { setBusqueda(""); consultar(1, ""); }}
        cargar={() => { setVista("CARGA"); setArchivo(null); setDetalle(null); setVistaPrevia(false); setError(""); setMensaje(""); }} />}
      {confirmacion && <ConfirmacionOrdenCompra tipo={confirmacion} archivo={archivo} orden={detalle} ocupado={ocupado}
        cerrar={() => { if (!bloqueo.current) setConfirmacion(null); }}
        confirmar={confirmacion === "BORRAR" ? borrarArchivo : async () => { await guardar(); setConfirmacion(null); }} />}
    </div>
  );
};
