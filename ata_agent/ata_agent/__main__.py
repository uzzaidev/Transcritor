from __future__ import annotations

import argparse
import json
import logging
import sys
import time

from ata_agent.config import Settings
from ata_agent.orchestrator import run_once

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
log = logging.getLogger("ata_agent")


def main() -> None:
    p = argparse.ArgumentParser(description="Agente de atas (e-mail → Gemini → e-mail)")
    sub = p.add_subparsers(dest="cmd", required=True)

    s1 = sub.add_parser("run-once", help="Processa e-mails pendentes uma vez")
    s1.add_argument("--json", action="store_true", help="Imprime estado resumido em JSON")

    s2 = sub.add_parser("daemon", help="Repete run-once em intervalo fixo")
    s2.add_argument(
        "--interval",
        type=int,
        default=120,
        help="Segundos entre execuções (default: 120)",
    )

    args = p.parse_args()
    settings = Settings.load()
    if args.cmd == "run-once":
        try:
            states = run_once(settings)
        except Exception as e:
            log.exception("Erro: %s", e)
            sys.exit(1)
        if args.json:
            payload = [
                {
                    "status_validacao": s.status_validacao,
                    "delivery_success": s.delivery_success,
                    "delivery_error": s.delivery_error,
                    "arquivo_fonte": s.arquivo_fonte,
                }
                for s in states
            ]
            print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    if args.cmd == "daemon":
        while True:
            try:
                run_once(settings)
            except Exception as e:
                log.exception("Erro no ciclo: %s", e)
            log.info("A dormir %s s...", args.interval)
            time.sleep(args.interval)


if __name__ == "__main__":
    main()
