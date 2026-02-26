from django.contrib.auth import get_user_model
from ninja import ModelSchema, Field
from pydantic import validator, field_validator

from users.models import Profile

UserModel = get_user_model()


class PrivateUserSchema(ModelSchema):
    bio: str = Field(None, alias='profile.bio')

    class Meta:
        model = UserModel
        fields = ['id', 'username', 'email', 'date_joined', 'is_staff']


class ProfileEditInputSchema(ModelSchema):
    bio: str = Field(None, alias='profile.bio')

    @field_validator("bio")
    def check_bio_length(cls, v):
        if v is not None and len(v) > 2048:
            raise ValueError("bio must be at most 2048 characters")
        return v

    class Meta:
        model = Profile
        exclude = ['id', 'user']


class PublicUserSchema(ModelSchema):
    bio: str = Field(None, alias='profile.bio')

    class Meta:
        model = UserModel
        fields = ['id', 'username', 'date_joined', 'is_staff']


class UserPreviewSchema(ModelSchema):
    class Meta:
        model = UserModel
        fields = ['id', 'username']
