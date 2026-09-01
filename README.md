# PsicoGestión

## Descripción del proyecto

**PsicoGestión** es un sistema web desarrollado para apoyar la gestión administrativa de citas de seguimiento de la Clínica de Asuntos Generales de la Facultad de Psicología de la Universidad Autónoma de Yucatán (UADY). El proyecto tiene como objetivo facilitar la administración de citas, pacientes previamente registrados, terapeutas, salas y disponibilidad de recursos, reduciendo problemas como duplicidad de citas, conflictos de horarios y errores en la asignación de recursos.

El Producto Mínimo Viable (MVP) contempla principalmente las siguientes funcionalidades:

* Gestión de citas de seguimiento.
* Administración de pacientes previamente registrados.
* Administración de terapeutas.
* Administración de salas.
* Control de disponibilidad de terapeutas y salas.
* Validación de horarios y prevención de conflictos.
* Autenticación de usuarios.
* Visualización de agenda.

El desarrollo del proyecto se realiza mediante un modelo **incremental e iterativo**, permitiendo desarrollar, validar e integrar progresivamente las diferentes funcionalidades del sistema.

---

# Gestión de Configuración con GitHub

## 1. Objetivo

GitHub será utilizado como herramienta principal para la **gestión de configuración del código fuente del proyecto PsicoGestión**.

Su utilización permitirá:

* Controlar las versiones del código fuente.
* Administrar las ramas de desarrollo.
* Registrar los cambios realizados.
* Facilitar la revisión del código.
* Mantener trazabilidad de los cambios.
* Integrar los módulos desarrollados.
* Mantener una versión estable y aprobada del sistema.

De acuerdo con el Plan de Aseguramiento de la Calidad del Software (SQAP), GitHub será utilizado específicamente para el control de versiones, administración de ramas, revisión de cambios e integración del código fuente.

---

# 2. Estructura del repositorio

El repositorio oficial deberá contener únicamente los recursos necesarios para el desarrollo del sistema, incluyendo:

```text
psicogestion/                          Raz del repositorio 

├── frontend/                         Interfaz de usuario (secretaria) 

│   ├── src/ 

│   │   ├── components/              Componentes reutilizables de la UI 

│   │   ├── pages/                   Vistas principales (agenda, pacientes) 

│   │   └── assets/                  Recursos estéticos (imgenes, conos) 

│   └── public/ 

├── backend/                          Lógica del servidor 

│   ├── src/ 

│   │   ├── controllers/             Controladores de cada mdulo 

│   │   ├── models/                  Modelos de datos 

│   │   ├── routes/                  Definición de rutas de la API 

│   │   └── services/                Lógica de negocio y concurrencia 

│   └── config/                      Configuración del servidor 

├── database/                         Scripts y migraciones de BD 

│   ├── migrations/                  Archivos de migración versionados 

│   │   └── PG-BD-v1.0.0.sql 

│   └── seeds/                       Datos de prueba (semilla) 

├── docs/                             Documentación oficial del proyecto 

│   ├── ERS/                         Especificación de Requerimientos 

│   ├── charter/                     Project Charter 

│   ├── ACS/                         Plan de Administración de la Configuracin 

│   ├── manuales/                    Manuales de usuario 

│   └── pruebas/                     Planes y casos de prueba 

├── .env.example                      Plantilla de variables de entorno 

├── .gitignore                        Archivos excluidos del control de versiones 

└── README.md                         Descripción general y gua de inicio 
```

La estructura podrá modificarse de acuerdo con las tecnologías utilizadas durante la implementación.

Los archivos de dependencias deberán mantenerse dentro del repositorio mediante el archivo correspondiente a la tecnología utilizada, por ejemplo `package.json`, `requirements.txt` u otro equivalente.

---

# 3. Ramas del repositorio

La rama principal del proyecto será:

```text
main
```

La rama `main` deberá contener únicamente versiones **revisadas, integradas y aprobadas** del sistema. Ningún desarrollador deberá realizar cambios directamente sobre esta rama.

## 3.1 Ramas de funcionalidades

Cada funcionalidad o módulo deberá desarrollarse utilizando una rama independiente.

La nomenclatura será:

```text
feature/nombre-funcionalidad
```

Ejemplos:

