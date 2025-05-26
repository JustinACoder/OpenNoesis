from django.db import migrations

from django.db import models


def map_zero_to_minus_one(apps, schema_editor):
    Stance = apps.get_model('debate', 'Stance')
    Stance.objects.filter(stance=0).update(stance=-1)

class Migration(migrations.Migration):

    dependencies = [
        ('debate', '0006_stance_debate_stan_user_id_46459d_idx_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='stance',
            name='stance',
            field=models.IntegerField(choices=[(1, 'FOR'), (-1, 'AGAINST')]),
        ),
        migrations.RunPython(map_zero_to_minus_one),
    ]
