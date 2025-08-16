FROM postgres:17.5-alpine3.22

ARG USER
ARG PWD
ARG NAME

ENV POSTGRES_USER=$USER
ENV POSTGRES_PASSWORD=$PWD
ENV POSTGRES_DB=$NAME

COPY createSCH.sql /tmp/createSCH.sql
RUN sed -e "s/\${POSTGRES_USER}/${POSTGRES_USER}/g" /tmp/createSCH.sql > /docker-entrypoint-initdb.d/createSCH.sql
