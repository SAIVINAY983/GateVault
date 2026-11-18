from rest_framework import permissions

class IsActiveUser(permissions.BasePermission):
    """
    Ensures that the requesting user is authenticated and actively enabled.
    Rejects deactivated or suspended accounts immediately.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_active)


class IsAdminUser(permissions.BasePermission):
    """
    Permits access strictly to active Community Administrators.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.is_active and 
            (request.user.role == 'ADMIN' or request.user.is_superuser)
        )

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)


class IsGuardUser(permissions.BasePermission):
    """
    Permits access strictly to active Security Guards.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.is_active and 
            request.user.role == 'GUARD'
        )

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)


class IsResidentUser(permissions.BasePermission):
    """
    Permits access strictly to active Residents with an APPROVED profile status.
    Blocks pending, rejected, or deactivated residents from accessing any resident data or features.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated and request.user.is_active and request.user.role == 'RESIDENT'):
            return False
        try:
            profile = getattr(request.user, 'resident_profile', None)
            if profile and profile.approval_status != 'APPROVED':
                return False
        except Exception:
            return False
        return True

    def has_object_permission(self, request, view, obj):
        if not self.has_permission(request, view):
            return False
        return is_user_data_owner(request.user, obj)


class IsPrimaryResident(permissions.BasePermission):
    """
    Permits access strictly to approved Primary Residents (who manage household members).
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated and request.user.is_active and request.user.role == 'RESIDENT'):
            return False
        try:
            profile = getattr(request.user, 'resident_profile', None)
            return bool(profile and profile.approval_status == 'APPROVED' and profile.flat and profile.is_primary)
        except Exception:
            return False

    def has_object_permission(self, request, view, obj):
        if not self.has_permission(request, view):
            return False
        return is_user_data_owner(request.user, obj)


class IsAdminOrGuard(permissions.BasePermission):
    """
    Permits access to active Administrators or Security Guards for operational gatehouse tasks.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and 
            request.user.is_authenticated and 
            request.user.is_active and 
            (request.user.role in ['ADMIN', 'GUARD'] or request.user.is_superuser)
        )


class IsAdminOrReadOnlyGuard(permissions.BasePermission):
    """
    Permits active Administrators full read/write access.
    Permits active Security Guards read-only access (SAFE_METHODS).
    Rejects guards attempting to mutate community settings (e.g. creating/deleting shelves).
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated and request.user.is_active):
            return False
        if request.user.role == 'ADMIN' or request.user.is_superuser:
            return True
        if request.user.role == 'GUARD' and request.method in permissions.SAFE_METHODS:
            return True
        return False


class IsObjectOwnerOrAdmin(permissions.BasePermission):
    """
    Object-level permission check:
    - Community Admins have full access.
    - Residents are restricted strictly to objects matching their own account or flat.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_active)

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated and request.user.is_active):
            return False
        if request.user.role == 'ADMIN' or request.user.is_superuser:
            return True
        return is_user_data_owner(request.user, obj)


class IsParcelOwnerOrPermitted(permissions.BasePermission):
    """
    Enforces strict parcel data isolation:
    - Community Admins: full access.
    - Security Guards: operational gatehouse access.
    - Residents: ONLY parcels belonging to their account, their delegated pickup, or their registered flat.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_active)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not (user and user.is_authenticated and user.is_active):
            return False
        if user.role == 'ADMIN' or user.is_superuser:
            return True
        if user.role == 'GUARD':
            return True
        if user.role == 'RESIDENT':
            # Strict flat & resident data isolation
            if getattr(obj, 'resident', None) == user:
                return True
            if getattr(obj, 'delegated_to', None) == user:
                return True
            if getattr(obj, 'actual_receiver', None) == user:
                return True
            try:
                user_flat = user.resident_profile.flat
                if user_flat and getattr(obj, 'flat', None) == user_flat:
                    return True
            except Exception:
                pass
            return False
        return False


def is_user_data_owner(user, obj):
    """
    Helper function to determine if an object belongs to the user or the user's flat.
    """
    if getattr(obj, 'resident', None) == user:
        return True
    if getattr(obj, 'user', None) == user:
        return True
    if getattr(obj, 'created_by', None) == user:
        return True

    # Check flat-level ownership
    try:
        user_flat = user.resident_profile.flat
        if user_flat:
            if getattr(obj, 'flat', None) == user_flat:
                return True
            obj_resident = getattr(obj, 'resident', None)
            if obj_resident and getattr(obj_resident, 'resident_profile', None):
                if obj_resident.resident_profile.flat == user_flat:
                    return True
    except Exception:
        pass

    return False
