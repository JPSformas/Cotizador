# Cotizador

Sistema de cotización para Formas.shop. Este repo agrupa prototipos por versión; los assets compartidos viven una sola vez en `shared/`.

Serví siempre la **raíz del repo** (esta carpeta). Si el document root es `v5/` o `v6/`, los CSS/JS/fuentes de `shared/` no cargan.

## Abrir

- v5 — detalle: `v5/detalle-cotizacion.html`
- v5 — ítem: `v5/editItem.html` / `v5/editItem-generico.html`
- v6 — detalle: `v6/detalle-cotizacion.html`
- v6 — ítem (modo costos): `v6/editItem.html` / `v6/editItem-generico.html`
- v6 — prototipo de precios: `v6/Propuesta-Precios.html`

Ejemplo:

```bash
npx --yes serve -p 4173 .
```

Luego: http://localhost:4173/v5/detalle-cotizacion.html

## Estructura

- `shared/` — Fonts, IMG, CSS y JS usados por más de una versión
- `v5/` — páginas y scripts solo de Cotización v5
- `v6/` — motor de precios por volumen y páginas que lo usan
- `docs/` — comparación v4 vs v5, screenshots, y el script Playwright

## Tecnologías

HTML5, CSS3, JavaScript, Bootstrap 5, Font Awesome 7.0.1
