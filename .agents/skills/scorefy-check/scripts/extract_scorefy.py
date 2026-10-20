"""Extrae partidos de un HTML público de Scorefy, sin modificar hojas."""

import argparse
import json
import re
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from zoneinfo import ZoneInfo


class Scripts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.active = False
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag == "script":
            self.active = True

    def handle_endtag(self, tag):
        if tag == "script":
            self.active = False

    def handle_data(self, data):
        if self.active:
            self.parts.append(data)


def extract(html, timezone="America/Argentina/Mendoza"):
    """Conserva marcadores originales; no interpreta ni inventa sets."""
    parser = Scripts()
    parser.feed(html)
    script = "".join(parser.parts)
    chunks = re.findall(
        r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)', script
    )
    if not chunks:
        raise ValueError("No se encontró el payload de Scorefy; revisa la página.")
    stream = "".join(json.loads(chunk) for chunk in chunks)
    found = {}
    decoder = json.JSONDecoder()
    zone = ZoneInfo(timezone)
    for marker in re.finditer(r'"match"\s*:\s*', stream):
        match, _ = decoder.raw_decode(stream[marker.end():])
        if not isinstance(match, dict) or not match.get("id"):
            raise ValueError("Partido sin identidad verificable.")
        if not isinstance(match.get("teams"), list) or len(match["teams"]) != 2:
            raise ValueError("Partido sin dos equipos verificables.")
        if match["id"] in found:
            if found[match["id"]]["original"] != match:
                raise ValueError("Hay versiones distintas del mismo partido.")
            continue
        timestamp = match.get("dateOriginal")
        local = None
        if timestamp:
            parsed = datetime.fromisoformat(timestamp.removeprefix("$D").replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                raise ValueError("La fecha de origen no incluye zona horaria.")
            local = parsed.astimezone(zone)
        found[match["id"]] = {
            "id_origen": match["id"],
            "categoria": match.get("categoryName"),
            "ronda": match.get("round"),
            "es_placeholder": match.get("isPlaceholder"),
            "fecha_local": local.strftime("%Y-%m-%d") if local else None,
            "hora_local": local.strftime("%H:%M") if local else None,
            "equipos": [
                {"id": t.get("id"), "nombre": t.get("name"), "marcador_sin_interpretar": t.get("goals")}
                for t in match["teams"]
            ],
            "original": match,
        }
    empty = "No hay partidos para mostrar" in html
    if not found and not empty:
        raise ValueError("No se extrajeron partidos ni se verificó una página vacía.")
    return {
        "zona_horaria": timezone,
        "vacio_explicito": not found and empty,
        "partidos": list(found.values()),
        "sets_verificados": False,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html", type=Path, required=True)
    parser.add_argument("--salida", type=Path, required=True)
    parser.add_argument("--zona-horaria", default="America/Argentina/Mendoza")
    args = parser.parse_args()
    try:
        result = extract(args.html.read_text(encoding="utf-8"), args.zona_horaria)
    except (ValueError, OSError, KeyError, TypeError) as error:
        parser.exit(1, f"No se pudo verificar la extracción: {error}\n")
    args.salida.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Partidos extraídos: {len(result['partidos'])}. Sets sin interpretar.")


if __name__ == "__main__":
    main()
