import { useState, useEffect, useCallback } from 'react';
import { Module } from '../types'; // Importar el tipo Module

export const useExecutionOrder = () => {
  const [modules, setModules] = useState<Module[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Cargar la secuencia inicial al montar el componente
  useEffect(() => {
    const fetchInitialSequence = async () => {
      try {
        const response = await fetch('/api/execution-order');
        if (!response.ok) {
          throw new Error('Failed to fetch execution order');
        }
        const data = await response.json();
        setModules(data);
      } catch (error) {
        console.error("Error fetching initial execution order:", error);
      }
    };

    fetchInitialSequence();
  }, []);

  // Función para guardar la secuencia
  const handleSave = useCallback(async () => {
    setStatusMessage('Guardando orden de ejecución...');
    setIsLoading(true);
    try {
      const response = await fetch('/api/execution-order', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(modules),
      });
  
      if (!response.ok) {
        throw new Error('Failed to save execution order');
      }
  
      const updatedSequence = await response.json(); // <-- El paso clave
      setModules(updatedSequence); // <-- Actualizar el estado con la respuesta del servidor
      setStatusMessage('Orden guardada correctamente.');
    } catch (error) {
      console.error("Error saving execution order:", error);
      setStatusMessage('Error al guardar el orden.');
    } finally {
      setIsLoading(false);
      // Limpiar el mensaje después de unos segundos
      setTimeout(() => setStatusMessage(''), 3000);
    }
  }, [modules]); // Depende de 'modules' para enviar siempre el estado más reciente

  // 4. Exponer el nuevo estado
  return { modules, setModules, handleSave, statusMessage, isLoading };
};