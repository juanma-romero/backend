# Usamos una versión estable de Node
FROM node:20-slim

# Directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Copiamos los archivos de definición de dependencias
COPY package*.json ./

# Instalamos las dependencias
RUN npm install

# Copiamos el resto del código
COPY . .

# Exponemos el puerto que usa tu app
EXPOSE 3000

# El comando de inicio (aunque el compose lo sobrescribe, es buena práctica tenerlo)
CMD ["node", "index.js"]
