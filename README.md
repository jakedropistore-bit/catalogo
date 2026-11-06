# Catálogo (Netlify + Neon + Cloudinary)

1. **Neon**: crea un proyecto y copia la cadena de conexión.
2. **Cloudinary**: copia cloud name, API key y API secret.
3. **Netlify**: sube esta carpeta a un repositorio de GitHub, impórtalo y agrega estas variables de entorno:
   `DATABASE_URL`, `ADMIN_PIN`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
4. (Ya hecho) `WA` y `STORE` están configurados en `public/index.html`.
5. Entra a `/admin`, escribe el PIN y agrega productos. La tabla se crea sola en el primer uso.

Local: `npm i -g netlify-cli && npm i && netlify dev` (con las variables en un archivo `.env`, que no debes subir a GitHub).
