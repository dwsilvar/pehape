import React from 'react';

export const useExecutionOrder = () => {
  const [modules, setModules] = React.useState<any[]>([]);

  React.useEffect(() => {
    fetch('/api/execution-order')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Network response was not ok: ${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        let needsCorrection = false;
        // Verifica si el orden de los módulos es secuencial (1, 2, 3...)
        for (let i = 0; i < data.length; i++) {
          if (data[i].order !== i + 1) {
            needsCorrection = true;
            break;
          }
        }

        if (needsCorrection) {
          console.log("Orden de módulos inconsistente detectado. Corrigiendo y guardando...");
          // Si el orden es incorrecto, llama a la API para que lo corrija y guarde.
          fetch('/api/execution-order', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data), // Envía la data ordenada por el backend
          })
          .then(res => res.json())
          .then(correctedData => setModules(correctedData)); // Actualiza el estado con la data corregida
        } else {
          setModules(data); // Si el orden es correcto, simplemente actualiza el estado.
        }
      })
      .catch(console.error);
  }, []);

  const handleSave = React.useCallback(() => {
    fetch('/api/execution-order', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(modules),
    }).catch(console.error);
  }, [modules]);

  return { modules, setModules, handleSave };
};