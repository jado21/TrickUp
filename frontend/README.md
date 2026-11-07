# TriKUp — frontend

React + TypeScript + Vite. Onboarding, panel RPG, preferencias, creación de cursos, mapa y primera misión jugable con datos locales. No necesita claves, servidor API ni base de datos.

Desde `frontend/`:

```powershell
npm.cmd install
npm.cmd run dev
```

Abre http://localhost:3000. Verificaciones: `npm.cmd run build`, `npm.cmd run lint`, `npm.cmd test`.

## Navegación

- `#/`: bienvenida.
- `#/onboarding`: las ocho preguntas existentes.
- `#/profile`: resumen del perfil.
- `#/dashboard`: menú principal, progreso, cursos, rachas, logros e historial.
- `#/settings`: perfil y preferencias editables.
- `#/courses`: selector de cursos, protegido por la validación del perfil local.
- `#/courses/map`: mapa de Programación I del curso seleccionado, con el mismo requisito de perfil.
- `#/courses/map/poo`: primer subnivel jugable; requiere perfil y Programación I seleccionado.

El botón **ENTRAR A MI AVENTURA** abre ahora `#/dashboard`. El flujo es onboarding → panel → cursos → mapa → juegos → resultados → panel. Se conservan también el resumen del perfil y la vuelta directa al mapa. Todas las rutas del estudiante reutilizan StudentProfile y su guarda de perfil; no hay autenticación ficticia ni un segundo sistema de cuentas.

## Personalización

El motor de reglas deriva la experiencia de las ocho preguntas existentes: identidad, carrera/ciclo, objetivo, motivación, ayuda ante dificultades, modalidades, disponibilidad y tono. Se conserva Amigable por compatibilidad y se añade Disciplinado junto a Competitivo, Humorístico y Tranquilo. Son preferencias editables, sin etiquetas psicológicas ni supuestos estilos rígidos.

`#/settings` permite cambiar esos datos, destacar una o dos modalidades, añadir interés en construcción de código, elegir el ambiente visual (automático, tranquilo, competitivo, enfocado o aventura) y activar/desactivar el recordatorio interno diario. El interés en código prioriza ORDER_SEQUENCE; las otras preferencias ordenan recomendaciones y destacan juegos, sin bloquear ninguna modalidad ni alterar el orden pedagógico obligatorio de la primera misión. MULTIPLE_CHOICE y FILL_BLANK aparecen como próximas modalidades, no como juegos ya implementados.

Los temporizadores siguen desactivados inicialmente; el modo competitivo destaca el reto opcional. El perfil tranquilo reduce animaciones; enfocado reduce decoración; competitivo destaca resultados. Siempre prevalece el movimiento reducido del dispositivo. La preferencia de ayuda guiada hace visibles sus controles. Tras dos errores se ofrece teoría, una pista conceptual gratuita y un refuerzo con el diagrama Gato/Lucho; en lluvia se desactiva el temporizador opcional para reducir presión. No se modifica el contenido ni se penaliza esta ayuda automática. Los aciertos sin errores reciben reconocimiento y una invitación opcional a practicar.

## Rachas, logros y avisos

Una actividad válida es un minijuego completado. Un juego terminado cuenta para el día aunque el subnivel todavía no haya acreditado XP. Las prácticas terminadas son actividad de aprendizaje; un avance de desarrollo del mapa, una visita o la teoría no lo son. Los días activos se derivan del registro persistente de actividades, normalizados con `Intl` en **America/Lima**. Varias actividades el mismo día cuentan una sola vez. Se mantiene la racha de ayer durante hoy y se interrumpe al pasar un día completo sin actividad. La interfaz recalcula al volver a la pestaña y tras medianoche sin generar actividad automática.

Las seis insignias cubren primera misión, primer subnivel, primera semana evaluada, rachas de tres y siete días y diez actividades. Cada condición y fecha se registra una sola vez. No conceden XP adicional. La insignia de primera semana requiere cuatro nodos evaluados: avanzar nodos con el control demo no la obtiene; quedará pendiente hasta que los siguientes subniveles tengan actividades evaluables.

