"""Almacén temporal por proceso, con TTL y presupuestos acotados. Sin persistencia."""

from collections import OrderedDict
from threading import RLock
import time

from app.schemas.mission_internal import MissionEntry
from app.services.errors import ServiceError


class MissionStore:
    def __init__(self, *, ttl=1800, max_missions=128, max_bytes=8 * 1024 * 1024, clock=time.monotonic):
        self.ttl = ttl
        self.max_missions = max_missions
        self.max_bytes = max_bytes
        self.clock = clock
        self.lock = RLock()
        self._entries = {}
        self._expired = OrderedDict()
        self._bytes = 0

    @staticmethod
    def _size(entry):
        return len(entry.model_dump_json().encode("utf-8"))

    def _purge(self):
        for key, (deadline, _, size) in list(self._entries.items()):
            if self.clock() >= deadline:
                del self._entries[key]
                self._bytes -= size
                self._expired[key] = True
        while len(self._expired) > 256:
            self._expired.popitem(last=False)

    def _get(self, key):
        self._purge()
        if key not in self._entries:
            if key in self._expired:
                raise ServiceError(410, "MISSION_EXPIRED", "La misión expiró. Genera otra misión.")
            raise ServiceError(404, "MISSION_NOT_FOUND", "Misión no encontrada.")
        return self._entries[key]

    def read(self, key):
        with self.lock:
            return self._get(key)[1].model_copy(deep=True)

    def mutate(self, key, operation):
        with self.lock:
            deadline, original, old_size = self._get(key)
            updated = original.model_copy(deep=True)
            result = operation(updated)
            size = self._size(updated)
            if self._bytes - old_size + size > self.max_bytes:
                raise ServiceError(503, "MISSION_CAPACITY", "Almacén temporal lleno. Intenta más tarde.")
            self._entries[key] = (deadline, updated, size)
            self._bytes += size - old_size
            return result

    def insert(self, entry: MissionEntry, previous_id=None):
        with self.lock:
            self._purge()
            key = entry.public.mission_id
            if key in self._entries:
                raise ServiceError(500, "INTERNAL_ERROR", "No se pudo asignar un identificador único.")
            size = self._size(entry)
            parent_delta = 0
            if previous_id:
                deadline, parent, parent_size = self._get(previous_id)
                if not parent.continuation_reserved or parent.continued_to:
                    raise ServiceError(409, "CONTINUATION_UNAVAILABLE", "La misión ya tiene continuación.")
                parent = parent.model_copy(deep=True)
                parent.continuation_reserved = False
                parent.continued_to = key
                new_parent_size = self._size(parent)
                parent_delta = new_parent_size - parent_size
            if len(self._entries) >= self.max_missions or self._bytes + size + parent_delta > self.max_bytes:
                raise ServiceError(503, "MISSION_CAPACITY", "Almacén temporal lleno. Intenta más tarde.")
            self._entries[key] = (self.clock() + self.ttl, entry.model_copy(deep=True), size)
            if previous_id:
                self._entries[previous_id] = (deadline, parent, new_parent_size)
            self._bytes += size + parent_delta

    def check_capacity(self):
        with self.lock:
            self._purge()
            if len(self._entries) >= self.max_missions or self._bytes >= self.max_bytes:
                raise ServiceError(503, "MISSION_CAPACITY", "Almacén temporal lleno. Intenta más tarde.")
