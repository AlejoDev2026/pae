import React, { useEffect, useState } from "react";
import { IoMenu } from "react-icons/io5";
import {
  FaArrowLeft,
  FaSave,
  FaInfoCircle,
  FaMapMarkerAlt,
  FaClipboardList,
} from "react-icons/fa";
import { FaWarehouse } from "react-icons/fa6";
import { toast } from "react-toastify";

const API_BASE_INVENTARIO =
  "https://app.accionporcolombia.com/servicesPae/Inventario/";

export const CrearUbicacionInventario = ({ setSidebar, navegar }) => {
  const abrirMenu = () => setSidebar(true);
  const estadoPagina = (pagina) => navegar(pagina);

  const [guardando, setGuardando] = useState(false);
  const [cargandoBodegas, setCargandoBodegas] = useState(false);
  const [bodegas, setBodegas] = useState([]);

  const [form, setForm] = useState({
    idBodega: "",
    codigo: "",
    nombre: "",
    descripcion: "",
    estado: 1,
  });

  const esActiva = Number(form.estado) === 1;

  const bodegaSeleccionada = bodegas.find(
    (bodega) => String(bodega.id) === String(form.idBodega)
  );

  const cargarBodegas = async () => {
    try {
      setCargandoBodegas(true);

      const res = await fetch(
        `${API_BASE_INVENTARIO}InventarioBodegasListar.php`,
        { cache: "no-store" }
      );

      const json = await res.json();

      if (!json.rpta) {
        toast.error(json.mensaje || "No se pudieron cargar las bodegas");
        return;
      }

      const data = Array.isArray(json.data) ? json.data : [];

      setBodegas(data.filter((item) => Number(item.estado) === 1));
    } catch (error) {
      console.error(error);
      toast.error("Error al consultar las bodegas");
    } finally {
      setCargandoBodegas(false);
    }
  };

  useEffect(() => {
    cargarBodegas();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]:
        name === "codigo"
          ? value.toUpperCase()
          : name === "estado"
          ? Number(value)
          : value,
    }));
  };

  const validarFormulario = () => {
    if (!form.idBodega) {
      toast.warning("Debes seleccionar una bodega");
      return false;
    }

    if (!form.codigo.trim()) {
      toast.warning("Debes escribir el código de la ubicación");
      return false;
    }

    if (!form.nombre.trim()) {
      toast.warning("Debes escribir el nombre de la ubicación");
      return false;
    }

    return true;
  };

  const guardarUbicacion = async (e) => {
    e.preventDefault();

    if (!validarFormulario()) return;

    try {
      setGuardando(true);

      const payload = {
        id: 0,
        idBodega: Number(form.idBodega),
        codigo: form.codigo.trim().toUpperCase(),
        nombre: form.nombre.trim(),
        descripcion: form.descripcion.trim(),
        estado: Number(form.estado),
      };

      const res = await fetch(
        `${API_BASE_INVENTARIO}InventarioUbicacionesGuardar.php`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
          body: JSON.stringify(payload),
        }
      );

      const response = await res.json();

      if (!response.rpta) {
        toast.error(response.mensaje || "No se pudo guardar la ubicación");
        return;
      }

      toast.success(response.mensaje || "Ubicación guardada correctamente");
      estadoPagina("UbicacionesInventario");
    } catch (error) {
      console.error(error);
      toast.error("Ocurrió un error al guardar la ubicación");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="w-full h-screen flex flex-col p-6 gap-6 bg-slate-100">
      <div className="flex items-center gap-5 lg:hidden">
        <div
          className="p-2 rounded-lg hover:bg-gray-300 cursor-pointer"
          onClick={abrirMenu}
        >
          <IoMenu className="text-2xl" />
        </div>

        <h1 className="text-lg font-bold">Crear ubicación</h1>
      </div>

      <article className="flex-1 bg-white shadow-lg rounded-2xl flex flex-col overflow-hidden border border-slate-200">
        <nav className="w-full px-6 py-5 border-b border-slate-200 bg-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <button
                className="h-10 w-10 flex items-center justify-center border border-slate-300 rounded-xl bg-white hover:bg-slate-100 transition-colors"
                onClick={() => estadoPagina("UbicacionesInventario")}
                type="button"
              >
                <FaArrowLeft className="text-slate-700" />
              </button>

              <div className="h-12 w-12 rounded-2xl bg-blue-800 text-white flex items-center justify-center shadow-sm">
                <FaMapMarkerAlt className="text-xl" />
              </div>

              <div>
                <h1 className="text-[calc(0.9rem+0.7vw)] font-bold text-slate-800">
                  Crear ubicación
                </h1>

                <p className="text-sm text-slate-500">
                  Registra una ubicación interna asociada a una bodega.
                </p>
              </div>
            </div>

            <button
              className="px-5 py-2.5 bg-blue-800 text-white rounded-xl hover:bg-blue-900 flex items-center justify-center gap-2 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm font-semibold"
              onClick={guardarUbicacion}
              disabled={guardando}
              type="button"
            >
              <FaSave />
              <span>{guardando ? "Guardando..." : "Guardar ubicación"}</span>
            </button>
          </div>
        </nav>

        <form
          onSubmit={guardarUbicacion}
          className="flex-1 overflow-y-auto no-scrollbar bg-slate-50"
        >
          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
              <section className="min-w-0">
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-800 flex items-center justify-center">
                      <FaClipboardList />
                    </div>

                    <div>
                      <h2 className="text-base lg:text-lg font-bold text-slate-800">
                        Información de la ubicación
                      </h2>
                      <p className="text-sm text-slate-500">
                        Define la bodega y el punto físico de almacenamiento.
                      </p>
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">
                          Bodega <span className="text-red-500">*</span>
                        </label>

                        <div className="relative">
                          <FaWarehouse className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-700 text-sm" />

                          <select
                            name="idBodega"
                            value={form.idBodega}
                            onChange={handleChange}
                            disabled={cargandoBodegas}
                            className="h-11 w-full border border-slate-300 bg-white rounded-xl pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition disabled:bg-slate-100"
                          >
                            <option value="">
                              {cargandoBodegas
                                ? "Cargando bodegas..."
                                : "Seleccionar bodega"}
                            </option>

                            {bodegas.map((bodega) => (
                              <option key={bodega.id} value={bodega.id}>
                                {bodega.codigo
                                  ? `${bodega.codigo} - ${bodega.nombre}`
                                  : bodega.nombre}
                              </option>
                            ))}
                          </select>
                        </div>

                        <span className="text-xs text-slate-400">
                          Bodega donde estará ubicada esta posición.
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">
                          Estado <span className="text-red-500">*</span>
                        </label>

                        <div className="relative">
                          <span
                            className={`absolute left-3 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full ${
                              esActiva ? "bg-emerald-500" : "bg-red-500"
                            }`}
                          ></span>

                          <select
                            name="estado"
                            value={form.estado}
                            onChange={handleChange}
                            className="h-11 w-full border border-slate-300 bg-white rounded-xl pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                          >
                            <option value={1}>ACTIVA</option>
                            <option value={0}>INACTIVA</option>
                          </select>
                        </div>

                        <span className="text-xs text-slate-400">
                          Controla si la ubicación puede usarse.
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">
                          Código <span className="text-red-500">*</span>
                        </label>

                        <div className="relative">
                          <FaMapMarkerAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-700 text-sm" />

                          <input
                            type="text"
                            name="codigo"
                            value={form.codigo}
                            onChange={handleChange}
                            style={{ textTransform: "uppercase" }}
                            className="h-11 w-full border border-slate-300 bg-white rounded-xl pl-10 pr-3 text-sm uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                            placeholder="EJ: PAS-01"
                          />
                        </div>

                        <span className="text-xs text-slate-400">
                          Código corto de identificación.
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-slate-700">
                          Nombre <span className="text-red-500">*</span>
                        </label>

                        <div className="relative">
                          <FaMapMarkerAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm" />

                          <input
                            type="text"
                            name="nombre"
                            value={form.nombre}
                            onChange={handleChange}
                            className="h-11 w-full border border-slate-300 bg-white rounded-xl pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition"
                            placeholder="Ej: Pasillo 01"
                          />
                        </div>

                        <span className="text-xs text-slate-400">
                          Nombre visible para el equipo logístico.
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-slate-700">
                        Descripción interna
                      </label>

                      <textarea
                        name="descripcion"
                        value={form.descripcion}
                        onChange={handleChange}
                        rows={8}
                        className="w-full border border-slate-300 bg-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-[#193CB8] transition resize-none"
                        placeholder="Describe el uso, zona, pasillo, estante o detalle operativo de la ubicación"
                      />

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-slate-400">
                        <span>Campo opcional para observaciones internas.</span>
                        <span>{form.descripcion.length} caracteres</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <aside className="min-w-0">
                <div className="sticky top-0 space-y-5">
                  <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                    <div className="h-1.5 bg-blue-800"></div>

                    <div className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-800 flex items-center justify-center">
                          <FaMapMarkerAlt className="text-xl" />
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">
                            Nueva ubicación
                          </p>

                          <h2 className="text-xl font-bold text-slate-800 break-words">
                            {form.codigo || "—"}
                          </h2>
                        </div>
                      </div>

                      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">
                          Bodega
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-800 break-words">
                          {bodegaSeleccionada
                            ? bodegaSeleccionada.codigo
                              ? `${bodegaSeleccionada.codigo} - ${bodegaSeleccionada.nombre}`
                              : bodegaSeleccionada.nombre
                            : "Sin bodega seleccionada"}
                        </p>
                      </div>

                      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">
                          Nombre
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-800 break-words">
                          {form.nombre || "Sin nombre"}
                        </p>
                      </div>

                      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">
                          Estado
                        </p>

                        <div
                          className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold border ${
                            esActiva
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-red-50 text-red-700 border-red-200"
                          }`}
                        >
                          {esActiva ? "ACTIVA" : "INACTIVA"}
                        </div>
                      </div>

                      <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <p className="text-xs uppercase tracking-wide text-slate-400 font-bold">
                          Descripción
                        </p>
                        <p className="mt-1 text-sm text-slate-600 break-words line-clamp-5">
                          {form.descripcion || "Sin descripción registrada."}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
                    <div className="h-1.5 bg-amber-400"></div>

                    <div className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                          <FaInfoCircle />
                        </div>

                        <h3 className="text-base font-bold text-slate-800">
                          Recomendación
                        </h3>
                      </div>

                      <p className="mt-3 text-sm text-slate-500 leading-relaxed">
                        Usa ubicaciones claras como{" "}
                        <strong className="text-slate-700">PAS-01</strong>,{" "}
                        <strong className="text-slate-700">EST-02</strong> o{" "}
                        <strong className="text-slate-700">ZONA-FRIA</strong>{" "}
                        para facilitar entradas, salidas y conteos físicos.
                      </p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-3 border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={() => estadoPagina("UbicacionesInventario")}
                className="px-5 py-2.5 border border-slate-300 rounded-xl bg-white hover:bg-slate-100 transition-colors font-semibold text-slate-700"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={guardando}
                className="px-5 py-2.5 bg-blue-800 text-white rounded-xl hover:bg-blue-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold shadow-sm"
              >
                <FaSave />
                {guardando ? "Guardando..." : "Guardar ubicación"}
              </button>
            </div>
          </div>
        </form>
      </article>
    </div>
  );
};