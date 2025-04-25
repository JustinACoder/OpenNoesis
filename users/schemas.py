from django.contrib.auth import get_user_model
from ninja import ModelSchema, Field

from users.models import Profile

UserModel = get_user_model()

class PrivateUserSchema(ModelSchema):
    bio: str = Field(None, alias='profile.bio')

    class Config:
        model = UserModel
        model_fields = ['id', 'username', 'email', 'date_joined', 'is_staff']


class ProfileEditSchema(ModelSchema):
    bio: str = Field(None, alias='profile.bio', max_length=2048)
    class Config:
        model = Profile
        model_exclude = ['id', 'user']

class PublicUserSchema(PrivateUserSchema):
    class Config:
        model = UserModel
        model_fields = ['id', 'username', 'date_joined', 'is_staff']

class UserPreviewSchema(ModelSchema):
    class Config:
        model = UserModel
        model_fields = ['id', 'username']