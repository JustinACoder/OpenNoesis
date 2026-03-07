from channels.db import database_sync_to_async
from django.db.models import Q
from pydantic import ValidationError
import json

from ProjectOpenDebate.consumers import CustomBaseConsumer
from .models import Discussion, Message
from .schemas import MessageSchema, NewMessagePayload, ReadMessagesPayload

class DiscussionConsumer(CustomBaseConsumer):
    """
    This consumer handles the WebSocket connection for all operations related to discussions.
    """
    stream_name = 'discussion'
    event_handlers = {
        'new_message': 'handle_new_message',
        'read_messages': 'handle_read_messages',
    }

    async def handle_new_message(self, data):
        """
        Handles receiving a new message from the client.
        """
        try:
            payload = NewMessagePayload(**data)
        except ValidationError as e:
            return await self.send_error('Invalid payload', details=json.loads(e.json()))

        user = self.scope['user']

        # Check that the user is a participant in the discussion
        try:
            discussion = await Discussion.objects.aget(
                Q(participant1=user) | Q(participant2=user),
                id=payload.discussion_id
            )
        except Discussion.DoesNotExist:
            return await self.send_error('You are not a participant in this discussion')

        # Save the message to the database
        message_instance = await Message.objects.acreate(
            discussion=discussion,
            author=user,
            text=payload.message,
        )

        # Mark this message's discussion's read checkpoint as read until this message
        user_readcheckpoint = await discussion.readcheckpoint_set.aget(user=user)
        await database_sync_to_async(user_readcheckpoint.read_until)(message_instance)

        # Transform message instance into a schema
        message_data = MessageSchema.model_validate(message_instance).model_dump(mode="json")

        # Send the message to all participants in the discussion
        participants_ids = [discussion.participant1_id, discussion.participant2_id]
        is_archived_flags = [discussion.is_archived_for_p1, discussion.is_archived_for_p2]
        for participant_id, is_archived in zip(participants_ids, is_archived_flags):
            await self.send_event(
                participant_id,
                'new_message',
                {
                    'isin_archived_discussion': is_archived,
                    'message': message_data,
                }
            )

    async def handle_read_messages(self, data):
        """
        Handles marking messages as read.
        """
        try:
            payload = ReadMessagesPayload(**data)
        except ValidationError as e:
            return await self.send_error('Invalid payload', details=json.loads(e.json()))

        user = self.scope['user']

        # Check that the user is a participant in the discussion
        try:
            discussion = await Discussion.objects.aget(
                Q(participant1=user) | Q(participant2=user),
                id=payload.discussion_id
            )
        except Discussion.DoesNotExist:
            return await self.send_error('You are not a participant in this discussion')

        # TODO: there could be a bug where the user reads the messages, but the other user sends a message before the
        #  read checkpoint is updated. This would mark the message as read even though the user hasn't read it.

        # Get the ReadCheckpoint for the user
        read_checkpoint = await discussion.readcheckpoint_set.aget(user=user)

        # Update the ReadCheckpoint with the current time and latest message
        num_messages_read = await database_sync_to_async(read_checkpoint.read_messages)()

        # Send the updated ReadCheckpoint information to BOTH participants
        participants_ids = [discussion.participant1_id, discussion.participant2_id]
        is_archived_flags = [discussion.is_archived_for_p1, discussion.is_archived_for_p2]
        for participant_id, is_archived in zip(participants_ids, is_archived_flags):
            await self.send_event(
                participant_id,
                'read_messages',
                {
                    'discussion_id': discussion.id,
                    'user_id': user.id,
                    'is_archived': is_archived,
                    'num_messages_read': num_messages_read,
                    'through_load_discussion': payload.through_load_discussion
                }
            )
