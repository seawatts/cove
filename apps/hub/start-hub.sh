#!/bin/bash
# Cove Hub Wrapper Script
# This script automatically restarts the hub when an upgrade is performed

while true; do
  echo "Starting Cove Hub..."
  bun src/index.ts
  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 42 ]; then
    echo "Hub upgrade detected (exit code 42), restarting..."
    sleep 2
  elif [ $EXIT_CODE -eq 0 ]; then
    echo "Hub stopped normally"
    break
  else
    echo "Hub exited with error code $EXIT_CODE"
    # Wait before restarting on error
    sleep 5
  fi
done

