import asyncio
import json

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

import app.services.topology_service as topology_service
from app.services.execution_service import get_podman_command
from app.services.notification_service import publish_notification

router = APIRouter(prefix="/api/topology", tags=["Topology"])


@router.get("/graph")
async def get_topology_graph():
    """Return the current topology graph (nodes + edges)"""
    try:
        graph = await topology_service.get_topology_graph()
        if graph is None:
            return {
                "status": "success",
                "nodes": [],
                "edges": [],
                "last_refreshed": None,
            }
        return {"status": "success", **graph}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.post("/refresh")
async def refresh_topology():
    """Run CDP collection playbook, parse output, rebuild topology graph"""
    try:
        result = await topology_service.refresh_topology()
        graph = await topology_service.get_topology_graph()
        node_count = len(graph.get("nodes", [])) if graph else result.get("nodes", 0)
        edge_count = len(graph.get("edges", [])) if graph else result.get("edges", 0)
        await publish_notification(
            title="Topology refresh complete",
            message=f"Discovered {node_count} devices and {edge_count} links.",
            category="topology",
            severity="success",
            link="/topology",
        )
        return {"status": "success", "result": result, "graph": graph}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        )


@router.get("/refresh-stream")
async def refresh_topology_stream():
    """Run CDP collection and stream progress via SSE"""
    return StreamingResponse(
        _refresh_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


async def _refresh_generator():
    try:
        yield _sse("status", "Starting CDP collection playbook...")

        cmd = get_podman_command("collect_cdp_neighbors.yml")
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )

        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            yield _sse("playbook_output", line.decode().rstrip())

        await proc.wait()
        yield _sse("status", f"Playbook finished (exit code: {proc.returncode})")

        yield _sse("status", "Parsing CDP output...")
        neighbors = topology_service.parse_all_cdp_files()
        yield _sse("status", f"Parsed {len(neighbors)} neighbor records")

        yield _sse("status", "Building topology graph...")
        graph = topology_service.build_graph(neighbors)
        yield _sse(
            "status",
            f"Graph built: {len(graph['nodes'])} nodes, {len(graph['edges'])} edges",
        )

        yield _sse("status", "Storing to database...")
        await topology_service.store_neighbors(neighbors)
        await topology_service.store_graph(graph)

        await publish_notification(
            title="Topology refresh complete",
            message=f"Discovered {len(graph['nodes'])} devices and {len(graph['edges'])} links.",
            category="topology",
            severity="success",
            link="/topology",
        )

        yield _sse("complete", json.dumps(graph))

    except Exception as e:
        yield _sse("error", str(e))


def _sse(event_type: str, data: str) -> str:
    return f"data: {json.dumps({'type': event_type, 'data': data})}\n\n"
