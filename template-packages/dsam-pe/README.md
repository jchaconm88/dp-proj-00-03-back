# Plantilla dsam-pe

Landing tipo [dsam.pe](https://dsam.pe/) para subir al CMS como plantilla HTML.

## Contenido del ZIP

```
dsam-pe/
  index.html      ← obligatorio en la raíz del ZIP
  styles/
    dsam.css
```

## Placeholders (rellenados por el front)

| Placeholder    | Origen CMS                          |
|----------------|-------------------------------------|
| `{{title}}`    | Título de la página                 |
| `{{content}}`  | Contenido rich text (HTML)          |
| `{{tenantName}}` | Nombre del tenant                 |
| `{{lang}}`     | Código de idioma (ej. `es`)         |
| `{{homeUrl}}`  | URL base de inicio del tenant       |

## Cómo subir

1. Comprimir **solo** la carpeta interior (debe existir `index.html` en la raíz del ZIP):

   ```powershell
   cd dp-proj-00-03-back\template-packages
   Compress-Archive -Path dsam-pe\* -DestinationPath dsam-pe.zip -Force
   ```

2. CMS → **Plantillas HTML** → `templateId`: `dsam-pe` → subir `dsam-pe.zip`.
3. En **Pages** (página `inicio` o landing) → campo **templateId**: `dsam-pe`.
4. Publicar y abrir `http://mi-cliente.local:4321/es/inicio`.

Los productos del HTML son estáticos (demo). El bloque editable del CMS es la sección bajo `{{title}}` / `{{content}}`.
