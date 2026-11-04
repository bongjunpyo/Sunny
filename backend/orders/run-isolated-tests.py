#!/usr/bin/env python3
"""Disposable PG 17 only. Never connect to the user's sunny-dev cluster."""
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend/postgres"))
import manage as db


def main():
    private = Path(tempfile.mkdtemp(prefix="sunny-order-tests-"))
    env_file = ROOT / "backend/.env.local"
    if env_file.exists():
        raise RuntimeError("Use a separate checkout without backend/.env.local; existing settings preserved")
    name = "sunny-order-test-" + secrets.token_hex(6)
    with socket.socket() as port_socket:
        port_socket.bind(("127.0.0.1", 0))
        port = port_socket.getsockname()[1]
    if port == 5434:
        raise RuntimeError("Original development DB port refused")
    passwords = {role: secrets.token_urlsafe(32) for role in ("admin", "app", "auth")}
    docker_env = private / "postgres.env"
    docker_env.write_text("\n".join(["POSTGRES_DB=sunny", "POSTGRES_USER=sunny_admin",
        "POSTGRES_PASSWORD=" + passwords["admin"], "SUNNY_PG_APP_PASSWORD=" + passwords["app"],
        "SUNNY_PG_AUTH_PASSWORD=" + passwords["auth"],
        "POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256 --auth-local=trust"]) + "\n")
    docker_env.chmod(0o600)
    created = False
    wrote_env = False
    try:
        subprocess.run(["docker", "run", "--detach", "--rm", "--name", name,
            "--label", "sunny.orders-test=" + name, "--tmpfs", "/var/lib/postgresql/data:rw",
            "-p", f"127.0.0.1:{port}:5432", "--env-file", str(docker_env),
            "postgres:17-bookworm"], check=True, stdout=subprocess.DEVNULL)
        created = True
        for _ in range(120):
            ready = subprocess.run(["docker", "exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "sunny_admin", "-d", "sunny"],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if ready.returncode == 0:
                break
            time.sleep(0.25)
        else:
            raise RuntimeError("Isolated database did not become ready")
        subprocess.run(["docker", "exec", "-i", name, "sh"], input=(ROOT / "backend/postgres/init/001-roles.sh").read_bytes(),
                       stdout=subprocess.DEVNULL, check=True)
        migrations=db.read_migrations()
        def sql(script):
            result=subprocess.run(["docker","exec","-i",name,"psql","-X","-qAt","-v","ON_ERROR_STOP=1","-U","sunny_admin","-d","sunny"],input=script.encode(),stdout=subprocess.PIPE,stderr=subprocess.PIPE)
            if result.returncode:raise RuntimeError("Isolated migration failed: "+result.stderr.decode()[-2000:])
            return result.stdout.decode()
        if [m.version for m in migrations] != [1,2,3,4]:
            raise RuntimeError("Expected foundation/auth/photos and one initial cart migration")
        script=db.migration_script(migrations)
        for attempt in range(2):
            output=sql(script)
            print("Migration apply/re-run",attempt+1,":","; ".join(l for l in output.splitlines() if l.startswith(("applied ","skipped "))),flush=True)
        print("PASS: fresh 0001-0004 schema and checksum-preserving re-run.",flush=True)
        settings = "\n".join([f"SUNNY_PG_PORT={port}"] + [f"SUNNY_PG_{role.upper()}_PASSWORD={value}" for role,value in passwords.items()]) + "\n"
        with env_file.open("x") as handle:
            wrote_env = True
            env_file.chmod(0o600)
            handle.write(settings)
        config = private / "config.json"
        config.write_text(json.dumps({"container":name,"port":port,"privateDirectory":str(private),
            **{role:f"postgresql://sunny_{role}:{value}@127.0.0.1:{port}/sunny" for role,value in passwords.items()}}))
        config.chmod(0o600)
        node_directory = Path(os.environ.get("SUNNY_NODE_BIN", "/Users/a0/.nvm/versions/node/v24.14.0/bin"))
        env = {**os.environ, "PATH":str(node_directory)+os.pathsep+os.environ["PATH"], "SUNNY_ORDER_TEST_CONFIG":str(config)}
        commands=[] if "--ui-only" in sys.argv else [["npm","run","test:orders"],["npm","run","test:auth"],["npm","run","test:uploads"]]
        commands.append(["node","../backend/orders/tests/http-flow.mjs"])
        for command in commands:
            subprocess.run(command,cwd=ROOT/"frontend",env=env,check=True)
        print("PASS: isolated PG migration and live HTTP checks"+(" (UI-only mode)." if "--ui-only" in sys.argv else "; order/auth/upload regression passed."),flush=True)
    finally:
        if wrote_env and env_file.exists() and env_file.read_text()==settings:
            env_file.unlink()
        if created:
            label = subprocess.check_output(["docker","inspect","--format",'{{ index .Config.Labels "sunny.orders-test" }}',name],text=True).strip()
            if label == name:
                subprocess.run(["docker","stop","--time","1",name],check=True,stdout=subprocess.DEVNULL)
        # Only fresh secrets owned by this test; no repository/user backup folders.
        shutil.rmtree(private)


if __name__ == "__main__":
    main()
