# Dirección visual y revisión de material

## P03/P04 — 2026-10-17

Se conserva y completa la dirección ya implementada: logo negro sobre blanco,
fotografía auténtica protagonista y azul profundo tomado del material de cortes.
La revisión previa descartó sustituir las fotos por imágenes genéricas y añadir
precios, reseñas o servicios no proporcionados.

- Paleta: tinta `#1a252f`, azul `#18334c`, acento `#254e70`, papel `#f7f8f8`,
  blanco `#ffffff`, texto secundario `#5c6770`.
- Tipografía: Arial/Helvetica del sistema; titulares amplios y compactos,
  cuerpo sobrio. Sin descarga de fuentes ni dependencias de CDN.
- Composición: texto alineado a izquierda y retrato grande a derecha;
  cinco cortes, explicación de visita y formulario en dos columnas.
  En celular: una columna, galería deslizable y menú desplegable.
- El elemento distintivo es la fotografía real de perfil con su corte visible.
  La UI secundaria evita competir con ella. Se conserva el logo original.

```text
logo                       cortes / a domicilio / ubicación / turno
propuesta + botón           fotografía de corte2
galería de cinco cortes reales
servicio a domicilio        tres pasos para solicitar
calendario y hora           datos y WhatsApp
contacto                   dirección e Instagram
```

## Inspección visual de los seis originales

Todas las fotos son verticales, 1200 × 1600, orientación 1; derivados de 480 y
960 px sin deformación. No se alteraron los originales.

| Recurso | Contenido comprobado | Foco |
| --- | --- | --- |
| logo.jpg | JC BARBER y poste de barbería negro en fondo blanco, 206 × 206 | Recortar únicamente margen blanco, sin reescalar el archivo |
| corte1.jpeg | Corte infantil corto, flequillo recto, capa azul | Centro, preservar cabeza completa |
| corte2.jpeg | Perfil con degradado y cabello corto arriba | Hero y primera foto, centro a 50% vertical |
| corte3.jpeg | Vista posterior de cabello texturado y nuca degradada | Centro |
| corte4.jpeg | Perfil de mullet con laterales cortos | Centro |
| corte5.jpeg | Perfil con volumen arriba y largo en nuca | Centro |

WebP + JPEG fallback. La ampliación muestra proporción completa y permite
Escape/cierre con retorno de foco. El nuevo nombre solicitado, JC Barberhouse,
se refleja en contenido, título y WhatsApp; el logo conserva su diseño original.

## R10 — Revisión de reservas, 21/10/2026

El formulario acompaña el diseño editorial sobrio del sitio. Se usan exactamente
Arial/Helvetica, tinta `#1a252f`, azul profundo `#18334c`, acento `#254e70`, papel
`#f7f8f8`, blanco y separadores `#dce1e4`; WhatsApp conserva su verde `#176441`.
No se agregan fuentes ni colores ajenos.

- Cabeceras de pasos claras con numeración funcional, títulos de 22–24 px y una
  frase de ayuda. Espaciado constante, texto alineado a izquierda.
- Precios en grupos de servicio compactos, sin flotantes ni precios alejados.
  Local y domicilio se distinguen con los íconos ya presentes en la página.
- Calendario amplio, contenido en una superficie clara: números limpios, días
  seleccionables con fondo tenue y selección azul. Rangos e instrucciones van
  después de los días para priorizar la elección.
- Fecha, lista de horarios y datos comparten la columna derecha. Se elimina
  el gran vacío que dejaba mostrar allí sólo el nombre.
- Resumen de servicio, fecha/hora e importe siempre visible; botón de WhatsApp
  con ancho y alineación coherentes. El detalle personal sigue desplegable.
- Móvil: catálogo y paneles apilados, sin columnas de campos estrechas; fechas
  táctiles y controles de al menos 48 px. Tablet pasa a una columna antes de
  comprimir el calendario.

```text
1  Elegí el servicio                ayuda breve
   [ En la barbería / precios ]    [ A domicilio / incluye ]
   [ Dónde te atendés        ]     [ Servicio             ]
2  Elegí el turno y completá tus datos
   [ Calendario amplio      ]     [ Fecha / horario      ]
   [ Mes + días + leyenda   ]     [ Nombre / dirección   ]
   [ Horarios de atención  ]     [ Localidad / ayuda    ]
3  Confirmá por WhatsApp
   [ Servicio / cuándo / total ]  [ Botón + explicación  ]
```

La revisión prioriza continuidad con el hero y las tarjetas de contacto: bordes
finos, radios discretos y azul funcional; evita convertir cada texto en una tarjeta.
