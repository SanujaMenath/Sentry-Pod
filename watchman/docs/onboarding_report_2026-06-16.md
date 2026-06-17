# Sentry-Pod Onboarding Report
**Date:** 2026-06-16T18:06:47Z

## Summary
| Group | Count |
|---|---|
| Edge Routers | 0 |
| Core Switches | 0 |
| Distribution Switches | 0 |
| Access Switches | 0 |
| **Total** | **0** |

## Generated hosts.ini
```ini
# Sentry-Pod managed inventory
# Generated: 2026-06-16T18:06:47Z

[allHosts]

[allHosts:vars]
ansible_network_os=cisco.ios.ios
ansible_connection=network_cli
ansible_user=admin
ansible_password=cisco
ansible_become=yes
ansible_become_method=enable

```

## Changes vs Previous Inventory
**Removed:**
- ESW1
- ESW10
- ESW11
- ESW12
- ESW13
- ESW14
- ESW2
- ESW3
- ESW4
- ESW5
- ESW6
- ESW7
- ESW8
- ESW9
- Esw11
- R1
- R2

**Unchanged:** 0 devices

## Flush Plan
The following demo/cache data will be cleared on apply:

**MongoDB collections:** devices, device_configurations, cdp_neighbors, topology_cache
**Disk paths:** goldenState/ (16 files), configDrift/ (16 files), cdp_output/ (16 files), facts/ (17 files), runningConfigs/ (empty)

---
*Preview only — no changes written*
