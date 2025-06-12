from enum import IntEnum


class VoteDirectionEnum(IntEnum):
    DOWN = -1
    UNSET = 0
    UP = 1


class StanceDirectionEnum(IntEnum):
    FOR = 1
    UNSET = 0
    AGAINST = -1