La campana del encabezado ofrece avisos de actividad completada, desbloqueo, racha, recompensa, repaso, recordatorio y regreso. Los IDs de eventos evitan duplicados por recarga. Los textos se adaptan al tono actual sin recrear el evento y las marcas de lectura persisten. Como máximo hay un recordatorio por día y solo si no se completó una actividad ese día. Son avisos internos; no se envían al teléfono, escritorio o cuando la web está cerrada.

## Panel y estadísticas

El panel muestra únicamente cursos guardados. Continuar aventura y las tarjetas de curso abren el nodo pendiente del mapa y lo enfocan; no vuelven siempre al primer nodo. Los cursos sin mapa muestran su contenido disponible sin inventar un recorrido. Se registra la fecha real de acceso.

La **única fuente del saldo de XP y del desbloqueo sigue siendo el progreso del mapa**. El panel suma esas recompensas; no suma los puntos de prácticas ni el XP inicial del perfil. El nivel es `1 + floor(XP / 100)`, con 100 XP por nivel. Las actividades guardan resultados y observaciones, no otro saldo: su XP acreditada se proyecta desde el identificador de la ejecución que recibió la recompensa del mapa. Las prácticas conservan puntos educativos y reciben cero XP adicional.

La precisión es `aciertos / intentos` de minijuegos completados, incluidas prácticas. El historial muestra curso, semana/subnivel, juego, resultado, puntos de la actividad, XP acreditada y fecha. Las recomendaciones de temas exigen al menos tres intentos observados por tema; describen esos resultados, no capacidades generales. Sin datos se muestra el estado inicial y no se inventa un porcentaje. No se muestra tiempo estudiado porque no se registra de manera fiable; los minutos del perfil son un objetivo elegido, no tiempo medido.

Las sesiones nuevas tienen ID de ejecución y fechas de finalización por juego. Los registros antiguos se reconstruyen sin inventar fecha: aparecen como **Fecha no registrada**, pueden aportar resultados conocidos, pero no añaden actividad a la racha de hoy. Los avances de desarrollo se señalan en el recorrido y se excluyen de las estadísticas de subniveles evaluados, rachas y logros de aprendizaje.

## Creación de cursos

El guía académico SVG original muestra diálogos locales con typewriter saltable y movimiento reducido. Las tres tarjetas permiten subir PDF, cargar imágenes PNG/JPEG o explorar el catálogo. Máximo: 5 MiB por archivo. Las imágenes tienen vista previa y pueden reemplazarse o eliminarse.

La carrera y el ciclo se recuperan del perfil. Los filtros son editables y la búsqueda ignora mayúsculas y tildes. El catálogo incluye doce ejemplos de Sistemas, Administración, Contabilidad y Psicología. Programación I corresponde al segundo ciclo según el sílabo facilitado; los ciclos de los otros ejemplos son agrupaciones ficticias para demostrar filtros, sin equivalencia con un plan universitario oficial.

**Programación I** incluye ahora el mapa de 17 semanas y 68 nodos del nuevo prompt, basado en el PDF facilitado en `Icono/file-urp-20260226-030655-226-23369a0a7dfdc301.pdf` (curso II0206, segundo ciclo). Cubre POO, control de flujo, métodos, arreglos, cadenas, excepciones, punteros, archivos y recursividad. Las semanas 8, 16 y 17 tienen un diseño especial de examen. Las cuatro subdivisiones, los objetivos, los repasos y la consolidación de la semana 13 son adaptaciones pedagógicas de TriKUp, no una transcripción literal. Los otros once cursos siguen mostrando solo sus temas de referencia disponibles.

Un curso personalizado se guarda con contenido pendiente. **El flujo PDF cambió por el nuevo prompt:** cualquier PDF admitido por tipo, extensión y tamaño activa una animación identificada como simulación y abre el mismo mapa precargado de Programación I. Se puede saltar la animación o cancelarla para cambiar el archivo. No se lee ni analiza el contenido del archivo cargado. Una imagen permite elegir un curso o registrar un nombre, sin fingir OCR. El contenido precargado nunca se atribuye al archivo seleccionado.

## Mapa y progresión

