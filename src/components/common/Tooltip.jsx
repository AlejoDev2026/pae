// ⚠️ IMPORTANTE: Añadir "relative group flex justify-center" a los estilos del componente padre para el opotimo funcionamiento del tooltip
export const Tooltip = ({
  color,
  text,
  className
}) => {
  return (
    <div className={`absolute bottom-full mb-2 flex flex-col items-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-[9999] -top-6 ${className}`}>
      <span
        className="px-2 py-1 text-xs font-semibold bg-white rounded-md whitespace-nowrap border"
        style={{
          borderColor: color || "#2563eb",
        }}
      >
        {text}
      </span>
      <div
        className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent"
        style={{
          borderTopColor: color || "#2563eb",
        }}
      ></div>
    </div>
  )
}
