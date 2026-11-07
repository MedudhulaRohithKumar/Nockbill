FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

ARG VITE_GOOGLE_CLIENT_ID=995123724994-6ejbal37p88sp32fmedph6k296uf8n7k.apps.googleusercontent.com
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 5173
CMD ["nginx", "-g", "daemon off;"]
