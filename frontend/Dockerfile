FROM node:18-alpine as build

WORKDIR /app

# Variáveis de build
ARG REACT_APP_BACKEND_URL

ENV REACT_APP_BACKEND_URL=${REACT_APP_BACKEND_URL}

# Copiar package.json
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar código
COPY . .

# Build
RUN npm run build

# Estágio final
FROM node:18-alpine

WORKDIR /app

# Instalar servidor simples
RUN npm install -g serve

# Copiar build do estágio anterior
COPY --from=build /app/build ./build

# Expor porta
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000 || exit 1

# Iniciar servidor
CMD ["serve", "-s", "build", "-l", "3000", "-p", "3000"]
