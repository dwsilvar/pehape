Feature: Verificar acceso a la página de Awesome Copilot en Edge

  @successful
  Scenario: Abrir Edge, navegar a la URL y validar texto en pantalla
    Given que la aplicación "Edge" está abierta
    When ingreso la URL "https://github.com/github/awesome-copilot" en la barra de direcciones
    And espero "1" segundos
    Then veo el texto "awesome-copilot" en pantalla
