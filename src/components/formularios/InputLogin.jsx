import { forwardRef, useState } from "react";
import { FaEye } from "react-icons/fa";
import { useValidateInput } from "./hooks/useValidateInput";

export const InputLogin = forwardRef(({
  name,
  label,
  type = "text",
  className = "",
  seePassword,
  noPassLength,
  required,
  confirmPass,
  ...props
}, ref) => {
  // Maneja el cambio de visibilidad de la contraseña
  const [showPassword, setShowPassword] = useState(false);

  const handleMouseDown = () => {
    if (!seePassword) return;
    setShowPassword(true);
  };

  const handleMouseUp = () => {
    if (!seePassword) return;
    setShowPassword(false);
  };

  // Valida si hay errores en el input y los muestra en pantalla
  const { error, validate } = useValidateInput({ required, confirmPass, noPassLength });

  return (
    <div className="flex flex-col 2xl:gap-2">
      {label && (
        <label htmlFor={name} className="font-bold text-blue-800 text-sm 2xl:text-base">
          {label}
        </label>
      )}

      <div className="w-full relative">
        <input
          id={name}
          name={name}
          type={showPassword && seePassword ? "text" : type}
          ref={ref}
          onBlur={validate}
          {...props}
          className={`${className} py-2 px-3 w-full bg-slate-100 rounded-lg text-xs 2xl:text-base focus:outline-blue-200`}
        />

        {seePassword && (
          <div
            className="absolute right-[16px] top-0 2xl:top-[4px] text-xl text-blue-600 hover:bg-blue-200 cursor-pointer p-2 rounded-full transition-colors select-none"
            onPointerDown={handleMouseDown}
            onPointerUp={handleMouseUp}
            onPointerLeave={handleMouseUp}
          >
            <FaEye />
          </div>
        )}
      </div>

      <span data-error={error ? "true" : "false"} className="text-red-500 h-6 text-sm 2xl:text-base">
        {error ? error : "\u00A0"}
      </span>
    </div>
  );
});
