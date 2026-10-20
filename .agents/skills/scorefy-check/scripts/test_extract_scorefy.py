"""Pruebas de identidad, fechas y fallos que deben bloquear una revisión."""

import json
import unittest

from extract_scorefy import extract


def page(matches, empty=False):
    stream = "1:" + json.dumps({"items": [{"match": m} for m in matches]})
    # Next.js puede partir un objeto JSON entre dos bloques.
    chunks = [stream[:37], stream[37:]]
    scripts = "".join(f'<script>self.__next_f.push([1,{json.dumps(c)}])</script>' for c in chunks)
    return scripts + ("No hay partidos para mostrar." if empty else "")


def match(**overrides):
    return {
        "id": "partido-1", "categoryName": "Primera", "round": 1,
        "isPlaceholder": False, "dateOriginal": "$D2026-10-21T00:00:00.000Z",
        "teams": [{"id": "equipo-a", "name": "A", "goals": "2"},
                  {"id": "equipo-b", "name": "B", "goals": "1"}],
        **overrides,
    }


class ExtractionTests(unittest.TestCase):
    def test_midnight_utc_is_previous_day_in_mendoza(self):
        result = extract(page([match()]))
        self.assertEqual(result["partidos"][0]["fecha_local"], "2026-10-20")
        self.assertEqual(result["partidos"][0]["hora_local"], "21:00")

    def test_preserves_orientation_and_does_not_invent_sets(self):
        result = extract(page([match()]))
        self.assertEqual([t["id"] for t in result["partidos"][0]["equipos"]], ["equipo-a", "equipo-b"])
        self.assertEqual(result["partidos"][0]["original"]["teams"][0]["goals"], "2")
        self.assertFalse(result["sets_verificados"])

    def test_duplicate_identity_requires_consistent_payload(self):
        self.assertEqual(len(extract(page([match(), match()]))["partidos"]), 1)
        with self.assertRaises(ValueError):
            extract(page([match(), match(round=2)]))

    def test_empty_page_must_be_explicit(self):
        self.assertTrue(extract(page([], empty=True))["vacio_explicito"])
        with self.assertRaises(ValueError):
            extract(page([]))
        with self.assertRaises(ValueError):
            extract("<html>Error de acceso</html>")

    def test_naive_date_is_not_silently_converted(self):
        with self.assertRaises(ValueError):
            extract(page([match(dateOriginal="2026-10-20T21:00:00")]))

    def test_placeholder_without_date_is_retained_for_classification(self):
        result = extract(page([match(dateOriginal=None, isPlaceholder=True)]))
        self.assertIsNone(result["partidos"][0]["fecha_local"])
        self.assertTrue(result["partidos"][0]["es_placeholder"])


if __name__ == "__main__":
    unittest.main()
