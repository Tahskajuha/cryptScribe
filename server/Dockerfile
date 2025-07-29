FROM node:24-alpine
WORKDIR /app

COPY ./package.json /app/
RUN npm install --production
COPY index.js /app/
COPY ./waitFor.sh /app/
