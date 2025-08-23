# File: config.py

import os

from dotenv import load_dotenv
load_dotenv()

IMAGE_SIZE = (299, 299)

DATASET_DIR = os.getenv("DATASET_DIR")
CLASS_INDICES_DIR = os.getenv("TRAIN_DATASET_DIR")
TEST_DATASET_DIR = os.getenv("TEST_DATASET_DIR")

MODEL_FILES = {
    'InceptionV3': os.getenv('MODEL_INCEPTIONV3'),
    'InceptionV4': os.getenv('MODEL_INCEPTIONV4'),
    'InceptionResNetV2': os.getenv('MODEL_INCEPTIONRESNETV2'),
    'InceptionV3_Aug': os.getenv('MODEL_INCEPTIONV3_AUG'),
    'InceptionV4_Aug': os.getenv('MODEL_INCEPTIONV4_AUG'),
    'InceptionResNetV2_Aug': os.getenv('MODEL_INCEPTIONRESNETV2_AUG'),
}
