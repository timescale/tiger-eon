# Prompt Templates

Eon uses Jinja2 templates for dynamic, context-aware prompt generation.

## Template Files

### [system_prompt.md](/prompts/system_prompt.md)

The system prompt defines the AI's role, capabilities, and behavior patterns. This template sets the foundation for how Eon will respond and interact.

### [user_prompt.md](/prompts/user_prompt.md)

The user prompt formats the user's request with relevant context, providing the AI with all necessary information to generate an appropriate response.

## Template Context Variables

Templates have access to a comprehensive context object with the following variables:

| Variable | Description |
|----------|-------------|
| `event` | Complete Event object with processing metadata |
| `mention` | AppMentionEvent with Slack message details |
| `bot` | Bot information (name, team, capabilities) |
| `user` | User profile (real_name, timezone, etc.) |
| `local_time` | Event timestamp in user's timezone |

For details on prompt customization, see [tiger-agents-for-work](https://github.com/timescale/tiger-agents-for-work), the library powering tiger-eon.
