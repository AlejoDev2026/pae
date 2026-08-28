export const SidebarMenuItem = ({
  icono,
  label,
  activo,
  ...props
}) => {
  return (
    <li
      className={`
        flex items-center gap-3 p-2 rounded-lg group cursor-pointer transition-colors
        ${activo ? 'bg-white shadow-lg' : 'hover:bg-white'}
      `}
      {...props}
    >
      <div
        className={`
          rounded-lg w-6 h-6 p-4 grid place-content-center transition-colors
          ${activo ? 'text-white bg-blue-900' : 'text-blue-900 bg-white group-hover:text-white group-hover:bg-blue-900'}
        `}
      >
        {icono}
      </div>
      <span className="font-semibold truncate">{label}</span>
    </li>
  );
};
