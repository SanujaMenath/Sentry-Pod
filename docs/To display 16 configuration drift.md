To display **16 configuration drift alerts** on the Dashboard widget, the system goes through a five-phase, step-by-step process starting from the physical devices up to the React UI component.

> **Note**: This document was written to trace the data flow for displaying 16 drifts. A bug was later fixed where `configDrift.yml` unconditionally created `DRIFT_*.diff` files for all devices even when empty, and `parse_drift.py` counted all files regardless of content. The flow below remains accurate in principle — the count now reflects only devices with actual diff content (non-empty files with `+`/`-` lines).

Here is the exact step-by-step data lifecycle:

---

### **Phase 1: File Generation on the Filesystem**
The bedrock of the data is the `watchman/playbooks/configDrift` folder on the backend server. 

1. An Ansible playbook run (triggered by `run_drift_analysis.sh`) detects configuration modifications on **16 different network hosts**.
2. For each of these 16 devices, Ansible saves a separate diff file to `watchman/playbooks/configDrift/` using the naming convention `DRIFT_<hostname>.diff`.
3. Consequently, there are exactly **16 physical files** present in that directory (for example: `DRIFT_ESW1.diff` through `DRIFT_ESW16.diff`).

---

### **Phase 2: Backend Directory Scanning (Python)**
When the Dashboard requests drift data, the FastAPI backend queries the filesystem to discover how many drift files exist.

1. The React frontend calls `GET http://127.0.0.1:8000/playbooks/drift`.
2. This invokes `parse_config_drift_reports()` in `watchman/app/services/playbook_service.py`:
   ```python
   drift_dir = PLAYBOOKS_DIR / "configDrift"
   results: List[dict] = []
   ```
3. The service glob-searches for all files matching `DRIFT_*.diff` inside that directory:
   ```python
   for path in sorted(drift_dir.glob('DRIFT_*.diff')):
   ```
4. Since there are **16** such files, the loop executes **16 times**.
5. Each iteration parses a file, extracts its metadata, and appends a dictionary object to the `results` list.
6. The function returns the `results` list containing **exactly 16 items**.

---

### **Phase 3: Payload Construction and HTTP Response**
In `watchman/app/routes/playbook_routes.py`, the controller intercepts the array of 16 parsed report dictionaries.

1. The route builds a JSON payload:
   ```python
   reports = playbook_service.parse_config_drift_reports()
   return {"status": "success", "count": len(reports), "reports": reports}
   ```
2. Because `len(reports)` is `16`, the API sends back an HTTP response body matching:
   ```json
   {
     "status": "success",
     "count": 16,
     "reports": [
       { "hostname": "ESW1", "diff_content": "...", "mtime": 1711200000, ... },
       { "hostname": "ESW2", "diff_content": "...", "mtime": 1711200000, ... },
       ...
       { "hostname": "ESW16", "diff_content": "...", "mtime": 1711200000, ... }
     ]
   }
   ```

---

### **Phase 4: Frontend State Update (React)**
When the Dashboard renders, a React `useEffect` hook fires to retrieve the data and update the component state.

1. `Dashboard.jsx` initializes a state variable with an empty array:
   ```javascript
   const [driftReports, setDriftReports] = useState([]);
   ```
2. The asynchronous `useEffect` fetches the endpoint:
   ```javascript
   useEffect(() => {
     const fetchDrift = async () => {
       try {
         const res = await fetch("http://127.0.0.1:8000/playbooks/drift");
         const data = await res.json();
         // data.reports contains the array of 16 items
         if (data && data.reports) setDriftReports(data.reports); 
       } catch (e) {
         console.error("Failed to load drift reports:", e);
       }
     };
     fetchDrift();
   }, []);
   ```
3. Calling `setDriftReports(data.reports)` updates the react state of `driftReports` to contain the **16-item array**, triggering a UI re-render.

---

### **Phase 5: Rendering the Widget Counter in the UI**
Once the state is updated, React re-evaluates the JSX markup to display the number `16` in two specific widgets on the screen:

#### **1. The Configuration Drift Alerts Stat Card:**
```jsx
<StatCard
  title="Configuration Drift Alerts"
  value={String(driftReports.length || 0)}  // Evaluates to: String(16) -> "16"
  subValue={driftReports.length > 0 ? "Updated recently (via Ansible)" : "No drift detected (via Ansible)"}
  icon={ShieldAlert}
  ...
/>
```
*Result: This stat card visually pops up with the number **16**.*

#### **2. The Configuration Drift Detail/Preview Card:**
Further down in the layout, the detailed card counts and showcases the latest drift:
```jsx
<div className="flex justify-between items-center mb-6">
  <div className="flex items-center gap-2 text-amber-500">
    <Network size={20} />
    <h4 className="text-base font-bold text-slate-200">Configuration Drift</h4>
  </div>
  <span className="text-[10px] bg-amber-500/10 text-amber-500 px-3 py-1 rounded-lg border border-amber-500/20 font-bold">
    {driftReports.length} Alert{driftReports.length !== 1 ? 's' : ''}  {/* Evaluates to: "16 Alerts" */}
  </span>
</div>
```
*Result: The pill tag in the upper-right corner of the preview widget displays "**16 Alerts**". Below it, the widget loads `driftReports[0]` to display a code-diff preview of the most recently modified device.*