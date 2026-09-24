import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FaSave, FaTrash, FaTimes } from "react-icons/fa";

export const ConfirmacionOrdenCompra = ({ tipo, archivo, orden, ocupado, cerrar, confirmar }) => {
  const panel = useRef(null);
  const borrar = tipo === "BORRAR";
  useEffect(() => {
    const anterior = document.activeElement;
    panel.current?.focus();
    return () => { if (anterior?.isConnected) anterior.focus(); };
  }, []);
  function teclado(e) {
    if (e.key === "Escape" && !ocupado) cerrar();
    if (e.key !== "Tab") return;
    const botones = [...panel.current.querySelectorAll('button:not(:disabled)')];
    if (!botones.length) { e.preventDefault(); return; }
    const primero = botones[0]; const ultimo = botones[botones.length - 1];
    if (e.shiftKey && (document.activeElement === primero || document.activeElement === panel.current)) { e.preventDefault(); ultimo.focus(); }
    if (!e.shiftKey && (document.activeElement === ultimo || document.activeElement === panel.current)) { e.preventDefault(); primero.focus(); }
  }
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-3 md:p-6" onClick={() => { if (!ocupado) cerrar(); }}>
      <section ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="confirmacion-compra-titulo" aria-describedby="confirmacion-compra-descripcion" onKeyDown={teclado} onClick={(e) => e.stopPropagation()} className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl focus:outline-none">
        <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${borrar ? "border-red-100 bg-red-50 text-red-700" : "border-blue-100 bg-blue-50 text-blue-800"}`}>{borrar ? <FaTrash /> : <FaSave />}</span>
          <h2 id="confirmacion-compra-titulo" className="flex-1 text-lg font-bold text-slate-900">{borrar ? "Borrar archivo cargado" : "Guardar orden de compra"}</h2>
          <button type="button" aria-label="Cerrar confirmación" disabled={!!ocupado} onClick={cerrar} className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50"><FaTimes /></button>
        </header>
        <div className="space-y-3 p-5 text-sm text-slate-600">
          <p id="confirmacion-compra-descripcion">{borrar ? "Se retirarán el archivo seleccionado y su vista previa. Puedes seleccionar el archivo nuevamente después." : "Se guardará esta orden con todos los productos de la vista previa."}</p>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 break-words"><p className="font-semibold text-slate-800">{archivo?.name}</p>{orden && <p className="mt-1">{orden.tipoDocumento} · {orden.numero} · {orden.productos.length} productos</p>}</div>
        </div>
        <footer className="flex gap-3 border-t border-slate-200 px-5 py-4">
          <button type="button" disabled={!!ocupado} onClick={cerrar} className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-50">Cancelar</button>
          <button type="button" disabled={!!ocupado} onClick={confirmar} className={`flex-1 rounded-lg px-4 py-2 text-sm text-white disabled:opacity-50 ${borrar ? "bg-red-600 hover:bg-red-700" : "bg-blue-800 hover:bg-blue-900"}`}>{ocupado ? "Guardando…" : borrar ? "Borrar archivo" : "Guardar"}</button>
        </footer>
      </section>
    </div>, document.body
  );
};
