# Ubicación y uso entre agentes

La fuente única de esta skill vive en `.agents/skills/scorefy-check/`, dentro del repositorio. En Codex usa `$scorefy-check`; en Claude Code usa `/scorefy-check`, cuya entrada en `.claude/skills/scorefy-check/SKILL.md` carga estas instrucciones. Para otros agentes, solicita que lean el `SKILL.md` canónico antes de revisar Scorefy.

Resuelve las rutas de scripts, referencias y configuración desde la carpeta canónica, aunque hayas entrado desde Claude. Cada agente necesita su propio acceso autorizado a Google Sheets; compartir la skill no comparte credenciales ni conexiones. Si falta ese acceso, puedes preparar la revisión con datos públicos, pero no afirmar que contrastaste la hoja actual ni que escribiste cambios.

# Procedimiento

## Preparar un torneo

Copia `assets/octubre-2026.json` a un archivo propio del torneo, fuera de la carpeta instalada si quieres conservarlo al actualizar la skill. Cambia nombre, URL de la hoja, pestañas y URLs de Scorefy. Las URLs pueden cambiar por completo entre torneos; no las construyas suponiendo que conservan el mismo patrón.

Consulta la página de la organización si faltan enlaces. Verifica categoría, edición y sede antes de vincularlos. Lee las parejas actuales de la hoja y crea una correspondencia explícita entre cada ID de equipo de Scorefy y el ID de pareja de la hoja, separada por categoría. Comprueba que los dos integrantes coincidan, aunque estén invertidos o abreviados. Si cambian integrantes, pregunta: no adivines por semejanza de nombres.

En el torneo inicial, `partidos` usa estas columnas:

`id, dia, fecha, hora, categoria, fase, zona, pareja_a, equipo_a, pareja_b, equipo_b, sets, nota`.

Los IDs 1–38 ya existen. No los renumeres. La configuración inicial conserva los IDs de origen de esos partidos. Para otro torneo, establece la correspondencia con sus filas actuales por categoría, zona y conjunto de parejas. Ante dos coincidencias posibles, detén ese partido. No uses el orden de la fila ni el horario para identificarlo.

## Obtener evidencia

Descarga las páginas públicas de fixture y resultados a archivos locales. Usa herramientas HTTP disponibles; si fallan por permisos de red, sigue el mecanismo de autorización del entorno. No uses navegación automatizada si el proyecto la prohíbe.

Ejecuta, con rutas resueltas desde esta skill:

```bash
python3 scripts/extract_scorefy.py --html /tmp/fixture.html --salida /tmp/fixture.json --zona-horaria America/Argentina/Mendoza
```

El extractor es de solo lectura: no usa credenciales ni escribe en Google Sheets. Lee los objetos `match` embebidos en Next.js y conserva los datos originales para comprobar campos no normalizados. Un cambio del sitio puede romperlo: ante errores no continúes con esa fuente como si estuviera vacía.

Registra por URL el momento de consulta y si fue correcta. Una página de resultados vacía es válida si publica explícitamente que no hay partidos; no prueba que el fixture esté vacío. Si fixture y resultados discrepan, presenta el conflicto. No mezcles silenciosamente instantáneas incompatibles.

## Comparar

