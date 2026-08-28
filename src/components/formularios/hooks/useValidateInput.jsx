import { useState } from "react"

export const useValidateInput = ({
  required,
  confirmPass,
  noPassLength
}) => {
  const [error, setError] = useState('')

  const validate = (e) => {
    const valor = e.target.value.trim()
    const nombre = e.target.name.trim()
    const tipo = e.target.type.trim()

    const min = Number(e.target.min);
    const max = Number(e.target.max);
    const valorNumerico = Number(valor);

    const correoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const soloNumeros = /^[0-9]+$/

    // Requerido
    if (required && (!valor || valor == '')) {
      setError('Este campo es obligatorio')
      return
    }

    // Menor al minimo
    if (valor < e.target.min) {
      setError(`El valor no puede ser menor a ${e.target.min}`)
    }

    // name = documento y menor de 6 caracteres
    if (nombre === 'documento' && valor.length < 6) {
      setError("El número de documento debe tener al menos 6 dígitos");
      return;
    }

    // name = telefono y menor de 10 caracteres
    if (nombre === 'telefono' && valor.length < 10) {
      setError("El número de teléfono debe tener al menos 10 dígitos");
      return;
    }

    // name = correo y valida estructura del correo
    if (nombre === 'correo' && !correoValido.test(valor)) {
      setError("Ingresa un correo electrónico válido");
      return
    }

    // name = contrasena y su tamaño es menor a 8 caracteres
    if (nombre === 'contrasena' && !noPassLength && valor.length < 8) {
      setError("La contraseña no puede ser menor a 8 caracteres");
      return
    }

    // Confirmar que ambas contraseñas coincidan
    if (nombre === 'confirmarContrasena' && confirmPass && valor !== confirmPass) {
      setError("Las contraseñas no coinciden");
      return
    }

    if (!isNaN(min) && valorNumerico < min) {
      setError(`El valor no puede ser menor a ${min}`);
      return;
    }

    if (!isNaN(max) && max > 0 && valorNumerico > max) {
      setError(`El valor no puede ser mayor a ${max}`);
      return;
    }

    setError('')
  }

  return { error, validate }
}
