from rest_framework.routers import SimpleRouter

from .views import CameraViewSet

router = SimpleRouter(trailing_slash=False)
router.register("cameras", CameraViewSet, basename="camera")

urlpatterns = router.urls
