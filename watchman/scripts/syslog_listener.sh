#!/bin/bash

API_URL="${SYSLOG_API_URL:-http://host.containers.internal:8000/api/syslog/alerts}"

SEVERITY_NAMES=("Emergency" "Alert" "Critical" "Error" "Warning" "Notification")

while IFS= read -r line; do
    [ -z "$line" ] && continue

    source_ip="${line%% *}"
    rest="${line#* }"

    msg_hostname=""

    if [[ $rest =~ ^\<[0-9]+\>([0-9]+:\ )?([A-Za-z][A-Za-z0-9_.-]*):\ \.?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ]]; then
        candidate="${BASH_REMATCH[2]}"
        month_re="^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$"
        if [[ ! $candidate =~ $month_re ]]; then
            msg_hostname="$candidate"
        fi
    fi

    if [ -z "$msg_hostname" ]; then
        candidate_raw="${rest%%%*}"
        candidate_ip=$(echo "$candidate_raw" | awk '{print $NF}')
        if [[ $candidate_ip =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            source_ip="$candidate_ip"
        fi
    fi

    if [[ $rest =~ %([A-Za-z0-9_/-]+)-([0-7])-([A-Za-z0-9_/-]+):\ (.*) ]]; then
        facility="${BASH_REMATCH[1]}"
        severity="${BASH_REMATCH[2]}"
        mnemonic="${BASH_REMATCH[3]}"
        msg_text="${BASH_REMATCH[4]}"

        if [ "$severity" -le 5 ]; then
            severity_name="${SEVERITY_NAMES[$severity]}"

            hostname_field=""
            [ -n "$msg_hostname" ] && hostname_field=", \"msg_hostname\": \"$msg_hostname\""

            payload=$(cat <<EOF
{
  "source_ip": "$source_ip",
  "facility": "$facility",
  "severity": $severity,
  "severity_name": "$severity_name",
  "mnemonic": "$mnemonic",
  "message": "$msg_text",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"$hostname_field
}
EOF
)
            curl -s -X POST "$API_URL" \
                -H "Content-Type: application/json" \
                -d "$payload" > /dev/null 2>&1
        fi
    fi
done
