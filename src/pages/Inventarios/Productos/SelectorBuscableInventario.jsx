import { useEffect, useMemo, useRef, useState } from "react";
import { FaChevronDown, FaSearch, FaTimes } from "react-icons/fa";

export const SelectorBuscableInventario = ({
  opciones = [],
  valor,
  alCambiar,
  textoOpcion,
  textoBusqueda,
  placeholder,
  deshabilitado = false,
  permitirLimpiar = false,
}) => {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const contenedorRef = useRef(null);
  const inputRef = useRef(null);
  const seleccionado = opciones.find((opcion) => Number(opcion.id) === Number(valor));
  const textoSeleccionado = seleccionado ? textoOpcion(seleccionado) : "";

  useEffect(() => {
    setBusqueda(textoSeleccionado);
  }, [textoSeleccionado]);

  useEffect(() => {
    const cerrar = (evento) => {
      if (!contenedorRef.current?.contains(evento.target)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  const resultados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino || termino === textoSeleccionado.toLowerCase()) return opciones;
    return opciones.filter((opcion) => textoBusqueda(opcion).toLowerCase().includes(termino));
  }, [busqueda, opciones, textoBusqueda, textoSeleccionado]);

  const abrir = () => {
    if (deshabilitado) return;
    setAbierto(true);
    requestAnimationFrame(() => inputRef.current?.select());
  };

  return (
    <div ref={contenedorRef} className="relative">
      <FaSearch className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-blue-700 text-sm" />
      <input
        ref={inputRef}
        type="text"
        value={busqueda}
        disabled={deshabilitado}
        onFocus={abrir}
        onChange={(evento) => { setBusqueda(evento.target.value); setAbierto(true); }}
        placeholder={deshabilitado ? "Cargando opciones..." : placeholder}
        className="h-11 w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-16 text-sm outline-none transition focus:border-[#193CB8] focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
      />
      {permitirLimpiar && valor ? <button type="button" onClick={() => { alCambiar(""); setBusqueda(""); setAbierto(false); }} className="absolute right-8 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700" aria-label="Limpiar selección"><FaTimes /></button> : null}
      <button type="button" onClick={() => abierto ? setAbierto(false) : abrir()} disabled={deshabilitado} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-blue-800 disabled:opacity-40" aria-label="Mostrar opciones"><FaChevronDown className={abierto ? "rotate-180 transition-transform" : "transition-transform"} /></button>
      {abierto && <div className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
        {resultados.length === 0 ? <p className="px-3 py-3 text-sm text-slate-500">No hay coincidencias.</p> : resultados.map((opcion) => <button key={opcion.id} type="button" onMouseDown={(evento) => { evento.preventDefault(); alCambiar(opcion.id); setBusqueda(textoOpcion(opcion)); setAbierto(false); }} className={`block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-blue-50 ${Number(opcion.id) === Number(valor) ? "bg-blue-50 font-semibold text-blue-900" : "text-slate-700"}`}>{textoOpcion(opcion)}</button>)}
      </div>}
    </div>
  );
};
