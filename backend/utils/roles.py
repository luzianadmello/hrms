MANAGER = "MANAGER"


def role_label(role_name: str):
    return (role_name or "").strip().replace("_", " ").title()