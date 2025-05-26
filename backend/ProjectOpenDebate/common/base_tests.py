import json
from django.test import TestCase, TransactionTestCase
from ProjectOpenDebate.asgi import application
from notifications.models import NotificationType
from channels.testing import WebsocketCommunicator

NOTIFICATION_TYPES = [
    NotificationType(
        id=1,
        name="new_discussion",
        title_template="Live debate started!",
        message_template="Your request to debate on {debate_title} has been fulfilled and a live chat was created with {participant_username}.",
        endnote_template="Go to chat"
    ),
    NotificationType(
        id=2,
        name="new_message",
        title_template="New message!",
        message_template="You have received a new message from {participant_username} on the debate {debate_title}.",
        endnote_template="View message"
    ),
    NotificationType(
        id=3,
        name="accepted_invite",
        title_template="Invite Accepted!",
        message_template="{participant_username} accepted your invite to debate on {debate_title} and a live chat was created.",
        endnote_template="Go to chat"
    ),
]


class BaseTestCase(TestCase):
    @classmethod
    def setUpTestData(cls):
        NotificationType.objects.bulk_create(NOTIFICATION_TYPES)


class BaseTransactionTestCase(TransactionTestCase):
    required_consts = ["STREAM_NAME"]

    def __init_subclass__(cls):
        super().__init_subclass__()
        for var in cls.required_consts:
            if not hasattr(cls, var):
                raise NotImplementedError(f"Class '{cls.__name__}' must define '{var}'")

    @classmethod
    def customSetUp(cls):
        NotificationType.objects.bulk_create(NOTIFICATION_TYPES)

    def _get_stream_name(self):
        """
        Returns the stream name for the test case.
        """
        return getattr(self, "STREAM_NAME", None)

    async def connect_client(self, user):
        """Helper method to connect a client with authentication"""
        # Create a WebSocket communicator with authentication
        communicator = DemultiplexerWSCommunicator(
            stream_name=self._get_stream_name(),
        )
        # Add auth to the scope (simulating auth middleware)
        communicator.scope["user"] = user
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        return communicator

    async def send_and_receive(self, communicator, event_type, data):
        """Helper method to send an event and get response"""
        await communicator.send_json_to({
            "event_type": event_type,
            "data": data
        })
        response = await communicator.receive_json_from()
        return response


class DemultiplexerWSCommunicator(WebsocketCommunicator):
    """
    A custom WebsocketCommunicator that allows for the use of a demultiplexer
    in the test cases.
    """

    def __init__(self, stream_name: str, debug=False, *args, **kwargs):
        self.stream_name = stream_name
        self.debug = debug
        super().__init__(application, f"/ws/", *args, **kwargs)

    async def send_input(self, message):
        """
        Override the send_input method to send messages to the correct stream.
        """
        # If its a connect, disconnect or accept message, just send it to the base class
        # Otherwise, wrap the message in a dict with the stream name
        # and payload.
        if message.get("type") in ["websocket.connect", "websocket.disconnect", "websocket.accept"]:
            if self.debug:
                print(f"Sending message to stream {self.stream_name}: {message}")
            return await super().send_input(message)
        elif message.get("type") != "websocket.receive":
            raise ValueError(f"Unknown message type in DemultiplexerWSCommunicator: {message.get('type')}")

        payload = json.loads(message.get("text"))
        wrapped_message = {
            "type": "websocket.receive",
            "text": json.dumps({
                "stream": self.stream_name,
                "payload": payload,
            })
        }
        if self.debug:
            print(f"Sending message to stream {self.stream_name}: {wrapped_message}")
        await super().send_input(wrapped_message)

    async def receive_json_from(self, timeout=1):
        """
        Override the receive_json_from method to retrieve the payload from the wrapped message.

        :return: The received message.
        """
        message = await super().receive_json_from(timeout)  # type: dict
        assert isinstance(message, dict), "Message is not a dict"
        assert "stream" in message, "No stream found in message"
        assert "payload" in message, "No payload found in message"
        assert message[
                   "stream"] == self.stream_name, f"Received message from wrong stream: {message['stream']} != {self.stream_name}"
        if self.debug:
            print(f"Received message from stream {message['stream']}: {message['payload']}")
        return message["payload"]
