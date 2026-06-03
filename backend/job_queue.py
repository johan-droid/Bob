import os
from redis import Redis
from rq import Queue
from logger import get_logger

logger = get_logger(__name__)
QUEUE_NAME = os.getenv('RQ_QUEUE_NAME', 'bob-jobs')


def queue_is_configured() -> bool:
    return bool(os.getenv('REDIS_URL'))


def get_queue() -> Queue:
    redis_url = os.getenv('REDIS_URL')
    if not redis_url:
        raise RuntimeError('REDIS_URL is required for background jobs')
    redis_conn = Redis.from_url(redis_url)
    return Queue(QUEUE_NAME, connection=redis_conn)


def enqueue_background_job(function_path: str, *args, **kwargs):
    queue = get_queue()
    job = queue.enqueue(function_path, *args, **kwargs)
    logger.info(f'Queued job {job.id}: {function_path}')
    return job