El mapa vertical tiene cuatro nodos circulares pixel art en zigzag por semana, caminos en un carril central separado de los textos, nodos actuales/disponibles/bloqueados/completados, cofres de semana completada y leyenda. El panel compacto muestra progreso, semana actual, semanas completadas, XP y acceso a las 17 semanas. Explorar una semana no desbloquea sus nodos. El guía reutilizado cambia su diálogo al explorar semanas de examen. El primer nodo abre la misión jugable de POO.

Solo el primer nodo está disponible inicialmente. Los otros 67 nodos permiten consultar su preparación; los bloqueados explican el requisito y deshabilitan **COMENZAR DESAFÍO**. Los disponibles todavía abren una transición con “Este desafío estará disponible próximamente”. Abrir o comenzar no otorga XP ni completa un nivel. Los paneles usan un diálogo nativo con cierre mediante Escape y restauración del foco.

**AVANZAR DEMO** solo se renderiza cuando `MAP_DEMO_MODE` está habilitado y está deshabilitado hasta completar la primera misión. Después completa exactamente el siguiente nodo, desbloquea su sucesor, registra el origen simulado y no concede XP. Se guardan los avances por curso y versión del mapa. `completeFromMission` registra el resultado determinista del primer subnivel; los otros nodos conservan recompensas previstas para una integración futura. Una finalización demo antigua puede convertirse en misión evaluada una sola vez sin borrar el avance posterior.

## Primer subnivel: introducción a la POO

La misión requiere completar tres juegos en orden, sin acceso directo al tercero:

1. **Memoria de conceptos:** ocho cartas mezcladas, cuatro parejas concepto/definición, intentos, progreso y explicación de cada pareja. Los errores conservan las posiciones y permiten reintentar. Sin temporizador.
2. **Lluvia de conceptos:** tres preguntas con cuatro bloques descendentes. Selección con clic, toque, Tab/Enter o teclas 1–4 dentro del escenario. El movimiento puede pausarse y respeta movimiento reducido. El temporizador de 20 segundos es voluntario, desactivado inicialmente para todos los perfiles, incluido tranquilo. Se pausa al consultar teoría y no descuenta intentos ni XP al agotarse.
3. **Constructor de código:** ocho bloques de C# para construir `class Gato`, su atributo `Nombre` y el método `Maullar()`. Se reorganizan con selección/destino, botones subir/bajar o arrastre. Se compara el orden de identificadores, sin ejecutar código. La solución completa se muestra al resolver o cuando el estudiante la solicita explícitamente.

`TheoryPanel` está disponible antes y durante todos los juegos, incluso después de un error. Presenta clase, objeto, atributo y método con el ejemplo Gato/Lucho y un diagrama SVG original. Consultarla es gratuito. `FeedbackPanel` explica cada acierto/error, indica el concepto a repasar, permite pedir pistas y adapta el mensaje al tono del perfil. El sonido cuadrado se sintetiza localmente mediante Web Audio y empieza silenciado.

Puntuación determinista por juego:

| Juego | Máximo | Por error | Por ayuda explícita | Mínimo al completar |
| --- | ---: | ---: | ---: | ---: |
| Memoria | 30 | −2 | −2 | 10 |
| Lluvia | 30 | −3 | −2 | 10 |
| Constructor | 40 | −4 | −3 | 15 |

La puntuación usa `max(mínimo, máximo − costeErrores − costeAyudas)`. La teoría, la pausa y las opciones de accesibilidad no restan. Los errores nunca impiden completar un juego. Intentos, errores, ayudas, finalización y XP se registran por separado. Los puntos por juego quedan preparados; el mapa recibe la recompensa una sola vez al finalizar los tres. Repetir es práctica: aunque mejore la puntuación, no vuelve a conceder XP ni sustituye la recompensa original.

Se persiste un registro de acciones válidas y el orden mezclado de las cartas/bloques. Al recargar se reconstruyen y evalúan las acciones, en lugar de confiar en campos de XP o finalización de un snapshot. Se recupera el progreso parcial de cada juego por curso. Al terminar aparecen los resultados, los conceptos aprendidos y la celebración; volver al mapa muestra el primer nodo completado, el segundo desbloqueado y la XP acumulada.

Los ejercicios son contenido pedagógico preparado para el prototipo, no una extracción literal del sílabo. Los otros 67 subniveles siguen pendientes.

## Demo e integración futura

