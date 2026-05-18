from setuptools import setup, find_packages

setup(
    name='bob-pr-monitor',
    version='1.0.0',
    description='Multi-Repo PR Health Monitor',
    author='Bob Team',
    packages=find_packages(),
    install_requires=[
        'requests==2.31.0',
        'python-dotenv==1.0.0',
        'flask==3.1.0',
        'flask-cors==4.0.0',
        'flask-socketio==5.4.0',
        'python-socketio==5.11.0',
        'gunicorn==21.2.0',
        'gevent==25.9.1',
        'gevent-websocket==0.10.1',
        'Flask-Session==0.8.0',
        'Flask-WTF==1.2.1',
        'WTForms==3.1.2',
        'Flask-SQLAlchemy==3.1.1',
        'SQLAlchemy==2.0.49',
        'psycopg2-binary==2.9.10',
    ],
    python_requires='>=3.10',
)