```text
feature/gestion-citas
feature/disponibilidad-salas
feature/gestion-terapeutas
feature/gestion-pacientes
feature/autenticacion
```

## 3.2 Ramas de corrección

Cuando se requiera corregir un defecto o problema detectado:

```text
fix/nombre-correccion
```

Ejemplos:

```text
fix/validacion-horarios
fix/error-login
fix/conflicto-citas
```

Esta nomenclatura permite identificar rápidamente el propósito de cada rama.

---

# 4. Flujo de trabajo

El flujo general de desarrollo será:

```text
main
  │
  ├── feature/gestion-citas
  │
  ├── feature/disponibilidad-salas
  │
  ├── feature/gestion-terapeutas
  │
  └── fix/validacion-horarios
          │
          ▼
      Pull Request
          │
          ▼
    Revisión técnica
          │
          ▼
     Aprobación
          │
          ▼
      Integración
          │
          ▼
         main
```

El flujo deberá seguir los siguientes pasos:

1. Actualizar la copia local del repositorio.
2. Crear una rama para la funcionalidad o corrección.
3. Realizar los cambios correspondientes.
4. Realizar pruebas y verificaciones locales.
5. Registrar los cambios mediante un commit.
6. Subir la rama al repositorio remoto.
7. Crear un **Pull Request**.
8. Solicitar la revisión correspondiente.
9. Corregir las observaciones, si existen.
10. Integrar la rama únicamente después de su aprobación.

Este procedimiento se basa en la disposición del SQAP de utilizar ramas específicas de trabajo y realizar la integración mediante una solicitud de revisión antes de modificar `main`.

---

# 5. Clonar el repositorio

La primera vez que un integrante trabaje con el proyecto deberá clonar el repositorio.

```bash
git clone URL_DEL_REPOSITORIO
```

Posteriormente deberá entrar al directorio:

```bash
cd PsicoGestion
```

Verificar el estado del repositorio:

```bash
git status
```

El proyecto deberá poder ejecutarse localmente antes de comenzar con la implementación de nuevas funcionalidades.

---

# 6. Actualizar el repositorio antes de trabajar

Antes de comenzar cualquier tarea, se deberá verificar que la copia local esté actualizada.

Primero:

```bash
git checkout main
```

Después:

```bash
git pull origin main
```

Esto permitirá trabajar utilizando la versión más reciente de la rama principal.

---

# 7. Crear una rama de trabajo

A partir de la versión actualizada de `main`, crear una rama para la funcionalidad correspondiente.

Ejemplo:

```bash
git checkout -b feature/gestion-citas
```

También puede utilizarse:

```bash
git switch -c feature/gestion-citas
```

A partir de este momento, los cambios correspondientes a esa funcionalidad deberán realizarse únicamente dentro de dicha rama.

---

# 8. Realizar cambios y verificar el código

Durante el desarrollo, cada integrante deberá trabajar únicamente en los módulos que le hayan sido asignados formalmente.

Antes de comenzar la implementación deberá revisar el diseño correspondiente, incluyendo entidades, atributos, operaciones, reglas de negocio, validaciones y dependencias.

Al terminar una modificación, verificar los archivos modificados:

```bash
git status
```

Para revisar exactamente qué cambios se realizaron:

```bash
git diff
```

Antes de solicitar la integración deberán realizarse las verificaciones técnicas y pruebas locales correspondientes.

---

# 9. Registrar cambios mediante commits

Los cambios deberán registrarse mediante commits con mensajes claros y descriptivos.

Ejemplo:

```bash
git add .
```

```bash
git commit -m "feat: agregar gestion de citas"
```

Otros ejemplos:

```bash
git commit -m "feat: agregar validacion de disponibilidad de sala"
```

```bash
git commit -m "fix: corregir conflicto de horarios"
```

```bash
git commit -m "docs: actualizar instrucciones de instalacion"
```

```bash
git commit -m "test: agregar pruebas para gestion de citas"
```

El mensaje del commit deberá permitir identificar fácilmente qué modificación se realizó. El SQAP establece que cada confirmación de cambios debe incluir un mensaje claro sobre la modificación realizada.

---

# 10. Subir los cambios a GitHub

Después de realizar y verificar los cambios:

