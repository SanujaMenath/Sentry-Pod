#!/usr/bin/env python3
"""
Comprehensive test suite for Playbook Management module.

Tests:
  1. Create Playbook (multipart with file upload)
  2. Edit Playbook (PUT)
  3. Pipeline Status Update (PATCH)
  4. Edge cases (duplicate, invalid file, missing fields, not found)

Requires:
  - Backend server running on VITE_API_BASE_URL or http://localhost:8000
  - write access to watchman/playbooks/ directory
"""

import argparse
import json
import os
import sys
import requests

API_BASE = os.environ.get("VITE_API_BASE_URL", "http://localhost:8000")
PASS = "[PASS]"
FAIL = "[FAIL]"
SKIP = "[SKIP]"
INFO = "[INFO]"

tests_passed = 0
tests_failed = 0
tests_skipped = 0

CREATED_IDS = []
CREATED_FILENAMES = []


def ok(msg):
    global tests_passed
    tests_passed += 1
    print(f"{PASS} {msg}")


def fail(msg):
    global tests_failed
    tests_failed += 1
    print(f"{FAIL} {msg}")


def skip(msg):
    global tests_skipped
    tests_skipped += 1
    print(f"{SKIP} {msg}")


def info(msg):
    print(f"{INFO} {msg}")


def http_request(method, path, data=None, files=None, headers=None):
    """Make an HTTP request with optional multipart file upload."""
    url = f"{API_BASE}{path}"
    req_headers = {"Accept": "application/json"}
    if headers:
        req_headers.update(headers)

    try:
        if files:
            upload_files = {}
            for field, (filename, content, mime_type) in files.items():
                upload_files[field] = (filename, content, mime_type)
            resp = requests.request(method, url, data=data, files=upload_files, headers=req_headers, timeout=15)
        else:
            resp = requests.request(method, url, json=data, headers=req_headers, timeout=15)
        return resp.status_code, resp.json() if resp.text else {}
    except requests.exceptions.Timeout:
        return 0, {"detail": "Request timed out"}
    except requests.exceptions.ConnectionError as e:
        return 0, {"detail": f"Connection error: {e}"}
    except Exception as e:
        return 0, {"detail": str(e)}


def test_health():
    info("--- Health Check ---")
    status, data = http_request("GET", "/")
    if status == 200:
        ok("Backend API is reachable")
        return True
    else:
        fail(f"Backend API unreachable: {data.get('detail', 'unknown')}")
        return False


def test_create_playbook():
    info("\n--- Test: Create Playbook ---")

    test_yaml = b"""
- name: Test Playbook
  hosts: allHosts
  gather_facts: false
  tasks:
    - name: Test task
      debug:
        msg: "Hello from test"
"""
    files = {
        "file": ("test_create_pb.yml", test_yaml, "application/x-yaml")
    }
    data = {
        "name": "Test Create Playbook",
        "description": "A playbook created during testing",
        "engine_type": "Ansible",
        "subnet_scope": "allHosts",
        "pipeline_status": "Draft",
        "tags": "test,automation",
        "target_devices": "allHosts",
        "example_intents": "test the system\nrun a test",
        "destructive": "false",
        "severity": "low",
    }

    status, resp = http_request("POST", "/playbooks/add", data=data, files=files)

    if status == 201:
        ok(f"Create returned 201: {resp.get('message', '')}")
        created_id = resp.get("id")
        created_filename = resp.get("filename")
        if created_id:
            CREATED_IDS.append(created_id)
            ok(f"Playbook created with ID: {created_id}")
        else:
            fail("No ID returned from create")
        if created_filename:
            CREATED_FILENAMES.append(created_filename)
            ok(f"File saved as: {created_filename}")
        else:
            fail("No filename returned from create")
    else:
        fail(f"Create failed ({status}): {resp.get('detail', resp)}")
        return

    status, resp = http_request("GET", "/playbooks/dashboard")
    if status == 200:
        blueprints = resp.get("blueprints", [])
        match = [b for b in blueprints if b.get("name") == "Test Create Playbook"]
        if match:
            ok("Playbook found in MongoDB via /dashboard endpoint")
        else:
            fail("Playbook not found in MongoDB")
    else:
        fail(f"Dashboard endpoint failed ({status})")

    status, resp = http_request("GET", "/playbooks/catalog")
    if status == 200:
        catalog = resp.get("catalog", [])
        match = [c for c in catalog if c.get("filename") == created_filename]
        if match:
            ok(f"Entry found in catalog.json for {created_filename}")
        else:
            fail("Entry not found in catalog.json")
    else:
        fail(f"Catalog endpoint failed ({status})")

    playbooks_dir = os.path.join(os.path.dirname(__file__), "..", "playbooks")
    file_path = os.path.join(playbooks_dir, created_filename)
    if os.path.exists(file_path):
        ok(f"YAML file exists on disk at {created_filename}")
    else:
        fail(f"YAML file not found at {file_path}")