La interfaz siempre funciona en **modo demo**, sin solicitudes al backend ni Gemini. `src/courses/syllabus-adapter.ts` prepara una integración futura con `POST /api/syllabus/analyze`, campo multipart `file`, contrato snake_case, manejo de errores y validación de respuesta. No se importa desde la UI ni existe un cambio automático a modo real. Usarlo requerirá conectar expresamente una interacción aprobada por el usuario.

El contrato del backend contiene unidades y niveles, sin semanas; el adaptador conserva ese formato y no inventa una conversión. No analiza archivos en la demo, no hace OCR y no simula respuestas de Gemini.

## Datos locales

- `trikup-onboarding-v1`: almacenamiento de perfil ya existente.
- `trikup-courses-v1`: cursos, fuente, metadatos, progreso inicial y mapa demo disponible.
- `trikup-selected-course-v1`: identificador seleccionado.
- `trikup-map-v1:<mapa>:<curso>`: finalizaciones secuenciales y su origen/XP para esta versión del mapa.
- `trikup-poo-mission-v1:<curso>`: órdenes iniciales y registro de acciones del primer subnivel, incluidos intentos y ayudas reconstruidos.
- `trikup-activities-v1`: resultados completados únicos por curso/ejecución/juego, observaciones y fechas conocidas; no contiene otro saldo de XP.
- `trikup-appearance-v1`: ambiente visual, interés en código, recordatorio interno y marca explícita de perfil demo.
- `trikup-engagement-v1`: insignias obtenidas, avisos y su estado de lectura, último día de visita.
- `trikup-course-access-v1`: fechas reales de acceso a los cursos.

Las aventuras se recuperan desde **Aventuras guardadas** al recargar. Se evitan duplicados por curso/carrera/ciclo; se conserva el progreso del registro existente. Los archivos viven únicamente en memoria: localStorage guarda su nombre, tamaño y tipo, nunca bytes ni imágenes en base64. Si el almacenamiento falla, la interfaz conserva el curso durante la sesión y avisa que no se guardó.

Los avances de la antigua demo Python de cuatro semanas no desbloquean los nuevos contenidos de POO. El registro de curso se conserva y el nuevo mapa inicia una progresión independiente y versionada. Los datos corruptos o fuera de orden no desbloquean niveles. Otro PDF para el mismo curso/carrera/ciclo recupera la aventura existente y su avance, sin duplicarla.

Las herramientas de desarrollo están en un bloque separado al final del panel. Reiniciar progreso exige confirmar el alcance y conserva perfil/cursos. Restaurar perfil demo aplica datos de ejemplo claramente identificados, sin inventar cursos ni resultados. Simular días o actividad solo cambia una vista previa aislada; no modifica el reloj, las rachas reales, la XP, las insignias ni el historial persistente. Las vistas previas de avisos tampoco crean notificaciones.

El logo oficial y las tipografías están incluidos localmente en `public/`. Las licencias SIL Open Font License se conservan en `public/fonts/`. La demo no necesita descargar recursos para renderizar sus pantallas.

## Organización

