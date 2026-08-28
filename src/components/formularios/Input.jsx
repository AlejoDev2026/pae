import { forwardRef } from "react";
import { useValidateInput } from "./hooks/useValidateInput";

export const Input = forwardRef(({
  icono: Icono,
  name,
  label,
  type = "text",
  className = "",
  containerClassName = "",
  required,
  ...props
}, ref) => {
  // Valida si hay errores en el input y los muestra en pantalla
  const { error, validate } = useValidateInput({ required });

  return (
    <div className={`${containerClassName}`}>
      <div className="relative">
        {label && <label htmlFor={name} className="font-bold text-blue-800">{label}</label>}

        {Icono && <Icono
          className={`
            absolute left-3 -translate-y-1/2 text-gray-500
            ${label ? 'bottom-1' : 'top-1/2'}
          `}
        />}

        <input
          id={name}
          name={name}
          type={type}
          onBlur={validate}
          onChange={validate}
          ref={ref}
          className={`
            ${className} border border-gray-400 rounded-md p-2 w-full text-[0.9rem] focus:outline-none focus:ring-1 focus:ring-[#193CB8]
            ${Icono ? "pl-10" : ""}
          `}
          {...props}
        />
      </div>

      <span data-error={error ? "true" : "false"} className="text-red-500 text-sm h-6 pl-2">
        {error}
      </span>

    </div>
  );
});
