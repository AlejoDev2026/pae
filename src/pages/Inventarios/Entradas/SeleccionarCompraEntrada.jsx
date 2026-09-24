import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaFileInvoice, FaCalendarAlt, FaChevronRight } from 'react-icons/fa';
import { API_BASE } from '../../../constants';

const formatoCantidad = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 });

export const SeleccionarCompraEntrada = ({ cerrar, seleccionar }) => {
    const [busqueda, setBusqueda] = useState('');
    const [lista, setLista] = useState({ ordenes: [], total: 0, pagina: 1 });
    const [orden, setOrden] = useState(null);
    const [error, setError] = useState('');
    const [ocupado, setOcupado] = useState(false);
    const control = useRef(null);
    const bloqueado = useRef(false);
    const panel = useRef(null);
    async function consultar(campos = {}) {
        if (bloqueado.current) return;
        bloqueado.current = true; setOcupado(true); setError('');
        try {
            const form = new FormData();
            form.append('correoSesion', JSON.parse(localStorage.getItem('us') || '{}')?.correo || '');
            form.append('tokenSesion', localStorage.getItem('st') || '');
            Object.entries(campos).forEach(([k,v]) => form.append(k,v));
            control.current = new AbortController();
            const res = await fetch(`${API_BASE}Inventario/Entradas/InventarioEntradasCompras.php`, { method: 'POST', body: form, signal: control.current.signal });
            let json; try { json = await res.json(); } catch { throw new Error('El servidor no devolvió una respuesta válida.'); }
            if (!res.ok || json.rpta !== 'si') throw new Error(json.mensaje || 'No fue posible consultar las compras.');
            if (campos.idOrdenCompra) setOrden(json.data); else { setLista(json.data); setOrden(null); }
        } catch (e) { if (e.name !== 'AbortError') setError(e.message); }
        finally { bloqueado.current = false; setOcupado(false); }
    }
    useEffect(() => {
        const anterior = document.activeElement;
        panel.current?.focus();
        const timer = setTimeout(() => consultar(), 0);
        return () => { clearTimeout(timer); control.current?.abort(); anterior?.focus(); };
    }, []);
    const pendientes = (orden?.productos || []).filter(p => Number(p.cantidadPendiente) > 0);
    const faltantes = pendientes.filter(p => !p.producto);
    const boton = 'rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100 focus:ring-2 focus:ring-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';
    return createPortal(<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-3">
        <section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Seleccionar orden de compra" className="flex h-[80dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-2xl focus:outline-none" onKeyDown={e => {
            if (e.key === 'Escape') cerrar();
            if (e.key === 'Tab') { const items = [...panel.current.querySelectorAll('button:not(:disabled),input:not(:disabled)')]; const first = items[0]; const last = items[items.length-1]; if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { e.preventDefault(); first?.focus(); } }
        }}>
            <header className="flex shrink-0 items-center justify-between gap-3 bg-blue-800 px-4 py-3 text-white"><h2 className="font-bold text-sm sm:text-base">Seleccionar orden de compra</h2><button type="button" className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100 focus:ring-2 focus:ring-white transition-colors" onClick={cerrar}>Cerrar</button></header>
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4 space-y-4">
            <form className="flex gap-2" onSubmit={e => { e.preventDefault(); consultar({busqueda,pagina:1}); }}><input aria-label="Buscar compra" placeholder="Número, proveedor o NIT" value={busqueda} onChange={e=>setBusqueda(e.target.value)} className="w-full min-w-0 rounded-lg border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-blue-300 focus:outline-none" /><button disabled={ocupado} className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900 focus:ring-2 focus:ring-blue-400 disabled:opacity-40 disabled:cursor-not-allowed">Buscar</button></form>
            {error && <p role="alert" className="text-red-700">{error}</p>}
            {ocupado && <p role="status">Consultando…</p>}
            {!orden && <>
            <p className="text-sm text-slate-500">Selecciona una orden para revisar sus productos y cantidades pendientes.</p>
            <div className="space-y-3">{lista.ordenes.map(o => (
                <button key={o.id} type="button" disabled={ocupado} onClick={() => consultar({ idOrdenCompra: o.id })} className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 border-l-4 border-l-blue-600 bg-white p-4 text-left shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-4">
                    <span className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-800 sm:flex"><FaFileInvoice aria-hidden="true" className="text-xl" /></span>
                    <span className="min-w-0 flex-1 space-y-2">
                        <span className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">{o.tipoDocumento}</span><strong className="break-all text-base text-slate-800">Orden {o.numero}</strong></span>
                        <span className="block break-words text-sm font-medium text-slate-600">{o.proveedor}</span>
                        <span className="flex items-center gap-2 text-xs text-slate-500"><FaCalendarAlt aria-hidden="true" />{o.fecha}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-50 p-2 text-sm font-semibold text-blue-800 group-hover:bg-blue-100 sm:px-3"><span className="hidden sm:inline">Ver productos</span><FaChevronRight aria-hidden="true" /></span>
                </button>
            ))}</div>
            {!ocupado && !lista.ordenes.length && <p>No hay órdenes para esta búsqueda.</p>}
            <div className="flex items-center gap-3"><button type="button" className={boton} disabled={ocupado || lista.pagina<=1} onClick={()=>consultar({busqueda,pagina:lista.pagina-1})}>Anterior</button><span>{lista.pagina}</span><button type="button" className={boton} disabled={ocupado || lista.pagina*20>=lista.total} onClick={()=>consultar({busqueda,pagina:lista.pagina+1})}>Siguiente</button></div></>}
            {orden && <><h3 className="font-semibold">{orden.tipoDocumento} · {orden.numero} — {orden.proveedor}</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                <table className="w-full min-w-[620px] border-separate border-spacing-y-2 text-sm">
                    <thead><tr>{['Código', 'Producto', 'Pedida', 'Recibida en PAE', 'Pendiente'].map((h, i) => (
                        <th key={h} scope="col" className={`bg-[#ECEEF1] px-3 py-3 font-semibold text-slate-700 ${i < 2 ? 'text-left' : 'text-center whitespace-nowrap'} ${i === 0 ? 'rounded-l-lg' : ''} ${i === 4 ? 'rounded-r-lg' : ''}`}>{h}</th>
                    ))}</tr></thead>
                    <tbody>{orden.productos.map(p => (
                        <tr key={p.id} className="group text-slate-600">
                            <td className="rounded-l-lg border-y border-l border-slate-200 px-3 py-3 font-medium text-blue-800 group-hover:bg-blue-50">{p.codigo}</td>
                            <td className="border-y border-slate-200 px-3 py-3 group-hover:bg-blue-50">{p.descripcion}{!p.producto && <p className="mt-1 text-xs text-red-700">Sin coincidencia única activa en el catálogo.</p>}</td>
                            <td className="border-y border-slate-200 px-3 py-3 text-center tabular-nums group-hover:bg-blue-50">{formatoCantidad.format(Number(p.cantidad))}</td>
                            <td className="border-y border-slate-200 px-3 py-3 text-center tabular-nums group-hover:bg-blue-50">{formatoCantidad.format(Number(p.cantidadRecibida))}</td>
                            <td className="rounded-r-lg border-y border-r border-slate-200 px-3 py-3 text-center tabular-nums group-hover:bg-blue-50"><span className={`inline-flex rounded-md px-2.5 py-1 font-semibold ${Number(p.cantidadPendiente) > 0 ? 'bg-blue-50 text-blue-800' : 'bg-slate-100 text-slate-500'}`}>{formatoCantidad.format(Number(p.cantidadPendiente))}</span></td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
            <p className="text-sm text-slate-500">El pendiente considera las recepciones finalizadas en PAE. Registra únicamente la cantidad que recibes y asigna sus lotes.</p>
            {!!faltantes.length && <p role="alert" className="text-red-700">Revisa los códigos sin coincidencia en el catálogo antes de cargar esta orden.</p>}
            <button type="button" disabled={ocupado || !pendientes.length || !!faltantes.length} onClick={()=>seleccionar(orden,pendientes)} className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-semibold hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed">Cargar productos</button></>}
            </div>
        </section>
    </div>,document.body);
};
