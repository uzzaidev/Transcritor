from __future__ import annotations

import argparse
import json
import logging
import sys
import time

from ata_agent.config import Settings
from ata_agent.logging_utils import configure_logging, get_logger
from ata_agent.orchestrator import run_once

configure_logging(logging.INFO)
log = get_logger("ata_agent", "cli")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Agente de atas (e-mail -> Gemini -> e-mail)"
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    run_once_parser = sub.add_parser("run-once", help="Processa e-mails pendentes uma vez")
    run_once_parser.add_argument("--json", action="store_true", help="Imprime estado resumido em JSON")

    daemon_parser = sub.add_parser("daemon", help="Repete run-once em intervalo fixo")
    daemon_parser.add_argument(
        "--interval",
        type=int,
        default=120,
        help="Segundos entre execucoes (default: 120)",
    )

    args = parser.parse_args()
    settings = Settings.load()

    if args.cmd == "run-once":
        try:
            states = run_once(settings)
        except Exception as exc:
            log.exception("Erro no run-once: %s", exc)
            sys.exit(1)

        if args.json:
            payload = [
                {
                    "status_validacao": state.status_validacao,
                    "delivery_success": state.delivery_success,
                    "delivery_error": state.delivery_error,
                    "arquivo_fonte": state.arquivo_fonte,
                    "correlation_id": state.meta.get("correlation_id"),
                }
                for state in states
            ]
            print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    if args.cmd == "daemon":
        while True:
            try:
                run_once(settings)
            except Exception as exc:
                log.exception("Erro no ciclo do daemon: %s", exc)
            log.info("A dormir %s s...", args.interval)
            time.sleep(args.interval)


if __name__ == "__main__":
    main()
