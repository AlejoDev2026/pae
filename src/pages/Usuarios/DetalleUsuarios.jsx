import { useState, useEffect, useRef } from "react";
import { Input } from "../../components/formularios/Input";
import { Select } from "../../components/formularios/Select";
import { toast } from "react-toastify";
import bcrypt from "bcryptjs";

import { FaIdCard, FaUserAlt, FaMobileAlt, FaEnvelope } from "react-icons/fa";
import { API_BASE } from "../../constants";

export const DetalleUsuarios = ({ navegar }) => {
  const [roles, setRoles] = useState([]);

  const formRef = useRef(null);
  const inputsRef = useRef([]);
  const estadoPagina = (pagina) => navegar(pagina);
  // Registrar el usuario en la base de datos
  const guardarDatos = async (e) => {
    e.preventDefault();

    try {
      // Forzar blur en todos los inputs para activar validación
      inputsRef.current.forEach((input) => {
        input.blur();
        input.dispatchEvent(new Event("focusout", { bubbles: true }));
      });

      // Esperar un pequeño delay para que los errores se pinten en DOM
      await new Promise((res) => setTimeout(res, 50));

      // Si hay errores en algún input del formulario cancela la función
      const errores = formRef.current.querySelectorAll('[data-error="true"]');

      if (errores.length > 0) {
        return;
      }

      // Url de la API
      let url = `${API_BASE}usuarios/detalleUsuarios.php?case=2`;

      const formData = new FormData(formRef.current);

      // Establece y encripta la contraseña
      const encryptedPassword = await bcrypt.hash(
        formData.get("contrasena").trim(),
        10
      );

      formData.append("pass", encryptedPassword);

      // Realiza la petición al backend para registrar el usuario
      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      console.log('data', data);
      if (data.rpta === "si") {
        toast.success("Se registro el usuario correctamente");
        estadoPagina("Usuarios")
      } else if (data.rpta === "existe") {
        toast.error(data.mensaje);
      } else {
        toast.error("No se pudo registrar el usuario");
      }
    } catch (error) {
      console.error("Error en getRoles:", error);
      setRoles([]);
    }
  };

  // Realiza una petición para obtener los roles registrados en la base de datos
  const getRoles = async () => {
    try {
      const url = `${API_BASE}usuarios/detalleUsuarios.php?case=1`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.rpta === "si") {
        setRoles(data.data || []);
      } else {
        setRoles([]);
      }
    } catch (error) {
      console.error("Error en getRoles:", error);
      setRoles([]);
    }
  };

  useEffect(() => {
    getRoles();
  }, []);

  return (
    <>
      <div className="w-full overflow-hidden flex justify-center items-center">
        <form
          ref={formRef}
          onSubmit={guardarDatos}
          className="w-[30%] lg:w-[60%] bg-white shadow-lg rounded-lg p-6 flex flex-col"
        >
          {/* 🔹 Título */}
          <div className="w-full flex items-center justify-center mb-6">
            <h1 className="text-[calc(0.7rem+0.7vw)] font-bold text-gray-700">
              Nuevo Usuario
            </h1>
          </div>

          {/* 🧾 Campos */}
          <div className="flex flex-col items-center">
            {/* Nombre Completo */}
            <Input
              icono={FaUserAlt}
              placeholder="Nombre completo"
              name="nombre"
              // Incluye el input en el array de referencias para realizar la validación al enviar el formulario
              ref={(el) => {
                if (el && !inputsRef.current.includes(el)) {
                  inputsRef.current.push(el);
                }
              }}
              required
              containerClassName="w-[70%] mt-3"
            />

            {/* Número de telefono */}
            <Input
              icono={FaMobileAlt}
              placeholder="Número telefónico"
              name="telefono"
              type="tel"
              // Incluye el input en el array de referencias para realizar la validación al enviar el formulario
              ref={(el) => {
                if (el && !inputsRef.current.includes(el)) {
                  inputsRef.current.push(el);
                }
              }}
              required
              containerClassName="w-[70%] mt-3"
            />

            {/* Correo */}
            <Input
              icono={FaEnvelope}
              placeholder="Correo electrónico"
              name="correo"
              type="email"
              // Incluye el input en el array de referencias para realizar la validación al enviar el formulario
              ref={(el) => {
                if (el && !inputsRef.current.includes(el)) {
                  inputsRef.current.push(el);
                }
              }}
              required
              containerClassName="w-[70%] mt-3"
            />

            {/* Contraseña */}
            <Input
              icono={FaIdCard}
              placeholder="Contraseña"
              name="contrasena"
              type="password"
              // Incluye el input en el array de referencias para realizar la validación al enviar el formulario
              ref={(el) => {
                if (el && !inputsRef.current.includes(el)) {
                  inputsRef.current.push(el);
                }
              }}
              required
              containerClassName="w-[70%] mt-3"
            />

            <Select
              icono={FaUserAlt}
              opciones={roles}
              name="rol"
              title="Seleccione un rol"
              // Incluye el input en el array de referencias para realizar la validación al enviar el formulario
              ref={(el) => {
                if (el && !inputsRef.current.includes(el)) {
                  inputsRef.current.push(el);
                }
              }}
              required
              containerClassName="w-[70%] mt-3"
            />

            {/* Botón Agregar */}
            <button className="w-[70%] h-[40px] m-5 text-[calc(0.4rem+0.4vw)] bg-transparent border-2 border-[#193CB8] hover:text-white text-black rounded-[5px] hover:bg-[#193CB8] hover:scale-[1.05] transition-all duration-300 cursor-pointer">
              Agregar Usuario
            </button>
          </div>
        </form>
      </div>
    </>
  );
};
