"""notifications.py — Real Slack & Discord webhook dispatch for Bob PR Health Scanner."""
import json
from typing import Optional
from urllib import request as urllib_request, error as urllib_error

try:
    from .logger import get_logger
except ImportError:
    from logger import get_logger

logger = get_logger(__name__)


def send_slack_notification(webhook_url: str, issue_type: str, title: str,
                            repo: str, url: str, author: str = 'Unknown') -> bool:
    """Send a formatted Slack notification via incoming webhook."""
    if not webhook_url or not webhook_url.startswith('https://hooks.slack.com/'):
        return False

    color = '#f59e0b' if issue_type == 'merge_conflict' else '#ef4444'
    type_label = '🔀 Merge Conflict' if issue_type == 'merge_conflict' else '❌ CI Failure'

    payload = {
        "attachments": [{
            "color": color,
            "blocks": [
                {
                    "type": "header",
                    "text": {"type": "plain_text", "text": f"Bob PR Health Alert", "emoji": True}
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Type:*\n{type_label}"},
                        {"type": "mrkdwn", "text": f"*Repository:*\n`{repo}`"},
                        {"type": "mrkdwn", "text": f"*Author:*\n@{author}"},
                        {"type": "mrkdwn", "text": f"*Title:*\n{title}"},
                    ]
                },
                {
                    "type": "actions",
                    "elements": [{
                        "type": "button",
                        "text": {"type": "plain_text", "text": "View on GitHub"},
                        "url": url,
                        "style": "primary"
                    }]
                }
            ]
        }]
    }

    return _post_webhook(webhook_url, payload, 'Slack')


def send_discord_notification(webhook_url: str, issue_type: str, title: str,
                              repo: str, url: str, author: str = 'Unknown') -> bool:
    """Send a formatted Discord notification via webhook."""
    if not webhook_url or not webhook_url.startswith('https://discord.com/api/webhooks/'):
        return False

    color = 0xF59E0B if issue_type == 'merge_conflict' else 0xEF4444
    type_label = '🔀 Merge Conflict' if issue_type == 'merge_conflict' else '❌ CI Failure'

    payload = {
        "username": "Bob PR Health",
        "embeds": [{
            "title": f"PR Health Alert — {type_label}",
            "color": color,
            "fields": [
                {"name": "Repository", "value": f"`{repo}`", "inline": True},
                {"name": "Author", "value": f"@{author}", "inline": True},
                {"name": "Issue", "value": title, "inline": False},
            ],
            "url": url,
            "footer": {"text": "Bob PR Health Scanner"}
        }]
    }

    return _post_webhook(webhook_url, payload, 'Discord')


def dispatch_notifications(slack_webhook: Optional[str], discord_webhook: Optional[str],
                           issue_type: str, title: str, repo: str, url: str,
                           author: str = 'Unknown') -> dict:
    """Dispatch to all configured notification channels. Returns result dict."""
    results = {'slack': False, 'discord': False}

    if slack_webhook:
        results['slack'] = send_slack_notification(
            slack_webhook, issue_type, title, repo, url, author
        )

    if discord_webhook:
        results['discord'] = send_discord_notification(
            discord_webhook, issue_type, title, repo, url, author
        )

    if results['slack'] or results['discord']:
        logger.info(f"Notifications sent for {repo}: slack={results['slack']}, discord={results['discord']}")

    return results


def _post_webhook(webhook_url: str, payload: dict, service_name: str) -> bool:
    """Post JSON payload to a webhook URL."""
    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib_request.Request(
            webhook_url,
            data=data,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        with urllib_request.urlopen(req, timeout=10) as resp:
            status = getattr(resp, 'status', 200)
            if status < 300:
                logger.info(f"{service_name} notification sent successfully")
                return True
            logger.warning(f"{service_name} webhook returned HTTP {status}")
            return False
    except urllib_error.HTTPError as e:
        logger.error(f"{service_name} webhook HTTP error: {e.code} — {e.read().decode('utf-8', errors='replace')[:200]}")
        return False
    except Exception as e:
        logger.error(f"{service_name} webhook error: {e}")
        return False
