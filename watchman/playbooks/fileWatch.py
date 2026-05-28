import time
import os

LOG_FILE = "/var/log/gns3_alerts.log"

def watch_logs():
    # Move to the end of the file
    with open(LOG_FILE, "r") as f:
        f.seek(0, os.SEEK_END)
        
        print(f"Watching {LOG_FILE} for GNS3 events...")
        
        while True:
            line = f.readline()
            if not line:
                time.sleep(0.1)  # Sleep briefly and wait for new content
                continue
            
            # Check for your specific keywords
            if "LINK-5-CHANGED" in line or "PSECURE_VIOLATION" in line:
                print(f"\n[ALERT DETECTED]: {line.strip()}")
                # Trigger your other project logic here!

if __name__ == "__main__":
    watch_logs()