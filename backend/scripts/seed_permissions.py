from sqlalchemy.orm import Session

from database import engine
from models.permission import Permission


permissions = [
    # AUTHENTICATION
    {"permission_name": "user.login", "module": "Authentication", "action": "LOGIN", "description": "Allows a user to log into the HRMS"},
    {"permission_name": "user.logout", "module": "Authentication", "action": "LOGOUT", "description": "Allows a user to log out of the HRMS"},
    {"permission_name": "user.change_password", "module": "Authentication", "action": "CHANGE_PASSWORD", "description": "Allows a user to change their own password"},
    {"permission_name": "user.reset_password", "module": "Authentication", "action": "RESET_PASSWORD", "description": "Allows an authorized user to reset another user's password"},
    {"permission_name": "user.view", "module": "User Management", "action": "VIEW", "description": "Allows viewing user account details"},
    {"permission_name": "user.create", "module": "User Management", "action": "CREATE", "description": "Allows creating a user account"},
    {"permission_name": "user.update", "module": "User Management", "action": "UPDATE", "description": "Allows updating user account details"},
    {"permission_name": "user.activate", "module": "User Management", "action": "ACTIVATE", "description": "Allows activating a user account"},
    {"permission_name": "user.deactivate", "module": "User Management", "action": "DEACTIVATE", "description": "Allows deactivating a user account"},
    {"permission_name": "user.assign_role", "module": "User Management", "action": "ASSIGN_ROLE", "description": "Allows assigning a role to a user"},
    {"permission_name": "role.manage", "module": "Administration", "action": "MANAGE", "description": "Manage roles, permissions and role-creation rules"},

    # EMPLOYEE MANAGEMENT
    {"permission_name": "employee.view_all", "module": "Employee Management", "action": "VIEW_ALL", "description": "View every employee record"},
    {"permission_name": "employee.view_team", "module": "Employee Management", "action": "VIEW_TEAM", "description": "View employees who report to you"},
    {"permission_name": "employee.update", "module": "Employee Management", "action": "UPDATE", "description": "Allows updating permitted employee employment details"},
    {"permission_name": "employee.view_stats", "module": "Employee Management", "action": "VIEW_STATS", "description": "Allows viewing organization-wide employee statistics"},
    {"permission_name": "employee.update_hr", "module": "Employee Management", "action": "UPDATE_HR_PROFILE", "description": "Allows an authorized HR user to edit another HR employee profile"},

    # ORGANIZATION MANAGEMENT - DEPARTMENTS
    {"permission_name": "department.view", "module": "Organization Management", "action": "VIEW", "description": "View departments"},
    {"permission_name": "department.create", "module": "Organization Management", "action": "CREATE", "description": "Create departments"},
    {"permission_name": "department.update", "module": "Organization Management", "action": "UPDATE", "description": "Edit departments"},
    {"permission_name": "department.deactivate", "module": "Organization Management", "action": "DEACTIVATE", "description": "Activate or deactivate departments"},

    # ORGANIZATION MANAGEMENT - DESIGNATIONS
    {"permission_name": "designation.view", "module": "Organization Management", "action": "VIEW", "description": "View designations"},
    {"permission_name": "designation.create", "module": "Organization Management", "action": "CREATE", "description": "Create designations"},
    {"permission_name": "designation.update", "module": "Organization Management", "action": "UPDATE", "description": "Edit designations"},
    {"permission_name": "designation.deactivate", "module": "Organization Management", "action": "DEACTIVATE", "description": "Activate or deactivate designations"},

    # ATTENDANCE
    {"permission_name": "attendance.mark", "module": "Attendance", "action": "MARK", "description": "Check in and check out for yourself"},
    {"permission_name": "attendance.view_own", "module": "Attendance", "action": "VIEW_OWN", "description": "View your own attendance"},
    {"permission_name": "attendance.view_all", "module": "Attendance", "action": "VIEW_ALL", "description": "View the attendance report and download it"},
    {"permission_name": "attendance.correct", "module": "Attendance", "action": "CORRECT", "description": "Create, change or clear an employee's attendance day"},
    {"permission_name": "attendance.view_policy", "module": "Attendance", "action": "VIEW_POLICY", "description": "View the attendance policy"},
    {"permission_name": "attendance.update_policy", "module": "Attendance", "action": "UPDATE_POLICY", "description": "Add a new version of the attendance policy"},

    # HOLIDAYS
    {"permission_name": "holiday.view", "module": "Holidays", "action": "VIEW", "description": "View company holidays"},
    {"permission_name": "holiday.manage", "module": "Holidays", "action": "MANAGE", "description": "Create, update, delete and import company holidays"},

    # LEAVE TYPES
    {"permission_name": "leave_type.view", "module": "Leave Management", "action": "VIEW", "description": "View leave types"},
    {"permission_name": "leave_type.manage", "module": "Leave Management", "action": "MANAGE", "description": "Create, update and delete leave types"},

    # LEAVE BALANCES
    {"permission_name": "leave_balance.view_all", "module": "Leave Management", "action": "VIEW_ALL", "description": "View all employee leave balances"},
    {"permission_name": "leave_balance.view_own", "module": "Leave Management", "action": "VIEW_OWN", "description": "View own leave balances"},
    {"permission_name": "leave_balance.manage", "module": "Leave Management", "action": "MANAGE", "description": "Create and update employee leave allocations"},

    # LEAVE REQUESTS
    {"permission_name": "leave_request.view_all", "module": "Leave Management", "action": "VIEW_ALL", "description": "View leave requests across the organization"},
    {"permission_name": "leave_request.view_team", "module": "Leave Management", "action": "VIEW_TEAM", "description": "View leave requests submitted by direct reports"},
    {"permission_name": "leave_request.view_own", "module": "Leave Management", "action": "VIEW_OWN", "description": "View your own leave requests"},
    {"permission_name": "leave_request.apply", "module": "Leave Management", "action": "APPLY", "description": "Submit a leave request for yourself"},
    {"permission_name": "leave_request.review", "module": "Leave Management", "action": "REVIEW", "description": "Approve or reject leave requests from assigned direct reports"},
    {"permission_name": "leave_request.cancel", "module": "Leave Management", "action": "CANCEL", "description": "Cancel your own pending leave request"},
]


def seed_permissions():
    db = Session(bind=engine)

    try:
        for permission_data in permissions:
            existing_permission = (
                db.query(Permission)
                .filter(
                    Permission.permission_name
                    == permission_data["permission_name"]
                )
                .first()
            )

            if existing_permission:
                print(
                    f"Permission already exists: "
                    f"{permission_data['permission_name']}"
                )
                continue

            db.add(Permission(**permission_data))
            print(f"Added permission: {permission_data['permission_name']}")

        db.commit()
        print("Permissions seeded successfully.")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    seed_permissions()
