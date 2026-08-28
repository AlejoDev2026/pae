import { forwardRef } from "react";
import { IoMdClose } from "react-icons/io";

export const ModalFormulario = forwardRef(({
  isOpen,
  setIsOpen,
  title,
  accion,
  children,
}, ref) => {
  return (
    <>
      {isOpen && (
        <main className="absolute z-200 bg-black/50 h-screen w-screen top-0 left-0 grid place-content-center">
          <form
            ref={ref}
            onSubmit={accion}
            className="bg-white rounded-lg p-6 flex flex-col gap-4"
          >
            <header className="text-xl text-blue-800 font-bold flex items-center justify-between">
              {title}

              <div
                className="p-2 hover:bg-slate-300 text-slate-700 rounded-full cursor-pointer"
                onClick={() => setIsOpen(false)}
              >
                <IoMdClose />
              </div>
            </header>

            <div className="flex flex-col gap-2 border-b border-t border-slate-200 py-4">
              {children}
            </div>

            <footer className="flex gap-6">
              <button
                type="button"
                className="flex-1 bg-gray-300 rounded-lg p-2 px-4 cursor-pointer hover:bg-gray-400 transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Cancelar
              </button>

              <button
                className="flex-1 bg-green-600 text-white rounded-lg p-2 px-4 cursor-pointer hover:bg-green-700 transition-colors"
              >
                Confirmar
              </button>
            </footer>
          </form>
        </main>
      )}
    </>
  )
})