def test_edit_playbook():
    info("\n--- Test: Edit Playbook ---")
    if not CREATED_IDS:
        skip("No playbook ID available (create test must pass first)")
        return

    pb_id = CREATED_IDS[0]
    update_data = {
        "description": "Updated description for testing",
        "pipeline_status": "Verified",
        "severity": "medium",
        "tags": ["test", "automation", "updated"],
    }

    status, resp = http_request("PUT", f"/playbooks/{pb_id}", data=update_data)

    if status == 200:
        ok(f"Edit returned 200: {resp.get('status', '')}")
        blueprint = resp.get("blueprint", {})
        if blueprint.get("description") == "Updated description for testing":
            ok("Description updated in MongoDB")
        else:
            fail(f"Description not updated: {blueprint.get('description')}")
    else:
        fail(f"Edit failed ({status}): {resp.get('detail', resp)}")
        return

    status, resp = http_request("GET", "/playbooks/catalog")
    if status == 200:
        catalog = resp.get("catalog", [])
        filename = CREATED_FILENAMES[0] if CREATED_FILENAMES else None
        if filename:
            match = [c for c in catalog if c.get("filename") == filename]
            if match and match[0].get("description") == "Updated description for testing":
                ok("catalog.json entry updated with new description")
            else:
                fail("catalog.json entry not updated")
    else:
        fail(f"Catalog endpoint failed ({status})")


def test_pipeline_status_update():
    info("\n--- Test: Pipeline Status Update ---")
    if not CREATED_IDS:
        skip("No playbook ID available")
        return

    pb_id = CREATED_IDS[0]

    status, resp = http_request("PATCH", f"/playbooks/{pb_id}/status", data={"pipeline_status": "Failed"})
    if status == 200:
        ok("PATCH status returned 200")
        blueprint = resp.get("blueprint", {})
        if blueprint.get("pipeline_status") == "Failed":
            ok("pipeline_status updated to 'Failed' in MongoDB")
        else:
            fail(f"pipeline_status not updated: {blueprint.get('pipeline_status')}")
    else:
        fail(f"PATCH status failed ({status}): {resp.get('detail', resp)}")

    status, resp = http_request("GET", "/playbooks/dashboard")
    if status == 200:
        blueprints = resp.get("blueprints", [])
        match = [b for b in blueprints if b.get("id") == pb_id]
        if match and match[0].get("pipeline_status") == "Failed":
            ok("Dashboard reflects updated pipeline status")
        else:
            fail(f"Dashboard does not reflect update: {match[0].get('pipeline_status') if match else 'not found'}")
    else:
        fail(f"Dashboard endpoint failed ({status})")

    status, resp = http_request("PATCH", f"/playbooks/{pb_id}/status", data={"pipeline_status": "Verified"})
    if status == 200:
        ok("Reverted status to 'Verified' successfully")
    else:
        fail(f"Revert status failed: {resp.get('detail', resp)}")

    status, resp = http_request("PATCH", f"/playbooks/{pb_id}/status", data={"pipeline_status": "InvalidStatus"})
    if status == 400:
        ok("Invalid status correctly rejected with 400")
    else:
        fail(f"Invalid status should return 400, got {status}")


