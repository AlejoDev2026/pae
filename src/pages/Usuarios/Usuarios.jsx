import { useState, useEffect } from "react";
import { ModalConfirmacion } from "../../components/modales/ModalConfirmacion";
import { API_BASE } from "../../constants";

import { FaSearch, FaTrash, FaTrashRestore } from "react-icons/fa";
import { FaPlus } from "react-icons/fa6";
import { IoMenu } from "react-icons/io5";

import { toast } from "react-toastify";
import { Tooltip } from "../../components/common/Tooltip";

export const Usuarios = ({
  setSidebar,
  navegar
}) => {
  // Función para abrir el menú lateral
  const abrirMenu = () => setSidebar(true);

  // Función para cambiar la pagina actual
  const estadoPagina = (pagina) => navegar(pagina);

  // Estados para almacenar todos los usuarios y el filtro de busqueda de los mismos
  const [Usuarios, setUsuarios] = useState([]);
  const [busqueda, setBusqueda] = useState("");

  // Función para obtener la información de todos los usuarios
  const obtenerUsuarios = async () => {
    try {
      const url = `${API_BASE}usuarios/usuarios.php?case=1&rol=1`;

      const res = await fetch(url, {
        method: "GET",
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
      const response = await res.json();
      console.log('rpta',response);
      if (response.rpta === "si") {
        setUsuarios(response.data || []);
      } else {
        setUsuarios([]);
        console.error("Error en consulta:", response.mensaje);
      }
    } catch (error) {
      toast.error("Ocurrió un error al obtener los usuarios");
      console.error("Error al obtener usuarios: ", error);
      setUsuarios([]);
    }
  };

  useEffect(() => {
    obtenerUsuarios();
  }, []);

  // Filtrar usuarios por cualquier campo visible en pantalla
  const usuariosFiltrados = Usuarios.filter((item) => {
    const termino = busqueda.toLowerCase();
    return (
      (item.nombre && item.nombre.toLowerCase().includes(termino)) ||
      (item.documento && item.documento.toLowerCase().includes(termino)) ||
      (item.correo && item.correo.toLowerCase().includes(termino)) ||
      (item.telefono && item.telefono.toLowerCase().includes(termino)) ||
      (item.estado && item.estado.toLowerCase().includes(termino))
    );
  });

  // Estado para manejar la visibilidad del modal para confirmar el cambio de estado de un usuario
  const [modalConfirmacion, setModalConfirmacion] = useState(false);
  // Estado para almacenar el usuario que se seleccionó para cambiar su estado 
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);

  // Función para abrir el modal para confirmar el cambio de estado de un usuario
  const abrirModalConfirmar = (usuario) => {
    setUsuarioSeleccionado(usuario);
    setModalConfirmacion(true);
  }

  // Función para cambiar el estado de un usuario seleccionado
  const cambiarEstadoUsuario = async () => {
    try {
      let url = `${API_BASE}usuarios/usuarios.php?case=3&id=${usuarioSeleccionado.id}`;

      const res = await fetch(url);
      const response = await res.json();

      if (response.rpta === "si") {
        toast.success(response.mensaje);
        obtenerUsuarios();
      } else {
        toast.error(response.mensaje);
      }
    } catch (error) {
      toast.error('Ocurrió un error al cambiar el estado del usuario');
      console.error(error);
    } finally {
      setModalConfirmacion(false);
      setUsuarioSeleccionado(null);
    }
  }

  return (
    <>
      <div className="w-full h-screen flex flex-col p-6 gap-6">
        <div className="flex items-center gap-5 lg:hidden">
          <div
            className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-gray-300 active:bg-gray-300 transition-colors mr-4"
            onClick={abrirMenu}
          >
            <IoMenu className="text-2xl" />
          </div>

          <h1 className="text-lg font-bold">
            Usuarios
          </h1>
        </div>

        <article className="flex-1 bg-white shadow-lg rounded-lg p-6 flex flex-col overflow-hidden">
          {/* 🔹 Título y buscador */}
          <nav className="w-full flex flex-row items-center justify-between mb-4 gap-6">
            <div className="flex items-center flex-1">
              <h1 className="hidden lg:inline text-[calc(0.7rem+0.7vw)] font-bold w-[30%] mr-5">
                Usuarios
              </h1>

              {/* 🔍 Buscador con ícono */}
              <div className="relative flex-1">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, cédula, correo, teléfono o estado..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="border-1 border-gray-400 rounded-md p-2 pl-9 w-full text-[0.9rem] focus:outline-none focus:ring-1 focus:border-[#193CB8]"
                />
              </div>
            </div>

            {/* Botón Agregar */}
            <button
              className="h-full px-4 text-[calc(0.4rem+0.4vw)] bg-transparent border text-blue-800 border-blue-800 hover:text-white rounded-lg hover:bg-blue-800 hover:scale-[1.05] transition-all duration-300 cursor-pointer flex items-center justify-center"
              onClick={() => estadoPagina("DetalleUsuarios")}
            >
              <span className="hidden lg:inline font-semibold">Agregar Usuario</span>

              <FaPlus className="lg:hidden text-lg font-extralight" />
            </button>
          </nav>

          {/* 🧾 Tabla de usuarios para escritorio*/}
          <div className="hidden w-full lg:flex flex-col mb-4 overflow-hidden">
            {/* Encabezado */}
            <div className="w-full flex flex-row bg-[#ECEEF1] p-3 rounded-lg font-semibold text-gray-700">
              <span className="w-[10%] text-center">Estado</span>
              <span className="w-[30%]">Nombre</span>
              <span className="w-[30%]">Correo</span>
              <span className="w-[20%]">Teléfono</span>
              <span className="w-[10%] text-center">Acción</span>
            </div>

            {/* Filas */}
            <div className="w-full overflow-y-auto no-scrollbar">
              {usuariosFiltrados.length > 0 ? (
                usuariosFiltrados.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-row justify-between items-center bg-white border border-gray-200 rounded-lg shadow-sm mt-2 p-3 hover:bg-gray-50"
                  >
                    {/* Estado */}
                    <div className="w-[10%] flex justify-center relative group px-3">
                      <div
                        className="w-[12px] h-[12px] rounded-full cursor-pointer"
                        style={{ backgroundColor: item.colorEstado || "#FBBF24" }}
                      ></div>

                      <Tooltip color={item.colorEstado} text={item.estado} className='-top-8' />
                    </div>

                    {/* Nombre */}
                    <span className="w-[30%] text-gray-700 truncate pr-4" title={item.nombre}>{item.nombre}</span>

                    {/* Correo */}
                    <span className="w-[30%] text-gray-700 truncate pr-4" title={item.correo}>{item.correo}</span>

                    {/* Teléfono */}
                    <span className="w-[20%] text-gray-700">{item.telefono}</span>

                    {/* Acción */}
                    <div className="w-[10%] flex justify-center">
                      {item.idEstado == 2 ? (
                        <div
                          className="hover:bg-red-100 p-2 rounded-full cursor-pointer relative group flex justify-center"
                          onClick={() => abrirModalConfirmar(item)}
                        >
                          <FaTrash
                            className="text-red-500 text-xl"
                            title="Ver detalle"
                          />

                          <Tooltip color='#ef4444' text='Inactivar' />
                        </div>
                      ) : (
                        <div
                          className="hover:bg-green-100 p-2 rounded-full cursor-pointer relative group flex justify-center"
                          onClick={() => abrirModalConfirmar(item)}
                        >
                          <FaTrashRestore
                            className="text-green-500 text-xl"
                            title="Ver detalle"
                          />

                          <Tooltip color='#22c55e' text='Activar' />
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-4">
                  No se encontraron usuarios que coincidan con la búsqueda.
                </div>
              )}
            </div>
          </div>

          {/* 🧾 Tabla de usuarios para mobil*/}
          <div className="w-full h-full lg:hidden flex flex-col overflow-hidden gap-6 overflow-y-auto no-scrollbar">
            {usuariosFiltrados.length > 0 ? (
              usuariosFiltrados.map((item) => (
                <div key={item.id} className="rounded-lg shadow-lg p-4 flex flex-col gap-3 border border-slate-200">
                  {/* Estado */}
                  <div className="w-full flex items-center justify-between">
                    <div
                      className="w-[12px] h-[12px] rounded-full cursor-pointer"
                      style={{ backgroundColor: item.colorEstado || "#FBBF24" }}
                      title={item.estado} // tooltip
                    ></div>

                    {item.idEstado == 2 ? (
                      <div
                        className="hover:bg-red-100 p-2 rounded-full cursor-pointer"
                        onClick={() => abrirModalConfirmar(item)}
                      >
                        <FaTrash
                          className="text-red-500"
                          title="Inactivar"
                        />
                      </div>
                    ) : (
                      <div
                        className="hover:bg-green-100 p-2 rounded-full cursor-pointer"
                        onClick={() => abrirModalConfirmar(item)}
                      >
                        <FaTrashRestore
                          className="text-green-500"
                          title="Restaurar"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col">
                    <span className="truncate font-semibold">{item.nombre}</span>
                    <span className="truncate text-slate-400">{item.correo}</span>
                    <span className="truncate text-slate-400">{item.telefono}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-4">
                No se encontraron usuarios que coincidan con la búsqueda.
              </div>
            )}
          </div>
        </article>
      </div>

      {/* 🔹 Modal de confirmación de cambio de estado */}
      <ModalConfirmacion
        title='Cambiar estado'
        isOpen={modalConfirmacion}
        setIsOpen={setModalConfirmacion}
        accion={cambiarEstadoUsuario}
      >
        <span className="text-center text-xl">
          ¿Esta seguro que desea {usuarioSeleccionado?.idEstado == 2 ? 'suspender' : 'restaurar'} de este usuario?
        </span>
        <div className="mt-3 text-lg text-center font-bold flex flex-col">
          <span>{usuarioSeleccionado?.nombre}</span>
          <span>{usuarioSeleccionado?.correo}</span>
        </div>
      </ModalConfirmacion>
    </>
  );
};
