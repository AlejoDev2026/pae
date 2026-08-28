import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import logo from "../../assets/logoPae.png";
import { InputLogin } from "../../components/formularios/InputLogin";
import { API_BASE } from "../../constants";

import { ToastContainer, toast } from "react-toastify";
import bcrypt from "bcryptjs";

export const Login = () => {
  // Hook de navegación para ir a la pagina principal
  const navigate = useNavigate();

  // Obtiene el codigo de referido de la url si existe
  const [searchParams] = useSearchParams();

  const referido = searchParams.get("refer") || null;

  // Estado para establecer que formulario se muestra
  const [formulario, setFormulario] = useState(referido != null ? "signUp" : "logIn");
  // Estado para comparar las contraseñas al registrarse
  const [confirmar, setConfirmar] = useState("");

  // Función para cambiar el formulario según lo que señale el usuario
  const cambiarForm = () => {
    setFormulario((prev) => {
      if (prev === "logIn") return "signUp";
      else return "logIn";
    });
  };

  // Referencias para el formulario de inicio de sesión y sus inputs
  const formLoginRef = useRef(null);
  const inputsLoginRef = useRef([]);

  // Referencias para el formulario de registro y sus inputs
  const formSIgnupRef = useRef(null);
  const inputsSignupRef = useRef([]);

  // Función para la autenticación de un usuario y permitirle iniciar sesión
  const autenticar = async (e) => {
    e.preventDefault();

    // try {
    // Forzar blur en todos los inputs para activar validación
    inputsLoginRef.current.forEach((input) => {
      input.blur();
      input.dispatchEvent(new Event("focusout", { bubbles: true }));
    });

    // Esperar un pequeño delay para que los errores se pinten en DOM
    await new Promise((res) => setTimeout(res, 50));

    // Si hay errores en algún input del formulario cancela la función
    const errores = formLoginRef.current.querySelectorAll('[data-error="true"]');

    if (errores.length > 0) {
      return;
    }

    const formData = new FormData(formLoginRef.current);

    let url = `${API_BASE}auth/autenticacion.php?case=1`;



    const res = await fetch(url, {
      method: "POST",
      body: formData,
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    });



    const response = await res.json();
    console.log(response);
    if (response.rpta === "si") {
      toast.success(response.mensaje);
      localStorage.setItem("st", response.token);
      localStorage.setItem("us", JSON.stringify(response.usuario));

      navigate("/main");
    } else {
      toast.error(response.mensaje);
    }
    // } catch (error) {
    //   console.error(error);
    //   toast.error("Ocurrió un error al intentar iniciar sesión");
    // }
  };

  // Función para registrar un nuevo cliente en la pagina
  const registrar = async (e) => {
    e.preventDefault();

    try {
      // Forzar blur en todos los inputs para activar validación
      inputsSignupRef.current.forEach((input) => {
        input.blur();
        input.dispatchEvent(new Event("focusout", { bubbles: true }));
      });

      // Esperar un pequeño delay para que los errores se pinten en DOM
      await new Promise((res) => setTimeout(res, 50));

      // Si hay errores en algún input del formulario cancela la función
      const errores = formSIgnupRef.current.querySelectorAll('[data-error="true"]');

      if (errores.length > 0) {
        return;
      }

      const formData = new FormData(formSIgnupRef.current);

      // Establece y encripta la contraseña
      const encryptedPassword = await bcrypt.hash(formData.get("contrasena").trim(), 10);

      formData.append("contrasena", encryptedPassword);
      referido && formData.append("referido", referido)

      let url = `${API_BASE}Clientes/clientes.php?case=3`;

      const res = await fetch(url, {
        method: "POST",
        body: formData,
      });
      const response = await res.json();

      if (response.rpta === "si") {
        toast.success(response.mensaje);
        setFormulario("logIn");
      } else {
        toast.error(response.mensaje);
      }
    } catch (error) {
      console.error(error);
      toast.error("Ocurrió un error al intentar registrar el usuario");
    }
  };

  // Limpia el localStorage cada que se recarga el componente
  useEffect(() => {
    console.log('aaaaaaaaaaacxzxczxczxca');
    localStorage.clear();
  }, []);

  return (
    <>
      <ToastContainer theme="dark" position="top-right" autoClose={5000} />

      <main className="login-background h-[100dvh] w-screen flex items-center md:justify-end overflow-hidden">
        <aside className="bg-white p-6 2xl:p-8 h-fit md:h-full w-full md:w-1/3 bg-red flex flex-col justify-center items-center gap-5 2xl:gap-10">
          <div className="flex px-6 pt-4 pb-6 items-center gap-3 text-2xl text-blue-800 border-b border-slate-300">
            <img src={logo} alt="Logo" className="w-45 select-none" />
          </div>

          {formulario === "logIn" && (
            <form
              ref={formLoginRef}
              onSubmit={autenticar}
              className="w-[75%] flex flex-col gap-1 2xl:gap-3"
            >
              <InputLogin
                type="email"
                name="correo"
                placeholder="Correo electronico"
                label="Correo electronico"
                required
                // Incluye el input en el array de referencias para realizar la validación al enviar el formulario
                ref={(el) => {
                  if (el && !inputsLoginRef.current.includes(el)) {
                    inputsLoginRef.current.push(el);
                  }
                }}
              />

              <InputLogin
                type="password"
                name="contrasena"
                placeholder="Contraseña"
                label="Contraseña"
                seePassword
                noPassLength
                required
                // Incluye el input en el array de referencias para realizar la validación al enviar el formulario
                ref={(el) => {
                  if (el && !inputsLoginRef.current.includes(el)) {
                    inputsLoginRef.current.push(el);
                  }
                }}
              />

              <div className="text-blue-600 hover:text-blue-800 transition-colors text-right">
                Restablecer contraseña
              </div>

              <div className="flex flex-col items-center gap-4">
                <button
                  type="submit"
                  className="w-full py-3 px-5 bg-blue-600 hover:bg-blue-800 cursor-pointer text-white text-sm md:text-base rounded-lg font-semibold mt-8 transition-colors"
                >
                  Iniciar sesión
                </button>

                <hr className="border border-slate-200 w-[80%]" />

                <button
                  type="button"
                  onClick={cambiarForm}
                  className="w-full py-3 px-5 text-blue-600 hover:text-white hover:bg-blue-600 cursor-pointer text-sm md:text-base rounded-lg font-semibold transition-colors"
                >
                  Registrarse
                </button>
              </div>
            </form>
          )}

          {formulario === "signUp" && (
            <form
              ref={formSIgnupRef}
              onSubmit={registrar}
              className="w-[75%] flex flex-col gap-1 2xl:gap-3"
            >
              <InputLogin
                type="text"
                name="nombre"
                placeholder="Nombre completo"
                label="Nombre Completo"
                required
                // Incluye el input en el array de referencias para realizar la validación al enviar el formulario
                ref={(el) => {
                  if (el && !inputsSignupRef.current.includes(el)) {
                    inputsSignupRef.current.push(el);
                  }
                }}
              />

              <InputLogin
                type="email"
                name="correo"
                placeholder="Correo electronico"
                label="Correo electronico"
                required
                // Incluye el input en el array de referencias para realizar la validación al enviar el formulario
                ref={(el) => {
                  if (el && !inputsSignupRef.current.includes(el)) {
                    inputsSignupRef.current.push(el);
                  }
                }}
              />

              <InputLogin
                type="number"
                name="telefono"
                placeholder="Número de telefono"
                label="Número de telefono"
                required
                // Incluye el input en el array de referencias para realizar la validación al enviar el formulario
                ref={(el) => {
                  if (el && !inputsSignupRef.current.includes(el)) {
                    inputsSignupRef.current.push(el);
                  }
                }}
              />

              <InputLogin
                type="password"
                name="contrasena"
                placeholder="Contraseña"
                label="Contraseña"
                seePassword
                required
                // Incluye el input en el array de referencias para realizar la validación al enviar el formulario
                ref={(el) => {
                  if (el && !inputsSignupRef.current.includes(el)) {
                    inputsSignupRef.current.push(el);
                  }
                }}
                onChange={(e) => setConfirmar(e.target.value)}
                autoComplete='new-password'
              />

              <InputLogin
                type="password"
                name="confirmarContrasena"
                placeholder="Confirmar contraseña"
                label="Confirmar contraseña"
                seePassword
                required
                // Incluye el input en el array de referencias para realizar la validación al enviar el formulario
                ref={(el) => {
                  if (el && !inputsSignupRef.current.includes(el)) {
                    inputsSignupRef.current.push(el);
                  }
                }}
                confirmPass={confirmar}
                autoComplete='new-password'
              />

              {!referido && (
                <InputLogin
                  type="text"
                  name="referido"
                  placeholder="Codigo de referido"
                  label="Codigo de referido"
                  // Incluye el input en el array de referencias para realizar la validación al enviar el formulario
                  ref={(el) => {
                    if (el && !inputsSignupRef.current.includes(el)) {
                      inputsSignupRef.current.push(el);
                    }
                  }}
                />
              )}

              <div className="flex flex-col items-center gap-4">
                <button
                  type="submit"
                  className="w-full py-3 px-5 bg-blue-600 hover:bg-blue-800 cursor-pointer text-white text-sm md:text-base rounded-lg font-semibold mt-4 2xl:mt-8 transition-colors"
                >
                  Registrarse
                </button>

                <hr className="border border-slate-200 w-[80%]" />

                <button
                  type="button"
                  onClick={cambiarForm}
                  className="w-full py-3 px-5 text-blue-600 hover:text-white hover:bg-blue-600 cursor-pointer text-sm md:text-base rounded-lg font-semibold transition-colors"
                >
                  Iniciar sesión
                </button>
              </div>
            </form>
          )}
        </aside>
      </main>
    </>
  );
};
