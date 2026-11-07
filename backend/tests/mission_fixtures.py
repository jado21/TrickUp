from copy import deepcopy
import json

from app.schemas.mission_internal import MissionDraft
from app.schemas.missions import MODALITIES

SOURCE = """Una función relaciona cada entrada con una salida.
El dominio es el conjunto de entradas. El rango es el conjunto de salidas.
Para estudiar una función, primero identifica el dominio.
Después calcula las imágenes. Finalmente describe el rango."""


def request_payload(**updates):
    result = dict(course_name="Matemática", unit_title="Funciones", level_id="level-1", level_title="Dominio y rango",
                  objectives=["Identificar dominio y rango"], source_text=SOURCE, activity_count=5)
    result.update(updates)
    return result


def activity_data(mode):
    data = dict(modality=mode, prompt="Relaciona los conceptos con el material.", objective_index=0,
                explanation="El dominio es el conjunto de entradas.", evidence=[SOURCE], choices=None,
                correct_choice_index=None, accepted_answers=None, pairs=None, ordered_steps=None, tiles=None)
    if mode == "MULTIPLE_CHOICE":
        data.update(prompt="¿Qué es el dominio?", choices=["el conjunto de entradas", "el conjunto de salidas", "el promedio", "un número negativo"], correct_choice_index=0)
    elif mode == "FILL_BLANK":
        data.update(prompt="El dominio de una función es ___.", accepted_answers=["el conjunto de entradas"])
    elif mode == "MEMORY_MATCH":
        data.update(pairs=[{"concept": "dominio", "definition": "el conjunto de entradas"}, {"concept": "rango", "definition": "el conjunto de salidas"}])
    elif mode == "ORDER_SEQUENCE":
        data.update(prompt="Ordena los pasos según el material.", ordered_steps=["identifica el dominio", "calcula las imágenes", "describe el rango"], explanation="Para estudiar una función, primero identifica el dominio.")
    else:
        data.update(prompt="Selecciona los conjuntos mencionados en el material.", tiles=[{"text": "el conjunto de entradas", "correct": True}, {"text": "el conjunto de salidas", "correct": True}, {"text": "el promedio numérico", "correct": False}])
    return data


def mock_generation(text, schema, **kwargs):
    data = json.loads(text)
    modes = data["modalities"]
    activities = []
    for index in range(data["activity_count"]):
        activity = deepcopy(activity_data(modes[index % len(modes)]))
        activity["objective_index"] = index % len(data["objectives"])
        activities.append(activity)
    return MissionDraft(sufficient_context=True, activities=activities)
