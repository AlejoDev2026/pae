import { forwardRef } from "react";
import { useValidateInput } from "./hooks/useValidateInput";
import { FaCaretDown } from "react-icons/fa";

export const Select = forwardRef(({
  icono: Icono,
  name,
  label,
  title = "Seleccione una opción",
  className = "",
  containerClassName,
  required,
  opciones,
  ...props
}, ref) => {
  // Valida si hay errores en el input y los muestra en pantalla
  const { error, validate } = useValidateInput({ required });

  return (
    <div className={`${containerClassName}`}>
      <div className="relative">
        {label && (
          <label htmlFor={name} className="font-bold text-blue-800">
            {label}
          </label>
        )}

        {Icono && (
          <Icono
            className={`
              absolute left-3 -translate-y-1/2 text-gray-500
              ${label ? 'bottom-1' : 'top-1/2'}
            `}
          />
        )}

        <select
          id={name}
          name={name}
          ref={ref}
          onChange={validate}
          onBlur={validate}
          defaultValue=""
          {...props}
          className={`
              ${className} appearance-none border border-gray-400 rounded-md p-2 w-full text-[0.9rem] focus:outline-none focus:ring-1 focus:ring-[#193CB8] truncate placeholder-ellipsis pr-9
              ${Icono ? "pl-10" : ""}
            `}
        >
          <option value="" disabled>
            {title}
          </option>
          {opciones.length > 0 ? (
            opciones.map((opcion) => (
              <option key={opcion.id} value={opcion.id}>
                {opcion.parametro}
              </option>
            ))
          ) : (
            <option disabled>No se encontraron opciones</option>
          )}
        </select>

        <span
          className={`
            pointer-events-none absolute right-3 -translate-y-1/2
            ${label ? 'bottom-1' : 'top-1/2'}
          `}
        >
          <FaCaretDown />
        </span>
      </div>

      <span
        data-error={error ? "true" : "false"}
        className="text-red-500 text-sm h-6 pl-2"
      >
        {error ? error : "\u00A0"}
      </span>
    </div>
  );
});