- `src/components/Brand.tsx`: logo oficial e iconos reutilizados por onboarding y cursos.
- `src/courses/CourseCreationPage.tsx`: escenas, confirmación, inventario y vista previa.
- `src/courses/guide.tsx`: personaje, diálogo y portal.
- `src/courses/course-inputs.tsx`: tarjetas, cargas de archivos, buscador y catálogo.
- `src/courses/types.ts`, `catalog.ts`, `course-storage.ts`: tipos, contenido y persistencia.
- `src/courses/courses.test.ts`: lógica de creación, archivos y adaptador con red simulada.
- `vite.config.ts`: excluye artefactos temporales de la vigilancia del servidor.
- `src/navigation.ts`: rutas compartidas y guardas de perfil.
- `src/learning-map/programming-data.ts`, `types.ts`: 17 semanas, 68 objetivos, identificadores y recompensas previstas.
- `src/learning-map/progress.ts`: estados, progresión secuencial y almacenamiento versionado.
- `src/learning-map/LearningMapPage.tsx`, `learning-map.css`: mapa, semanas, nodos, preparación y transición.
- `src/learning-map/progress.test.ts`: datos, desbloqueos, XP, finalización, aislamiento, corrupción y rutas.
- `src/first-mission/content.ts`: teoría, parejas, preguntas, bloques C# y reglas de puntuación.
- `src/first-mission/engine.ts`, `storage.ts`: evaluación, progresión entre juegos, registro de acciones y recompensa única.
- `src/first-mission/FirstMissionPage.tsx`: inicio, teoría, celebración e integración con el mapa.
- `src/first-mission/games.tsx`, `ui.tsx`, `mission.css`: tres juegos, retroalimentación, sonido opcional y diseño responsive.
- `src/first-mission/mission.test.ts`: evaluación, secuencias, ayudas, guardado parcial, corrupción y prevención de XP duplicada.
- `src/student/personalization-engine.ts`, `motivation-engine.ts`: recomendaciones, apoyo por desempeño y biblioteca de mensajes.
- `src/student/activity-service.ts`, `progress-service.ts`: resultados únicos y proyección del progreso existente.
- `src/student/dates.ts`, `streak-service.ts`, `achievement-service.ts`, `notification-service.ts`: calendario local, rachas, insignias y avisos idempotentes.
- `src/student/StudentExperience.tsx`, `StudentHeaderActions.tsx`: integración de estado y campana compartida.
- `src/student/DashboardPage.tsx`, `PreferencesPage.tsx`, `DemoControls.tsx`, `student.css`: panel, configuración, controles de desarrollo y presentación.
- `src/student/student.test.ts`: preferencias, fechas, rachas, resultados, XP, migración e idempotencia.

## Verificación en navegador

Tras `npm.cmd run build`, desde la raíz del repositorio:

```powershell
backend/.venv/Scripts/python.exe frontend/scripts/verify_courses.py
backend/.venv/Scripts/python.exe frontend/scripts/verify_learning_map.py
backend/.venv/Scripts/python.exe frontend/scripts/verify_first_mission.py
backend/.venv/Scripts/python.exe frontend/scripts/verify_student_dashboard.py
```

Usa Chrome o Edge instalado y `websockets` del entorno Python existente; inicia una vista previa temporal y un navegador sin ventana, sin iniciar ni modificar el backend. Comprueba onboarding, perfil, tres métodos, validaciones, vista previa, filtros, curso personalizado, confirmación, recuperación, duplicados, navegación y ausencia de solicitudes API/Gemini. Captura escritorio, tablet y móvil en `frontend/.tmp/courses-*.png`, comprueba que no haya desbordamiento horizontal y compara los hashes del backend antes/después. No sustituye pruebas manuales con lectores de pantalla o todos los navegadores.

La verificación del mapa añade ruta sin perfil/curso, simulación PDF, 68 nodos, teclado y foco, requisitos bloqueados, transición sin XP, exploración de exámenes, avance demo hacia la semana 2, cofre, persistencia, reapertura y ausencia de duplicados. Captura `frontend/.tmp/learning-*.png` en 1920, 1366, 820, 390 y 320 píxeles de ancho.

La verificación de la primera misión cubre errores y aciertos en los tres juegos, teoría con teclado/Escape, pistas, sonido opcional, animación descendente, temporizador voluntario y su pausa, guardado parcial, ordenamiento accesible de C#, cálculo de 81 XP con errores/ayudas y repetición perfecta de 100 puntos sin duplicar los 81 XP originales del mapa. Comprueba la ausencia de solicitudes externas y errores JavaScript. Capturas en `frontend/.tmp/mission-*.png`.

La verificación del panel recorre preferencias editables, avisos leídos persistentes, recomendaciones, guardado parcial, una misión real de 96 XP y actualización de tres actividades, una racha de un día y dos insignias. Verifica continuar desde el nodo 2, no duplicar avisos al recargar, simulación aislada de días, perfil demo sin resultados inventados y reinicio confirmado que conserva perfil/cursos. Capturas `frontend/.tmp/student-*.png` en 1920/1366/820/390/320. Las cuatro fases de esta implementación se compilaron por separado; la suite incluye 68 pruebas de lógica más las verificaciones de navegador.

No se implementan los otros 67 subniveles, notificaciones push, sincronización de cuentas, seguimiento fiable de tiempo, ejecución de C# ni llamadas al backend o a proveedores de IA. No se añaden dependencias externas.
