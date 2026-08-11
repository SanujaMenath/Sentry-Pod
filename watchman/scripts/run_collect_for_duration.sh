#!/usr/bin/env bash
# Simple runner: repeatedly run collect+parse for a duration then exit.
# Usage: ./run_collect_for_duration.sh -d 5 -i 30 -a

set -u

usage() {
  cat <<EOF
Usage: $0 [-d minutes] [-i seconds] [-a]

  -d minutes   Total run duration in minutes (default: 5)
  -i seconds   Interval between runs in seconds (default: 30)
  -a           Archive per-run `per_interface_metrics.json` snapshots
  -h           Show this help

Example: $0 -d 10 -i 20 -a   # run for 10 minutes, every 20s, archive snapshots
EOF
}

DURATION_MIN=5
INTERVAL_SEC=30
ARCHIVE=0

while getopts ":d:i:ah" opt; do
  case ${opt} in
    d ) DURATION_MIN=${OPTARG} ;;
    i ) INTERVAL_SEC=${OPTARG} ;;
    a ) ARCHIVE=1 ;;
    h ) usage; exit 0 ;;
    \? ) echo "Invalid Option: -${OPTARG}" 1>&2; usage; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_DIR="$REPO_ROOT/playbooks/snmp_output"
COLLECT_AND_PARSE="$SCRIPT_DIR/collect_and_parse_snmp.py"

if [ ! -d "$OUTPUT_DIR" ]; then
  echo "Creating output dir: $OUTPUT_DIR"
  mkdir -p "$OUTPUT_DIR"
fi

END_TIME=$(( $(date +%s) + DURATION_MIN * 60 ))

echo "Starting collector loop: duration=${DURATION_MIN}min interval=${INTERVAL_SEC}s archive=${ARCHIVE}"

while [ $(date +%s) -lt $END_TIME ]; do
  NOW_TS=$(date +%Y%m%d_%H%M%S)
  echo "[$(date +%F\ %T)] Run starting (ts=$NOW_TS)"

  if [ -x "$(command -v python3)" ]; then
    python3 "$COLLECT_AND_PARSE" || echo "[!] collect_and_parse_snmp.py failed at $(date +%T)"
  else
    echo "[!] python3 not found in PATH"; exit 2
  fi

  if [ "$ARCHIVE" -eq 1 ]; then
    SRC="$OUTPUT_DIR/per_interface_metrics.json"
    if [ -f "$SRC" ]; then
      DST="$OUTPUT_DIR/per_interface_metrics_${NOW_TS}.json"
      cp -f "$SRC" "$DST" && echo "  -> archived snapshot to $DST"
    else
      echo "  [!] No per_interface_metrics.json to archive"
    fi
  fi

  NOW_SECS=$(date +%s)
  if [ $NOW_SECS -ge $END_TIME ]; then
    break
  fi

  SLEEP_FOR=$INTERVAL_SEC
  # If remaining time is less than interval, sleep only the remaining time
  REMAIN=$(( END_TIME - NOW_SECS ))
  if [ $REMAIN -lt $SLEEP_FOR ]; then
    SLEEP_FOR=$REMAIN
  fi

  sleep $SLEEP_FOR
done

echo "Collector loop finished at $(date +%F\ %T)"
