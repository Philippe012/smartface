from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsAdmin(BasePermission):
    """Full administrative access."""

    message = "Administrator access is required."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_admin)


class IsStaffMember(BasePermission):
    """Administrators and system operators."""

    message = "Administrator or operator access is required."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_staff_member)


class IsStaffReadAdminWrite(BasePermission):
    """Operators may read; only administrators may change."""

    message = "Administrator access is required for this change."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and user.is_staff_member):
            return False
        return request.method in SAFE_METHODS or user.is_admin


class IsEmployeeUser(BasePermission):
    """Employee portal: an active employee account linked to an employee record."""

    message = "An employee account linked to an employee record is required."

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user and user.is_authenticated and user.role == user.Role.EMPLOYEE and user.employee_id
        )
