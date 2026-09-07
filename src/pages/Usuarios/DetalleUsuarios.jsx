import { createElement, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import {
  FaArrowLeft, FaBuilding, FaCheckCircle, FaEnvelope, FaEye, FaEyeSlash,
  FaIdBadge, FaLock, FaMobileAlt, FaSave, FaShieldAlt, FaSyncAlt, FaUserAlt,
} from "react-icons/fa";
import { IoMenu } from "react-icons/io5";
import { API_BASE } from "../../constants";
import logoPae from "../../assets/logoPae.png";

const FORMULARIO_INICIAL = { nombre: "", telefono: "", correo: "", contrasena: "", rol: "" };

const parametrosSesion = () => {
  const usuario = JSON.parse(localStorage.getItem("us") || "null");
  return new URLSearchParams({ correoSesion: usuario?.correo || "", tokenSesion: localStorage.getItem("st") || "" }).toString();
};

const agregarSesion = (datos) => {
  const usuario = JSON.parse(localStorage.getItem("us") || "null");
  datos.append("correoSesion", usuario?.correo || "");
  datos.append("tokenSesion", localStorage.getItem("st") || "");
};

const leerJsonSeguro = async (response) => {
  const texto = await response.text();
  try { return JSON.parse(texto); } catch { throw new Error("El servidor devolvió una respuesta inválida."); }
};

const Campo = ({ icono, error, children, label, htmlFor }) => (
  <div>
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-bold text-slate-700">{label}</label>
    <div className={`relative rounded-xl border bg-white transition focus-within:ring-2 focus-within:ring-blue-100 ${error ? "border-red-300" : "border-slate-300 focus-within:border-blue-700"}`}>
      {createElement(icono, { className: "absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" })}
      {children}
    </div>
    <p className="min-h-5 pt-1 text-xs font-medium text-red-600">{error || ""}</p>
  </div>
);

export const DetalleUsuarios = ({ setSidebar, navegar }) => {
  const usuarioId = Number(localStorage.getItem("usuarioGestionId") || 0);
  const editando = usuarioId > 0;
  const [formulario, setFormulario] = useState(FORMULARIO_INICIAL);
  const [roles, setRoles] = useState([]);
  const [cargandoRoles, setCargandoRoles] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [cargandoUsuario, setCargandoUsuario] = useState(editando);
  const [restableciendo, setRestableciendo] = useState(false);
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [errores, setErrores] = useState({});
  const peticionRef = useRef(null);

  const rolSeleccionado = useMemo(
    () => roles.find((rol) => String(rol.id) === String(formulario.rol)),
    [formulario.rol, roles]
  );

  useEffect(() => {
    const controller = new AbortController();
    const cargarRoles = async () => {
      setCargandoRoles(true);
      try {
        const response = await fetch(`${API_BASE}usuarios/detalleUsuarios.php?case=1&${parametrosSesion()}`, {
          signal: controller.signal, cache: "no-store",
        });
        const resultado = await leerJsonSeguro(response);
        if (!response.ok || resultado?.rpta !== "si") {
          throw new Error(resultado?.mensaje || "No fue posible consultar los roles.");
        }
        setRoles(Array.isArray(resultado.data) ? resultado.data : []);
      } catch (error) {
        if (error?.name === "AbortError") return;
        setRoles([]);
        toast.error(error?.message || "No fue posible consultar los roles.");
      } finally {
        if (!controller.signal.aborted) setCargandoRoles(false);
      }
    };
    cargarRoles();
    return () => controller.abort();
  }, []);

  useEffect(() => () => peticionRef.current?.abort(), []);

  useEffect(() => {
    if (!editando) return undefined;
    const controller = new AbortController();
    const cargarUsuario = async () => {
      setCargandoUsuario(true);
      try {
        const response = await fetch(`${API_BASE}usuarios/usuarios.php?case=2&id=${usuarioId}&${parametrosSesion()}`, {
          signal: controller.signal, cache: "no-store",
        });
        const resultado = await leerJsonSeguro(response);
        if (!response.ok || resultado?.rpta !== "si" || !resultado?.data) {
          throw new Error(resultado?.mensaje || "No fue posible consultar el usuario.");
        }
        const usuario = resultado.data;
        setFormulario({
          nombre: usuario.nombre || "",
          telefono: usuario.telefono || "",
          correo: usuario.correo || "",
          contrasena: "",
          rol: String(usuario.idRol || ""),
        });
      } catch (error) {
        if (error?.name !== "AbortError") toast.error(error?.message || "No fue posible consultar el usuario.");
      } finally {
        if (!controller.signal.aborted) setCargandoUsuario(false);
      }
    };
    cargarUsuario();
    return () => controller.abort();
  }, [editando, usuarioId]);

  const actualizarCampo = ({ target: { name, value } }) => {
    setFormulario((actual) => ({ ...actual, [name]: value }));
    setErrores((actual) => ({ ...actual, [name]: "" }));
  };

  const validarFormulario = () => {
    const nuevosErrores = {};
    if (formulario.nombre.trim().length < 3) nuevosErrores.nombre = "Ingresa el nombre completo.";
    if (!/^[0-9+()\s-]{7,20}$/.test(formulario.telefono.trim())) nuevosErrores.telefono = "Ingresa un teléfono válido.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formulario.correo.trim())) nuevosErrores.correo = "Ingresa un correo válido.";
    if (!editando && formulario.contrasena.length < 8) nuevosErrores.contrasena = "Usa al menos 8 caracteres.";
    if (!formulario.rol) nuevosErrores.rol = "Selecciona un rol.";
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const guardarDatos = async (evento) => {
    evento.preventDefault();
    if (guardando || !validarFormulario()) return;
    peticionRef.current?.abort();
    const controller = new AbortController();
    peticionRef.current = controller;
    setGuardando(true);
    try {
      const datos = new FormData();
      agregarSesion(datos);
      datos.append("nombre", formulario.nombre.trim());
      datos.append("telefono", formulario.telefono.trim());
      datos.append("correo", formulario.correo.trim().toLowerCase());
      datos.append("rol", formulario.rol);
      if (editando) datos.append("id", String(usuarioId));
      else datos.append("contrasena", formulario.contrasena);
      const response = await fetch(`${API_BASE}${editando ? "usuarios/usuarios.php?case=4" : "usuarios/detalleUsuarios.php?case=2"}`, {
        method: "POST", body: datos, signal: controller.signal,
      });
      const resultado = await leerJsonSeguro(response);
      if (!response.ok || resultado?.rpta !== "si") throw new Error(resultado?.mensaje || `No fue posible ${editando ? "actualizar" : "crear"} el usuario.`);
      toast.success(resultado?.mensaje || `Usuario ${editando ? "actualizado" : "creado"} correctamente.`);
      localStorage.removeItem("usuarioGestionId");
      navegar("Usuarios");
    } catch (error) {
      if (error?.name !== "AbortError") toast.error(error?.message || "No fue posible crear el usuario.");
    } finally {
      if (!controller.signal.aborted) setGuardando(false);
    }
  };

  const restablecerContrasena = async () => {
    if (restableciendo || formulario.contrasena.length < 8) {
      setErrores((actual) => ({ ...actual, contrasena: "Usa al menos 8 caracteres." }));
      return;
    }
    if (!window.confirm("Se cerrarÃ¡ la sesiÃ³n activa del usuario y deberÃ¡ ingresar con la nueva contraseÃ±a. Â¿Deseas continuar?")) return;

    setRestableciendo(true);
    try {
      const datos = new FormData();
      agregarSesion(datos);
      datos.append("id", String(usuarioId));
      datos.append("contrasena", formulario.contrasena);
      const response = await fetch(`${API_BASE}usuarios/usuarios.php?case=5`, { method: "POST", body: datos });
      const resultado = await leerJsonSeguro(response);
      if (!response.ok || resultado?.rpta !== "si") throw new Error(resultado?.mensaje || "No fue posible restablecer la contraseÃ±a.");
      setFormulario((actual) => ({ ...actual, contrasena: "" }));
      toast.success(resultado.mensaje || "ContraseÃ±a restablecida correctamente.");
    } catch (error) {
      toast.error(error?.message || "No fue posible restablecer la contraseÃ±a.");
    } finally {
      setRestableciendo(false);
    }
  };

  const iniciales = formulario.nombre.trim().split(/\s+/).slice(0, 2)
    .map((parte) => parte.charAt(0).toUpperCase()).join("") || "NU";
  const colorRol = rolSeleccionado?.color || "#1d4ed8";

  return (
    <div className="min-h-screen w-full bg-slate-100 p-3 md:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setSidebar?.(true)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm md:hidden" aria-label="Abrir menú"><IoMenu className="text-xl" /></button>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Administración</p>
              <h1 className="text-xl font-black text-slate-900 md:text-2xl">{editando ? "Detalle del usuario" : "Crear usuario"}</h1>
              <p className="mt-1 hidden text-sm text-slate-500 sm:block">{editando ? "Consulta y actualiza los datos de la cuenta." : "Registra la cuenta y verifica su identificación antes de guardar."}</p>
            </div>
          </div>
          <button type="button" onClick={() => navegar("Usuarios")} disabled={guardando} className="flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"><FaArrowLeft /><span className="hidden sm:inline">Volver</span></button>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
          <form onSubmit={guardarDatos} className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${cargandoUsuario ? "pointer-events-none opacity-60" : ""}`}>
            <div className="border-b border-slate-200 px-5 py-4 md:px-7">
              <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-800"><FaUserAlt /></div><div><h2 className="font-black text-slate-900">Información de la cuenta</h2><p className="text-sm text-slate-500">{cargandoUsuario ? "Consultando usuario…" : "Los datos generales son obligatorios."}</p></div></div>
            </div>
            <div className="grid gap-x-5 px-5 py-6 md:grid-cols-2 md:px-7">
              <div className="md:col-span-2">
                <Campo icono={FaUserAlt} label="Nombre completo" htmlFor="nombre" error={errores.nombre}>
                  <input id="nombre" name="nombre" value={formulario.nombre} onChange={actualizarCampo} autoComplete="name" maxLength={120} placeholder="Ej. Andrea Martínez" className="h-11 w-full rounded-xl bg-transparent pl-11 pr-4 text-sm outline-none" />
                </Campo>
              </div>
              <Campo icono={FaMobileAlt} label="Número telefónico" htmlFor="telefono" error={errores.telefono}>
                <input id="telefono" name="telefono" type="tel" inputMode="tel" value={formulario.telefono} onChange={actualizarCampo} autoComplete="tel" maxLength={20} placeholder="Ej. 300 000 0000" className="h-11 w-full rounded-xl bg-transparent pl-11 pr-4 text-sm outline-none" />
              </Campo>
              <Campo icono={FaEnvelope} label="Correo electrónico" htmlFor="correo" error={errores.correo}>
                <input id="correo" name="correo" type="email" value={formulario.correo} onChange={actualizarCampo} autoComplete="email" maxLength={160} placeholder="usuario@empresa.com" className="h-11 w-full rounded-xl bg-transparent pl-11 pr-4 text-sm outline-none" />
              </Campo>
              <Campo icono={FaShieldAlt} label="Rol en el sistema" htmlFor="rol" error={errores.rol}>
                <select id="rol" name="rol" value={formulario.rol} onChange={actualizarCampo} disabled={cargandoRoles} className="h-11 w-full appearance-none rounded-xl bg-transparent pl-11 pr-9 text-sm outline-none disabled:bg-slate-50">
                  <option value="">{cargandoRoles ? "Consultando roles…" : "Selecciona un rol"}</option>
                  {roles.map((rol) => <option key={rol.id} value={rol.id}>{rol.parametro}</option>)}
                </select>
              </Campo>
              <Campo icono={FaLock} label={editando ? "Nueva contraseña" : "Contraseña temporal"} htmlFor="contrasena" error={errores.contrasena}>
                <input id="contrasena" name="contrasena" type={mostrarContrasena ? "text" : "password"} value={formulario.contrasena} onChange={actualizarCampo} autoComplete="new-password" minLength={8} maxLength={72} placeholder={editando ? "Solo para restablecerla" : "Mínimo 8 caracteres"} className="h-11 w-full rounded-xl bg-transparent pl-11 pr-11 text-sm outline-none" />
                <button type="button" onClick={() => setMostrarContrasena((valor) => !valor)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-blue-800" aria-label={mostrarContrasena ? "Ocultar contraseña" : "Mostrar contraseña"}>{mostrarContrasena ? <FaEyeSlash /> : <FaEye />}</button>
              </Campo>
              <div className="md:col-span-2 mt-2 flex flex-col gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900 sm:flex-row sm:items-center sm:justify-between">
                <span>{editando ? "Escribe una nueva contraseña únicamente si deseas restablecerla." : "La contraseña se protege en el servidor. Entrégala al usuario por un canal seguro."}</span>
                {editando && <button type="button" onClick={restablecerContrasena} disabled={restableciendo || guardando} className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 font-bold text-white hover:bg-amber-700 disabled:opacity-60">{restableciendo ? <FaSyncAlt className="animate-spin" /> : <FaLock />}{restableciendo ? "Restableciendo…" : "Restablecer contraseña"}</button>}
              </div>
            </div>
            <footer className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end md:px-7">
              <button type="button" onClick={() => navegar("Usuarios")} disabled={guardando} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-60">Cancelar</button>
              <button type="submit" disabled={guardando || cargandoRoles || cargandoUsuario || restableciendo} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-800 px-6 text-sm font-bold text-white shadow-sm hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60">{guardando ? <FaSyncAlt className="animate-spin" /> : <FaSave />}{guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear usuario"}</button>
            </footer>
          </form>

          <aside className="lg:sticky lg:top-6">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Vista previa del carné</p>
            <div className="relative mx-auto aspect-[0.64] w-full max-w-[360px] overflow-hidden rounded-[28px] border border-blue-950/10 bg-white shadow-2xl shadow-blue-950/20">
              <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-br from-blue-950 via-blue-800 to-cyan-600" />
              <div className="absolute -right-16 top-16 h-44 w-44 rounded-full border-[28px] border-white/10" />
              <div className="relative flex h-full flex-col px-7 pb-7 pt-6">
                <div className="flex items-center justify-between gap-4 text-white">
                  <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white p-1.5 shadow-md"><img src={logoPae} alt="PAE" className="h-full w-full object-contain" /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-100">Acción por Colombia</p><p className="text-sm font-black">Sistema PAE</p></div></div><FaIdBadge className="text-2xl text-white/70" />
                </div>
                <div className="mt-8 flex justify-center"><div className="flex h-32 w-32 items-center justify-center rounded-full border-[6px] border-white bg-gradient-to-br from-blue-50 to-slate-200 text-4xl font-black text-blue-900 shadow-xl">{iniciales}</div></div>
                <div className="mt-5 text-center"><p className="min-h-14 break-words text-xl font-black uppercase leading-tight text-slate-900">{formulario.nombre.trim() || "NOMBRE DEL USUARIO"}</p><span className="mt-2 inline-flex max-w-full items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide text-white" style={{ backgroundColor: colorRol }}>{rolSeleccionado?.parametro || "ROL DEL SISTEMA"}</span></div>
                <div className="mt-6 space-y-3 border-t border-slate-200 pt-5">
                  <div className="flex items-start gap-3"><FaEnvelope className="mt-0.5 shrink-0 text-blue-700" /><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Correo corporativo</p><p className="truncate text-sm font-bold text-slate-700">{formulario.correo.trim() || "usuario@empresa.com"}</p></div></div>
                  <div className="flex items-start gap-3"><FaMobileAlt className="mt-0.5 shrink-0 text-blue-700" /><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Contacto</p><p className="text-sm font-bold text-slate-700">{formulario.telefono.trim() || "300 000 0000"}</p></div></div>
                </div>
                <div className="mt-auto flex items-end justify-between border-t border-dashed border-slate-300 pt-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Identificación interna</p><p className="mt-1 font-mono text-sm font-black text-blue-950">PAE · {editando ? `USUARIO ${usuarioId}` : "NUEVO USUARIO"}</p></div><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><FaCheckCircle /></div></div>
              </div>
            </div>
            <div className="mx-auto mt-4 flex max-w-[360px] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500 shadow-sm"><FaBuilding className="shrink-0 text-blue-700" />La información del carné se actualiza mientras completas el formulario.</div>
          </aside>
        </div>
      </div>
    </div>
  );
};
