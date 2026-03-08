from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('discussion', '0007_discussionaiconfig'),
    ]

    operations = [
        migrations.AddField(
            model_name='discussionaiconfig',
            name='last_openai_response_id',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