```bash
git push origin nombre-de-la-rama
```

Ejemplo:

```bash
git push origin feature/gestion-citas
```

La primera vez que se suba una rama puede utilizarse:

```bash
git push -u origin feature/gestion-citas
```

---

# 11. Pull Request

Una vez terminada la funcionalidad, se deberá crear un **Pull Request (PR)** desde la rama de trabajo hacia `main`.

Ejemplo:

```text
feature/gestion-citas
        ↓
      Pull Request
        ↓
       main
```

El Pull Request deberá incluir:

* Nombre de la funcionalidad desarrollada.
* Descripción de los cambios.
* Módulos modificados.
* Pruebas realizadas.
* Evidencia de funcionamiento cuando sea necesario.
* Observaciones o consideraciones técnicas.
* Relación con el requerimiento o tarea correspondiente.

## Ejemplo de descripción

```text
## Descripción
Se implementó el módulo de gestión de citas de seguimiento.

## Cambios realizados
- Creación de formulario para registrar citas.
- Validación de paciente.
- Validación de terapeuta.
- Validación de disponibilidad de sala.
- Validación de fecha y hora.
- Prevención de conflictos de horario.

## Pruebas realizadas
- Registro de cita válida.
- Registro con terapeuta no disponible.
- Registro con sala ocupada.
- Registro con horario conflictivo.

## Estado
Listo para revisión.
```

---

# 12. Revisión del Pull Request

El Pull Request deberá ser revisado antes de integrarse a `main`.

La revisión deberá comprobar, como mínimo:

* Cumplimiento de los criterios de codificación.
* Correspondencia con el diseño aprobado.
* Correcta integración con otros módulos.
* Ausencia de errores evidentes.
* Estructura clara y mantenible.
* Funcionamiento de las validaciones correspondientes.

El SQAP establece que el código debe revisarse antes de su integración y que las observaciones encontradas deberán corregirse antes de incorporar el módulo al sistema.

---

# 13. Integración a main

Una vez aprobado el Pull Request:

1. Se deberán resolver todas las observaciones pendientes.
2. El responsable de revisión aprobará el Pull Request.
3. Se realizará la integración de la rama.
4. Se verificará que el sistema continúe funcionando correctamente.
5. `main` deberá quedar en un estado estable y aprobado.

**No se permite realizar `push` directamente sobre `main`.**

La integración deberá realizarse después de la revisión correspondiente, manteniendo `main` como la versión estable del proyecto.

---

# 14. Actualizar la rama después de una integración

Después de que una funcionalidad haya sido integrada a `main`, los desarrolladores deberán actualizar su repositorio local antes de comenzar una nueva tarea:

```bash
git checkout main
```

```bash
git pull origin main
```

Posteriormente deberán crear una nueva rama:

```bash
git checkout -b feature/nueva-funcionalidad
```

---

# 15. Corrección de errores

Cuando QA o el equipo de desarrollo detecte un defecto, se deberá crear una rama de corrección:

```bash
git checkout main
git pull origin main
git checkout -b fix/nombre-del-error
```

Ejemplo:

```bash
git checkout -b fix/conflicto-citas
```

Una vez corregido:

```bash
git add .
git commit -m "fix: corregir conflicto de citas"
git push origin fix/conflicto-citas
```

Posteriormente se deberá crear un Pull Request para revisar e integrar la corrección.

---

# 16. Reglas importantes

Todos los integrantes deberán cumplir las siguientes reglas:

### Regla 1 — No trabajar directamente en `main`

```text
NO:
main → modificaciones → push

SÍ:
main → nueva rama → cambios → Pull Request → revisión → main
```

### Regla 2 — Una tarea, una rama

Cada funcionalidad o corrección deberá contar con su propia rama.

### Regla 3 — Commits descriptivos

Los commits deberán explicar claramente el cambio realizado.

### Regla 4 — Revisar antes de integrar

Ningún cambio deberá incorporarse a `main` sin la revisión correspondiente.

### Regla 5 — Mantener actualizado el repositorio

Antes de iniciar una nueva tarea deberá obtenerse la última versión aprobada de `main`.

### Regla 6 — No subir información sensible

No deberán subirse al repositorio:

