MANAGER = "MANAGER"


CAN_CREATE = {
    "ADMIN": {
        "HR",
        "MANAGER",
        "EMPLOYEE",
    },
    "HR": {
        "MANAGER",
        "EMPLOYEE",
    },
    "MANAGER": {
        "EMPLOYEE",
    },
}


def assignable_role_names(creator_role_name: str):
    return CAN_CREATE.get(
        (creator_role_name or "").strip().upper(),
        set()
    )


def role_label(role_name: str):
    return (
        (role_name or "")
        .strip()
        .replace("_", " ")
        .title()
    )