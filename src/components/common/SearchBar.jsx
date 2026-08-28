import { FaSearch } from "react-icons/fa";

export const SearchBar = ({
  className = '',
  containerClassName = '',
  ...props
}) => {
  return (
    <div
      className={`border border-slate-300 rounded-lg flex-1 flex items-center pl-2 ${containerClassName}`}
    >
      <FaSearch className="text-slate-500" />

      <input
        type="text"
        className={`p-2 px-4 flex-1 focus:outline-none text-sm placeholder:truncate ${className}`}
        {...props}
      />
    </div>
  )
}
