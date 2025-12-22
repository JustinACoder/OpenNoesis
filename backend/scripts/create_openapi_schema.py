import json
import yaml
import sys
import argparse
import requests
import subprocess
import time
from urllib.parse import urlparse

def load_openapi_file(source):
    """Load an OpenAPI spec from a file path or URL, auto-detecting JSON/YAML."""
    if is_url(source):
        response = requests.get(source)
        response.raise_for_status()
        content_type = response.headers.get("Content-Type", "").lower()
        content = response.text
    else:
        with open(source, "r", encoding="utf-8") as f:
            content = f.read()
        content_type = mimetype_from_path(source)

    if "json" in content_type:
        return json.loads(content)
    elif "yaml" in content_type or "yml" in content_type or source.endswith(('.yaml', '.yml')):
        return yaml.safe_load(content)
    else:
        raise ValueError(f"Unsupported format for: {source}")

def is_url(path):
    try:
        result = urlparse(path)
        return result.scheme in ("http", "https")
    except Exception:
        return False

def mimetype_from_path(path):
    if path.endswith(".json"):
        return "application/json"
    elif path.endswith((".yaml", ".yml")):
        return "application/x-yaml"
    return ""

def merge_openapi_schemas(schema1, schema2):
    def merge_dicts(d1, d2):
        result = d1.copy()
        for key, value in d2.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = merge_dicts(result[key], value)
            elif key in result and isinstance(result[key], list) and isinstance(value, list):
                result[key] = result[key] + value
            else:
                result[key] = value
        return result

    return {
        "openapi": schema1.get("openapi", schema2.get("openapi", "3.0.0")),
        "info": schema1.get("info", schema2.get("info")),
        "servers": schema1.get("servers", []) + schema2.get("servers", []),
        "paths": merge_dicts(schema1.get("paths", {}), schema2.get("paths", {})),
        "components": merge_dicts(schema1.get("components", {}), schema2.get("components", {})),
        "tags": schema1.get("tags", []) + schema2.get("tags", []),
        "security": schema1.get("security", []) + schema2.get("security", []),
    }

def start_django_server():
    """Start Django server with stdout/stderr forwarded to the main process."""
    return subprocess.Popen(
        ["python", "manage.py", "runserver"],
        stdout=sys.stdout,
        stderr=sys.stderr
    )

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Merge two OpenAPI schemas into one.")
    parser.add_argument("schema1", help="Path or URL to the first OpenAPI schema (JSON or YAML)")
    parser.add_argument("schema2", help="Path or URL to the second OpenAPI schema (JSON or YAML)")
    parser.add_argument("-o", "--output", default="combined_openapi.json", help="Output file path (default: combined_openapi.json)")
    parser.add_argument("--runserver", action="store_true", help="Start the Django server before fetching OpenAPI schemas")

    args = parser.parse_args()

    server_process = None
    try:
        if args.runserver:
            print("🚀 Starting Django server...")
            server_process = start_django_server()
            time.sleep(10)  # Optional: wait for startup; consider improving with health checks

        schema1 = load_openapi_file(args.schema1)
        schema2 = load_openapi_file(args.schema2)
        merged_schema = merge_openapi_schemas(schema1, schema2)

        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(merged_schema, f, indent=2)

        print(f"\n✅ Successfully merged schemas into {args.output}")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)
    finally:
        if server_process:
            print("🛑 Stopping Django server...")
            server_process.terminate()
            server_process.wait()
