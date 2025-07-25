#!/bin/sh

HOST="$1"
PORT="$2"
shift 2
CMD="$@"

echo "Waiting for $HOST:$PORT to become available..."

while ! nc -z "$HOST" "$PORT"; do
	sleep 0.5
done

echo "$HOST:$PORT is available. Starting app..."
exec $CMD