* Contraseñas.
* Tokens.
* Claves API.
* Credenciales de bases de datos.
* Archivos `.env`.
* Información personal o sensible.

Utilizar `.gitignore` para excluir este tipo de archivos.

### Regla 7 — Mantener trazabilidad

Los cambios deberán poder relacionarse con la funcionalidad, requerimiento, defecto o tarea que los originó.

---

# 17. Comandos principales

| Acción              | Comando                       |
| ------------------- | ----------------------------- |
| Clonar repositorio  | `git clone URL`               |
| Ver estado          | `git status`                  |
| Actualizar `main`   | `git pull origin main`        |
| Crear rama          | `git checkout -b nombre-rama` |
| Cambiar de rama     | `git checkout nombre-rama`    |
| Ver ramas           | `git branch`                  |
| Ver cambios         | `git diff`                    |
| Preparar cambios    | `git add .`                   |
| Crear commit        | `git commit -m "mensaje"`     |
| Subir rama          | `git push origin nombre-rama` |
| Descargar cambios   | `git pull`                    |
| Consultar historial | `git log --oneline`           |

---

# 18. Flujo resumido para cada desarrollador

El procedimiento habitual será:

```bash
# 1. Actualizar main
git checkout main
git pull origin main

# 2. Crear rama
git checkout -b feature/nueva-funcionalidad

# 3. Desarrollar
# Realizar cambios en el código

# 4. Verificar
git status
git diff

# 5. Registrar cambios
git add .
git commit -m "feat: descripcion del cambio"

# 6. Subir rama
git push -u origin feature/nueva-funcionalidad

# 7. Crear Pull Request en GitHub
# 8. Esperar revisión
# 9. Corregir observaciones, si existen
# 10. Integrar a main después de la aprobación
```

---

# 19. Responsabilidades en la gestión de configuración

### Administrador de la Configuración

* Controlar las versiones de documentos y código fuente.
* Administrar las líneas base del proyecto.
* Gestionar cambios sobre los productos de trabajo.
* Mantener actualizado el repositorio oficial.
* Verificar la trazabilidad de los elementos bajo control de configuración.

### Equipo de Desarrollo

* Trabajar sobre las ramas asignadas.
* Implementar las funcionalidades correspondientes.
* Realizar verificaciones técnicas.
* Corregir defectos.
* Crear commits descriptivos.
* Solicitar revisión mediante Pull Request.
* Participar en las pruebas de integración y regresión.

### Líder del Proyecto / Responsable de Revisión

* Revisar los cambios realizados.
* Verificar el cumplimiento de los criterios establecidos.
* Aprobar la integración de los módulos.
* Autorizar los cambios que serán incorporados a `main`.

---

# 20. Integración con el proceso de calidad

GitHub forma parte del proceso de aseguramiento de calidad del proyecto. Los módulos desarrollados deberán ser revisados, integrados y posteriormente entregados al área de pruebas.

Antes de una entrega para pruebas, el repositorio deberá contener el código integrado, las instrucciones necesarias para ejecutar el sistema, las dependencias, la configuración o scripts de base de datos cuando correspondan y una descripción de los módulos implementados.

Antes de iniciar pruebas, el equipo deberá verificar que el repositorio local se encuentre actualizado con la última versión aprobada.

---

## Flujo oficial de PsicoGestión

```text
REQUERIMIENTO
      │
      ▼
ASIGNACIÓN DE TAREA
      │
      ▼
Actualizar main
      │
      ▼
Crear rama feature/fix
      │
      ▼
DESARROLLO
      │
      ▼
Pruebas y verificación local
      │
      ▼
Commit
      │
      ▼
Push a GitHub
      │
      ▼
PULL REQUEST
      │
      ▼
REVISIÓN TÉCNICA
      │
      ├──── Correcciones ────┐
      │                      │
      └──── Aprobación ◄─────┘
                │
                ▼
        INTEGRACIÓN
                │
                ▼
              MAIN
                │
                ▼
       PRUEBAS DE INTEGRACIÓN
                │
                ▼
          PRUEBAS QA
                │
                ▼
        VERSIÓN APROBADA
```

Este flujo busca mantener `main` como una versión estable y controlada, mientras que el desarrollo de nuevas funcionalidades se realiza de manera aislada y posteriormente se integra mediante revisión.