- Solo grupos: contrasta fase, ronda, placeholders y pertenencia de ambos equipos a la misma zona. `round = 0` por sí solo no demuestra que sea fase de grupos. En futuras revisiones del torneo inicial compara primero los 38 IDs configurados; informa por separado cualquier partido nuevo.
- Agenda: convierte `dateOriginal` UTC a la zona configurada antes de comparar día, fecha y hora. Usa los valores efectivos de Sheets, no suposiciones basadas en cómo se ven las celdas. Fecha y hora son un único cambio lógico, incluyendo `dia`.
- Resultados: `match.sets` publica los parciales separados por `|`; en la propuesta y en Sheets, normalízalos a un único espacio entre sets, sin barras (por ejemplo, `12-5 | 5-12 | 7-2` pasa a `12-5 5-12 7-2`). Conserva el orden de los sets y de los puntos; no cambies la orientación salvo que A/B estén invertidos. `teams[].goals` puede representar el total de sets: no lo uses para reconstruir parciales. Si solo hay marcador global, informa «resultado publicado; detalle de sets pendiente» sin ofrecer escribir un resultado incompleto.
- Orientación: si A/B están invertidos entre origen y hoja, invierte los puntos de cada set antes de comparar. Una representación equivalente no es una discrepancia.
- Ausencias o datos incompletos: conserva lo existente y deja el caso pendiente. No borres marcadores porque la fuente los omita.
- Cambios nuevos: no agregues encuentros ni sustituyas parejas automáticamente. Presenta su identidad y solicita aprobación específica.
- Conserva notas, IDs, formatos, fórmulas y validaciones ajenos al cambio. Si hay fórmulas en un campo de destino, informa antes de proponer sobrescribirlas.

La hoja inicial tiene zona horaria `America/Los_Angeles`; no la cambies. Para fechas/horas separadas escribe números seriales calculados desde la fecha y hora civil de Mendoza y preserva sus formatos. Así no se aplica otra conversión UTC por accidente. Valida los valores mostrados después de escribir.

## Propuesta y aprobación

Guarda un JSON local por revisión en un directorio de trabajo del usuario o temporal. Incluye:

- ID de revisión, torneo, ID de hoja, pestaña y zona horaria.
- Fecha de consulta y URLs utilizadas; estado y cobertura por fuente.
- Cambios numerados: ID de origen y de la hoja, IDs de ambas parejas, campo lógico, rangos, valores/fórmulas anteriores y valores propuestos, evidencia y tipo (`agenda`, `resultado`, `conflicto`, `nuevo`).
- Casos pendientes, sin tratarlos como cambios aplicables.

No guardes tokens ni cookies. Si no puedes recuperar una propuesta después de cambiar de conversación, regenera el informe y pide aprobación nueva. No interpretes «revisar» o «continuar» como aprobación genérica de escrituras.

Ejemplo de informe **ilustrativo**, no un cambio real:

| N.º | Partido | Campo | Hoja actual | Scorefy | Tipo |
|---|---|---|---|---|---|
| 1 | Categoría, pareja A / pareja B | Fecha y hora | 20/10 19:00 | 21/10 19:30 | Agenda |
| 2 | Categoría, pareja C / pareja D | Sets | Vacío | 12-8 12-9 | Resultado |

Pide: «¿Qué cambios apruebas?». Acepta «todos» o números específicos cuando se refieran inequívocamente a esa revisión. Espera la respuesta. Los conflictos requieren que la aprobación cubra explícitamente la sustitución del valor existente.

## Aplicar y verificar

Reconsulta las fuentes y relee las celdas, IDs y fórmulas justo antes de escribir. Comprueba que tanto el valor anterior de la hoja como el propuesto por la fuente sigan siendo los revisados. Si cambió cualquiera, no lo apliques con la aprobación vieja. No confíes en coordenadas si se ordenaron o insertaron filas: resuelve otra vez por identidad.

Usa el conector de Google Sheets con una operación coherente y máscaras precisas. No reimportes la hoja entera ni la reemplaces con un archivo. La aprobación de una revisión no autoriza las siguientes.

Relee todos los campos escritos, sus valores mostrados y los IDs vecinos. Marca la propuesta como aplicada solo tras esa comprobación. Si hay fallos parciales, informa lo verificado y relee antes de cualquier reintento. Evita agregar filas duplicadas al repetir una operación.

## Mantenimiento

El extractor requiere Python 3.9 o posterior y solo usa la biblioteca estándar. Para comprobarlo:

```bash
python3 -m unittest discover -s scripts -p 'test_*.py'
```

Si Scorefy cambia su payload o la representación de sets, actualiza el extractor con una muestra pública real y ejecuta las pruebas antes de usarlo para proponer escrituras. Conserva el estado «pendiente» hasta que la lectura de sets esté probada. La skill sigue siendo utilizable para revisar agenda mientras tanto.
