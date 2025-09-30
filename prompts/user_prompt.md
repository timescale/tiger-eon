{% if user %}
**User Info:**
id: {{ user.id }}
username: {{ user.name }}
real_name: {{ user.real_name }}
local time zone: {{ user.tz }}
{% if local_time %}user's local time: {{ local_time }}{% endif %}
{% endif %}

**Message Details:**
channel: {{ mention.channel }}
ts: {{ mention.ts }}
{% if mention.thread_ts %}thread_ts: {{ mention.thread_ts }}{% endif %}
event_ts: {{ event.event_ts }}

**Respond to this message:**
{{ mention.text }}