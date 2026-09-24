import { FaEye, FaPlus, FaSearch } from "react-icons/fa";

const secundario = "rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";
const numero = (valor) => Number(valor).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const ListadoOrdenesCompra = ({ listado, busqueda, setBusqueda, ocupado, error, consultar, limpiar, cargar, ver, consulta }) => {
  const cargando = ocupado === "Consultando…";
  const estado = (orden) => <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-600"><span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />{orden.estadoOrigen}</span>;
  const accion = (orden) => <button type="button" disabled={!!ocupado} onClick={() => ver(orden.id)} aria-label={`Ver orden ${orden.numero}`} title="Ver detalle" className="inline-flex rounded-full p-2 text-blue-600 hover:bg-blue-100 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"><FaEye className="text-xl" /></button>;
  return (
    <article className="min-w-0 flex-1 shrink-0 rounded-lg bg-white p-4 shadow-lg md:p-6 flex flex-col gap-4">
      <form onSubmit={(e) => { e.preventDefault(); consultar(); }} className="flex flex-wrap items-center gap-3">
        <h1 className="hidden lg:block text-lg font-bold text-slate-800 mr-3">Órdenes de compra</h1>
        <div className="relative min-w-0 flex-1 basis-52">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input aria-label="Buscar por número, proveedor o NIT" placeholder="Buscar por número, proveedor o NIT…" maxLength={200} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full rounded-md border border-gray-400 p-2 pl-9 text-sm focus:outline-none focus:ring-1 focus:border-[#193CB8]" />
        </div>
        <button className={secundario} disabled={!!ocupado}>Consultar</button>
        <button type="button" className={secundario} disabled={!!ocupado} onClick={limpiar}>Limpiar</button>
        <button type="button" disabled={!!ocupado} onClick={cargar} className="flex items-center justify-center gap-2 rounded-lg border border-blue-800 px-4 py-2 text-sm font-semibold text-blue-800 transition-colors hover:bg-blue-800 hover:text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"><FaPlus />Cargar orden</button>
      </form>
      <p className="text-sm text-slate-500">Consulta las órdenes de compra cargadas y revisa su detalle.</p>
      {cargando ? <p role="status" className="py-8 text-center text-gray-500">Cargando órdenes de compra…</p> : <>
        <div className="hidden lg:block min-w-0 overflow-x-auto">
          <table className="w-full border-separate border-spacing-y-2 text-sm text-left">
            <caption className="sr-only">Órdenes de compra cargadas</caption>
            <thead><tr className="text-gray-700">{["Estado de origen", "Orden", "Fecha", "Proveedor", "Total", "Acción"].map((h, i) => <th key={h} className={`bg-[#ECEEF1] p-3 font-semibold ${i === 0 ? "rounded-l-lg" : ""} ${i === 5 ? "rounded-r-lg text-center" : ""} ${i === 4 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
            <tbody>{listado.ordenes.map((o) => <tr key={o.id} className="group text-gray-700">
              <td className="rounded-l-lg border-y border-l border-gray-200 p-3 group-hover:bg-gray-50">{estado(o)}</td>
              <td className="border-y border-gray-200 p-3 font-medium group-hover:bg-gray-50">{o.tipoDocumento} · {o.numero}</td>
              <td className="border-y border-gray-200 p-3 whitespace-nowrap group-hover:bg-gray-50">{o.fecha}</td>
              <td className="border-y border-gray-200 p-3 group-hover:bg-gray-50"><div className="max-w-64 truncate" title={o.proveedor}>{o.proveedor}</div><div className="text-xs text-slate-500">NIT {o.nitProveedor}</div></td>
              <td className="border-y border-gray-200 p-3 text-right whitespace-nowrap group-hover:bg-gray-50">{numero(o.total)}</td>
              <td className="rounded-r-lg border-y border-r border-gray-200 p-3 text-center group-hover:bg-gray-50">{accion(o)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="grid gap-4 lg:hidden">{listado.ordenes.map((o) => <article key={o.id} className="rounded-lg border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-3"><h2 className="font-semibold break-all">{o.tipoDocumento} · {o.numero}</h2>{accion(o)}</div>
          {estado(o)}
          <dl className="space-y-2 text-sm text-slate-600">
            <div><dt className="font-semibold">Proveedor</dt><dd className="break-words">{o.proveedor}</dd><dd className="text-xs">NIT {o.nitProveedor}</dd></div>
            <div className="flex justify-between gap-2"><dt className="font-semibold">Fecha</dt><dd>{o.fecha}</dd></div>
            <div className="flex justify-between gap-2"><dt className="font-semibold">Total</dt><dd>{numero(o.total)}</dd></div>
          </dl>
        </article>)}</div>
        {!error && !listado.ordenes.length && <p className="py-8 text-center text-gray-500">{consulta ? "No se encontraron órdenes que coincidan con la búsqueda." : "Aún no hay órdenes de compra cargadas. Usa Cargar orden para agregar la primera."}</p>}
      </>}
      <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500">
        <span>{listado.total} órdenes · Página {listado.pagina} de {Math.max(1, Math.ceil(listado.total / 20))}</span>
        <div className="flex gap-2"><button type="button" className={secundario} disabled={!!ocupado || listado.pagina <= 1} onClick={() => consultar(listado.pagina - 1, consulta)}>Anterior</button><button type="button" className={secundario} disabled={!!ocupado || listado.pagina * 20 >= listado.total} onClick={() => consultar(listado.pagina + 1, consulta)}>Siguiente</button></div>
      </footer>
    </article>
  );
};
