from allauth.account.adapter import DefaultAccountAdapter
from django.contrib.sites.shortcuts import get_current_site
from post_office import mail


class PostOfficeAccountAdapter(DefaultAccountAdapter):
    """Queue allauth emails through django-post-office."""

    def send_mail(self, template_prefix: str, email: str, context: dict) -> None:
        request = self.request
        ctx = {
            "request": request,
            "email": email,
            "current_site": get_current_site(request),
        }
        ctx.update(context)

        message = self.render_mail(template_prefix, email, ctx)
        headers = dict(message.extra_headers or {})
        if message.reply_to:
            headers["Reply-To"] = ", ".join(message.reply_to)

        html_message = ""
        for content, mimetype in getattr(message, "alternatives", []):
            if mimetype == "text/html":
                html_message = content
                break

        mail.send(
            recipients=list(message.to or [email]),
            sender=message.from_email,
            subject=message.subject,
            message=message.body or "",
            html_message=html_message,
            cc=list(message.cc or []),
            bcc=list(message.bcc or []),
            headers=headers or None,
            attachments=list(getattr(message, "attachments", [])),
            backend="default",
        )
