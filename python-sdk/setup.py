from setuptools import setup, find_packages

setup(
    name="cloudbrowser-sdk",
    version="1.0.0",
    description="Python SDK for Cloud Browser — self-hosted browser automation platform",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    packages=find_packages(),
    install_requires=["requests>=2.28.0"],
    python_requires=">=3.8",
    license="MIT",
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Topic :: Internet :: WWW/HTTP :: Browsers",
    ],
)