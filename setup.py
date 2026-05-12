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
        'flask==3.0.0',
        'flask-cors==4.0.0',
        'flask-socketio==5.3.5',
        'python-socketio==5.10.0',
        'gunicorn==21.2.0',
        'eventlet==0.33.3',
    ],
    python_requires='>=3.8',
)
