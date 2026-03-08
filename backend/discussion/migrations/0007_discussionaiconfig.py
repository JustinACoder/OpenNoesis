from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('discussion', '0006_delete_discussionrequest'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='DiscussionAIConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ai_stance', models.SmallIntegerField(choices=[(1, 'FOR'), (-1, 'AGAINST')])),
                ('model', models.CharField(max_length=128)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('bot_user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ai_discussion_set', to=settings.AUTH_USER_MODEL)),
                ('discussion', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='ai_config', to='discussion.discussion')),
                ('last_trigger_message', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='+', to='discussion.message')),
            ],
        ),
    ]