def test_duplicate_playbook():
    info("\n--- Test: Edge Case - Duplicate Playbook ---")
    if not CREATED_FILENAMES:
        skip("No filename available")
        return

    test_yaml = b"""
- name: Duplicate Test
  hosts: allHosts
  tasks:
    - name: dup
      debug: msg="dup"
"""
    files = {
        "file": (CREATED_FILENAMES[0], test_yaml, "application/x-yaml")
    }
    data = {
        "name": "Duplicate Playbook Test",
        "description": "Should be rejected",
        "subnet_scope": "allHosts",
        "tags": "test",
        "target_devices": "allHosts",
        "severity": "low",
    }

    status, resp = http_request("POST", "/playbooks/add", data=data, files=files)

    if status == 409:
        ok(f"Duplicate filename correctly rejected with 409: {resp.get('detail', '')}")
    else:
        fail(f"Expected 409 for duplicate, got {status}: {resp.get('detail', resp)}")


def test_invalid_file_extension():
    info("\n--- Test: Edge Case - Invalid File Extension ---")
    test_txt = b"this is not a yaml file"
    files = {
        "file": ("test_invalid.txt", test_txt, "text/plain")
    }
    data = {
        "name": "Invalid File Test",
        "description": "Should be rejected",
        "subnet_scope": "allHosts",
        "tags": "test",
        "target_devices": "allHosts",
        "severity": "low",
    }

    status, resp = http_request("POST", "/playbooks/add", data=data, files=files)

    if status == 400:
        ok(f"Invalid file extension correctly rejected with 400: {resp.get('detail', '')}")
    else:
        fail(f"Expected 400 for invalid extension, got {status}: {resp.get('detail', resp)}")


def test_missing_required_fields():
    info("\n--- Test: Edge Case - Missing Required Fields ---")
    data = {
        "description": "Missing name"
    }

    status, resp = http_request("POST", "/playbooks/add", data=data)

    if status == 400 or status == 422:
        ok(f"Missing fields correctly rejected with {status}")
    else:
        fail(f"Expected 400/422 for missing fields, got {status}: {resp}")


def test_not_found_update():
    info("\n--- Test: Edge Case - Update Non-existent Playbook ---")
    fake_id = "000000000000000000000000"
    status, resp = http_request("PUT", f"/playbooks/{fake_id}", data={"description": "should fail"})

    if status == 404:
        ok(f"Non-existent playbook update correctly rejected with 404")
    else:
        fail(f"Expected 404 for non-existent ID, got {status}: {resp.get('detail', resp)}")


def test_not_found_status_update():
    info("\n--- Test: Edge Case - Status Update Non-existent Playbook ---")
    fake_id = "000000000000000000000000"
    status, resp = http_request("PATCH", f"/playbooks/{fake_id}/status", data={"pipeline_status": "Verified"})

    if status == 404:
        ok(f"Non-existent playbook status update correctly rejected with 404")
    else:
        fail(f"Expected 404, got {status}: {resp.get('detail', resp)}")


def cleanup():
    info("\n--- Cleanup ---")
    for pb_id in CREATED_IDS:
        status, resp = http_request("DELETE", f"/playbooks/delete/{pb_id}")
        if status == 200:
            ok(f"Cleaned up playbook {pb_id}")
        else:
            fail(f"Cleanup failed for {pb_id}: {resp.get('detail', resp)}")

    for filename in CREATED_FILENAMES:
        filepath = os.path.join(os.path.dirname(__file__), "..", "playbooks", filename)
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
                ok(f"Removed test file {filename}")
            except OSError as e:
                fail(f"Failed to remove test file {filename}: {e}")


def main():
    global tests_passed, tests_failed, tests_skipped, API_BASE

    parser = argparse.ArgumentParser(description="Test Playbook Management module")
    parser.add_argument("--api-base", default=None, help="API base URL")
    parser.add_argument("--no-cleanup", action="store_true", help="Skip cleanup after tests")
    args = parser.parse_args()

    if args.api_base:
        API_BASE = args.api_base

    print("=" * 60)
    print(f" Playbook Management Test Suite")
    print(f" API Base: {API_BASE}")
    print("=" * 60)

    if not test_health():
        print(f"\n{FAIL} Backend not reachable. Aborting tests.")
        sys.exit(1)

    test_create_playbook()
    test_edit_playbook()
    test_pipeline_status_update()
    test_duplicate_playbook()
    test_invalid_file_extension()
    test_missing_required_fields()
    test_not_found_update()
    test_not_found_status_update()

    if not args.no_cleanup:
        cleanup()

    print("=" * 60)
    print(f" Results: {tests_passed} passed, {tests_failed} failed, {tests_skipped} skipped")
    print("=" * 60)

    if tests_failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
