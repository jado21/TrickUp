"""Evaluación y adaptación puramente deterministas: no utiliza Gemini."""

import hashlib
import json
import unicodedata

from app.schemas.missions import Adaptation, FeedbackResponse, Progress
from app.schemas.mission_internal import Outcome
from app.services.errors import ServiceError

DIFFICULTIES = ["beginner", "intermediate", "advanced"]
BASE_XP = {"MULTIPLE_CHOICE": 10, "FILL_BLANK": 12, "MEMORY_MATCH": 16, "ORDER_SEQUENCE": 14, "FALLING_TILES": 12}


def normalize_answer(text):
    # Se conservan tildes, signos y símbolos matemáticos. Sin coincidencia difusa.
    return " ".join(unicodedata.normalize("NFC", text).casefold().split())


def canonical(answer):
    body = answer.model_dump()
    mode = answer.modality
    if mode == "FILL_BLANK":
        body["text"] = normalize_answer(answer.text)
    elif mode == "MEMORY_MATCH":
        body["pairs"] = sorted(body["pairs"], key=lambda pair: (pair["left_id"], pair["right_id"]))
    elif mode == "FALLING_TILES":
        body["tile_ids"] = sorted(body["tile_ids"])
    return hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest()


def adaptation(entry, progress):
    history = entry.outcomes
    index = DIFFICULTIES.index(entry.public.difficulty)
    tail = [outcome.correct for outcome in history]
    action, difficulty, review = "continue", index, None
    if len(tail) >= 3 and tail[-3:] == [True, True, True]:
        difficulty = min(2, index + 1)
    reason = "Continúa practicando el objetivo actual."
    if progress.can_advance:
        action, reason = "advance", "Dominio observado: puedes avanzar al siguiente nivel."
    elif len(tail) >= 2 and tail[-2:] == [False, False]:
        action, difficulty, review = "reinforce", max(0, index - 1), history[-1].objective_index
        reason = "Dos errores consecutivos: repasa el objetivo y solicita refuerzo."
    elif tail and not tail[-1]:
        action, review = "review", history[-1].objective_index
        reason = "Revisa el objetivo de esta actividad antes de continuar."
    elif len(tail) >= 3 and tail[-3:] == [True, True, True]:
        action, difficulty = "increase_difficulty", min(2, index + 1)
        reason = "Tres aciertos consecutivos: la próxima misión puede aumentar la dificultad."
    return Adaptation(action=action, next_difficulty=DIFFICULTIES[difficulty], review_objective_index=review, reason=reason)


def valid_ids(ids, allowed, *, complete=False):
    if len(ids) != len(set(ids)) or not set(ids).issubset(allowed) or (complete and set(ids) != allowed):
        raise ServiceError(422, "INVALID_ANSWER", "Identificadores duplicados, desconocidos o incompletos.")


def evaluate(activity, private, answer):
    if activity.modality != answer.modality:
        raise ServiceError(422, "INVALID_ANSWER", "La modalidad de respuesta no coincide con la actividad.")
    mode = activity.modality
    if mode == "MULTIPLE_CHOICE":
        valid_ids([answer.option_id], {item.id for item in activity.options})
        return answer.option_id == private.solution.option_id
    if mode == "FILL_BLANK":
        return normalize_answer(answer.text) in {normalize_answer(text) for text in private.accepted_answers}
    if mode == "MEMORY_MATCH":
        valid_ids([p.left_id for p in answer.pairs], {card.id for card in activity.left_cards}, complete=True)
        valid_ids([p.right_id for p in answer.pairs], {card.id for card in activity.right_cards}, complete=True)
        return {(p.left_id, p.right_id) for p in answer.pairs} == {(p.left_id, p.right_id) for p in private.solution.pairs}
    if mode == "ORDER_SEQUENCE":
        valid_ids(answer.item_ids, {item.id for item in activity.items}, complete=True)
        return answer.item_ids == private.solution.item_ids
    valid_ids(answer.tile_ids, {item.id for item in activity.tiles})
    return set(answer.tile_ids) == set(private.solution.tile_ids)


def answer_activity(entry, request):
    activity = next((item for item in entry.public.activities if item.id == request.activity_id), None)
    if activity is None:
        raise ServiceError(404, "ACTIVITY_NOT_FOUND", "Actividad no encontrada en esta misión.")
    private = entry.private[activity.id]
    correct = evaluate(activity, private, request.answer)
    fingerprint = canonical(request.answer)
    if activity.id in entry.feedback:
        if fingerprint != entry.submissions[activity.id]:
            raise ServiceError(409, "ACTIVITY_ALREADY_ANSWERED", "La actividad ya fue resuelta; genera refuerzo para otro intento.")
        return entry.feedback[activity.id].model_copy(update={"xp_awarded": 0, "replayed": True, "progress": entry.public.progress.model_copy(deep=True)})
    if entry.public.progress.next_activity_id != activity.id:
        raise ServiceError(409, "ACTIVITY_OUT_OF_ORDER", "Responde primero la actividad pendiente.")
    xp = activity.max_xp if correct else 0
    entry.outcomes = (entry.outcomes + [Outcome(objective_index=activity.objective_index, correct=correct)])[-100:]
    answered = len(entry.feedback) + 1
    complete = answered == len(entry.public.activities)
    history = entry.outcomes
    covered = {outcome.objective_index for outcome in history if outcome.correct}
    mastery = complete and len(history) >= 3 and sum(item.correct for item in history) / len(history) >= 0.8 and covered == set(range(entry.objective_count))
    progress = Progress(answered=answered, correct=entry.public.progress.correct + int(correct), total=len(entry.public.activities),
                        xp=entry.public.progress.xp + xp, completed=complete, can_advance=mastery,
                        next_activity_id=None if complete else entry.public.activities[answered].id)
    entry.public.progress = progress
    positive = {"friendly": "¡Buen trabajo!", "competitive": "¡Punto ganado!", "humorous": "¡Tu cerebro acaba de subir de marcha!"}
    feedback = positive[entry.tone] if correct else "La respuesta no coincide con la solución sustentada. Revisa la explicación y practica de nuevo."
    result = FeedbackResponse(mission_id=entry.public.mission_id, activity_id=activity.id, correct=correct, xp_awarded=xp,
                              feedback=feedback, explanation=private.explanation, solution=private.solution,
                              accepted_answers=private.accepted_answers, progress=progress.model_copy(deep=True), adaptation=adaptation(entry, progress))
    entry.feedback[activity.id] = result
    entry.submissions[activity.id] = fingerprint
    return result.model_copy(deep=True)
