"""Adaptación de JSON Schema para Gemini sin debilitar Pydantic localmente."""

from typing import Any

from pydantic import BaseModel


def generation_schema(model: type[BaseModel], *, omit_array_bounds: bool = True) -> dict[str, Any]:
    # minLength/maxLength no figuran en el subconjunto de responseJsonSchema.
    # Sus límites siguen aplicándose al validar la respuesta con el modelo original.
    # Los bounds de arrays anidados también pueden superar el presupuesto de
    # complejidad del proveedor. La variante acotada se conserva para comparar
    # solicitudes sin red; ambos casos usan el mismo Pydantic para validar.
    # No tocar nombres de propiedades o definiciones que coincidan con keywords.
    omitted = {"minLength", "maxLength"}
    if omit_array_bounds:
        omitted.update(("minItems", "maxItems"))
    def adapt(node):
        if isinstance(node, list):
            return [adapt(value) for value in node]
        if not isinstance(node, dict):
            return node
        return {
            key: ({name: adapt(child) for name, child in value.items()}
                  if key in ("properties", "$defs") else adapt(value))
            for key, value in node.items()
            if key not in omitted
        }

    return adapt(model.model_json_schema())
