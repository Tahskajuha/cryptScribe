FROM postgres:17.5-alpine3.22

ENV POSTGRES_USER="webapp"
ENV POSTGRES_PASSWORD="IDunnoThisIsLocalUse"
ENV POSTGRES_DB="journal_db"

COPY createSCH.sql /docker-entrypoint-initdb.d/createSCH.sql
