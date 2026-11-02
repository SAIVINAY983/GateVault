from rest_framework import permissions

class IsAdminUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'ADMIN')

class IsGuardUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'GUARD')

class IsResidentUser(permissions.BasePermission):
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated and request.user.role == 'RESIDENT'):
            return False
        # Block pending and rejected residents from accessing parcel and resident features
        try:
            profile = getattr(request.user, 'resident_profile', None)
            if profile and profile.approval_status != 'APPROVED':
                return False
        except Exception:
            pass
        return True

class IsPrimaryResident(permissions.BasePermission):
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated and request.user.role == 'RESIDENT'):
            return False
        try:
            profile = request.user.resident_profile
            return bool(profile and profile.flat and profile.is_primary)
        except Exception:
            return False

class IsAdminOrGuard(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role in ['ADMIN', 'GUARD'])
